// sprites.js — every sprite in the game, drawn in code in a chunky
// zombie-soldier pixel style (see /concepts). Deterministic: same art every load.
import { Pix, hex, shade, makeRng } from './px.js';

const OUT = hex('#101010'); // outline colour

// ---------------------------------------------------------------- themes
export const THEMES = {
  grunt: {
    skin: hex('#a38a5f'), skinDk: hex('#7d6845'), skinHi: hex('#bda577'),
    suit: hex('#5c6136'), suitDk: hex('#454a27'), suitHi: hex('#6e7444'),
    boot: hex('#4a3826'), eyeL: hex('#3fa9f5'), eyeR: hex('#e03a2f'),
    gun: hex('#3d3f42'), gunDk: hex('#2a2c2e'),
  },
  serg: {
    skin: hex('#8f7350'), skinDk: hex('#6b543a'), skinHi: hex('#a98c62'),
    suit: hex('#474d59'), suitDk: hex('#333842'), suitHi: hex('#59606e'),
    boot: hex('#26221e'), eyeL: hex('#e03a2f'), eyeR: hex('#e03a2f'),
    gun: hex('#2f3133'), gunDk: hex('#1e2021'),
  },
  brute: {
    skin: hex('#96412f'), skinDk: hex('#6e2d20'), skinHi: hex('#b65a41'),
    suit: hex('#4f4a2e'), suitDk: hex('#3a3620'), suitHi: hex('#5f5a3a'),
    boot: hex('#332a1e'), eyeL: hex('#ffb52e'), eyeR: hex('#ffb52e'),
    gun: 0, gunDk: 0,
  },
};

