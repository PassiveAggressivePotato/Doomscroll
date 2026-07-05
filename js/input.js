// input.js — floating touch controls.
//  • Right thumb, anywhere on the right of the view: a joystick appears where
//    you touch. Up/down = walk, left/right = turn.
//  • Left thumb, anywhere on the left: a fire button appears where you touch.
//    Hold and slide it sideways to strafe — it slides with your thumb, and
//    the further it's pushed the faster you strafe (capped at walk speed).
//  • Status bar: quick-tap the ARMS numbers to switch weapons; quick-tap
//    anywhere else on it to fire (handy for shooting a door open without
//    reaching for the fire button). Keyboard (WASD/arrows, space, 1-3)
//    works on desktop.
import { unlock } from './audio.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = 0; this.turn = 0; this.strafe = 0; this.fire = false;
    this.select = null;
    this.joy = null;      // {id, cx, cy, dx, dy} in CSS px
    this.btn = null;      // {id, cx, cy, dx} — dx (from the touch-down point) drives strafe
    this.bar = null;      // {id, x0, y0, t0} — status-bar tap tracking (fire / weapon select)
    this.barFire = false; // one-shot: a quick tap on the status bar just fired
    this.tapped = false;  // any tap this frame (title/restart screens)
    this.lastX = 0; this.lastY = 0; // raw CSS px of the most recent tap
    this.keys = new Set();
    this.hudTop = 9999;   // CSS px; set by layout()
    this.armsRect = null; // {x0,y0,x1,y1} CSS px
    this.armsCols = 3;

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
      unlock();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
  }

  down(e) {
    e.preventDefault();
    unlock();
    this.canvas.setPointerCapture?.(e.pointerId);
    this.tapped = true;
    const x = e.clientX, y = e.clientY;
    this.lastX = x; this.lastY = y; // raw tap position, for hit-testing UI buttons (e.g. the title screen)
    if (y >= this.hudTop) {
      if (!this.bar) this.bar = { id: e.pointerId, x0: x, y0: y, t0: performance.now() };
      return;
    }
    if (x >= window.innerWidth / 2) {
      if (!this.joy) this.joy = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
    } else {
      if (!this.btn) { this.btn = { id: e.pointerId, cx: x, cy: y, dx: 0 }; }
    }
  }

  movePtr(e) {
    if (this.joy && e.pointerId === this.joy.id) {
      const R = 52;
      let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.joy.dx = dx; this.joy.dy = dy;
    }
    if (this.btn && e.pointerId === this.btn.id) {
      const R = 46;
      this.btn.dx = Math.max(-R, Math.min(R, e.clientX - this.btn.cx));
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) this.joy = null;
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
        // a quick tap anywhere else on the bar fires — handy for popping a
        // door open (or an enemy) without reaching for the fire button
        this.barFire = true;
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
    }
    if (this.btn) {
      fire = true;
      // direct positional mapping (no smoothing/momentum) — sliding back
      // past centre snaps straight to the opposite strafe direction
      strafe += this.btn.dx / 46;
    }
    if (this.barFire) fire = true;
    this.move = Math.max(-1, Math.min(1, move));
    this.turn = Math.max(-1, Math.min(1, turn));
    this.strafe = Math.max(-1, Math.min(1, strafe));
    this.fire = fire;
    const out = {
      move: this.move, turn: this.turn, strafe: this.strafe,
      fire: this.fire, select: this.select, tapped: this.tapped,
    };
    this.select = null;
    this.tapped = false;
    this.barFire = false;
    return out;
  }
}
