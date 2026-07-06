// hud.js — status bar (concept-styled: AMMO HEALTH ARMS FACE ARMOR + tallies),
// the first-person weapon, touch-control overlays, messages and full screens.
import { Pix, hex, shade, makeRng } from './px.js';
import { FACES, FP } from './sprites.js';
import { WEAPONS } from './game.js';
import { loadSet } from './assets.js';
import * as sfx from './audio.js';

export const HUD_H = 52;

// ---- tiny 3×5 pixel font -------------------------------------------------
const GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111',
  '3': '111001011001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001010010010', '8': '111101111101111',
  '9': '111101111001111',
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101110100110101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110110101',
  S: '011100010001110', T: '111010010010010', U: '101101101101111',
  V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  ':': '000010000010000', '.': '000000000000010', '!': '010010010000010',
  '%': '101001010100101', '-': '000000111000000', '/': '001001010100100',
  "'": '010010000000000', ' ': '000000000000000',
};

export function drawText(rend, text, x, y, scale, col, shadow = true) {
  for (const chRaw of String(text).toUpperCase()) {
    const g = GLYPHS[chRaw] || GLYPHS[' '];
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 3; c++) {
        if (g[r * 3 + c] !== '1') continue;
        for (let sy = 0; sy < scale; sy++)
          for (let sx = 0; sx < scale; sx++) {
            const px = x + c * scale + sx, py = y + r * scale + sy;
            if (shadow) setPx(rend, px + 1, py + 1, hex('#000000'));
            setPx(rend, px, py, col);
          }
      }
    x += 4 * scale;
  }
  return x;
}
function textW(text, scale) { return String(text).length * 4 * scale - scale; }
function setPx(rend, x, y, c) {
  if (x < 0 || y < 0 || x >= rend.W || y >= rend.H) return;
  rend.fb[y * rend.W + x] = c;
}
function fillRect(rend, x, y, w, h, c) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setPx(rend, i, j, c);
}
function circle(rend, cx, cy, r, c, filled = false) {
  for (let a = 0; a < 64; a++) {
    const t = a / 64 * Math.PI * 2;
    setPx(rend, cx + Math.cos(t) * r | 0, cy + Math.sin(t) * r | 0, c);
  }
  if (filled)
    for (let j = -r + 1; j < r; j++) for (let i = -r + 1; i < r; i++)
      if (i * i + j * j < r * r * 0.55) setPx(rend, cx + i, cy + j, c);
}

// ---- status bar backdrop (built once per width) ---------------------------
let hudBg = null;
function buildHudBg(W) {
  hudBg = new Pix(W, HUD_H);
  const rng = makeRng(1234);
  hudBg.rect(0, 0, W, HUD_H, hex('#4b4e49'));
  hudBg.speckle(0, 0, W, HUD_H, hex('#42453f'), 0.25, rng);
  hudBg.speckle(0, 0, W, HUD_H, hex('#565a53'), 0.12, rng);
  hudBg.rect(0, 0, W, 2, hex('#22241f'));
  hudBg.rect(0, 2, W, 1, hex('#6a6e66'));
  // section dividers + rivets
  for (const x of [36, 68, 96, 128, 164]) {
    hudBg.rect(x, 4, 1, HUD_H - 8, hex('#2e302b'));
    hudBg.rect(x + 1, 4, 1, HUD_H - 8, hex('#5f635b'));
  }
  for (const x of [4, 32, 40, 64, 72, 92, 100, 124, 132, 160, 168, W - 6])
    for (const y of [5, HUD_H - 6]) {
      hudBg.set(x, y, hex('#767a71'));
      hudBg.set(x + 1, y + 1, hex('#2e302b'));
    }
}

const RED = hex('#e03a2f'), YEL = hex('#e8c53a'), GRY = hex('#b9bdb2'),
  DIM = hex('#6e7268'), GRN = hex('#43d05a'), BLU = hex('#3fa9f5');

// arms grid geometry (internal px) — input maps weapon-select taps onto this
export function armsRectInternal(W) { return { x0: 69, y0: 0, x1: 97, y1: HUD_H }; }

