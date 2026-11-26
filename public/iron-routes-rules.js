// Iron Routes rules, adapted from the single-device game in `Games`.
// The Durable Object owns the state. Browsers receive only ironRoutesView().

const proj = (lon, lat) => [Math.round((lon + 126) * 15.32 * 10) / 10, Math.round((52 - lat) * 20 * 10) / 10];
export { proj };

// [name, longitude, latitude, label side]
export const CITIES = {
  VAN: ['Vancouver', -123.1, 49.3, 'l'], SEA: ['Seattle', -122.3, 47.6, 'l'], SPO: ['Spokane', -117.4, 47.7, 't'],
  POR: ['Portland', -122.7, 45.5, 'l'], SFO: ['San Francisco', -122.4, 37.8, 'l'], LAX: ['Los Angeles', -118.2, 34.1, 'l'],
  SDG: ['San Diego', -117.2, 32.7, 'b'], LVS: ['Las Vegas', -115.1, 36.2, 'r'], PHX: ['Phoenix', -112.1, 33.4, 'b'],
  SLC: ['Salt Lake City', -111.9, 40.8, 'b'], BOI: ['Boise', -116.2, 43.6, 'b'], CAL: ['Calgary', -114.1, 51.0, 't'],
  BIL: ['Billings', -108.5, 45.8, 't'], DEN: ['Denver', -105.0, 39.7, 'r'], ABQ: ['Albuquerque', -106.6, 35.1, 'r'],
  ELP: ['El Paso', -106.4, 31.8, 'b'], SAT: ['San Antonio', -98.5, 29.4, 'b'], WIN: ['Winnipeg', -97.1, 49.9, 't'],
  BIS: ['Bismarck', -100.8, 46.8, 't'], OMA: ['Omaha', -95.9, 41.3, 't'], KC: ['Kansas City', -94.6, 39.1, 'b'],
  OKC: ['Oklahoma City', -97.5, 35.5, 'b'], DAL: ['Dallas', -96.8, 32.8, 'r'], HOU: ['Houston', -95.4, 29.8, 'b'],
  MIN: ['Minneapolis', -93.3, 45.0, 't'], CHI: ['Chicago', -87.6, 41.9, 't'], STL: ['St. Louis', -90.2, 38.6, 'b'],
  MEM: ['Memphis', -90.0, 35.1, 'l'], NOL: ['New Orleans', -90.1, 30.0, 'b'], ATL: ['Atlanta', -84.4, 33.7, 'b'],
  NAS: ['Nashville', -86.8, 36.2, 't'], DET: ['Detroit', -83.0, 42.3, 't'], CIN: ['Cincinnati', -84.5, 39.1, 'b'],
  TOR: ['Toronto', -79.4, 43.7, 't'], MTL: ['Montréal', -73.6, 45.5, 't'], BOS: ['Boston', -71.1, 42.4, 'r'],
  NYC: ['New York', -74.0, 40.7, 'r'], WAS: ['Washington', -77.0, 38.9, 'r'], CHA: ['Charlotte', -80.8, 35.2, 'r'],
  MIA: ['Miami', -80.2, 25.8, 'r'], JAX: ['Jacksonville', -81.7, 30.3, 'r'],
};
for (const city of Object.values(CITIES)) [city.x, city.y] = proj(city[1], city[2]);

