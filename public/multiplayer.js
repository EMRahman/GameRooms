import { makeBoard, playLine } from './dots-rules.js';
import { makeFourfoldBoard, dropCounter } from './fourfold-rules.js';
import { drawFourfold } from './fourfold-board.js';
import { GO_SIZES, makeGoBoard, playGo } from './go-rules.js';
import { drawGo } from './go-board.js';
import { MEMORY_LEVELS, makeMemoryBoard, flipCard, memoryWinner } from './memory-rules.js';
import { drawMemory } from './memory-board.js';
import { drawNorthstar } from './northstar-board.js';
import { drawIronRoutes } from './iron-routes-board.js';

const $ = id => document.getElementById(id);
const inviteCode = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
const codePattern = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/;
const games = {
  dots_and_boxes: {
    title: 'Boxed In',
    players: '2 players',
    subtitle: 'Dots and Boxes',
    rules: 'Draw a line between two dots. Close a box to score and go again. Most boxes wins.',
    sizes: [4, 5, 6],
    make: ({ size }) => makeBoard(size),
    move: playLine,
    result: board => board.boxes.includes(null) ? undefined : dotsWinner(board.scores),
  },
  fourfold: {
    title: 'Fourfold',
    players: '2 players',
    subtitle: 'Four in a Row',
    rules: 'Choose a column to drop a counter. Connect four horizontally, vertically, or diagonally to win.',
    make: makeFourfoldBoard,
    move: dropCounter,
    result: board => board.finished ? board.winner : undefined,
    draw: (container, board, submit) => drawFourfold(container, submit),
  },
  go: {
    title: 'Go',
    players: '2 players',
    subtitle: 'Area scoring · 6.5 komi',
    rules: 'Black moves first. Surround territory and capture stones. Two passes score the board as it stands.',
    sizes: GO_SIZES,
    make: makeGoBoard,
    move: playGo,
    result: board => board.winner,
    draw: (container, board, submit) => drawGo(container, board.size, submit),
  },
  memory_match: {
    title: 'Memory Match',
    players: '2–5 players',
    subtitle: 'Find matching pairs',
    rules: 'Flip two cards. Find a pair to score and go again. A miss passes the turn.',
    make: makeMemoryBoard,
    move: flipCard,
    result: memoryWinner,
    draw: drawMemory,
  },
  northstar: {
    title: 'Northstar',
    players: '2 players',
    subtitle: 'Hidden fleet battle',
    rules: 'Lock your fleet, then fire at the target grid. A hit earns another shot. Sink all five opposing ships to win.',
    authoritative: true,
    result: view => view.stage === 'finished' ? view.winner : undefined,
    status: (view, seat) => view.stage !== 'deployment' ? undefined
      : view.locked[seat] ? 'Waiting for the other fleet to lock' : 'Deploy your fleet',
    draw: (container, view, submit, seat) => drawNorthstar(container, seat, submit),
  },
  iron_routes: {
    title: 'Iron Routes',
    players: '2–5 players',
    subtitle: 'Railway building · 2–5 players',
    rules: 'Each turn, draw two train cards, claim a route with matching cards, or take destination tickets. Finished tickets score; unfinished ones cost their value. The longest line earns 12 points.',
    authoritative: true,
    result: view => view.over ? view.winner : undefined,
    status: (view, seat) => !view.setup ? undefined
      : view.me?.pending.length ? 'Choose your starting tickets' : 'Waiting for others to choose tickets',
    draw: (container, view, submit, seat, nameOf) => drawIronRoutes(container, seat, submit, nameOf),
  },
};

const pageGame = location.pathname.split('/').pop().replace(/\.html$/, '');
// The chosen size and table are remembered per page visit; each game falls back to its first option.
const chosen = { size: games.dots_and_boxes.sizes[0], level: Object.keys(MEMORY_LEVELS)[0] };

function pickOption(container, options, value, onPick) {
  container.replaceChildren(...options.map(([label, option]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(option === value));
    button.textContent = label;
    button.onclick = () => {
      onPick(option);
      renderSetup();
    };
    return button;
  }));
}

