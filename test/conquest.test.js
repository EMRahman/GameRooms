import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NT, TERRS, START_ARMIES, makeConquest, applyConquest, conquestView, bestSet, canAttackFrom, countOwned, reachable, endConquest, standings,
} from '../public/conquest-rules.js';
import { roomOptions, maxSeats, messageLimit } from '../worker/protocol.js';

const seatOf = (S, pid) => S.seats[pid];
const pick = list => list[Math.floor(Math.random() * list.length)];

// Puts every army on one random territory the player owns.
function dump(S, pid, total) {
  const mine = TERRS.filter(t => S.owner[t.i] === pid).map(t => t.i);
  return { [pick(mine)]: total };
}

// Plays a plausible legal move for whoever must act next.
function autoplay(S) {
  if (S.phase === 'setup') {
    const pid = S.players.findIndex(p => !p.deploy);
    return applyConquest(S, seatOf(S, pid), { action: 'deploy', place: dump(S, pid, S.players[pid].pool) });
  }
  const pid = S.cur;
  const play = move => applyConquest(S, seatOf(S, pid), move);
  const hand = S.players[pid].cards;
  if (S.phase === 'reinforce') {
    const set = bestSet(S.owner, pid, hand);
    if (set && (hand.length >= 5 || Math.random() < .5)) return play({ action: 'trade', cards: set });
    return play({ action: 'reinforce', place: S.reinforce ? dump(S, pid, S.reinforce) : {} });
  }
  if (S.phase === 'attack') {
    if (S.pending) return play({ action: 'move', n: S.pending.max });
    const from = TERRS.map(t => t.i).filter(t => canAttackFrom(S, pid, t) && S.armies[t] > 3);
    if (!from.length || Math.random() < .05) return play({ action: Math.random() < .5 ? 'endAttack' : 'endTurn' });
    const f = pick(from);
    const to = pick(TERRS[f].adj.filter(o => S.owner[o] !== pid));
    return play({ action: 'attack', from: f, to, dice: 3, blitz: Math.random() < .7 });
  }
  const from = TERRS.map(t => t.i).find(t => S.owner[t] === pid && S.armies[t] > 1 && reachable(S, t).size > 1);
  if (from !== undefined && Math.random() < .5) {
    const to = [...reachable(S, from)].find(t => t !== from);
    return play({ action: 'fortify', from, to, n: S.armies[from] - 1 });
  }
  return play({ action: 'endTurn' });
}

function checkInvariants(S) {
  assert.equal(S.deck.length + S.discard.length + S.players.reduce((n, p) => n + p.cards.length, 0), NT + 2);
  if (S.phase !== 'setup') {
    assert.ok(S.owner.every(o => o >= 0));
    assert.ok(S.armies.every((a, t) => a >= 1 || S.pending?.to === t), 'a territory was left empty');
  }
  S.players.forEach((p, pid) => assert.equal(p.alive, countOwned(S, pid) > 0));
}

test('random games finish within the round limit and keep every card', () => {
  for (let game = 0; game < 40; game++) {
    const seats = [0, 1, 2, 3, 4, 5].slice(0, 2 + game % 5);
    const S = makeConquest(seats, { rounds: [10, 20, 30][game % 3] });
    let moves = 0;
    while (!S.over && moves < 20000) {
      assert.ok(autoplay(S), `stuck in phase ${S.phase}`);
      checkInvariants(S);
      moves++;
    }
    assert.ok(S.over, `game did not finish: ${S.phase} round ${S.round}`);
    assert.ok(S.round <= S.rounds + 1);
  }
});

// The slowest plausible play: single rolls only, attacking from any territory that can.
function rollOnly(S) {
  if (S.phase === 'setup') return autoplay(S);
  const pid = S.cur;
  const play = move => applyConquest(S, seatOf(S, pid), move);
  if (S.phase === 'reinforce') {
    const set = bestSet(S.owner, pid, S.players[pid].cards);
    if (set) return play({ action: 'trade', cards: set });
    return play({ action: 'reinforce', place: S.reinforce ? dump(S, pid, S.reinforce) : {} });
  }
  if (S.phase === 'attack') {
    if (S.pending) return play({ action: 'move', n: S.pending.min });
    const from = TERRS.map(t => t.i).filter(t => canAttackFrom(S, pid, t));
    if (!from.length) return play({ action: 'endAttack' });
    const f = pick(from);
    return play({ action: 'attack', from: f, to: pick(TERRS[f].adj.filter(o => S.owner[o] !== pid)), dice: 3, blitz: false });
  }
  return play({ action: 'endTurn' });
}

test('the longest games fit the room allowance with room to spare for chat', () => {
  // 200 such games measured a median of ~2,100 moves and a maximum of ~2,900.
  const budget = messageLimit('conquest') - 600;
  for (let game = 0; game < 25; game++) {
    const S = makeConquest([0, 1, 2, 3, 4, 5], { rounds: 30 });
    let moves = 0;
    while (!S.over && moves <= budget) {
      assert.ok(rollOnly(S));
      moves++;
    }
    assert.ok(S.over, `a six-player, 30-round game needed more than ${budget} moves`);
  }
});

test('the room can end a game at its move limit, scored as if time ran out', () => {
  const S = makeConquest([0, 1, 2]);
  for (let moves = 0; moves < 400 && !S.pending; moves++) rollOnly(S);
  assert.ok(S.pending, 'no conquest happened to leave armies waiting to move in');
  endConquest(S);
  assert.equal(S.over.reason, 'limit');
  assert.equal(S.over.winner, standings(S)[0]);
  assert.equal(S.pending, null);
  assert.ok(S.armies.every(a => a >= 1));
  assert.equal(applyConquest(S, 0, { action: 'endTurn' }), false);
  const before = JSON.stringify(S);
  endConquest(S);
  assert.equal(JSON.stringify(S), before);
});

