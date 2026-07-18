# RISK TERMINAL — Observability Simulator

**Live demo → [rl-risk-terminal.vercel.app](https://rl-risk-terminal.vercel.app)** &nbsp;·&nbsp; **Blog post → [Read on Medium](https://medium.com/@kartikkale03/reinforcement-learning-wont-save-your-portfolio-if-it-s-flying-blind-6cce4211acd6)**

An interactive, browser-based simulator that demonstrates a core principle in reinforcement learning applied to quantitative trading: **an agent's survival performance is bounded by its observation space, not its model complexity.**

Tiers 2–5 run real PPO-trained neural networks — weights exported from PyTorch, running as matrix multiplies in the browser at 60 fps with no backend.

---

## What it shows

The simulator runs a real-time 2D multi-agent environment. Twelve position markers (`$` glyphs, representing capital) must survive a market-shock entity (a pulsing red danger radius, representing systemic risk). The shock always has full observability and pursues the nearest surviving position. The `$` agents have access only to the signals their current tier allows.

You can switch between six cumulative signal tiers (T0–T5) and watch survival rates change in real time. The educational claim — *that observation space, not policy sophistication, is the binding constraint* — becomes visible within a few episodes.

---

## Tier ladder

Each tier adds exactly one new input signal. T5 uses the same 9-feature vector as T4 but with a PPO policy trained with tuned hyperparameters, demonstrating that co-optimised weights on a complete signal set outperform additional raw signals with default initialisation.

| Tier | New signal | Input shape | Policy | Financial analog | Expected survival |
|------|-----------|-------------|--------|------------------|-------------------|
| T0 | None | `(0,)` | Scripted random walk | No market data — blind random walk | ~5–12% |
| T1 | Distance to shock | `(1,)` | Scripted panic speed | Drawdown magnitude — know how bad, not which way | ~12–22% |
| T2 | Direction vector | `(3,)` | **PPO neural net** | Momentum — first tier with intentional directional escape | ~45–62% |
| T3 | Shock velocity | `(5,)` | **PPO neural net** | Volatility — predict where the shock will be, not where it is | ~62–75% |
| T4 | Wall proximity | `(9,)` | **PPO neural net** | Liquidity / risk limits — avoid structural traps and cornering | ~75–85% |
| T5 | All signals, tuned | `(9,)` | **PPO neural net** | Full model — same features, co-optimised parameters | ~90–98% |

The `NEURAL NET` indicator in the status bar turns green when a trained model is active.

---

## Neural network agents (T2–T5)

### Training pipeline

T0 and T1 use hand-coded heuristics (no directional signal → nothing to learn). T2–T5 were trained end-to-end with Proximal Policy Optimisation (PPO) using [stable-baselines3](https://stable-baselines3.readthedocs.io/).

```
Python training                      Browser inference
─────────────────────────────────    ─────────────────────────────────
Custom Gymnasium env (env.py)   →    computeNNObs() in sim.js
  ↓ physics mirrors sim.js exactly     (same normalisation constants)
PPO (stable-baselines3)         →    nnForward() in sim.js
  MlpPolicy  net_arch=[64, 64]        (matrix multiply + tanh, no deps)
  ↓
extract_weights() → tier{N}.json →   fetch('models/tierN.json')
  PyTorch tensors → nested lists       loaded once, injected via setModels()
```

### MLP architecture

Each agent runs a 3-layer MLP with tanh activations:

```
obs (3–9 floats)
  → Linear(obs_dim → 64) + tanh
  → Linear(64 → 64)      + tanh
  → Linear(64 → 2)       (raw dx, dy — normalised to unit vector in JS)
```

The output is a 2D direction vector. The JS runtime normalises it to unit length and applies a proximity-scaled speed multiplier before moving the agent.

### Observation space (must match exactly between Python and JS)

| Feature | Formula | Active from |
|---------|---------|-------------|
| Distance (normalised) | `dist / diag(800×480)` | T2+ |
| Direction to shock x | `(shock.x − pos.x) / dist` | T2+ |
| Direction to shock y | `(shock.y − pos.y) / dist` | T2+ |
| Shock velocity x | `shock.vx / (85 × 1.08)` | T3+ |
| Shock velocity y | `shock.vy / (85 × 1.08)` | T3+ |
| Wall proximity west | `clip((120 − pos.x) / 120, 0, 1)` | T4+ |
| Wall proximity east | `clip((pos.x − 680) / 120, 0, 1)` | T4+ |
| Wall proximity north | `clip((120 − pos.y) / 120, 0, 1)` | T4+ |
| Wall proximity south | `clip((pos.y − 360) / 120, 0, 1)` | T4+ |

The normalisation constants in `env.py` and `sim.js` are identical — any drift causes the deployed agent to behave differently from what was trained.

### Training hyperparameters

```python
PPO_KWARGS = dict(
    learning_rate = 3e-4,
    n_steps       = 2048,
    batch_size    = 256,
    n_epochs      = 10,
    gamma         = 0.99,
    gae_lambda    = 0.95,
    clip_range    = 0.2,
    ent_coef      = 0.005,
    policy_kwargs = {"net_arch": [64, 64]},
)

CONFIGS = {
    2: dict(timesteps=300_000,  n_envs=8),
    3: dict(timesteps=400_000,  n_envs=8),
    4: dict(timesteps=500_000,  n_envs=8),
    5: dict(timesteps=600_000,  n_envs=8),
}
```

### Weight export format

```json
{
  "tier": 2,
  "obs_dim": 3,
  "act_dim": 2,
  "layers": [
    { "W": [[...64×3 floats...]], "b": [...64 floats...], "act": "tanh" },
    { "W": [[...64×64 floats...]], "b": [...64 floats...], "act": "tanh" },
    { "W": [[...2×64 floats...]], "b": [...2 floats...],  "act": "none" }
  ]
}
```

### In-browser inference

No ML framework. The entire forward pass is ~10 lines of vanilla JS:

```js
function nnForward(obs, layers) {
  let x = obs;
  for (const layer of layers) {
    const out = layer.b.map((bi, i) =>
      layer.W[i].reduce((s, w, j) => s + w * x[j], bi)
    );
    x = layer.act === 'tanh' ? out.map(Math.tanh) : out;
  }
  return x;
}
```

Twelve agents each call `nnForward` once per frame — comfortably within the 16 ms frame budget at 60 fps.

### Single-agent training vs multi-agent deployment

The training environment is single-agent: one position, one shock, shock always chasing that one target. This is intentional — it creates the hardest possible pressure on the agent to learn escape.

In deployment, 12 agents share the shock's attention. The shock retargets to the nearest survivor each frame, so any agent that is not the nearest effectively gets a free frame. This is why deployed survival rates are significantly higher than the single-agent eval survival logged during training — the multi-agent dynamic is an emergent property, not something the agent was explicitly trained for.

---

## How the simulation works

### Agents (positions)

Each agent updates every frame using the signals available at the active tier:

- **T0** — random heading changes every 0.8–2.2 s, constant speed
- **T1** — speed modulated by proximity: `speed = BASE × (1 + 1.5 × max(0, 1 − dist/260))`
- **T2–T5** — PPO neural network outputs a flee direction; same proximity speed scaling applied

Agents hard-bounce off arena walls. Eliminated agents fade out with an alpha decay animation.

### Market shock

The shock has full observability at all times — it targets the nearest surviving position every frame and moves at 108% of the agent base speed (`85 × 1.08 ≈ 91.8 px/s`). It represents systemic market risk, which does not need to learn agent positions.

### Episode lifecycle

1. 12 agents spawn at random non-overlapping positions
2. Shock spawns on a random arena edge
3. Episode runs for up to 15 seconds; any position touched by the shock (within 16 px) is eliminated
4. On episode end, stats are recorded for the active tier and a new episode begins after 0.8 s
5. Switching tiers immediately resets and respawns the full position set

### Equity curve

A live sparkline rendered as a step function: starts at 12, drops each time a position is eliminated. Visually mirrors a portfolio value drawdown chart.

---

## Running locally

```bash
# No install required. ES modules need an HTTP server (not file://)
npx serve .
# → http://localhost:3000
```

### Training your own models

```bash
cd training
pip install -r requirements.txt
python train.py          # trains all four tiers, writes models/tier{2-5}.json
python train.py 4 5      # train specific tiers only
```

Training takes ~5–15 min on CPU (8 parallel envs per tier).

---

## Architecture

Plain HTML/CSS/JS, no framework, no build step.

```
index.html         — page structure and semantic markup
style.css          — terminal theme via CSS custom properties
tiers.js           — single config array for all six tiers (NFR-7)
sim.js             — Simulation class: rAF loop, NN inference, position AI, rendering
main.js            — DOM wiring, model fetching, status bar, watchlist

training/
  env.py           — Gymnasium environment (physics mirrors sim.js exactly)
  train.py         — PPO training loop + PyTorch → JSON weight export
  requirements.txt

models/
  tier2.json       — trained PPO weights for T2 (obs_dim=3)
  tier3.json       — trained PPO weights for T3 (obs_dim=5)
  tier4.json       — trained PPO weights for T4 (obs_dim=9)
  tier5.json       — trained PPO weights for T5 (obs_dim=9, tuned)
```

**Key design decisions:**

- All tier signal configs, tune parameters, and UI copy live in a single `TIERS` array in `tiers.js` — adding a new tier is one array entry
- The arena and equity curve are two separate `<canvas>` elements; internal resolution is set from the DOM at load and on resize
- Model JSONs are fetched asynchronously at startup; the simulation starts immediately with scripted fallback and silently upgrades to NN as each model arrives
- Physics constants (`BASE_SPEED`, `SHOCK_MULT`, `ELIM_R`, `OBS_WALL_MARGIN`) are defined once in `env.py` and duplicated verbatim in `sim.js` — they are the contract between training and inference

---

## Concepts demonstrated

- **Partial observability in RL** — agents with identical MLP architecture but different observation spaces produce dramatically different survival rates
- **Feature engineering** — the jump from T1 (scalar distance) to T2 (direction vector) is the largest single survival gain, mirroring the value of directional signals in quantitative strategies
- **Predictive vs. reactive control** — T3's velocity input illustrates the value of rate-of-change signals (volatility) over lagged position-only signals
- **Structural risk constraints** — T4's wall proximity features map to liquidity and margin constraints: a position can dodge price risk and still be trapped by structural limits
- **Hyperparameter sensitivity** — T4 → T5 uses identical input signals; the survival gap comes from a longer training budget and tuned PPO entropy coefficient, showing that co-optimisation on a complete signal set outperforms default weights
- **In-browser ML inference** — no backend, no ONNX runtime, no TensorFlow.js; a 10-line matrix multiply is sufficient for MLP inference at interactive frame rates

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Vanilla JavaScript (ES modules) |
| Rendering | HTML5 Canvas 2D API |
| Styling | CSS custom properties, CSS Grid |
| RL training | Python · stable-baselines3 (PPO) · Gymnasium |
| NN inference | Vanilla JS matrix multiply (no runtime dependency) |
| Deployment | Vercel (static, zero config) |
| Runtime dependencies | None |
