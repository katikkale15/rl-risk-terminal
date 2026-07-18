import { TIERS, SANDBOX_TUNE } from './tiers.js';

export const SPAWN_COUNT   = 12;
const BASE_SPEED           = 85;   // px/s for positions
const SHOCK_SPEED_MULT     = 1.08; // shock is 8% faster than base
const ELIM_RADIUS          = 16;   // px — elimination contact distance
const EPISODE_DURATION     = 15;   // seconds
const HEADING_MIN          = 0.8;  // seconds before a T0/T1 position changes heading
const HEADING_MAX          = 2.2;
const RESPAWN_DELAY        = 1.5;  // seconds between episode end and next spawn
const GRID_SIZE            = 40;   // px — arena background grid

// ─── Colours (kept here so renderer is self-contained) ─────────────────────
const C = {
  bg:        '#080b08',
  grid:      '#101810',
  border:    '#1a2e1a',
  pos:       '#22c55e',
  posDying:  '#ef4444',
  shock:     '#ef4444',
  shockCore: '#fca5a5',
  equityLine:'#22c55e',
  equityGrid:'#111b11',
  axisText:  '#374a37',
  curveLabel:'#2d3f2d',
};

export class Simulation {
  constructor(arenaCanvas, equityCanvas) {
    this.arena  = arenaCanvas;
    this.ctx    = arenaCanvas.getContext('2d');
    this.eq     = equityCanvas;
    this.eqCtx  = equityCanvas.getContext('2d');

    this.W = arenaCanvas.width;
    this.H = arenaCanvas.height;

    this.tierId        = 0;
    this.sandboxSignals = null; // null → use tier preset
    this.paused        = false;
    this.episodeCount  = 0;
    this.lastTime      = null;
    this.respawnTimer  = null;
    this._pulseT       = 0;

    this.positions   = [];
    this.shock       = null;
    this.episodeTime = 0;
    this.equityCurve = []; // [{t, count}]

    this.tierStats = TIERS.map(t => ({
      id: t.id, episodes: 0, spawned: 0, survived: 0,
    }));

    // Callbacks wired by main.js
    this.onTick        = null;
    this.onEpisodeEnd  = null;
    this.onElimination = null;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  start() {
    this._startEpisode();
    requestAnimationFrame(t => this._loop(t));
  }

  setTier(id) {
    this.tierId         = id;
    this.sandboxSignals = null;
    this._resetCurve();
  }

  setSandboxSignals(signals) {
    this.sandboxSignals = { ...signals };
    this._resetCurve();
  }

  togglePause() {
    this.paused = !this.paused;
    if (!this.paused) this.lastTime = performance.now();
    return this.paused;
  }

  resetEpisode() {
    this.respawnTimer = null;
    this._startEpisode();
  }

  resetStats() {
    this.tierStats = TIERS.map(t => ({ id: t.id, episodes: 0, spawned: 0, survived: 0 }));
    if (this.onEpisodeEnd) this.onEpisodeEnd(this.tierStats);
  }

  get currentSignals() {
    return this.sandboxSignals ?? TIERS[this.tierId].signals;
  }

  get currentTune() {
    return this.sandboxSignals ? SANDBOX_TUNE : TIERS[this.tierId].tune;
  }

  getState() {
    const alive = this.positions.filter(p => p.alive);
    return {
      aliveCount:     alive.length,
      episodeCount:   this.episodeCount,
      episodeTime:    this.episodeTime,
      tierId:         this.tierId,
      sandboxSignals: this.sandboxSignals,
      tierStats:      this.tierStats,
      focus:          this._getFocusPosition(),
      shock:          this.shock,
      signals:        this.currentSignals,
    };
  }

  // ─── Episode lifecycle ────────────────────────────────────────────────────

  _startEpisode() {
    this.episodeTime = 0;
    this.equityCurve = [{ t: 0, count: SPAWN_COUNT }];
    this.episodeCount++;
    this._spawnPositions();
    this._spawnShock();
  }

  _spawnPositions() {
    this.positions = [];
    const margin = 50;
    let attempts = 0;
    while (this.positions.length < SPAWN_COUNT && attempts < 2000) {
      attempts++;
      const x = margin + Math.random() * (this.W - margin * 2);
      const y = margin + Math.random() * (this.H - margin * 2);
      if (!this.positions.some(p => Math.hypot(p.x - x, p.y - y) < 35)) {
        this.positions.push({
          id:           this.positions.length,
          x, y,
          vx: 0, vy: 0,
          heading:      Math.random() * Math.PI * 2,
          headingTimer: Math.random() * HEADING_MAX,
          alive:        true,
          dying:        false,
          fadeAlpha:    1.0,
        });
      }
    }
  }

  _spawnShock() {
    // Spawn on a random edge so there is initial distance from positions.
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if      (side === 0) { x = Math.random() * this.W; y = 10; }
    else if (side === 1) { x = this.W - 10;            y = Math.random() * this.H; }
    else if (side === 2) { x = Math.random() * this.W; y = this.H - 10; }
    else                 { x = 10;                     y = Math.random() * this.H; }
    this.shock = { x, y, vx: 0, vy: 0 };
  }

  _resetCurve() {
    const count = this.positions.filter(p => p.alive).length;
    this.equityCurve = [{ t: this.episodeTime, count }];
  }

  // ─── Main loop ───────────────────────────────────────────────────────────

  _loop(now) {
    requestAnimationFrame(t => this._loop(t));

    if (this.lastTime === null) { this.lastTime = now; return; }
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this._pulseT += dt;

    if (!this.paused) {
      if (this.respawnTimer !== null) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) {
          this.respawnTimer = null;
          this._startEpisode();
        }
        // Still advance dying fades during respawn pause
        for (const p of this.positions) {
          if (p.dying) p.fadeAlpha = Math.max(0, p.fadeAlpha - dt * 2.5);
        }
      } else {
        this._tick(dt);
      }
    }

