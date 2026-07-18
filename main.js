import { Simulation, SPAWN_COUNT } from './sim.js';
import { TIERS } from './tiers.js';

// ─── Canvas setup ──────────────────────────────────────────────────────────
const arenaCanvas  = document.getElementById('arena');
const equityCanvas = document.getElementById('equity-curve');
arenaCanvas.width  = 800;
arenaCanvas.height = 480;
equityCanvas.width = 800;
equityCanvas.height = 100;

const sim = new Simulation(arenaCanvas, equityCanvas);

// ─── Tier buttons ──────────────────────────────────────────────────────────
const tierBtns    = document.querySelectorAll('.tier-btn[data-tier]');
const sandboxBtn  = document.getElementById('btn-sandbox');
const sandboxPanel = document.getElementById('sandbox-panel');

tierBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.tier, 10);
    sim.setTier(id);
    setActiveTierBtn(btn);
    sandboxPanel.classList.add('hidden');
    renderFeatureCard(id, null);
  });
});

sandboxBtn.addEventListener('click', () => {
  tierBtns.forEach(b => b.classList.remove('active'));
  sandboxBtn.classList.add('active');
  sandboxPanel.classList.remove('hidden');
  applysandbox();
});

function setActiveTierBtn(activeBtn) {
  tierBtns.forEach(b => b.classList.remove('active'));
  sandboxBtn.classList.remove('active');
  activeBtn.classList.add('active');
}

// ─── Sandbox toggles ───────────────────────────────────────────────────────
['distance', 'direction', 'velocity', 'walls'].forEach(key => {
  document.getElementById(`tog-${key}`).addEventListener('change', applysandbox);
});

function applysandbox() {
  const signals = {
    distance:  document.getElementById('tog-distance').checked,
    direction: document.getElementById('tog-direction').checked,
    velocity:  document.getElementById('tog-velocity').checked,
    walls:     document.getElementById('tog-walls').checked,
  };
  sim.setSandboxSignals(signals);

  // Auto-label if it matches a preset
  const match = TIERS.find(t =>
    t.signals.distance  === signals.distance  &&
    t.signals.direction === signals.direction &&
    t.signals.velocity  === signals.velocity  &&
    t.signals.walls     === signals.walls
  );
  renderFeatureCard(match ? match.id : null, match ? null : signals);
}

// ─── Playback controls ─────────────────────────────────────────────────────
document.getElementById('btn-playpause').addEventListener('click', () => {
  const paused = sim.togglePause();
  document.getElementById('btn-playpause').textContent = paused ? 'RESUME' : 'PAUSE';
});

document.getElementById('btn-reset-episode').addEventListener('click', () => {
  sim.resetEpisode();
});

document.getElementById('btn-reset-stats').addEventListener('click', () => {
  sim.resetStats();
  renderWatchlist(sim.tierStats);
});

// ─── Feature Online card ───────────────────────────────────────────────────
function renderFeatureCard(tierId, customSignals) {
  const titleEl = document.getElementById('feature-signal');
  const bodyEl  = document.getElementById('feature-body');

  if (tierId !== null) {
    const tier     = TIERS[tierId];
    titleEl.textContent = tier.signalLabel;
    bodyEl.textContent  = tier.analog.body;
  } else {
    const active = Object.entries(customSignals)
      .filter(([, v]) => v)
      .map(([k]) => k.toUpperCase());
    titleEl.textContent = 'CUSTOM';
    bodyEl.textContent  = active.length > 0
      ? `Custom signal mix: ${active.join(' + ')}. Episodes in this mode are not counted in the backtest table.`
      : 'No signals active — equivalent to TIER 0 (blind random walk). Not counted in the backtest table.';
  }
}

// ─── Observation vector readout ────────────────────────────────────────────
function renderObsVector(state) {
  const { focus, shock, signals } = state;

  function setField(id, value, active) {
    const el = document.getElementById(id);
    if (active && value !== null) {
      el.textContent = value;
      el.className   = 'obs-val active';
    } else {
      el.textContent = '—'; // em dash
      el.className   = 'obs-val locked';
    }
  }

  if (!focus || !shock) {
    ['obs-dd', 'obs-dir', 'obs-vol', 'obs-liq'].forEach(id => setField(id, null, false));
    return;
  }

  const { pos } = focus;
  const dist = Math.hypot(pos.x - shock.x, pos.y - shock.y);

  setField('obs-dd',  dist.toFixed(1), signals.distance);

  if (signals.direction) {
    const dx = (shock.x - pos.x) / dist;
    const dy = (shock.y - pos.y) / dist;
    setField('obs-dir', `${dx.toFixed(2)}, ${dy.toFixed(2)}`, true);
  } else {
    setField('obs-dir', null, false);
  }

  setField('obs-vol',
    signals.velocity ? Math.hypot(shock.vx, shock.vy).toFixed(1) : null,
    signals.velocity
  );

  if (signals.walls) {
    const wallDist = Math.min(pos.x, arenaCanvas.width - pos.x, pos.y, arenaCanvas.height - pos.y);
    setField('obs-liq', wallDist.toFixed(1), true);
  } else {
    setField('obs-liq', null, false);
  }
}

// ─── Status bar ────────────────────────────────────────────────────────────
function renderStatusBar(state) {
  const signalLabel = state.sandboxSignals ? 'CUSTOM' : TIERS[state.tierId].signalLabel;
  document.getElementById('live-count').textContent    = `LIVE: ${state.aliveCount}`;
  document.getElementById('signal-label').textContent  = `SIGNAL: ${signalLabel}`;
  document.getElementById('episode-count').textContent = `EPISODE: ${state.episodeCount}`;
  document.getElementById('elapsed-time').textContent  = `TIME: ${state.episodeTime.toFixed(1)}s`;
}

// ─── Watchlist table ───────────────────────────────────────────────────────
function renderWatchlist(tierStats) {
  const tbody = document.getElementById('watchlist-body');
  tbody.innerHTML = '';

  for (const stat of tierStats) {
    const tier = TIERS[stat.id];
    const rate = stat.spawned > 0
      ? ((stat.survived / stat.spawned) * 100).toFixed(1) + '%'
      : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>T${stat.id}</td>
      <td>${tier.signalLabel}</td>
      <td>${stat.episodes}</td>
      <td class="rate-cell">${rate}</td>
    `;
    tbody.appendChild(tr);
  }
}

// ─── Sim callbacks ─────────────────────────────────────────────────────────
sim.onTick = state => {
  renderStatusBar(state);
  renderObsVector(state);
};

sim.onEpisodeEnd = tierStats => {
  renderWatchlist(tierStats);
};

// ─── Init ──────────────────────────────────────────────────────────────────
renderFeatureCard(0, null);
renderWatchlist(sim.tierStats);
sim.start();
