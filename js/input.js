// input.js — floating touch controls, controller-style:
//  • Left thumb, anywhere on the left: a stick for movement — forward/back
//    and strafe left/right (no turning).
//  • Right thumb, anywhere on the right: a stick for turning left/right
//    only (there's no look up/down in this engine).
// Firing is off the sticks entirely, driven by one of two experimental
// senses you can flip between with the small button in the top-right
// corner (remembered across reloads):
//  • TILT: tip the device to fill the ring around the crosshair; it
//    fires the moment the ring is full, and keeps firing while held
//    there. The bottom-left button re-zeroes the tilt to however you're
//    currently holding the phone, in case it drifts.
//  • BLOW: blow into the mic; same full-ring-fires behaviour, driven by
//    low-frequency mic energy instead of tilt angle.
// Both need a real device to tune properly — tilt direction/degrees and
// the blow threshold are best guesses that likely need adjusting once
// tried for real.
//
// Status bar: quick-tap the ARMS numbers to switch weapons; quick-tap
// anywhere else on it to push open whatever door (or the exit switch) is
// directly ahead. Keyboard (WASD/arrows, space, 1-3, F to push) always
// works on desktop, independent of any of the above.
import { unlock } from './audio.js';

const FIRE_SCHEME_KEY = 'doomscroll_fireScheme';
const MAX_TILT_DEG = 35;   // device-tilt degrees (from zero) that fills the ring
const BLOW_THRESHOLD = 150; // avg low-band mic energy (0-255) that fills the ring

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.fireScheme = localStorage.getItem(FIRE_SCHEME_KEY) === 'blow' ? 'blow' : 'tilt';
    this.move = 0; this.turn = 0; this.strafe = 0; this.fire = false; this.use = false;
    this.fireLevel = 0;      // 0-1, for the crosshair-ring HUD
    this.fireTriggered = false;
    this.select = null;
    this.joyL = null;      // {id, cx, cy, dx, dy} — move + strafe
    this.joyR = null;      // {id, cx, cy, dx, dy} — turn only (dy unused)
    this.bar = null;       // {id, x0, y0, t0} — status-bar tap tracking (push / weapon select)
    this.barUse = false;   // one-shot: a quick tap on the status bar just pushed something
    this.keyUse = false;   // one-shot: desktop 'F' key just pushed something
    this.tapped = false;   // any tap this frame (title/restart screens)
    this.lastX = 0; this.lastY = 0; // raw CSS px of the most recent tap
    this.keys = new Set();
    this.hudTop = 9999;     // CSS px; set by layout()
    this.armsRect = null;   // {x0,y0,x1,y1} CSS px
    this.armsCols = 3;
    this.schemeRect = null; // {x0,y0,x1,y1} CSS px — top-right TILT/BLOW toggle
    this.zeroRect = null;   // {x0,y0,x1,y1} CSS px — bottom-left tilt re-zero

    this._sensorsRequested = false;
    this._rawBeta = null;
    this.tiltZero = null;
    this._wasTriggered = false;
    this._micAnalyser = null;
    this._micData = null;

    const opts = { passive: false };
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.down(e), opts);
    canvas.addEventListener('pointermove', e => this.movePtr(e), opts);
    canvas.addEventListener('pointerup', e => this.up(e), opts);
    canvas.addEventListener('pointercancel', e => this.up(e), opts);
    window.addEventListener('keydown', e => {
      if (!e.repeat) this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (e.code === 'Digit1') this.select = 0;
      if (e.code === 'Digit2') this.select = 1;
      if (e.code === 'Digit3') this.select = 2;
      if (e.code === 'KeyF') this.keyUse = true;
      unlock();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  toggleFireScheme() {
    this.fireScheme = this.fireScheme === 'tilt' ? 'blow' : 'tilt';
    localStorage.setItem(FIRE_SCHEME_KEY, this.fireScheme);
  }

  zeroTilt() {
    if (this._rawBeta !== null) this.tiltZero = this._rawBeta;
  }

  // Lazily asks for whatever sensor access either fire scheme needs, the
  // first time the player actually touches the screen (a real user
  // gesture, required by iOS for motion access and by all browsers for
  // the mic). Both are requested up front so switching schemes later
  // doesn't need a fresh prompt.
  requestSensors() {
    if (this._sensorsRequested) return;
    this._sensorsRequested = true;
    const listen = () => window.addEventListener('deviceorientation', e => this._onOrientation(e));
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission().then(state => { if (state === 'granted') listen(); }).catch(() => {});
    } else if (typeof DeviceOrientationEvent !== 'undefined') {
      listen();
    }
    navigator.mediaDevices?.getUserMedia?.({ audio: true }).then(stream => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      this._micAnalyser = analyser;
      this._micData = new Uint8Array(analyser.frequencyBinCount);
    }).catch(() => {}); // no mic / denied — blow scheme just won't fire
  }

  _onOrientation(e) {
    this._rawBeta = e.beta ?? 0;
    if (this.tiltZero === null) this.tiltZero = this._rawBeta; // auto-zero on first reading
  }

  get tiltLevel() {
    if (this._rawBeta === null || this.tiltZero === null) return 0;
    return Math.max(0, Math.min(1, (this._rawBeta - this.tiltZero) / MAX_TILT_DEG));
  }

  get blowLevel() {
    if (!this._micAnalyser) return 0;
    this._micAnalyser.getByteFrequencyData(this._micData);
    // blowing concentrates energy in the low end of the spectrum — average
    // roughly the bottom eighth of the frequency bins
    const n = Math.max(1, this._micData.length >> 3);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += this._micData[i];
    return Math.max(0, Math.min(1, (sum / n) / BLOW_THRESHOLD));
  }

  down(e) {
    e.preventDefault();
    unlock();
    this.requestSensors();
    this.canvas.setPointerCapture?.(e.pointerId);
    const x = e.clientX, y = e.clientY;

    // the corner buttons are dev/test controls, not part of play — handle
    // them before anything else so they can't also count as a title/
    // restart tap or start a stick touch underneath them
    const sr = this.schemeRect;
    if (sr && x >= sr.x0 && x <= sr.x1 && y >= sr.y0 && y <= sr.y1) { this.toggleFireScheme(); return; }
    const zr = this.zeroRect;
    if (zr && x >= zr.x0 && x <= zr.x1 && y >= zr.y0 && y <= zr.y1) { this.zeroTilt(); return; }

    this.tapped = true;
    this.lastX = x; this.lastY = y; // raw tap position, for hit-testing UI buttons (e.g. the title screen)
    if (y >= this.hudTop) {
      if (!this.bar) this.bar = { id: e.pointerId, x0: x, y0: y, t0: performance.now() };
      return;
    }
    if (x >= window.innerWidth / 2) {
      if (!this.joyR) this.joyR = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
    } else {
      if (!this.joyL) this.joyL = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
    }
  }

  movePtr(e) {
    const R = 52;
    for (const j of [this.joyL, this.joyR]) {
      if (!j || e.pointerId !== j.id) continue;
      let dx = e.clientX - j.cx, dy = e.clientY - j.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      j.dx = dx; j.dy = dy;
    }
  }

  up(e) {
    if (this.joyL && e.pointerId === this.joyL.id) this.joyL = null;
    if (this.joyR && e.pointerId === this.joyR.id) this.joyR = null;
    if (this.bar && e.pointerId === this.bar.id) {
      const s = this.bar;
      const quick = performance.now() - s.t0 < 350 &&
        Math.hypot(e.clientX - s.x0, e.clientY - s.y0) < 12;
      const r = this.armsRect;
      if (quick && r && s.x0 >= r.x0 && s.x0 <= r.x1 && s.y0 >= r.y0 && s.y0 <= r.y1) {
        // a quick tap on the ARMS grid switches weapon
        this.select = Math.min(2, ((s.x0 - r.x0) / (r.x1 - r.x0) * 3) | 0);
      } else if (quick) {
        // a quick tap anywhere else on the bar pushes open whatever door
        // (or the exit switch) is directly ahead — it doesn't fire
        this.barUse = true;
      }
      this.bar = null;
    }
  }

  // called once per frame by main; returns the control state
  poll() {
    const k = this.keys;
    let move = 0, turn = 0, strafe = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) move += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) move -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) turn -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) turn += 1;
    if (k.has('KeyQ')) strafe -= 1;
    if (k.has('KeyE')) strafe += 1;
    let fire = k.has('Space') || k.has('ControlLeft') || k.has('ControlRight');

    if (this.joyL) {
      move += -this.joyL.dy / 46;
      strafe += this.joyL.dx / 46;
    }
    if (this.joyR) {
      turn += this.joyR.dx / 46; // no look up/down, so dy is unused
    }

    const level = this.fireScheme === 'blow' ? this.blowLevel : this.tiltLevel;
    const triggered = level >= 1;
    if (triggered && !this._wasTriggered) navigator.vibrate?.(40);
    this._wasTriggered = triggered;
    this.fireLevel = level;
    this.fireTriggered = triggered;
    if (triggered) fire = true;

    const use = this.barUse || this.keyUse;
    this.move = Math.max(-1, Math.min(1, move));
    this.turn = Math.max(-1, Math.min(1, turn));
    this.strafe = Math.max(-1, Math.min(1, strafe));
    this.fire = fire;
    const out = {
      move: this.move, turn: this.turn, strafe: this.strafe,
      fire: this.fire, use, select: this.select, tapped: this.tapped,
    };
    this.select = null;
    this.tapped = false;
    this.barUse = false;
    this.keyUse = false;
    return out;
  }
}
