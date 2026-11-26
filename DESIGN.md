# GameRooms: Design Document

Status: draft v0.4

> Repository hygiene: this document must not contain personal details such as
> local filesystem paths, usernames, account IDs or API tokens. Refer to the
> sibling single-device repository only as `Games`. Check this before every
> commit to a public repository.

## 1. Goal

Let two or more people play the multiplayer games from the `Games` repository
together over the internet. One player creates a room, shares a QR code or
link, and others join from phones, tablets or desktops. Every room has a chat. From the first
playable pilot, anyone can deploy their own copy on a free Cloudflare account.

## 2. Non-goals

- Accounts, logins, matchmaking, leaderboards.
- Server-side rule enforcement in v1 (see section 11; planned for phase 4).
- Spectator mode, undo/takebacks in v1, voice or video, persistent chat history
  beyond a room's lifetime.
- Any paid Cloudflare feature.

## 3. Games in scope

| Game | Players | Information | Model |
|---|---|---|---|
| dots_and_boxes | 2 | Open | Relay (phase 1 pilot) |
| fourfold | 2 | Open | Relay (phase 2) |
| go | 2 | Open | Relay (phase 2) |
| memory_match | up to 5 | Open (seed-derived deck) | Relay (phase 2) |
| northstar | 2 | Hidden fleets | Authoritative (shipped) |
| landlord | 2-6 | Deck order only | Authoritative (shipped) |
| iron_routes | 2-5 | Hidden hands and tickets | Authoritative (shipped) |
| conquest | 2-6 | Hidden info | Phase 4 (authoritative) |

Single-player games (snake, pocket_snake, driftbelt, linefall) remain only in `Games`.
The first release covers the four open-information games. Hidden-information games
(including `northstar`, whose fleets are secret per player) are deferred until the
authoritative model exists in phase 4, because a relay would expose private state to
every browser. For `memory_match`, deriving the shuffled deck from the room `seed` is
accepted under the friend-trust relay model.

## 4. Architecture

```
 Browser (game page served by Workers Static Assets)
    |  HTTPS: POST /api/rooms        -> create room, returns {code}
    |  HTTPS: GET  /api/rooms/:code  -> room metadata ({game, phase, seatsTaken, maxSeats})
    |  WSS:   /api/rooms/:code/ws    -> join room
    v
 Cloudflare Worker (router, game registry, origin check)
    |  env.BUDGET (one instance)            -> daily & per-network room counts
    |  env.ROOM.idFromName(code).get()
    v
 GameRoom Durable Object (one per room; SQLite + WebSocket Hibernation API)
    - initialization check, seats, host, round, seed, options
    - append-only relayed move log (round, seq)
    - append-only chat (last 100 returned on join)
```

- **Worker**: stateless. Holds a static server-side `GAMES` registry (`minSeats`,
  `maxSeats`, options schema), validates the room code format and `Origin` header,
  and routes requests to `Budget` or `GameRoom`.
- **Budget Durable Object**: a single SQLite-backed instance that counts new rooms
  per UTC day and per network per hour (section 10). Only room creation writes to it.
- **GameRoom Durable Object**: one instance per room code, using the SQLite storage
  backend (`new_sqlite_classes`, the only Durable Object backend available on the
  free plan) and the WebSocket Hibernation API so idle rooms cost no duration
  charges. Because `idFromName(code).get()` lazily addresses any valid code, every
  `GameRoom` checks an `initialized` flag in SQLite before returning metadata or
  accepting a WebSocket upgrade; uncreated rooms return `404` without writing any
  storage rows.
- **Client**: a shared `multiplayer.js` module used by every game page, plus a
  shared lobby and chat UI.

### Hosting

