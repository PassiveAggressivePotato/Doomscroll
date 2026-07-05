// assets.js — loads PNG sprite frames (the hand-made reference art in
// assets/) into Pix buffers so the renderer treats them exactly like the
// code-generated sprites.
import { Pix } from './px.js';

export async function loadPix(url) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  const p = new Pix(c.width, c.height);
  p.data.set(new Uint32Array(d.data.buffer));
  return p;
}

export async function loadSet(base, names) {
  const out = {};
  await Promise.all(names.map(async n => { out[n] = await loadPix(`${base}/${n}.png`); }));
  return out;
}
