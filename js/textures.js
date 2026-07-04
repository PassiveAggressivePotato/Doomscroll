// textures.js — procedural 64×64 wall/floor textures, Doom-techbase flavoured.
import { Pix, hex, shade, makeRng } from './px.js';

const TS = 64; // texture size

function base(col) {
  const p = new Pix(TS, TS);
  p.rect(0, 0, TS, TS, col);
  return p;
}

function techWall(seed, withLight) {
  const rng = makeRng(seed);
  const grey = hex('#6b6f6a'), dark = hex('#4a4d48'), darker = hex('#33352f');
  const p = base(grey);
  p.speckle(0, 0, TS, TS, dark, 0.18, rng);
  p.speckle(0, 0, TS, TS, hex('#7c8078'), 0.10, rng);
  // panel seams
  for (const y of [0, 21, 42, 63]) p.rect(0, y, TS, 1, darker);
  for (let s = 0; s < 3; s++) {
    const y0 = s * 21 + 1;
    for (const x of [0, 32]) p.rect((x + s * 16) % 64, y0, 1, 20, darker);
    // rivets
    for (const x of [4, 28, 36, 60]) {
      p.set((x + s * 16) % 64, y0 + 2, darker);
      p.set((x + s * 16) % 64, y0 + 17, darker);
    }
  }
  // vent slats mid-panel
  for (let i = 0; i < 5; i++) p.rect(38, 26 + i * 3, 18, 1, darker);
  p.rect(37, 25, 20, 1, hex('#7c8078'));
  if (withLight) {
    // recessed amber light strip
    p.rect(8, 26, 20, 12, hex('#1c1c18'));
    p.rect(10, 28, 16, 8, hex('#c98a2e'));
    p.rect(11, 29, 14, 4, hex('#f2c14e'));
    p.rect(12, 30, 8, 2, hex('#ffe89a'));
  } else {
    // hazard stencil
    p.rect(8, 27, 22, 10, darker);
    p.rect(9, 28, 20, 8, hex('#5a5d57'));
  }
  return p;
}

function brickWall(seed) {
  const rng = makeRng(seed);
  const mortar = hex('#3a2f26');
  const p = base(mortar);
  const tones = [hex('#7a5236'), hex('#6d4830'), hex('#835b3c'), hex('#5f3f2a')];
  for (let row = 0; row < 8; row++) {
    const off = row % 2 ? 8 : 0;
    for (let col = -1; col < 5; col++) {
      const bx = col * 16 + off, by = row * 8;
      const t = tones[(rng() * tones.length) | 0];
      p.rect(bx + 1, by + 1, 15, 7, t);
      p.speckle(bx + 1, by + 1, 15, 7, shade(t, 0.8), 0.25, rng);
      p.speckle(bx + 1, by + 1, 15, 7, shade(t, 1.2), 0.12, rng);
    }
  }
  return p;
}

function computerWall(seed) {
  const rng = makeRng(seed);
  const p = base(hex('#2c3134'));
  p.speckle(0, 0, TS, TS, hex('#23272a'), 0.2, rng);
  for (const y of [0, 31, 63]) p.rect(0, y, TS, 1, hex('#15181a'));
  for (const x of [0, 31]) p.rect(x, 0, 1, TS, hex('#15181a'));
  const lights = [hex('#e33'), hex('#3e5'), hex('#fc3'), hex('#3af'), hex('#e3e')];
  for (let by = 0; by < 2; by++)
    for (let bx = 0; bx < 2; bx++) {
      const ox = bx * 32, oy = by * 32;
      // screen
      p.rect(ox + 4, oy + 4, 24, 12, hex('#0a0f0a'));
      p.rect(ox + 5, oy + 5, 22, 10, hex('#0f2f18'));
      for (let i = 0; i < 6; i++)
        p.rect(ox + 6, oy + 6 + i * 1.6, 4 + ((rng() * 16) | 0), 1, hex('#37d968'));
      // light rows
      for (let r = 0; r < 2; r++)
        for (let i = 0; i < 10; i++) {
          const c = rng() < 0.5 ? lights[(rng() * lights.length) | 0] : hex('#1a1d1f');
          p.rect(ox + 4 + i * 2.4, oy + 20 + r * 5, 2, 3, c);
        }
    }
  return p;
}

function doorTex() {
  const rng = makeRng(77);
  const p = base(hex('#5a5e58'));
  p.speckle(0, 0, TS, TS, hex('#4b4f49'), 0.2, rng);
  p.speckle(0, 0, TS, TS, hex('#686c66'), 0.1, rng);
  // frame
  p.rect(0, 0, TS, 2, hex('#2c2e2a'));
  p.rect(0, 62, TS, 2, hex('#2c2e2a'));
  p.rect(0, 0, 2, TS, hex('#2c2e2a'));
  p.rect(62, 0, 2, TS, hex('#2c2e2a'));
  // hazard chevrons top & bottom
  for (const y of [6, 50]) {
    p.rect(4, y, 56, 8, hex('#141412'));
    for (let x = 0; x < 56; x += 8)
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++)
          if (((i + j) & 7) < 4) p.set(4 + x + i, y + j, hex('#d9a621'));
  }
  // central plate + handle
  p.rect(20, 22, 24, 22, hex('#4b4f49'));
  p.rect(21, 23, 22, 20, hex('#63675f'));
  p.rect(29, 30, 6, 6, hex('#2c2e2a'));
  p.rect(30, 31, 4, 4, hex('#8d9187'));
  // vertical wear streaks
  for (let i = 0; i < 10; i++) {
    const x = (rng() * 60 + 2) | 0;
    p.rect(x, 14 + ((rng() * 8) | 0), 1, (rng() * 30) | 0, hex('#4f5350'));
  }
  return p;
}