- The public repository's README includes a **Deploy to Cloudflare** button from
  the first pilot. The root Wrangler configuration deploys the game pages in
  `public/`, the Worker API and both SQLite Durable Object bindings together.
  [Deploy to Cloudflare documentation](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- Players open one `workers.dev` URL. The browser uses the same origin for API
  calls, WebSocket connections, QR codes and share links. Each deployment's links
  bring friends back to that deployment.
- Game pages keep the same file names as in `Games` (for example `go.html`). The
  `Games` cards later gain a "Play online" link to the matching page.

## 5. Room lifecycle

1. **Create**: the client calls `POST /api/rooms` with `{game, clientId, options?}`.
   The Worker validates `game` (and any bounded game `options`, such as board size)
   against its server-side `GAMES` registry, then claims a slot from `Budget`
   (section 10, including the owner-key exception). If refused, it returns `429` with `resetsAt`, and the page
   disables "Create room" and shows when it reopens. Otherwise the Worker generates a
   5-character code from an unambiguous 30-character alphabet
   (`23456789ABCDEFGHJKMNPQRSTVWXYZ`, no `0/O`, `1/I/L`, or `U`) using rejection
   sampling on `crypto.getRandomValues`, retries on the rare chance of collision with
   an active room, initializes the `GameRoom` DO (reserving seat 0 and host for the
   creator's `clientId` and setting an initial 1-hour expiry alarm so abandoned
   unjoined rooms are cleaned up), and returns `{code}`.
2. **Share**: the lobby shows the 5-character code, a room-level link
   `https://<host>/?room=CODE` and a locally generated QR code of that link.
3. **Join**: scanning the QR opens `/?room=CODE` (entering the code in `index.html`
   follows the exact same path). `index.html` calls `GET /api/rooms/:code` (normalizing
   the code to uppercase), handles `404` ("Room not found") cleanly, and redirects to
   `<game>.html?room=CODE`. Opening `<game>.html?room=CODE` directly also works; if
   `welcome.game` mismatches the current page, the client redirects to the right game.
   The page asks for an optional display name (stored in `localStorage`, defaulting to
   `Player N`) and opens the WebSocket.
4. **Seating and reconnect**: the client sends `hello {v, clientId, name, round?, lastSeq?}`.
   - If `clientId` is blocked (kicked), the room closes the socket with code `4003`.
   - If `clientId` already holds a seat, the room reclaims it and closes any older
     socket for that `clientId` with code `4001` (replaced by another tab/session).
   - Otherwise, if a seat is open (in the lobby, or a seat vacated mid-game by the
     host), the room assigns the lowest free seat and binds it to `clientId`.
   - If no seat is available, the room closes the socket with code `4009` (room full).
5. **Start**: the host sends `start {options?}` once at least `minSeats` players are
   seated. The room increments `round` (from `0` to `1`), locks `options`, generates
   a random `seed`, switches `phase` to `"playing"`, and broadcasts `started`. Seat
   order is fixed for the round.
6. **Play**: moves are relayed with `round` and strictly sequential `seq` (section 6).
7. **Lobby leave, kick, seat takeover and host recovery**:
   - In the lobby, any player can voluntarily send `leave` to free their seat; if the
     host leaves, host transfers to the lowest connected seat.
   - In the lobby, the host can `kick {seat}` to close that player's socket (`4003`),
     free the seat, and block that `clientId` for the room.
   - Mid-game, if a player loses their `clientId` (dead phone, or moving from an
     in-app messaging WebView to Safari), the host can send `vacate {seat}` for any
     *disconnected* seat. This unbinds the old `clientId` without ending the game so
     the player can rejoin, claim the vacated seat, and replay the log to resume.
   - If the host permanently disconnects without sending `leave`, any connected
     seated player can send `claim_host`; the DO accepts it only if the current host
     has no open socket (requiring no server timers).
8. **Rematch and expiry**:
   - Games that finish remain in the room so players can chat and rematch. The host
     sends `rematch {options?}` to start `round + 1` with a fresh `seed` and `seq = 0`,
     keeping the room and seats.
   - Expiry uses Durable Object alarms: a 1-hour alarm is set on creation (if nobody
     ever connects); once clients connect, a 24-hour alarm is scheduled whenever the
     last socket closes. Rooms also enforce a hard 48-hour cap from the last non-ping
     message so an abandoned background tab sending pings cannot keep a room open
     indefinitely. On expiry, the alarm closes any remaining sockets and calls
     `ctx.storage.deleteAll()`.

## 6. Relay model

The Durable Object does not know the rules of any game. Clients send:

```json
{ "t": "move", "v": 1, "round": 1, "seq": 42, "data": { /* game-specific */ } }
```

The room handles messages synchronously against SQLite (`ctx.storage.sql`) so two
concurrent moves can never interleave. It checks only that:

- raw UTF-8 byte length is within the 4 KB limit (checked before `JSON.parse`),
- the sender holds a seat and `phase === "playing"`,
- `round === currentRound` and `seq === expectedSeq`,
- the room has not reached its lifetime message cap (2,000 stored messages).

The room deliberately does **not** enforce round-robin turn order in Relay mode:
extra-turn games (`dots_and_boxes`, `memory_match`), out-of-turn actions (`resign`,
Go dead-stone marking), and `seed`-selected starting players all violate strict
alternation. Requiring `seq === expectedSeq` provides optimistic concurrency control
so simultaneous moves cannot race—one succeeds and the other receives `error
{code: "seq_mismatch", expectedSeq}`.

On acceptance, the room stamps the sender's `seat` (never trusting client-supplied
seat info), appends `(round, seq, seat, data)` to the move log, and broadcasts the
message to all connected clients, including the sender. The sender applies its own
move only when echoed back, keeping ordering identical everywhere, and locks local
input while a move is in flight to prevent accidental double-taps.

