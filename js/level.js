// level.js — ZONE 1: "HANGAR 13". A pocket homage to a certain 1993 first level:
// start hangar with pillars, zigzag nukage room with an armour platform,
// computer room, open-sky courtyard with a toxic moat (chaingun on the island),
// and an exit switch behind the last door. Shoot doors to open them.
//
// Every row must be exactly 32 chars (validated at load).
// Wall chars: # tech  L tech-light  B brick  C computer  K skull  D door  X exit switch
// Floor chars: . concrete  N nukage (hurts!)
// Markers (on concrete floor): P player  g grunt  z sergeant  b brute
//   1 shotgun  2 chaingun  + medkit  a clip  e shells  v armour  o barrel

export const MAP_W = 32;

export const MAP_STR = [
  '################################',
  '################BBBBBBBBBBBBBBB#',
  '##BBBBBBB#######B.............B#',
  '##B.....B#.....#B.............B#',
  '##X.....D..a...#B..NNNNNNNNN..B#',
  '##B.....B#.....#B..NNN...NNN..B#',
  '##B.....B#.....#B..NNN.2.NNN..B#',
  '##BBBBBBB#....+#B..NNN...NNN..B#',
  '##########.....#B..NNNN.NNNN..B#',
  '#########KK..KK#B+.......e....B#',
  '##########K..K##B.............B#',
  '###########..###BBBBBDBBBBBBBBB#',
  '###.......#..#CCCCCCC.CCCCCC####',
  '###+NNNNN.#..#C............C####',
  '###.NNNNN....#C...CCC.CCCo.C####',
  '###.NNvNN....#C...CCC+CCC..C####',
  '###.NNNNN.#..#C...CCCCCCC..C####',
  '###.NNNNN.#...D....eC1.....C####',
  '###......e#..#C...CCCCCCC..C####',
  '###########..#C...CCCaCCC..C####',
  '###########.a#C.e.CCC.CCC..C####',
  '###########..#C.o..........C####',
  '###########..#CCCCCCCCCC..CC####',
  '###########..###########..######',
  '############D###########..######',
  '########+.....a....#####..######',
  '########...........#####..######',
  '########...........D......######',
  '########..L....L...#############',
  '########...........#############',
  '########...........#############',
  '########..L....L...#############',
  '########.....P...a.#############',
  '########...........#############',
  '################################',
  '################################',
];

// Enemies no longer live at fixed map letters: each room gets a fixed
// enemy roster, spawned at a randomised valid spot inside its rect at
// level-load time (see Game#spawnEnemies in game.js).
export const ENEMY_ROOMS = [
  { name: 'start',     x0: 8,  y0: 25, x1: 18, y1: 33, spawns: [['grunt', 2]] },
  { name: 'outside',   x0: 17, y0: 2,  x1: 29, y1: 10, spawns: [['grunt', 3], ['serg', 2]] },
  { name: 'connector', x0: 10, y0: 3,  x1: 14, y1: 8,  spawns: [['serg', 1]] },
  { name: 'nukage',    x0: 3,  y0: 12, x1: 9,  y1: 18, spawns: [['grunt', 1], ['serg', 1]] },
  { name: 'computer',  x0: 15, y0: 13, x1: 26, y1: 21, spawns: [['grunt', 2], ['serg', 1]],
    avoid: [{ x0: 17.5, y0: 13.5, x1: 24.5, y1: 20.5 }] }, // the block's alleys/pedestal — patrol the walkway, not the loot nooks
  { name: 'exit',      x0: 3,  y0: 3,  x1: 7,  y1: 6,  spawns: [['brute', 1], ['grunt', 2]] },
];

// Cells inside these rects get open sky instead of a ceiling.
export const SKY_RECTS = [
  { x0: 16, y0: 1, x1: 30, y1: 11 },
];

export const LEVEL_NAME = 'ZONE 1: HANGAR 13';
