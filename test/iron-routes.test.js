import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAPS, MAP_IDS, ironMap, routePoints, pathLength, makeIronRoutes, applyIronRoutes, ironRoutesView, payOptions, claimProblem, connected, endIronRoutes,
  tunnelPayments, stationPayments,
} from '../public/iron-routes-rules.js';
import { roomOptions, messageLimit } from '../worker/protocol.js';
import { MAPS_V1 } from '../public/iron-routes-maps-v1.js';

const NA = ironMap('na');
const ROUTES = NA.routes;
const TICKETS = NA.tickets;

const cardTotal = state => state.deck.length + state.discard.length + state.market.length + (state.tunnel?.cards.length ?? 0) +
  state.players.reduce((sum, player) => sum + Object.values(player.hand).reduce((a, b) => a + b, 0), 0);

function finishSetup(state) {
  for (const player of state.players) {
    assert.ok(applyIronRoutes(state, player.seat, { action: 'tickets', keep: player.pending.slice(0, 2) }));
  }
}

// Plays a legal move for the current player: finish a tunnel, sometimes build a station,
// claim the longest affordable route, otherwise draw.
function autoplay(state) {
  const player = state.players[state.cur];
  const map = ironMap(state.map, state.rev);
  if (state.phase === 'tickets') return applyIronRoutes(state, player.seat, { action: 'tickets', keep: player.pending.slice(0, 1) });
  if (state.phase === 'tunnel') {
    const option = tunnelPayments(player.hand, state.tunnel)[0];
    return applyIronRoutes(state, player.seat, option
      ? { action: 'tunnel', color: option.c, count: option.n, loco: option.loco } : { action: 'tunnel', abandon: true });
  }
  if (state.phase === 'turn' && state.turns % 9 === 4) {
    const option = stationPayments(state.stations, player.seat, player.hand)[0];
    const city = Object.keys(map.cities).find(key => state.stations[key] === undefined);
    if (option && city) return applyIronRoutes(state, player.seat, { action: 'station', city, color: option.c, count: option.n, loco: option.loco });
  }
  if (state.phase === 'turn') {
    const route = map.routes.filter(r => !claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, r))
      .sort((a, b) => b.len - a.len)[0];
    if (route) {
      const option = payOptions(player.hand, route)[0];
      return applyIronRoutes(state, player.seat, { action: 'claim', route: route.id, color: option.c, count: option.n, loco: option.loco });
    }
  }
  if (state.deck.length + state.discard.length) return applyIronRoutes(state, player.seat, { action: 'draw', source: 'deck' });
  const index = state.market.findIndex(card => state.phase === 'turn' || card !== 'loco');
  if (index >= 0) return applyIronRoutes(state, player.seat, { action: 'draw', source: index });
  return applyIronRoutes(state, player.seat, { action: 'drawTickets' });
}

test('the longest games fit the room allowance, and the room can score one early', () => {
  let longest = 0;
  for (let game = 0; game < 20; game++) {
    const state = makeIronRoutes([0, 1, 2, 3, 4], { map: MAP_IDS[game % MAP_IDS.length] });
    finishSetup(state);
    let moves = 5;
    while (!state.over && moves < 20000) {
      assert.ok(autoplay(state));
      moves++;
    }
    longest = Math.max(longest, moves);
  }
  assert.ok(longest < messageLimit('iron_routes') - 600, `a five-player game took ${longest} moves`);

  const early = makeIronRoutes([0, 3]);
  endIronRoutes(early);
  assert.equal(early.phase, 'over');
  assert.equal(early.over.rows.length, 2);
  assert.equal(ironRoutesView(early, 3).winner, early.over.rows[0].seat);
  assert.equal(applyIronRoutes(early, 0, { action: 'draw', source: 'deck' }), false);
});

