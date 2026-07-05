// sprites.js — every sprite in the game, drawn in code in a chunky
// zombie-soldier pixel style (see concept-art/). Deterministic: same art
// every load. Enemy rig v2: modelled on the detailed reference sheets —
// 48×72 base canvas, aim/fire poses, 3-frame front walk, 2 pain frames,
// falling death.
import { Pix, hex, shade, makeRng } from './px.js';
import { loadSet } from './assets.js';

const OUT = hex('#101010'); // outline colour

// ---------------------------------------------------------------- themes
export const THEMES = {
  grunt: {
    skin: hex('#a08256'), skinDk: hex('#7a6240'), skinHi: hex('#bb9c6c'),
    rot: hex('#6b5334'), wound: hex('#b06b35'),
    suit: hex('#5b5e3d'), suitDk: hex('#454830'), suitHi: hex('#6d7049'),
    pant: hex('#525538'), pantDk: hex('#3e412a'),
    boot: hex('#59422c'), bootDk: hex('#3c2c1d'),
    eyeL: hex('#3f8fd4'), eyeR: hex('#e02a1f'),
    gun: hex('#3a3b40'), gunDk: hex('#26272b'), gunHi: hex('#54555b'),
  },
  serg: {
    skin: hex('#8f7c5e'), skinDk: hex('#6b5a42'), skinHi: hex('#a8956f'),
    rot: hex('#5d5040'), wound: hex('#9c5f38'),
    suit: hex('#494e59'), suitDk: hex('#363a44'), suitHi: hex('#5a6070'),
    pant: hex('#41454f'), pantDk: hex('#30333c'),
    boot: hex('#2c2620'), bootDk: hex('#1c1815'),
    eyeL: hex('#e02a1f'), eyeR: hex('#e02a1f'),
    gun: hex('#2f3033'), gunDk: hex('#1e1f21'), gunHi: hex('#46474b'),
  },
  brute: {
    skin: hex('#9c4530'), skinDk: hex('#713021'), skinHi: hex('#bd5f45'),
    rot: hex('#5a2418'), wound: hex('#d47a3a'),
    suit: hex('#4d4830'), suitDk: hex('#3a3622'), suitHi: hex('#5d5840'),
    pant: hex('#4d4830'), pantDk: hex('#3a3622'),
    boot: hex('#332a1e'), bootDk: hex('#221c14'),
    eyeL: hex('#ffb52e'), eyeR: hex('#ffb52e'),
    gun: 0, gunDk: 0, gunHi: 0,
  },
};

// warm muzzle-light: pushes pixels near (cx,cy) toward hot orange
function warmLight(p, cx, cy, r) {
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const c = p.get(x, y);
      if (!(c >>> 24)) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (d >= r) continue;
      const f = (1 - d / r) * 0.38;
      const cr = c & 255, cg = (c >> 8) & 255, cb = (c >> 16) & 255;
      const nr = Math.min(255, cr + (255 - cr) * f) | 0;
      const ng = Math.min(255, cg + (190 - cg) * f * 0.8) | 0;
      const nb = (cb * (1 - f * 0.5)) | 0;
      p.set(x, y, ((c & 0xff000000) | (nb << 16) | (ng << 8) | nr) >>> 0);
    }
}

