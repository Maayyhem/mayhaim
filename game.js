// ==================== VAL AIM TRAINER ====================
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

// ---- State ----
const state = {
  mode: 'flick',
  difficulty: 'medium',
  duration: 60,
  crosshair: 'cross',
  soundOn: true,
  // In-game
  running: false,
  score: 0,
  hits: 0,
  misses: 0,
  combo: 0,
  bestCombo: 0,
  timeLeft: 60,
  targets: [],
  reactionTimes: [],
  scoreHistory: [],
  lastTargetTime: 0,
  timerInterval: null,
  trackingScore: 0,
  trackingFrames: 0,
  trackingOnTarget: 0,
};

// Difficulty settings
const DIFF = {
  easy:    { targetSize: [50, 70], spawnRate: 1200, targetLife: 2500, speed: 1.5, multiCount: 2 },
  medium:  { targetSize: [35, 55], spawnRate: 900,  targetLife: 1800, speed: 2.5, multiCount: 3 },
  hard:    { targetSize: [22, 40], spawnRate: 650,  targetLife: 1200, speed: 4,   multiCount: 4 },
  extreme: { targetSize: [14, 28], spawnRate: 450,  targetLife: 800,  speed: 6,   multiCount: 5 },
};

const RANKS = [
  { min: 0,    label: 'Iron 1',       color: '#7c8389' },
  { min: 500,  label: 'Iron 3',       color: '#7c8389' },
  { min: 1000, label: 'Bronze 1',     color: '#b97450' },
  { min: 1800, label: 'Bronze 3',     color: '#b97450' },
  { min: 2800, label: 'Silver 1',     color: '#c0c0c0' },
  { min: 4000, label: 'Silver 3',     color: '#c0c0c0' },
  { min: 5500, label: 'Gold 1',       color: '#e8c56d' },
  { min: 7000, label: 'Gold 3',       color: '#e8c56d' },
  { min: 9000, label: 'Platinum 1',   color: '#59c5c7' },
  { min: 11000,label: 'Platinum 3',   color: '#59c5c7' },
  { min: 14000,label: 'Diamond 1',    color: '#d882f5' },
  { min: 17000,label: 'Diamond 3',    color: '#d882f5' },
  { min: 21000,label: 'Ascendant 1',  color: '#2dbe73' },
  { min: 26000,label: 'Ascendant 3',  color: '#2dbe73' },
  { min: 32000,label: 'Immortal 1',   color: '#ff4655' },
  { min: 40000,label: 'Immortal 3',   color: '#ff4655' },
  { min: 50000,label: 'Radiant',      color: '#ffffaa' },
];

// ---- Persistence ----
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem('valAimStats')) || { bestScore: 0, totalAcc: 0, games: 0 };
  } catch { return { bestScore: 0, totalAcc: 0, games: 0 }; }
}
function saveStats(score, accuracy) {
  const s = loadStats();
  s.bestScore = Math.max(s.bestScore, score);
  s.totalAcc = ((s.totalAcc * s.games) + accuracy) / (s.games + 1);
  s.games++;
  localStorage.setItem('valAimStats', JSON.stringify(s));
  updateMenuStats();
}
function updateMenuStats() {
  const s = loadStats();
  $('#menu-best-score').textContent = s.bestScore.toLocaleString();
  $('#menu-avg-acc').textContent = Math.round(s.totalAcc) + '%';
  $('#menu-games').textContent = s.games;
}

// ---- Screens ----
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

// ---- Crosshair ----
function updateCrosshair(e) {
  const ch = $('#crosshair');
  ch.style.left = e.clientX + 'px';
  ch.style.top = e.clientY + 'px';
}
document.addEventListener('mousemove', updateCrosshair);

function setCrosshairStyle(type) {
  const ch = $('#crosshair');
  ch.className = type;
}

// ---- Target Helpers ----
function getArea() {
  const area = $('#game-area');
  return { w: area.clientWidth, h: area.clientHeight, el: area };
}

function randBetween(a, b) { return a + Math.random() * (b - a); }

function getTargetSize() {
  const d = DIFF[state.difficulty];
  if (state.mode === 'micro') {
    return randBetween(d.targetSize[0] * 0.5, d.targetSize[1] * 0.6);
  }
  if (state.mode === 'headshot') {
    return randBetween(d.targetSize[0] * 1.4, d.targetSize[1] * 1.6);
  }
  return randBetween(d.targetSize[0], d.targetSize[1]);
}

