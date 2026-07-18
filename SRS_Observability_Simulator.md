
# Software Requirements Specification
## Project: Risk Terminal — A Live Feature-Ablation Simulator for Trading & Risk Agents

**Version:** 1.1
**Prepared for:** Solo build via Claude Code, static deployment on free hosting (e.g. Vercel/Netlify/GitHub Pages)
**Document owner:** Product owner (you)
**Changelog:** v1.1 replaces the generic "game UI" from v1.0 with a dark trading-terminal visual language, decided after prototyping (see Section 5.5). Underlying simulation logic (FR-1 through FR-4) is unchanged from v1.0; this revision changes terminology, visual treatment, and adds the equity curve and watchlist statistics table.

---

## 1. Introduction

### 1.1 Purpose
This document specifies the requirements for an interactive, browser-based educational simulator that demonstrates how a trading/risk agent's survival performance is bounded by its **observation space**, not its model complexity. The simulator is presented as a live risk-desk terminal: positions (agents) must survive a market shock (the threat entity) inside a dark, monospace, terminal-styled interface — not as a game with a financial label attached to it. The underlying predator/prey mechanic is internal implementation detail; the user-facing product is a risk terminal end to end. It is intended as a public educational tool and as a demonstration of applied understanding of reinforcement learning and quantitative risk concepts.

### 1.2 Scope
The product is a single-page web application (SPA) with no backend, no user accounts, and no persistent server-side data. It will:
- Run a real-time 2D simulation of one market-shock entity and multiple position markers inside a bounded arena, rendered as a dark terminal display.
- Let the user select or customize which signals (observation features) the positions have access to, across 6 cumulative risk-model tiers (T0–T5).
- Render a live "observation vector" readout (styled as a terminal data feed) showing exactly what data is available at the selected tier.
- Display a "feature online" card that translates each tier into the risk/trading concept it represents (drawdown, momentum, volatility, liquidity).
- Render a live equity/survivor curve showing portfolio-style value over the course of an episode.
- Track and display aggregate survival statistics per tier in a watchlist-style backtest table.
- Be deployable as a static site with zero backend dependencies.

### 1.3 Out of Scope
- No real market data, brokerage integration, or live trading of any kind.
- No user accounts, login, or saved profiles.
- No multiplayer or server-synchronized state.
- No mobile native app (responsive web only).

### 1.4 Definitions
| Term | Meaning |
|---|---|
| Position | A simulated entity trying to survive; rendered as a `$` marker; analogized to a live trading/risk position. Internally equivalent to "prey" in the v1.0 mechanic. |
| Market shock | The threat entity, rendered as a pulsing red danger radius; analogized to market risk (crash, volatility spike, margin call). Internally equivalent to "predator." |
| Observation vector | The set of numeric inputs a given position is allowed to "see" at its current tier, shown in the terminal-style readout (e.g. `DD:`, `DIR:`, `VOL:`, `LIQ:`). |
| Tier | One of 6 cumulative presets (T0–T5) that each add one new signal. Equivalent to "Level L1–L6" in v1.0; T0 = L1, T5 = L6. |
| Signal | The name shown for the currently active feature (e.g. `MOMENTUM`, `VOLATILITY`, `LIQUIDITY`, `FULL MODEL`). |
| Equity curve | A live sparkline plotting surviving-position count over the course of an episode, styled as a portfolio value/drawdown chart. |
| Watchlist table | The per-tier statistics table (episodes run, survival rate), styled like a trading watchlist/backtest report rather than a plain scoreboard. |
| Episode | One simulation run, from spawn to either arena-timeout or all-positions-eliminated. |
| Sandbox / Custom mode | Manual toggling of individual signals outside the fixed T0–T5 presets. |

### 1.5 References
Conceptual basis: reinforcement learning under partial observability; feature engineering in quantitative trading and risk systems (position sizing, momentum/trend signals, volatility/rate-of-change, liquidity and margin constraints).

---

## 2. Overall Description

### 2.1 Product Perspective
Standalone, self-contained static web app. No dependency on any external API at runtime (fonts and libraries, if any, must be bundled or loaded from a CDN with graceful fallback).

