import { DurableObject } from 'cloudflare:workers';
import { roomOptions, clientIdValid } from './protocol.js';
export { GameRoom } from './room.js';

const alphabet = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const roomRoute = new RegExp(`^/api/rooms/([${alphabet}]{5})(/ws)?$`);
const hour = 3600000;
const day = 24 * hour;
const encoder = new TextEncoder();
const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

function roomCode() {
  let code = '';
  while (code.length < 5) {
    const [byte] = crypto.getRandomValues(new Uint8Array(1));
    if (byte < 256 - 256 % alphabet.length) code += alphabet[byte % alphabet.length];
  }
  return code;
}

async function ownerRequest(request, key) {
  const supplied = request.headers.get('X-Owner-Key');
  if (!key || !supplied) return false;
  const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));
  const [a, b] = await Promise.all([digest(supplied), digest(key)]);
  return crypto.subtle.timingSafeEqual(a, b);
}

function limit(value, fallback) {
  return /^\d+$/.test(value ?? '') ? Number(value) : fallback;
}

function network(ip) {
  if (!ip?.includes(':')) return ip ?? 'local';
  const [left, right] = ip.toLowerCase().split('::');
  const head = left ? left.split(':') : [];
  if (right !== undefined) {
    const tail = right ? right.split(':') : [];
    head.push(...Array(Math.max(0, 8 - head.length - tail.length)).fill('0'), ...tail);
  }
  return head.slice(0, 4).map(group => group.padStart(4, '0')).join(':');
}

export class Budget extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS counters (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS settings (salt TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS live (code TEXT PRIMARY KEY)');
  }

  // Rooms with at least one seated player connected right now.
  async setLive(code, live) {
    if (live) this.sql.exec('INSERT OR IGNORE INTO live VALUES (?)', code);
    else this.sql.exec('DELETE FROM live WHERE code = ?', code);
  }

  async stats() {
    const now = Date.now();
    this.sql.exec('DELETE FROM counters WHERE expires <= ?', now);
    const roomsToday = this.sql.exec("SELECT count FROM counters WHERE id = 'day'").toArray()[0]?.count ?? 0;
    const dailyLimit = Math.min(10, limit(this.env.DAILY_ROOM_LIMIT, 10));
    const inUse = this.sql.exec('SELECT COUNT(*) AS n FROM live').toArray()[0].n;
    return {
      dailyLimit,
      roomsToday,
      remaining: Math.max(0, dailyLimit - roomsToday),
      inUse,
      resetsAt: new Date((Math.floor(now / day) + 1) * day).toISOString(),
    };
  }

  async claim(ip, owner) {
    let salt = this.sql.exec('SELECT salt FROM settings').toArray()[0]?.salt;
    if (!salt) {
      salt = crypto.randomUUID();
      this.sql.exec('INSERT INTO settings VALUES (?)', salt);
    }
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(salt + ip));
    const now = Date.now();
    const dailyReset = (Math.floor(now / day) + 1) * day;
    const hourlyReset = (Math.floor(now / hour) + 1) * hour;
    const daily = 'day';
    const hourly = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    return this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM counters WHERE expires <= ?', now);
      const count = id => this.sql.exec('SELECT count FROM counters WHERE id = ?', id).toArray()[0]?.count ?? 0;
      if (!owner && count(daily) >= Math.min(10, limit(this.env.DAILY_ROOM_LIMIT, 10))) return { resetsAt: dailyReset };
      if (!owner && count(hourly) >= limit(this.env.HOURLY_ROOMS_PER_NETWORK, 3)) return { resetsAt: hourlyReset };
      for (const [id, expires] of [[daily, dailyReset], [hourly, hourlyReset]]) {
        this.sql.exec('INSERT INTO counters VALUES (?, 1, ?) ON CONFLICT(id) DO UPDATE SET count = count + 1', id, expires);
      }
      return { ok: true };
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;
    const origin = request.headers.get('Origin');
    const upgrade = request.headers.get('Upgrade')?.toLowerCase() === 'websocket';

    if ((origin && origin !== url.origin) || (upgrade && origin !== url.origin)) return json({ error: 'Forbidden' }, 403);

    if (pathname === '/api/rooms' && request.method === 'POST') {
      let body;
      try {
        const raw = await request.text();
        if (encoder.encode(raw).length > 4096) return json({ error: 'Request too large' }, 413);
        body = JSON.parse(raw);
      } catch {
        return json({ error: 'Invalid request' }, 400);
      }
      const options = roomOptions(body?.game, body?.options);
      if (!options || !clientIdValid(body.clientId)) {
        return json({ error: 'Invalid game, player or board size' }, 400);
      }
      const owner = await ownerRequest(request, env.OWNER_KEY);
      const budget = await env.BUDGET.getByName('rooms').claim(network(request.headers.get('CF-Connecting-IP')), owner);
      if (!budget.ok) return json({ error: 'Room creation limit reached', resetsAt: budget.resetsAt }, 429);
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = roomCode();
        if (await env.ROOM.getByName(code).initialize(body.clientId, body.game, options, code)) return json({ code }, 201);
      }
      return json({ error: 'Could not create a room' }, 503);
    }

    if (pathname === '/api/stats' && request.method === 'GET') {
      return json(await env.BUDGET.getByName('rooms').stats());
    }

    if (request.method === 'GET' && /^\/(dots_and_boxes|fourfold|go|memory_match|northstar|iron_routes|landlord|conquest)(\.html)?$/.test(pathname)) {
      return env.ASSETS.fetch(new URL('/', url));
    }

    const match = pathname.match(roomRoute);
    if (match && request.method === 'GET') {
      const room = env.ROOM.getByName(match[1]);
      if (match[2]) return upgrade ? room.fetch(request) : json({ error: 'WebSocket required' }, 426);
      const info = await room.info();
      return info ? json(info) : json({ error: 'Room not found' }, 404);
    }
    return json({ error: 'Not found' }, 404);
  },
};
