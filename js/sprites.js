// sprites.js — enemy/weapon sprites are hand-drawn PNGs (assets/, loaded via
// loadSet below); pickups, fx and the HUD face are still drawn in code.
import { Pix, hex, shade, makeRng } from './px.js';
import { loadSet } from './assets.js';

const OUT = hex('#101010'); // outline colour

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
function boom(step) { // 0..2 expanding blast (barrel explosions)
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
  const br = await loadSet('assets/brute', [
    'idle_front', 'walk_front_1', 'walk_front_2', 'aim_front', 'fire_front',
    'walk_side_1', 'idle_side', 'pain_1', 'pain_2', 'die_1', 'die_2', 'die_3',
  ]);
  SPRITES.brute = {
    front: { idle: br.idle_front, walk: [br.walk_front_1, br.walk_front_2] },
    // only one side walk frame and no back art exist yet for the brute
    side: { idle: br.idle_side, walk: [br.walk_side_1, br.walk_side_1] },
    back: { idle: br.idle_front, walk: [br.idle_front, br.idle_front] },
    aim: br.aim_front, fire: br.fire_front,
    pain: [br.pain_1, br.pain_2],
    death: [br.die_1, br.die_2, br.die_3],
  };
  SPRITES.items = {
    shotgun: itemShotgun(), chaingun: itemChaingun(), medkit: itemMedkit(),
    clip: itemClip(), shells: itemShells(), armor: itemArmor(), barrel: itemBarrel(),
  };
  const fx = await loadSet('assets/fx', ['fireball', 'impact_1', 'impact_2']);
  SPRITES.fx = {
    fireball: [fx.fireball, fx.fireball],
    boom: [boom(0), boom(1), boom(2)],       // barrel explosions (still code-drawn)
    impact: [fx.impact_1, fx.impact_2],      // fireball hitting a wall/the player
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
