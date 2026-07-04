// engine.js — the pseudo-3D renderer. One ray per screen column finds the
// nearest wall (classic DDA raycasting); floors/ceilings are cast per pixel;
// sprites are depth-sorted billboards clipped against the wall z-buffer.
import { WALLS, FLATS } from './textures.js';

export const FOV_PLANE = 0.55;      // tan(half-FOV) ≈ 58° horizontal
const TS = 64;                      // texture size
const SHADE_LEVELS = 16;
const WALL_ART_H = 54;              // sprite px that equal one wall height

// Per-channel shade lookup: SHADE_LUT[level][value]
const SHADE_LUT = [];
for (let l = 0; l < SHADE_LEVELS; l++) {
  const t = new Uint8Array(256);
  const f = (l + 1) / SHADE_LEVELS;
  for (let v = 0; v < 256; v++) t[v] = (v * f) | 0;
  SHADE_LUT.push(t);
}

function shadePix(c, lut) {
  return ((c & 0xff000000) |
    (lut[(c >> 16) & 255] << 16) | (lut[(c >> 8) & 255] << 8) | lut[c & 255]) >>> 0;
}

// Pre-shaded copies of a texture at every light level.
function shadeSet(pix) {
  const out = [];
  for (let l = 0; l < SHADE_LEVELS; l++) {
    const lut = SHADE_LUT[l];
    const d = new Uint32Array(pix.data.length);
    for (let i = 0; i < d.length; i++) d[i] = shadePix(pix.data[i], lut);
    out.push(d);
  }
  return out;
}

export class Renderer {
  constructor(W, H, viewH) {
    this.W = W; this.H = H; this.viewH = viewH;
    this.horizon = viewH >> 1;
    this.proj = W / (2 * FOV_PLANE); // wall height at distance 1
    this.zbuf = new Float32Array(W);
    this.fb = null;                  // set by main (ImageData-backed)
    // pre-shaded textures
    this.walls = {};
    for (const k in WALLS) this.walls[k] = shadeSet(WALLS[k]);
    this.flats = {};
    for (const k in FLATS) if (k !== 'sky') this.flats[k] = shadeSet(FLATS[k]);
    this.sky = FLATS.sky;
    this.colAngle = new Float32Array(W);
    for (let x = 0; x < W; x++)
      this.colAngle[x] = Math.atan((2 * x / W - 1) * FOV_PLANE);
  }

  level(dist) {
    const l = (SHADE_LEVELS + 1 - dist * 1.35) | 0;
    return l < 3 ? 3 : l > SHADE_LEVELS - 1 ? SHADE_LEVELS - 1 : l;
  }