// Everything in the setup panel depends on the chosen game.
function renderSetup() {
  const game = $('game').value;
  const meta = games[game];
  for (const card of document.querySelectorAll('.game-card')) {
    card.setAttribute('aria-checked', String(card.dataset.game === game));
  }
  $('setup-kicker').textContent = meta.subtitle;
  $('setup-title').textContent = meta.title;
  $('setup-rules').textContent = meta.rules;
  $('player-capacity').textContent = meta.players;
  $('size-field').hidden = !meta.sizes;
  if (meta.sizes) {
    pickOption($('size-options'), meta.sizes.map(size => [`${size} × ${size}`, size]), chosen.size, value => { chosen.size = value; });
  }
  $('level-field').hidden = game !== 'memory_match';
  if (game === 'memory_match') {
    pickOption($('level-options'), Object.entries(MEMORY_LEVELS).map(([key, level]) => [level.label, key]), chosen.level, value => { chosen.level = value; });
  }
  $('no-options').hidden = Boolean(meta.sizes) || game === 'memory_match';
  $('create-button').textContent = `Create ${meta.title} room`;
}

function selectGame(game) {
  $('game').value = game;
  chosen.size = games[game].sizes?.[0] ?? chosen.size;
  renderSetup();
}

for (const card of document.querySelectorAll('.game-card')) {
  card.onclick = () => selectGame(card.dataset.game);
  card.onkeydown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectGame(card.dataset.game);
    }
  };
}
selectGame(Object.hasOwn(games, pageGame) ? pageGame : 'dots_and_boxes');
$('name').value = localStorage.getItem('gamerooms-name') ?? '';
$('name').addEventListener('change', () => localStorage.setItem('gamerooms-name', $('name').value.trim()));
const id = () => localStorage.getItem('gamerooms-id') ?? createId();

function dotsWinner([first, second]) {
  if (first === second) return null;
  return first > second ? 0 : 1;
}

