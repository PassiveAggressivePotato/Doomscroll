// px.js — tiny pixel-art toolkit.
// All buffers are Uint32Array in little-endian RGBA order (0xAABBGGRR).
// Alpha 0 = transparent.

export function C(r, g, b, a = 255) {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function hex(s) {
  const n = parseInt(s.slice(1), 16);
  return C((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

export function rgb(c) {
  return [c & 255, (c >> 8) & 255, (c >> 16) & 255];
}

// Multiply a colour's brightness by f (keeps alpha).
export function shade(c, f) {
  if (!(c >>> 24)) return 0;
  const r = Math.min(255, ((c & 255) * f) | 0);
  const g = Math.min(255, (((c >> 8) & 255) * f) | 0);
  const b = Math.min(255, (((c >> 16) & 255) * f) | 0);
  return ((c & 0xff000000) | (b << 16) | (g << 8) | r) >>> 0;
}

// Deterministic pseudo-random (so art is identical every load).
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }
  clone() {
    const p = new Pix(this.w, this.h);
    p.data.set(this.data);
    return p;
  }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.data[y * this.w + x] = c;
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) this.set(i, j, c);
  }
  // Filled ellipse inside the box (x,y,w,h).
  ellipse(x, y, w, h, c) {
    const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
    for (let j = Math.floor(y); j < y + h; j++)
      for (let i = Math.floor(x); i < x + w; i++) {
        const dx = (i + 0.5 - cx) / rx, dy = (j + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(i, j, c);
      }
  }
  line(x0, y0, x1, y1, c) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  // Sprinkle noise pixels of colour c inside a box with probability p.
  speckle(x, y, w, h, c, p, rng) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (rng() < p && this.get(i, j) >>> 24) this.set(i, j, c);
  }
  // Replace opaque pixels that touch transparency/border with colour c.
  outline(c) {
    const src = this.data.slice();
    const at = (x, y) =>
      x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (!(at(x, y) >>> 24)) continue;
        if (!(at(x - 1, y) >>> 24) || !(at(x + 1, y) >>> 24) ||
            !(at(x, y - 1) >>> 24) || !(at(x, y + 1) >>> 24))
          this.data[y * this.w + x] = c;
      }
  }
  // Darken the left column & bottom row of each opaque region (cheap shading).
  rimShade(f) {
    const src = this.data.slice();
    const at = (x, y) =>
      x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : src[y * this.w + x];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = at(x, y);
        if (!(c >>> 24)) continue;
        if (!(at(x - 1, y) >>> 24) || !(at(x, y + 1) >>> 24))
          this.data[y * this.w + x] = shade(c, f);
      }
  }
  // Paste another Pix at (x,y); transparent pixels skipped. flip=true mirrors.
  paste(p, x, y, flip = false) {
    for (let j = 0; j < p.h; j++)
      for (let i = 0; i < p.w; i++) {
        const c = p.data[j * p.w + (flip ? p.w - 1 - i : i)];
        if (c >>> 24) this.set(x + i, y + j, c);
      }
  }
  mirrored() {
    const p = new Pix(this.w, this.h);
    for (let j = 0; j < this.h; j++)
      for (let i = 0; i < this.w; i++)
        p.data[j * this.w + i] = this.data[j * this.w + (this.w - 1 - i)];
    return p;
  }
  brightened(f) {
    const p = this.clone();
    for (let i = 0; i < p.data.length; i++) p.data[i] = shade(p.data[i], f);
    return p;
  }
  // Remap exact colours via Map<colour,colour>.
  remapped(map) {
    const p = this.clone();
    for (let i = 0; i < p.data.length; i++) {
      const m = map.get(p.data[i]);
      if (m !== undefined) p.data[i] = m;
    }
    return p;
  }
}
