// Conquest rules shared by the room (which runs the game) and the browser (which draws it).
// The map, regions and card values come from the single-device Conquest in `Games`.

// One character per cell; '.' is sea. Territories that share a cell edge are neighbours;
// SEA_LANES adds the crossings over open water.
export const MAP = [
  '.................cccc.....................................',
  '........bbbb....cccccc........pp..........GHHHHHHIJJJJJJJ.',
  '..aaaaabbbbbbb..cccccc........ppptttttGGGGGHHHHHIIIJJJJJJJ',
  '..aaaaabbbbbbb..cccccc..ppp..pppptttttGGGGGHHHHHIIIJJJJJJJ',
  '.aaaaaabbbbbee...ccc.....p...pppptttttGGGGHHHHHIIIIIJJJJJJ',
  '.aaaaaaddeeeee...............pppptttttGGGGHHHHHIIIIIKKKKKK',
  '.aaaaaddddeeeeeff.......oo...rppttttuuGGGGHHHHIIIIIIKKKKKK',
  '......ddddeeeeefff.....ooo...rrrruuuuuyyyyHHHHLLLLMMKKKK..',
  '......ddddeeeeffff.....ooo.rrrrrruuuuuyyyyHHHHLLLLMM......',
  '......ddddhhhhffff......oo.rrrrrruuuuuyyyyNLLLLLLLMM..RR..',
  '......gdddhhhhhi...........rrrrrsssuuuxxyyNNLLLLLMMM..RR..',
  '.....ggggghhhhiii........qqqrrssssssuuxxxxNNNLOOOOMM..RR..',
  '.....ggggghhhiiii.......qqqqqssssssssuxxxxNNNNOOOO....RR..',
  '......gggghhiiiii.......qqqqqs..svvvvxxxNNNNNNQOO.........',
  '......ggggghiii..........qq.......vvvwxxPNNNNQQQO.........',
  '.......jjjjj............zzzzzzBBBBvvwww.PPPPQQQQQ.........',
  '.........jjj............zzzzzBBBBBwwww..PPPPPQQQ..........',
  '..........jjj...........zzzAAABBBBww.....PPP.QQ...........',
  '..........jjk...........AAAAAABBBBB.......P...............',
  '...........kkkkkk........AAAAAABBBB.......................',
  '...........kkkkkk.........AAAAAABDD...........SSSS...TTTTT',
  '............kkkk..........AACCCCDDD............SSSS...TTT.',
  '..........mmkkklllll......CCCCCDDDD.......................',
  '..........mmmmllllll......CCCCCDDD..............UUUUWWWW..',
  '..........mmmmmlllll......CCCCCDDD..FF.........UUUUUWWWWW.',
  '..........mmmmmllll........CCCEDD...FF.........UUUUVVWWWW.',
  '............mnnnll.........EEEEEE...FF.........UUUUVVVVWW.',
  '............nnnn............EEEEE...FF.........UUUVVVVVVW.',
  '............nnn.............EEE.................UVVV.VVV..',
  '............nn............................................',
];
export const COLS = MAP[0].length;
export const ROWS = MAP.length;

export const CONTINENTS = [
  { name: 'North America', bonus: 5, color: '#f2b84b' },
  { name: 'Latin America', bonus: 3, color: '#ef7b54' },
  { name: 'Europe', bonus: 5, color: '#6aa7ff' },
  { name: 'Africa', bonus: 4, color: '#c99566' },
  { name: 'Silk Road', bonus: 3, color: '#e7d36a' },
  { name: 'Siberia', bonus: 4, color: '#7fd6d0' },
  { name: 'East Asia', bonus: 5, color: '#5fcf8f' },
  { name: 'Oceania', bonus: 2, color: '#c78bff' },
];

