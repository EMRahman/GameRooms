import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { makeBoard, playLine } from '../public/dots-rules.js';
import { makeFourfoldBoard, dropCounter } from '../public/fourfold-rules.js';
import { makeMemoryBoard, flipCard, memoryWinner } from '../public/memory-rules.js';

test('closing a box scores and keeps the turn', () => {
  let board = makeBoard(4);
  const play = (axis, row, col) => { board = playLine(board, board.turn, { axis, row, col }); };
  play('h', 0, 0);
  play('v', 0, 0);
  play('v', 0, 1);
  assert.equal(board.turn, 1);
  play('h', 1, 0);
  assert.deepEqual(board.scores, [0, 1]);
  assert.equal(board.boxes[0], 1);
  assert.equal(board.turn, 1);
  assert.equal(playLine(board, 1, { axis: 'h', row: 1, col: 0 }), board);
});

const runtime = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers') {
      return { shortCircuit: true, url: 'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }' };
    }
    return nextResolve(specifier, context);
  },
});
const { default: worker, Budget } = await import('../worker/index.js');
const { GameRoom } = await import('../worker/room.js');
runtime.deregister();

function storage() {
  const db = new DatabaseSync(':memory:');
  const kv = new Map();
  let alarm;
  return {
    kv: {
      get: key => structuredClone(kv.get(key)),
      put: (key, value) => kv.set(key, structuredClone(value)),
    },
    sql: {
      exec(query, ...params) {
        const stmt = db.prepare(query);
        const rows = stmt.columns().length ? stmt.all(...params) : (stmt.run(...params), []);
        return { toArray: () => rows, one: () => rows[0] };
      },
    },
    transactionSync(fn) {
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async setAlarm(value) { alarm = value; },
    async getAlarm() { return alarm; },
  };
}

test('public room creation stops at ten even with a higher setting', async () => {
  const budget = new Budget({ storage: storage() }, { DAILY_ROOM_LIMIT: '99' });
  const roomObjects = new Map();
  const env = {
    OWNER_KEY: 'test-owner-key',
    BUDGET: { getByName: () => budget },
    ROOM: { getByName: code => {
      if (!roomObjects.has(code)) roomObjects.set(code, new GameRoom(roomContext(), {}));
      return roomObjects.get(code);
    } },
  };
  const create = async (index, key = '', game = 'dots_and_boxes') => worker.fetch(new Request('https://games.example/api/rooms', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': `192.0.2.${index}`, 'X-Owner-Key': key },
    body: JSON.stringify({ game, clientId: crypto.randomUUID() }),
  }), env);
  // Node lacks the Worker-specific method. Preserve equal-length constant-time comparison.
  const { timingSafeEqual } = await import('node:crypto');
  crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));
  try {
    assert.equal((await create(1, env.OWNER_KEY)).status, 201);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => create(i + 2, '', ['dots_and_boxes', 'fourfold', 'go', 'memory_match'][i % 4])));
    assert.equal(results.filter(res => res.status === 201).length, 9);
    const refused = results.find(res => res.status === 429);
    assert.ok((await refused.json()).resetsAt > Date.now());
    assert.equal((await create(20, 'wrong-key')).status, 429);
    assert.equal((await create(20, env.OWNER_KEY)).status, 201);
  } finally {
    delete crypto.subtle.timingSafeEqual;
  }
});

function roomContext() {
  globalThis.WebSocketRequestResponsePair ??= class {};
  return { storage: storage(), setWebSocketAutoResponse() {}, getWebSockets: () => [] };
}

function socket(sockets) {
  let attachment;
  const ws = {
    readyState: WebSocket.OPEN,
    deserializeAttachment: () => attachment,
    serializeAttachment: data => { attachment = data; },
    messages: [],
    send(raw) { this.messages.push(JSON.parse(raw)); },
    close() { this.readyState = WebSocket.CLOSED; },
  };
  sockets.push(ws);
  return ws;
}