test('Iron Routes deals hidden hands and lets everyone choose starting tickets at once', () => {
  const state = makeIronRoutes([0, 2, 3]);
  assert.equal(cardTotal(state), 110);
  assert.equal(state.market.length, 5);
  assert.ok(state.players.every(player => player.pending.length === 3));
  assert.ok(TICKETS.every(ticket => ticket.pts > 0));

  const seat2 = state.players[1];
  assert.equal(applyIronRoutes(state, 2, { action: 'draw', source: 'deck' }), false);
  assert.equal(applyIronRoutes(state, 2, { action: 'tickets', keep: seat2.pending.slice(0, 1) }), false);
  assert.equal(applyIronRoutes(state, 2, { action: 'tickets', keep: [seat2.pending[0], seat2.pending[0]] }), false);
  assert.equal(applyIronRoutes(state, 2, { action: 'tickets', keep: [99, 98] }), false);
  assert.equal(applyIronRoutes(state, 1, { action: 'tickets', keep: [] }), false);
  // Seat 2 chooses before seat 0. Setup does not run in turn order.
  assert.ok(applyIronRoutes(state, 2, { action: 'tickets', keep: seat2.pending.slice() }));
  assert.equal(seat2.tickets.length, 3);
  assert.equal(state.setup, true);
  applyIronRoutes(state, 0, { action: 'tickets', keep: state.players[0].pending.slice(0, 2) });
  applyIronRoutes(state, 3, { action: 'tickets', keep: state.players[2].pending.slice(0, 2) });
  assert.equal(state.setup, false);
  assert.equal(state.phase, 'turn');
  assert.equal(TICKETS.length, state.tdeck.length + 7);

  const view = ironRoutesView(state, 2);
  assert.equal(view.turn, 0);
  assert.deepEqual(view.me.tickets, seat2.tickets);
  assert.deepEqual(view.me.hand, seat2.hand);
  assert.equal(typeof view.deck, 'number');
  assert.equal(typeof view.ticketDeck, 'number');
  assert.ok(!('tdeck' in view) && !('discard' in view));
  assert.deepEqual(Object.keys(view.players[0]).sort(), ['cards', 'choosing', 'score', 'seat', 'tickets', 'trains']);
  assert.equal(ironRoutesView(state, 1).me, null);
});

test('Iron Routes enforces two draws, the face-up locomotive rule and exact payment', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  assert.equal(applyIronRoutes(state, 1, { action: 'draw', source: 'deck' }), false);
  state.market = ['red', 'loco', 'blue', 'green', 'white'];
  assert.ok(applyIronRoutes(state, 0, { action: 'draw', source: 0 }));
  assert.equal(state.phase, 'draw2');
  const locoAt = state.market.indexOf('loco');
  assert.equal(applyIronRoutes(state, 0, { action: 'draw', source: locoAt }), false);
  assert.equal(applyIronRoutes(state, 0, { action: 'draw', source: 7 }), false);
  assert.ok(applyIronRoutes(state, 0, { action: 'draw', source: 'deck' }));
  assert.equal(state.cur, 1);

  state.market = ['loco', 'red', 'blue', 'green', 'white'];
  assert.ok(applyIronRoutes(state, 1, { action: 'draw', source: 0 }));
  assert.equal(state.cur, 0, 'a face-up locomotive ends the turn');

  const route = ROUTES.find(r => r.c === 'red' && r.len === 2 && r.twin < 0 && !r.tunnel);
  const player = state.players[0];
  Object.assign(player.hand, { red: 1, loco: 1 });
  assert.equal(applyIronRoutes(state, 0, { action: 'claim', route: route.id, color: 'red', count: 2, loco: 0 }), false);
  assert.equal(applyIronRoutes(state, 0, { action: 'claim', route: '3', color: 'red', count: 1, loco: 1 }), false);
  const before = cardTotal(state);
  assert.ok(applyIronRoutes(state, 0, { action: 'claim', route: route.id, color: 'red', count: 1, loco: 1 }));
  assert.equal(state.owner[route.id], 0);
  assert.equal(player.trains, 38);
  assert.equal(player.score, 3);
  assert.equal(cardTotal(state), before);
  assert.ok(connected(NA, state.owner, 0, route.a, route.b));
});