// code, full name, map label, region
const TERRITORY_DATA = [
  ['a', 'Klondike', 'Klondike', 0], ['b', 'Arctic Isles', 'Arctic Isles', 0], ['c', 'Greenland', 'Greenland', 0],
  ['d', 'Rockies', 'Rockies', 0], ['e', 'Hudson Bay', 'Hudson Bay', 0], ['f', 'Labrador', 'Labrador', 0],
  ['g', 'Pacific Coast', 'Pacific', 0], ['h', 'Great Lakes', 'Great Lakes', 0], ['i', 'Atlantic Coast', 'Atlantic', 0],
  ['j', 'Mexico', 'Mexico', 1], ['k', 'Gran Colombia', 'Colombia', 1], ['l', 'Amazonia', 'Amazonia', 1],
  ['m', 'Andes', 'Andes', 1], ['n', 'Patagonia', 'Patagonia', 1],
  ['o', 'British Isles', 'Brit. Isles', 2], ['p', 'Nordic Lands', 'Nordic', 2], ['q', 'Iberia', 'Iberia', 2],
  ['r', 'Rhineland', 'Rhineland', 2], ['s', 'Balkans', 'Balkans', 2], ['t', 'Baltic', 'Baltic', 2], ['u', 'Muscovy', 'Muscovy', 2],
  ['v', 'Anatolia', 'Anatolia', 4], ['w', 'Arabia', 'Arabia', 4], ['x', 'Persia', 'Persia', 4], ['y', 'Turan', 'Turan', 4],
  ['z', 'Maghreb', 'Maghreb', 3], ['A', 'Sahel', 'Sahel', 3], ['B', 'Nile Valley', 'Nile', 3], ['C', 'Central Africa', 'Central Afr.', 3],
  ['D', 'Swahili Coast', 'Swahili', 3], ['E', 'The Cape', 'Cape', 3], ['F', 'Madagascar', 'Madagascar', 3],
  ['G', 'Taiga', 'Taiga', 5], ['H', 'Yenisei', 'Yenisei', 5], ['I', 'Lena Basin', 'Lena', 5], ['J', 'Chukotka', 'Chukotka', 5], ['K', 'Okhotsk', 'Okhotsk', 5],
  ['L', 'Gobi', 'Gobi', 6], ['M', 'Manchuria', 'Manchuria', 6], ['N', 'Tibet', 'Tibet', 6], ['O', 'Yangtze', 'Yangtze', 6],
  ['P', 'Hindustan', 'Hindustan', 6], ['Q', 'Indochina', 'Indochina', 6], ['R', 'Japan', 'Japan', 6],
  ['S', 'Sunda Isles', 'Sunda', 7], ['T', 'New Guinea', 'New Guinea', 7], ['U', 'Pilbara', 'Pilbara', 7], ['V', 'Outback', 'Outback', 7], ['W', 'Coral Coast', 'Coral', 7],
];
// Neighbours across open water; the first pair wraps around the edge of the map.
export const SEA_LANES = ['aJ', 'cb', 'cf', 'cp', 'po', 'or', 'oq', 'sz', 'lA', 'FD', 'FE', 'RM', 'RK', 'QS', 'ST', 'SU', 'TW'];
export const CODE_INDEX = new Map(TERRITORY_DATA.map((row, i) => [row[0], i]));
export const TERRS = TERRITORY_DATA.map(([code, name, label, cont], i) => ({ i, code, name, label, cont, adj: [], cells: [] }));
export const NT = TERRS.length;
export const cellAt = (c, r) => (r < 0 || r >= ROWS || c < 0 || c >= COLS) ? '.' : MAP[r][c];
MAP.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') TERRS[CODE_INDEX.get(ch)].cells.push([c, r]); }));
const link = (a, b) => {
  const x = CODE_INDEX.get(a);
  const y = CODE_INDEX.get(b);
  if (x !== y && !TERRS[x].adj.includes(y)) { TERRS[x].adj.push(y); TERRS[y].adj.push(x); }
};
TERRS.forEach(t => t.cells.forEach(([c, r]) => {
  for (const o of [cellAt(c + 1, r), cellAt(c, r + 1)]) if (o !== '.') link(t.code, o);
}));
SEA_LANES.forEach(([a, b]) => link(a, b));

