// Audio engine — Web Audio API, zero dependencies, 4 distinct sound packs.
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
    this.pack = 'clean';
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }
  setPack(name) { this.pack = name; }

  play(type) {
    if (!this.enabled || !this.ctx || this.volume <= 0) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const pack = PACK_ENGINES[this.pack] || PACK_ENGINES.clean;
    const fn = pack[type];
    if (fn) fn(this.ctx, this.volume);
  }
}

/* ──────────────────────────────────────────────────────────
   Shared helpers
   ────────────────────────────────────────────────────────── */
function osc(ctx, freq, wave, vol, dur, rampTo) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.connect(g); g.connect(ctx.destination);
  o.type = wave;
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(freq, t);
  if (rampTo) o.frequency.exponentialRampToValueAtTime(rampTo, t + dur * 0.5);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.start(t); o.stop(t + dur);
}

function noise(ctx, vol, dur, filterFreq, filterType) {
  const sr = ctx.sampleRate;
  const len = sr * dur;
  const buf = ctx.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType || 'bandpass';
  filt.frequency.value = filterFreq || 2000;
  filt.Q.value = 1.5;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(ctx.destination);
  src.start(t); src.stop(t + dur);
}

function detunedOsc(ctx, freq, vol, dur, spread) {
  // 3 detuned oscillators for metallic timbre
  [-spread, 0, spread].forEach(det => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.detune.setValueAtTime(det, ctx.currentTime);
    g.gain.setValueAtTime(vol / 3, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(ctx.currentTime); o.stop(ctx.currentTime + dur);
  });
}

/* ──────────────────────────────────────────────────────────
   PACK: Clean — Pure sine tones, crisp and clear
   ────────────────────────────────────────────────────────── */
const pack_clean = {
  hit(ctx, v) {
    osc(ctx, 880, 'sine', 0.15 * v, 0.1, 1200);
  },
  headshot(ctx, v) {
    osc(ctx, 880, 'sine', 0.15 * v, 0.1, 1200);
    setTimeout(() => osc(ctx, 1400, 'sine', 0.12 * v, 0.08), 50);
  },
  miss(ctx, v) {
    osc(ctx, 200, 'sawtooth', 0.08 * v, 0.15, 100);
  },
  combo(ctx, v) {
    [1000, 1200, 1400].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.08 * v, 0.06), i * 40));
  },
  countdown(ctx, v) { osc(ctx, 600, 'sine', 0.12 * v, 0.2); },
  start(ctx, v) { osc(ctx, 600, 'sine', 0.15 * v, 0.3, 1200); },
  end(ctx, v) {
    [800, 600, 400].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.1 * v, 0.2), i * 100));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Retro — Chiptune/8-bit: square waves, fast arpeggios,
   pitch drops, staccato bleeps
   ────────────────────────────────────────────────────────── */
const pack_retro = {
  hit(ctx, v) {
    // Sharp square blip with fast pitch drop
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(1500, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.06);
    g.gain.setValueAtTime(0.11 * v, t);
    g.gain.setValueAtTime(0.11 * v, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.start(t); o.stop(t + 0.07);
  },
  headshot(ctx, v) {
    // Fast 3-note arpeggio (classic power-up)
    [1200, 1500, 2000].forEach((f, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(f, ctx.currentTime);
        g.gain.setValueAtTime(0.09 * v, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.05);
      }, i * 30);
    });
  },
  miss(ctx, v) {
    // Descending buzz (game-over feel)
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.15);
    g.gain.setValueAtTime(0.07 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.start(t); o.stop(t + 0.18);
  },
  combo(ctx, v) {
    // Rapid chiptune scale
    [660, 880, 1100, 1320, 1760].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.06 * v, 0.035), i * 25));
  },
  countdown(ctx, v) {
    osc(ctx, 440, 'square', 0.09 * v, 0.08);
    setTimeout(() => osc(ctx, 440, 'square', 0.06 * v, 0.05), 90);
  },
  start(ctx, v) {
    // Rising chiptune fanfare
    [330, 440, 550, 660, 880].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.08 * v, 0.06), i * 50));
  },
  end(ctx, v) {
    // Descending sad tune
    [880, 660, 440, 330, 220].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.07 * v, 0.1), i * 70));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Soft — Gentle filtered noise, triangle waves,
   slow envelopes, almost ASMR-like
   ────────────────────────────────────────────────────────── */