test('Iron Routes keeps a face-up row when locomotive reshuffles run out', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  // Only locomotives remain to draw, so every replacement row has three or more.
  for (const player of state.players) Object.keys(player.hand).forEach(kind => { player.hand[kind] = 0; });
  state.market = ['red', 'loco', 'loco', 'blue', 'green'];
  state.deck = Array(20).fill('loco');
  state.discard = [];
  assert.ok(applyIronRoutes(state, 0, { action: 'draw', source: 0 }));
  assert.equal(state.market.length, 5);
  assert.ok(state.market.filter(card => card === 'loco').length >= 3);

  // A short row refills once a claim returns cards to the discard pile.
  const route = ROUTES.find(r => r.c === 'red' && r.len === 2 && r.twin < 0 && !r.tunnel);
  const fresh = makeIronRoutes([0, 1]);
  finishSetup(fresh);
  fresh.market = ['blue'];
  fresh.deck = [];
  fresh.discard = [];
  Object.assign(fresh.players[0].hand, { red: 2 });
  assert.ok(applyIronRoutes(fresh, 0, { action: 'claim', route: route.id, color: 'red', count: 2, loco: 0 }));
  assert.equal(fresh.market.length, 3);
});

test('Iron Routes blocks the twin track with two or three players', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  const route = ROUTES.find(r => r.twin >= 0 && r.c !== 'gray');
  state.owner[route.twin] = 1;
  assert.match(claimProblem(state.owner, 2, 0, 40, { ...state.players[0].hand, loco: 9 }, route), /only one track/);
  assert.equal(claimProblem(state.owner, 4, 0, 40, { ...state.players[0].hand, loco: 9 }, route), '');
});

test('Iron Routes always reaches a final score on every map', () => {
  for (let game = 0; game < 8; game++) {
    const state = makeIronRoutes([0, 1, 2, 3, 4].slice(0, 2 + game % 4), { map: MAP_IDS[game % MAP_IDS.length] });
    finishSetup(state);
    let moves = 0;
    while (!state.over) {
      assert.ok(autoplay(state), `move ${moves} was refused in phase ${state.phase}`);
      assert.ok(++moves < 3000);
    }
    assert.equal(cardTotal(state), 110);
    const view = ironRoutesView(state, 0);
    assert.equal(view.turn, null);
    assert.equal(view.winner, state.over.rows[0].seat);
    assert.equal(view.scores[view.winner], state.over.rows[0].total);
    assert.equal(applyIronRoutes(state, state.seats[state.cur], { action: 'draw', source: 'deck' }), false);
  }
});

test('Iron Routes rooms choose a map, North America by default', () => {
  assert.deepEqual(roomOptions('iron_routes', {}), { map: 'na' });
  assert.deepEqual(roomOptions('iron_routes', { map: 'eu' }), { map: 'eu' });
  assert.equal(roomOptions('iron_routes', { map: 'mars' }), null);
  assert.equal(roomOptions('iron_routes', { map: '__proto__' }), null);
  for (const id of MAP_IDS) {
    const map = ironMap(id);
    const state = makeIronRoutes([0, 1], { map: id });
    assert.equal(ironRoutesView(state, 0).map, id);
    assert.ok(map.tickets.every(ticket => ticket.pts > 0 && Number.isFinite(ticket.pts)), `${id} tickets are reachable`);
    assert.ok(map.routes.some(route => route.tunnel), `${id} has tunnels`);
    assert.ok(state.players.every(player => player.pending.every(t => t < map.tickets.length)));
  }
  // Rooms created before maps existed have no map option and play North America.
  assert.equal(makeIronRoutes([0, 1], {}).map, 'na');
});

