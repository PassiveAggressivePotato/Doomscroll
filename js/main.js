// main.js — boot, resize, game loop, screen states (title / play / dead / won).
import { buildTextures } from './textures.js';
import { buildSprites } from './sprites.js';
import { Renderer } from './engine.js';
import { Game } from './game.js';
import { Input } from './input.js';
import * as hud from './hud.js';
import { unlock } from './audio.js';
import * as net from './net.js';

const INTERNAL_W = 224;
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

buildTextures();
await buildSprites();
await hud.loadTitleArt();

let rend = null, back = null, backCtx = null, img = null;
let game = null;
let state = 'title';
let stateT = 0;
const input = new Input(canvas);

function resize() {
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = cw * (window.devicePixelRatio > 1.5 ? 1 : 1); // css-pixel canvas
  canvas.height = ch;
  canvas.width = cw;
  const H = Math.max(300, Math.min(560, Math.round(INTERNAL_W * ch / cw)));
  if (!rend || rend.H !== H) {
    rend = new Renderer(INTERNAL_W, H, H - hud.HUD_H);
    back = document.createElement('canvas');
    back.width = INTERNAL_W; back.height = H;
    backCtx = back.getContext('2d');
    img = backCtx.createImageData(INTERNAL_W, H);
    rend.fb = new Uint32Array(img.data.buffer);
  }
  // tell input where the HUD starts and where the ARMS grid sits (CSS px)
  const sx = cw / INTERNAL_W, sy = ch / rend.H;
  input.hudTop = rend.viewH * sy;
  const ar = hud.armsRectInternal(INTERNAL_W);
  input.armsRect = {
    x0: ar.x0 * sx, x1: ar.x1 * sx,
    y0: rend.viewH * sy, y1: ch,
  };
  const tr = hud.schemeToggleRectInternal(INTERNAL_W);
  input.schemeRect = { x0: tr.x0 * sx, x1: tr.x1 * sx, y0: tr.y0 * sy, y1: tr.y1 * sy };
  const zr = hud.zeroRectInternal(rend.H);
  input.zeroRect = { x0: zr.x0 * sx, x1: zr.x1 * sx, y0: zr.y0 * sy, y1: zr.y1 * sy };
}
window.addEventListener('resize', resize);
resize();

const cssToInt = (x, y) => [
  x / window.innerWidth * INTERNAL_W | 0,
  y / window.innerHeight * rend.H | 0,
];

function newGame(opts) {
  game = new Game(opts);
}

// ---- co-op matchmaking -----------------------------------------------------
// First player to load the page claims a fixed lobby id and becomes the
// HOST (green button); anyone after that finds it taken and becomes a
// JOINER (red button — tap to connect instead of starting a new game).
// See net.js for the whole story, including the solo fallback.
let joinRequested = false;
let awaitingSnapshot = false;

net.initNet({
  onRole() {},
  onConnected() {
    if (net.role === 'host' && game) {
      game.remote = { x: 0, y: 0, angle: 0, moving: false, dead: false, animT: 0 };
    } else if (net.role === 'join') {
      awaitingSnapshot = true;
    }
  },
  onData(msg) {
    if (net.role === 'host') {
      if (!game) return;
      if (msg.t === 'p') Object.assign(game.remote || (game.remote = { animT: 0 }), msg);
      else if (msg.t === 'fire') game.remoteFire(msg);
      else if (msg.t === 'pickup') { const it = game.items[msg.i]; if (it) it.taken = true; }
    } else if (net.role === 'join' && msg.t === 'snap') {
      if (awaitingSnapshot) {
        awaitingSnapshot = false;
        newGame({ isJoiner: true, netSend: net.send });
        game.applySnapshot(msg);
        state = 'play';
        stateT = 0;
      } else if (game) {
        game.applySnapshot(msg);
      }
    }
  },
  onDisconnected() {
    if (game) game.remote = null;
  },
});

// dev/test hook: DS.warp(x, y, angleDeg) teleports; DS.game inspects state
window.DS = {
  get game() { return game; },
  get state() { return state; },
  get stateT() { return stateT; },
  get titleBtn() { return hud.titleBtnRect; },
  get internalSize() { return rend ? [INTERNAL_W, rend.H] : null; },
  get netRole() { return net.role; },
  start() { if (state === 'title') { newGame(); state = 'play'; stateT = 0; } },
  warp(x, y, aDeg = -90) {
    if (!game) return;
    game.px = x; game.py = y; game.angle = aDeg * Math.PI / 180;
  },
};

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  stateT += dt;
  const inp = input.poll();

  if (state === 'title') {
    const joinable = net.role === 'join';
    hud.drawTitle(rend, stateT, joinable);
    if (joinable && joinRequested && !net.isPaired()) hud.drawNetStatus(rend, 'CONNECTING...');
    hud.drawSchemeToggle(rend, input.fireScheme);
    hud.drawZeroButton(rend);
    if (inp.tapped) {
      const [tx, ty] = cssToInt(input.lastX, input.lastY);
      const r = hud.titleBtnRect;
      if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) {
        unlock();
        if (joinable) {
          if (!joinRequested) { joinRequested = true; net.joinGame(); }
        } else {
          newGame();
          state = 'play';
          stateT = 0;
        }
      }
    }
  } else if (state === 'play') {
    game.update(dt, inp);
    rend.render(game);
    if (!game.dead) hud.drawWeapon(rend, game);
    hud.drawMessages(rend, game);
    if (!game.dead) hud.drawCrosshairMeter(rend, input);
    hud.drawHud(rend, game);
    hud.drawTouchUI(rend, input, cssToInt);
    hud.drawSchemeToggle(rend, input.fireScheme);
    hud.drawZeroButton(rend);
    if (game.dead) {
      hud.drawDead(rend, game);
      if (game.deadT > 1.2 && inp.tapped) { newGame(); stateT = 0; }
    } else if (game.won && game.wonT > 0.9) {
      state = 'won';
      stateT = 0;
    }
  } else if (state === 'won') {
    rend.render(game);
    hud.drawHud(rend, game);
    hud.drawWon(rend, game);
    game.wonT += dt;
    if (game.wonT > 1.5 && inp.tapped) {
      newGame();
      state = 'play';
      stateT = 0;
    }
  }

  backCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(back, 0, 0, canvas.width, canvas.height);
}
requestAnimationFrame(frame);