// [from, to, colour, colour of the twin track]
const ROUTE_DEFS = [
  ['VAN', 'SEA', 'orange'], ['SEA', 'POR', 'blue', 'red'], ['VAN', 'CAL', 'black'], ['VAN', 'SPO', 'gray'],
  ['SEA', 'SPO', 'green', 'gray'], ['SPO', 'CAL', 'purple'], ['SPO', 'BOI', 'yellow'], ['SPO', 'BIL', 'red'],
  ['CAL', 'BIL', 'gray'], ['CAL', 'WIN', 'orange'], ['POR', 'BOI', 'white'], ['POR', 'SFO', 'black', 'yellow'],
  ['SFO', 'LAX', 'green', 'blue'], ['SFO', 'LVS', 'purple'], ['SFO', 'BOI', 'gray'], ['LAX', 'SDG', 'white'],
  ['LAX', 'LVS', 'red', 'gray'], ['SDG', 'PHX', 'orange'], ['LVS', 'PHX', 'gray'], ['LVS', 'SLC', 'green'],
  ['BOI', 'SLC', 'orange', 'gray'], ['BOI', 'BIL', 'blue'], ['SLC', 'BIL', 'black'], ['SLC', 'DEN', 'white'],
  ['PHX', 'ABQ', 'red'], ['PHX', 'ELP', 'yellow'], ['ABQ', 'ELP', 'gray'], ['ABQ', 'DEN', 'purple', 'green'],
  ['BIL', 'DEN', 'yellow'], ['BIL', 'BIS', 'green'], ['BIS', 'WIN', 'gray'], ['WIN', 'MIN', 'yellow'],
  ['BIS', 'MIN', 'white'], ['BIS', 'OMA', 'gray'], ['DEN', 'OMA', 'blue'], ['DEN', 'KC', 'gray'],
  ['ABQ', 'OKC', 'orange'], ['ELP', 'SAT', 'purple'], ['SAT', 'DAL', 'white', 'gray'], ['SAT', 'HOU', 'black'],
  ['DAL', 'HOU', 'red'], ['DAL', 'OKC', 'yellow', 'purple'], ['OKC', 'KC', 'green'], ['KC', 'OMA', 'red', 'black'],
  ['OMA', 'MIN', 'purple'], ['MIN', 'CHI', 'green', 'orange'], ['OMA', 'CHI', 'gray'], ['KC', 'STL', 'yellow', 'white'],
  ['OKC', 'MEM', 'black'], ['DAL', 'MEM', 'blue'], ['HOU', 'NOL', 'purple', 'gray'], ['MEM', 'NOL', 'purple'],
  ['MEM', 'STL', 'gray'], ['STL', 'CHI', 'blue'], ['STL', 'CIN', 'red'], ['STL', 'NAS', 'white'],
  ['MEM', 'NAS', 'gray'], ['NOL', 'ATL', 'green'], ['NOL', 'JAX', 'gray'], ['JAX', 'MIA', 'yellow', 'green'],
  ['ATL', 'JAX', 'white'], ['ATL', 'NAS', 'orange', 'gray'], ['ATL', 'CHA', 'purple'], ['CHA', 'JAX', 'blue'],
  ['CHA', 'WAS', 'black', 'red'], ['NAS', 'CIN', 'yellow'], ['CIN', 'WAS', 'gray'], ['CIN', 'DET', 'purple', 'black'],
  ['CHI', 'DET', 'white'], ['DET', 'TOR', 'gray', 'blue'], ['MIN', 'DET', 'black'], ['TOR', 'MTL', 'red'],
  ['TOR', 'NYC', 'green'], ['MTL', 'BOS', 'white', 'orange'], ['MTL', 'NYC', 'gray'], ['BOS', 'NYC', 'purple', 'black'],
  ['NYC', 'WAS', 'yellow', 'blue'], ['DET', 'WAS', 'orange'], ['CHI', 'CIN', 'gray'], ['NAS', 'CHA', 'gray'],
  ['NOL', 'MIA', 'red'],
];
export const ROUTES = [];
for (const [a, b, c1, c2] of ROUTE_DEFS) {
  const A = CITIES[a];
  const B = CITIES[b];
  const len = Math.max(1, Math.min(6, Math.round(Math.hypot(B.x - A.x, B.y - A.y) / 38)));
  const id = ROUTES.length;
  ROUTES.push({ id, a, b, c: c1, len, twin: c2 ? id + 1 : -1, side: c2 ? -1 : 0 });
  if (c2) ROUTES.push({ id: id + 1, a, b, c: c2, len, twin: id, side: 1 });
}
export const POINTS = [0, 1, 3, 5, 8, 11, 15];
export const LONGEST_BONUS = 12;
export const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
export const CARD_KINDS = [...COLORS, 'loco'];

const ADJ = Object.fromEntries(Object.keys(CITIES).map(key => [key, []]));
for (const route of ROUTES) { ADJ[route.a].push(route); ADJ[route.b].push(route); }
const other = (route, city) => route.a === city ? route.b : route.a;

function shortest(from, to) {
  const dist = Object.fromEntries(Object.keys(CITIES).map(key => [key, Infinity]));
  const done = new Set();
  dist[from] = 0;
  for (;;) {
    let u = null;
    for (const key of Object.keys(dist)) if (!done.has(key) && (u === null || dist[key] < dist[u])) u = key;
    if (u === null || dist[u] === Infinity || u === to) break;
    done.add(u);
    for (const route of ADJ[u]) dist[other(route, u)] = Math.min(dist[other(route, u)], dist[u] + route.len);
  }
  return dist[to];
}

