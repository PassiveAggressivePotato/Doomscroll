// input.js — floating touch controls, with two experimental schemes for
// combining strafe with firing on the left/right thumbs. Tap the small
// A/B button in the top-right corner to flip between them for testing —
// it's remembered across reloads.
//
//  Scheme A: left thumb always strafes (slide it sideways, same as
//    before). Press flatter — more of the thumb touching the screen —
//    to also fire; just the tip touching strafes without firing. (Needs
//    a device that reports real touch-contact size; falls back to
//    "always fires while held" if it can't tell.) Right thumb is a plain
//    move/turn stick.
//  Scheme B: left thumb strafes only, never fires. Right thumb fires if
//    you tap it or hold it in place, but not if your first move off it
//    is a swipe — and once it's firing you can still drag it to move
//    normally, same as the plain stick.
//
// Status bar: quick-tap the ARMS numbers to switch weapons; quick-tap
// anywhere else on it to push open whatever door (or the exit switch) is
// directly ahead — it doesn't fire a shot. Keyboard (WASD/arrows, space,
// 1-3, F to push) always works on desktop, independent of scheme.
import { unlock } from './audio.js';

const SCHEME_KEY = 'doomscroll_ctrlScheme';
// How flat a touch has to be (CSS px of contact width/height) to count as
// "whole pad" rather than "just the tip" in scheme A. Devices/browsers
// that don't report real contact geometry report ~1 for every touch, in
// which case this always reads as a flat press (i.e. always fires) —
// there's no way to distinguish tip-vs-pad without that hardware support.
export const FLAT_PRESS_PX = 30;
// Scheme B: how long a still touch has to be held, and how far it can
// drift, before it commits to "holding to fire" instead of "tapping".
const HOLD_MS = 140, SWIPE_PX = 14;

const contactSize = e => Math.max(e.width || 1, e.height || 1);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.scheme = localStorage.getItem(SCHEME_KEY) === 'B' ? 'B' : 'A';
    this.move = 0; this.turn = 0; this.strafe = 0; this.fire = false; this.use = false;
    this.select = null;
    this.joy = null;      // {id, cx, cy, dx, dy, t0, committed, fire} — committed only used in scheme B
    this.btn = null;      // {id, cx, cy, dx, contact} — dx drives strafe always
    this.bar = null;      // {id, x0, y0, t0} — status-bar tap tracking (push / weapon select)
    this.barUse = false;  // one-shot: a quick tap on the status bar just pushed something
    this.keyUse = false;  // one-shot: desktop 'F' key just pushed something
    this.joyTapFire = false; // one-shot: scheme B, released the stick before it committed either way
    this.tapped = false;  // any tap this frame (title/restart screens)
    this.lastX = 0; this.lastY = 0; // raw CSS px of the most recent tap
    this.keys = new Set();
    this.hudTop = 9999;    // CSS px; set by layout()
    this.armsRect = null;  // {x0,y0,x1,y1} CSS px
    this.armsCols = 3;
    this.schemeRect = null; // {x0,y0,x1,y1} CSS px — top-right A/B toggle

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

  toggleScheme() {
    this.scheme = this.scheme === 'A' ? 'B' : 'A';
    localStorage.setItem(SCHEME_KEY, this.scheme);
  }

  down(e) {
    e.preventDefault();
    unlock();
    this.canvas.setPointerCapture?.(e.pointerId);
    const x = e.clientX, y = e.clientY;

    // the A/B toggle is a dev/test control, not part of play — handle it
    // before anything else so it can't also count as a title/restart tap
    // or start a joystick/fire touch underneath it
    const sr = this.schemeRect;
    if (sr && x >= sr.x0 && x <= sr.x1 && y >= sr.y0 && y <= sr.y1) {
      this.toggleScheme();
      return;
    }
    this.tapped = true;
    this.lastX = x; this.lastY = y; // raw tap position, for hit-testing UI buttons (e.g. the title screen)
    if (y >= this.hudTop) {
      if (!this.bar) this.bar = { id: e.pointerId, x0: x, y0: y, t0: performance.now() };
      return;
    }
    if (x >= window.innerWidth / 2) {
      if (!this.joy) {
        this.joy = {
          id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0, t0: performance.now(),
          committed: this.scheme === 'B' ? null : 'move', // scheme A: right stick never fires
          fire: false,
        };
      }
    } else {
      if (!this.btn) this.btn = { id: e.pointerId, cx: x, cy: y, dx: 0, contact: contactSize(e) };
    }
  }

  movePtr(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      const R = 52;
      let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.joy.dx = dx; this.joy.dy = dy;
      if (this.joy.committed === null) {
        if (d > SWIPE_PX) this.joy.committed = 'move';
        else if (performance.now() - this.joy.t0 > HOLD_MS) { this.joy.committed = 'hold'; this.joy.fire = true; }
      }
    }
    if (this.btn && e.pointerId === this.btn.id) {
      const R = 46;
      this.btn.dx = Math.max(-R, Math.min(R, e.clientX - this.btn.cx));
      this.btn.contact = contactSize(e);
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      // released before it swiped or held long enough to commit — a tap fires once
      if (this.joy.committed === null) this.joyTapFire = true;
      this.joy = null;
    }
    if (this.btn && e.pointerId === this.btn.id) this.btn = null;
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
    if (this.joy) {
      move += -this.joy.dy / 46;
      turn += this.joy.dx / 46;
      if (this.scheme === 'B') {
        // a perfectly still hold produces no pointermove events, so also
        // check the hold-commit timer here every frame
        if (this.joy.committed === null && performance.now() - this.joy.t0 > HOLD_MS) {
          this.joy.committed = 'hold'; this.joy.fire = true;
        }
        if (this.joy.fire) fire = true;
      }
    }
    if (this.joyTapFire) { fire = true; this.joyTapFire = false; }
    if (this.btn) {
      // scheme A: flatten your thumb (bigger contact patch) to fire;
      // scheme B: this button is strafe-only and never fires
      if (this.scheme === 'A' && contactIsFlat(this.btn.contact)) fire = true;
      // direct positional mapping (no smoothing/momentum) — sliding back
      // past centre snaps straight to the opposite strafe direction
      strafe += this.btn.dx / 46;
    }
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

function contactIsFlat(size) {
  return size <= 1 || size >= FLAT_PRESS_PX; // no contact-size support -> always fire
}
export const isContactFlat = contactIsFlat;
