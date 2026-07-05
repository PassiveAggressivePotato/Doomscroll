// audio.js — all sound effects are synthesised with WebAudio (no files).
let ctx = null, master = null, noiseBuf = null;

export function unlock() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function noise(dur, { f0 = 1200, f1 = 300, type = 'lowpass', g = 0.5, q = 0.6 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, ctx.currentTime);
  filt.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ctx.currentTime + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(g, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filt).connect(gain).connect(master);
  src.start();
  src.stop(ctx.currentTime + dur + 0.02);
}

function tone(f0, f1, dur, { type = 'square', g = 0.25, delay = 0 } = {}) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(g, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(gain).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

const RECIPES = {
  pistol: () => { noise(0.14, { f0: 2400, f1: 400, g: 0.5 }); tone(220, 60, 0.1, { type: 'triangle', g: 0.3 }); },
  shotgun: () => { noise(0.35, { f0: 1500, f1: 120, g: 0.8 }); tone(140, 40, 0.3, { type: 'sawtooth', g: 0.35 }); },
  chaingun: () => { noise(0.09, { f0: 2600, f1: 500, g: 0.4 }); tone(260, 80, 0.07, { type: 'triangle', g: 0.22 }); },
  eshoot: () => { noise(0.16, { f0: 1800, f1: 300, g: 0.3 }); },
  throw: () => { noise(0.25, { f0: 500, f1: 1400, type: 'bandpass', g: 0.3 }); },
  fizz: () => { noise(0.2, { f0: 900, f1: 200, g: 0.35 }); },
  boom: () => { noise(0.7, { f0: 900, f1: 60, g: 1.0 }); tone(90, 30, 0.6, { type: 'sine', g: 0.5 }); },
  door: () => { tone(70, 110, 0.5, { type: 'sawtooth', g: 0.14 }); noise(0.5, { f0: 300, f1: 500, type: 'bandpass', g: 0.12 }); },
  alert: () => { tone(140, 90, 0.35, { type: 'sawtooth', g: 0.28 }); tone(147, 80, 0.35, { type: 'sawtooth', g: 0.22 }); },
  epain: () => { tone(200, 120, 0.18, { type: 'sawtooth', g: 0.25 }); },
  edie: () => { tone(160, 40, 0.55, { type: 'sawtooth', g: 0.3 }); noise(0.4, { f0: 700, f1: 100, g: 0.25 }); },
  phurt: () => { tone(110, 60, 0.22, { type: 'square', g: 0.3 }); noise(0.15, { f0: 500, f1: 150, g: 0.3 }); },
  pdie: () => { tone(130, 30, 1.1, { type: 'sawtooth', g: 0.4 }); noise(0.9, { f0: 600, f1: 60, g: 0.4 }); },
  pick: () => { tone(660, 990, 0.09, { g: 0.18 }); },
  wpick: () => { tone(440, 660, 0.1, { g: 0.2 }); tone(660, 990, 0.12, { g: 0.2, delay: 0.09 }); },
  click: () => { tone(800, 500, 0.04, { g: 0.12 }); },
  win: () => { tone(392, 392, 0.14, { g: 0.25 }); tone(523, 523, 0.14, { g: 0.25, delay: 0.14 }); tone(659, 659, 0.3, { g: 0.3, delay: 0.28 }); },
  glitch: () => {
    noise(0.22, { f0: 3200, f1: 800, type: 'bandpass', g: 0.35 });
    tone(900, 90, 0.09, { type: 'square', g: 0.18 });
    tone(220, 1400, 0.05, { type: 'sawtooth', g: 0.14, delay: 0.06 });
    tone(1600, 60, 0.07, { type: 'square', g: 0.15, delay: 0.12 });
  },
};

// tiny rate-limit so 7 shotgun pellets don't stack 7 sounds
const lastPlayed = {};
export function play(name) {
  if (!ctx || ctx.state !== 'running') return;
  const now = performance.now();
  if (lastPlayed[name] && now - lastPlayed[name] < 45) return;
  lastPlayed[name] = now;
  const r = RECIPES[name];
  if (r) r();
}