test('two seats finish a full game, reconnect, chat and rematch', async () => {
  const context = roomContext();
  const sockets = [];
  context.getWebSockets = () => sockets;
  const room = new GameRoom(context, {});
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  assert.equal(room.info(), null);
  await room.initialize(ids[0], 'dots_and_boxes', { size: 4 });
  const a = socket(sockets);
  const b = socket(sockets);
  const send = (ws, t, fields) => room.webSocketMessage(ws, JSON.stringify({ t, v: 1, ...fields }));
  await send(a, 'hello', { clientId: ids[0] });
  await send(b, 'hello', { clientId: ids[1] });
  await send(a, 'start');
  await send(b, 'chat', { text: 'Good luck' });
  let board = makeBoard(4);
  let seq = 0;
  for (const axis of ['h', 'v']) {
    for (let row = 0; row < (axis === 'h' ? 5 : 4); row++) {
      for (let col = 0; col < (axis === 'h' ? 4 : 5); col++) {
        const data = { axis, row, col };
        await send([a, b][board.turn], 'move', { round: 1, seq: ++seq, data });
        const msg = a.messages.at(-1);
        assert.deepEqual(msg, b.messages.at(-1));
        assert.equal(msg.t, 'move');
        board = playLine(board, msg.seat, msg.data);
      }
    }
  }
  assert.equal(board.scores[0] + board.scores[1], 16);
  const reconnected = socket(sockets);
  await send(reconnected, 'hello', { clientId: ids[1] });
  const welcome = reconnected.messages[0];
  assert.equal(welcome.log.length, 40);
  assert.equal(welcome.chat[0].text, 'Good luck');
  assert.equal(welcome.seat, 1);
  await send(a, 'rematch');
  assert.equal(reconnected.messages.at(-1).round, 2);
  assert.equal(reconnected.messages.at(-1).t, 'started');
});


test('Fourfold stops accepting drops into a full column', () => {
  let board = makeFourfoldBoard();
  for (let i = 0; i < 6; i++) board = dropCounter(board, board.turn, { col: 3 });
  assert.equal(board.moves, 6);
  assert.equal(dropCounter(board, board.turn, { col: 3 }), board);
  assert.equal(dropCounter(board, 1 - board.turn, { col: 4 }), board);
});

test('Fourfold relays a win to both seats and rebuilds it on reconnect', async () => {
  const context = roomContext();
  const sockets = [];
  context.getWebSockets = () => sockets;
  const room = new GameRoom(context, {});
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  await room.initialize(ids[0], 'fourfold', {});
  assert.equal(room.info().game, 'fourfold');

  const players = [socket(sockets), socket(sockets)];
  const send = (ws, t, fields) => room.webSocketMessage(ws, JSON.stringify({ t, v: 1, ...fields }));
  for (const [seat, ws] of players.entries()) await send(ws, 'hello', { clientId: ids[seat] });
  await send(players[0], 'start');
  await send(players[0], 'move', { round: 1, seq: 1, data: { col: 7 } });
  assert.equal(players[0].messages.at(-1).code, 'bad_request');

  const columns = [0, 0, 1, 1, 2, 2, 3];
  let board = makeFourfoldBoard();
  for (const [index, col] of columns.entries()) {
    await send(players[board.turn], 'move', { round: 1, seq: index + 1, data: { col } });
    const msg = players[0].messages.at(-1);
    assert.deepEqual(msg, players[1].messages.at(-1));
    board = dropCounter(board, msg.seat, msg.data);
  }
  assert.equal(board.winner, 0);
  assert.equal(board.winningCells.length, 4);

  const peer = socket(sockets);
  await send(peer, 'hello', { clientId: ids[1] });
  const welcome = peer.messages[0];
  assert.equal(welcome.game, 'fourfold');
  assert.deepEqual(welcome.log.reduce((state, move) => dropCounter(state, move.seat, move.data), makeFourfoldBoard()), board);
  await send(players[0], 'rematch');
  assert.equal(peer.messages.at(-1).round, 2);
});

test('Memory Match keeps turns on a match and rotates through the occupied seats on a miss', () => {
  let board = makeMemoryBoard({ level: 'expert' }, 1234, [1, 3, 4]);
  assert.deepEqual(board.deck, makeMemoryBoard({ level: 'expert' }, 1234, [1, 3, 4]).deck);
  assert.equal(board.deck.length, 36);
  const first = 0;
  const wrong = board.deck.findIndex(pair => pair !== board.deck[first]);
  board = flipCard(board, 1, { card: first });
  board = flipCard(board, 1, { card: wrong });
  assert.equal(board.turn, 3);
  assert.equal(board.revealed, null);
  assert.equal(flipCard(board, 1, { card: first }), board);
  for (let pair = 0; pair < 18; pair++) {
    for (const [card, value] of board.deck.entries()) {
      if (value === pair) board = flipCard(board, 3, { card });
    }
    assert.equal(board.turn, 3);
  }
  assert.equal(board.scores[3], 18);
  assert.equal(memoryWinner(board), 3);
});

