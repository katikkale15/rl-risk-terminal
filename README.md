# RISK TERMINAL — Observability Simulator

**Live demo → [rl-risk-terminal.vercel.app](https://rl-risk-terminal.vercel.app)**

An interactive, browser-based simulator that demonstrates a core principle in reinforcement learning applied to quantitative trading: **an agent's survival performance is bounded by its observation space, not its model complexity.**

Built as a dark trading-terminal UI — not a game with a financial label bolted on.

---

## What it shows

The simulator runs a real-time 2D multi-agent environment. Twelve position markers (`$` glyphs, representing capital) must survive a market-shock entity (a pulsing red danger radius, representing systemic risk). The shock always has full observability and pursues the nearest surviving position. The `$` agents have access only to the signals their current tier allows.

You can switch between six cumulative signal tiers (T0–T5) and watch survival rates change in real time. The educational claim — *that observation space, not policy sophistication, is the binding constraint* — becomes visible within a few episodes.

---

## Tier ladder

Each tier adds exactly one new input signal. T5 uses the same 9-feature vector as T4 but with tuned parameters, demonstrating that hyperparameter optimisation on a complete signal set outperforms adding raw signals with default weights.

| Tier | New signal | Input shape | Financial analog | Expected survival |
|------|-----------|-------------|------------------|-------------------|
| T0 | None | `(0,)` | No market data — blind random walk | ~5–12% |
| T1 | Distance to shock | `(1,)` | Drawdown magnitude — know how bad, not which way | ~12–22% |
| T2 | Direction vector | `(3,)` | Momentum — first tier with intentional directional escape | ~45–62% |
| T3 | Shock velocity | `(5,)` | Volatility — predict where the shock will be, not where it is | ~62–75% |
| T4 | Wall proximity | `(9,)` | Liquidity / risk limits — avoid structural traps and cornering | ~75–85% |
| T5 | All signals, tuned | `(9,)` | Full model — same features, co-optimised parameters | ~90–98% |

---

## How the simulation works

### Agents (positions)

Each agent updates every frame using the signals available at the active tier:

- **T0** — random heading changes every 0.8–2.2 s, constant speed
- **T1** — speed modulated by proximity: `speed = BASE × (1 + panicScale × max(0, 1 − dd/260))`
- **T2** — flee vector: `normalise(pos − shock_pos)`
- **T3** — predictive flee: `normalise(pos − (shock_pos + shock_vel × t_lookahead))`
- **T4** — blended flee + wall repulsion: `normalise(flee × 0.70 + wall × 0.30)`
- **T5** — same blend with `t_lookahead = 0.8s`, `wall_weight = 0.45`, higher panic scale and speed cap

Agents hard-bounce off arena walls. Eliminated agents fade out with an alpha decay animation.

### Market shock

The shock has full observability at all times — it targets the nearest surviving position every frame and moves at 108% of the agent base speed. It represents systemic market risk, which does not need to learn agent positions.

### Episode lifecycle

1. 12 agents spawn at random non-overlapping positions
2. Shock spawns on a random arena edge
3. Episode runs for up to 15 seconds; any position touched by the shock is eliminated
4. On episode end, stats are recorded for the active tier and a new episode begins after 0.8 s
5. Switching tiers immediately resets and respawns the full position set

### Equity curve

A live sparkline rendered as a step function: starts at 12, drops each time a position is eliminated. Visually mirrors a portfolio value drawdown chart.

---

## Architecture

Plain HTML/CSS/JS, no framework, no build step.

```
index.html   — page structure and semantic markup
style.css    — full terminal theme via CSS custom properties; single-file design token source
tiers.js     — tier config array (signals, tune weights, financial analogy, model detail copy)
sim.js       — Simulation class: rAF loop, position AI, market shock, canvas rendering
main.js      — wires DOM to sim (tier buttons, sandbox toggles, obs vector, watchlist table)
```

**Key design decisions:**

- All tier signal configs, tune parameters, and UI copy live in a single `TIERS` array in `tiers.js` — adding a new tier is one array entry
- The arena and equity curve are two separate `<canvas>` elements; internal resolution is set from the DOM at load and on resize so the simulation always fills the available space
- CSS custom properties hold the entire terminal colour palette — one edit propagates everywhere
- The layout is a `100vh` CSS Grid with no scroll on desktop; columns collapse to a single stack on mobile

---

## Running locally

No install required. ES modules need an HTTP server (not `file://`):

```bash
npx serve .
# → http://localhost:3000
```

---

## Deploying

Static site — no build step, no server functions. Works on any static host.

**Vercel** (connected to this repo — auto-deploys on push to `main`):
```bash
git push origin main
```

**Manual deploy:**
```bash
vercel --prod
```

---

## Concepts demonstrated

- **Partial observability in RL** — agents with identical policy structure but different observation spaces produce dramatically different survival rates
- **Feature engineering** — the jump from T1 (scalar distance) to T2 (direction vector) is the largest single survival gain, mirroring the value of directional signals in quantitative strategies
- **Predictive vs. reactive control** — T3's lookahead illustrates the value of velocity/rate-of-change signals (volatility) over lagged price-only signals
- **Structural risk constraints** — T4's wall avoidance maps directly to liquidity and margin constraints: a position can dodge price risk and still be trapped by structural limits
- **Hyperparameter sensitivity** — T4 → T5 uses identical input signals; the survival gap is entirely from tuned lookahead, blend weights, and speed parameters

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Language | Vanilla JavaScript (ES modules) |
| Rendering | HTML5 Canvas 2D API |
| Styling | CSS custom properties, CSS Grid, Flexbox |
| Deployment | Vercel (static) |
| Dependencies | None |
