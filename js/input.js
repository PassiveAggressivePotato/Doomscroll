// input.js — floating touch controls.
//  • Right thumb, anywhere on the right of the view: a joystick appears where
//    you touch. Up/down = walk, left/right = turn.
//  • Left thumb, anywhere on the left: a fire button appears where you touch.
//  • Status bar: swipe & hold sideways to strafe; quick-tap the ARMS numbers
//    to switch weapons. Keyboard (WASD/arrows, space, 1-3) works on desktop.
import { unlock } from './audio.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.move = 0; this.turn = 0; this.strafe = 0; this.fire = false;
    this.select = null;
    this.joy = null;      // {id, cx, cy, dx, dy} in CSS px
    this.btn = null;      // {id, x, y}
    this.swipe = null;    // {id, x0, t0, dx}
    this.tapped = false;  // any tap this frame (title/restart screens)
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
    if (y >= this.hudTop) {
      if (!this.swipe) this.swipe = { id: e.pointerId, x0: x, y0: y, t0: performance.now(), dx: 0 };
      return;
    }
    if (x >= window.innerWidth / 2) {
      if (!this.joy) this.joy = { id: e.pointerId, cx: x, cy: y, dx: 0, dy: 0 };
    } else {
      if (!this.btn) { this.btn = { id: e.pointerId, x, y }; }
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
    if (this.swipe && e.pointerId === this.swipe.id) {
      this.swipe.dx = e.clientX - this.swipe.x0;
    }
  }

  up(e) {
    if (this.joy && e.pointerId === this.joy.id) this.joy = null;
    if (this.btn && e.pointerId === this.btn.id) this.btn = null;
    if (this.swipe && e.pointerId === this.swipe.id) {
      const s = this.swipe;
      // a quick, small-movement tap on the ARMS grid switches weapon
      if (performance.now() - s.t0 < 350 && Math.abs(s.dx) < 12 && this.armsRect) {
        const r = this.armsRect;
        if (s.x0 >= r.x0 && s.x0 <= r.x1 && s.y0 >= r.y0 && s.y0 <= r.y1) {
          this.select = Math.min(2, ((s.x0 - r.x0) / (r.x1 - r.x0) * 3) | 0);
        }
      }
      this.swipe = null;
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
    if (this.btn) fire = true;
    if (this.swipe && Math.abs(this.swipe.dx) > 10) {
      strafe += Math.max(-1, Math.min(1, this.swipe.dx / 55));
    }
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
    return out;
  }
}
