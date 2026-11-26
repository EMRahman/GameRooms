import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { makeBoard, playLine } from '../public/dots-rules.js';

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
  const create = async (index, key = '') => worker.fetch(new Request('https://games.example/api/rooms', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': `192.0.2.${index}`, 'X-Owner-Key': key },
    body: JSON.stringify({ game: 'dots_and_boxes', clientId: crypto.randomUUID() }),
  }), env);
  // Node lacks the Worker-specific method. Preserve equal-length constant-time comparison.
  const { timingSafeEqual } = await import('node:crypto');
  crypto.subtle.timingSafeEqual = (a, b) => timingSafeEqual(Buffer.from(a), Buffer.from(b));
  try {
    assert.equal((await create(1, env.OWNER_KEY)).status, 201);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => create(i + 2)));
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
  await room.initialize(ids[0], 4);
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
