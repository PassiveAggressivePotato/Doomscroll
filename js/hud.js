// hud.js — status bar (concept-styled: AMMO HEALTH ARMS FACE ARMOR + tallies),
// the first-person weapon, touch-control overlays, messages and full screens.
import { Pix, hex, shade, makeRng } from './px.js';
import { FACES, FP, SPRITES } from './sprites.js';
import { WEAPONS } from './game.js';

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
  let y = rend.viewH - pix.h * s + 10 + bobY + recoilY + g.switching * 90;
  rend.blit(pix, (rend.W - pix.w * s) / 2 + bobX + recoilX, y, s);
}

// ---- touch overlays ---------------------------------------------------------
export function drawTouchUI(rend, input, cssToInt) {
  if (input.joy) {
    const j = input.joy;
    const [x, y] = cssToInt(j.cx, j.cy);
    const [kx, ky] = cssToInt(j.cx + j.dx, j.cy + j.dy);
    circle(rend, x, y, 26, hex('#c9cec2'));
    circle(rend, x, y, 25, hex('#3a3d37'));
    circle(rend, kx, ky, 10, hex('#e8c53a'), true);
  }
  if (input.btn) {
    const [x, y] = cssToInt(input.btn.x, input.btn.y);
    circle(rend, x, y, 17, hex('#e03a2f'));
    circle(rend, x, y, 16, hex('#7a1710'));
    drawText(rend, '!', x - 1, y - 5, 2, hex('#ffd9d0'), false);
  }
  if (input.swipe && Math.abs(input.swipe.dx) > 10) {
    const dir = input.swipe.dx > 0 ? 1 : -1;
    const cx = rend.W >> 1, cy = rend.viewH + HUD_H / 2;
    for (let i = 0; i < 3; i++) {
      const x = cx + dir * (30 + i * 8);
      drawText(rend, dir > 0 ? '/' : '/', x, cy - 5, 2, YEL, false);
    }
  }
}

// ---- messages & flashes ------------------------------------------------------
export function drawMessages(rend, g) {
  if (g.msgT > 0 && g.msg) drawText(rend, g.msg, 4, 4, 1, GRY);
  drawText(rend, g.levelName, 4, rend.viewH - 8, 1, hex('#8a8e83'));
  // crosshair
  setPx(rend, rend.W >> 1, rend.viewH >> 1, hex('#d8dcd0'));
  setPx(rend, (rend.W >> 1) - 1, rend.viewH >> 1, hex('#20221e'));
  setPx(rend, (rend.W >> 1) + 1, rend.viewH >> 1, hex('#20221e'));
  if (g.flashR > 0) rend.tint(0, 0, rend.W, rend.viewH, 200, 20, 10, Math.min(0.5, g.flashR));
  if (g.flashY > 0) rend.tint(0, 0, rend.W, rend.viewH, 220, 190, 60, Math.min(0.3, g.flashY));
}

// ---- full screens -------------------------------------------------------------
export function drawTitle(rend, t) {
  const W = rend.W, H = rend.H;
  fillRect(rend, 0, 0, W, H, hex('#0d0b0a'));
  // burnt sky band
  for (let y = 0; y < H; y++) {
    const f = Math.max(0, 1 - Math.abs(y - H * 0.32) / (H * 0.32));
    if (f > 0.05) fillRect(rend, 0, y, W, 1, shade(hex('#7a1f14'), f * 0.9));
  }
  const title = 'DOOMSCROLL';
  const s = Math.min(3, ((W - 8) / (title.length * 4)) | 0);
  const tx = (W - textW(title, s)) / 2 | 0;
  drawText(rend, title, tx + 1, H * 0.18 | 0, s, hex('#5a0f08'), false);
  drawText(rend, title, tx, (H * 0.18 | 0) - 2, s, RED);
  drawText(rend, 'A RETRO NIGHTMARE', (W - textW('A RETRO NIGHTMARE', 1)) / 2 | 0, H * 0.18 + s * 6 + 6 | 0, 1, YEL);
  drawText(rend, 'FOR YOUR THUMBS', (W - textW('FOR YOUR THUMBS', 1)) / 2 | 0, H * 0.18 + s * 6 + 14 | 0, 1, YEL);
  // the welcoming committee
  const g0 = SPRITES.grunt.front.idle, z0 = SPRITES.serg.front.idle, b0 = SPRITES.brute.front.idle;
  rend.blit(g0, W / 2 - 88, H * 0.40 | 0, 1.4);
  rend.blit(b0, W / 2 - 38, H * 0.365 | 0, 1.4);
  rend.blit(z0, W / 2 + 24, H * 0.40 | 0, 1.4);
  if ((t * 1.6 | 0) % 2 === 0)
    drawText(rend, 'TAP TO START', (W - textW('TAP TO START', 2)) / 2 | 0, H * 0.72 | 0, 2, GRY);
  const tips = ['RIGHT THUMB: MOVE + TURN', 'LEFT THUMB: FIRE', 'SWIPE BOTTOM BAR: STRAFE', 'SHOOT DOORS TO OPEN THEM'];
  tips.forEach((tip, i) =>
    drawText(rend, tip, (W - textW(tip, 1)) / 2 | 0, (H * 0.80 | 0) + i * 9, 1, DIM));
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