export const START_ARMIES = { 2: 46, 3: 40, 4: 34, 5: 29, 6: 25 };
// Games are timed because an untimed game can exceed the room's message limit. Six players
// rolling single dice for 30 rounds measured up to ~2,900 moves against the 4,000 allowance.
export const ROUND_CHOICES = [10, 20, 30];
export const SYMBOLS = [
  { glyph: '▲', name: 'Shield' },
  { glyph: '◆', name: 'Banner' },
  { glyph: '●', name: 'Tower' },
  { glyph: '★', name: 'Wild' },
];
// Cards 0..NT-1 show a territory and one of three symbols; the last two are wild.
export const cardSymbol = id => id >= NT ? 3 : id % 3;
export const tradeValue = n => n < 6 ? [5, 7, 9, 11, 14, 17][n] : 17 + 3 * (n - 5);
export function isSet(ids) {
  if (ids.length !== 3) return false;
  const syms = ids.map(cardSymbol);
  return syms.includes(3) || new Set(syms).size !== 2;
}

const range = n => Array.from({ length: n }, (_, i) => i);
const randomIndex = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const rollDice = n => Array.from({ length: n }, () => 1 + randomIndex(6)).sort((a, b) => b - a);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export const countOwned = (S, pid) => S.owner.reduce((n, o) => n + (o === pid ? 1 : 0), 0);
export const totalArmies = (S, pid) => S.owner.reduce((n, o, t) => n + (o === pid ? S.armies[t] : 0), 0);
export function contHolder(S, ci) {
  const ts = TERRS.filter(t => t.cont === ci);
  const o = S.owner[ts[0].i];
  return ts.every(t => S.owner[t.i] === o) ? o : -1;
}
export function reinforcementsFor(S, pid) {
  const base = Math.max(3, Math.floor(countOwned(S, pid) / 3));
  const conts = CONTINENTS.map((_, ci) => ci).filter(ci => contHolder(S, ci) === pid);
  const bonus = conts.reduce((n, ci) => n + CONTINENTS[ci].bonus, 0);
  return { base, bonus, conts, total: base + bonus };
}
// Territories reachable from `src` through the owner's own territories.
export function reachable(S, src) {
  const pid = S.owner[src];
  const seen = new Set([src]);
  const stack = [src];
  while (stack.length) {
    const t = stack.pop();
    for (const o of TERRS[t].adj) if (!seen.has(o) && S.owner[o] === pid) { seen.add(o); stack.push(o); }
  }
  return seen;
}
export const canAttackFrom = (S, pid, t) => S.owner[t] === pid && S.armies[t] > 1 && TERRS[t].adj.some(o => S.owner[o] !== pid);
export const canFortifyFrom = (S, pid, t) => S.owner[t] === pid && S.armies[t] > 1 && TERRS[t].adj.some(o => S.owner[o] === pid);
export const mustTrade = (hand) => hand.length >= 5;

// The set the player should trade: prefer a card showing a territory they own, spend wilds last.
export function bestSet(owner, pid, hand) {
  let best = null;
  let bestScore = -Infinity;
  for (let a = 0; a < hand.length; a++) {
    for (let b = a + 1; b < hand.length; b++) {
      for (let c = b + 1; c < hand.length; c++) {
        const ids = [hand[a], hand[b], hand[c]];
        if (!isSet(ids)) continue;
        const score = (ids.some(id => id < NT && owner[id] === pid) ? 3 : 0) - 5 * ids.filter(id => id >= NT).length;
        if (score > bestScore) { bestScore = score; best = ids; }
      }
    }
  }
  return best;
}

// Log entries mark players as @pid so each browser can show names (and "You").
function log(S, text, pid = -1) {
  S.log.push({ text, pid });
  if (S.log.length > 60) S.log.splice(0, S.log.length - 60);
}