test('setup deals every territory and holds deployments until everyone places', () => {
  const S = makeConquest([0, 3, 4]);
  assert.ok(S.owner.every(o => o >= 0));
  assert.equal(S.players[0].pool + countOwned(S, 0), START_ARMIES[3]);
  const mine = TERRS.find(t => S.owner[t.i] === 0).i;
  const theirs = TERRS.find(t => S.owner[t.i] === 1).i;
  assert.equal(applyConquest(S, 0, { action: 'deploy', place: { [theirs]: S.players[0].pool } }), false);
  assert.equal(applyConquest(S, 0, { action: 'deploy', place: { [mine]: S.players[0].pool - 1 } }), false);
  assert.ok(applyConquest(S, 0, { action: 'deploy', place: { [mine]: S.players[0].pool } }));
  assert.equal(S.armies[mine], 1, 'placement shows before everyone is ready');
  assert.equal(applyConquest(S, 0, { action: 'deploy', place: { [mine]: 1 } }), false);
  const other = conquestView(S, 3);
  assert.equal(other.deployed, null);
  assert.equal(other.turn, 3);
  assert.equal(conquestView(S, 0).turn, null);
  for (const pid of [1, 2]) applyConquest(S, S.seats[pid], { action: 'deploy', place: dump(S, pid, S.players[pid].pool) });
  assert.equal(S.phase, 'reinforce');
  assert.equal(S.armies[mine], START_ARMIES[3] - countOwned(S, 0) + 1);
});

test('only the current player can act, and malformed moves are refused', () => {
  const S = makeConquest([0, 1]);
  for (const pid of [0, 1]) applyConquest(S, pid, { action: 'deploy', place: dump(S, pid, S.players[pid].pool) });
  assert.equal(applyConquest(S, 1, { action: 'reinforce', place: dump(S, 1, S.reinforce) }), false);
  assert.equal(applyConquest(S, 7, { action: 'reinforce', place: {} }), false);
  assert.equal(applyConquest(S, 0, null), false);
  assert.equal(applyConquest(S, 0, { action: 'reinforce', place: { 999: S.reinforce } }), false);
  assert.equal(applyConquest(S, 0, { action: 'reinforce', place: [] }), false);
  assert.equal(applyConquest(S, 0, { action: 'trade', cards: [0, 1, 2] }), false);
  assert.equal(applyConquest(S, 0, { action: 'attack', from: 0, to: 1, dice: 3 }), false);
  assert.ok(applyConquest(S, 0, { action: 'reinforce', place: dump(S, 0, S.reinforce) }));
  assert.equal(S.phase, 'attack');
});

test('conquering moves armies in and earns one card at the end of the turn', () => {
  const S = makeConquest([0, 1]);
  for (const pid of [0, 1]) applyConquest(S, pid, { action: 'deploy', place: dump(S, pid, S.players[pid].pool) });
  // Rig the board: player 0 holds everything except one weak neighbour.
  const [from, to] = [CODE('a'), CODE('J')];
  S.owner.fill(0);
  S.armies.fill(1);
  S.owner[to] = 1;
  S.owner[CODE('W')] = 1;
  S.armies[from] = 30;
  applyConquest(S, 0, { action: 'reinforce', place: { [from]: S.reinforce } });
  assert.ok(applyConquest(S, 0, { action: 'attack', from, to, blitz: true }));
  assert.equal(S.owner[to], 0);
  assert.ok(S.pending);
  assert.equal(applyConquest(S, 0, { action: 'endAttack' }), false);
  assert.equal(applyConquest(S, 0, { action: 'move', n: S.pending.min - 1 }), false);
  assert.ok(applyConquest(S, 0, { action: 'move', n: S.pending.min }));
  assert.ok(applyConquest(S, 0, { action: 'endTurn' }));
  assert.equal(S.players[0].cards.length, 1);
  assert.equal(S.cur, 1);
  const view = conquestView(S, 1);
  assert.deepEqual(view.hand, []);
  assert.equal(view.players[0].cards, 1);
  assert.equal(view.deck, NT + 1);
  assert.equal(conquestView(S, 0).hand.length, 1);
});

test('taking the last territory wins the game', () => {
  const S = makeConquest([2, 5]);
  for (const pid of [0, 1]) applyConquest(S, S.seats[pid], { action: 'deploy', place: dump(S, pid, S.players[pid].pool) });
  S.owner.fill(0);
  S.armies.fill(1);
  S.owner[CODE('J')] = 1;
  S.armies[CODE('a')] = 50;
  applyConquest(S, 2, { action: 'reinforce', place: { [CODE('a')]: S.reinforce } });
  assert.ok(applyConquest(S, 2, { action: 'attack', from: CODE('a'), to: CODE('J'), blitz: true }));
  assert.deepEqual(S.over, { winner: 0, reason: 'world' });
  assert.equal(conquestView(S, 5).winner, 2);
  assert.equal(applyConquest(S, 2, { action: 'endTurn' }), false);
});

test('room options accept only the offered game lengths', () => {
  assert.deepEqual(roomOptions('conquest', {}), { rounds: 20 });
  assert.deepEqual(roomOptions('conquest', { rounds: 30 }), { rounds: 30 });
  assert.equal(roomOptions('conquest', { rounds: 25 }), null);
  assert.equal(maxSeats('conquest'), 6);
});

function CODE(ch) {
  return TERRS.find(t => t.code === ch).i;
}
