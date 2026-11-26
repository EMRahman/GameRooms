import { DurableObject } from 'cloudflare:workers';
import { defaultGame, clientIdValid, maxSeats, roomMove } from './protocol.js';
import { authoritative } from './authoritative.js';

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

  async initialize(clientId, game, options, code) {
    if (this.room) return false;
    this.storage.kv.put('code', code);
    this.sql.exec('CREATE TABLE IF NOT EXISTS moves (round INTEGER, seq INTEGER, seat INTEGER, data TEXT, PRIMARY KEY (round, seq))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chat (id INTEGER PRIMARY KEY, seat INTEGER, name TEXT, text TEXT, ts INTEGER)');
    const seats = Array(maxSeats(game)).fill(null);
    seats[0] = { clientId, name: 'Player 1' };
    this.room = {
      game, options, phase: 'lobby', round: 0, seq: 0, seed: null, count: 0,
      hostSeat: 0, seats, blocked: [],
    };
    await this.storage.setAlarm(Date.now() + hour);
    return true;
  }

  get room() {
    const room = this.storage.kv.get('room');
    if (room && !room.game) return { ...room, game: defaultGame, options: { size: room.size } };
    // Rooms saved before the authoritative registry kept Northstar's state as `battle`.
    if (room?.battle) {
      const { battle, ...rest } = room;
      return { ...rest, state: battle };
    }
    return room;
  }
  set room(room) { this.storage.kv.put('room', room); }

  info() {
    const room = this.room;
    if (room) return { game: room.game, phase: room.phase, maxSeats: room.seats.length, seatsTaken: room.seats.filter(Boolean).length };
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

  // Sends each seat its own view of an authoritative game's state.
  sendViews(room, message) {
    const rules = authoritative[room.game];
    for (const ws of this.seated()) {
      const { seat } = ws.deserializeAttachment();
      send(ws, { ...message, view: rules.view(room.state, seat) });
    }
  }

  roster(room) {
    this.broadcast({ t: 'players', hostSeat: room.hostSeat, players: this.players(room) });
    void this.syncLive().catch(() => {});
  }

  // Keeps the budget's count of rooms in use in step with whether anyone is seated and connected.
  async syncLive() {
    const code = this.storage.kv.get('code');
    const live = this.seated().length > 0;
    if (!code || !this.env.BUDGET || live === Boolean(this.storage.kv.get('live'))) return;
    this.storage.kv.put('live', live);
    await this.env.BUDGET.getByName('rooms').setLive(code, live);
  }

  fetch() {
    const room = this.room;
    if (!room) return new Response('Room not found', { status: 404 });
    const sockets = this.sockets();
    if (sockets.length >= room.seats.length + 2) {
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
        const roster = room.roundSeats ?? room.seats.flatMap((player, seat) => player ? [seat] : []);
        if (!host || roster.length < 2 || connected.length !== roster.length ||
            (msg.t === 'start') !== (room.phase === 'lobby')) return error('bad_request');
        const rules = authoritative[room.game];
        if (rules && msg.t === 'rematch' && !rules.finished(room.state)) return error('bad_request');
        this.startRound(room, roster);
        break;
      }
      case 'end':
        if (room.phase !== 'playing') return error('bad_request');
        this.endRound(room);
        this.room = room;
        this.broadcast({ t: 'ended' });
        break;
      case 'move': {
        if (room.phase !== 'playing') return error('bad_request');
        const rules = authoritative[room.game];
        // The server validates authoritative moves against its own state, so a stale `seq`
        // (for example two players choosing tickets at once) is harmless there.
        if (msg.round !== room.round || (!rules && msg.seq !== room.seq + 1)) return send(ws, { t: 'error', code: 'seq_mismatch', expectedSeq: room.seq + 1 });
        if (room.count >= 2000) return error('room_limit');
        if (rules) {
          if (!rules.apply(room.state, seat, msg.data)) return error('bad_request');
          room.seq++;
          room.count++;
          this.room = room;
          this.sendViews(room, { t: 'state', round: room.round, seq: room.seq });
          break;
        }
        const data = roomMove(room.game, room.options, msg.data);
        if (!data) return error('bad_request');
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
      case 'leave': {
        // Leaving mid-game ends the game for everyone still here.
        const ending = room.phase === 'playing';
        if (ending) this.endRound(room);
        room.seats[seat] = null;
        if (host) room.hostSeat = connected.find(player => player.seat !== seat)?.seat ?? room.seats.findIndex(Boolean);
        this.room = room;
        if (ending) this.broadcast({ t: 'ended' });
        ws.close(4000, 'Left room');
        this.roster(room);
        break;
      }
      case 'kick':
      case 'vacate': {
        const target = msg.seat;
        const kicking = msg.t === 'kick';
        if (!host || !Number.isInteger(target) || target === seat || !room.seats[target] ||
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

  // Begins a round for the given seats. Games with authoritative state get per-seat views.
  startRound(room, roster) {
    const rules = authoritative[room.game];
    room.roundSeats = roster;
    room.phase = 'playing';
    room.round++;
    room.seq = 0;
    room.seed = rules ? null : crypto.getRandomValues(new Uint32Array(1))[0];
    if (rules) room.state = rules.make(roster);
    this.room = room;
    const started = { t: 'started', round: room.round, seed: room.seed, options: room.options, roundSeats: room.roundSeats, players: this.players(room) };
    if (rules) this.sendViews(room, started);
    else this.broadcast(started);
  }

  // Returns a room to its lobby. Seats stay filled; the next round uses whoever is seated.
  endRound(room) {
    room.phase = 'lobby';
    room.seed = null;
    delete room.roundSeats;
    delete room.state;
  }

  async join(ws, room, msg) {
    if (room.blocked.includes(msg.clientId)) return ws.close(4003, 'Removed by host');
    let seat = room.seats.findIndex(player => player?.clientId === msg.clientId);
    if (seat < 0) {
      seat = room.seats.findIndex((player, index) =>
        player === null && (!room.roundSeats || room.roundSeats.includes(index)));
    }
    if (seat < 0) return ws.close(4009, 'Room full');
    const old = this.seated().find(peer => peer.deserializeAttachment().seat === seat);
    const name = (typeof msg.name === 'string' ? msg.name.trim().slice(0, 20) : '') || `Player ${seat + 1}`;
    room.seats[seat] = { clientId: msg.clientId, name };
    if (!room.seats[room.hostSeat]) room.hostSeat = seat;
    this.room = room;
    ws.serializeAttachment({ seat, clientId: msg.clientId, lastChatAt: old?.deserializeAttachment().lastChatAt ?? 0 });
    old?.close(4001, 'Connected elsewhere');
    // Moves belong to a round; a lobby has none to replay.
    const log = room.phase === 'playing'
      ? this.sql.exec('SELECT seq, seat, data FROM moves WHERE round = ? ORDER BY seq', room.round)
        .toArray().map(move => ({ ...move, data: JSON.parse(move.data) }))
      : [];
    const chat = this.sql.exec('SELECT * FROM chat ORDER BY id DESC LIMIT 100').toArray().reverse();
    const view = room.state ? authoritative[room.game].view(room.state, seat) : undefined;
    send(ws, { t: 'welcome', view, game: room.game, phase: room.phase, round: room.round, seq: room.seq, seed: room.seed, options: room.options, seat,
      hostSeat: room.hostSeat, maxSeats: room.seats.length, roundSeats: room.roundSeats, players: this.players(room), log, chat });
    this.roster(room);
    // Two-seat games start as soon as the second player is connected. Larger games wait for the host.
    const filled = room.seats.flatMap((player, index) => player ? [index] : []);
    const connectedCount = this.players(room).filter(player => player.connected).length;
    if (room.phase === 'lobby' && room.seats.length === 2 && filled.length === 2 && connectedCount === 2) this.startRound(room, filled);
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
    if (this.storage.kv.get('live') && this.env.BUDGET) {
      await this.env.BUDGET.getByName('rooms').setLive(this.storage.kv.get('code'), false);
    }
    for (const ws of this.sockets()) ws.close(4004, 'Room expired');
    await this.storage.deleteAll();
  }
}
