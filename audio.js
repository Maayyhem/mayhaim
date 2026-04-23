// Audio engine — Web Audio API, zero dependencies.
// Packs (7) + sous-volumes par type + mute ciblé (combo/miss).
// Les hit sounds ont été retravaillés pour être moins fatigants / moins "pop".
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.5;
    this.pack = 'clean';
    // Sous-volumes par type (multipliés avec le volume master).
    this.subVolumes = { hit: 1, miss: 1, combo: 1, countdown: 1, start: 1, end: 1, headshot: 1 };
    // Types de son désactivés individuellement (ex: combo seul).
    this.muted = new Set();
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); }
  setPack(name) { this.pack = name; }
  setSubVolume(type, v) { this.subVolumes[type] = Math.max(0, Math.min(1, v)); }
  muteType(type, muted) { if (muted) this.muted.add(type); else this.muted.delete(type); }
  isMuted(type) { return this.muted.has(type); }

  play(type) {
    if (!this.enabled || !this.ctx || this.volume <= 0) return;
    if (this.muted.has(type)) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const pack = PACK_ENGINES[this.pack] || PACK_ENGINES.clean;
    const fn = pack[type];
    const sub = this.subVolumes[type] ?? 1;
    if (sub <= 0) return;
    if (fn) fn(this.ctx, this.volume * sub);
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
  const len = Math.max(1, Math.floor(sr * dur));
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
   PACK: Clean — Sine tones adoucis (fréquence mid, pas d'aigu shrill)
   Refonte : freq de base 660Hz au lieu de 880Hz, durée courte, pas de pitch sweep
   ────────────────────────────────────────────────────────── */
const pack_clean = {
  hit(ctx, v) {
    osc(ctx, 680, 'sine', 0.12 * v, 0.07);
  },
  headshot(ctx, v) {
    osc(ctx, 680, 'sine', 0.12 * v, 0.07);
    setTimeout(() => osc(ctx, 1000, 'sine', 0.1 * v, 0.06), 45);
  },
  miss(ctx, v) {
    osc(ctx, 180, 'sine', 0.05 * v, 0.1);
  },
  combo(ctx, v) {
    [880, 1100].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.06 * v, 0.05), i * 40));
  },
  countdown(ctx, v) { osc(ctx, 600, 'sine', 0.1 * v, 0.18); },
  start(ctx, v) { osc(ctx, 600, 'sine', 0.12 * v, 0.25, 900); },
  end(ctx, v) {
    [700, 550, 420].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.08 * v, 0.18), i * 100));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Retro — Chiptune adouci (volume réduit, pitch less shrill)
   ────────────────────────────────────────────────────────── */
const pack_retro = {
  hit(ctx, v) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.05);
    g.gain.setValueAtTime(0.08 * v, t);
    g.gain.setValueAtTime(0.08 * v, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.start(t); o.stop(t + 0.06);
  },
  headshot(ctx, v) {
    [900, 1200, 1500].forEach((f, i) => {
      setTimeout(() => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'square';
        o.frequency.setValueAtTime(f, ctx.currentTime);
        g.gain.setValueAtTime(0.06 * v, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
        o.start(ctx.currentTime); o.stop(ctx.currentTime + 0.04);
      }, i * 28);
    });
  },
  miss(ctx, v) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = 'square';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(260, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.12);
    g.gain.setValueAtTime(0.05 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    o.start(t); o.stop(t + 0.14);
  },
  combo(ctx, v) {
    [600, 800, 1000, 1200].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.05 * v, 0.03), i * 25));
  },
  countdown(ctx, v) {
    osc(ctx, 440, 'square', 0.07 * v, 0.07);
  },
  start(ctx, v) {
    [330, 440, 550, 660].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.06 * v, 0.05), i * 45));
  },
  end(ctx, v) {
    [660, 500, 330, 220].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'square', 0.055 * v, 0.09), i * 65));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Soft — ASMR-like, déjà doux, légèrement retravaillé pour plus de chaleur
   ────────────────────────────────────────────────────────── */