**Rejoin and rematch catch-up**: a client sends `{round, lastSeq}` in `hello`. If
`hello.round === currentRound`, the room replays only moves with `seq > lastSeq`. If
`hello.round !== currentRound` (fresh join, page refresh, or reconnecting across a
rematch), the room ignores `lastSeq` and returns the full move log for `currentRound`
along with `seed` and `options`.

**Determinism**: every game must be a pure deterministic function of
`(seed, options, moves[])`. `multiplayer.js` provides a shared seeded PRNG (e.g.
Mulberry32); games must never call `Math.random()`. Logical state transitions must
not depend on wall-clock timers or UI animations (for example, in `memory_match`, a
mismatch advances the logical turn immediately while the UI briefly shows the
previous pair).

**Trust**: clients are trusted in Relay mode. A modified client can send illegal
moves or inspect client-seeded hidden cards in `memory_match`. This is accepted for
casual games among friends; section 11 describes phase 4 server verification.

## 7. Chat

- Per room only. Messages travel over the same WebSocket (`{t: "chat", v: 1, text}`),
  so no extra endpoints are needed.
- Chat messages are stored append-only under the room's lifetime message cap; on join,
  the room queries `ORDER BY id DESC LIMIT 100` (reversed before sending) rather than
  deleting old rows on every insert.
- Limits: 280 characters after trimming (empty messages rejected), 1 message per
  second per client (tracked in `ws.serializeAttachment()` so it survives hibernation
  without DB writes), display names up to 20 characters (defaulting to `Player N`).
  Messages carry `seat` so identical names remain distinguishable. Text is always
  rendered with `textContent`, never as HTML.
- System messages (`seat: null`): joined, left, reconnected, vacated, host changed,
  game started, rematch started.
- UI: a side panel on desktop, a bottom drawer on phones with an unread badge. Targets
  are at least 44 by 44 CSS pixels and respect `env(safe-area-inset-*)`.

## 8. Protocol summary

All messages are JSON objects with `t` (type) and `v` (integer protocol version,
initially `1`). Unknown versions are rejected with close code `4010`, prompting the
user to refresh.

