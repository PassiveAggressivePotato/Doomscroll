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
  '##B.....B#.....#B.g.......b...B#',
  '##X.....D..a...#B..NNNNNNNNN..B#',
  '##B.....B#.....#B..NNN...NNN..B#',
  '##B.....B#..b..#B..NNN.2.NNN..B#',
  '##BBBBBBB#z...+#B..NNN...NNN..B#',
  '##########.....#B..NNNN.NNNN..B#',
  '#########KK..KK#B+.......e..g.B#',
  '##########K..K##B.............B#',
  '###########..###BBBBBDBBBBBBBBB#',
  '###.......#..#CCCCCCC.CCCCCC####',
  '###+NNNNNg#..#C............C####',
  '###.NNNNN....#C..........o.C####',
  '###.NNvNN....#C..g...z.....C####',
  '###.NNNNN.#..#C............C####',
  '###zNNNNN.#...D............C####',
  '###......e#..#C...1........C####',
  '###########..#C.........g..C####',
  '###########.a#C.e..........C####',
  '###########..#C.o..........C####',
  '###########..#CCCCCCCCCC..CC####',
  '###########..###########..######',
  '############D###########..######',
  '########+.....a....#####..######',
  '########.g......g..#####..######',
  '########...........D......######',
  '########..L....L...#############',
  '########...........#############',
  '########...g.......#############',
  '########..L....L...#############',
  '########.....P...a.#############',
  '########...........#############',
  '################################',
  '################################',
];

// Cells inside these rects get open sky instead of a ceiling.
export const SKY_RECTS = [
  { x0: 16, y0: 1, x1: 30, y1: 11 },
];

export const LEVEL_NAME = 'ZONE 1: HANGAR 13';