export function makeConquest(seats, options = {}) {
  const n = seats.length;
  const rounds = ROUND_CHOICES.includes(options.rounds) ? options.rounds : 20;
  const S = {
    seats: [...seats],
    players: seats.map(() => ({ alive: true, cards: [], pool: 0, deploy: null })),
    owner: Array(NT).fill(-1),
    armies: Array(NT).fill(0),
    cur: 0, phase: 'setup', turn: 0, round: 1, rounds,
    reinforce: 0, trades: 0, conquered: false, pending: null, elimTrade: false, returnToAttack: false,
    lastRoll: null, fortified: null,
    deck: shuffle(range(NT + 2)), discard: [],
    log: [], over: null,
  };
  // Territories are dealt round-robin from a shuffled list, one army on each.
  shuffle(range(NT)).forEach((t, k) => { S.owner[t] = k % n; S.armies[t] = 1; });
  S.players.forEach((p, pid) => { p.pool = START_ARMIES[n] - countOwned(S, pid); });
  log(S, 'Territories dealt. Everyone places their starting armies at the same time.');
  return S;
}

function startTurn(S, pid) {
  S.cur = pid;
  S.phase = 'reinforce';
  S.turn++;
  S.conquered = false;
  S.returnToAttack = false;
  S.pending = null;
  S.lastRoll = null;
  S.fortified = null;
  const r = reinforcementsFor(S, pid);
  S.reinforce = r.total;
  const conts = r.conts.length ? ` + ${r.bonus} for ${r.conts.map(ci => CONTINENTS[ci].name).join(', ')}` : '';
  log(S, `@${pid} receives ${r.total} armies (${r.base} for territories${conts}).`, pid);
}

// Checks a {territory: armies} placement against the player's territories and total.
function placement(S, pid, place, total) {
  if (!place || typeof place !== 'object' || Array.isArray(place)) return null;
  const out = [];
  let sum = 0;
  for (const [key, n] of Object.entries(place)) {
    const t = Number(key);
    if (!isInt(t, 0, NT - 1) || S.owner[t] !== pid || !isInt(n, 1, 999)) return null;
    out.push([t, n]);
    sum += n;
  }
  return sum === total ? out : null;
}

function deploy(S, pid, place) {
  const p = S.players[pid];
  if (p.deploy) return false;
  const list = placement(S, pid, place, p.pool);
  if (!list) return false;
  p.deploy = list;
  // Deployments stay hidden until everyone has placed, then all land at once.
  if (S.players.every(q => q.deploy)) {
    S.players.forEach(q => {
      for (const [t, n] of q.deploy) S.armies[t] += n;
      q.pool = 0;
      q.deploy = null;
    });
    log(S, 'All armies are deployed. The war begins.');
    startTurn(S, 0);
  }
  return true;
}

function trade(S, pid, cards) {
  const hand = S.players[pid].cards;
  if (!Array.isArray(cards) || cards.length !== 3 || new Set(cards).size !== 3 || !cards.every(id => hand.includes(id)) || !isSet(cards)) return false;
  const value = tradeValue(S.trades++);
  S.reinforce += value;
  for (const id of cards) hand.splice(hand.indexOf(id), 1);
  S.discard.push(...cards);
  const bonus = cards.find(id => id < NT && S.owner[id] === pid);
  let extra = '';
  if (bonus !== undefined) {
    S.armies[bonus] += 3;
    extra = ` and +3 on ${TERRS[bonus].name}`;
  }
  log(S, `@${pid} traded cards for ${value} armies${extra}.`, pid);
  return true;
}

function reinforce(S, pid, place) {
  if (mustTrade(S.players[pid].cards)) return false;
  const list = S.reinforce === 0 && (!place || !Object.keys(place).length) ? [] : placement(S, pid, place, S.reinforce);
  if (!list) return false;
  for (const [t, n] of list) S.armies[t] += n;
  if (list.length) log(S, `@${pid} reinforced ${list.map(([t, n]) => `${TERRS[t].name} +${n}`).join(', ')}.`, pid);
  S.reinforce = 0;
  S.returnToAttack = false;
  S.phase = 'attack';
  return true;
}