**Client to server:**
- `hello {v, clientId, name?, round?, lastSeq?}`
- `start {v, options?}` — host only, in lobby
- `move {v, round, seq, data}` — seated player, while playing
- `chat {v, text}` — seated player
- `rematch {v, options?}` — host only; advances `round`, resets `seq`, generates new `seed`
- `kick {v, seat}` — host only, in lobby; closes socket (`4003`), frees seat, blocks `clientId`
- `vacate {v, seat}` — host only, while playing; unbinds a disconnected seat's `clientId`
- `leave {v}` — voluntarily frees own seat in lobby (transfers host if sender was host)
- `claim_host {v}` — connected seated player claims host if current host is disconnected
- `ping {v}` — exact string `{"t":"ping","v":1}`, answered via `setWebSocketAutoResponse`

**Server to client:**
- `welcome {v, game, phase, round, seat, hostSeat, minSeats, maxSeats, players, options, seed, seq, log, chat}`
- `players {v, hostSeat, players}` — roster or connection-state change
- `started {v, round, seed, options, players}` — sent on `start` and `rematch`
- `move {v, round, seq, seat, data}` — server-stamped move broadcast
- `chat {v, id, seat, name, text, ts}`
- `error {v, code, expectedSeq?}` — non-fatal errors (e.g. `seq_mismatch`, `rate_limited`, `room_limit`, `bad_request`)
- `pong {v}` — exact string `{"t":"pong","v":1}`

Each entry in `players` is `{seat, name, connected}`. The server **never** sends any
player's `clientId` to other clients.

**Terminal WebSocket close codes** (client stops auto-reconnect and shows an
actionable message instead of looping):
- `4001` — session replaced by another tab/device using the same `clientId` (offer a "Reconnect here" button)
- `4003` — kicked by host
- `4004` — room not found or expired
- `4009` — room full
- `4010` — protocol version mismatch (prompt page refresh)

## 9. Client structure

```
GameRooms/
  DESIGN.md
  shared/
    rules/           pure ES game rule modules (no DOM), shared by client & phase 4 Worker
  README.md          Deploy to Cloudflare button and quick start
  wrangler.toml      Worker entry point, static assets, DO bindings and migrations
  worker/            Worker, GameRoom & Budget Durable Objects
  public/            game pages served by Workers Static Assets
    index.html       game picker, "join with code" box, and /?room=CODE router
    multiplayer.js   connection, reconnect, seeded PRNG, lobby, chat, QR
    vendor/qr.js     small MIT-licensed QR generator, committed locally
    <game>.html      each online game page, adapted from `Games`
  scripts/           checks (catalogue, links, secrets and paths)
  docs/              deployment and development notes
```

`multiplayer.js` exposes roughly:

```js
const room = Multiplayer.join({
  game,
  onSync({ phase, round, seat, hostSeat, seed, options, log }) {}, // full rebuild (no SFX/animations)
  onMove({ round, seq, seat, data }) {},                           // single live move
  onPlayers(players, hostSeat) {},
  onChat(message) {},
  onStatus(status) {},
});
room.send(moveData);   // attaches round & next seq; locks local input until echoed or errored
room.chat(text);
const rng = Multiplayer.prng(seed);
```

Each game separates its pure state reducer (`shared/rules/<game>.js`) from DOM
rendering so local input calls `room.send`, `onSync` rebuilds state silently on
refresh/reconnect/rematch, and `onMove` applies and animates live moves. Keeping
rules pure from phase 1 avoids code drift and makes phase 4 server validation a
direct import.

Reconnect uses exponential backoff, fires on `visibilitychange` (iOS Safari suspends
background sockets), and halts on terminal close codes (`4001`-`4010`).

## 10. Cloudflare free-plan fit

Figures were checked against Cloudflare's pricing pages in November 2026 and must be
re-checked before launch. Free limits apply per Cloudflare account, so they are shared
with any other Worker on the same account, and they reset at 00:00 UTC.

