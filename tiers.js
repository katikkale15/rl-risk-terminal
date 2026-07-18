// Single source of truth for all tier configs, signal labels, and financial analogy copy (NFR-7).
export const TIERS = [
  {
    id: 0,
    signals: { distance: false, direction: false, velocity: false, walls: false },
    signalLabel: 'NONE',
    tune: { lookAhead: 0, wallWeight: 0, panicScale: 0, speedMult: 1.0, wallMargin: 60 },
    analog: {
      title: 'NO SIGNAL',
      body: 'No market data at all — a fully blind, randomly acting agent. Survival is pure chance.',
    },
    detail: {
      inputShape: '(0,)',
      vector: [],
      policyLines: [
        'Random heading change every 0.8 – 2.2 s',
        'Constant speed — no modulation',
        'No reaction to the market shock whatsoever',
      ],
      formulaLines: [
        'heading  ~ Uniform(0, 2π)',
        'speed    = BASE_SPEED  (constant)',
        'move     = (cos θ, sin θ) × speed',
      ],
      survivalRange: '~5 – 12%',
      note: 'Survival is purely geometric — a $ glyph only lives if the shock happens to path away from it. Performance does not improve with more episodes.',
    },
  },
  {
    id: 1,
    signals: { distance: true, direction: false, velocity: false, walls: false },
    signalLabel: 'DRAWDOWN',
    tune: { lookAhead: 0, wallWeight: 0, panicScale: 1.5, speedMult: 1.4, wallMargin: 60 },
    analog: {
      title: 'DRAWDOWN',
      body: 'Knowing only how far into a drawdown you are, with no sense of direction. You can panic and accelerate, but you cannot escape intelligently.',
    },
    detail: {
      inputShape: '(1,)',
      vector: ['dd  — scalar distance to shock (px)'],
      policyLines: [
        'Speed scales up as shock closes in (panic)',
        'Heading is still random — no directional escape',
        'Agent knows HOW THREATENED but not WHICH WAY to run',
      ],
      formulaLines: [
        'proximity = max(0,  1 − dd / 260)',
        'speed     = BASE × (1 + 1.5 × proximity)',
        'speed     = min(speed,  BASE × 1.4)',
        'move      = (cos θ_random, sin θ_random) × speed',
      ],
      survivalRange: '~12 – 22%',
      note: 'Faster random movement slightly improves odds by covering more ground, but without direction the gain is marginal — the agent often runs toward the shock.',
    },
  },
  {
    id: 2,
    signals: { distance: true, direction: true, velocity: false, walls: false },
    signalLabel: 'MOMENTUM',
    tune: { lookAhead: 0, wallWeight: 0, panicScale: 1.2, speedMult: 1.3, wallMargin: 60 },
    analog: {
      title: 'MOMENTUM',
      body: 'A trend/momentum signal — knowing which way the market is moving enables intentional evasive action for the first time.',
    },
    detail: {
      inputShape: '(3,)',
      vector: [
        'dd      — scalar distance to shock (px)',
        'dir_x   — normalised flee vector x-component',
        'dir_y   — normalised flee vector y-component',
      ],
      policyLines: [
        'Flee directly away from the shock\'s current position',
        'Speed still panic-scaled on proximity',
        'First tier with genuine directional escape — large survival jump',
      ],
      formulaLines: [
        'flee     = normalise(pos − shock_pos)',
        'proximity = max(0,  1 − dd / 260)',
        'speed    = BASE × (1 + 1.2 × proximity)',
        'move     = flee × speed',
      ],
      survivalRange: '~45 – 62%',
      note: 'Adding direction causes the biggest single survival jump in the ladder. The agent now actively avoids the shock rather than gambling on random movement.',
    },
  },
  {
    id: 3,
    signals: { distance: true, direction: true, velocity: true, walls: false },
    signalLabel: 'VOLATILITY',
    tune: { lookAhead: 0.5, wallWeight: 0, panicScale: 1.2, speedMult: 1.3, wallMargin: 60 },
    analog: {
      title: 'VOLATILITY',
      body: 'Volatility / rate-of-change awareness — anticipate a sharp move before it lands by predicting where the shock will be, not just where it is now.',
    },
    detail: {
      inputShape: '(5,)',
      vector: [
        'dd      — scalar distance to shock (px)',
        'dir_x   — flee vector x  (from current shock pos)',
        'dir_y   — flee vector y  (from current shock pos)',
        'vel_x   — shock velocity x-component (px/s)',
        'vel_y   — shock velocity y-component (px/s)',
      ],
      policyLines: [
        'Predicts shock position 0.5 s into the future',
        'Flees from predicted position, not current one',
        'Anticipates sharp directional changes before impact',
      ],
      formulaLines: [
        'predicted = shock_pos + shock_vel × 0.5',
        'flee      = normalise(pos − predicted)',
        'move      = flee × speed',
      ],
      survivalRange: '~62 – 75%',
      note: 'Lookahead matters most when the shock is accelerating toward the agent. Without it, a rapidly approaching shock can close the gap before the agent reacts.',
    },
  },
  {
    id: 4,
    signals: { distance: true, direction: true, velocity: true, walls: true },
    signalLabel: 'LIQUIDITY',
    tune: { lookAhead: 0.5, wallWeight: 0.30, panicScale: 1.3, speedMult: 1.35, wallMargin: 65 },
    analog: {
      title: 'LIQUIDITY',
      body: 'Awareness of liquidity and risk limits (margin, position caps) — avoiding structural traps even when the directional price risk is initially dodged.',
    },
    detail: {
      inputShape: '(9,)',
      vector: [
        'dd      — scalar distance to shock (px)',
        'dir_x   — flee vector x',
        'dir_y   — flee vector y',
        'vel_x   — shock velocity x',
        'vel_y   — shock velocity y',
        'wall_N  — proximity to north boundary',
        'wall_S  — proximity to south boundary',
        'wall_E  — proximity to east boundary',
        'wall_W  — proximity to west boundary',
      ],
      policyLines: [
        'Blends flee vector with a wall-repulsion vector',
        'Wall force activates within 65 px of each edge',
        'Prevents cornering — the main failure mode at T2/T3',
      ],
      formulaLines: [
        'wall_vec  = weighted sum of per-wall repulsion unit vectors',
        'blend     = normalise(flee × 0.70  +  wall × 0.30)',
        'move      = blend × speed',
      ],
      survivalRange: '~75 – 85%',
      note: 'Without wall awareness, a well-positioned shock can drive an agent into a corner where escape is impossible regardless of reaction time. This tier closes that gap.',
    },
  },
  {
    id: 5,
    signals: { distance: true, direction: true, velocity: true, walls: true },
    signalLabel: 'FULL MODEL',
    tune: { lookAhead: 0.8, wallWeight: 0.45, panicScale: 1.8, speedMult: 1.6, wallMargin: 80 },
    analog: {
      title: 'FULL MODEL',
      body: 'Full observability — combining price direction, volatility anticipation, and structural constraints with tuned parameters for near-total consistent survival.',
    },
    detail: {
      inputShape: '(9,)',
      vector: [
        'dd      — scalar distance to shock (px)',
        'dir_x   — flee vector x',
        'dir_y   — flee vector y',
        'vel_x   — shock velocity x',
        'vel_y   — shock velocity y',
        'wall_N  — proximity to north boundary',
        'wall_S  — proximity to south boundary',
        'wall_E  — proximity to east boundary',
        'wall_W  — proximity to west boundary',
      ],
      policyLines: [
        'Same 9-feature vector as T4 — no new signals added',
        'Lookahead extended to 0.8 s (vs 0.5 s at T4)',
        'Wall weight raised to 0.45 (vs 0.30 at T4)',
        'Panic scale and speed cap both increased',
        'Wall margin widened to 80 px — avoidance starts earlier',
      ],
      formulaLines: [
        'predicted = shock_pos + shock_vel × 0.8     ← longer horizon',
        'blend     = normalise(flee × 0.55  +  wall × 0.45)',
        'speed     = BASE × (1 + 1.8 × proximity)   ← more aggressive',
        'speed     = min(speed, BASE × 1.6)',
      ],
      survivalRange: '~90 – 98%',
      note: 'T4 → T5 uses identical input signals. The survival gain is entirely from tuned hyperparameters — demonstrating that feature engineering alone is insufficient without co-optimisation of the policy weights.',
    },
  },
];

// Fallback tune used when sandbox mode is active (all 4 signals at moderate weights).
export const SANDBOX_TUNE = {
  lookAhead: 0.5, wallWeight: 0.35, panicScale: 1.3, speedMult: 1.35, wallMargin: 65,
};
