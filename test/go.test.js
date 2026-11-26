import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeGoBoard, playGo } from '../public/go-rules.js';
import { roomMove, roomOptions } from '../worker/protocol.js';

const move = (board, point) => playGo(board, board.turn, { action: 'place', point });

test('Go captures a surrounded stone and rejects suicide', () => {
  let board = makeGoBoard();
  for (const point of [1, 0, 9]) board = move(board, point);
  assert.equal(board.cells[0], 0);
  assert.deepEqual(board.captures, [1, 0]);
  assert.equal(move(board, 0), board);
});

test('Go forbids immediate ko recapture', () => {
  let board = makeGoBoard();
  for (const point of [1, 2, 9, 12, 19, 20, 80, 10, 11]) board = move(board, point);
  assert.equal(board.cells[10], 0);
  assert.equal(board.cells[11], 1);
  assert.equal(move(board, 10), board);
});

test('two passes score the board with komi and resignation works off turn', () => {
  const initial = makeGoBoard();
  const resigned = playGo(initial, 1, { action: 'resign' });
  assert.equal(resigned.winner, 0);
  assert.equal(resigned.resigned, true);
  let board = initial;
  for (const point of [1, 80, 9]) board = move(board, point);
  board = playGo(board, 1, { action: 'pass' });
  board = playGo(board, 0, { action: 'pass' });
  assert.deepEqual(board.scores, [3, 7.5]);
  assert.equal(board.winner, 1);
  assert.equal(move(board, 0), board);
});

test('Go room settings validate all three board sizes and the move payload', () => {
  for (const size of [9, 13, 19]) {
    const options = roomOptions('go', { size });
    assert.deepEqual(options, { size });
    assert.deepEqual(roomMove('go', options, { action: 'place', point: size * size - 1 }), { action: 'place', point: size * size - 1 });
    assert.equal(roomMove('go', options, { action: 'place', point: size * size }), null);
    assert.deepEqual(roomMove('go', options, { action: 'resign' }), { action: 'resign' });
  }
  assert.equal(roomOptions('go', { size: 4 }), null);
});