function createId() {
  const value = crypto.randomUUID();
  localStorage.setItem('gamerooms-id', value);
  return value;
}
function notice(text = '') {
  $('notice').hidden = !text;
  $('notice').textContent = text;
}
function inviteUrl(code) {
  const url = new URL('./', location.href);
  url.searchParams.set('room', code);
  return url;
}
// Shows how many rooms are left today and how many are in use right now.
async function loadRoomStats() {
  try {
    const stats = await (await fetch('/api/stats', { cache: 'no-store' })).json();
    const resets = new Date(stats.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
    $('room-stats').textContent = stats.remaining > 0
      ? `${stats.remaining} of ${stats.dailyLimit} rooms left today · ${stats.inUse} in use`
      : `All ${stats.dailyLimit} rooms for today are used · ${stats.inUse} in use · new rooms open at ${resets} UTC`;
    $('room-stats').hidden = false;
  } catch {
    // The create form still reports the limit if it is reached.
  }
}
if (!inviteCode) {
  loadRoomStats();
  setInterval(loadRoomStats, 60000);
}

$('join').onsubmit = event => {
  event.preventDefault();
  const code = $('code').value.trim().toUpperCase();
  if (codePattern.test(code)) location.href = inviteUrl(code);
  else notice('Enter the five-character room code.');
};
$('create').onsubmit = async event => {
  event.preventDefault();
  const button = event.submitter;
  const game = $('game').value;
  button.disabled = true;
  notice();
  try {
    const headers = { 'Content-Type': 'application/json' };
    const key = $('owner-key').value.trim();
    if (key) headers['X-Owner-Key'] = key;
    const options = {};
    if (games[game].sizes) options.size = chosen.size;
    if (game === 'memory_match') options.level = chosen.level;
    const res = await fetch('/api/rooms', {
      method: 'POST', headers,
      body: JSON.stringify({ game, clientId: id(), options }),
    });
    const body = await res.json();
    if (!res.ok) {
      notice(body.resetsAt ? `Room creation reopens at ${new Date(body.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : body.error);
      return;
    }
    location.href = new URL(`./${game}.html?room=${body.code}`, location.href);
  } catch {
    notice('Service busy. Try again shortly.');
  } finally {
    button.disabled = false;
  }
};

let session;
if (inviteCode) {
  $('entry-actions').hidden = true;
  if (codePattern.test(inviteCode)) {
    $('invite').hidden = false;
    $('invite').onsubmit = event => {
      event.preventDefault();
      session ??= enterRoom(inviteCode);
    };
    const autoJoin = sessionStorage.getItem(`playing:${inviteCode}`) || Object.hasOwn(games, pageGame);
    if (autoJoin) session = enterRoom(inviteCode);
  } else notice('That room code is invalid.');
}

// Draws the invite link as a QR code with a quiet zone, scaled to a crisp square.
function drawInvite(code) {
  const qr = globalThis.qrcode(0, 'M');
  qr.addData(inviteUrl(code).href);
  qr.make();
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `Scan to join room ${code}`);
  const count = qr.getModuleCount();
  const quietZone = 4;
  const scale = Math.max(2, Math.floor(200 / (count + quietZone * 2)));
  canvas.width = canvas.height = (count + quietZone * 2) * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) ctx.fillRect((col + quietZone) * scale, (row + quietZone) * scale, scale, scale);
    }
  }
  $('qr').replaceChildren(canvas);
}

function enterRoom(code) {
  let ws, retryTimer, pingTimer, board, seat, hostSeat, round, seq, phase;
  let game, renderBoard, previewTimer;
  let preview = [];
  let maxSeats = 2, roundSeats;
  let players = [];
  let checkingRoom = false;
  let retries = 0, terminal = false, ready = false, pending = false, unread = 0;
  if (matchMedia('(max-width: 710px)').matches) $('chat-panel').open = false;
  $('room-code').textContent = code;
  $('copy').onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl(code).href);
      $('copy').textContent = 'Link copied';
    } catch {
      notice(inviteUrl(code).href);
    }
  };
  drawInvite(code);

  function send(t, fields = {}) {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ t, v: 1, ...fields }));
    return true;
  }
  function submitMove(data) {
    if (!ready || phase !== 'playing' || pending || preview.length) return;
    if (games[game].authoritative) {
      notice();
      pending = send('move', { round, seq: seq + 1, data });
      render();
      return;
    }
    const next = games[game].move(board, seat, data);
    if (next === board) {
      if (game === 'go' && board.turn === seat && board.winner === undefined && !board.cells[data.point]) {
        notice('That move would leave no liberties or repeat an earlier position.');
      }
      return;
    }
    notice();
    pending = send('move', { round, seq: seq + 1, data });
    render();
  }
  function drawDots(container, size) {
    container.setAttribute('aria-label', 'Dots and Boxes board');
    container.replaceChildren();
    const edgeButtons = [];
    const boxNodes = [];
    const place = (node, row, col) => {
      node.style.top = `${row / size * 100}%`;
      node.style.left = `${col / size * 100}%`;
      container.append(node);
    };
    for (let row = 0; row <= size; row++) {
      for (let col = 0; col <= size; col++) {
        const dot = document.createElement('i');
        dot.className = 'dot';
        place(dot, row, col);
        if (row < size && col < size) {
          const box = document.createElement('span');
          box.className = 'box';
          box.style.width = box.style.height = `${100 / size}%`;
          place(box, row, col);
          boxNodes.push(box);
        }
        for (const axis of ['h', 'v']) {
          if (axis === 'h' ? col === size : row === size) continue;
          const button = document.createElement('button');
          button.type = 'button';
          button.className = `edge ${axis}`;
          button.setAttribute('aria-label', `${axis === 'h' ? 'Horizontal' : 'Vertical'} line, row ${row + 1}, column ${col + 1}`);
          button.style[axis === 'h' ? 'width' : 'height'] = `${100 / size}%`;
          place(button, row, col);
          const line = { axis, row, col };
          button.onclick = () => submitMove(line);
          const index = row * (axis === 'h' ? size : size + 1) + col;
          edgeButtons.push({ button, axis, index });
        }
      }
    }
    return (board, canMove) => {
      for (const { button, axis, index } of edgeButtons) {
        const owner = (axis === 'h' ? board.horizontal : board.vertical)[index];
        mark(button, owner);
        button.disabled = !canMove || owner !== null;
      }
      boxNodes.forEach((node, index) => mark(node, board.boxes[index]));
    };
  }
  function clearPreview() {
    clearTimeout(previewTimer);
    preview = [];
  }
  function resetBoard(options, seed, view) {
    clearPreview();
    board = games[game].authoritative ? view : games[game].make(options, seed, roundSeats ?? []);
    const container = $('board');
    container.classList.toggle('fourfold-board', game === 'fourfold');
    $('paper').classList.toggle('fourfold-paper', game === 'fourfold');
    container.classList.toggle('go-board', game === 'go');
    $('paper').classList.toggle('go-paper', game === 'go');
    container.classList.toggle('memory-board', game === 'memory_match');
    $('paper').classList.toggle('memory-paper', game === 'memory_match');
    container.classList.toggle('northstar-board', game === 'northstar');
    $('paper').classList.toggle('northstar-paper', game === 'northstar');
    container.classList.toggle('iron-board', game === 'iron_routes');
    $('paper').classList.toggle('iron-paper', game === 'iron_routes');
    const nameOf = index => players.find(player => player.seat === index)?.name ?? `Player ${index + 1}`;
    renderBoard = games[game].draw?.(container, board, submitMove, seat, nameOf) ?? drawDots(container, board.size);
  }
  function mark(node, owner) {
    if (owner == null) delete node.dataset.seat;
    else node.dataset.seat = owner;
  }
  function render() {
    const host = seat === hostSeat;
    const winner = board ? games[game].result(board) : undefined;
    const finished = winner !== undefined;
    const connected = players.filter(player => player.connected).length;
    const canStart = connected >= 2 && connected === (roundSeats?.length ?? players.length);
    const playing = phase === 'playing';
    const shownSeats = playing && roundSeats ? roundSeats : Array.from({ length: maxSeats }, (_, index) => index);
    $('players').classList.toggle('memory-players', maxSeats > 2);
    $('players').replaceChildren(...shownSeats.map(index => {
      const player = players.find(item => item.seat === index);
      const card = document.createElement('div');
      card.className = `player player-${index}${playing && !finished && board?.stage !== 'deployment' && board?.turn === index ? ' active' : ''}`;
      card.textContent = player ? player.name + (index === seat ? ' (you)' : '') + (player.connected ? '' : ' · offline') : 'Open seat';
      if (game === 'go') {
        const color = document.createElement('small');
        color.className = 'go-player-color';
        color.textContent = index === 0 ? 'Black' : 'White';
        card.prepend(color);
      }
      if (playing && board?.scores?.[index] !== undefined) {
        const score = document.createElement('strong');
        score.textContent = board.scores[index];
        card.append(score);
      }
      return card;
    }));
    const name = index => players.find(player => player.seat === index)?.name ?? 'Other player';
    let status = canStart ? 'Ready to play' : 'Waiting for a friend';
    if (playing) {
      if (finished) status = winner === null ? 'Draw' : `${name(winner)} wins`;
      else status = games[game].status?.(board, seat) ?? (board.turn === seat ? 'Your turn' : `${name(board.turn)}’s turn`);
    }
    const movesAllowed = ready && playing && !finished && !pending && !preview.length;
    const canMove = movesAllowed && board.turn === seat;
    if (playing && game === 'go') {
      if (board.resigned) status += ' by resignation';
      else if (board.scores) status += ` by ${Math.abs(board.scores[0] - board.scores[1])} points`;
      else if (board.passes) status += ' · One pass';
    }
    $('go-pass').hidden = $('go-resign').hidden = game !== 'go' || !playing || finished;
    $('go-pass').disabled = !canMove;
    $('go-resign').disabled = !movesAllowed;
    $('turn').textContent = ready ? status : terminal ? 'Disconnected' : 'Connecting…';
    $('paper').hidden = !playing;
    $('start').hidden = !(ready && host && (!playing || finished));
    $('start').disabled = !canStart;
    $('start').textContent = playing ? 'Rematch' : 'Start game';
    $('end').hidden = !(ready && playing);
    $('leave').hidden = !ready;
    $('claim').hidden = !ready || host || players.some(player => player.seat === hostSeat && player.connected);
    const targets = players.filter(player => player.seat !== seat && (!playing || !player.connected));
    const selection = $('remove-player');
    const selected = selection.value;
    selection.replaceChildren(...targets.map(player => new Option(player.name, player.seat)));
    if (targets.some(player => String(player.seat) === selected)) selection.value = selected;
    $('remove').hidden = !ready || !host || !targets.length;
    selection.hidden = $('remove').hidden || maxSeats === 2;
    $('remove').textContent = playing ? 'Free offline seat' : 'Remove player';
    $('chat').querySelector('button').disabled = !ready;
    renderBoard?.(board, canMove, preview, movesAllowed);
  }
  function addChat(message, live = false) {
    const li = document.createElement('li');
    const name = document.createElement('strong');
    name.textContent = message.name;
    li.append(name, ` · ${message.text}`);
    $('messages').append(li);
    $('messages').scrollTop = $('messages').scrollHeight;
    if (live && !$('chat-panel').open) $('chat-summary').textContent = `Room chat (${++unread})`;
  }
  $('chat-panel').ontoggle = () => {
    if ($('chat-panel').open) {
      unread = 0;
      $('chat-summary').textContent = 'Room chat';
    }
  };
  $('chat').onsubmit = event => {
    event.preventDefault();
    if (send('chat', { text: $('message').value })) $('message').value = '';
  };
  $('go-pass').onclick = () => submitMove({ action: 'pass' });
  $('go-resign').onclick = () => {
    if (window.confirm('Resign this game?')) submitMove({ action: 'resign' });
  };
  $('start').onclick = () => send(phase === 'playing' ? 'rematch' : 'start');
  $('end').onclick = () => {
    if (window.confirm('End this game? The room goes back to the lobby.')) send('end');
  };
  $('leave').onclick = () => {
    if (phase === 'playing' && !window.confirm('Leave the room? This ends the current game for everyone.')) return;
    send('leave');
  };
  $('claim').onclick = () => send('claim_host');
  $('remove').onclick = () => send(phase === 'playing' ? 'vacate' : 'kick', { seat: Number($('remove-player').value) });

  async function connect() {
    clearTimeout(retryTimer);
    if (terminal || checkingRoom || ws?.readyState === WebSocket.CONNECTING || ws?.readyState === WebSocket.OPEN) return;
    let response;
    checkingRoom = true;
    try {
      response = await fetch(`/api/rooms/${code}`);
    } catch {
      // Retry after a temporary network failure.
    } finally {
      checkingRoom = false;
    }
    if (response?.status === 404) {
      terminal = true;
      notice('Room not found or expired. Open GameRooms to start a new one.');
      render();
      return;
    }
    if (!response?.ok) return retry();
    const url = new URL(`/api/rooms/${code}/ws`, location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(url);
    ws.onopen = () => {
      send('hello', { clientId: id(), name: $('name').value });
      pingTimer = setInterval(() => send('ping'), 30000);
    };
    ws.onmessage = event => {
      const msg = JSON.parse(event.data);
      switch (msg.t) {
        case 'welcome':
          ({ phase, seat, hostSeat, round, seq, players, roundSeats } = msg);
          maxSeats = msg.maxSeats ?? 2;
          game = msg.game;
          $('player-capacity').textContent = maxSeats > 2 ? `2–${maxSeats} players` : 'Two players';
          $('game-title').textContent = games[game].title;
          $('game-subtitle').textContent = games[game].subtitle;
          $('game-subtitle').hidden = false;
          $('rules').textContent = games[game].rules;
          document.title = `${games[game].title} · GameRooms`;
          resetBoard(msg.options, msg.seed, msg.view);
          for (const move of msg.log) board = games[game].move(board, move.seat, move.data);
          $('messages').replaceChildren();
          msg.chat.forEach(message => addChat(message));
          ready = true;
          pending = false;
          retries = 0;
          sessionStorage.setItem(`playing:${code}`, '1');
          $('lobby').hidden = true;
          $('room').hidden = false;
          notice();
          break;
        case 'players':
          ({ players, hostSeat } = msg);
          break;
        case 'started':
          phase = 'playing';
          ({ round, players, roundSeats } = msg);
          seq = 0;
          pending = false;
          resetBoard(msg.options, msg.seed, msg.view);
          break;
        case 'state':
          if (!games[game].authoritative || msg.round !== round || msg.seq !== seq + 1) return ws.close(1012);
          seq = msg.seq;
          pending = false;
          board = msg.view;
          break;
        case 'move': {
          if (msg.round !== round || msg.seq !== seq + 1) return ws.close(1012);
          seq = msg.seq;
          pending = false;
          clearPreview();
          const next = games[game].move(board, msg.seat, msg.data);
          if (game === 'memory_match' && next.turn !== board.turn) {
            preview = [board.revealed, msg.data.card];
            previewTimer = setTimeout(() => {
              clearPreview();
              render();
            }, 720);
          }
          board = next;
          break;
        }
        case 'ended':
          phase = 'lobby';
          roundSeats = undefined;
          pending = false;
          clearPreview();
          break;
        case 'chat':
          addChat(msg, true);
          break;
        case 'error':
          pending = false;
          if (msg.code === 'seq_mismatch') return ws.close(1012);
          notice({ rate_limited: 'Wait a second before sending another message.', room_limit: 'This room has reached its message limit.' }[msg.code] ?? 'That action is unavailable.');
          break;
      }
      if (msg.t !== 'pong') render();
    };
    ws.onclose = event => {
      clearInterval(pingTimer);
      ready = false;
      if (event.code === 4000) {
        sessionStorage.removeItem(`playing:${code}`);
        location.href = './';
        return;
      }
      const messages = { 4001: 'This seat is connected in another tab.', 4003: 'The host removed you from the room.', 4004: 'This room expired.', 4009: 'This room is full.', 4010: 'Refresh to load the latest version.' };
      terminal = Boolean(messages[event.code]);
      if (terminal) {
        notice(messages[event.code]);
        $('reconnect').hidden = event.code !== 4001;
      } else retry();
      render();
    };
  }
  function retry() {
    notice('Connection interrupted. Reconnecting…');
    clearTimeout(retryTimer);
    retryTimer = setTimeout(connect, Math.min(15000, 600 * 2 ** retries++));
  }
  $('reconnect').onclick = () => {
    terminal = false;
    $('reconnect').hidden = true;
    connect();
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !terminal) connect();
  });
  connect();
  return { code };
}