| Resource | Free per day | Typical room | 10 rooms |
|---|---|---|---|
| Durable Object requests (connections, alarms, incoming WebSocket messages at 20 to 1; outgoing messages are free) | 100,000 | ~80 | ~800 |
| Worker requests (room creation, lookups, WebSocket upgrades) | 100,000 | ~40 | ~400 |
| SQLite rows written (inserts, updates and deletes) | 100,000 | ~300-600 | ~3,000-6,000 |
| SQLite rows read | 5,000,000 | ~1,000 | ~10,000 |
| Duration | 13,000 GB-s | near 0 while hibernating | near 0 |

A typical room is 2-4 players, two or three games and some chat in one evening. The
upper row-write figure assumes that `ctx.storage.deleteAll()` on expiry is billed per
row. Rows written is the limit that matters most, because every move and chat message
is stored for replay.

- Durable Objects require the SQLite backend on the free plan (`new_sqlite_classes`
  in the migration).
- **Daily room limit.** Each deployment defaults to 10 new rooms per UTC day.
  The `Budget` Durable Object enforces 10 as the public ceiling even if
  `DAILY_ROOM_LIMIT` is set higher. The owner can lower the public limit or
  set it to zero to pause public creation. The hourly per-network limit
  (`HOURLY_ROOMS_PER_NETWORK`) defaults to 3. Joining, playing and rematching
  in existing rooms do not consume room slots.
- **Owner exception.** Only a creation request with a valid `X-Owner-Key` header
  can bypass the daily and per-network limits. The Worker verifies it against the
  deployment's optional `OWNER_KEY` secret. Every room created by the owner still
  counts toward the daily total. Without a configured key, all requests follow
  the public limits. Owners can set the key in the Cloudflare dashboard after deployment.
- **Per-room lifetime limit.** Each room stores up to 2,000 moves and chat messages
  combined (4 KB each) across all rounds. The ten-room estimates above cover ordinary
  play. Additional rooms created with the owner key use the same account allowance.
- **Usage**: `GET /api/stats` returns `{dailyLimit, roomsToday, remaining, resetsAt}`
  and is edge-cached in the Worker (`caches.default`, 60 s TTL) so it never funnels
  page views into `Budget`; the landing page does not poll `/api/stats` on load and
  instead reacts to `429` from `POST /api/rooms`. The Worker logs one anonymized line
  per creation attempt (`room-created` or `room-refused` with a reason).
- **Writes**: one row per move or chat message with no secondary indexes (`moves`
  uses `PRIMARY KEY (round, seq)`; `chat` uses `INTEGER PRIMARY KEY AUTOINCREMENT`).
  Chat is never trimmed row-by-row during play, old rounds are not deleted on
  rematch, seats are written only when they change, presence is never stored, and
  per-socket state (`clientId`, `seat`, `lastChatAt`) lives in
  `ws.serializeAttachment()` across hibernation.
- **Hibernation**: rooms use `ctx.acceptWebSocket()`, never `setTimeout` or
  `setInterval` (only alarms), and answer `{"t":"ping","v":1}` with
  `{"t":"pong","v":1}` via `setWebSocketAutoResponse`, which costs no duration. A
  room that cannot hibernate costs about 450 GB-s an hour, so the daily allowance
  covers only about 29 such room-hours.
- **Connection cap**: cap sockets at `maxSeats + 2` (max 8) at upgrade time so a
  reconnecting mobile client whose old socket is still half-open is not locked out
  before `hello` can evict the stale socket (`4001`). If the cap is reached, evict
  the oldest un-`hello`'d socket first so silent connections cannot squat slots
  without timers.
- When a Cloudflare account limit is reached, requests fail until the daily reset.
  The client shows a clear "service busy, try again later" message rather than
  hanging. No heartbeat faster than 30 seconds.

## 11. Security and abuse

- Validate every field and enforce the 4 KB limit on UTF-8 byte length before
  `JSON.parse`. Reject uninitialized room codes with `404` before accepting sockets
  or writing storage.
- Never expose `clientId` in any broadcast; `clientId` is a bearer token for seat
  reclaim only, and `kick`/`vacate` operate on `seat`.