// ------------------------------------------------------- humanoid builder
// Canvas 32×46 at k=1 (brute uses k≈1.3). dir: 'front'|'back'|'side'.
// pose: 'idle'|'walk1'|'walk2'|'fire'|'pain'
function humanoid(t, dir, pose, k = 1) {
  const W = Math.round(32 * k), H = Math.round(46 * k);
  const p = new Pix(W, H);
  const R = (x, y, w, h, c) =>
    p.rect(Math.round(x * k), Math.round(y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)), c);
  const E = (x, y, w, h, c) =>
    p.ellipse(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
  const brute = t === THEMES.brute;
  const pain = pose === 'pain';
  const lean = pain ? 2 : 0; // px sideways lurch when hurt

  // ---- legs (y 28..45)
  const legW = brute ? 5 : 4;
  const hipY = 28, bootY = 42;
  let l1x = 16 - legW - 1, l2x = 17; // front stance
  let l1y = hipY, l2y = hipY, l1h = bootY - hipY, l2h = bootY - hipY;
  if (dir === 'side') { l1x = 13 - legW / 2; l2x = 16; }
  if (pose === 'walk1') {
    if (dir === 'side') { l1x = 8; l2x = 18; } else { l1y += 1; l1h -= 1; }
  } else if (pose === 'walk2') {
    if (dir === 'side') { l1x = 17; l2x = 9; } else { l2y += 1; l2h -= 1; }
  }
  R(l1x + lean, l1y, legW, l1h, t.suitDk);
  R(l2x + lean, l2y, legW, l2h, t.suit);
  // trouser wrinkles
  R(l1x + lean, l1y + 6, legW, 1, shade(t.suitDk, 0.8));
  R(l2x + lean, l2y + 6, legW, 1, shade(t.suit, 0.8));
  // boots
  R(l1x - 1 + lean, l1y + l1h, legW + (dir === 'side' ? 3 : 1), 4, t.boot);
  R(l2x + lean, l2y + l2h, legW + (dir === 'side' ? 3 : 1), 4, t.boot);

  // ---- torso (y 13..29)
  const bw = brute ? 18 : dir === 'side' ? 11 : 15;
  const bx = dir === 'side' ? 10 : 16 - bw / 2;
  const torso = brute ? t.skin : t.suit;
  const torsoDk = brute ? t.skinDk : t.suitDk;
  const torsoHi = brute ? t.skinHi : t.suitHi;
  R(bx + lean, 13, bw, 16, torso);
  R(bx + lean, 13, 2, 16, torsoDk); // side shading
  R(bx + bw - 2 + lean, 13, 2, 16, shade(torso, 0.9));
  if (!brute) {
    // jacket details
    R(bx + lean, 26, bw, 3, torsoDk);              // belt-ish hem
    R(16 - 1 + lean, 13, brute ? 0 : 1, 12, torsoDk); // zip seam (front/back)
    if (dir === 'front') {
      R(bx + 2 + lean, 16, 3, 4, torsoHi);          // chest pocket
      R(bx + bw - 5 + lean, 16, 3, 4, torsoHi);
    }
    if (dir === 'back') R(bx + 3 + lean, 15, bw - 6, 1, torsoDk); // yoke seam
    // collar
    R(16 - 4 + lean, 12, 8, 2, torsoHi);
  } else {
    // brute: bare torso muscle shading + scars
    R(16 - 5 + lean, 16, 4, 6, torsoHi);
    R(16 + 1 + lean, 16, 4, 6, torsoHi);
    R(16 - 5 + lean, 22, 10, 1, torsoDk);
    R(bx + 3 + lean, 14, 1, 8, hex('#5a1f14')); // scar
    R(16 - 8 + lean, 28, 16, 2, t.suitDk);      // trouser waist
  }

  // ---- arms + weapon
  const armC = brute ? t.skin : t.suit;
  if (pose === 'fire' && dir === 'front') {
    if (brute) {
      // hurling arm raised, fireball glow drawn by fx layer in-game
      R(bx - 3 + lean, 8, 4, 12, armC);
      R(bx - 3 + lean, 6, 4, 3, t.skinHi); // fist up
      R(bx + bw - 1 + lean, 15, 4, 10, shade(armC, 0.85));
    } else {
      // rifle levelled at the player: horizontal gun + hands
      R(6 + lean, 17, 20, 3, t.gun);
      R(6 + lean, 17, 20, 1, shade(t.gun, 1.3));
      R(14 + lean, 20, 4, 3, t.gunDk);          // mag
      R(9 + lean, 20, 3, 2, t.skin);            // hands
      R(20 + lean, 20, 3, 2, t.skin);
      // muzzle flash
      E(1 + lean, 14, 7, 8, hex('#ff9d2e'));
      E(2.5 + lean, 16, 4, 4, hex('#ffe86b'));
    }
  } else if (dir === 'side') {
    R(12 + lean, 14, 4, 10, shade(armC, 0.95));
    if (!brute) {
      // rifle held level, pointing forward (left)
      R(2, 18, 18, 2, t.gun);
      R(6, 20, 3, 3, t.gunDk);
      R(10, 20, 3, 2, t.skin);
    }
  } else {
    // idle/walk/pain, front & back: arms down, rifle across chest (front)
    R(bx - 3 + lean, 14, 4, 12, shade(armC, 0.95));
    R(bx + bw - 1 + lean, 14, 4, 12, shade(armC, 0.9));
    R(bx - 3 + lean, 25, 4, 3, t.skin);  // hands
    R(bx + bw - 1 + lean, 25, 4, 3, t.skin);
    if (!brute && dir === 'front') {
      // rifle diagonal across chest
      p.line(Math.round((bx - 1 + lean) * k), Math.round(25 * k),
             Math.round((bx + bw + 1 + lean) * k), Math.round(16 * k), t.gun);
      p.line(Math.round((bx - 1 + lean) * k), Math.round(26 * k),
             Math.round((bx + bw + 1 + lean) * k), Math.round(17 * k), t.gunDk);
    }
    if (!brute && dir === 'back') R(bx + 1 + lean, 14, 2, 12, t.gunDk); // slung barrel
  }

  // ---- head (y 2..13)
  const hw = brute ? 12 : 10;
  const hx = (dir === 'side' ? 11 : 16 - hw / 2) + lean + (pain ? 1 : 0);
  R(hx, 2, hw, 11, t.skin);
  R(hx, 2, hw, 2, t.skinDk);                    // scalp shadow
  R(hx, 2, 1, 11, t.skinDk);
  R(hx + hw - 2, 4, 2, 8, shade(t.skin, 0.9));
  if (dir === 'front') {
    // zombie face
    const ey = pain ? 7 : 6;
    R(hx + 2, ey, 2, 2, t.eyeL);
    R(hx + hw - 4, ey, 2, 2, t.eyeR);
    R(hx + 2, ey - 1, hw - 4, 1, t.skinDk);     // brow
    R(hx + 3, 10, hw - 6, pain ? 3 : 2, hex('#3a241c')); // mouth
    if (pain) R(hx + 3, 10, hw - 6, 1, hex('#e8e2c8')); // bared teeth
    R(hx + 1, 9, 1, 2, t.skinDk);               // gaunt cheeks
    R(hx + hw - 2, 9, 1, 2, t.skinDk);
    if (brute) { R(hx + 2, ey, 3, 2, t.eyeL); R(hx + hw - 5, ey, 3, 2, t.eyeR); }
  } else if (dir === 'side') {
    R(hx + hw - 1, 6, 2, 3, t.skin);            // nose
    R(hx + hw - 4, 6, 2, 2, t.eyeR);            // one eye
    R(hx + hw - 5, 10, 4, 1, hex('#3a241c'));   // mouth
  } else {
    R(hx + 2, 4, hw - 4, 6, t.skinDk);          // back of skull mottling
    R(hx + hw / 2, 4, 1, 7, shade(t.skinDk, 0.8)); // scar seam
  }
  // rot patches
  const rng = makeRng((dir.length * 31 + pose.length * 7 + (brute ? 5 : 0)) >>> 0);
  p.speckle(Math.round(hx * k), Math.round(3 * k), Math.round(hw * k), Math.round(9 * k), t.skinDk, 0.12, rng);
  p.speckle(0, Math.round(13 * k), W, Math.round(16 * k), shade(torso, 0.85), 0.08, rng);

  p.rimShade(0.72);
  p.outline(OUT);
  return p;
}