    this._render();
    if (this.onTick) this.onTick(this.getState());
  }

  // ─── Simulation tick ─────────────────────────────────────────────────────

  _tick(dt) {
    this.episodeTime += dt;
    const signals = this.currentSignals;
    const tune    = this.currentTune;

    for (const pos of this.positions) {
      if (!pos.alive) {
        if (pos.dying) pos.fadeAlpha = Math.max(0, pos.fadeAlpha - dt * 2.5);
        continue;
      }
      this._updatePosition(pos, signals, tune, dt);
    }

    this._updateShock(dt);
    this._checkEliminations();

    const aliveCount = this.positions.filter(p => p.alive).length;
    if (aliveCount === 0 || this.episodeTime >= EPISODE_DURATION) {
      this._endEpisode();
    }
  }

  _updatePosition(pos, signals, tune, dt) {
    const shock = this.shock;
    const sdx   = shock.x - pos.x;
    const sdy   = shock.y - pos.y;
    const dist  = Math.hypot(sdx, sdy) || 1;

    // Random heading timer (governs T0/T1 wandering; also used as a fallback)
    pos.headingTimer -= dt;
    if (pos.headingTimer <= 0) {
      pos.heading      = Math.random() * Math.PI * 2;
      pos.headingTimer = HEADING_MIN + Math.random() * (HEADING_MAX - HEADING_MIN);
    }

    // Speed: base + panic boost when distance signal is available
    let speed = BASE_SPEED;
    if (signals.distance) {
      const reactDist  = 260;
      const proximity  = Math.max(0, 1 - dist / reactDist);
      speed = Math.min(BASE_SPEED * (1 + tune.panicScale * proximity), BASE_SPEED * tune.speedMult);
    }

    // Movement direction
    let moveX, moveY;
    if (signals.direction) {
      // Predict shock location if velocity signal is available
      let targetX = shock.x, targetY = shock.y;
      if (signals.velocity && tune.lookAhead > 0) {
        targetX += shock.vx * tune.lookAhead;
        targetY += shock.vy * tune.lookAhead;
      }

      // Flee vector (away from predicted target)
      const fdx  = pos.x - targetX;
      const fdy  = pos.y - targetY;
      const flen = Math.hypot(fdx, fdy) || 1;
      let fleeX  = fdx / flen;
      let fleeY  = fdy / flen;

      // Wall avoidance blend (T4+)
      if (signals.walls) {
        const m = tune.wallMargin;
        let wX = 0, wY = 0;
        if (pos.x < m)          wX += (m - pos.x) / m;
        if (pos.x > this.W - m) wX -= (pos.x - (this.W - m)) / m;
        if (pos.y < m)          wY += (m - pos.y) / m;
        if (pos.y > this.H - m) wY -= (pos.y - (this.H - m)) / m;

        const wLen = Math.hypot(wX, wY);
        if (wLen > 0.001) {
          wX /= wLen; wY /= wLen;
          const w  = tune.wallWeight;
          fleeX    = fleeX * (1 - w) + wX * w;
          fleeY    = fleeY * (1 - w) + wY * w;
          const bLen = Math.hypot(fleeX, fleeY) || 1;
          fleeX  /= bLen; fleeY  /= bLen;
        }
      }

      moveX = fleeX;
      moveY = fleeY;
    } else {
      // T0 / T1: random walk
      moveX = Math.cos(pos.heading);
      moveY = Math.sin(pos.heading);
    }

    pos.vx  = moveX * speed;
    pos.vy  = moveY * speed;
    pos.x  += pos.vx * dt;
    pos.y  += pos.vy * dt;

    // Hard-bounce off arena walls
    const r = 9;
    if (pos.x < r)          { pos.x = r;          pos.vx =  Math.abs(pos.vx); pos.heading = Math.atan2(pos.vy,  Math.abs(pos.vx)); }
    if (pos.x > this.W - r) { pos.x = this.W - r; pos.vx = -Math.abs(pos.vx); pos.heading = Math.atan2(pos.vy, -Math.abs(pos.vx)); }
    if (pos.y < r)          { pos.y = r;           pos.vy =  Math.abs(pos.vy); pos.heading = Math.atan2( Math.abs(pos.vy), pos.vx); }
    if (pos.y > this.H - r) { pos.y = this.H - r;  pos.vy = -Math.abs(pos.vy); pos.heading = Math.atan2(-Math.abs(pos.vy), pos.vx); }
  }

  _updateShock(dt) {
    const alive = this.positions.filter(p => p.alive);
    if (alive.length === 0) return;

    let nearest = null, minD = Infinity;
    for (const p of alive) {
      const d = Math.hypot(p.x - this.shock.x, p.y - this.shock.y);
      if (d < minD) { minD = d; nearest = p; }
    }

    const dx  = nearest.x - this.shock.x;
    const dy  = nearest.y - this.shock.y;
    const len = Math.hypot(dx, dy) || 1;
    const spd = BASE_SPEED * SHOCK_SPEED_MULT;

    this.shock.vx  = (dx / len) * spd;
    this.shock.vy  = (dy / len) * spd;
    this.shock.x  += this.shock.vx * dt;
    this.shock.y  += this.shock.vy * dt;
  }

  _checkEliminations() {
    let anyElim = false;
    for (const pos of this.positions) {
      if (!pos.alive || pos.dying) continue;
      if (Math.hypot(pos.x - this.shock.x, pos.y - this.shock.y) < ELIM_RADIUS) {
        pos.alive = false;
        pos.dying = true;
        pos.fadeAlpha = 1.0;
        anyElim = true;
        if (this.onElimination) this.onElimination(pos);
      }
    }
    if (anyElim) {
      const count = this.positions.filter(p => p.alive).length;
      this.equityCurve.push({ t: this.episodeTime, count });
    }
  }

  _endEpisode() {
    const survived = this.positions.filter(p => p.alive).length;

    if (!this.sandboxSignals) {
      const s       = this.tierStats[this.tierId];
      s.episodes   += 1;
      s.spawned    += SPAWN_COUNT;
      s.survived   += survived;
    }

    if (this.onEpisodeEnd) this.onEpisodeEnd(this.tierStats);
    this.respawnTimer = RESPAWN_DELAY;
  }

  _getFocusPosition() {
    if (!this.shock) return null;
    const alive = this.positions.filter(p => p.alive);
    if (alive.length === 0) return null;
    let nearest = null, minD = Infinity;
    for (const p of alive) {
      const d = Math.hypot(p.x - this.shock.x, p.y - this.shock.y);
      if (d < minD) { minD = d; nearest = p; }
    }
    return { pos: nearest, dist: minD };
  }

  // ─── Rendering ───────────────────────────────────────────────────────────

  _render() {
    this._renderArena();
    this._renderEquityCurve();
  }

  _renderArena() {
    const { ctx, W, H } = this;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Border
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

    // Positions
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const pos of this.positions) {
      if (pos.dying && pos.fadeAlpha <= 0) continue;
      ctx.globalAlpha = pos.alive ? 1 : pos.fadeAlpha;
      ctx.fillStyle   = pos.alive ? C.pos : C.posDying;
      ctx.fillText('$', pos.x, pos.y);
    }
    ctx.globalAlpha = 1;

    // Market shock
    if (this.shock) {
      const pulse  = 0.5 + 0.5 * Math.sin(this._pulseT * 3.5);
      const outerR = 20 + pulse * 9;

      // Outer expanding ring
      ctx.strokeStyle = `rgba(239,68,68,${(0.25 + pulse * 0.35).toFixed(2)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.shock.x, this.shock.y, outerR, 0, Math.PI * 2);
      ctx.stroke();

      // Second ring (wider)
      ctx.strokeStyle = `rgba(239,68,68,${(0.10 + pulse * 0.15).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(this.shock.x, this.shock.y, outerR * 1.5, 0, Math.PI * 2);
      ctx.stroke();

      // Solid core
      ctx.fillStyle = C.shock;
      ctx.beginPath();
      ctx.arc(this.shock.x, this.shock.y, 9, 0, Math.PI * 2);
      ctx.fill();

      // Bright inner core
      ctx.fillStyle = C.shockCore;
      ctx.beginPath();
      ctx.arc(this.shock.x, this.shock.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderEquityCurve() {
    const ctx = this.eqCtx;
    const W   = this.eq.width;
    const H   = this.eq.height;
    const pad = { top: 8, right: 12, bottom: 18, left: 32 };
    const pW  = W - pad.left - pad.right;
    const pH  = H - pad.top - pad.bottom;

    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Horizontal reference lines
    ctx.strokeStyle = C.equityGrid;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (pH * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pW, y); ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = C.axisText;
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(SPAWN_COUNT,       pad.left - 4, pad.top + 5);
    ctx.fillText(SPAWN_COUNT >> 1,  pad.left - 4, pad.top + pH / 2 + 4);
    ctx.fillText('0',               pad.left - 4, pad.top + pH + 4);

    // Equity step function
    if (this.equityCurve.length >= 1) {
      const tMax = EPISODE_DURATION;
      const toX  = t => pad.left + (t / tMax) * pW;
      const toY  = c => pad.top  + pH - (c / SPAWN_COUNT) * pH;

      ctx.strokeStyle = C.equityLine;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (let i = 0; i < this.equityCurve.length; i++) {
        const pt = this.equityCurve[i];
        if (i === 0) {
          ctx.moveTo(toX(pt.t), toY(pt.count));
        } else {
          const prev = this.equityCurve[i - 1];
          ctx.lineTo(toX(pt.t), toY(prev.count)); // horizontal
          ctx.lineTo(toX(pt.t), toY(pt.count));   // vertical drop
        }
      }

      // Extend to current elapsed time
      const last = this.equityCurve[this.equityCurve.length - 1];
      ctx.lineTo(toX(Math.min(this.episodeTime, tMax)), toY(last.count));
      ctx.stroke();
    }

    // Baseline
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top + pH);
    ctx.lineTo(pad.left + pW, pad.top + pH);
    ctx.stroke();

    // Label
    ctx.fillStyle = C.curveLabel;
    ctx.font = '9px "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('EQUITY CURVE  —  SURVIVING POSITIONS / TIME', pad.left, H - 4);
    ctx.textAlign = 'left';
  }
}