export function drawHud(rend, g) {
  const W = rend.W, top = rend.viewH;
  if (!hudBg || hudBg.w !== W) buildHudBg(W);
  rend.blit(hudBg, 0, top, 1);
  const base = top;

  // AMMO (current weapon's pool)
  const wep = WEAPONS[g.weapon];
  const ammo = g[wep.ammo];
  drawText(rend, String(ammo), 5, base + 10, 2, ammo > 8 ? RED : YEL);
  drawText(rend, 'AMMO', 9, base + 36, 1, DIM);

  // HEALTH
  const hp = Math.max(0, Math.round(g.hp));
  const hcol = hp > 60 ? GRN : hp > 25 ? YEL : RED;
  const hx = drawText(rend, String(hp), 41, base + 10, 2, hcol);
  drawText(rend, '%', Math.min(hx + 1, 90), base + 15, 1, DIM);
  drawText(rend, 'HEALTH', 40, base + 36, 1, DIM);

  // ARMS 1-3
  drawText(rend, 'ARMS', 74, base + 36, 1, DIM);
  for (let i = 0; i < 3; i++) {
    const x = 70 + i * 9, y = base + 10;
    fillRect(rend, x, y, 8, 11, g.weapon === i ? hex('#23251f') : hex('#3a3d37'));
    drawText(rend, String(i + 1), x + 2, y + 3, 1, g.have[i] ? YEL : hex('#565a52'));
    if (g.weapon === i) {
      fillRect(rend, x, y, 8, 1, YEL);
      fillRect(rend, x, y + 10, 8, 1, YEL);
    }
  }

  // FACE (dead centre)
  const fx = (W >> 1) - 15, fy = base + 9;
  fillRect(rend, fx - 1, fy - 1, 32, 32, hex('#15140f'));
  let facePix;
  if (g.dead) facePix = FACES.dead;
  else {
    const tier = g.hp >= 75 ? 0 : g.hp >= 50 ? 1 : g.hp >= 25 ? 2 : 3;
    const set = FACES.tiers[tier];
    facePix = g.faceHit > 0 ? set.hit : g.faceFire > 0 ? set.fire : set.idle;
  }
  rend.blit(facePix, fx + 2, fy + 2, 1);

  // ARMOR
  drawText(rend, String(Math.max(0, Math.round(g.armor))), 133, base + 10, 2, g.armor > 0 ? GRN : DIM);
  drawText(rend, 'ARMOR', 134, base + 36, 1, DIM);

  // right block: kill / loot tallies + timer (stand-ins for the key list)
  drawText(rend, 'KILL', 169, base + 8, 1, DIM);
  drawText(rend, `${g.kills}/${g.totalKills}`, 190, base + 8, 1, RED);
  drawText(rend, 'LOOT', 169, base + 18, 1, DIM);
  drawText(rend, `${g.got}/${g.totalItems}`, 190, base + 18, 1, BLU);
  drawText(rend, 'ZONE', 169, base + 28, 1, DIM);
  drawText(rend, '1', 190, base + 28, 1, GRY);
  const mins = (g.time / 60) | 0, secs = (g.time % 60) | 0;
  drawText(rend, 'TIME', 169, base + 38, 1, DIM);
  drawText(rend, `${mins}:${secs < 10 ? '0' : ''}${secs}`, 190, base + 38, 1, GRY);
}

// ---- first-person weapon ---------------------------------------------------
export function drawWeapon(rend, g) {
  let set = FP.pistol, s = 1;
  if (g.weapon === 1) { set = FP.shotgun; }
  if (g.weapon === 2) { set = FP.chaingun; s = rend.W / 96 * 0.78; } // chaingun is still code-drawn on a 96x72 canvas
  let pix = set.idle;
  if (g.muzzle > 0) pix = set.fire[0];
  else if (g.weapon === 2 && g.cool > 0.06) pix = set.fire[1];
  const bobX = Math.sin(g.bob) * 5, bobY = Math.abs(Math.cos(g.bob)) * 4;
  // recoil: a sharp kick up on firing, easing back down to rest
  const recoilY = -g.recoil * WEAPONS[g.weapon].kick;
  const recoilX = (g.weapon === 1 ? -g.recoil * 4 : 0); // shotgun also snaps slightly aside
  const dropY = g.weapon === 1 ? 22 : 10; // shotgun sits further down behind the status bar
  let y = rend.viewH - pix.h * s + dropY + bobY + recoilY + g.switching * 90;
  rend.blit(pix, (rend.W - pix.w * s) / 2 + bobX + recoilX, y, s);
}

