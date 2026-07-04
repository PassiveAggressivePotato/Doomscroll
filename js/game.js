// game.js — simulation: player, enemies, weapons, doors, pickups, barrels.
import { MAP_STR, MAP_W, SKY_RECTS, LEVEL_NAME } from './level.js';
import { SPRITES } from './sprites.js';
import * as sfx from './audio.js';

const rnd = Math.random;
const TAU = Math.PI * 2;
const wrapA = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;

export const WEAPONS = [
  { name: 'PISTOL', ammo: 'bullets', rate: 0.42, pellets: 1, dmg: () => 6 + rnd() * 8, spread: 0.012, kick: 1 },
  { name: 'SHOTGUN', ammo: 'shells', rate: 1.0, pellets: 7, dmg: () => 4 + rnd() * 6, spread: 0.075, kick: 3 },
  { name: 'CHAINGUN', ammo: 'bullets', rate: 0.135, pellets: 1, dmg: () => 6 + rnd() * 8, spread: 0.035, kick: 1 },
];

const ENEMY_TYPES = {
  grunt: { art: 'grunt', hp: 30, speed: 1.8, radius: 0.32, range: 11, cdMin: 1.0, cdMax: 2.1,
    pellets: 1, dmg: () => 3 + rnd() * 7, pain: 0.72, drops: 'clip', score: 1 },
  serg: { art: 'serg', hp: 55, speed: 2.3, radius: 0.32, range: 9, cdMin: 0.9, cdMax: 1.8,
    pellets: 3, dmg: () => 3 + rnd() * 5, pain: 0.6, drops: 'clip', score: 1 },
  brute: { art: 'brute', hp: 100, speed: 1.6, radius: 0.42, range: 14, cdMin: 1.4, cdMax: 2.4,
    projectile: true, dmg: () => 10 + rnd() * 8, pain: 0.45, drops: null, score: 1 },
};

const ITEM_DEFS = {
  shotgun: { msg: 'YOU GOT THE SHOTGUN!', big: true },
  chaingun: { msg: 'YOU GOT THE CHAINGUN!', big: true },
  medkit: { msg: 'PICKED UP A MEDKIT.' },
  clip: { msg: 'PICKED UP A CLIP.' },
  shells: { msg: 'PICKED UP SOME SHELLS.' },
  armor: { msg: 'PICKED UP THE ARMOUR!', big: true },
};

