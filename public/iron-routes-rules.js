// Iron Routes rules, adapted from the single-device game in `Games`.
// The Durable Object owns the state. Browsers receive only ironRoutesView().
import { MAPS } from './iron-routes-maps.js';

export { MAPS };
export const MAP_IDS = Object.keys(MAPS);
export const DEFAULT_MAP = 'na';
export const POINTS = [0, 1, 3, 5, 8, 11, 15];
export const LONGEST_BONUS = 12;
export const STATION_LIMIT = 3;
export const STATION_POINTS = 3;
export const COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'black', 'white'];
export const CARD_KINDS = [...COLORS, 'loco'];

const other = (route, city) => route.a === city ? route.b : route.a;

// Builds the cities, routes, tickets and adjacency of one map once per process.
const built = {};
export function ironMap(id) {
  const key = Object.hasOwn(MAPS, id) ? id : DEFAULT_MAP;
  if (built[key]) return built[key];
  const data = MAPS[key];
  const cities = {};
  for (const [code, city] of Object.entries(data.cities)) {
    const copy = [...city];
    [copy.x, copy.y] = data.proj(city[1], city[2]);
    cities[code] = copy;
  }
  const routes = [];
  for (const [a, b, c1, c2] of data.routes) {
    const A = cities[a];
    const B = cities[b];
    const len = Math.max(1, Math.min(6, Math.round(Math.hypot(B.x - A.x, B.y - A.y) / 38)));
    const id = routes.length;
    const tunnel = data.tunnels.includes(`${a}-${b}`);
    routes.push({ id, a, b, c: c1, len, tunnel, twin: c2 ? id + 1 : -1, side: c2 ? -1 : 0 });
    if (c2) routes.push({ id: id + 1, a, b, c: c2, len, tunnel, twin: id, side: 1 });
  }
  const adj = Object.fromEntries(Object.keys(cities).map(code => [code, []]));
  for (const route of routes) { adj[route.a].push(route); adj[route.b].push(route); }
  const map = { id: key, name: data.name, blurb: data.blurb, data, cities, routes, adj, tickets: [] };
  map.tickets = data.tickets.map(([a, b], id) => ({ id, a, b, pts: shortest(map, a, b) }));
  built[key] = map;
  return map;
}

function shortest(map, from, to) {
  const dist = Object.fromEntries(Object.keys(map.cities).map(key => [key, Infinity]));
  const done = new Set();
  dist[from] = 0;
  for (;;) {
    let u = null;
    for (const key of Object.keys(dist)) if (!done.has(key) && (u === null || dist[key] < dist[u])) u = key;
    if (u === null || dist[u] === Infinity || u === to) break;
    done.add(u);
    for (const route of map.adj[u]) dist[other(route, u)] = Math.min(dist[other(route, u)], dist[u] + route.len);
  }
  return dist[to];
}

// Rooms started before tunnels and stations existed have no `stations` and keep the original rules.
const mapOf = state => ironMap(state.map ?? DEFAULT_MAP);
const hasStations = state => Boolean(state.stations);

// ---------- Pure helpers shared by the server and the board ----------