  // g supplies: px, py, angle, grid accessors, doors, sprites list.
  render(g) {
    const { W, viewH, horizon, proj, fb, zbuf } = this;
    const dirX = Math.cos(g.angle), dirY = Math.sin(g.angle);
    const planeX = -dirY * FOV_PLANE, planeY = dirX * FOV_PLANE;
    const px = g.px, py = g.py;

    // ---------- floors & ceilings (per row, mirrored around the horizon)
    const rd0x = dirX - planeX, rd0y = dirY - planeY;
    const rd1x = dirX + planeX, rd1y = dirY + planeY;
    const posZ = proj / 2;
    const skyW = this.sky.w, skyH = this.sky.h, skyD = this.sky.data;
    const skyBase = ((g.angle / (Math.PI * 2)) % 1 + 1) % 1;
    for (let y = horizon + 1; y < viewH; y++) {
      const rowDist = posZ / (y - horizon);
      const stepX = rowDist * (rd1x - rd0x) / W;
      const stepY = rowDist * (rd1y - rd0y) / W;
      let fx = px + rowDist * rd0x;
      let fy = py + rowDist * rd0y;
      const lv = this.level(rowDist);
      const cy = 2 * horizon - y; // mirrored ceiling row
      let rowF = y * W, rowC = cy * W;
      for (let x = 0; x < W; x++, fx += stepX, fy += stepY) {
        const cxi = fx | 0, cyi = fy | 0;
        const cell = g.cellInfo(cxi, cyi); // {floor, ceil, sky}
        const tx = ((fx - cxi) * TS) | 0, ty = ((fy - cyi) * TS) | 0;
        const ti = ty * TS + tx;
        fb[rowF + x] = this.flats[cell.floor][lv][ti];
        if (cy >= 0) {
          if (cell.sky) {
            const u = ((skyBase + this.colAngle[x] / (Math.PI * 2)) * skyW) | 0;
            const v = Math.min(skyH - 1, (cy / horizon) * skyH * 0.92 | 0);
            fb[rowC + x] = skyD[v * skyW + ((u % skyW) + skyW) % skyW];
          } else {
            fb[rowC + x] = this.flats[cell.ceil][lv][ti];
          }
        }
      }
    }
    // horizon row (fill with far floor colour to avoid a seam)
    {
      const lv = 3, row = horizon * W;
      const c = this.flats.concrete[lv][0];
      for (let x = 0; x < W; x++) fb[row + x] = c;
    }
    // when viewH is even the mirrored ceiling never reaches row 0 — copy row 1
    if (2 * horizon - (viewH - 1) > 0) fb.copyWithin(0, W, 2 * W);

    // ---------- walls (one DDA ray per column)
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1;
      const rdx = dirX + planeX * camX, rdy = dirY + planeY * camX;
      let mapX = px | 0, mapY = py | 0;
      const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
      let stepX, sdx, stepY, sdy;
      if (rdx < 0) { stepX = -1; sdx = (px - mapX) * ddx; }
      else { stepX = 1; sdx = (mapX + 1 - px) * ddx; }
      if (rdy < 0) { stepY = -1; sdy = (py - mapY) * ddy; }
      else { stepY = 1; sdy = (mapY + 1 - py) * ddy; }
      let side = 0, tex = null, perp = 30, wallX = 0, texShift = 0;
      for (let it = 0; it < 64; it++) {
        if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; }
        else { sdy += ddy; mapY += stepY; side = 1; }
        const w = g.wallAt(mapX, mapY); // 0 | {tex:'name'} | {door}
        if (!w) continue;
        perp = side ? sdy - ddy : sdx - ddx;
        wallX = side ? px + perp * rdx : py + perp * rdy;
        wallX -= wallX | 0;
        if (w.door) {
          // sliding door: the open fraction is a gap the ray can pass through
          if (wallX < w.door.open) continue;
          texShift = w.door.open;
          tex = this.walls.door;
        } else {
          texShift = 0;
          tex = this.walls[w.tex];
        }
        break;
      }
      if (perp < 0.02) perp = 0.02;
      zbuf[x] = perp;
      const lineH = (proj / perp) | 0;
      let y0 = horizon - (lineH >> 1), y1 = y0 + lineH;
      const ty0 = y0 < 0 ? -y0 : 0;
      if (y0 < 0) y0 = 0;
      if (y1 > viewH) y1 = viewH;
      if (!tex) continue;
      let tx = ((wallX - texShift) * TS) | 0;
      if (tx < 0) tx += TS;
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) tx = TS - 1 - tx;
      const lv = Math.max(3, this.level(perp) - (side ? 2 : 0));
      const td = tex[lv];
      const tStep = TS / lineH;
      let tPos = ty0 * tStep;
      for (let y = y0; y < y1; y++) {
        const tyy = tPos | 0;
        tPos += tStep;
        fb[y * W + x] = td[(tyy >= TS ? TS - 1 : tyy) * TS + tx];
      }
    }

    // ---------- sprites (billboards), far → near
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const list = [];
    for (const s of g.sprites) {
      const dx = s.x - px, dy = s.y - py;
      const ty = invDet * (-planeY * dx + planeX * dy);
      if (ty < 0.15) continue;
      const tx = invDet * (dirY * dx - dirX * dy);
      list.push({ s, tx, ty });
    }
    list.sort((a, b) => b.ty - a.ty);
    for (const { s, tx, ty } of list) {
      const pix = s.pix;
      const screenX = (W / 2) * (1 + tx / ty);
      const hScale = (proj / ty) / WALL_ART_H;      // screen px per art px
      const sh = pix.h * hScale, sw = pix.w * hScale;
      const lineH = proj / ty;
      const floorY = horizon + lineH / 2;
      let top;
      if (s.anchor === 'mid') top = horizon - sh / 2 + (s.vy || 0) * hScale;
      else top = floorY - sh;
      const x0 = Math.max(0, Math.ceil(screenX - sw / 2));
      const x1 = Math.min(W - 1, Math.floor(screenX + sw / 2));
      if (x1 < x0) continue;
      const y0 = Math.max(0, Math.ceil(top));
      const y1 = Math.min(viewH - 1, Math.floor(top + sh));
      const lut = SHADE_LUT[s.bright ? SHADE_LEVELS - 1 : this.level(ty)];
      const flip = !!s.flip;
      for (let x = x0; x <= x1; x++) {
        if (ty >= zbuf[x]) continue;
        let u = ((x - (screenX - sw / 2)) / sw * pix.w) | 0;
        if (u < 0) u = 0; else if (u >= pix.w) u = pix.w - 1;
        if (flip) u = pix.w - 1 - u;
        for (let y = y0; y <= y1; y++) {
          let v = ((y - top) / sh * pix.h) | 0;
          if (v < 0) v = 0; else if (v >= pix.h) v = pix.h - 1;
          const c = pix.data[v * pix.w + u];
          if (c >>> 24) fb[y * W + x] = shadePix(c, lut);
        }
      }
    }
  }

  // Nearest-neighbour blit of a Pix into the framebuffer (HUD / weapon / UI).
  blit(pix, dx, dy, scale = 1, alpha = 1) {
    const { W, H, fb } = this;
    const sw = pix.w * scale, sh = pix.h * scale;
    const x0 = Math.max(0, Math.ceil(dx)), x1 = Math.min(W, Math.ceil(dx + sw));
    const y0 = Math.max(0, Math.ceil(dy)), y1 = Math.min(H, Math.ceil(dy + sh));
    for (let y = y0; y < y1; y++) {
      const v = ((y - dy) / scale) | 0;
      for (let x = x0; x < x1; x++) {
        const u = ((x - dx) / scale) | 0;
        const c = pix.data[v * pix.w + u];
        if (!(c >>> 24)) continue;
        if (alpha >= 1) { fb[y * W + x] = c; continue; }
        const o = fb[y * W + x];
        const r = ((c & 255) * alpha + (o & 255) * (1 - alpha)) | 0;
        const gg = (((c >> 8) & 255) * alpha + ((o >> 8) & 255) * (1 - alpha)) | 0;
        const b = (((c >> 16) & 255) * alpha + ((o >> 16) & 255) * (1 - alpha)) | 0;
        fb[y * W + x] = ((255 << 24) | (b << 16) | (gg << 8) | r) >>> 0;
      }
    }
  }

  // Tint a screen region (damage flash, pickup flash, death fade).
  tint(x0, y0, x1, y1, r, g, b, a) {
    const { W, fb } = this;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const o = fb[y * W + x];
        const nr = ((o & 255) * (1 - a) + r * a) | 0;
        const ng = (((o >> 8) & 255) * (1 - a) + g * a) | 0;
        const nb = (((o >> 16) & 255) * (1 - a) + b * a) | 0;
        fb[y * W + x] = ((255 << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
      }
  }
}