const pack_soft = {
  hit(ctx, v) {
    noise(ctx, 0.05 * v, 0.06, 4500, 'highpass');
    osc(ctx, 1000, 'triangle', 0.04 * v, 0.15);
  },
  headshot(ctx, v) {
    noise(ctx, 0.035 * v, 0.05, 5000, 'highpass');
    osc(ctx, 950, 'triangle', 0.045 * v, 0.2);
    setTimeout(() => osc(ctx, 1450, 'triangle', 0.035 * v, 0.18), 60);
  },
  miss(ctx, v) {
    noise(ctx, 0.035 * v, 0.15, 350, 'lowpass');
  },
  combo(ctx, v) {
    [750, 850, 950].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'triangle', 0.035 * v, 0.1), i * 55));
  },
  countdown(ctx, v) {
    noise(ctx, 0.025 * v, 0.05, 3000, 'bandpass');
    osc(ctx, 480, 'triangle', 0.05 * v, 0.22);
  },
  start(ctx, v) {
    osc(ctx, 380, 'triangle', 0.05 * v, 0.35, 750);
    noise(ctx, 0.025 * v, 0.12, 3000, 'highpass');
  },
  end(ctx, v) {
    [650, 520, 400].forEach((f, i) =>
      setTimeout(() => {
        osc(ctx, f, 'triangle', 0.045 * v, 0.28);
        noise(ctx, 0.018 * v, 0.08, 2000, 'highpass');
      }, i * 120));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Mechanical — Industrial adouci (transient moins harsh)
   ────────────────────────────────────────────────────────── */
const pack_mechanical = {
  hit(ctx, v) {
    detunedOsc(ctx, 1400, 0.09 * v, 0.035, 20);
    noise(ctx, 0.07 * v, 0.025, 5500, 'highpass');
  },
  headshot(ctx, v) {
    detunedOsc(ctx, 1800, 0.085 * v, 0.03, 25);
    noise(ctx, 0.08 * v, 0.022, 6500, 'highpass');
    setTimeout(() => {
      detunedOsc(ctx, 2400, 0.065 * v, 0.028, 35);
      noise(ctx, 0.05 * v, 0.018, 7500, 'highpass');
    }, 35);
  },
  miss(ctx, v) {
    detunedOsc(ctx, 140, 0.07 * v, 0.07, 12);
    noise(ctx, 0.055 * v, 0.05, 700, 'lowpass');
  },
  combo(ctx, v) {
    [1200, 1500, 1800, 2200].forEach((f, i) =>
      setTimeout(() => {
        detunedOsc(ctx, f, 0.055 * v, 0.022, 18);
        noise(ctx, 0.03 * v, 0.012, 4500 + i * 800, 'highpass');
      }, i * 25));
  },
  countdown(ctx, v) {
    detunedOsc(ctx, 700, 0.07 * v, 0.05, 18);
    noise(ctx, 0.05 * v, 0.035, 2800, 'bandpass');
  },
  start(ctx, v) {
    noise(ctx, 0.06 * v, 0.1, 1800, 'bandpass');
    detunedOsc(ctx, 550, 0.08 * v, 0.14, 22);
    setTimeout(() => detunedOsc(ctx, 1100, 0.065 * v, 0.09, 28), 75);
  },
  end(ctx, v) {
    [1100, 750, 480, 300].forEach((f, i) =>
      setTimeout(() => {
        detunedOsc(ctx, f, 0.065 * v, 0.055, 18);
        noise(ctx, 0.04 * v, 0.035, 1400 - i * 250, 'bandpass');
      }, i * 60));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Wood — "Tock" boisé, sec, organique (pas de pop, pas d'aigu)
   Idéal pour sessions longues / contextes calmes
   ────────────────────────────────────────────────────────── */
const pack_wood = {
  hit(ctx, v) {
    // Tock boisé = noise court lowpassé + sinus grave très court
    noise(ctx, 0.14 * v, 0.025, 900, 'lowpass');
    osc(ctx, 260, 'sine', 0.06 * v, 0.04);
  },
  headshot(ctx, v) {
    noise(ctx, 0.14 * v, 0.025, 900, 'lowpass');
    osc(ctx, 260, 'sine', 0.06 * v, 0.04);
    setTimeout(() => {
      noise(ctx, 0.1 * v, 0.02, 1200, 'lowpass');
      osc(ctx, 380, 'sine', 0.05 * v, 0.035);
    }, 40);
  },
  miss(ctx, v) {
    // Tock plus mat, grave
    noise(ctx, 0.08 * v, 0.04, 400, 'lowpass');
    osc(ctx, 130, 'sine', 0.04 * v, 0.06);
  },
  combo(ctx, v) {
    [280, 340, 420].forEach((f, i) =>
      setTimeout(() => {
        noise(ctx, 0.08 * v, 0.02, 900 + i * 200, 'lowpass');
        osc(ctx, f, 'sine', 0.04 * v, 0.035);
      }, i * 45));
  },
  countdown(ctx, v) {
    noise(ctx, 0.09 * v, 0.03, 800, 'lowpass');
    osc(ctx, 340, 'sine', 0.05 * v, 0.08);
  },
  start(ctx, v) {
    [220, 330, 440].forEach((f, i) =>
      setTimeout(() => {
        noise(ctx, 0.08 * v, 0.025, 1000, 'lowpass');
        osc(ctx, f, 'sine', 0.055 * v, 0.09);
      }, i * 80));
  },
  end(ctx, v) {
    [500, 380, 280, 200].forEach((f, i) =>
      setTimeout(() => {
        noise(ctx, 0.07 * v, 0.03, 900, 'lowpass');
        osc(ctx, f, 'sine', 0.05 * v, 0.14);
      }, i * 90));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Tonal — Notes pures courtes, musicales (gamme pentatonique)
   Très discret, pas de noise, pas de transient agressif
   ────────────────────────────────────────────────────────── */
const pack_tonal = {
  hit(ctx, v) {
    // Note pure (La4), très courte
    osc(ctx, 440, 'sine', 0.09 * v, 0.08);
  },
  headshot(ctx, v) {
    // Quinte La-Mi
    osc(ctx, 440, 'sine', 0.08 * v, 0.08);
    setTimeout(() => osc(ctx, 660, 'sine', 0.07 * v, 0.07), 50);
  },
  miss(ctx, v) {
    // Note grave descendante
    osc(ctx, 220, 'sine', 0.05 * v, 0.1, 165);
  },
  combo(ctx, v) {
    // Pentatonique ascendante
    [523, 587, 659, 784].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.05 * v, 0.08), i * 40));
  },
  countdown(ctx, v) { osc(ctx, 523, 'sine', 0.08 * v, 0.18); },
  start(ctx, v) {
    [523, 659, 784].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.07 * v, 0.1), i * 50));
  },
  end(ctx, v) {
    [784, 659, 523, 392].forEach((f, i) =>
      setTimeout(() => osc(ctx, f, 'sine', 0.06 * v, 0.18), i * 110));
  },
};