test('a tunnel reveals three cards and charges one more for each match or locomotive', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  const route = ROUTES.find(r => r.tunnel && r.c !== 'gray' && r.twin < 0);
  const player = state.players[0];
  Object.keys(player.hand).forEach(kind => { player.hand[kind] = 0; });
  player.hand[route.c] = route.len + 1;
  const other = route.c === 'red' ? 'blue' : 'red';
  state.deck.push(other, 'loco', route.c);
  const before = cardTotal(state);
  assert.ok(applyIronRoutes(state, 0, { action: 'claim', route: route.id, color: route.c, count: route.len, loco: 0 }));
  assert.equal(state.phase, 'tunnel');
  assert.deepEqual(state.tunnel.cards, [route.c, 'loco', other]);
  assert.equal(cardTotal(state), before);
  assert.deepEqual(ironRoutesView(state, 1).tunnel, state.tunnel);
  // Two extra cards are due, but only one spare card is left after the base payment.
  assert.deepEqual(tunnelPayments(player.hand, state.tunnel), []);
  assert.equal(applyIronRoutes(state, 0, { action: 'tunnel', color: route.c, count: 1, loco: 0 }), false);
  assert.equal(applyIronRoutes(state, 0, { action: 'draw', source: 'deck' }), false);
  assert.equal(applyIronRoutes(state, 1, { action: 'tunnel', abandon: true }), false);
  assert.ok(applyIronRoutes(state, 0, { action: 'tunnel', abandon: true }));
  assert.equal(player.hand[route.c], route.len + 1, 'abandoning keeps the payment cards');
  assert.equal(state.owner[route.id], undefined);
  assert.equal(state.cur, 1);
  assert.equal(state.tunnel, null);
  assert.equal(cardTotal(state), before);

  // Next time, with enough cards, the extra cost is paid and the route is claimed.
  applyIronRoutes(state, 1, { action: 'draw', source: 'deck' });
  applyIronRoutes(state, 1, { action: 'draw', source: 'deck' });
  player.hand.loco = 1;
  state.deck.push('white', 'loco', 'white');
  assert.ok(applyIronRoutes(state, 0, { action: 'claim', route: route.id, color: route.c, count: route.len, loco: 0 }));
  const [pay] = tunnelPayments(player.hand, state.tunnel);
  assert.deepEqual([pay.c, pay.n, pay.loco], [route.c, 1, 0]);
  assert.ok(applyIronRoutes(state, 0, { action: 'tunnel', color: pay.c, count: pay.n, loco: pay.loco }));
  assert.equal(state.owner[route.id], 0);
  assert.equal(player.hand[route.c], 0);
  assert.equal(player.hand.loco, 1);
  assert.equal(cardTotal(state), before + 4, 'the test added one locomotive and three deck cards');
});

test('stations cost one more card each and borrow a rival track at scoring', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  const player = state.players[0];
  // A ticket two tracks long: seat 1 owns the track from its start, seat 0 the track to its end.
  const ends = (route, x, y) => (route.a === x && route.b === y) || (route.a === y && route.b === x);
  const touches = (route, city) => route.a === city || route.b === city;
  let ticket;
  let first;
  let second;
  for (const t of TICKETS) {
    for (const r1 of ROUTES.filter(r => touches(r, t.a))) {
      const mid = r1.a === t.a ? r1.b : r1.a;
      const r2 = ROUTES.find(r => ends(r, mid, t.b));
      if (r2 && !ticket) [ticket, first, second] = [t, r1, r2];
    }
  }
  state.owner[first.id] = 1;
  state.owner[second.id] = 0;
  player.tickets = [ticket.id];
  Object.keys(player.hand).forEach(kind => { player.hand[kind] = 0; });
  player.hand.green = 6;
  assert.deepEqual(stationPayments(state.stations, 0, player.hand).map(o => o.n), [1]);
  assert.equal(applyIronRoutes(state, 0, { action: 'station', city: 'XXX', color: 'green', count: 1, loco: 0 }), false);
  assert.equal(applyIronRoutes(state, 0, { action: 'station', city: ticket.a, color: 'green', count: 2, loco: 0 }), false);
  assert.ok(applyIronRoutes(state, 0, { action: 'station', city: ticket.a, color: 'green', count: 1, loco: 0 }));
  assert.equal(state.stations[ticket.a], 0);
  assert.equal(player.hand.green, 5);
  applyIronRoutes(state, 1, { action: 'draw', source: 'deck' });
  applyIronRoutes(state, 1, { action: 'draw', source: 'deck' });
  assert.equal(applyIronRoutes(state, 0, { action: 'station', city: ticket.a, color: 'green', count: 2, loco: 0 }), false, 'one station per city');
  assert.deepEqual(stationPayments(state.stations, 0, player.hand).map(o => o.n), [2]);

  endIronRoutes(state);
  const row = state.over.rows.find(r => r.seat === 0);
  assert.equal(row.plus, ticket.pts);
  assert.equal(row.minus, 0);
  assert.deepEqual(row.borrowed, [{ city: ticket.a, id: first.id }]);
  assert.equal(row.stationPoints, 6, 'two unbuilt stations score 3 each');
  assert.equal(state.over.rows.find(r => r.seat === 1).stationPoints, 9);
});