function attack(S, pid, { from, to, dice, blitz: rawBlitz }) {
  const blitz = rawBlitz === true;
  if (S.pending || !isInt(from, 0, NT - 1) || !isInt(to, 0, NT - 1)) return false;
  if (S.owner[from] !== pid || S.owner[to] === pid || S.armies[from] < 2 || !TERRS[from].adj.includes(to)) return false;
  if (!blitz && !isInt(dice, 1, 3)) return false;
  const defender = S.owner[to];
  let lostA = 0;
  let lostD = 0;
  let rounds = 0;
  let last = null;
  do {
    const n = Math.min(blitz ? 3 : dice, S.armies[from] - 1);
    const a = rollDice(n);
    const d = rollDice(Math.min(2, S.armies[to]));
    for (let i = 0; i < Math.min(a.length, d.length); i++) {
      if (a[i] > d[i]) { S.armies[to]--; lostD++; } else { S.armies[from]--; lostA++; }
    }
    rounds++;
    last = { a, d, n };
  } while (blitz && S.armies[to] > 0 && S.armies[from] > 1);
  S.lastRoll = { a: last.a, d: last.d, lostA, lostD, rounds, blitz, from, to, by: pid };
  if (S.armies[to] > 0) {
    log(S, `@${pid} ${blitz ? `blitzed ${rounds} round${rounds === 1 ? '' : 's'} at` : 'attacked'} ${TERRS[to].name} (@${defender}) from ${TERRS[from].name}: lost ${lostA}, destroyed ${lostD}.`, pid);
    return true;
  }
  S.owner[to] = pid;
  S.conquered = true;
  log(S, `@${pid} conquered ${TERRS[to].name} from @${defender} (lost ${lostA}, destroyed ${lostD}).`, pid);
  if (countOwned(S, defender) === 0) {
    const taken = S.players[defender].cards.splice(0);
    S.players[defender].alive = false;
    S.players[pid].cards.push(...taken);
    log(S, `@${defender} has been eliminated. @${pid} takes ${taken.length} card${taken.length === 1 ? '' : 's'}.`, pid);
    if (S.players[pid].cards.length >= 6) S.elimTrade = true;
  }
  const max = S.armies[from] - 1;
  S.pending = { from, to, min: Math.min(last.n, max), max };
  if (countOwned(S, pid) === NT) {
    occupy(S, max);
    finish(S, 'world');
  } else if (S.pending.min === S.pending.max) {
    occupy(S, max);
  }
  return true;
}

function occupy(S, n) {
  const { from, to } = S.pending;
  S.armies[from] -= n;
  S.armies[to] += n;
  S.pending = null;
  if (S.elimTrade && !S.over) {
    // Taking a big hand forces a trade before attacking again.
    S.elimTrade = false;
    S.phase = 'reinforce';
    S.returnToAttack = true;
    S.reinforce = 0;
    log(S, `@${S.cur} must trade cards before attacking again.`, S.cur);
  }
}

function endTurn(S) {
  const pid = S.cur;
  if (S.conquered) {
    if (!S.deck.length && S.discard.length) { S.deck = shuffle(S.discard); S.discard = []; }
    if (S.deck.length) {
      S.players[pid].cards.push(S.deck.pop());
      log(S, `@${pid} earned a card.`, pid);
    }
  }
  const n = S.players.length;
  let next = pid;
  for (let k = 1; k <= n; k++) {
    const q = (pid + k) % n;
    if (S.players[q].alive) { next = q; break; }
  }
  // A new round starts whenever play wraps past the first seat.
  if (next <= pid) S.round++;
  if (S.round > S.rounds) return finish(S, 'time');
  startTurn(S, next);
}

// Ranking for a timed finish: territories, then armies on the map, then seat order.
export function standings(S) {
  return range(S.players.length).sort((a, b) =>
    (S.players[b].alive - S.players[a].alive) || countOwned(S, b) - countOwned(S, a) || totalArmies(S, b) - totalArmies(S, a) || a - b);
}