### 2.2 Product Functions (Summary)
1. Run a continuous, real-time multi-agent chase simulation on a `<canvas>`.
2. Provide 6 preset "levels," each cumulatively adding one observation feature to all prey agents.
3. Provide a sandbox mode with 4 independent sensor toggles for free experimentation.
4. Display a live, per-agent observation-vector HUD, showing locked ("—") vs. active values.
5. Display a financial-analogy card for the active level.
6. Track and display per-level aggregate statistics (episodes run, average survival rate) in a results table.
7. Auto-cycle episodes (respawn on episode end) so statistics accumulate without manual intervention.
8. Allow manual reset, pause/resume, and level switching at any time.

### 2.3 User Classes
- **Primary:** Students/learners of RL or quant finance, self-service, no account.
- **Secondary:** Recruiters/reviewers assessing the builder's understanding of RL-to-finance mapping (drives the emphasis on the financial-analogy panel and results table as "evidence of understanding," not just a game).

### 2.4 Operating Environment
- Modern evergreen browsers (Chrome, Firefox, Safari, Edge), desktop and mobile viewport widths (≥360px).
- No install required; runs entirely client-side.
- Target: static hosting with no server compute (Vercel/Netlify/GitHub Pages/Cloudflare Pages).

### 2.5 Design and Implementation Constraints
- No backend, no database, no authentication.
- No use of `localStorage`/`sessionStorage` if built as a Claude artifact; acceptable and recommended if deployed independently outside Claude.ai (e.g. via Claude Code to its own static host), where standard browser storage APIs work normally and may be used for persisting aggregate stats across sessions if desired (optional, see 4.7).
- Must run at a stable frame rate (target 60fps desktop, degrade gracefully to 30fps on low-power devices) with up to ~15 simultaneous agents.
- Single-file or component-based structure acceptable; framework choice (plain JS/Canvas, or React + Canvas/SVG) left to implementation, but must not require a build step to *view* the final deployed output (a build step to *produce* the static output, e.g. Vite/Next static export, is fine).

### 2.6 Assumptions and Dependencies
- No real-time market data feed is required or used; all financial framing is analogical/educational.
- User has a pointer or touch input device; keyboard-only operation is a nice-to-have, not required.

---

## 3. Functional Requirements