// ---- touch overlays ---------------------------------------------------------
function drawStick(rend, cssToInt, j) {
  const [x, y] = cssToInt(j.cx, j.cy);
  const [kx, ky] = cssToInt(j.cx + j.dx, j.cy + j.dy);
  circle(rend, x, y, 26, hex('#c9cec2'));
  circle(rend, x, y, 25, hex('#3a3d37'));
  circle(rend, kx, ky, 10, hex('#e8c53a'), true);
}

export function drawTouchUI(rend, input, cssToInt) {
  if (input.joyL) drawStick(rend, cssToInt, input.joyL);
  if (input.joyR) drawStick(rend, cssToInt, input.joyR);
}

// top-right corner geometry (internal px) for the TILT/BLOW fire-scheme
// toggle — a small dev/test switch, not part of the normal HUD chrome
export function schemeToggleRectInternal(W) { return { x0: W - 30, y0: 2, x1: W - 2, y1: 16 }; }

export function drawSchemeToggle(rend, fireScheme) {
  const r = schemeToggleRectInternal(rend.W);
  fillRect(rend, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, hex('#20221e'));
  drawText(rend, fireScheme, r.x0 + 2, r.y0 + 3, 1, YEL);
}

// bottom-left corner geometry (internal px) for the tilt re-zero button
export function zeroRectInternal(H) { return { x0: 2, y0: H - 14, x1: 22, y1: H - 2 }; }

export function drawZeroButton(rend) {
  const r = zeroRectInternal(rend.H);
  fillRect(rend, r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0, hex('#20221e'));
  drawText(rend, '0', r.x0 + 6, r.y0 + 3, 1, BLU);
}

// The crosshair doubles as a fire-charge meter: a ring of pips fills in
// (tilt angle or mic-blow level, whichever scheme is active) around the
// still-usable centre dot, flashing red once it's full — which is also
// the instant it fires.
export function drawCrosshairMeter(rend, input) {
  const cx = rend.W >> 1, cy = rend.viewH >> 1;
  setPx(rend, cx, cy, hex('#d8dcd0'));
  setPx(rend, cx - 1, cy, hex('#20221e'));
  setPx(rend, cx + 1, cy, hex('#20221e'));
  const N = 8, R = 6;
  const lit = Math.round((input.fireLevel || 0) * N);
  const col = input.fireTriggered ? hex('#e03a2f') : YEL;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.round(Math.cos(t) * R), y = cy + Math.round(Math.sin(t) * R);
    setPx(rend, x, y, i < lit ? col : hex('#4a4d46'));
  }
}

// ---- messages & flashes ------------------------------------------------------
export function drawMessages(rend, g) {
  if (g.msgT > 0 && g.msg) drawText(rend, g.msg, 4, 4, 1, GRY);
  drawText(rend, g.levelName, 4, rend.viewH - 8, 1, hex('#8a8e83'));
  // crosshair is drawn separately by drawCrosshairMeter (it needs `input`)
  if (g.flashR > 0) rend.tint(0, 0, rend.W, rend.viewH, 200, 20, 10, Math.min(0.5, g.flashR));
  if (g.flashY > 0) rend.tint(0, 0, rend.W, rend.viewH, 220, 190, 60, Math.min(0.3, g.flashY));
}

// ---- title screen (poster art) --------------------------------------------
// nonglow -> flash -> breathe between glow/glitch, with a screen-glitch FX
// + sound each time the glitch phase of the breath comes around.
const TITLE = {};
export async function loadTitleArt() {
  const t = await loadSet('assets/ui', ['title_nonglow', 'title_glow', 'title_glitch', 'tap_start']);
  Object.assign(TITLE, t);
  TITLE.tap_start_glow = makeGlowSprite(TITLE.tap_start, 6, hex('#5cff8c'));
  // red variant: someone's already hosting a game — tap to join them instead
  TITLE.tap_start_red = recolorByLuma(TITLE.tap_start, 1.3, 0.18, 0.16);
  TITLE.tap_start_glow_red = makeGlowSprite(TITLE.tap_start, 6, hex('#ff4433'));
}