function createTargetEl(x, y, size, type = 'flick') {
  const el = document.createElement('div');
  el.classList.add('target', `target-${type}`);
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.left = (x - size / 2) + 'px';
  el.style.top = (y - size / 2) + 'px';

  if (type === 'head') {
    const head = document.createElement('div');
    head.classList.add('head-hitbox');
    const body = document.createElement('div');
    body.classList.add('body-hitbox');
    el.appendChild(head);
    el.appendChild(body);
  }

  return el;
}

function spawnTarget() {
  if (!state.running) return;
  const { w, h, el: area } = getArea();
  const size = getTargetSize();
  const margin = size;
  const x = randBetween(margin, w - margin);
  const y = randBetween(margin, h - margin);

  let type = 'flick';
  if (state.mode === 'headshot') type = 'head';
  else if (state.mode === 'tracking') type = 'tracking';
  else if (state.mode === 'gridshot') type = 'grid';
  else if (state.mode === 'micro') type = 'flick';
  else if (state.mode === 'speed') type = 'flick';

  const el = createTargetEl(x, y, size, type);
  area.appendChild(el);

  const target = {
    el, x, y, size, type, spawnTime: Date.now(),
    vx: 0, vy: 0, alive: true,
  };

  if (state.mode === 'tracking') {
    const angle = Math.random() * Math.PI * 2;
    const spd = DIFF[state.difficulty].speed;
    target.vx = Math.cos(angle) * spd;
    target.vy = Math.sin(angle) * spd;
  }

  state.targets.push(target);

  // Auto-remove after lifetime (except tracking)
  if (state.mode !== 'tracking') {
    const life = DIFF[state.difficulty].targetLife;
    target.timeout = setTimeout(() => {
      if (target.alive) {
        removeTarget(target, false);
      }
    }, life);
  }
}

function spawnGridTargets() {
  if (!state.running) return;
  const { w, h, el: area } = getArea();
  const size = getTargetSize();
  const cols = 5;
  const rows = 3;
  const spacingX = (w - size * 2) / (cols + 1);
  const spacingY = (h - size * 2) / (rows + 1);

  // Clear existing
  state.targets.forEach(t => { if (t.alive) { t.el.remove(); t.alive = false; } });
  state.targets = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = size + spacingX * (c + 1);
      const y = size + spacingY * (r + 1);
      // Add some randomness
      const rx = x + randBetween(-spacingX * 0.2, spacingX * 0.2);
      const ry = y + randBetween(-spacingY * 0.2, spacingY * 0.2);

      const el = createTargetEl(rx, ry, size, 'grid');
      area.appendChild(el);
      state.targets.push({
        el, x: rx, y: ry, size, type: 'grid',
        spawnTime: Date.now(), alive: true, vx: 0, vy: 0,
      });
    }
  }
}

function spawnMultiTargets() {
  if (!state.running) return;
  const count = DIFF[state.difficulty].multiCount;
  for (let i = 0; i < count; i++) {
    spawnTarget();
  }
}

function removeTarget(target, hit) {
  if (!target.alive) return;
  target.alive = false;
  if (target.timeout) clearTimeout(target.timeout);

  const { el } = target;
  const area = $('#game-area');
  const rect = el.getBoundingClientRect();
  const areaRect = area.getBoundingClientRect();
  const cx = rect.left - areaRect.left + rect.width / 2;
  const cy = rect.top - areaRect.top + rect.height / 2;

  if (hit) {
    // Hit marker
    const marker = document.createElement('div');
    marker.classList.add('hit-marker');
    marker.style.left = cx + 'px';
    marker.style.top = cy + 'px';
    area.appendChild(marker);
    setTimeout(() => marker.remove(), 300);

    // Score popup
    const reactionTime = Date.now() - target.spawnTime;
    state.reactionTimes.push(reactionTime);
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);

    const comboMultiplier = Math.min(1 + state.combo * 0.1, 3);
    let points = Math.round(100 * comboMultiplier);

    // Bonus for headshot mode
    if (target.type === 'head') points = Math.round(points * 1.5);
    // Bonus for speed
    if (reactionTime < 300) points = Math.round(points * 1.3);

    state.score += points;
    state.hits++;

    const popup = document.createElement('div');
    popup.classList.add('score-popup');
    popup.textContent = '+' + points;
    if (state.combo >= 5) popup.textContent += ' x' + state.combo;
    popup.style.left = cx + 'px';
    popup.style.top = (cy - 10) + 'px';
    area.appendChild(popup);
    setTimeout(() => popup.remove(), 800);

    if (state.combo > 0 && state.combo % 5 === 0) {
      audioEngine.play('combo');
    } else if (target.type === 'head') {
      audioEngine.play('headshot');
    } else {
      audioEngine.play('hit');
    }
  } else {
    state.combo = 0;
    state.misses++;
    audioEngine.play('miss');
  }

  el.style.transition = 'transform 0.1s, opacity 0.1s';
  el.style.transform = hit ? 'scale(1.3)' : 'scale(0.5)';
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 100);

  updateHUD();

  // Respawn logic
  if (state.running && state.mode !== 'tracking') {
    if (state.mode === 'gridshot') {
      // Check if all grid targets gone
      const alive = state.targets.filter(t => t.alive).length;
      if (alive <= 2) {
        setTimeout(() => spawnGridTargets(), 200);
      }
    } else if (state.mode === 'speed') {
      if (state.targets.filter(t => t.alive).length < 2) {
        spawnMultiTargets();
      }
    }
  }
}