### FR-1: Arena & Entities
- FR-1.1: The system shall render a bounded rectangular arena with visible gridlines, styled as a dark terminal display (see 5.5).
- FR-1.2: The system shall spawn a configurable number of position markers (default: 10–12), rendered as `$` glyphs, at random non-overlapping locations at the start of each episode.
- FR-1.3: The system shall spawn exactly one market-shock entity per episode, rendered as a pulsing red danger radius, targeting the nearest surviving position at all times (the market shock has full observability of all positions at all times — it represents systemic market risk, which does not need to "learn" a position's location).
- FR-1.4: The market shock shall move toward its current target at a constant speed slightly greater than the position base speed (tunable constant; default 7–10% faster).
- FR-1.5: When the market-shock-to-position distance falls below an elimination-radius threshold, the position shall be marked "eliminated," visually removed (fade-out), and the market shock shall immediately retarget the nearest remaining surviving position.
- FR-1.6: An episode shall end when either (a) all positions are eliminated, or (b) a maximum episode duration is reached (default: 15 simulated seconds). Positions surviving at timeout count as "survived" for that episode.
- FR-1.7: On episode end, the system shall automatically start a new episode within 1–2 seconds, preserving the currently selected tier/signal configuration, and shall reset the equity curve (FR-8) to its starting value.

### FR-2: Risk-Model Tiers (Preset Ladder)
The system shall implement 6 cumulative tiers, labeled T0–T5. Each tier enables the signals of all prior tiers plus one new one, and lights up a `SIGNAL:` label in the terminal HUD.

| Tier | New signal added | Signal label | Position behavior enabled |
|---|---|---|---|
| T0 | None (blind) | `NONE` | Random heading, constant speed; no reaction to the market shock. |
| T1 | Scalar distance to market shock | `DRAWDOWN` | Speed/panic modulation only; no directional escape. |
| T2 | Direction vector to market shock (dx, dy) | `MOMENTUM` | Directed flee away from the shock's current position. |
| T3 | Market shock's velocity | `VOLATILITY` | Predictive flee away from the shock's extrapolated future position. |
| T4 | Wall/boundary proximity | `LIQUIDITY` | Flee vector blended with wall-avoidance vector to prevent cornering. |
| T5 | Full combination, tuned | `FULL MODEL` | All of the above combined; near-total survival rate expected. |

- FR-2.1: The system shall provide 6 clearly labeled, clickable tier controls (`TIER 0` through `TIER 5`).
- FR-2.2: Selecting a tier shall immediately apply that signal configuration to all positions, update the `SIGNAL:` label, and reset the tracking bucket used for statistics (see FR-9).
- FR-2.3: Switching tiers mid-episode is allowed and shall apply on the next simulation tick without requiring a full episode reset (though a manual reset is also available); the equity curve (FR-8) shall reset when the tier changes.

### FR-3: Sandbox / Custom Mode
- FR-3.1: The system shall expose 4 independent toggle controls corresponding to: distance, direction, market-shock velocity, wall proximity.
- FR-3.2: Toggling any signal independently of a preset shall set the configuration label to "Custom" and shall stop contributing to the T0–T5 watchlist table (custom-mode episodes are simulated and visualized normally but excluded from the per-tier aggregate table, or shown in a separate "Custom" row — implementer's choice, but must be documented in-UI).
- FR-3.3: If the manually toggled combination exactly matches one of the 6 presets, the system may (optional) auto-label it with that tier's name.

### FR-4: Observation Vector Readout
- FR-4.1: The system shall display a live, numeric, terminal-styled readout of the observation vector for one "focus" position (default: the surviving position currently nearest to the market shock), using compact labels: `DD:` (drawdown/distance), `DIR:` (direction x,y), `VOL:` (shock velocity), `LIQ:` (distance to nearest wall).
- FR-4.2: Each field in the readout shall show:
  - A live numeric value, updated every frame, if that signal is active at the current configuration.
  - A locked indicator (an em dash `—`) if that signal is not active. Locked and active fields shall be distinguished by more than color alone (e.g. dash vs. number is itself a non-color distinction).
- FR-4.3: Minimum fields: drawdown/distance to shock, direction (dx, dy), shock velocity, distance-to-nearest-wall (per side or nearest single value).
- FR-4.4: The readout shall render in a monospace font inside a dark terminal-styled card, visually distinguishing active vs. locked fields by both text color and the dash/number distinction in FR-4.2.

### FR-5: Feature Online Panel
- FR-5.1: For the currently active tier (or nearest matching preset in custom mode), the system shall display, in a terminal-styled card labeled `FEATURE ONLINE`:
  - The name of the signal added.
  - Its financial/risk-management analog (see mapping table below).
  - One to two sentences explaining the analogy in plain language.
- FR-5.2: The mapping content shall be data-driven (e.g. a config object/array keyed by tier), not hardcoded per-DOM-element, so it is easy to edit later.

**Required mapping content:**

| Tier | Underlying mechanic | Financial analog |
|---|---|---|
| T0 | No signals | No market data at all — a fully blind, randomly acting agent. |
| T1 | Distance to market shock | Knowing only how far into a drawdown you are, with no sense of direction. |
| T2 | Direction to market shock | A trend/momentum signal — knowing which way the market is moving, enabling intentional action. |
| T3 | Market shock's speed | Volatility / rate-of-change awareness — anticipating a sharp move before it fully lands. |
| T4 | Wall/boundary signal | Awareness of liquidity and risk limits (margin, position caps) — avoiding structural traps even when the price risk is dodged. |
| T5 | All signals combined | Full observability — combining price, direction, volatility, and structural constraints for consistent survival. |

### FR-6: Equity Curve
- FR-6.1: The system shall render a live sparkline chart, separate from the main arena canvas, plotting the count of surviving positions against elapsed episode time.
- FR-6.2: The curve shall start each episode at the full spawn count and step down each time a position is eliminated, visually resembling a portfolio value/drawdown chart.
- FR-6.3: The curve shall reset when a new episode starts or when the tier/signal configuration changes (see FR-2.3).
- FR-6.4: The curve shall use a flat, terminal-consistent color (no gradient fill) and a thin baseline/gridline for reference.

### FR-7: Statistics / Watchlist Table
- FR-7.1: The system shall maintain, per tier (T0–T5), running totals of: episodes completed, total positions spawned, total positions survived.
- FR-7.2: The system shall compute and display, per tier: average survival rate (%) = total survived ÷ total spawned.
- FR-7.3: The table shall be styled as a compact watchlist/backtest report (tier, episodes, survival rate columns; monospace, low-contrast header row, hairline row dividers) rather than a plain scoreboard.
- FR-7.4: The table shall update immediately after each episode completes, for every tier, not only the currently selected one.
- FR-7.5: The table shall persist only for the current browser session unless optional persistence (NFR-8) is implemented.
- FR-7.6: A visible reset-statistics control shall be provided, separate from the simulation reset.

### FR-8: Controls
- FR-8.1: Play/Pause control for the simulation loop.
- FR-8.2: Manual "reset episode" control (new random spawn immediately, without waiting for auto-cycle).
- FR-8.3: Manual "reset all statistics" control.
- FR-8.4: (Optional) Speed multiplier control (e.g. 1x/2x) for faster data collection.

---

## 4. Non-Functional Requirements

- NFR-1 (Performance): Simulation shall maintain a visually smooth frame rate (target 60fps) with up to 15 concurrent agents on a mid-range laptop; must not drop below ~30fps.
- NFR-2 (Responsiveness): Layout shall adapt down to a 360px-wide mobile viewport; canvas shall scale proportionally without distortion; controls shall remain reachable and legible on touch devices.
- NFR-3 (Accessibility): Interactive controls (tier buttons, toggles, play/pause) shall be reachable via keyboard and have visible focus states; "active vs. locked" readout fields shall not rely on color alone — the dash-vs-number distinction in FR-4.2 satisfies this, but sufficient contrast must still be maintained against the dark terminal background (WCAG AA minimum for body text).
- NFR-4 (Clarity over cleverness): All copy (labels, headers, table columns) shall use plain, specific language describing what the control does, per the product's educational purpose — no unexplained jargon beyond the intentional terminal-style abbreviations (`DD`, `DIR`, `VOL`, `LIQ`), each of which must be spelled out in the Feature Online panel or a legend.
- NFR-5 (No build-step to view): Final deployed artifact must be servable as static files with no server-side rendering or database required.
- NFR-6 (Portability): No dependency on paid APIs, market-data providers, or accounts; must run fully offline once loaded (except optional CDN font/library loads, which must degrade gracefully if blocked).
- NFR-7 (Maintainability): Tier presets and financial-analogy copy shall live in a single config/data structure, not scattered across the codebase, so future edits (e.g. adding a 7th tier) are localized.
- NFR-8 (Optional persistence): If implemented outside the Claude.ai artifact environment, the watchlist table may optionally persist across page reloads using `localStorage`. This is optional and shall degrade gracefully (reset to zero) if storage is unavailable.
- NFR-9 (Visual consistency): The terminal aesthetic (dark background, monospace type, flat fills, no gradients/glow) shall apply uniformly across the arena, equity curve, readout, feature panel, and watchlist table — no component should look like a different, lighter-themed product bolted on.

---

## 5. External Interface Requirements

### 5.1 User Interface
- Single-page layout: dark terminal container housing, top to bottom, the tier selector row, the arena canvas, a status line (positions live / signal / episode count), the equity curve, a two-column row (Feature Online card + observation-vector readout), and the watchlist table beneath. Stacks vertically on mobile; no separate mobile layout needed since the design is already a single column of stacked cards.
- No modal dialogs required; all controls should be visible or one interaction away.

### 5.5 Visual Design Language ("Risk Terminal" theme)
This section documents the visual direction validated during prototyping and is binding for the production build.

- **Overall metaphor:** a live risk-desk terminal, not a game. Every label should read like something on a trading floor, not a scoreboard.
- **Palette:** near-black backgrounds (arena, cards, chart) with a single muted green as the primary accent (positions, active borders, equity line) and a single muted red as the sole danger accent (market shock). Avoid introducing additional hues; this is intentionally a two-accent-color system plus neutral text tones, not a rainbow of level colors.
- **Typography:** monospace font throughout the terminal container (labels, readout, table, tier buttons) to reinforce the data-feed feel; sentence case for descriptive copy, upper case reserved for short terminal-style tags (`SIGNAL:`, `TIER 0`, `DD:`).
- **Position rendering:** each surviving position is a small `$` glyph rather than a plain dot or fish icon — reinforces "this represents capital," not "this represents a game character."
- **Market shock rendering:** a solid core plus a soft pulsing outer ring in the danger color, suggesting an expanding radius of risk rather than a static enemy sprite.
- **Arena background:** a faint grid (like graph paper / a chart background), not a blank fill — ties the arena visually to the equity curve beneath it.
- **No gradients, drop shadows, or glow effects** other than the single pulsing-radius animation on the market shock, which is functional (communicates "danger zone") rather than decorative.
- **Tier controls:** styled as bordered terminal buttons (`TIER 0`–`TIER 5`), not game-style pill buttons; the active tier is indicated by a brighter border and text color, not a fill change.
- **Feature Online / readout cards:** flat dark cards with a small muted-caps label row (e.g. `FEATURE ONLINE`, `OBSERVATION VECTOR`) above the content, consistent with the rest of the terminal.
- **Watchlist table:** hairline row dividers, muted header row, monospace values — should look like it could be a screenshot from a real backtesting tool.

### 5.2 Hardware Interfaces
None (standard pointer/touch/keyboard only).

### 5.3 Software Interfaces
- Runs in-browser; may use `<canvas>` 2D context or an SVG/DOM-based renderer.
- No external API calls required at runtime for core functionality.

### 5.4 Communication Interfaces
None (fully client-side; no network calls needed after initial page load).

---

## 6. Data Requirements

### 6.1 In-Memory Data Model (indicative, implementation may vary)
```
Position {
  id, x, y, vx, vy, heading, alive: boolean
}

MarketShock {
  x, y, vx, vy, targetId
}

TierConfig {
  id: 0-5,
  signals: { distance: bool, direction: bool, velocity: bool, walls: bool },
  signalLabel: string,
  financialAnalog: { title: string, description: string }
}

TierStats {
  tierId: 0-5,
  episodesCompleted: number,
  totalSpawned: number,
  totalSurvived: number
}

EquityCurvePoint {
  episodeTick: number,
  survivorCount: number
}
```

### 6.2 Data Persistence
None required by default (session-only, in-memory). Optional `localStorage` persistence per NFR-8 if deployed outside Claude.ai.

---

## 7. Acceptance Criteria (Definition of Done)

1. All 6 tiers (T0–T5) are selectable and visibly change position behavior in a way consistent with the table in FR-2.
2. The observation-vector readout accurately reflects locked/unlocked signals for the active configuration in real time, using the `DD/DIR/VOL/LIQ` labels.
3. The Feature Online panel updates correctly for every tier and matches the mapping table in FR-5.
4. The equity curve renders live, resets correctly on episode/tier change, and visually tracks the actual survivor count (FR-6).
5. The watchlist table accumulates and displays correct survival rates per tier across multiple auto-cycled episodes (FR-7).
6. Sandbox mode allows independent toggling of all 4 signals and clearly labels non-preset configurations as "Custom."
7. The entire UI (arena, curve, cards, table, buttons) consistently follows the dark terminal visual language in 5.5 — no component reads as a mismatched, differently-themed piece bolted on.
8. The app runs at an acceptable frame rate with 12+ positions on a typical laptop and remains usable on a 360px-wide mobile screen.
9. The app deploys as a static site with no backend and loads with no console errors on a fresh, cache-cleared load.
10. No real financial data, brokerage functionality, or trading advice is present anywhere in the product — it is explicitly educational/analogical.

---

## 8. Suggested (Non-Binding) Technical Approach for Claude Code
- Plain HTML/CSS/JS with two `<canvas>` elements (arena + equity curve sparkline), or a small React app wrapping the same two canvases — either is compatible with this spec.
- Keep `TIERS` (signal presets + financial copy + signal labels) as one exported config array/object, per NFR-7.
- Keep terminal color/typography values (see 5.5) as CSS custom properties or a shared constants file so the theme is edited in one place.
- Deploy target: any static host (Vercel, Netlify, GitHub Pages, Cloudflare Pages) — no server functions required.

---

## 9. Open Questions for Implementation (flag before/while coding)
- Exact default position count, arena size, and speed constants (starting values suggested in FR-1, tune to taste).
- Whether Custom-mode episodes should be excluded from or added as an extra row in the watchlist table (FR-3.2).
- Whether to add optional persistence (NFR-8) for statistics across sessions once deployed outside Claude.ai.
- Exact hex values for the terminal palette were validated in an in-chat prototype; carry those over directly during implementation rather than re-deriving a new palette (see 5.5 for the described roles: near-black backgrounds, one muted green, one muted red).