// Every legal split of coloured cards and locomotives; `main` marks the one using the most coloured cards.
// `reserved` holds cards already set aside for a tunnel's base payment.
export function payOptions(hand, { c: color, len }, reserved) {
  if (!len) return [{ c: color, n: 0, loco: 0, main: true }];
  const locos = hand.loco - (reserved?.loco ?? 0);
  const options = [];
  for (const c of color === 'gray' ? COLORS : color === 'loco' ? [] : [color]) {
    const most = Math.min(hand[c] - (reserved?.c === c ? reserved.n : 0), len);
    for (let use = most; use >= 1 && locos >= len - use; use--) {
      options.push({ c, n: use, loco: len - use, main: use === most });
    }
  }
  if (locos >= len) options.push({ c: color === 'gray' ? 'loco' : color, n: 0, loco: len, main: !options.length });
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

// Extra cards a tunnel needs: each revealed locomotive, plus each card matching a coloured base payment.
export const tunnelExtra = ({ base, cards }) => cards.filter(card => card === 'loco' || (base.n && card === base.c)).length;
export const tunnelPayments = (hand, tunnel) => payOptions(hand, { c: tunnel.base.n ? tunnel.base.c : 'loco', len: tunnelExtra(tunnel) }, tunnel.base);

export const stationsBuilt = (stations, seat) => Object.values(stations ?? {}).filter(owner => owner === seat).length;
export function stationPayments(stations, seat, hand) {
  const built = stationsBuilt(stations, seat);
  return stations && built < STATION_LIMIT ? payOptions(hand, { c: 'gray', len: built + 1 }) : [];
}

// `borrowed` lists opponents' tracks this seat's stations may use.
export function connected(map, owner, seat, a, b, borrowed = []) {
  const seen = new Set([a]);
  const stack = [a];
  while (stack.length) {
    const city = stack.pop();
    if (city === b) return true;
    for (const route of map.adj[city]) {
      if (owner[route.id] !== seat && !borrowed.some(track => track.id === route.id)) continue;
      const next = other(route, city);
      if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return false;
}

// Each station may borrow one opponent's track touching its city. Tries every assignment and keeps
// the one with the best ticket score, the same tracks counting for all of the seat's tickets.
export function ticketConnections(map, owner, stations, seat, ticketIds) {
  const tickets = ticketIds.map(id => map.tickets[id]);
  const cities = Object.keys(stations ?? {}).filter(city => stations[city] === seat);
  const done = tickets.filter(t => connected(map, owner, seat, t.a, t.b));
  let best = { done: new Set(done.map(t => t.id)), points: done.reduce((sum, t) => sum + t.pts, 0), borrowed: [] };
  if (!cities.length || done.length === tickets.length) return best;
  const unfinished = tickets.filter(t => !best.done.has(t.id));
  const options = cities.map(city => {
    const neighbours = new Set();
    return map.adj[city].filter(route => {
      const next = other(route, city);
      if (owner[route.id] === undefined || owner[route.id] === seat || neighbours.has(next)) return false;
      neighbours.add(next);
      return true;
    });
  });
  const base = best;
  const borrowed = [];
  function search(index) {
    if (index === cities.length) {
      if (!borrowed.length) return;
      const newDone = unfinished.filter(t => connected(map, owner, seat, t.a, t.b, borrowed));
      const points = base.points + newDone.reduce((sum, t) => sum + t.pts, 0);
      const count = base.done.size + newDone.length;
      if (points < best.points || (points === best.points && (count < best.done.size ||
        (count === best.done.size && borrowed.length >= best.borrowed.length)))) return;
      best = { done: new Set([...base.done, ...newDone.map(t => t.id)]), points, borrowed: borrowed.slice() };
      return;
    }
    search(index + 1);
    for (const route of options[index]) {
      if (borrowed.some(track => track.id === route.id)) continue;
      borrowed.push({ city: cities[index], id: route.id });
      search(index + 1);
      borrowed.pop();
    }
  }
  search(0);
  return best;
}

export function longestPath(map, owner, seat) {
  const edges = map.routes.filter(route => owner[route.id] === seat);
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
const cardName = card => card === 'loco' ? 'locomotive' : card;

function log(state, seat, text) {
  state.log.push({ seat, text });
  if (state.log.length > 30) state.log.shift();
}

export function makeIronRoutes(seats, options) {
  const map = ironMap(options?.map);
  const deck = shuffle([...COLORS.flatMap(c => Array(12).fill(c)), ...Array(14).fill('loco')]);
  const state = {
    map: map.id,
    seats: [...seats],
    players: seats.map(seat => ({ seat, trains: 40, score: 0, hand: emptyHand(), tickets: [], pending: [] })),
    cur: 0, phase: 'tickets', setup: true, minKeep: 2, turns: 0,
    deck, discard: [], market: [], tdeck: shuffle(map.tickets.map(ticket => ticket.id)),
    owner: {}, stations: {}, tunnel: null, final: null, over: null, log: [],
  };
  for (const player of state.players) {
    for (let i = 0; i < 4; i++) player.hand[state.deck.pop()]++;
    player.pending = state.tdeck.splice(0, 3);
  }
  refillMarket(state);
  log(state, null, `New game on the ${map.name} map. Everyone chooses their starting tickets.`);
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

// Fills the face-up row. Three locomotives replace the row, at most three times;
// the last row dealt always stays, so face-up draws are never lost.
function refillMarket(state) {
  for (let tries = 0; ; tries++) {
    while (state.market.length < 5) {
      const card = drawFromDeck(state);
      if (!card) break;
      state.market.push(card);
    }
    const locos = state.market.filter(card => card === 'loco').length;
    if (tries >= 3 || locos < 3 || state.deck.length + state.discard.length < 5) return;
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
  if (stationPayments(state.stations, player.seat, player.hand).length) return true;
  return mapOf(state).routes.some(route => !claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, route));
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

// Scores the game as it stands. The room calls this at its move limit.
export function endIronRoutes(state) {
  if (state.over) return;
  log(state, null, 'The room reached its move limit, so the game is scored now.');
  if (state.tunnel) {
    state.discard.push(...state.tunnel.cards);
    state.tunnel = null;
  }
  state.setup = false;
  gameOver(state);
}

function gameOver(state) {
  const map = mapOf(state);
  const rows = state.players.map(player => {
    const { done, points, borrowed } = ticketConnections(map, state.owner, state.stations, player.seat, player.tickets);
    const tickets = player.tickets.map(id => ({ id, done: done.has(id) }));
    const minus = tickets.filter(t => !t.done).reduce((sum, t) => sum + map.tickets[t.id].pts, 0);
    const stationPoints = hasStations(state) ? (STATION_LIMIT - stationsBuilt(state.stations, player.seat)) * STATION_POINTS : 0;
    return { seat: player.seat, routes: player.score, plus: points, minus, done: done.size, borrowed, stationPoints,
      longest: longestPath(map, state.owner, player.seat), bonus: 0, tickets };
  });
  const maxLen = Math.max(...rows.map(row => row.longest));
  for (const row of rows) {
    if (maxLen > 0 && row.longest === maxLen) row.bonus = LONGEST_BONUS;
    row.total = row.routes + row.plus - row.minus + row.bonus + row.stationPoints;
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
    log(state, player.seat, `takes a face-up ${cardName(card)} card.`);
    refillMarket(state);
  }
  player.hand[card]++;
  if (state.phase === 'turn' && !(source !== 'deck' && card === 'loco') && cardsAvailable(state)) state.phase = 'draw2';
  else endTurn(state);
  return true;
}

const findPayment = (options, move) => options.find(o => o.c === move.color && o.n === move.count && o.loco === move.loco);

function spend(state, player, { c, n, loco }) {
  player.hand[c] -= n;
  player.hand.loco -= loco;
  state.discard.push(...Array(n).fill(c), ...Array(loco).fill('loco'));
}

const routeLabel = (map, route) => `${map.cities[route.a][0]}–${map.cities[route.b][0]}`;

function completeClaim(state, player, route) {
  const map = mapOf(state);
  state.owner[route.id] = player.seat;
  player.trains -= route.len;
  player.score += POINTS[route.len];
  const points = POINTS[route.len];
  log(state, player.seat, `claims ${routeLabel(map, route)} (${route.len}) for ${points} point${points === 1 ? '' : 's'}.`);
  // Paid cards return to the discard pile, which can refill a row left short by an empty deck.
  refillMarket(state);
  endTurn(state);
}

function claim(state, move) {
  const map = mapOf(state);
  const player = state.players[state.cur];
  const route = map.routes[move.route];
  if (state.phase !== 'turn' || !Number.isInteger(move.route) || !route ||
      claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, route)) return false;
  const option = findPayment(payOptions(player.hand, route), move);
  if (!option) return false;
  const base = { c: option.c, n: option.n, loco: option.loco };
  if (route.tunnel && hasStations(state)) {
    const cards = [0, 1, 2].map(() => drawFromDeck(state)).filter(Boolean);
    state.tunnel = { route: route.id, base, cards };
    state.phase = 'tunnel';
    const extra = tunnelExtra(state.tunnel);
    log(state, player.seat, `attempts the ${routeLabel(map, route)} tunnel. ${cards.length ? `Revealed ${cards.map(cardName).join(', ')}.` : 'The deck is empty.'} It needs ${extra} extra card${extra === 1 ? '' : 's'}.`);
    return true;
  }
  spend(state, player, base);
  completeClaim(state, player, route);
  return true;
}

// Pays the tunnel's extra cost and claims it, or abandons it when `move.abandon` is set.
function resolveTunnel(state, move) {
  if (state.phase !== 'tunnel' || !state.tunnel) return false;
  const player = state.players[state.cur];
  const tunnel = state.tunnel;
  const extra = move.abandon ? null : findPayment(tunnelPayments(player.hand, tunnel), move);
  if (!move.abandon && !extra) return false;
  state.discard.push(...tunnel.cards);
  state.tunnel = null;
  const route = mapOf(state).routes[tunnel.route];
  if (extra) {
    spend(state, player, tunnel.base);
    spend(state, player, extra);
    completeClaim(state, player, route);
  } else {
    log(state, player.seat, `abandons the ${routeLabel(mapOf(state), route)} tunnel and keeps their cards.`);
    refillMarket(state);
    endTurn(state);
  }
  return true;
}

function buildStation(state, move) {
  const map = mapOf(state);
  const player = state.players[state.cur];
  if (state.phase !== 'turn' || !hasStations(state) || typeof move.city !== 'string' ||
      !Object.hasOwn(map.cities, move.city) || state.stations[move.city] !== undefined) return false;
  const option = findPayment(stationPayments(state.stations, player.seat, player.hand), move);
  if (!option) return false;
  spend(state, player, option);
  state.stations[move.city] = player.seat;
  log(state, player.seat, `builds a station in ${map.cities[move.city][0]}.`);
  refillMarket(state);
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
  if (move.action === 'tunnel') return resolveTunnel(state, move);
  if (move.action === 'station') return buildStation(state, move);
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
    map: state.map ?? DEFAULT_MAP,
    seats: state.seats,
    turn: state.setup || state.over ? null : state.seats[state.cur],
    phase: state.phase,
    setup: state.setup,
    finalBy: state.over ? null : state.final?.by ?? null,
    market: state.market,
    deck: state.deck.length + state.discard.length,
    ticketDeck: state.tdeck.length,
    owner: state.owner,
    // null in rooms started before tunnels and stations.
    stations: state.stations ?? null,
    tunnel: state.tunnel ?? null,
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