const TICKET_DEFS = [
  ['SEA', 'SAT'], ['SPO', 'ATL'], ['SFO', 'CHI'], ['SDG', 'NYC'], ['POR', 'MIA'], ['VAN', 'WAS'], ['CAL', 'DAL'],
  ['BOI', 'NOL'], ['SLC', 'TOR'], ['LVS', 'DET'], ['PHX', 'CHA'], ['ABQ', 'BOS'], ['ELP', 'CIN'], ['DEN', 'MTL'],
  ['BIL', 'HOU'], ['BIS', 'JAX'], ['WIN', 'NAS'], ['MIN', 'SAT'], ['OMA', 'WAS'], ['KC', 'BOS'], ['OKC', 'DET'],
  ['DAL', 'CHA'], ['HOU', 'TOR'], ['MEM', 'MTL'], ['STL', 'JAX'], ['CHI', 'MIA'], ['CIN', 'NOL'], ['NAS', 'BOS'],
  ['ATL', 'TOR'], ['LAX', 'DEN'], ['SFO', 'PHX'], ['VAN', 'BIL'], ['SPO', 'SLC'], ['BIS', 'KC'], ['WIN', 'CHI'],
  ['DAL', 'STL'], ['HOU', 'ATL'], ['CHA', 'NYC'], ['LVS', 'SAT'], ['CAL', 'OMA'],
];
export const TICKETS = TICKET_DEFS.map(([a, b], id) => ({ id, a, b, pts: shortest(a, b) }));

// ---------- Pure helpers shared by the server and the board ----------

export function payOptions(hand, route) {
  const options = [];
  for (const c of route.c === 'gray' ? COLORS : [route.c]) {
    const most = Math.min(hand[c], route.len);
    for (let use = most; use >= 1 && hand.loco >= route.len - use; use--) {
      options.push({ c, n: use, loco: route.len - use, main: use === most });
    }
  }
  if (hand.loco >= route.len) options.push({ c: route.c === 'gray' ? 'loco' : route.c, n: 0, loco: route.len, main: !options.length });
  return options;
}

// `owner` maps route ids to seats. Returns '' when the route can be claimed.
export function claimProblem(owner, playerCount, seat, trains, hand, route) {
  if (owner[route.id] !== undefined) return 'Already claimed.';
  if (route.twin >= 0) {
    const twin = owner[route.twin];
    if (twin === seat) return 'You already own the other track of this double route.';
    if (twin !== undefined && playerCount <= 3) return 'With 2–3 players only one track of a double route can be used.';
  }
  if (trains < route.len) return `You need ${route.len} trains but have ${trains}.`;
  if (!payOptions(hand, route).length) {
    return `You need ${route.len} ${route.c === 'gray' ? 'cards of one colour' : `${route.c} cards`} (locomotives are wild).`;
  }
  return '';
}

export function twinBlocked(owner, playerCount, route) {
  return owner[route.id] === undefined && route.twin >= 0 && owner[route.twin] !== undefined && playerCount <= 3;
}