/* ──────────────────────────────────────────────────────────
   PACK: Minimal — Clic quasi inaudible, uniquement retour tactile
   Parfait pour streamers / bureaux partagés / personnes sensibles
   ────────────────────────────────────────────────────────── */
const pack_minimal = {
  hit(ctx, v) {
    // Click très court, noise bandpass étroit
    noise(ctx, 0.06 * v, 0.012, 3000, 'bandpass');
  },
  headshot(ctx, v) {
    noise(ctx, 0.06 * v, 0.012, 3000, 'bandpass');
    setTimeout(() => noise(ctx, 0.05 * v, 0.012, 4500, 'bandpass'), 30);
  },
  miss(ctx, v) {
    noise(ctx, 0.035 * v, 0.02, 600, 'lowpass');
  },
  combo(ctx, v) {
    // 2 clics rapprochés
    noise(ctx, 0.05 * v, 0.01, 3500, 'bandpass');
    setTimeout(() => noise(ctx, 0.05 * v, 0.01, 4000, 'bandpass'), 30);
  },
  countdown(ctx, v) {
    noise(ctx, 0.05 * v, 0.02, 2000, 'bandpass');
  },
  start(ctx, v) {
    noise(ctx, 0.06 * v, 0.04, 2500, 'bandpass');
  },
  end(ctx, v) {
    noise(ctx, 0.05 * v, 0.05, 1500, 'bandpass');
    setTimeout(() => noise(ctx, 0.04 * v, 0.04, 1000, 'bandpass'), 80);
  },
};

const PACK_ENGINES = {
  clean: pack_clean,
  retro: pack_retro,
  soft: pack_soft,
  mechanical: pack_mechanical,
  wood: pack_wood,
  tonal: pack_tonal,
  minimal: pack_minimal,
};

window.audioEngine = new AudioEngine();