// Recolour every opaque pixel by its luminance (keeps the art's shading/
// legibility, just changes the hue) — used to turn the green start button
// red without needing a second hand-drawn asset.
function recolorByLuma(pix, rMul, gMul, bMul) {
  const p = pix.clone();
  for (let i = 0; i < p.data.length; i++) {
    const c = p.data[i];
    const a = c >>> 24;
    if (!a) continue;
    const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const nr = Math.min(255, luma * rMul) | 0, ng = Math.min(255, luma * gMul) | 0, nb = Math.min(255, luma * bMul) | 0;
    p.data[i] = ((a << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
  }
  return p;
}

// Chunky low-res silhouette of `pix` (any opaque pixel in a block lights the
// whole block) recoloured flat green — blitting it upscaled gives a cheap
// pixelated glow without touching the source art.
function makeGlowSprite(pix, factor, color) {
  const gw = Math.max(1, Math.round(pix.w / factor));
  const gh = Math.max(1, Math.round(pix.h / factor));
  const g = new Pix(gw, gh);
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * pix.h / gh), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * pix.h / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * pix.w / gw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * pix.w / gw));
      let hit = false;
      for (let y = y0; y < y1 && !hit; y++)
        for (let x = x0; x < x1; x++)
          if (pix.data[y * pix.w + x] >>> 24) { hit = true; break; }
      if (hit) g.data[gy * gw + gx] = color;
    }
  }
  return g;
}

const FLASH_AT = 0.9;    // seconds showing the plain logo before it flashes on
const FLASH_DUR = 0.16;
const GLOW_LEN = 2.3;    // breathing cycle: mostly glowing...
const GLITCH_LEN = 0.5;  // ...with a short glitch pulse
const CYCLE_LEN = GLOW_LEN + GLITCH_LEN;

// screen-space corruption: torn/shifted scanlines + a chromatic-aberration
// band + scattered noise pixels. Cheap, so safe to run every glitch frame.
function applyGlitchFX(rend) {
  const { W, H, fb } = rend;
  const bands = 3 + ((Math.random() * 4) | 0);
  for (let b = 0; b < bands; b++) {
    const y0 = (Math.random() * H) | 0;
    const bh = 1 + ((Math.random() * 4) | 0);
    const shift = ((Math.random() - 0.5) * 40) | 0;
    for (let y = y0; y < Math.min(H, y0 + bh); y++) {
      const row = y * W;
      const src = fb.slice(row, row + W);
      for (let x = 0; x < W; x++) {
        const sx = x - shift;
        fb[row + x] = sx >= 0 && sx < W ? src[sx] : 0;
      }
    }
  }
  // one chromatic-split strip
  if (Math.random() < 0.8) {
    const y0 = (Math.random() * H) | 0, bh = 6 + ((Math.random() * 14) | 0);
    const off = 2 + ((Math.random() * 4) | 0);
    for (let y = y0; y < Math.min(H, y0 + bh); y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const c = fb[row + x];
        const rx = Math.min(W - 1, x + off), bx = Math.max(0, x - off);
        const cr = fb[row + rx], cb = fb[row + bx];
        fb[row + x] = ((c & 0xff000000) | (cb & 0xff0000) | (c & 0xff00) | (cr & 0xff)) >>> 0;
      }
    }
  }
  // scattered static noise
  const noisePx = ((W * H) * 0.01) | 0;
  for (let i = 0; i < noisePx; i++) {
    const x = (Math.random() * W) | 0, y = (Math.random() * H) | 0;
    fb[y * W + x] = Math.random() < 0.5 ? 0xffffffff : (0xff000000 | ((Math.random() * 0xffffff) | 0));
  }
}

export const titleBtnRect = { x0: 0, y0: 0, x1: 0, y1: 0 };
let lastCyclePhase = -1;