// ---- Click handler ----
function handleGameClick(e) {
  if (!state.running) return;
  const area = $('#game-area');
  const areaRect = area.getBoundingClientRect();
  const mx = e.clientX - areaRect.left;
  const my = e.clientY - areaRect.top;

  let hitAny = false;

  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    if (!t.alive) continue;

    const rect = t.el.getBoundingClientRect();
    const tx = rect.left - areaRect.left;
    const ty = rect.top - areaRect.top;
    const tw = rect.width;
    const th = rect.height;

    if (t.type === 'head') {
      // Only headshot counts - top 35% is the head
      const headY = ty;
      const headH = th * 0.35;
      const headCx = tx + tw / 2;
      const headCy = headY + headH / 2;
      const headR = Math.min(tw, headH) / 2;
      const dist = Math.hypot(mx - headCx, my - headCy);

      if (dist <= headR * 1.2) {
        removeTarget(t, true);
        hitAny = true;
        break;
      }
      // Body hit = miss (but still counts as hitting something)
      if (mx >= tx && mx <= tx + tw && my >= ty && my <= ty + th) {
        // Body shot - no points, show feedback
        const popup = document.createElement('div');
        popup.classList.add('score-popup');
        popup.textContent = 'BODY';
        popup.style.color = '#ff4655';
        popup.style.left = mx + 'px';
        popup.style.top = my + 'px';
        area.appendChild(popup);
        setTimeout(() => popup.remove(), 600);
        state.combo = 0;
        state.misses++;
        audioEngine.play('miss');
        updateHUD();
        hitAny = true;
        break;
      }
    } else {
      // Circle hitbox
      const cx = tx + tw / 2;
      const cy = ty + th / 2;
      const dist = Math.hypot(mx - cx, my - cy);
      if (dist <= tw / 2) {
        removeTarget(t, true);
        hitAny = true;
        break;
      }
    }
  }

  if (!hitAny) {
    state.misses++;
    state.combo = 0;
    audioEngine.play('miss');

    // Miss indicator
    const miss = document.createElement('div');
    miss.classList.add('miss-indicator');
    miss.style.left = mx + 'px';
    miss.style.top = my + 'px';
    area.appendChild(miss);
    setTimeout(() => miss.remove(), 400);
    updateHUD();
  }
}

// ---- Tracking mode ----
let trackingAnimFrame = null;
let trackingBarEl = null;

function startTrackingMode() {
  // Create score bar
  const area = $('#game-area');
  trackingBarEl = document.createElement('div');
  trackingBarEl.id = 'tracking-score-bar';
  trackingBarEl.innerHTML = '<div id="tracking-score-fill"></div>';
  area.appendChild(trackingBarEl);

  state.trackingScore = 0;
  state.trackingFrames = 0;
  state.trackingOnTarget = 0;

  // Spawn one target
  spawnTarget();

  function trackingLoop() {
    if (!state.running) return;
    const area = $('#game-area');
    const areaRect = area.getBoundingClientRect();

    state.targets.forEach(t => {
      if (!t.alive) return;
      const { w, h } = getArea();

      // Move
      t.x += t.vx;
      t.y += t.vy;

      // Bounce
      if (t.x - t.size / 2 <= 0 || t.x + t.size / 2 >= w) {
        t.vx *= -1;
        t.x = Math.max(t.size / 2, Math.min(w - t.size / 2, t.x));
      }
      if (t.y - t.size / 2 <= 0 || t.y + t.size / 2 >= h) {
        t.vy *= -1;
        t.y = Math.max(t.size / 2, Math.min(h - t.size / 2, t.y));
      }

      // Random direction changes
      if (Math.random() < 0.01) {
        const angle = Math.random() * Math.PI * 2;
        const spd = DIFF[state.difficulty].speed;
        t.vx = Math.cos(angle) * spd;
        t.vy = Math.sin(angle) * spd;
      }

      t.el.style.left = (t.x - t.size / 2) + 'px';
      t.el.style.top = (t.y - t.size / 2) + 'px';

      // Check if cursor is on target
      const ch = $('#crosshair');
      const chRect = ch.getBoundingClientRect();
      const cx = chRect.left + chRect.width / 2 - areaRect.left;
      const cy = chRect.top + chRect.height / 2 - areaRect.top;
      const dist = Math.hypot(cx - t.x, cy - t.y);

      state.trackingFrames++;
      if (dist <= t.size / 2) {
        state.trackingOnTarget++;
        state.score += 1;
      }
    });

    // Update tracking bar
    const pct = state.trackingFrames > 0 ? (state.trackingOnTarget / state.trackingFrames * 100) : 0;
    const fill = $('#tracking-score-fill');
    if (fill) fill.style.width = pct + '%';

    updateHUD();
    trackingAnimFrame = requestAnimationFrame(trackingLoop);
  }

  trackingAnimFrame = requestAnimationFrame(trackingLoop);
}

