# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Risk Terminal — A Live Feature-Ablation Simulator for Trading & Risk Agents**

A single-page, static web app that demonstrates how a trading/risk agent's survival performance is bounded by its *observation space*, not model complexity. The UI is framed as a live risk-desk terminal: `$`-glyph positions (analogized to capital) must survive a pulsing red market-shock entity inside a dark, monospace, terminal-styled canvas. The predator/prey mechanic is internal; the product surface is a risk terminal end-to-end.

Full spec: `SRS_Observability_Simulator.md` — read it before making changes to simulation logic, tier behavior, or UI copy.

## Build & Dev Commands

No build step. Plain HTML/CSS/JS with ES modules (`type="module"`).

```bash
# Local dev — must use a real HTTP server (ES modules require it)
npx serve .          # serves on http://localhost:3000

# Deploy — push to GitHub, then import repo on vercel.com (zero config needed)
# Vercel auto-detects a static site and serves index.html directly.
```

Files: `index.html`, `style.css`, `tiers.js`, `sim.js`, `main.js`.

## Architecture

### Simulation engine
Two `<canvas>` elements driven by `requestAnimationFrame`:
1. **Arena canvas** — renders the bounded grid, `$`-glyph positions, and the market-shock entity each frame.
2. **Equity curve canvas** — a sparkline tracking surviving-position count over the episode; resets on episode end or tier change.

The simulation loop owns all mutable state: position objects, market-shock object, episode timer, and per-tier stats accumulators. UI controls (tier buttons, toggles, play/pause) mutate this state synchronously; the next frame picks up the change.

### Tier / signal config
All six tiers (T0–T5) and the sandbox (Custom) mode must be expressed as a **single config array** — not scattered across the codebase (NFR-7). Each entry holds:
- `signals: { distance, direction, velocity, walls }` — booleans controlling what each position "sees"
- `signalLabel` — shown in the `SIGNAL:` HUD field
- `financialAnalog: { title, description }` — content for the `FEATURE ONLINE` card

Tier selection immediately applies the new signal config to all positions and resets the equity curve. Sandbox mode sets any combination outside the six presets; those episodes are excluded from (or shown separately in) the watchlist table.

### Position AI
Each position's per-frame behavior is gated by its active signals:
- **T0** — random heading, constant speed
- **T1 (+distance)** — speed modulation proportional to proximity; no directional escape
- **T2 (+direction)** — flee vector away from shock's current position
- **T3 (+velocity)** — flee vector away from shock's *extrapolated* position
- **T4 (+walls)** — flee vector blended with wall-avoidance vector
- **T5** — all four signals combined and tuned

The market shock always has full observability (it targets the nearest surviving position each frame) and moves at a constant speed ~7–10% faster than position base speed.

### Statistics
`TierStats[0..5]` accumulates `episodesCompleted`, `totalSpawned`, `totalSurvived` in memory for the session. The watchlist table derives `survivalRate = totalSurvived / totalSpawned` and updates after every episode regardless of which tier is currently selected. Optional `localStorage` persistence is acceptable when deployed outside Claude.ai.

### Observation vector readout
One "focus" position (nearest surviving position to the shock) is tracked each frame. Its four fields — `DD:`, `DIR:`, `VOL:`, `LIQ:` — show live numeric values when the signal is active, or `—` when locked. The distinction is text-based (dash vs. number), not color-only.

## Visual / Theme Rules (binding)

- **Palette:** near-black backgrounds, one muted green (positions, active borders, equity line), one muted red (market shock). No additional hues.
- **Typography:** monospace throughout; sentence case for descriptive copy, uppercase for short terminal tags (`SIGNAL:`, `DD:`, `TIER 0`).
- **No gradients, drop shadows, or glow** except the single pulsing-radius animation on the market shock.
- **Tier buttons:** bordered terminal style; active tier = brighter border + text, not a fill change.
- All CSS theme tokens (colors, font stack) must live in one place (CSS custom properties or a shared constants file).

## Key Constraints

- Zero backend, zero auth, zero external API calls at runtime.
- Must run at ≥30fps with 15 concurrent agents; target 60fps on mid-range laptop.
- Responsive down to 360px viewport width.
- Keyboard-accessible controls with visible focus states; active/locked field distinction must not rely on color alone (the dash vs. number satisfies this).
- `localStorage` is off-limits inside a Claude.ai artifact; fine in standalone deployments.