- Check the `Origin` header on HTTP requests and WebSocket upgrades. Note that
  `Origin` prevents cross-site browser CSRF, not scripted abuse (`curl` can spoof
  `Origin`, a small number of IPs can exhaust a 10-room public quota, and random
  `/api/rooms/XXXXX/ws` probes bypass `Budget`). This trade-off is accepted for an
  unlisted friends-and-family deployment with an optional owner key.
- Network rate limiting hashes `CF-Connecting-IP` using full IPv4 (`/32`) or the
  IPv6 `/64` prefix (so rotating IPv6 privacy addresses cannot bypass the hourly
  limit), salted with a secret generated and stored by `Budget` on first use and keyed by UTC hour bucket.
- Room codes are 5 random characters from a 30-symbol alphabet (24.3 million
  combinations); rooms are unlisted, so the code is the secret.
- No cookies, analytics or third-party scripts. The only data stored is a random
  `clientId`, a display name and, server-side, the room's moves and chat until expiry
  (at most 48 hours of inactivity), plus salted hourly network counts in `Budget`.
- A "report" workflow is out of scope. The host can kick players in the lobby or
  vacate disconnected seats mid-game.

### Future: verification (phase 4)

Add server-side rule enforcement without changing the transport:

1. Import each game's pure module `shared/rules/<game>.js` (`applyMove(state, move) -> state | error`) into `GameRoom` to validate every move, rejecting illegal ones.
2. For hidden-information games, compute the full state in `GameRoom` and send each
   seat only its own filtered view (`viewFor(state, seat)`).
3. Start with `northstar` as the first authoritative pilot (2 players, simple grid
   and hidden-fleet rules), then bring online `landlord`, `iron_routes` and
   `conquest`.

**Implemented authoritative path.** `worker/authoritative.js` registers each
server-run game as `{make(roundSeats), apply(state, seat, move), view(state, seat),
finished(state)}`. On `start`/`rematch` the room stores `make()` in `room.state`
and sends `seed: null`, because server-side shuffles use `crypto.getRandomValues`
and must not be reproducible from a shared seed. Each accepted move increments
`seq` and sends every seat `{t: "state", round, seq, view}` with its own view. The
move log stays empty, so a reconnecting client rebuilds from `welcome.view`.
Authoritative moves skip the `seq === expectedSeq` check because the server
validates them against its own state. Simultaneous moves, such as every
Iron Routes player choosing starting tickets at once, all succeed in arrival order.
Rematch requires `finished(state)`. Northstar, Iron Routes and Landlord use this path.
Landlord runs on the server so dice and card draws cannot be forged; every game is
timed (15, 25 or 40 rounds) because an untimed game can exceed the 2,000-message room limit. The
online versions have no computer opponents, because those depend on timers that
would keep a room from hibernating.

Because games already separate pure deterministic rules from rendering in phases
1-2, step 1 requires no transport rewrite.

## 12. Conventions inherited from `Games`

- No commercial names or assets; all visuals are original.
- Works in current Safari and Chrome on iPhone and iPad and in desktop browsers.
  Pointer and touch input, 44 px targets, safe-area insets, `100vh` fallback for
  `100dvh`, and `prefers-reduced-motion` are respected.
- Relative links only, so pages work below a sub-path.
- Record each game's creation prompt, date and model in its UI or console.
- No remote fonts or trackers. The one deliberate third-party code is the vendored
  QR generator, committed to the repository.
- Each online game declares its single-device original in `Games`, and the `Games`
  cards gain a "Play online" link.

## 13. Delivery plan

Use **GPT-6.2-Sol with medium reasoning** to implement the plan. Start with
**Dots and Boxes** because both players see the whole board and each move adds
one line. Completing a box earns another turn, which gives the pilot a simple
way to check that both phones agree on the score and whose turn comes next.