// ---- Spawn Loop ----
let spawnInterval = null;

function startSpawnLoop() {
  const rate = DIFF[state.difficulty].spawnRate;

  if (state.mode === 'gridshot') {
    spawnGridTargets();
    return;
  }
  if (state.mode === 'tracking') {
    startTrackingMode();
    return;
  }
  if (state.mode === 'speed') {
    spawnMultiTargets();
    spawnInterval = setInterval(() => {
      if (state.targets.filter(t => t.alive).length < 2) {
        spawnMultiTargets();
      }
    }, rate);
    return;
  }

  // Flick, headshot, micro
  spawnTarget();
  spawnInterval = setInterval(() => {
    const alive = state.targets.filter(t => t.alive).length;
    const maxAlive = state.mode === 'micro' ? 2 : 3;
    if (alive < maxAlive) spawnTarget();
  }, rate);
}

// ---- HUD ----
function updateHUD() {
  const total = state.hits + state.misses;
  const acc = total > 0 ? Math.round(state.hits / total * 100) : 100;

  $('#hud-score').textContent = 'Score: ' + state.score.toLocaleString();
  $('#hud-combo').textContent = 'Combo: x' + state.combo;
  $('#hud-accuracy').textContent = acc + '%';

  // Record score history every 5s
  const elapsed = state.duration - state.timeLeft;
  if (elapsed > 0 && elapsed % 5 === 0 && state.scoreHistory[state.scoreHistory.length - 1]?.t !== elapsed) {
    state.scoreHistory.push({ t: elapsed, s: state.score });
  }
}