test('rooms started before tunnels and stations keep the original rules', () => {
  const state = makeIronRoutes([0, 1]);
  finishSetup(state);
  delete state.stations;
  delete state.tunnel;
  delete state.map;
  delete state.rev;
  const ROUTES = ironMap('na', 1).routes;
  const route = ROUTES.find(r => r.tunnel && r.c !== 'gray');
  const player = state.players[0];
  player.hand[route.c] = route.len;
  assert.ok(applyIronRoutes(state, 0, { action: 'claim', route: route.id, color: route.c, count: route.len, loco: 0 }));
  assert.equal(state.owner[route.id], 0, 'tunnels claim straight away');
  assert.equal(applyIronRoutes(state, 1, { action: 'station', city: 'NYC', color: 'red', count: 0, loco: 1 }), false);
  const view = ironRoutesView(state, 0);
  assert.equal(view.stations, null);
  assert.equal(view.map, 'na');
  endIronRoutes(state);
  assert.ok(state.over.rows.every(row => row.stationPoints === 0));
});

test('rooms started before map revision 2 keep the first layout', () => {
  for (const id of Object.keys(MAPS_V1)) {
    assert.equal(MAPS[id].rev, 2, `${id} is on revision 2`);
    const state = makeIronRoutes([0, 1], { map: id });
    assert.equal(state.rev, 2);
    assert.equal(ironMap(id).routes.length, ironMap(id, 2).routes.length);
    delete state.rev;
    const view = ironRoutesView(state, 0);
    assert.equal(view.rev, 1);
    const old = ironMap(id, 1);
    assert.equal(old.data, MAPS_V1[id]);
    assert.equal(old.tickets.length, MAPS_V1[id].tickets.length);
  }
  assert.equal(makeIronRoutes([0, 1], { map: 'ch' }).rev, 1, 'maps without revisions are revision 1');
  assert.equal(ironMap('ch', 1).data, MAPS.ch);
});

test('bent routes follow their waypoints and set their length by the map car length', () => {
  for (const id of MAP_IDS) {
    const data = MAPS[id];
    const keys = new Set(data.routes.map(([a, b]) => `${a}-${b}`));
    for (const key of Object.keys(data.bends ?? {})) assert.ok(keys.has(key), `${id} bend ${key} names a route`);
    for (const key of data.tunnels) assert.ok(keys.has(key), `${id} tunnel ${key} names a route`);
    for (const route of ironMap(id).routes) {
      const points = routePoints(data, route.a, route.b);
      assert.deepEqual(route.pts, points);
      assert.equal(points.length, 2 + (data.bends?.[`${route.a}-${route.b}`]?.length ?? 0));
      assert.equal(route.len, Math.max(1, Math.min(6, Math.round(pathLength(points) / (data.unit ?? 38)))));
    }
  }
  const lille = ironMap('eu').routes.find(r => [r.a, r.b].includes('LON') && [r.a, r.b].includes('PAR'));
  assert.equal(lille, undefined, 'Paris–London now runs via Lille');
});
