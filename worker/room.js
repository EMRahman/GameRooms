import { DurableObject } from 'cloudflare:workers';
import { game, clientIdValid } from './protocol.js';
import { validLine } from '../public/dots-rules.js';

const hour = 3600000;
const encoder = new TextEncoder();
const send = (ws, message) => ws.send(JSON.stringify({ v: 1, ...message }));

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.storage = ctx.storage;
    this.sql = ctx.storage.sql;
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping","v":1}', '{"t":"pong","v":1}'));
  }

  async initialize(clientId, size) {
    if (this.room) return false;
    this.sql.exec('CREATE TABLE IF NOT EXISTS moves (round INTEGER, seq INTEGER, seat INTEGER, data TEXT, PRIMARY KEY (round, seq))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY, seat INTEGER, name TEXT, text TEXT, ts INTEGER)');
    this.room = {
      size, phase: 'lobby', round: 0, seq: 0, seed: null, count: 0,
      hostSeat: 0, seats: [{ clientId, name: 'Player 1' }, null], blocked: [],
    };
    await this.storage.setAlarm(Date.now() + hour);
    return true;
  }

  get room() { return this.storage.kv.get('room'); }
  set room(room) { this.storage.kv.put('room', room); }

  info() {
    const room = this.room;
    if (room) return { game, phase: room.phase, maxSeats: 2, seatsTaken: room.seats.filter(Boolean).length };
    return null;
  }

  sockets() {
    return this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN);
  }

  seated() {
    return this.sockets().filter(ws => Number.isInteger(ws.deserializeAttachment()?.seat));
  }

  players(room) {
    const connected = new Set(this.seated().map(ws => ws.deserializeAttachment().seat));
    return room.seats.flatMap((player, seat) => player ? [{ seat, name: player.name, connected: connected.has(seat) }] : []);
  }

  broadcast(message) {
    for (const ws of this.seated()) send(ws, message);
  }

  roster(room) {
    this.broadcast({ t: 'players', hostSeat: room.hostSeat, players: this.players(room) });
  }

  fetch() {
    if (!this.room) return new Response('Room not found', { status: 404 });
    const sockets = this.sockets();
    if (sockets.length >= 4) {
      const pending = sockets.find(ws => ws.deserializeAttachment()?.seat == null);
      if (!pending) return new Response('Room full', { status: 409 });
      pending.close(4009, 'Room full');
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const room = this.room;
    if (!room) return ws.close(4004, 'Room expired');
    const error = code => send(ws, { t: 'error', code });
    if (typeof raw !== 'string' || encoder.encode(raw).length > 4096) return error('bad_request');
    let msg;
    try { msg = JSON.parse(raw); } catch { return error('bad_request'); }
    if (!msg || typeof msg.t !== 'string') return error('bad_request');
    if (msg.v !== 1) return ws.close(4010, 'Refresh to update');
    const attachment = ws.deserializeAttachment();
    if (!attachment) {
      if (msg.t !== 'hello' || !clientIdValid(msg.clientId)) return error('bad_request');
      return this.join(ws, room, msg);
    }
    const { seat, clientId } = attachment;
    if (room.seats[seat]?.clientId !== clientId) return ws.close(4003, 'Seat unavailable');
    const host = seat === room.hostSeat;
    const connected = this.players(room).filter(player => player.connected);
    switch (msg.t) {
      case 'start':
      case 'rematch': {
        if (!host || connected.length !== 2 || (msg.t === 'start') !== (room.phase === 'lobby')) return error('bad_request');
        room.phase = 'playing';
        room.round++;
        room.seq = 0;
        room.seed = crypto.getRandomValues(new Uint32Array(1))[0];
        this.room = room;
        this.broadcast({ t: 'started', round: room.round, seed: room.seed, options: { size: room.size }, players: this.players(room) });
        break;
      }
      case 'move': {
        if (room.phase !== 'playing' || !validLine(room.size, msg.data)) return error('bad_request');
        if (msg.round !== room.round || msg.seq !== room.seq + 1) return send(ws, { t: 'error', code: 'seq_mismatch', expectedSeq: room.seq + 1 });
        if (room.count >= 2000) return error('room_limit');
        const { axis, row, col } = msg.data;
        const data = { axis, row, col };
        this.storage.transactionSync(() => {
          room.seq++;
          room.count++;
          this.sql.exec('INSERT INTO moves VALUES (?, ?, ?, ?)', room.round, room.seq, seat, JSON.stringify(data));
          this.room = room;
        });
        this.broadcast({ t: 'move', round: room.round, seq: room.seq, seat, data });
        break;
      }
      case 'chat': {
        const text = typeof msg.text === 'string' ? msg.text.trim() : '';
        if (!text || text.length > 280) return error('bad_request');
        const ts = Date.now();
        if (ts - attachment.lastChatAt < 1000) return error('rate_limited');
        if (room.count >= 2000) return error('room_limit');
        const name = room.seats[seat].name;
        const id = this.storage.transactionSync(() => {
          room.count++;
          this.room = room;
          return this.sql.exec('INSERT INTO chat (seat, name, text, ts) VALUES (?, ?, ?, ?) RETURNING id', seat, name, text, ts).one().id;
        });
        ws.serializeAttachment({ ...attachment, lastChatAt: ts });
        this.broadcast({ t: 'chat', id, seat, name, text, ts });
        break;
      }
      case 'leave':
        if (room.phase !== 'lobby') return error('bad_request');
        room.seats[seat] = null;
        if (host) room.hostSeat = connected.find(player => player.seat !== seat)?.seat ?? 1 - seat;
        this.room = room;
        ws.close(4000, 'Left room');
        this.roster(room);
        break;
      case 'kick':
      case 'vacate': {
        const target = msg.seat;
        const kicking = msg.t === 'kick';
        if (!host || ![0, 1].includes(target) || target === seat || !room.seats[target] ||
            (kicking ? room.phase !== 'lobby' : room.phase !== 'playing' || connected.some(player => player.seat === target))) return error('bad_request');
        if (kicking) room.blocked.push(room.seats[target].clientId);
        room.seats[target] = null;
        this.room = room;
        this.seated().find(peer => peer.deserializeAttachment().seat === target)?.close(4003, 'Removed by host');
        this.roster(room);
        break;
      }
      case 'claim_host':
        if (connected.some(player => player.seat === room.hostSeat)) return error('bad_request');
        room.hostSeat = seat;
        this.room = room;
        this.roster(room);
        break;
      default:
        return error('bad_request');
    }
    await this.storage.setAlarm(Date.now() + (this.seated().length ? 48 : 24) * hour);
  }

  async join(ws, room, msg) {
    if (room.blocked.includes(msg.clientId)) return ws.close(4003, 'Removed by host');
    let seat = room.seats.findIndex(player => player?.clientId === msg.clientId);
    if (seat < 0) seat = room.seats.indexOf(null);
    if (seat < 0) return ws.close(4009, 'Room full');
    const old = this.seated().find(peer => peer.deserializeAttachment().seat === seat);
    const name = (typeof msg.name === 'string' ? msg.name.trim().slice(0, 20) : '') || `Player ${seat + 1}`;
    room.seats[seat] = { clientId: msg.clientId, name };
    if (!room.seats[room.hostSeat]) room.hostSeat = seat;
    this.room = room;
    ws.serializeAttachment({ seat, clientId: msg.clientId, lastChatAt: old?.deserializeAttachment().lastChatAt ?? 0 });
    old?.close(4001, 'Connected elsewhere');
    const log = this.sql.exec('SELECT seq, seat, data FROM moves WHERE round = ? ORDER BY seq', room.round)
      .toArray().map(move => ({ ...move, data: JSON.parse(move.data) }));
    const chat = this.sql.exec('SELECT * FROM chat ORDER BY id DESC LIMIT 100').toArray().reverse();
    send(ws, { t: 'welcome', game, phase: room.phase, round: room.round, seq: room.seq, seed: room.seed, options: { size: room.size }, seat,
      hostSeat: room.hostSeat, players: this.players(room), log, chat });
    this.roster(room);
    await this.storage.setAlarm(Date.now() + 48 * hour);
  }

  async webSocketClose(ws) {
    ws.close();
    const room = this.room;
    if (!room || !ws.deserializeAttachment()) return;
    this.roster(room);
    if (!this.seated().length) {
      const expiry = await this.storage.getAlarm();
      await this.storage.setAlarm(Math.min(expiry ?? Infinity, Date.now() + 24 * hour));
    }
  }

  webSocketError(ws) { return this.webSocketClose(ws); }

  async alarm() {
    for (const ws of this.sockets()) ws.close(4004, 'Room expired');
    await this.storage.deleteAll();
  }
}