export function connected(owner, seat, a, b) {
  const seen = new Set([a]);
  const stack = [a];
  while (stack.length) {
    const city = stack.pop();
    if (city === b) return true;
    for (const route of ADJ[city]) {
      const next = other(route, city);
      if (owner[route.id] === seat && !seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return false;
}

export function longestPath(owner, seat) {
  const edges = ROUTES.filter(route => owner[route.id] === seat);
  const adj = {};
  edges.forEach((route, i) => { (adj[route.a] ??= []).push(i); (adj[route.b] ??= []).push(i); });
  const used = edges.map(() => false);
  let best = 0;
  const dfs = (city, len) => {
    best = Math.max(best, len);
    for (const i of adj[city] ?? []) {
      if (used[i]) continue;
      used[i] = true;
      dfs(other(edges[i], city), len + edges[i].len);
      used[i] = false;
    }
  };
  Object.keys(adj).forEach(city => dfs(city, 0));
  return best;
}

// ---------- Server-side state ----------

function randomIndex(length) {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * length);
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const emptyHand = () => Object.fromEntries(CARD_KINDS.map(kind => [kind, 0]));
const cardCount = hand => Object.values(hand).reduce((sum, n) => sum + n, 0);

function log(state, seat, text) {
  state.log.push({ seat, text });
  if (state.log.length > 30) state.log.shift();
}

export function makeIronRoutes(seats) {
  const deck = shuffle([...COLORS.flatMap(c => Array(12).fill(c)), ...Array(14).fill('loco')]);
  const state = {
    seats: [...seats],
    players: seats.map(seat => ({ seat, trains: 40, score: 0, hand: emptyHand(), tickets: [], pending: [] })),
    cur: 0, phase: 'tickets', setup: true, minKeep: 2, turns: 0,
    deck, discard: [], market: [], tdeck: shuffle(TICKETS.map(ticket => ticket.id)),
    owner: {}, final: null, over: null, log: [],
  };
  for (const player of state.players) {
    for (let i = 0; i < 4; i++) player.hand[state.deck.pop()]++;
    player.pending = state.tdeck.splice(0, 3);
  }
  refillMarket(state);
  log(state, null, 'New game. Everyone chooses their starting tickets.');
  return state;
}

function drawFromDeck(state) {
  if (!state.deck.length && state.discard.length) {
    state.deck = shuffle(state.discard);
    state.discard = [];
    log(state, null, 'The discard pile is shuffled into a new deck.');
  }
  return state.deck.pop();
}

function refillMarket(state) {
  for (let tries = 0; tries < 4; tries++) {
    while (state.market.length < 5) {
      const card = drawFromDeck(state);
      if (!card) break;
      state.market.push(card);
    }
    const locos = state.market.filter(card => card === 'loco').length;
    if (locos < 3 || state.deck.length + state.discard.length < 5) return;
    log(state, null, 'Three locomotives face up. The face-up cards are replaced.');
    state.discard.push(...state.market);
    state.market = [];
  }
}

const cardsAvailable = state => state.deck.length + state.discard.length + state.market.filter(card => card !== 'loco').length > 0;
export const canTakeMarket = (market, phase, index) => Boolean(market[index]) && (phase === 'turn' || (phase === 'draw2' && market[index] !== 'loco'));

function canAct(state, index) {
  const player = state.players[index];
  if (cardsAvailable(state) || state.market.length || state.tdeck.length) return true;
  return ROUTES.some(route => !claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, route));
}

function endTurn(state) {
  const count = state.players.length;
  const player = state.players[state.cur];
  state.turns++;
  if (state.final) {
    if (--state.final.left <= 0) return gameOver(state);
  } else if (player.trains <= 2) {
    state.final = { by: player.seat, left: count };
    log(state, player.seat, `has ${player.trains} train${player.trains === 1 ? '' : 's'} left. Everyone gets one final turn!`);
  }
  state.cur = (state.cur + 1) % count;
  state.phase = 'turn';
  if (!canAct(state, state.cur)) {
    log(state, state.players[state.cur].seat, 'has no legal move and passes.');
    if (state.turns < 2000) endTurn(state);
  }
}

function gameOver(state) {
  const rows = state.players.map(player => {
    const tickets = player.tickets.map(id => ({ id, done: connected(state.owner, player.seat, TICKETS[id].a, TICKETS[id].b) }));
    const plus = tickets.filter(t => t.done).reduce((sum, t) => sum + TICKETS[t.id].pts, 0);
    const minus = tickets.filter(t => !t.done).reduce((sum, t) => sum + TICKETS[t.id].pts, 0);
    return { seat: player.seat, routes: player.score, plus, minus, done: tickets.filter(t => t.done).length,
      longest: longestPath(state.owner, player.seat), bonus: 0, tickets };
  });
  const maxLen = Math.max(...rows.map(row => row.longest));
  for (const row of rows) {
    if (maxLen > 0 && row.longest === maxLen) row.bonus = LONGEST_BONUS;
    row.total = row.routes + row.plus - row.minus + row.bonus;
  }
  rows.sort((x, y) => (y.total - x.total) || (y.done - x.done) || (y.longest - x.longest));
  state.over = { rows };
  state.phase = 'over';
  log(state, rows[0].seat, `wins with ${rows[0].total} points.`);
}

function keepTickets(state, index, keep) {
  const player = state.players[index];
  if (!player.pending.length || (!state.setup && (state.phase !== 'tickets' || index !== state.cur))) return false;
  if (!Array.isArray(keep) || new Set(keep).size !== keep.length || !keep.every(id => player.pending.includes(id))) return false;
  if (keep.length < Math.min(state.setup ? 2 : state.minKeep, player.pending.length)) return false;
  player.tickets.push(...keep);
  state.tdeck.push(...player.pending.filter(id => !keep.includes(id)));
  player.pending = [];
  log(state, player.seat, `keeps ${keep.length} ticket${keep.length === 1 ? '' : 's'}.`);
  if (!state.setup) {
    endTurn(state);
    return true;
  }
  if (state.players.every(p => !p.pending.length)) {
    state.setup = false;
    state.cur = 0;
    state.phase = 'turn';
    log(state, state.players[0].seat, 'takes the first turn.');
  }
  return true;
}

function takeCard(state, source) {
  const player = state.players[state.cur];
  if (state.phase !== 'turn' && state.phase !== 'draw2') return false;
  let card;
  if (source === 'deck') {
    card = drawFromDeck(state);
    if (!card) return false;
    log(state, player.seat, 'draws a card from the deck.');
  } else {
    if (!Number.isInteger(source) || !canTakeMarket(state.market, state.phase, source)) return false;
    [card] = state.market.splice(source, 1);
    log(state, player.seat, `takes a face-up ${card === 'loco' ? 'locomotive' : card} card.`);
    refillMarket(state);
  }
  player.hand[card]++;
  if (state.phase === 'turn' && !(source !== 'deck' && card === 'loco') && cardsAvailable(state)) state.phase = 'draw2';
  else endTurn(state);
  return true;
}

function claim(state, move) {
  const player = state.players[state.cur];
  const route = ROUTES[move.route];
  if (state.phase !== 'turn' || !Number.isInteger(move.route) || !route ||
      claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, route)) return false;
  const option = payOptions(player.hand, route).find(o => o.c === move.color && o.n === move.count && o.loco === move.loco);
  if (!option) return false;
  player.hand[option.c] -= option.n;
  player.hand.loco -= option.loco;
  state.discard.push(...Array(option.n).fill(option.c), ...Array(option.loco).fill('loco'));
  state.owner[route.id] = player.seat;
  player.trains -= route.len;
  player.score += POINTS[route.len];
  const points = POINTS[route.len];
  log(state, player.seat, `claims ${CITIES[route.a][0]}–${CITIES[route.b][0]} (${route.len}) for ${points} point${points === 1 ? '' : 's'}.`);
  endTurn(state);
  return true;
}

// Mutates `state` and returns true only for a legal action by `seat`.
export function applyIronRoutes(state, seat, move) {
  const index = state.seats.indexOf(seat);
  if (index < 0 || state.over || !move || typeof move !== 'object') return false;
  if (move.action === 'tickets') return keepTickets(state, index, move.keep);
  if (state.setup || index !== state.cur) return false;
  if (move.action === 'draw') return takeCard(state, move.source);
  if (move.action === 'claim') return claim(state, move);
  if (move.action === 'drawTickets' && state.phase === 'turn' && state.tdeck.length) {
    state.players[index].pending = state.tdeck.splice(0, 3);
    state.minKeep = 1;
    state.phase = 'tickets';
    log(state, seat, 'draws destination tickets.');
    return true;
  }
  return false;
}

export function ironRoutesView(state, seat) {
  const me = state.players.find(player => player.seat === seat);
  const scores = [];
  for (const player of state.players) scores[player.seat] = player.score;
  for (const row of state.over?.rows ?? []) scores[row.seat] = row.total;
  return {
    seats: state.seats,
    turn: state.setup || state.over ? null : state.seats[state.cur],
    phase: state.phase,
    setup: state.setup,
    finalBy: state.over ? null : state.final?.by ?? null,
    market: state.market,
    deck: state.deck.length + state.discard.length,
    ticketDeck: state.tdeck.length,
    owner: state.owner,
    players: state.players.map(player => ({
      seat: player.seat, trains: player.trains, score: player.score,
      cards: cardCount(player.hand), tickets: player.tickets.length, choosing: player.pending.length > 0,
    })),
    scores,
    log: state.log,
    over: state.over,
    winner: state.over ? state.over.rows[0].seat : undefined,
    me: me ? { hand: me.hand, tickets: me.tickets, pending: me.pending, minKeep: state.setup ? 2 : state.minKeep } : null,
  };
}
