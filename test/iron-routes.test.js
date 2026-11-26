import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ROUTES, TICKETS, makeIronRoutes, applyIronRoutes, ironRoutesView, payOptions, claimProblem, connected,
} from '../public/iron-routes-rules.js';
import { roomOptions } from '../worker/protocol.js';

const cardTotal = state => state.deck.length + state.discard.length + state.market.length +
  state.players.reduce((sum, player) => sum + Object.values(player.hand).reduce((a, b) => a + b, 0), 0);

function finishSetup(state) {
  for (const player of state.players) {
    assert.ok(applyIronRoutes(state, player.seat, { action: 'tickets', keep: player.pending.slice(0, 2) }));
  }
}

// Plays a legal move for the current player: claim the longest affordable route, otherwise draw.
function autoplay(state) {
  const player = state.players[state.cur];
  if (state.phase === 'tickets') return applyIronRoutes(state, player.seat, { action: 'tickets', keep: player.pending.slice(0, 1) });
  if (state.phase === 'turn') {
    const route = ROUTES.filter(r => !claimProblem(state.owner, state.players.length, player.seat, player.trains, player.hand, r))
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

  const route = ROUTES.find(r => r.c === 'red' && r.len === 2 && r.twin < 0);
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
  assert.ok(connected(state.owner, 0, route.a, route.b));
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
  const route = ROUTES.find(r => r.c === 'red' && r.len === 2 && r.twin < 0);
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

test('Iron Routes always reaches a final score', () => {
  for (let game = 0; game < 5; game++) {
    const state = makeIronRoutes([0, 1, 2, 3, 4].slice(0, 2 + game % 4));
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

test('Iron Routes rooms take no options', () => {
  assert.deepEqual(roomOptions('iron_routes', { size: 9 }), {});
});
