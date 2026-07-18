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
  },
];

// Fallback tune used when sandbox mode is active (all 4 signals at moderate weights).
export const SANDBOX_TUNE = {
  lookAhead: 0.5, wallWeight: 0.35, panicScale: 1.3, speedMult: 1.35, wallMargin: 65,
};
