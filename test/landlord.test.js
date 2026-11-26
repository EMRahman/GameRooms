import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SP, PROPS, makeLandlord, applyLandlord, landlordView, actor, buildReason, owned, endLandlord, netWorth,
} from '../public/landlord-rules.js';
import { roomOptions, messageLimit } from '../worker/protocol.js';

const seatOf = (state, pid) => state.seats[pid];

// Plays a plausible legal move for whoever must act next.
function autoplay(state, turn) {
  const pid = actor(state);
  const seat = seatOf(state, pid);
  const p = state.players[pid];
  const play = move => applyLandlord(state, seat, move);
  if (state.trade) return play({ action: 'respond', accept: turn % 2 === 0 });
  if (state.auction) {
    const bid = state.auction.bid + 10;
    return turn % 3 && bid <= p.cash ? play({ action: 'bid', amount: bid }) : play({ action: 'pass' });
  }
  if (state.phase === 'debt') {
    if (play({ action: 'pay' })) return true;
    if (play({ action: 'raise' }) && play({ action: 'pay' })) return true;
    return play({ action: 'bankrupt' });
  }
  if (state.phase === 'buy') return play({ action: p.cash > 400 && turn % 4 ? 'buy' : 'auction' });
  if (state.phase === 'pre' && p.jail && turn % 2) return play({ action: 'bail' }) || play({ action: 'roll' });
  if (state.phase === 'pre' || state.again) {
    const street = owned(state, pid).find(i => !buildReason(state, pid, i));
    if (street !== undefined && p.cash > 500) return play({ action: 'build', i: street });
    return play({ action: 'roll' });
  }
  return play({ action: 'end' });
}

function checkInvariants(state) {
  for (const p of state.players) {
    if (!p.out) assert.ok(p.cash >= 0 || state.phase === 'debt', `negative cash ${p.cash}`);
  }
  const built = PROPS.reduce((sum, i) => sum + (state.props[i].h === 5 ? 0 : state.props[i].h), 0);
  const hotels = PROPS.filter(i => state.props[i].h === 5).length;
  assert.equal(state.houses + built, 36);
  assert.equal(state.hotels + hotels, 14);
  assert.equal(state.decks.fortune.length + state.decks.fund.length +
    state.players.reduce((n, p) => n + p.cards.length, 0), 28);
}

test('random games finish without breaking the bank or the decks', () => {
  for (let game = 0; game < 30; game++) {
    const state = makeLandlord([0, 2, 3, 5].slice(0, 2 + game % 3), { rounds: game % 2 ? 15 : 25 });
    let turn = 0;
    while (!state.over && turn < 20000) {
      assert.ok(autoplay(state, turn++), `stuck in phase ${state.phase}`);
      checkInvariants(state);
    }
    assert.ok(state.over, `game did not finish: ${state.phase} round ${state.round}`);
  }
});

test('the longest games fit the room allowance', () => {
  let longest = 0;
  for (let game = 0; game < 20; game++) {
    const state = makeLandlord([0, 1, 2, 3, 4, 5], { rounds: 40 });
    let moves = 0;
    while (!state.over && moves < 20000) {
      assert.ok(autoplay(state, moves));
      moves++;
    }
    longest = Math.max(longest, moves);
  }
  assert.ok(longest < messageLimit('landlord') - 600, `a six-player, 40-round game took ${longest} moves`);
});

test('the room can end a game mid-auction, and the richest player wins', () => {
  const state = makeLandlord([0, 1, 2]);
  state.phase = 'buy';
  state.offer = 1;
  assert.ok(applyLandlord(state, 0, { action: 'auction' }));
  state.players[2].cash = 3000;
  endLandlord(state);
  assert.deepEqual(state.over, { winner: 2, reason: 'limit' });
  assert.equal(state.auction, null);
  assert.equal(landlordView(state, 0).winner, 2);
  assert.equal(applyLandlord(state, 0, { action: 'pass' }), false);
  assert.ok(netWorth(state, 2) > netWorth(state, 0));
});

test('only the acting player can move, and malformed moves are refused', () => {
  const state = makeLandlord([0, 1]);
  assert.equal(applyLandlord(state, 1, { action: 'roll' }), false);
  assert.equal(applyLandlord(state, 7, { action: 'roll' }), false);
  assert.equal(applyLandlord(state, 0, null), false);
  assert.equal(applyLandlord(state, 0, { action: 'build', i: 'x' }), false);
  assert.equal(applyLandlord(state, 0, { action: 'trade', to: 1, give: [99], get: [], cg: 0, ct: 0 }), false);
  assert.equal(applyLandlord(state, 0, { action: 'trade', to: 1, give: [], get: [], cg: 5, ct: 0 }), false);
  assert.ok(applyLandlord(state, 0, { action: 'roll' }));
});

test('a trade waits for the other player, who can accept it', () => {
  const state = makeLandlord([0, 1]);
  state.props[1].o = 0;
  state.props[3].o = 1;
  assert.ok(applyLandlord(state, 0, { action: 'trade', to: 1, give: [1], get: [3], cg: 50, ct: 0 }));
  assert.equal(actor(state), 1);
  assert.equal(applyLandlord(state, 0, { action: 'roll' }), false);
  assert.equal(applyLandlord(state, 0, { action: 'respond', accept: true }), false);
  assert.ok(applyLandlord(state, 1, { action: 'respond', accept: true }));
  assert.equal(state.props[1].o, 1);
  assert.equal(state.props[3].o, 0);
  assert.equal(state.players[0].cash, 1550);
  assert.equal(state.players[1].cash, 1650);
});

test('an auction passes between bidders until one remains', () => {
  const state = makeLandlord([0, 1, 2]);
  state.phase = 'buy';
  state.offer = 1;
  assert.ok(applyLandlord(state, 0, { action: 'auction' }));
  assert.equal(applyLandlord(state, 1, { action: 'bid', amount: 10 }), false);
  assert.ok(applyLandlord(state, 0, { action: 'bid', amount: 10 }));
  assert.equal(applyLandlord(state, 1, { action: 'bid', amount: 10 }), false);
  assert.ok(applyLandlord(state, 1, { action: 'bid', amount: 40 }));
  assert.ok(applyLandlord(state, 2, { action: 'pass' }));
  assert.ok(applyLandlord(state, 0, { action: 'pass' }));
  assert.equal(state.auction, null);
  assert.equal(state.props[1].o, 1);
  assert.equal(state.players[1].cash, 1560);
  assert.equal(state.phase, 'post');
});

test('the view hides deck order and reports the acting seat', () => {
  const state = makeLandlord([2, 4]);
  const view = landlordView(state, 4);
  assert.equal(view.decks, undefined);
  assert.equal(view.me, 1);
  assert.equal(view.turn, 2);
  assert.equal(view.scores[4], '$1,600');
  assert.equal(SP.length, 40);
});

test('room options accept only the offered game lengths', () => {
  assert.deepEqual(roomOptions('landlord', {}), { rounds: 25 });
  assert.deepEqual(roomOptions('landlord', { rounds: 40 }), { rounds: 40 });
  assert.equal(roomOptions('landlord', { rounds: 0 }), null);
  assert.equal(roomOptions('landlord', { rounds: 7 }), null);
});