function corpseFrames(t, k = 1) {
  const W = Math.round(34 * k), H = Math.round(46 * k);
  const brute = t === THEMES.brute;
  const body = brute ? t.skin : t.suit;
  // frame 1: crumpling — knees buckled, torso pitched forward
  const f1 = new Pix(W, H);
  {
    const R = (x, y, w, h, c) => f1.rect(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
    R(10, 34, 5, 8, t.suitDk); R(18, 34, 5, 8, t.suit);       // folded legs
    R(9, 42, 7, 3, t.boot); R(18, 42, 7, 3, t.boot);
    R(9, 22, 15, 13, body); R(9, 22, 15, 2, shade(body, 1.15));
    R(11, 14, 10, 10, t.skin);                                 // slumped head
    R(13, 19, 2, 2, hex('#3a241c')); R(18, 19, 2, 2, hex('#3a241c'));
    R(12, 26, 3, 6, hex('#7a1710'));                           // chest wound
    f1.rimShade(0.72); f1.outline(OUT);
  }
  // frame 2: down — lying flat in a blood pool
  const f2 = new Pix(W, H);
  {
    const R = (x, y, w, h, c) => f2.rect(x * k, y * k, Math.max(1, w * k), Math.max(1, h * k), c);
    f2.ellipse(2 * k, 38 * k, 30 * k, 7 * k, hex('#6e120c'));
    f2.ellipse(5 * k, 39 * k, 22 * k, 5 * k, hex('#8f1a12'));
    R(4, 36, 9, 7, t.skin);                                    // head on its side
    R(6, 38, 2, 2, hex('#3a241c'));
    R(13, 36, 14, 7, body); R(13, 36, 14, 2, shade(body, 1.12));
    R(26, 37, 6, 4, t.suitDk);                                 // legs
    R(30, 37, 3, 4, t.boot);
    if (!brute) { R(15, 33, 12, 2, t.gun); }                   // dropped rifle
    f2.rimShade(0.75); f2.outline(OUT);
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
// Drawn 96×72; game scales them to sit at the bottom of the 3-D view.
const SKIN = hex('#b98f5e'), SKIN_D = hex('#8f6b42'), GLOVE = hex('#3d3428');

function fpPistol(fire) {
  const p = new Pix(96, 72);
  const cx = 48;
  const rise = fire ? 3 : 0; // recoil hop
  // slide
  p.rect(cx - 8, 18 + rise, 16, 26, hex('#464a4f'));
  p.rect(cx - 8, 18 + rise, 4, 26, hex('#5f636a'));       // left highlight
  p.rect(cx + 5, 18 + rise, 3, 26, hex('#33363a'));       // right shadow
  for (let i = 0; i < 4; i++) p.rect(cx - 7, 22 + rise + i * 3, 3, 1, hex('#2c2e31')); // serrations
  // muzzle end + front sight
  p.rect(cx - 6, 13 + rise, 12, 6, hex('#33363a'));
  p.rect(cx - 3, 14 + rise, 6, 4, hex('#1c1e20'));        // bore shadow
  p.rect(cx - 1, 10 + rise, 2, 4, hex('#5f636a'));        // sight post
  // frame + trigger guard
  p.rect(cx - 9, 44 + rise, 18, 6, hex('#2f3236'));
  p.rect(cx - 9, 44 + rise, 18, 2, hex('#43474c'));
  // gripping hands (gloved, knuckley)
  p.ellipse(cx - 18, 48, 18, 18, SKIN);
  p.ellipse(cx + 1, 48, 17, 18, SKIN_D);
  p.rect(cx - 16, 54, 32, 18, SKIN);
  p.rect(cx + 2, 54, 15, 18, SKIN_D);
  for (let i = 0; i < 4; i++) {
    p.rect(cx - 14 + i * 6, 51, 5, 4, shade(SKIN, 1.12));            // knuckles
    p.rect(cx - 14 + i * 6 + 4, 52, 1, 12, shade(SKIN, 0.7));        // finger gaps
  }
  // wrist wraps / sleeves
  p.rect(cx - 20, 66, 18, 6, hex('#5c6136'));
  p.rect(cx + 6, 66, 18, 6, hex('#4a4f2b'));
  if (fire) {
    p.ellipse(cx - 11, 0, 22, 15, hex('#ff9d2e'));
    p.ellipse(cx - 7, 2, 14, 10, hex('#ffe86b'));
    p.ellipse(cx - 4, 4, 8, 6, hex('#fffcd6'));
  }
  p.outline(OUT);
  return p;
}
function fpShotgun(fire, pump) {
  const p = new Pix(96, 72);
  const cx = 48;
  const rise = pump ? 8 : 0; // pulled back while pumping
  p.rect(cx - 12, 10 + rise, 24, 36, hex('#4b4d50'));       // fat barrel
  p.rect(cx - 12, 10 + rise, 6, 36, hex('#63666b'));
  p.rect(cx + 8, 10 + rise, 4, 36, hex('#37393d'));
  for (let i = 0; i < 5; i++) p.rect(cx - 10, 14 + rise + i * 6, 20, 1, hex('#3a3c40')); // vent ribs
  p.ellipse(cx - 12, 5 + rise, 24, 10, hex('#33363a'));      // muzzle ring
  p.ellipse(cx - 7, 7 + rise, 14, 6, hex('#131415'));        // bore
  p.rect(cx - 14, 46 + rise, 28, 11, hex('#6b4a2a'));        // pump
  p.rect(cx - 14, 46 + rise, 28, 3, hex('#7d5a36'));
  for (let i = 0; i < 6; i++) p.rect(cx - 12 + i * 5, 49 + rise, 1, 6, hex('#553a20'));
  p.ellipse(cx - 24, 50 + rise, 22, 20, SKIN);               // fore hand
  p.rect(cx - 22, 56 + rise, 28, 16, SKIN);
  for (let i = 0; i < 4; i++) p.rect(cx - 20 + i * 6, 53 + rise, 5, 4, shade(SKIN, 1.12));
  p.rect(cx + 6, 58, 24, 14, SKIN_D);                        // trigger hand
  p.rect(cx - 26, 68 + rise, 20, 4, hex('#5c6136'));         // sleeve
  p.rect(cx + 12, 70, 18, 2, hex('#4a4f2b'));
  if (fire) {
    p.ellipse(cx - 16, 0, 32, 22, hex('#ff9d2e'));
    p.ellipse(cx - 10, 2, 20, 14, hex('#ffe86b'));
    p.ellipse(cx - 5, 4, 10, 8, hex('#fffcd6'));
  }
  p.outline(OUT);
  return p;
}
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
  const dirs = {};
  for (const d of ['front', 'back', 'side']) {
    dirs[d] = {
      idle: humanoid(t, d, 'idle', k),
      walk: [humanoid(t, d, 'walk1', k), humanoid(t, d, 'walk2', k)],
    };
  }
  return {
    ...dirs,
    fire: humanoid(t, 'front', 'fire', k),
    pain: humanoid(t, 'front', 'pain', k),
    death: corpseFrames(t, k),
  };
}

export function buildSprites() {
  SPRITES.grunt = buildActor(THEMES.grunt, 1);
  SPRITES.serg = buildActor(THEMES.serg, 1);
  SPRITES.brute = buildActor(THEMES.brute, 1.3);
  SPRITES.items = {
    shotgun: itemShotgun(), chaingun: itemChaingun(), medkit: itemMedkit(),
    clip: itemClip(), shells: itemShells(), armor: itemArmor(), barrel: itemBarrel(),
  };
  SPRITES.fx = {
    fireball: [fireball(0), fireball(1)],
    boom: [boom(0), boom(1), boom(2)],
  };
  FP.pistol = { idle: fpPistol(false), fire: [fpPistol(true), fpPistol(false)] };
  FP.shotgun = {
    idle: fpShotgun(false, false),
    fire: [fpShotgun(true, false), fpShotgun(false, true), fpShotgun(false, false)],
  };
  FP.chaingun = { idle: fpChaingun(false, false), fire: [fpChaingun(true, false), fpChaingun(true, true)] };
  FACES.tiers = [];
  for (let t = 0; t < 4; t++)
    FACES.tiers.push({ idle: face(t, 'idle'), hit: face(t, 'hit'), fire: face(t, 'fire') });
  FACES.dead = face(3, 'dead');
}
