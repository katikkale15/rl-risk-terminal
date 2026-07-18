import { Simulation, SPAWN_COUNT } from './sim.js';
import { TIERS } from './tiers.js';

// ─── Canvas sizing: match actual DOM pixel dimensions ──────────────────────
const arenaCanvas  = document.getElementById('arena');
const equityCanvas = document.getElementById('equity-curve');

function sizeCanvas() {
  const aW = arenaCanvas.parentElement.clientWidth;
  const aH = arenaCanvas.parentElement.clientHeight;
  arenaCanvas.width  = aW || 800;
  arenaCanvas.height = aH || 480;

  const eW = equityCanvas.parentElement.clientWidth;
  const eH = equityCanvas.parentElement.clientHeight;
  equityCanvas.width  = eW || 800;
  equityCanvas.height = eH || 80;
}

sizeCanvas();
window.addEventListener('resize', () => {
  sizeCanvas();
  sim.W = arenaCanvas.width;
  sim.H = arenaCanvas.height;
});

const sim = new Simulation(arenaCanvas, equityCanvas);

// ─── Tier buttons ──────────────────────────────────────────────────────────
const tierBtns = document.querySelectorAll('.tier-btn[data-tier]');
const sandboxBtn = document.getElementById('btn-sandbox');

tierBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.tier, 10);
    sim.setTier(id);
    setActiveTierBtn(btn);
    showTierDetail();
    renderDetailPanel(id);
  });
});

sandboxBtn.addEventListener('click', () => {
  tierBtns.forEach(b => b.classList.remove('active'));
  sandboxBtn.classList.add('active');
  showSandboxPanel();
  applySandbox();
});

function setActiveTierBtn(activeBtn) {
  tierBtns.forEach(b => b.classList.remove('active'));
  sandboxBtn.classList.remove('active');
  activeBtn.classList.add('active');
}

function showTierDetail() {
  document.getElementById('tier-detail-content').classList.remove('hidden');
  document.getElementById('sandbox-content').classList.add('hidden');
}

function showSandboxPanel() {
  document.getElementById('tier-detail-content').classList.add('hidden');
  document.getElementById('sandbox-content').classList.remove('hidden');
  document.getElementById('detail-card-label').textContent = 'SANDBOX — MANUAL SIGNAL OVERRIDE';
}

// ─── Sandbox toggles ───────────────────────────────────────────────────────
['distance', 'direction', 'velocity', 'walls'].forEach(key => {
  document.getElementById(`tog-${key}`).addEventListener('change', applySandbox);
});

function applySandbox() {
  const signals = {
    distance:  document.getElementById('tog-distance').checked,
    direction: document.getElementById('tog-direction').checked,
    velocity:  document.getElementById('tog-velocity').checked,
    walls:     document.getElementById('tog-walls').checked,
  };
  sim.setSandboxSignals(signals);

  // If combination matches a preset, auto-label
  const match = TIERS.find(t =>
    t.signals.distance  === signals.distance  &&
    t.signals.direction === signals.direction &&
    t.signals.velocity  === signals.velocity  &&
    t.signals.walls     === signals.walls
  );
  document.getElementById('detail-card-label').textContent = match
    ? `SANDBOX — MATCHES TIER ${match.id} · ${match.signalLabel}`
    : 'SANDBOX — CUSTOM SIGNAL MIX';
}

// ─── Controls ──────────────────────────────────────────────────────────────
document.getElementById('btn-playpause').addEventListener('click', () => {
  const paused = sim.togglePause();
  document.getElementById('btn-playpause').textContent = paused ? 'RESUME' : 'PAUSE';
});

document.getElementById('btn-reset-episode').addEventListener('click', () => sim.resetEpisode());

document.getElementById('btn-reset-stats').addEventListener('click', () => {
  sim.resetStats();
  renderWatchlist(sim.tierStats);
});

// ─── Tier detail panel ─────────────────────────────────────────────────────
function renderDetailPanel(tierId) {
  const { detail, signalLabel } = TIERS[tierId];

  document.getElementById('detail-card-label').textContent =
    `MODEL INPUTS — TIER ${tierId} · ${signalLabel}`;
  document.getElementById('detail-shape').textContent    = detail.inputShape;
  document.getElementById('detail-survival').textContent = detail.survivalRange;
  document.getElementById('detail-note').textContent     = detail.note;

  const vectorEl = document.getElementById('detail-vector');
  vectorEl.innerHTML = detail.vector.length === 0
    ? '<li class="dim-item">— no inputs —</li>'
    : detail.vector.map(v => `<li>${v}</li>`).join('');

  document.getElementById('detail-policy').innerHTML =
    detail.policyLines.map(l => `<li>${l}</li>`).join('');

  document.getElementById('detail-formula').textContent =
    detail.formulaLines.join('\n');
}

// ─── Observation vector readout ────────────────────────────────────────────
function renderObsVector(state) {
  const { focus, shock, signals } = state;

  function set(id, value, active) {
    const el = document.getElementById(id);
    if (active && value !== null) {
      el.textContent = value;
      el.className   = 'obs-val active';
    } else {
      el.textContent = '—';
      el.className   = 'obs-val locked';
    }
  }

  if (!focus || !shock) {
    ['obs-dd', 'obs-dir', 'obs-vol', 'obs-liq'].forEach(id => set(id, null, false));
    return;
  }

  const { pos } = focus;
  const dist = Math.hypot(pos.x - shock.x, pos.y - shock.y);

  set('obs-dd', dist.toFixed(1), signals.distance);

  if (signals.direction) {
    const dx = (shock.x - pos.x) / dist;
    const dy = (shock.y - pos.y) / dist;
    set('obs-dir', `${dx.toFixed(2)}, ${dy.toFixed(2)}`, true);
  } else {
    set('obs-dir', null, false);
  }

  set('obs-vol',
    signals.velocity ? Math.hypot(shock.vx, shock.vy).toFixed(1) : null,
    signals.velocity
  );

  if (signals.walls) {
    const wallDist = Math.min(pos.x, arenaCanvas.width - pos.x, pos.y, arenaCanvas.height - pos.y);
    set('obs-liq', wallDist.toFixed(1), true);
  } else {
    set('obs-liq', null, false);
  }
}

// ─── Status bar ────────────────────────────────────────────────────────────
function renderStatusBar(state) {
  const label = state.sandboxSignals ? 'CUSTOM' : TIERS[state.tierId].signalLabel;
  document.getElementById('live-count').textContent    = `LIVE: ${state.aliveCount}`;
  document.getElementById('signal-label').textContent  = `SIGNAL: ${label}`;
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
    tr.innerHTML = `<td>T${stat.id}</td><td>${tier.signalLabel}</td><td>${stat.episodes}</td><td class="rate-cell">${rate}</td>`;
    tbody.appendChild(tr);
  }
}

// ─── Sim callbacks ─────────────────────────────────────────────────────────
sim.onTick       = state      => { renderStatusBar(state); renderObsVector(state); };
sim.onEpisodeEnd = tierStats  => renderWatchlist(tierStats);

// ─── Init ──────────────────────────────────────────────────────────────────
renderDetailPanel(0);
renderWatchlist(sim.tierStats);
sim.start();