const pack_soft = {
  hit(ctx, v) {
    // Soft noise click + gentle high triangle ping
    noise(ctx, 0.06 * v, 0.08, 4000, 'highpass');
    osc(ctx, 1200, 'triangle', 0.05 * v, 0.18);
  },
  headshot(ctx, v) {
    // Airy chime: two triangle tones with slow fade
    noise(ctx, 0.04 * v, 0.06, 5000, 'highpass');
    osc(ctx, 1100, 'triangle', 0.05 * v, 0.22);
    setTimeout(() => osc(ctx, 1650, 'triangle', 0.04 * v, 0.2), 70);
  },
  miss(ctx, v) {
    // Low soft woosh
    noise(ctx, 0.04 * v, 0.2, 400, 'lowpass');
  },
  combo(ctx, v) {
    // Gentle rising hum
    [800, 900, 1000].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'triangle', 0.04 * v, 0.12), i * 60));
  },
  countdown(ctx, v) {
    noise(ctx, 0.03 * v, 0.06, 3000, 'bandpass');
    osc(ctx, 500, 'triangle', 0.06 * v, 0.25);
  },
  start(ctx, v) {
    // Warm rising pad
    osc(ctx, 400, 'triangle', 0.06 * v, 0.4, 800);
    noise(ctx, 0.03 * v, 0.15, 3000, 'highpass');
  },
  end(ctx, v) {
    // Fading chimes
    [700, 580, 460].forEach((f, i) =>
      setTimeout(() => {
        osc(ctx, f, 'triangle', 0.05 * v, 0.3);
        noise(ctx, 0.02 * v, 0.1, 2000, 'highpass');
      }, i * 130));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Mechanical — Industrial/metallic: detuned saws,
   noise bursts, harsh transients, clicky
   ────────────────────────────────────────────────────────── */
const pack_mechanical = {
  hit(ctx, v) {
    // Sharp metallic click: detuned + noise burst
    detunedOsc(ctx, 1800, 0.12 * v, 0.04, 25);
    noise(ctx, 0.10 * v, 0.03, 6000, 'highpass');
  },
  headshot(ctx, v) {
    // Double metallic clang
    detunedOsc(ctx, 2200, 0.10 * v, 0.035, 30);
    noise(ctx, 0.10 * v, 0.025, 7000, 'highpass');
    setTimeout(() => {
      detunedOsc(ctx, 3000, 0.08 * v, 0.03, 40);
      noise(ctx, 0.06 * v, 0.02, 8000, 'highpass');
    }, 35);
  },
  miss(ctx, v) {
    // Low clunk + rattle
    detunedOsc(ctx, 120, 0.10 * v, 0.08, 15);
    noise(ctx, 0.08 * v, 0.06, 800, 'lowpass');
  },
  combo(ctx, v) {
    // Rapid clicking sequence, ascending
    [1400, 1800, 2200, 2800].forEach((f, i) =>
      setTimeout(() => {
        detunedOsc(ctx, f, 0.07 * v, 0.025, 20);
        noise(ctx, 0.04 * v, 0.015, 5000 + i * 1000, 'highpass');
      }, i * 25));
  },
  countdown(ctx, v) {
    detunedOsc(ctx, 800, 0.09 * v, 0.06, 20);
    noise(ctx, 0.07 * v, 0.04, 3000, 'bandpass');
  },
  start(ctx, v) {
    // Industrial rev-up
    noise(ctx, 0.08 * v, 0.12, 2000, 'bandpass');
    detunedOsc(ctx, 600, 0.10 * v, 0.15, 25);
    setTimeout(() => detunedOsc(ctx, 1200, 0.08 * v, 0.1, 30), 80);
  },
  end(ctx, v) {
    // Heavy descending clatter
    [1200, 800, 500, 300].forEach((f, i) =>
      setTimeout(() => {
        detunedOsc(ctx, f, 0.08 * v, 0.06, 20);
        noise(ctx, 0.05 * v, 0.04, 1500 - i * 300, 'bandpass');
      }, i * 60));
  },
};

const PACK_ENGINES = { clean: pack_clean, retro: pack_retro, soft: pack_soft, mechanical: pack_mechanical };

window.audioEngine = new AudioEngine();