export class Game {
  constructor() {
    this.levelName = LEVEL_NAME;
    const rows = MAP_STR;
    this.h = rows.length; this.w = MAP_W;
    if (rows.some(r => r.length !== MAP_W)) throw new Error('map row length');
    this.wall = new Uint8Array(this.w * this.h);   // 0 none, else wall id
    this.texOf = [null, 'tech', 'techLight', 'brick', 'computer', 'skull', 'switchOff', 'door'];
    this.floor = [];                                // 'concrete' | 'nukage'
    this.doors = new Map();                         // idx -> door
    this.items = [];
    this.enemies = [];
    this.barrels = [];
    this.shots = [];    // brute fireballs
    this.fx = [];       // explosions
    this.corpDrops = [];
    this._cellCache = [];
    const wallId = { '#': 1, 'L': 2, 'B': 3, 'C': 4, 'K': 5, 'X': 6, 'D': 7 };
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const c = rows[y][x], i = y * this.w + x;
      if (wallId[c]) {
        this.wall[i] = wallId[c];
        if (c === 'D') this.doors.set(i, { x, y, open: 0, phase: 'closed', dwell: 0 });
      }
      this.floor[i] = c === 'N' ? 'nukage' : 'concrete';
      if (c === 'P') { this.px = x + 0.5; this.py = y + 0.5; this.angle = -Math.PI / 2; }
      if (c === 'g' || c === 'z' || c === 'b') {
        const type = c === 'g' ? 'grunt' : c === 'z' ? 'serg' : 'brute';
        const T = ENEMY_TYPES[type];
        this.enemies.push({
          type, T, x: x + 0.5, y: y + 0.5, hp: T.hp, state: 'idle', t: 0,
          moveA: rnd() * TAU, cd: 1 + rnd(), animT: rnd() * 10, repath: 0, deadT: 0,
        });
      }
      const it = { '1': 'shotgun', '2': 'chaingun', '+': 'medkit', 'a': 'clip', 'e': 'shells', 'v': 'armor' }[c];
      if (it) this.items.push({ kind: it, x: x + 0.5, y: y + 0.5 });
      if (c === 'o') this.barrels.push({ x: x + 0.5, y: y + 0.5, hp: 12, boomT: -1 });
    }
    this.sky = new Uint8Array(this.w * this.h);
    for (const r of SKY_RECTS)
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++)
        this.sky[y * this.w + x] = 1;

    // player
    this.hp = 100; this.armor = 0;
    this.bullets = 50; this.shells = 0;
    this.have = [true, false, false];
    this.weapon = 0;
    this.cool = 0; this.muzzle = 0; this.bob = 0; this.switching = 0;
    this.faceHit = 0; this.faceFire = 0; this.flashR = 0; this.flashY = 0;
    this.nukageT = 0;
    this.msg = null; this.msgT = 0;
    this.dead = false; this.deadT = 0;
    this.won = false; this.wonT = 0;
    this.time = 0;
    this.kills = 0; this.totalKills = this.enemies.length;
    this.got = 0; this.totalItems = this.items.length;
    this.shotgunFrame = 0;
  }

  // ------------------------------------------------ grid queries
  wallAt(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return { tex: 'tech' };
    const i = y * this.w + x, w = this.wall[i];
    if (!w) return 0;
    if (w === 7) return { door: this.doors.get(i) };
    if (w === 6) return { tex: this.won ? 'switchOn' : 'switchOff' };
    return { tex: this.texOf[w] };
  }
  cellInfo(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h)
      return { floor: 'concrete', ceil: 'ceil', sky: false };
    const i = y * this.w + x;
    let c = this._cellCache[i];
    if (!c) {
      c = this._cellCache[i] = {
        floor: this.floor[i],
        ceil: ((x * 7 + y * 13) % 11 === 0 && this.floor[i] === 'concrete') ? 'ceilLight' : 'ceil',
        sky: !!this.sky[i],
      };
    }
    return c;
  }
  solidAt(x, y) { // for movement
    const xi = x | 0, yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= this.w || yi >= this.h) return true;
    const i = yi * this.w + xi, w = this.wall[i];
    if (!w) return false;
    if (w === 7) return this.doors.get(i).open < 0.8;
    return true;
  }
  blockedForMove(x, y, r) {
    return this.solidAt(x - r, y - r) || this.solidAt(x + r, y - r) ||
           this.solidAt(x - r, y + r) || this.solidAt(x + r, y + r);
  }
  los(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist * 4);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.solidAt(x0 + dx * t, y0 + dy * t)) return false;
    }
    return true;
  }

  // ------------------------------------------------ combat helpers
  // Ray vs walls: returns {dist, doorIdx?, switch?} — used by hitscan.
  castWall(x, y, a) {
    const rdx = Math.cos(a), rdy = Math.sin(a);
    let mapX = x | 0, mapY = y | 0;
    const ddx = Math.abs(1 / (rdx || 1e-9)), ddy = Math.abs(1 / (rdy || 1e-9));
    let stepX, sdx, stepY, sdy, side = 0;
    if (rdx < 0) { stepX = -1; sdx = (x - mapX) * ddx; } else { stepX = 1; sdx = (mapX + 1 - x) * ddx; }
    if (rdy < 0) { stepY = -1; sdy = (y - mapY) * ddy; } else { stepY = 1; sdy = (mapY + 1 - y) * ddy; }
    for (let it = 0; it < 80; it++) {
      if (sdx < sdy) { sdx += ddx; mapX += stepX; side = 0; } else { sdy += ddy; mapY += stepY; side = 1; }
      if (mapX < 0 || mapY < 0 || mapX >= this.w || mapY >= this.h) break;
      const i = mapY * this.w + mapX, w = this.wall[i];
      if (!w) continue;
      const perp = side ? sdy - ddy : sdx - ddx;
      if (w === 7) {
        const d = this.doors.get(i);
        let wallX = side ? x + perp * rdx : y + perp * rdy;
        wallX -= wallX | 0;
        if (wallX < d.open) continue;      // through the gap
        return { dist: perp, doorIdx: i };
      }
      return { dist: perp, switch: w === 6 };
    }
    return { dist: 60 };
  }

  playerShoot() {
    const W = WEAPONS[this.weapon];
    const usesAmmo = this[W.ammo] > 0;
    if (!usesAmmo && this.weapon !== 0) { this.autoSwitch(); return; }
    if (this.weapon === 0 && !usesAmmo && this.cool > 0) return;
    this.cool = this.weapon === 0 && !usesAmmo ? 0.8 : W.rate;
    if (usesAmmo) this[W.ammo] -= 1;
    this.muzzle = 0.12 + (this.weapon === 1 ? 0.1 : 0);
    this.faceFire = 0.3;
    sfx.play(['pistol', 'shotgun', 'chaingun'][this.weapon]);
    this.noise(this.px, this.py);
    for (let p = 0; p < W.pellets; p++) {
      const a = this.angle + (rnd() * 2 - 1) * W.spread;
      this.hitscan(this.px, this.py, a, W.dmg(), true);
    }
  }

  autoSwitch() {
    if (this.have[2] && this.bullets > 0) this.weapon = 2;
    else if (this.have[1] && this.shells > 0) this.weapon = 1;
    else this.weapon = 0;
    this.switching = 0.3;
  }

  hitscan(x, y, a, dmg, fromPlayer) {
    const wallHit = this.castWall(x, y, a);
    const dx = Math.cos(a), dy = Math.sin(a);
    let best = null, bestD = wallHit.dist;
    const consider = (tgt, r) => {
      const ox = tgt.x - x, oy = tgt.y - y;
      const along = ox * dx + oy * dy;
      if (along < 0.3 || along > bestD) return;
      const perp = Math.abs(ox * dy - oy * dx);
      if (perp < r) { best = tgt; bestD = along; }
    };
    if (fromPlayer) {
      for (const e of this.enemies) if (e.state !== 'dead') consider(e, e.T.radius + 0.08);
    }
    for (const b of this.barrels) if (b.hp > 0) consider(b, 0.36);
    if (best) {
      if (best.T) this.hurtEnemy(best, dmg);
      else this.hurtBarrel(best, dmg);
      return;
    }
    if (!fromPlayer) return;
    // wall interactions: doors open, the exit switch ends the level
    if (wallHit.doorIdx !== undefined && bestD < 20) this.openDoor(wallHit.doorIdx);
    if (wallHit.switch && bestD < 6 && !this.won) {
      this.won = true; this.wonT = 0;
      sfx.play('win');
    }
  }

  hurtEnemy(e, dmg) {
    e.hp -= dmg;
    this.wake(e);
    if (e.hp <= 0) {
      e.state = 'dead'; e.deadT = 0;
      this.kills++;
      sfx.play('edie');
      if (e.T.drops) this.items.push({ kind: 'clip', x: e.x, y: e.y, small: true });
      return;
    }
    if (rnd() < e.T.pain) { e.state = 'pain'; e.t = 0.32; sfx.play('epain'); }
  }

  hurtBarrel(b, dmg) {
    b.hp -= dmg;
    if (b.hp <= 0 && b.boomT < 0) b.boomT = 0.06 + rnd() * 0.08; // fuse → chain reactions
  }

  explodeBarrel(b) {
    b.hp = 0; b.dead = true;
    this.fx.push({ x: b.x, y: b.y, t: 0, kind: 'boom', anchor: 'floor' });
    sfx.play('boom');
    this.noise(b.x, b.y);
    const blast = (tx, ty) => {
      const d = Math.hypot(tx - b.x, ty - b.y);
      return d > 1.9 ? 0 : 70 * (1 - d / 1.9) + 10;
    };
    for (const e of this.enemies)
      if (e.state !== 'dead') { const d = blast(e.x, e.y); if (d) this.hurtEnemy(e, d); }
    for (const ob of this.barrels)
      if (ob !== b && ob.hp > 0) { const d = blast(ob.x, ob.y); if (d) this.hurtBarrel(ob, d); }
    const pd = blast(this.px, this.py);
    if (pd) this.hurtPlayer(pd);
  }

  hurtPlayer(dmg) {
    if (this.dead) return;
    const absorbed = Math.min(this.armor, Math.ceil(dmg / 3));
    this.armor -= absorbed;
    this.hp -= Math.max(1, Math.round(dmg - absorbed));
    this.faceHit = 0.6;
    this.flashR = Math.min(0.55, 0.25 + dmg * 0.012);
    sfx.play('phurt');
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.deadT = 0;
      sfx.play('pdie');
    }
  }

  noise(x, y) { // gunfire & explosions wake nearby enemies
    for (const e of this.enemies) {
      if (e.state !== 'idle') continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < 6 || (d < 12 && this.los(x, y, e.x, e.y))) this.wake(e);
    }
  }
  wake(e) {
    if (e.state === 'idle') { e.state = 'chase'; e.cd = 0.5 + rnd() * 0.8; sfx.play('alert'); }
    else if (e.state === 'dead') return;
    else if (e.state === 'idle2') e.state = 'chase';
  }

  openDoor(idx) {
    const d = this.doors.get(idx);
    if (d.phase === 'closed' || d.phase === 'closing') { d.phase = 'opening'; sfx.play('door'); }
  }

  // ------------------------------------------------ per-frame update
  update(dt, input) {
    this.time += dt;
    if (this.msgT > 0) this.msgT -= dt;
    this.flashR = Math.max(0, this.flashR - dt * 1.4);
    this.flashY = Math.max(0, this.flashY - dt * 2.2);
    this.faceHit = Math.max(0, this.faceHit - dt);
    this.faceFire = Math.max(0, this.faceFire - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.cool = Math.max(0, this.cool - dt);
    this.switching = Math.max(0, this.switching - dt);

    // doors animate regardless of player state
    for (const d of this.doors.values()) {
      if (d.phase === 'opening') {
        d.open += dt * 1.6;
        if (d.open >= 1) { d.open = 1; d.phase = 'open'; d.dwell = 4; }
      } else if (d.phase === 'open') {
        const near = Math.hypot(this.px - d.x - 0.5, this.py - d.y - 0.5) < 1.1 ||
          this.enemies.some(e => e.state !== 'dead' && Math.hypot(e.x - d.x - 0.5, e.y - d.y - 0.5) < 1.1);
        if (!near) d.dwell -= dt;
        if (d.dwell <= 0) { d.phase = 'closing'; sfx.play('door'); }
      } else if (d.phase === 'closing') {
        d.open -= dt * 1.6;
        if (d.open <= 0) { d.open = 0; d.phase = 'closed'; }
      }
    }

    if (this.won) { this.wonT += dt; return; }
    if (this.dead) { this.deadT += dt; this.updateEnemies(dt, false); return; }

    // ---- movement
    const speed = 3.3, strafeSp = 3.0;
    const mv = input.move * speed * dt;
    const st = input.strafe * strafeSp * dt;
    this.angle += input.turn * 2.9 * dt;
    const ca = Math.cos(this.angle), sa = Math.sin(this.angle);
    let nx = this.px + ca * mv - sa * st;
    let ny = this.py + sa * mv + ca * st;
    const r = 0.28;
    if (!this.blockedForMove(nx, this.py, r)) this.px = nx;
    if (!this.blockedForMove(this.px, ny, r)) this.py = ny;
    const moving = Math.abs(input.move) + Math.abs(input.strafe) > 0.12;
    if (moving) this.bob += dt * (5 + 3 * Math.abs(input.move));

    // ---- weapons
    if (input.select !== null && this.have[input.select] && input.select !== this.weapon) {
      this.weapon = input.select; this.switching = 0.25; sfx.play('click');
    }
    if (input.fire && this.cool <= 0 && this.switching <= 0) this.playerShoot();

    // ---- nukage floor burns
    if (this.floor[(this.py | 0) * this.w + (this.px | 0)] === 'nukage') {
      this.nukageT -= dt;
      if (this.nukageT <= 0) { this.nukageT = 0.8; this.hurtPlayer(5); }
    } else this.nukageT = 0;

    // ---- pickups
    for (const it of this.items) {
      if (it.taken) continue;
      if (Math.hypot(it.x - this.px, it.y - this.py) > 0.55) continue;
      if (it.kind === 'medkit' && this.hp >= 100) continue;
      if (it.kind === 'clip' && this.bullets >= 200) continue;
      if (it.kind === 'shells' && this.shells >= 50) continue;
      it.taken = true;
      if (!it.small) this.got++;
      switch (it.kind) {
        case 'medkit': this.hp = Math.min(100, this.hp + 25); break;
        case 'clip': this.bullets = Math.min(200, this.bullets + (it.small ? 5 : 10)); break;
        case 'shells': this.shells = Math.min(50, this.shells + 4); break;
        case 'armor': this.armor = 100; break;
        case 'shotgun':
          this.have[1] = true; this.shells = Math.min(50, this.shells + 8);
          this.weapon = 1; this.switching = 0.35; break;
        case 'chaingun':
          this.have[2] = true; this.bullets = Math.min(200, this.bullets + 40);
          this.weapon = 2; this.switching = 0.35; break;
      }
      const def = ITEM_DEFS[it.kind];
      this.msg = def.msg; this.msgT = 2.2;
      this.flashY = def.big ? 0.4 : 0.22;
      sfx.play(def.big ? 'wpick' : 'pick');
    }

    // ---- barrels with lit fuses
    for (const b of this.barrels) {
      if (b.boomT >= 0 && !b.dead) {
        b.boomT -= dt;
        if (b.boomT <= 0) this.explodeBarrel(b);
      }
    }

    // ---- brute fireballs
    for (const s of this.shots) {
      if (s.dead) continue;
      s.t += dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (this.solidAt(s.x, s.y)) {
        s.dead = true;
        this.fx.push({ x: s.x - s.vx * dt, y: s.y - s.vy * dt, t: 0, kind: 'boomS', anchor: 'mid' });
        sfx.play('fizz');
      } else if (Math.hypot(s.x - this.px, s.y - this.py) < 0.45) {
        s.dead = true;
        this.fx.push({ x: s.x, y: s.y, t: 0, kind: 'boomS', anchor: 'mid' });
        this.hurtPlayer(10 + rnd() * 8);
      }
    }
    this.shots = this.shots.filter(s => !s.dead && s.t < 8);

    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter(f => f.t < 0.45);

    this.updateEnemies(dt, true);
  }

  updateEnemies(dt, active) {
    for (const e of this.enemies) {
      e.animT += dt;
      if (e.state === 'dead') { e.deadT += dt; continue; }
      if (!active) continue;
      const dx = this.px - e.x, dy = this.py - e.y;
      const dist = Math.hypot(dx, dy);
      const angTo = Math.atan2(dy, dx);
      e.cd -= dt;
      switch (e.state) {
        case 'idle':
          if (dist < 10 && this.los(e.x, e.y, this.px, this.py)) this.wake(e);
          break;
        case 'pain':
          e.t -= dt;
          if (e.t <= 0) e.state = 'chase';
          break;
        case 'windup':
          e.t -= dt;
          e.moveA = angTo;
          if (e.t <= 0) {
            e.state = 'shoot'; e.t = 0.32;
            // deal the damage as the muzzle flashes
            if (e.T.projectile) {
              const sp = 6.5;
              this.shots.push({ x: e.x + Math.cos(angTo) * 0.5, y: e.y + Math.sin(angTo) * 0.5,
                vx: Math.cos(angTo) * sp, vy: Math.sin(angTo) * sp, t: 0 });
              sfx.play('throw');
            } else {
              sfx.play('eshoot');
              for (let p = 0; p < e.T.pellets; p++) {
                if (!this.los(e.x, e.y, this.px, this.py)) break;
                const acc = Math.max(0.18, 0.75 - dist * 0.045);
                if (rnd() < acc) this.hurtPlayer(e.T.dmg());
              }
            }
            e.cd = e.T.cdMin + rnd() * (e.T.cdMax - e.T.cdMin);
          }
          break;
        case 'shoot':
          e.t -= dt;
          if (e.t <= 0) e.state = 'chase';
          break;
        case 'chase': {
          if (this.dead) { // stop hunting a dead player
            break;
          }
          e.repath -= dt;
          if (e.repath <= 0) {
            e.repath = 0.35 + rnd() * 0.3;
            e.moveA = angTo + (dist > 2.2 ? (rnd() - 0.5) * 1.1 : (rnd() - 0.5) * 0.35);
          }
          const sp = e.T.speed * dt;
          let ex = e.x + Math.cos(e.moveA) * sp;
          let ey = e.y + Math.sin(e.moveA) * sp;
          let bumped = false;
          if (!this.blockedForMove(ex, e.y, e.T.radius) && !this.bumpOthers(e, ex, e.y)) e.x = ex;
          else bumped = true;
          if (!this.blockedForMove(e.x, ey, e.T.radius) && !this.bumpOthers(e, e.x, ey)) e.y = ey;
          else bumped = true;
          if (bumped) e.repath = Math.min(e.repath, 0.08);
          // enemies shove doors open as they hunt you
          const fx = e.x + Math.cos(e.moveA) * 0.7, fy = e.y + Math.sin(e.moveA) * 0.7;
          const fi = (fy | 0) * this.w + (fx | 0);
          if (this.wall[fi] === 7) this.openDoor(fi);
          if (e.cd <= 0 && dist < e.T.range && this.los(e.x, e.y, this.px, this.py)) {
            e.state = 'windup'; e.t = 0.4;
          }
          break;
        }
      }
    }
  }

  bumpOthers(self, x, y) {
    for (const e of this.enemies) {
      if (e === self || e.state === 'dead') continue;
      if (Math.hypot(e.x - x, e.y - y) < e.T.radius + self.T.radius) return true;
    }
    if (Math.hypot(this.px - x, this.py - y) < 0.55) return true;
    return false;
  }

  // ------------------------------------------------ sprite list for renderer
  buildSprites() {
    const out = [];
    for (const it of this.items) {
      if (it.taken) continue;
      out.push({ x: it.x, y: it.y, pix: SPRITES.items[it.kind], anchor: 'floor', scale: 1.55 });
    }
    for (const b of this.barrels)
      if (!b.dead) out.push({ x: b.x, y: b.y, pix: SPRITES.items.barrel, anchor: 'floor', scale: 1.55 });
    for (const e of this.enemies) {
      const art = SPRITES[e.T.art];
      let pix, flip = false, bright = false;
      if (e.state === 'dead') {
        pix = e.deadT < 0.35 ? art.death[0] : art.death[1];
      } else if (e.state === 'pain') {
        pix = art.pain[e.t > 0.16 ? 0 : 1];
      } else if (e.state === 'shoot') {
        pix = art.fire; bright = e.t > 0.16;
      } else if (e.state === 'windup') {
        pix = art.aim;
      } else {
        // pick front/side/back by where the enemy is heading vs where we see it from
        const seen = Math.atan2(this.py - e.y, this.px - e.x);
        const rel = wrapA(e.moveA - seen);
        const walk = e.state === 'chase';
        const set = Math.abs(rel) < 0.8 ? art.front
          : Math.abs(rel) > 2.35 ? art.back : art.side;
        if (set === art.side) flip = rel < 0;
        pix = walk ? set.walk[(e.animT * 4 | 0) % set.walk.length] : set.idle;
      }
      out.push({ x: e.x, y: e.y, pix, flip, bright, anchor: 'floor' });
    }
    for (const s of this.shots)
      out.push({ x: s.x, y: s.y, pix: SPRITES.fx.fireball[(s.t * 10 | 0) % 2], anchor: 'mid', bright: true, scale: 1.55 });
    for (const f of this.fx) {
      const frame = Math.min(2, (f.t / 0.45 * 3) | 0);
      out.push({ x: f.x, y: f.y, pix: SPRITES.fx.boom[frame], anchor: f.anchor, bright: true, scale: 1.55 });
    }
    return out;
  }
  get sprites() { return this.buildSprites(); }
}