// ---- Timer ----
function startTimer() {
  state.timeLeft = state.duration;
  $('#hud-timer').textContent = state.timeLeft;
  $('#hud-timer').classList.remove('urgent');

  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    $('#hud-timer').textContent = state.timeLeft;

    if (state.timeLeft <= 10) {
      $('#hud-timer').classList.add('urgent');
    }
    if (state.timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}

// ---- Game Flow ----
function startGame(mode) {
  state.mode = mode;
  state.difficulty = $('#difficulty-select').value;
  state.duration = parseInt($('#duration-select').value);
  state.crosshair = $('#crosshair-select').value;
  state.soundOn = $('#sound-toggle').checked;

  audioEngine.enabled = state.soundOn;
  audioEngine.init();

  // Reset state
  state.score = 0;
  state.hits = 0;
  state.misses = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.targets = [];
  state.reactionTimes = [];
  state.scoreHistory = [{ t: 0, s: 0 }];
  state.trackingScore = 0;
  state.trackingFrames = 0;
  state.trackingOnTarget = 0;

  setCrosshairStyle(state.crosshair);

  const modeNames = {
    flick: 'Flick Shot', tracking: 'Tracking', gridshot: 'Gridshot',
    headshot: 'Headshot Only', micro: 'Micro Adjust', speed: 'Speed Switch'
  };
  const diffNames = {
    easy: 'Fer/Bronze', medium: 'Argent/Gold', hard: 'Platine/Diamant', extreme: 'Immortel/Radiant'
  };

  $('#hud-mode').textContent = modeNames[mode];
  $('#hud-diff').textContent = diffNames[state.difficulty];

  showScreen('game');

  // Countdown
  const overlay = document.createElement('div');
  overlay.id = 'countdown-overlay';
  document.body.appendChild(overlay);

  let count = 3;
  overlay.textContent = count;
  audioEngine.play('countdown');

  const countInterval = setInterval(() => {
    count--;
    if (count > 0) {
      overlay.textContent = count;
      audioEngine.play('countdown');
    } else {
      overlay.textContent = 'GO!';
      audioEngine.play('start');
      clearInterval(countInterval);
      setTimeout(() => {
        overlay.remove();
        state.running = true;
        startTimer();
        startSpawnLoop();

        if (state.mode !== 'tracking') {
          $('#game-area').addEventListener('mousedown', handleGameClick);
        }
      }, 300);
    }
  }, 800);
}

function endGame() {
  state.running = false;
  clearInterval(state.timerInterval);
  clearInterval(spawnInterval);
  spawnInterval = null;

  if (trackingAnimFrame) {
    cancelAnimationFrame(trackingAnimFrame);
    trackingAnimFrame = null;
  }

  // Clean tracking bar
  const tb = $('#tracking-score-bar');
  if (tb) tb.remove();

  $('#game-area').removeEventListener('mousedown', handleGameClick);

  // Remove all targets
  state.targets.forEach(t => {
    if (t.alive) {
      t.alive = false;
      if (t.timeout) clearTimeout(t.timeout);
      t.el.remove();
    }
  });
  state.targets = [];

  audioEngine.play('end');

  // Final stats
  state.scoreHistory.push({ t: state.duration, s: state.score });

  const total = state.hits + state.misses;
  let accuracy;
  if (state.mode === 'tracking') {
    accuracy = state.trackingFrames > 0 ? Math.round(state.trackingOnTarget / state.trackingFrames * 100) : 0;
  } else {
    accuracy = total > 0 ? Math.round(state.hits / total * 100) : 0;
  }

  const avgReaction = state.reactionTimes.length > 0
    ? Math.round(state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length)
    : 0;

  // Calculate rank
  // Normalize score to 60s
  const normalizedScore = Math.round(state.score * (60 / state.duration));
  const rank = [...RANKS].reverse().find(r => normalizedScore >= r.min) || RANKS[0];

  // Display results
  $('#res-score').textContent = state.score.toLocaleString();
  $('#res-accuracy').textContent = accuracy + '%';
  $('#res-hits').textContent = state.hits;
  $('#res-misses').textContent = state.misses;
  $('#res-avg-time').textContent = avgReaction > 0 ? avgReaction + 'ms' : 'N/A';
  $('#res-best-combo').textContent = state.bestCombo;

  const rankEl = $('#results-rank');
  rankEl.textContent = rank.label;
  rankEl.style.color = rank.color;
  rankEl.style.borderColor = rank.color;

  // Draw chart
  drawResultsChart();

  // Save
  saveStats(state.score, accuracy);

  showScreen('results');
}

// ---- Results Chart ----
function drawResultsChart() {
  const canvas = $('#results-chart');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  const data = state.scoreHistory;
  if (data.length < 2) return;

  const maxScore = Math.max(...data.map(d => d.s), 1);
  const maxTime = state.duration;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (h - 20) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(w - 10, y);
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = 10 + (h - 20) * (i / 4);
    const val = Math.round(maxScore * (1 - i / 4));
    ctx.fillText(val, 36, y + 4);
  }

  // Line
  ctx.strokeStyle = '#ff4655';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255, 70, 85, 0.5)';
  ctx.shadowBlur = 8;
  ctx.beginPath();

  data.forEach((d, i) => {
    const x = 40 + (d.t / maxTime) * (w - 50);
    const y = 10 + (1 - d.s / maxScore) * (h - 20);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Fill
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, 'rgba(255, 70, 85, 0.2)');
  gradient.addColorStop(1, 'rgba(255, 70, 85, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = 40 + (d.t / maxTime) * (w - 50);
    const y = 10 + (1 - d.s / maxScore) * (h - 20);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  const lastX = 40 + (data[data.length - 1].t / maxTime) * (w - 50);
  ctx.lineTo(lastX, h - 10);
  ctx.lineTo(40, h - 10);
  ctx.closePath();
  ctx.fill();

  // Dots
  ctx.fillStyle = '#ff4655';
  data.forEach(d => {
    const x = 40 + (d.t / maxTime) * (w - 50);
    const y = 10 + (1 - d.s / maxScore) * (h - 20);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ---- Event Listeners ----
$$('.mode-card').forEach(card => {
  card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    startGame(mode);
  });
});

$('#btn-retry').addEventListener('click', () => {
  startGame(state.mode);
});

$('#btn-menu').addEventListener('click', () => {
  showScreen('menu');
});

// Prevent right-click in game
document.addEventListener('contextmenu', e => {
  if (state.running) e.preventDefault();
});

// Init
updateMenuStats();