test('Memory Match fixes the round roster and replays the shared deck on reconnect', async () => {
  const context = roomContext();
  const sockets = [];
  context.getWebSockets = () => sockets;
  const room = new GameRoom(context, {});
  const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
  await room.initialize(ids[0], 'memory_match', { level: 'classic' });
  assert.equal(room.info().maxSeats, 5);
  const send = (ws, t, fields) => room.webSocketMessage(ws, JSON.stringify({ t, v: 1, ...fields }));
  const players = [socket(sockets), socket(sockets), socket(sockets)];
  for (const [seat, ws] of players.entries()) await send(ws, 'hello', { clientId: ids[seat] });
  await send(players[0], 'start');
  const started = players[0].messages.at(-1);
  assert.deepEqual(started.roundSeats, [0, 1, 2]);
  assert.deepEqual(players[2].messages.at(-1), started);
  await send(players[0], 'move', { round: 1, seq: 1, data: { card: 4 } });
  const extra = socket(sockets);
  await send(extra, 'hello', { clientId: ids[3] });
  assert.equal(extra.readyState, WebSocket.CLOSED);

  players[2].close();
  await send(players[0], 'vacate', { seat: 2 });
  const replacement = socket(sockets);
  await send(replacement, 'hello', { clientId: ids[4] });
  const welcome = replacement.messages[0];
  assert.equal(welcome.seat, 2);
  assert.equal(welcome.seed, started.seed);
  assert.deepEqual(welcome.roundSeats, started.roundSeats);
  const replay = welcome.log.reduce((state, move) => flipCard(state, move.seat, move.data),
    makeMemoryBoard(welcome.options, welcome.seed, welcome.roundSeats));
  assert.equal(replay.revealed, 4);
  await send(players[0], 'rematch');
  assert.equal(replacement.messages.at(-1).round, 2);
  assert.deepEqual(replacement.messages.at(-1).roundSeats, started.roundSeats);
});

test('Northstar keeps fleets private while validating deployment, shots and reconnects', async () => {
  const context = roomContext();
  const sockets = [];
  context.getWebSockets = () => sockets;
  const room = new GameRoom(context, {});
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  await room.initialize(ids[0], 'northstar', {});
  const players = [socket(sockets), socket(sockets)];
  const send = (ws, t, fields) => room.webSocketMessage(ws, JSON.stringify({ t, v: 1, ...fields }));
  for (const [seat, ws] of players.entries()) await send(ws, 'hello', { clientId: ids[seat] });
  await send(players[0], 'start');
  const [a, b] = players.map(ws => ws.messages.at(-1));
  assert.equal(a.seed, null);
  assert.equal(a.view.stage, 'deployment');
  assert.deepEqual(a.view.fleet.map(ship => ship.cells.length), [5, 4, 3, 3, 2]);
  assert.deepEqual(Object.keys(a.view).sort(), [
    'enemySunk', 'fleet', 'incoming', 'lastShot', 'locked', 'outgoing', 'stage', 'turn', 'winner',
  ]);

  let seq = 1;
  async function action(seat, data, accepted = true) {
    await send(players[seat], 'move', { round: 1, seq, data });
    const msg = players[seat].messages.at(-1);
    if (accepted) {
      assert.equal(msg.t, 'northstar');
      assert.equal(msg.seq, seq++);
    } else assert.equal(msg.code, 'bad_request');
    return msg.view;
  }

  const enemy = b.view.fleet.flatMap(ship => ship.cells);
  const miss = b.view.incoming.findIndex((_, point) => !enemy.includes(point));
  await action(0, { action: 'fire', point: miss }, false);
  await action(0, { action: 'lock' });
  await action(0, { action: 'shuffle' }, false);
  await action(1, { action: 'lock' });
  await action(1, { action: 'fire', point: 0 }, false);
  await action(0, { action: 'fire', point: enemy[0] });
  await action(0, { action: 'fire', point: enemy[0] }, false);
  assert.equal((await action(0, { action: 'fire', point: miss })).turn, 1);

  const peer = socket(sockets);
  await send(peer, 'hello', { clientId: ids[0] });
  const welcome = peer.messages[0];
  assert.deepEqual(welcome.log, []);
  assert.deepEqual(welcome.view.fleet, a.view.fleet);
  assert.equal(welcome.view.outgoing[enemy[0]], 'hit');
  assert.equal(welcome.view.outgoing[miss], 'miss');
  players[0] = peer;

  const ownPoints = a.view.fleet.flatMap(ship => ship.cells);
  const replyMiss = a.view.incoming.findIndex((_, point) => !ownPoints.includes(point));
  await action(1, { action: 'fire', point: replyMiss });
  for (const point of enemy.slice(1)) await action(0, { action: 'fire', point });
  assert.equal(peer.messages.at(-1).view.winner, 0);
  assert.equal(peer.messages.at(-1).view.enemySunk.length, 5);
  await send(peer, 'rematch');
  assert.equal(peer.messages.at(-1).round, 2);
  assert.equal(peer.messages.at(-1).view.stage, 'deployment');
});