function finish(S, reason) {
  const winner = reason === 'world' ? S.cur : standings(S)[0];
  S.over = { winner, reason };
  S.phase = 'over';
  S.pending = null;
  const text = {
    world: `@${winner} conquers the world in ${S.turn} turns.`,
    time: `Time is up after ${S.rounds} rounds. @${winner} holds the most territory.`,
    limit: `The room reached its move limit. @${winner} holds the most territory.`,
  }[reason];
  log(S, text, winner);
}

// Ends the game now, scored as if time ran out. The room calls this at its move limit.
export function endConquest(S) {
  if (S.over) return;
  if (S.pending) occupy(S, S.pending.min);
  finish(S, 'limit');
}

function act(S, pid, move) {
  const { action } = move;
  if (S.phase === 'setup') return action === 'deploy' && deploy(S, pid, move.place);
  if (pid !== S.cur) return false;
  switch (S.phase) {
    case 'reinforce':
      if (action === 'trade') return trade(S, pid, move.cards);
      if (action === 'reinforce') return reinforce(S, pid, move.place);
      return false;
    case 'attack':
      if (action === 'attack') return attack(S, pid, move);
      if (action === 'move') {
        if (!S.pending || !isInt(move.n, S.pending.min, S.pending.max)) return false;
        occupy(S, move.n);
        return true;
      }
      if (action === 'endAttack' && !S.pending) { S.phase = 'fortify'; return true; }
      if (action === 'endTurn' && !S.pending) { endTurn(S); return true; }
      return false;
    case 'fortify':
      if (action === 'endTurn') { endTurn(S); return true; }
      if (action === 'fortify') {
        const { from, to, n } = move;
        if (!isInt(from, 0, NT - 1) || !isInt(to, 0, NT - 1) || from === to || S.owner[from] !== pid) return false;
        if (!isInt(n, 1, S.armies[from] - 1) || !reachable(S, from).has(to)) return false;
        S.armies[from] -= n;
        S.armies[to] += n;
        log(S, `@${pid} moved ${n} from ${TERRS[from].name} to ${TERRS[to].name}.`, pid);
        S.fortified = { from, to };
        endTurn(S);
        return true;
      }
      return false;
    default:
      return false;
  }
}

export function applyConquest(S, seat, move) {
  const pid = S.seats.indexOf(seat);
  if (pid < 0 || S.over || !move || typeof move !== 'object' || !S.players[pid].alive) return false;
  return act(S, pid, move);
}

// Each seat sees the whole map but only its own cards and its own unrevealed deployment.
export function conquestView(S, seat) {
  const me = S.seats.indexOf(seat);
  const setup = S.phase === 'setup';
  const scores = [];
  S.players.forEach((p, pid) => { scores[S.seats[pid]] = p.alive ? `${countOwned(S, pid)} territories` : 'Out'; });
  const mine = S.players[me];
  return {
    seats: S.seats,
    owner: S.owner,
    armies: S.armies,
    players: S.players.map((p, pid) => ({
      seat: S.seats[pid], alive: p.alive, cards: p.cards.length,
      terr: countOwned(S, pid), armies: totalArmies(S, pid), ready: setup && Boolean(p.deploy),
    })),
    cur: S.cur, phase: S.phase, round: S.round, rounds: S.rounds, turnNo: S.turn,
    reinforce: S.reinforce, trades: S.trades, conquered: S.conquered, pending: S.pending,
    returnToAttack: S.returnToAttack, lastRoll: S.lastRoll, fortified: S.fortified,
    deck: S.deck.length,
    log: S.log,
    over: S.over,
    me,
    hand: mine ? mine.cards : [],
    pool: mine && setup && !mine.deploy ? mine.pool : 0,
    deployed: mine?.deploy ?? null,
    turn: S.over ? null : setup ? (mine && !mine.deploy ? seat : null) : S.seats[S.cur],
    scores,
    winner: S.over ? S.seats[S.over.winner] : undefined,
  };
}