function switchWall(pressed) {
  const p = techWall(9, false);
  // switch housing
  p.rect(16, 18, 32, 30, hex('#262824'));
  p.rect(18, 20, 28, 26, hex('#55584f'));
  p.rect(20, 22, 24, 22, hex('#3a3c36'));
  // the button
  const c = pressed ? hex('#2ecf5a') : hex('#d23b2f');
  const cHi = pressed ? hex('#8cf2ab') : hex('#f28b7d');
  p.rect(24, 26, 16, 14, hex('#1a1b18'));
  p.rect(26, 28, 12, 10, c);
  p.rect(27, 29, 6, 3, cHi);
  // label strip
  p.rect(22, 44, 20, 3, pressed ? hex('#2ecf5a') : hex('#8a2d24'));
  return p;
}

function skullWall() {
  // brick with a carved warning skull — marks the exit area
  const p = brickWall(31);
  const bone = hex('#cfc7a8'), dk = hex('#8f8767');
  p.ellipse(24, 14, 16, 14, bone);
  p.rect(27, 26, 10, 6, bone);
  p.rect(27, 20, 3, 4, dk); // eye
  p.rect(34, 20, 3, 4, dk);
  p.rect(31, 24, 2, 3, dk); // nose
  for (let i = 0; i < 4; i++) p.rect(28 + i * 2, 29, 1, 3, dk); // teeth
  return p;
}

function floorConcrete(seed) {
  const rng = makeRng(seed);
  const p = base(hex('#565a52'));
  p.speckle(0, 0, TS, TS, hex('#484c45'), 0.25, rng);
  p.speckle(0, 0, TS, TS, hex('#62665d'), 0.12, rng);
  for (const y of [0, 32]) p.rect(0, y, TS, 1, hex('#3c3f39'));
  for (const x of [0, 32]) p.rect(x, 0, 1, TS, hex('#3c3f39'));
  return p;
}

function floorNukage(seed) {
  const rng = makeRng(seed);
  const p = base(hex('#1f7a23'));
  p.speckle(0, 0, TS, TS, hex('#2ba32f'), 0.3, rng);
  p.speckle(0, 0, TS, TS, hex('#155c18'), 0.25, rng);
  p.speckle(0, 0, TS, TS, hex('#66e05e'), 0.06, rng);
  // bubbles
  for (let i = 0; i < 14; i++) {
    const x = (rng() * 60) | 0, y = (rng() * 60) | 0;
    p.ellipse(x, y, 4, 3, hex('#2ba32f'));
    p.set(x + 1, y + 1, hex('#a4f09b'));
  }
  return p;
}

function ceilPanels(seed) {
  const rng = makeRng(seed);
  const p = base(hex('#43463f'));
  p.speckle(0, 0, TS, TS, hex('#393c36'), 0.2, rng);
  for (const y of [0, 16, 32, 48]) p.rect(0, y, TS, 1, hex('#2e302b'));
  for (const x of [0, 16, 32, 48]) p.rect(x, 0, 1, TS, hex('#2e302b'));
  return p;
}

function ceilLight(seed) {
  const p = ceilPanels(seed);
  p.rect(20, 20, 24, 24, hex('#26282a'));
  p.rect(22, 22, 20, 20, hex('#f4e9b0'));
  p.rect(24, 24, 16, 16, hex('#fffbe0'));
  return p;
}

// Sky: 256-wide band sampled by view angle. Burnt-orange Doom horizon.
export function makeSky() {
  const w = 512, h = 200;
  const p = new Pix(w, h);
  const rng = makeRng(404);
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const r = 30 + t * 170, g = 18 + t * 70, b = 26 + t * 30;
    for (let x = 0; x < w; x++) p.set(x, y, (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0));
  }
  // dark mountain silhouettes
  let ridge = 150;
  for (let x = 0; x < w; x++) {
    ridge += (rng() - 0.5) * 6;
    ridge = Math.max(110, Math.min(180, ridge));
    for (let y = ridge | 0; y < h; y++) {
      const f = y - ridge < 6 ? 0.9 : 1;
      p.set(x, y, shade(hex('#241a1c'), f));
    }
  }
  return p;
}

export const WALLS = {};
export const FLATS = {};

export function buildTextures() {
  WALLS.tech = techWall(1, false);
  WALLS.techLight = techWall(2, true);
  WALLS.brick = brickWall(3);
  WALLS.computer = computerWall(4);
  WALLS.door = doorTex();
  WALLS.jamb = techWall(5, false);
  WALLS.switchOff = switchWall(false);
  WALLS.switchOn = switchWall(true);
  WALLS.skull = skullWall();
  FLATS.concrete = floorConcrete(11);
  FLATS.concreteDark = floorConcrete(12).brightened(0.75);
  FLATS.nukage = floorNukage(13);
  FLATS.ceil = ceilPanels(14);
  FLATS.ceilLight = ceilLight(15);
  FLATS.sky = makeSky();
}