export function drawTitle(rend, t, joinable) {
  const W = rend.W, H = rend.H;
  if (!TITLE.title_nonglow) return; // art still loading
  const cover = (pix) => {
    const s = Math.max(W / pix.w, H / pix.h);
    rend.blit(pix, (W - pix.w * s) / 2, (H - pix.h * s) / 2, s);
  };

  if (t < FLASH_AT) {
    cover(TITLE.title_nonglow);
  } else if (t < FLASH_AT + FLASH_DUR) {
    cover(TITLE.title_glow);
    const f = 1 - (t - FLASH_AT) / FLASH_DUR;
    rend.tint(0, 0, W, H, 255, 255, 240, f * 0.85);
  } else {
    const cyclePos = (t - FLASH_AT - FLASH_DUR) % CYCLE_LEN;
    const glitching = cyclePos >= GLOW_LEN;
    cover(glitching ? TITLE.title_glitch : TITLE.title_glow);
    const phase = ((t - FLASH_AT - FLASH_DUR) / CYCLE_LEN) | 0;
    if (glitching) {
      if (phase !== lastCyclePhase) { lastCyclePhase = phase; sfx.play('glitch'); }
      applyGlitchFX(rend);
    }
  }

  // "TAP HERE TO START" button — a subtle pulse, and it's the only tappable
  // spot. Red instead of green means someone else is already playing —
  // tapping it joins their game instead of starting a new one.
  const btn = joinable ? TITLE.tap_start_red : TITLE.tap_start;
  const pulse = 1 + Math.sin(t * 3.2) * 0.015;
  const scale = 0.75 * pulse;
  const bw = btn.w * scale, bh = btn.h * scale;
  const bx = (W - bw) / 2, by = H * 0.76 - bh / 2;

  // pixelated glow behind it, breathing in time with the same motion
  const glow = joinable ? TITLE.tap_start_glow_red : TITLE.tap_start_glow;
  const glowScale = scale * 1.4 * (1 + Math.sin(t * 3.2) * 0.1);
  const gw = glow.w * glowScale, gh = glow.h * glowScale;
  const gx = (W - gw) / 2, gy = by + bh / 2 - gh / 2;
  const glowAlpha = 0.32 + Math.sin(t * 3.2) * 0.14;
  rend.blit(glow, gx, gy, glowScale, Math.max(0.05, glowAlpha));

  rend.blit(btn, bx, by, scale);
  titleBtnRect.x0 = bx; titleBtnRect.y0 = by;
  titleBtnRect.x1 = bx + bw; titleBtnRect.y1 = by + bh;
}

// Small status line under the button while a join attempt is in flight.
export function drawNetStatus(rend, text) {
  const w = textW(text, 1);
  drawText(rend, text, (rend.W - w) / 2 | 0, Math.round(rend.H * 0.76 + 26), 1, hex('#ffb199'));
}

export function drawDead(rend, g) {
  const a = Math.min(0.65, g.deadT * 0.5);
  rend.tint(0, 0, rend.W, rend.H, 120, 5, 5, a);
  drawText(rend, 'YOU DIED', (rend.W - textW('YOU DIED', 3)) / 2 | 0, rend.H * 0.34 | 0, 3, RED);
  if (g.deadT > 1.2)
    drawText(rend, 'TAP TO RETRY', (rend.W - textW('TAP TO RETRY', 2)) / 2 | 0, rend.H * 0.5 | 0, 2, GRY);
}

export function drawWon(rend, g) {
  const a = Math.min(0.75, g.wonT * 0.6);
  rend.tint(0, 0, rend.W, rend.H, 5, 5, 8, a);
  if (g.wonT < 0.5) return;
  const cx = txt => (rend.W - textW(txt, 2)) / 2 | 0;
  drawText(rend, 'ZONE CLEARED!', cx('ZONE CLEARED!'), rend.H * 0.26 | 0, 2, YEL);
  const mins = (g.time / 60) | 0, secs = (g.time % 60) | 0;
  const rows = [
    `KILLS  ${g.kills}/${g.totalKills}`,
    `LOOT   ${g.got}/${g.totalItems}`,
    `TIME   ${mins}:${secs < 10 ? '0' : ''}${secs}`,
  ];
  rows.forEach((r, i) =>
    drawText(rend, r, (rend.W - textW(r, 2)) / 2 | 0, (rend.H * 0.38 | 0) + i * 18, 2, GRY));
  drawText(rend, 'ZONE 2 IS BEING DUG OUT', cx(' ZONE 2 IS BEING DUG OUT') - 4, rend.H * 0.62 | 0, 1, DIM);
  if (g.wonT > 1.5)
    drawText(rend, 'TAP TO RESTART', cx('TAP TO RESTART'), rend.H * 0.72 | 0, 2, GRY);
}