// ------------------------------------------------------- humanoid builder
// Base canvas 48×72 at k=1 (brute k≈1.3). dir: 'front'|'back'|'side'.
// pose: 'idle'|'walk1'|'walk2'|'walk3'|'aim'|'fire'|'pain1'|'pain2'
function humanoid(t, dir, pose, k = 1) {
  const p = new Pix(Math.round(48 * k), Math.round(72 * k));
  const R = (x, y, w, h, c) =>
    p.rect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
  const E = (x, y, w, h, c) =>
    p.ellipse(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
  const PX = (x, y, c) => p.set(Math.round(x * k), Math.round(y * k), c);
  const LN = (x0, y0, x1, y1, c) =>
    p.line(Math.round(x0 * k), Math.round(y0 * k), Math.round(x1 * k), Math.round(y1 * k), c);
  const brute = t === THEMES.brute;
  const cx = 24;
  const rng = makeRng((dir.length * 131 + pose.length * 17 + (brute ? 5 : 0)) >>> 0);

  // ============================================================ LEGS
  const legW = brute ? 9 : 7;
  const bootC = t.boot, bootD = t.bootDk;
  function bootFront(x, y, w = legW + 3) {
    R(x, y, w, 5, bootC);
    R(x, y + 4, w, 2, bootD);          // sole
    R(x, y, w, 1, shade(bootC, 1.2));  // top edge
  }
  function legFront(x, y0, y1, c) {
    R(x, y0, legW, y1 - y0, c);
    R(x, y0, 2, y1 - y0, shade(c, 0.85));      // inner shade
    R(x, 53, legW, 1, shade(c, 0.8));          // knee crease
    if (!brute) R(x + 1, 58 + ((rng() * 3) | 0), 3, 2, t.rot); // grime patch
  }
  function legsFrontIdle() {
    legFront(cx - 9 - Math.round(legW / 4), 44, 65, t.pant);
    legFront(cx + 2 + Math.round(legW / 4) - (brute ? 2 : 0), 44, 65, shade(t.pant, 0.94));
    bootFront(cx - 12, 65);
    bootFront(cx + 2, 65);
  }
  function legsFrontWalk(f) {
    if (f === 0) {           // left leg forward, right trailing
      legFront(cx - 10, 44, 64, t.pant);
      bootFront(cx - 12, 64);
      R(cx + 3, 44, legW, 11, shade(t.pant, 0.9));
      R(cx + 5, 54, legW - 1, 9, shade(t.pant, 0.85));
      bootFront(cx + 4, 62, legW + 2);
    } else if (f === 1) {    // legs passing
      legFront(cx - 7, 44, 65, t.pant);
      bootFront(cx - 9, 65);
      R(cx + 1, 44, legW - 1, 16, shade(t.pant, 0.9));
      bootFront(cx + 0, 60, legW + 1);
    } else {                 // right leg forward
      legFront(cx + 3, 44, 64, shade(t.pant, 0.96));
      bootFront(cx + 1, 64);
      R(cx - 10, 44, legW, 11, shade(t.pant, 0.88));
      R(cx - 12, 54, legW - 1, 9, shade(t.pant, 0.83));
      bootFront(cx - 13, 62, legW + 2);
    }
  }
  function legsSide(f) { // f: -1 idle, 0/1 walk
    if (f < 0) {
      R(cx - 5, 42, 6, 23, t.pant);
      R(cx + 1, 42, 6, 22, shade(t.pant, 0.88));
      R(cx - 9, 65, 11, 5, bootC); R(cx - 9, 69, 11, 2, bootD);
      R(cx + 1, 64, 10, 5, shade(bootC, 0.9)); R(cx + 1, 68, 10, 2, bootD);
    } else if (f === 0) {  // full stride
      R(cx - 6, 42, 7, 8, t.pant);
      R(cx - 10, 49, 7, 8, t.pant);
      R(cx - 13, 56, 6, 7, t.pant);
      R(cx - 18, 62, 11, 5, bootC); R(cx - 18, 66, 11, 2, bootD);
      R(cx + 1, 42, 7, 8, shade(t.pant, 0.88));
      R(cx + 4, 49, 7, 8, shade(t.pant, 0.85));
      R(cx + 7, 55, 6, 7, shade(t.pant, 0.85));
      R(cx + 8, 60, 10, 5, shade(bootC, 0.9));  // heel raised
      R(cx + 10, 64, 9, 2, bootD);
    } else {               // legs passing
      R(cx - 4, 42, 6, 23, t.pant);
      R(cx - 8, 64, 11, 5, bootC); R(cx - 8, 68, 11, 2, bootD);
      R(cx + 1, 42, 6, 11, shade(t.pant, 0.88));
      R(cx + 3, 52, 6, 8, shade(t.pant, 0.85));
      R(cx + 4, 58, 9, 5, shade(bootC, 0.9)); R(cx + 6, 62, 8, 2, bootD);
    }
  }

  // ============================================================ TORSO
  function torsoFront(back = false) {
    const w = brute ? 26 : 20, x0 = cx - w / 2;
    if (brute) {
      R(x0, 18, w, 24, t.skin);
      R(x0, 18, 3, 24, t.skinDk);
      R(x0 + w - 3, 18, 3, 24, shade(t.skin, 0.88));
      if (!back) {
        R(cx - 10, 18, 20, 2, t.skinDk);            // traps
        R(cx - 9, 22, 8, 6, t.skinHi);              // pecs
        R(cx + 1, 22, 8, 6, t.skinHi);
        R(cx - 1, 21, 1, 9, t.skinDk);              // sternum
        R(cx - 9, 27, 18, 1, shade(t.skin, 0.8));
        for (const yy of [31, 34, 37]) R(cx - 5, yy, 10, 1, shade(t.skin, 0.82)); // abs
        R(cx - 3, 31, 2, 7, t.skinHi); R(cx + 1, 31, 2, 7, t.skinHi);
        LN(x0 + 3, 20, x0 + 4, 30, hex('#5a1f14'));  // scar
      } else {
        R(cx - 1, 20, 2, 20, t.skinDk);             // spine
        R(cx - 10, 22, 8, 6, shade(t.skin, 0.92));  // shoulder blades
        R(cx + 2, 22, 8, 6, shade(t.skin, 0.92));
      }
      R(cx - 13, 42, 26, 3, t.pantDk);               // waistband
      return;
    }
    R(x0, 20, w, 22, t.suit);
    R(x0, 19, 5, 3, t.suit); R(x0 + w - 5, 19, 5, 3, t.suit); // shoulders
    R(x0, 20, 2, 22, t.suitDk);
    R(x0 + w - 2, 20, 2, 22, shade(t.suit, 0.9));
    if (!back) {
      // collar + lapels
      R(cx - 5, 18, 10, 2, t.suitHi);
      LN(cx - 5, 19, cx - 2, 24, t.suitDk);
      LN(cx + 4, 19, cx + 1, 24, t.suitDk);
      // button placket
      R(cx - 1, 22, 1, 19, t.suitDk);
      for (const yy of [26, 32, 38]) PX(cx, yy, t.suitDk);
      // chest pockets
      R(x0 + 2, 27, 5, 4, shade(t.suit, 1.06));
      R(x0 + 2, 27, 5, 1, t.suitHi);
      R(x0 + 2, 30, 5, 1, t.suitDk);
      R(x0 + w - 7, 27, 5, 4, shade(t.suit, 1.06));
      R(x0 + w - 7, 27, 5, 1, t.suitHi);
      R(x0 + w - 7, 30, 5, 1, t.suitDk);
      // rot & wounds like the reference: orange shoulder patch, red sore
      E(x0 + 1, 21, 4, 3, t.wound);
      PX(x0 + w - 4, 34, hex('#8f1a12'));
      PX(x0 + 3, 37, t.rot);
    } else {
      R(x0 + 1, 21, w - 2, 1, t.suitDk);            // yoke seam
      E(cx - 5, 25, 10, 10, shade(t.suit, 0.74));   // big rot stain
      LN(x0 + w - 4, 19, x0 + 3, 41, t.gunDk);      // sling strap
      // slung rifle poking over the right shoulder
      R(cx + 7, 9, 3, 4, t.gunDk);
      R(cx + 6, 12, 3, 5, t.gun);
      R(cx + 5, 16, 2, 4, t.gunDk);
      PX(x0 + 4, 24, t.wound); PX(x0 + w - 6, 33, hex('#8f1a12'));
    }
    // waist + jacket skirt
    R(x0, 40, w, 2, t.suitDk);
    R(x0, 42, w, 3, shade(t.suit, 0.95));
    PX(cx, 43, t.suitDk);
  }
  function torsoSide() {
    if (brute) {
      R(cx - 8, 18, 16, 24, t.skin);
      R(cx + 5, 18, 3, 24, t.skinDk);
      R(cx - 7, 22, 5, 8, t.skinHi);                 // chest
      R(cx - 13, 42, 22, 3, t.pantDk);
      return;
    }
    R(cx - 7, 18, 14, 22, t.suit);
    R(cx - 8, 22, 1, 10, t.suit);                    // chest bulge
    R(cx + 5, 18, 2, 22, t.suitDk);                  // back shade
    R(cx - 7, 38, 14, 2, t.suitDk);
    R(cx - 7, 40, 14, 3, shade(t.suit, 0.95));       // skirt
    R(cx + 0, 31, 5, 5, shade(t.suit, 0.9));         // hip pouch
    R(cx + 0, 31, 5, 1, t.suitDk);
    E(cx - 5, 21, 4, 3, t.wound);                    // shoulder rot
    PX(cx + 2, 27, hex('#8f1a12'));
  }

  // ============================================================ HEAD
  function headFront(ox = 0, oy = 0, expr = 'calm') {
    const hw = brute ? 16 : 12;
    const x0 = cx - hw / 2 + ox;
    R(x0 + 1, 2 + oy, hw - 2, 2, shade(t.skin, 0.95)); // crown
    R(x0, 4 + oy, hw, 10, t.skin);
    R(x0 + 2, 14 + oy, hw - 4, 3, t.skin);             // jaw
    R(x0, 4 + oy, 1, 10, t.skinDk);
    R(x0 + hw - 2, 5 + oy, 2, 9, shade(t.skin, 0.88));
    R(x0 + 1, 2 + oy, hw - 2, 1, t.skinDk);            // scalp mottle
    PX(x0 + 3, 3 + oy, t.rot); PX(x0 + hw - 4, 2 + oy, t.rot);
    LN(x0 + hw - 3, 3 + oy, x0 + hw - 5, 7 + oy, t.rot); // scalp scar
    // brow
    R(x0 + 2, 7 + oy, hw - 4, 1, t.skinDk);
    // eye sockets + heterochromia
    const eyeY = 8 + oy;
    R(x0 + 3, eyeY, 3, 2, hex('#3a2f22'));
    R(x0 + hw - 6, eyeY, 3, 2, hex('#3a2f22'));
    R(x0 + 3, eyeY, 2, 2, t.eyeL);
    PX(x0 + 3, eyeY, shade(t.eyeL, 1.4));
    R(x0 + hw - 5, eyeY, 2, 2, t.eyeR);
    PX(x0 + hw - 4, eyeY, shade(t.eyeR, 1.5));
    // sunken cheeks + nose
    R(x0, 11 + oy, 1, 2, t.skinDk);
    R(x0 + hw - 1, 11 + oy, 1, 2, t.skinDk);
    R(cx - 1 + ox, 10 + oy, 2, 2, t.skinDk);
    // mouth
    const my = 13 + oy;
    if (expr === 'grimace') {
      R(x0 + 4, my, hw - 8, 2, hex('#3a241c'));
      for (let i = 0; i < hw - 8; i += 2) PX(x0 + 4 + i, my, hex('#d8d2c0'));
    } else if (expr === 'agape') {
      R(x0 + 4, my, hw - 8, 3, hex('#2c1712'));
      PX(x0 + 4, my, hex('#d8d2c0')); PX(x0 + hw - 6, my, hex('#d8d2c0'));
    } else {
      R(x0 + 4, my, hw - 8, 1, hex('#3a241c'));
      PX(x0 + 5, my, hex('#c9c3b0'));
    }
    // round the skull corners
    PX(x0, 4 + oy, 0); PX(x0 + hw - 1, 4 + oy, 0);
    PX(x0 + 1, 2 + oy, 0); PX(x0 + hw - 2, 2 + oy, 0);
    PX(x0 + hw - 4, my + 2, hex('#8f1a12'));           // blood dribble
    // neck
    R(cx - 3 + ox, 17 + oy, 6, 2, t.skin);
    R(cx + 1 + ox, 17 + oy, 2, 2, t.skinDk);
    if (brute) { // heavier brow, glowing eyes
      R(x0 + 2, 7 + oy, hw - 4, 1, shade(t.skinDk, 0.8));
      R(x0 + 2, eyeY, 3, 2, t.eyeL); R(x0 + hw - 5, eyeY, 3, 2, t.eyeR);
    }
  }
  function headSide() {
    R(cx - 6, 2, 11, 2, shade(t.skin, 0.95));
    R(cx - 7, 4, 14, 10, t.skin);
    R(cx - 6, 14, 9, 3, t.skin);                      // jaw
    R(cx + 5, 4, 2, 10, shade(t.skin, 0.88));         // back of skull
    R(cx - 9, 8, 2, 3, t.skin);                       // nose
    PX(cx - 9, 10, t.skinDk);
    R(cx - 6, 7, 4, 1, t.skinDk);                     // brow
    R(cx - 5, 8, 2, 2, t.eyeL);                       // visible eye
    PX(cx - 5, 8, shade(t.eyeL, 1.4));
    PX(cx + 6, 8, t.eyeR);                            // rear glow
    R(cx + 1, 9, 2, 3, t.skinDk);                     // ear
    R(cx - 7, 12, 4, 1, hex('#3a241c'));              // mouth
    PX(cx - 7, 13, hex('#8f1a12'));
    PX(cx - 1, 3, t.rot); LN(cx + 2, 3, cx + 4, 6, t.rot);
    R(cx - 2, 16, 5, 3, t.skin);                      // neck
  }
  function headBack() {
    const hw = brute ? 16 : 12;
    const x0 = cx - hw / 2;
    R(x0 + 1, 2, hw - 2, 2, shade(t.skin, 0.92));
    R(x0, 4, hw, 12, t.skin);
    R(x0 + 2, 16, hw - 4, 2, t.skin);
    R(x0, 4, 2, 12, t.skinDk);
    p.speckle(Math.round(x0 * k), Math.round(3 * k), Math.round(hw * k), Math.round(11 * k), t.skinDk, 0.2, rng);
    LN(x0 + 3, 4, x0 + hw - 4, 12, shade(t.skinDk, 0.8)); // scar seam
    PX(x0, 8, shade(t.eyeR, 1.4));                     // eye glow past the edge
    PX(x0, 9, t.eyeR);
    R(cx - 3, 16, 6, 3, t.skinDk);                     // neck shadow
  }

  // ============================================================ ARMS + GUN
  const armC = brute ? t.skin : t.suit;
  const armW = brute ? 6 : 4;
  function armHang(x, tone) {
    R(x, 20, armW, 8, tone);
    R(x - (x < cx ? 1 : -1), 27, armW, 8, tone);
    R(x - (x < cx ? 1 : -1), 34, armW, 1, shade(tone, 0.8));   // cuff
    R(x - (x < cx ? 1 : -1), 35, armW, 5, t.skin);             // hand
    R(x - (x < cx ? 1 : -1), 37, armW, 1, shade(t.skin, 0.8)); // knuckles
  }
  function gunIdleFront() {
    // rifle in the viewer-left hand, muzzle down-left, chunky like the ref
    LN(17, 34, 6, 57, t.gun); LN(18, 34, 7, 57, t.gun);
    LN(16, 34, 5, 57, t.gunDk); LN(16, 35, 5, 58, t.gunDk);
    LN(18, 33, 9, 51, t.gunHi);
    R(15, 31, 4, 5, t.gunDk);              // receiver
    R(16, 30, 3, 2, t.gun);                // rear sight nub
    R(10, 44, 4, 5, t.gunDk);              // mag
    PX(11, 49, t.gunDk);
    R(4, 57, 3, 3, t.gunDk);               // muzzle
  }
  function gunReadyFront() {
    R(14, 30, 20, 3, t.gun);
    R(14, 29, 20, 1, t.gunHi);
    R(18, 27, 8, 2, t.gun);                // rear sight / carry rail
    R(8, 30, 6, 2, t.gun);                 // barrel
    PX(8, 28, t.gun); PX(8, 29, t.gun);    // front sight
    PX(7, 30, t.gunDk);
    R(34, 30, 4, 3, t.gunDk);              // stock
    R(37, 29, 3, 4, t.gunDk);
    R(22, 33, 4, 5, t.gunDk);              // mag
    PX(23, 38, t.gunDk);
    R(28, 33, 3, 3, t.gunDk);              // grip
  }
  function armsReadyFront() {
    R(10, 20, armW, 6, shade(armC, 0.95));
    R(11, 25, armW, 5, shade(armC, 0.95));
    R(13, 29, 3, 3, shade(armC, 0.95));
    R(34, 20, armW, 6, shade(armC, 0.9));
    R(33, 25, armW, 5, shade(armC, 0.9));
    R(30, 29, 3, 3, shade(armC, 0.9));
    R(15, 31, 4, 3, t.skin);               // fore hand
    R(27, 32, 3, 3, t.skin);               // grip hand
  }
  function armsAimFront(fire) {
    // gun pointed straight at the viewer
    R(21, 25, 6, 14, t.gun);
    R(21, 25, 2, 14, t.gunHi);
    R(20, 18, 8, 8, t.gunDk);              // muzzle block
    R(20, 18, 8, 1, t.gunHi);
    R(21, 19, 6, 6, hex('#5a5c62'));       // muzzle ring
    R(22, 20, 4, 4, hex('#0e0f10'));       // bore
    // sleeves funnel to the centre
    R(10, 20, armW, 7, shade(armC, 0.95));
    R(12, 26, armW, 6, shade(armC, 0.95));
    R(15, 32, 3, 4, shade(armC, 0.95));
    R(34, 20, armW, 7, shade(armC, 0.9));
    R(32, 26, armW, 6, shade(armC, 0.9));
    R(29, 32, 3, 4, shade(armC, 0.9));
    // clasped hands under the muzzle
    R(17, 36, 8, 6, t.skin);
    R(24, 38, 6, 6, t.skinDk);
    for (let i = 0; i < 3; i++) PX(19 + i * 3, 39, shade(t.skin, 0.75));
    PX(18, 35, hex('#8f1a12'));            // knuckle wounds like the ref
    PX(27, 37, hex('#8f1a12'));
    if (fire) {
      // compact starburst at the muzzle
      LN(24, 11, 24, 15, hex('#ffd24a'));
      LN(17, 20, 20, 20, hex('#ffd24a'));
      LN(28, 20, 31, 20, hex('#ffd24a'));
      LN(19, 14, 21, 17, hex('#ff9d2e'));
      LN(29, 14, 27, 17, hex('#ff9d2e'));
      LN(19, 26, 21, 23, hex('#ff9d2e'));
      LN(29, 26, 27, 23, hex('#ff9d2e'));
      E(20, 16, 9, 8, hex('#ffe86b'));
      E(22, 18, 5, 4, hex('#fffdf0'));
      PX(33, 15, hex('#ffb03a')); PX(15, 24, hex('#ffb03a'));
      PX(33, 28, hex('#c8a13c'));          // ejected shell
    }
  }
  function armsGunSide() {
    // rifle level, pointing left
    R(2, 28, 16, 2, t.gun);
    R(2, 28, 16, 1, t.gunHi);
    PX(2, 26, t.gun); PX(2, 27, t.gun);    // front sight
    PX(1, 28, t.gunDk);
    R(18, 26, 10, 5, t.gun);               // receiver
    R(18, 26, 10, 1, t.gunHi);
    R(28, 27, 4, 4, t.gunDk);              // stock
    R(31, 28, 3, 3, t.gunDk);
    R(20, 31, 4, 5, t.gunDk);              // mag
    PX(21, 36, t.gunDk);
    // near arm reaching forward
    R(21, 20, 5, 5, shade(armC, 0.95));
    R(17, 24, 5, 4, shade(armC, 0.95));
    R(13, 27, 4, 3, shade(armC, 0.95));
    R(10, 29, 4, 3, t.skin);               // fore hand
    R(24, 30, 3, 3, t.skin);               // grip hand
    E(21, 20, 4, 3, t.wound);              // shoulder rot patch
  }
  function bruteArms(mode) {
    if (mode === 'aim') {         // winding up overhead
      R(cx + 11, 8, 6, 12, t.skin);
      R(cx + 12, 4, 6, 6, t.skinHi);       // fist up high
      E(cx + 10, 1, 10, 8, hex('#ff8c1e'));
      E(cx + 12, 2.5, 6, 5, hex('#ffe27a'));
      R(cx - 16, 20, 6, 14, shade(t.skin, 0.9));
      R(cx - 17, 33, 6, 5, t.skinDk);
    } else if (mode === 'fire') { // hurling forward
      R(cx + 12, 22, 10, 6, t.skin);
      R(cx + 21, 21, 5, 6, t.skinHi);      // extended fist
      E(cx + 22, 17, 9, 7, hex('#ff8c1e'));
      R(cx - 16, 20, 6, 14, shade(t.skin, 0.9));
      R(cx - 17, 33, 6, 5, t.skinDk);
    } else {
      R(cx - 17, 19, 6, 10, shade(t.skin, 0.95));
      R(cx - 18, 28, 6, 9, shade(t.skin, 0.9));
      R(cx - 18, 36, 6, 6, t.skinDk);      // fist
      R(cx + 11, 19, 6, 10, shade(t.skin, 0.9));
      R(cx + 12, 28, 6, 9, shade(t.skin, 0.85));
      R(cx + 12, 36, 6, 6, t.skinDk);
    }
  }

  // ============================================================ COMPOSE
  const pain = pose === 'pain1' || pose === 'pain2';
  if (dir === 'side') {
    legsSide(pose === 'walk1' ? 0 : pose === 'walk2' ? 1 : -1);
    torsoSide();
    headSide();
    if (!brute) armsGunSide();
    else { R(cx - 12, 20, 6, 16, shade(t.skin, 0.95)); R(cx - 13, 35, 6, 6, t.skinDk); }
  } else if (dir === 'back') {
    if (pose === 'walk1') legsFrontWalk(0);
    else if (pose === 'walk2') legsFrontWalk(2);
    else legsFrontIdle();
    torsoFront(true);
    armHang(brute ? cx - 17 : 10, shade(armC, 0.92));
    armHang(brute ? cx + 11 : 34, shade(armC, 0.88));
    headBack();
  } else {
    // front
    if (pose === 'idle' || pose === 'aim' || pose === 'fire' || pain) legsFrontIdle();
    else legsFrontWalk(pose === 'walk1' ? 0 : pose === 'walk2' ? 1 : 2);
    torsoFront(false);
    if (brute) {
      bruteArms(pose === 'aim' ? 'aim' : pose === 'fire' ? 'fire' : 'idle');
      headFront(0, 0, pose === 'fire' || pain ? 'agape' : 'calm');
    } else if (pose === 'idle') {
      armHang(10, shade(armC, 0.95));
      armHang(34, shade(armC, 0.9));
      gunIdleFront();
      headFront(0, 0, 'calm');
    } else if (pose === 'walk1' || pose === 'walk2' || pose === 'walk3') {
      gunReadyFront();
      armsReadyFront();
      headFront(0, 0, 'grimace');
    } else if (pose === 'aim' || pose === 'fire') {
      headFront(0, 0, pose === 'fire' ? 'agape' : 'calm');
      armsAimFront(pose === 'fire');
    } else if (pose === 'pain1') {
      // right hand drops the rifle low, left clutches the chest
      LN(32, 36, 41, 53, t.gun); LN(33, 36, 42, 53, t.gunDk);
      R(36, 43, 3, 4, t.gunDk);
      armHang(34, shade(armC, 0.9));
      R(10, 20, armW, 6, shade(armC, 0.95));
      R(12, 25, armW, 5, shade(armC, 0.95));
      R(17, 27, 6, 5, t.skin);             // clutching hand
      headFront(0, 0, 'grimace');
      // blood burst
      R(23, 26, 3, 7, hex('#c22417'));
      R(21, 28, 8, 3, hex('#c22417'));
      PX(28, 26, hex('#8f1a12')); PX(20, 32, hex('#8f1a12'));
      PX(25, 34, hex('#8f1a12')); PX(25, 36, hex('#8f1a12'));
    } else if (pose === 'pain2') {
      // doubled over, hand to head, gun gone
      R(10, 20, armW, 6, shade(armC, 0.95));
      R(12, 25, armW, 5, shade(armC, 0.95));
      R(16, 28, 6, 5, t.skin);
      R(33, 15, armW, 6, shade(armC, 0.9));  // arm up
      R(30, 11, armW, 5, shade(armC, 0.9));
      R(26, 8, 5, 4, t.skin);                // hand on scalp
      headFront(-2, 3, 'agape');
      R(21, 29, 3, 8, hex('#c22417'));
      R(19, 31, 8, 3, hex('#c22417'));
      PX(29, 28, hex('#8f1a12')); PX(32, 27, hex('#8f1a12'));
      PX(34, 30, hex('#8f1a12')); PX(27, 38, hex('#8f1a12'));
      PX(27, 41, hex('#8f1a12'));
    }
  }

  // grime pass
  p.speckle(0, Math.round(18 * k), p.w, Math.round(26 * k), shade(brute ? t.skin : t.suit, 0.85), 0.07, rng);
  p.speckle(0, Math.round(44 * k), p.w, Math.round(20 * k), t.pantDk, 0.07, rng);

  if (pose === 'fire' && !brute && dir === 'front')
    warmLight(p, Math.round(24 * k), Math.round(19 * k), Math.round(22 * k));

  p.rimShade(0.72);
  p.outline(OUT);
  return p;
}

// -------------------------------------------------- death frames (2)
function corpseFrames(t, k = 1) {
  const brute = t === THEMES.brute;
  const body = brute ? t.skin : t.suit;
  const W = Math.round(72 * k), H = Math.round(72 * k);

  // frame 1: blown backwards, mid-fall
  const f1 = new Pix(W, H);
  {
    const R = (x, y, w, h, c) => f1.rect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
    const PX = (x, y, c) => f1.set(Math.round(x * k), Math.round(y * k), c);
    R(12, 68, 48, 2, hex('#2e2e2c'));                    // ground shadow
    // extended leg, low left
    R(8, 46, 15, 6, t.pant);
    R(2, 44, 7, 7, t.boot); R(2, 50, 7, 2, t.bootDk);
    // hip joining leg to torso
    R(21, 45, 8, 9, shade(t.pant, 0.92));
    // bent leg tucked under
    R(22, 52, 9, 6, shade(t.pant, 0.9));
    R(19, 56, 7, 8, shade(t.pant, 0.85));
    R(15, 62, 9, 6, t.boot); R(15, 66, 9, 2, t.bootDk);
    // torso arcing down to the right
    R(27, 42, 11, 12, body);
    R(35, 45, 10, 12, shade(body, 0.94));
    R(43, 48, 9, 10, shade(body, 0.88));
    // chest wound
    R(33, 45, 4, 6, hex('#c22417'));
    R(31, 47, 8, 3, hex('#c22417'));
    PX(38, 44, hex('#8f1a12')); PX(30, 52, hex('#8f1a12'));
    PX(36, 55, hex('#8f1a12')); PX(36, 58, hex('#8f1a12'));
    // arm flung up, attached at the shoulder
    R(41, 40, 5, 9, shade(body, 0.9));
    R(42, 34, 5, 7, shade(body, 0.9));
    R(43, 30, 5, 4, t.skin);
    // head, low right, lolling
    R(50, 48, 11, 10, t.skin);
    R(50, 48, 11, 2, t.skinDk);
    PX(53, 52, t.eyeL); PX(57, 52, t.eyeR);
    R(52, 55, 6, 1, hex('#3a241c'));
    PX(58, 56, hex('#8f1a12'));
    f1.rimShade(0.75); f1.outline(OUT);
  }

  // frame 2: face-up corpse in a spreading pool
  const f2 = new Pix(W, H);
  {
    const R = (x, y, w, h, c) => f2.rect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
    const E = (x, y, w, h, c) => f2.ellipse(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
    const PX = (x, y, c) => f2.set(Math.round(x * k), Math.round(y * k), c);
    E(6, 56, 60, 15, hex('#6e120c'));
    E(13, 59, 46, 10, hex('#8f1a12'));
    PX(9, 55, hex('#6e120c')); PX(64, 60, hex('#6e120c'));
    PX(20, 70, hex('#6e120c'));
    // boots left
    R(4, 50, 9, 5, t.boot); R(4, 54, 9, 1, t.bootDk);
    R(7, 55, 9, 5, shade(t.boot, 0.9)); R(7, 59, 9, 1, t.bootDk);
    // legs
    R(13, 50, 17, 7, t.pant);
    R(13, 53, 17, 1, shade(t.pant, 0.8));
    // torso
    R(28, 46, 22, 12, body);
    R(28, 46, 22, 2, shade(body, 1.12));
    R(34, 50, 6, 6, hex('#8f1a12'));                  // soaked wound
    // arm draped forward
    R(36, 56, 13, 4, shade(body, 0.9));
    R(48, 57, 4, 3, t.skin);
    // head, right, face to camera
    R(50, 44, 12, 12, t.skin);
    R(50, 44, 12, 2, t.skinDk);
    R(50, 44, 2, 12, t.skinDk);
    PX(54, 48, t.eyeL); PX(53, 48, shade(t.eyeL, 1.3));
    PX(58, 48, t.eyeR); PX(59, 48, shade(t.eyeR, 1.3));
    R(53, 52, 6, 1, hex('#8a8f92'));                  // slack grey mouth
    PX(59, 53, hex('#8f1a12')); PX(59, 54, hex('#8f1a12'));
    f2.rimShade(0.78); f2.outline(OUT);
  }
  return [f1, f2];
}

// ---------------------------------------------------------------- items
function itemShotgun() {
  const p = new Pix(24, 12);
  p.rect(1, 4, 20, 2, hex('#4b4d50'));       // barrel
  p.rect(1, 4, 20, 1, hex('#6a6c70'));
  p.rect(5, 6, 9, 2, hex('#6b4a2a'));        // pump
  p.rect(16, 6, 7, 4, hex('#5a3c20'));       // stock
  p.rect(14, 6, 2, 3, hex('#333'));
  p.outline(OUT);
  return p;
}
function itemChaingun() {
  const p = new Pix(24, 14);
  p.rect(1, 3, 16, 2, hex('#54565a'));
  p.rect(1, 6, 16, 2, hex('#44464a'));
  p.rect(1, 9, 16, 2, hex('#54565a'));
  p.rect(0, 3, 2, 8, hex('#2c2e30'));        // muzzle plate
  p.rect(16, 2, 7, 10, hex('#3a3c40'));      // body
  p.rect(17, 4, 5, 2, hex('#e2b13c'));       // ammo feed glint
  p.outline(OUT);
  return p;
}
function itemMedkit() {
  const p = new Pix(14, 11);
  p.rect(0, 2, 14, 9, hex('#d8d5c8'));
  p.rect(0, 2, 14, 2, hex('#efece0'));
  p.rect(5, 3, 4, 7, hex('#c22c1e'));
  p.rect(3, 5, 8, 3, hex('#c22c1e'));
  p.outline(OUT);
  return p;
}
function itemClip() {
  const p = new Pix(9, 9);
  p.rect(1, 2, 6, 6, hex('#7c7052'));
  p.rect(1, 2, 6, 1, hex('#9c8f6a'));
  p.rect(2, 0, 2, 3, hex('#c8a13c'));        // peeking bullet
  p.outline(OUT);
  return p;
}
function itemShells() {
  const p = new Pix(12, 9);
  p.rect(0, 3, 12, 6, hex('#3f5a34'));
  p.rect(0, 3, 12, 1, hex('#557a46'));
  for (let i = 0; i < 4; i++) p.rect(1 + i * 3, 1, 2, 3, hex('#c22c1e'));
  p.outline(OUT);
  return p;
}
function itemArmor() {
  const p = new Pix(16, 14);
  p.rect(2, 1, 12, 11, hex('#2f7a35'));
  p.rect(2, 1, 12, 2, hex('#3f9c47'));
  p.rect(4, 3, 3, 3, hex('#1f5a24'));        // arm holes
  p.rect(9, 3, 3, 3, hex('#1f5a24'));
  p.rect(6, 6, 4, 4, hex('#7fd488'));        // buckle glint
  p.outline(OUT);
  return p;
}
function itemBarrel() {
  const p = new Pix(16, 20);
  p.rect(1, 2, 14, 17, hex('#4e5257'));
  p.rect(1, 2, 3, 17, hex('#3a3d41'));
  p.rect(12, 2, 3, 17, hex('#43464a'));
  p.ellipse(1, 0, 14, 5, hex('#5a5e63'));
  p.ellipse(3, 1, 10, 3, hex('#2f9c3a'));    // toxic goop top
  p.ellipse(5, 1.5, 4, 2, hex('#8fe08a'));
  p.rect(1, 8, 14, 2, hex('#33363a'));       // hoops
  p.rect(1, 14, 14, 2, hex('#33363a'));
  p.outline(OUT);
  return p;
}

// ------------------------------------------------------------------- fx
function fireball(phase) {
  const p = new Pix(12, 12);
  p.ellipse(1, 1, 10, 10, hex('#c92f10'));
  p.ellipse(2.5, 2.5, 7, 7, hex('#ff8c1e'));
  p.ellipse(4, 4, 4, 4, hex('#ffe27a'));
  if (phase) { p.set(1, 6, hex('#ff8c1e')); p.set(10, 4, hex('#ff8c1e')); }
  else { p.set(5, 0, hex('#ff8c1e')); p.set(6, 11, hex('#ff8c1e')); }
  return p;
}
function boom(step) { // 0..2 expanding blast
  const s = 14 + step * 10;
  const p = new Pix(s, s);
  const rng = makeRng(90 + step);
  p.ellipse(0, 0, s, s, hex('#c92f10'));
  p.ellipse(s * 0.15, s * 0.15, s * 0.7, s * 0.7, hex('#ff8c1e'));
  p.ellipse(s * 0.3, s * 0.3, s * 0.4, s * 0.4, hex('#ffe27a'));
  p.speckle(0, 0, s, s, 0, 0.15 + step * 0.15, rng); // break up edges
  return p;
}

// --------------------------------------------------- first-person weapons
// Pistol & shotgun are hand-drawn PNGs (assets/weapons/, loaded in
// buildSprites below) already sized for the internal 224px-wide canvas.
// The chaingun has no art yet, so it's still drawn in code on a 96×72 canvas.
const SKIN = hex('#b98f5e'), SKIN_D = hex('#8f6b42'), GLOVE = hex('#3d3428');

function fpChaingun(fire, spin) {
  const p = new Pix(96, 72);
  const cx = 48;
  // housing
  p.rect(cx - 22, 40, 44, 20, hex('#3a3c40'));
  p.rect(cx - 22, 40, 44, 4, hex('#4c4f54'));
  // barrels (rotate look via offset)
  const off = spin ? 3 : 0;
  for (let i = 0; i < 4; i++) {
    const bx = cx - 15 + ((i * 8 + off) % 32);
    p.rect(bx, 14, 5, 28, i % 2 ? hex('#54565a') : hex('#44464a'));
    p.rect(bx, 14, 2, 28, hex('#606368'));
    p.rect(bx, 12, 5, 3, hex('#25272a'));
  }
  p.rect(cx - 18, 34, 36, 7, hex('#2c2e30'));  // barrel clamp
  p.rect(cx - 26, 56, 24, 16, SKIN);           // hands
  p.rect(cx + 4, 56, 24, 16, SKIN_D);
  p.rect(cx - 30, 50, 8, 12, GLOVE);
  if (fire) {
    p.ellipse(cx - 14, 0, 13, 12, hex('#ffe86b'));
    p.ellipse(cx + 2, 0, 13, 12, hex('#ff9d2e'));
    p.ellipse(cx - 6, 2, 12, 10, hex('#fffcd6'));
  }
  p.outline(OUT);
  return p;
}

// -------------------------------------------------------------- HUD face
// 26×26. tier: 0 full → 3 near-death. mode: 'idle'|'hit'|'fire'|'dead'
function face(tier, mode) {
  const p = new Pix(26, 26);
  const skin = hex('#b98f5e'), skinDk = hex('#8f6b42'), skinHi = hex('#d0a874');
  const hair = hex('#6e5638'), hairDk = hex('#54401f');
  const blood = hex('#a3140c'), bloodHi = hex('#d32316');
  const dead = mode === 'dead';
  // backdrop
  p.rect(0, 0, 26, 26, hex('#1c1a17'));
  // hair mane (long sides, receding top) + head
  p.rect(3, 4, 20, 20, hair);
  p.rect(3, 4, 3, 20, hairDk);
  p.rect(20, 4, 3, 20, hairDk);
  p.rect(6, 2, 14, 4, hair);
  p.rect(6, 2, 14, 1, hairDk);
  p.rect(6, 5, 14, 12, skin);                    // face block
  p.rect(6, 5, 1, 12, skinDk);
  p.rect(19, 5, 1, 12, skinDk);
  p.rect(7, 5, 12, 2, skinHi);                   // forehead
  // beard (covers jaw)
  p.rect(5, 15, 16, 9, hair);
  p.rect(5, 15, 16, 2, hairDk);
  p.rect(7, 24, 12, 2, hairDk);
  p.rect(11, 13, 4, 3, skin);                    // philtrum gap
  // eyepatch (viewer-left eye) + strap
  p.line(4, 6, 21, 3, hex('#0d0d0d'));
  p.rect(7, 8, 6, 5, hex('#0d0d0d'));
  p.rect(7, 8, 6, 1, hex('#2b2b2b'));
  // right eye
  const eyeY = 9;
  if (dead) {
    p.rect(15, eyeY, 4, 1, hex('#0d0d0d'));      // flat closed line
  } else if (mode === 'hit') {
    p.rect(15, eyeY, 4, 2, skinDk);              // squeezed shut
    p.rect(15, eyeY + 1, 4, 1, hex('#0d0d0d'));
  } else {
    p.rect(15, eyeY - 1, 4, 1, hairDk);          // brow
    p.rect(15, eyeY, 4, 3, hex('#e8e2d0'));
    p.rect(16 + (tier > 1 ? 1 : 0), eyeY + 1, 2, 2, hex('#26303a'));
  }
  // mouth (in the philtrum gap / beard shadow)
  if (mode === 'hit' || tier >= 3) {
    p.rect(10, 16, 6, 3, hex('#3a1712'));        // grimace
    p.rect(10, 16, 6, 1, hex('#e8e2c8'));        // bared teeth
  } else if (mode === 'fire') {
    p.rect(11, 16, 4, 2, hex('#3a1712'));        // snarl
  }
  // damage build-up per tier
  const cuts = [[], [[9, 6], [17, 13]],
    [[9, 6], [17, 13], [8, 14], [14, 5], [19, 8]],
    [[9, 6], [17, 13], [8, 14], [14, 5], [19, 8], [12, 7], [16, 11], [7, 6]]][tier];
  for (const [x, y] of cuts) {
    p.rect(x, y, 1, 2, blood);
    p.set(x, y, bloodHi);
  }
  if (tier >= 2) { p.rect(13, 13, 2, 4, blood); }             // nose bleed
  if (tier >= 3) { p.rect(8, 13, 3, 1, blood); p.rect(16, 6, 3, 1, blood); }
  if (mode === 'hit') p.speckle(5, 4, 16, 12, bloodHi, 0.08, makeRng(tier + 7));
  if (dead) { p.rect(9, 7, 9, 1, blood); p.rect(14, 16, 5, 2, blood); }
  p.outline(OUT);
  return dead || mode !== 'fire' ? p : p.brightened(1.55); // firing glow
}

// ---------------------------------------------------------------- export
export const SPRITES = {};
export const FP = {};
export const FACES = {};

function buildActor(t, k) {
  return {
    front: {
      idle: humanoid(t, 'front', 'idle', k),
      walk: [humanoid(t, 'front', 'walk1', k), humanoid(t, 'front', 'walk2', k), humanoid(t, 'front', 'walk3', k)],
    },
    side: {
      idle: humanoid(t, 'side', 'idle', k),
      walk: [humanoid(t, 'side', 'walk1', k), humanoid(t, 'side', 'walk2', k)],
    },
    back: {
      idle: humanoid(t, 'back', 'idle', k),
      walk: [humanoid(t, 'back', 'walk1', k), humanoid(t, 'back', 'walk2', k)],
    },
    aim: humanoid(t, 'front', 'aim', k),
    fire: humanoid(t, 'front', 'fire', k),
    pain: [humanoid(t, 'front', 'pain1', k), humanoid(t, 'front', 'pain2', k)],
    death: corpseFrames(t, k),
  };
}

export async function buildSprites() {
  const g = await loadSet('assets/grunt', [
    'idle_front', 'walk_front_1', 'walk_front_2', 'walk_front_3',
    'aim_front', 'fire_front', 'walk_side_1', 'walk_side_2',
    'aim_side', 'idle_back', 'pain_1', 'pain_2', 'die_1', 'die_2', 'die_3', 'die_4',
  ]);
  SPRITES.grunt = {
    front: { idle: g.idle_front, walk: [g.walk_front_1, g.walk_front_2, g.walk_front_3] },
    // side art faces left in-engine; the aim_side sheet faces right, so mirror it
    side: { idle: g.aim_side.mirrored(), walk: [g.walk_side_1, g.walk_side_2] },
    back: { idle: g.idle_back, walk: [g.idle_back, g.idle_back] },
    aim: g.aim_front, fire: g.fire_front,
    pain: [g.pain_1, g.pain_2],
    death: [g.die_1, g.die_2, g.die_3, g.die_4],
  };

  const s = await loadSet('assets/serg', [
    'idle_front', 'walk_front_1', 'walk_front_2', 'aim_front', 'fire_front',
    'walk_side_1', 'walk_side_2', 'aim_side', 'idle_back',
    'pain_1', 'pain_2', 'die_1', 'die_2', 'die_3', 'die_4',
  ]);
  SPRITES.serg = {
    front: { idle: s.idle_front, walk: [s.walk_front_1, s.walk_front_2] },
    side: { idle: s.aim_side.mirrored(), walk: [s.walk_side_1, s.walk_side_2] },
    back: { idle: s.idle_back, walk: [s.idle_back, s.idle_back] },
    aim: s.aim_front, fire: s.fire_front,
    pain: [s.pain_1, s.pain_2],
    death: [s.die_1, s.die_2, s.die_3, s.die_4],
  };
  SPRITES.brute = buildActor(THEMES.brute, 1.3);
  SPRITES.items = {
    shotgun: itemShotgun(), chaingun: itemChaingun(), medkit: itemMedkit(),
    clip: itemClip(), shells: itemShells(), armor: itemArmor(), barrel: itemBarrel(),
  };
  SPRITES.fx = {
    fireball: [fireball(0), fireball(1)],
    boom: [boom(0), boom(1), boom(2)],
  };
  const w = await loadSet('assets/weapons', ['pistol_idle', 'pistol_fire', 'shotgun_idle', 'shotgun_fire']);
  FP.pistol = { idle: w.pistol_idle, fire: [w.pistol_fire] };
  FP.shotgun = { idle: w.shotgun_idle, fire: [w.shotgun_fire] };
  FP.chaingun = { idle: fpChaingun(false, false), fire: [fpChaingun(true, false), fpChaingun(true, true)] };
  FACES.tiers = [];
  for (let t = 0; t < 4; t++)
    FACES.tiers.push({ idle: face(t, 'idle'), hit: face(t, 'hit'), fire: face(t, 'fire') });
  FACES.dead = face(3, 'dead');
}