| Phase | Scope | Done when |
|---|---|---|
| 0 | Repo scaffold, root Wrangler configuration, static assets, Durable Object bindings and CI checks (including a path and secrets scan) | `wrangler dev` serves the landing page and API on one origin |
| 1 | Dots and Boxes pilot with rooms, lobby, QR, chat, reconnect, README deploy button and quick start | On a fresh free Cloudflare account, one player clicks **Deploy to Cloudflare** and shares a room link. Two friends finish a game on their phones, chat and rematch. After ten rooms, public creation shows the reset time and only a valid owner key can create another room. |
| 2 | `go`, `fourfold`, `memory_match` | All pass the manual checklist |
| 3 | Link cards from `Games` | Each multiplayer card opens its matching online game |
| 4 | Server-side rule validation and per-seat views; pilot: `northstar`, then `landlord`, `iron_routes`, `conquest` | `northstar` and `landlord` playable online with hidden state enforced on the server |

## 14. Testing

- **Room unit tests** (Workers test pool, no network): seating, creator seat-0
  reservation, `404` without writes on uncreated codes, simultaneous `seq` race,
  reconnect with delta sync (`same round`) and full sync across `rematch` (`round`
  mismatch), `kick`, `vacate` takeover, `leave` / `claim_host`, lifetime message cap,
  and chat rate limit.
- **Hibernation tests**: verify a room holds no timers after handling messages, and
  verify that wiping in-memory DO state between messages preserves seats and chat
  rate-limit state via `ws.serializeAttachment()`.
- **Expiry tests**: verify an orphaned room (created via `POST /api/rooms` with zero
  WebSocket joins) is deleted by its initial alarm, and an inactive room is deleted
  after the last socket closes.
- **Reconnect-loop tests**: verify duplicate-tab replacement (`4001`), kick (`4003`),
  missing room (`4004`), full room (`4009`) and version mismatch (`4010`) stop client
  auto-reconnect.
- **Budget unit tests**: daily and per-network limits (including IPv6 `/64` prefix
  grouping), the public ceiling of 10 even with a higher setting, and `0` pausing
  public creation. Verify that only a valid owner key can create room 11, owner
  rooms count, refusals do not count, hourly rows expire and the day resets at 00:00 UTC.
- **End-to-end scripted test**: two clients play a full game and rematch against a
  local `wrangler dev`.
- **Manual checks** on iPhone Safari, iPad Safari, Android Chrome and desktop
  browsers: backgrounding and resuming, refresh mid-game, opening a link from a
  messaging app then switching to Safari (`vacate` takeover), a third client scanning
  a full 2-player room, and chat overflow.

## 15. Decisions and open questions

**Decided:**
- From phase 1, one Worker serves the game pages and API at the same `workers.dev`
  origin. The README deploy button lets any group run the pilot on its own free
  Cloudflare account. The shared public deployment uses the same configuration.
- Room-level QR and share URL (`/?room=CODE`) routed via `GET /api/rooms/:code` so
  QR codes stay compact and share the same path as the "join with code" input.
- Relay mode serializes moves strictly via `(round, seq)` without DO-enforced
  round-robin turns, supporting extra turns and out-of-turn actions cleanly.
- `northstar` moves to phase 4 as the first authoritative-server pilot; `memory_match`
  uses a `seed`-derived layout in phase 2 relay mode.
- No undo in v1 (if added later, model as append-only `undo_request`/`undo_accept`
  moves rather than deleting log rows).
- Full room scans are refused cleanly (`4009`) with no spectator mode in v1.
- A rematch keeps the same room and seats, incrementing `round` with a new `seed`.
- Host can `kick` in the lobby (blocking that `clientId` as a convenience, not strong
  moderation), `vacate` a disconnected player's seat mid-game for takeover, and any
  seated player can `claim_host` if the host is disconnected.
- Each deployment caps public room creation at 10 new rooms per UTC day. Only a valid
  owner key can exceed the ceiling. Each room has a 2,000-message lifetime limit (section 10).

**Open (post-v1):**
1. Switching games inside the same room without re-scanning (the room-level URL
   `/?room=CODE` already makes this straightforward to add later).
