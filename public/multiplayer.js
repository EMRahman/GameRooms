import { makeBoard, playLine } from './dots-rules.js';
import { makeFourfoldBoard, dropCounter } from './fourfold-rules.js';
import { drawFourfold } from './fourfold-board.js';

const $ = id => document.getElementById(id);
const inviteCode = new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
const codePattern = /^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{5}$/;
const games = {
  dots_and_boxes: {
    title: 'Boxed In',
    subtitle: 'Dots and Boxes',
    rules: 'Draw a line between two dots. Close a box to score and go again. Most boxes wins.',
    make: ({ size }) => makeBoard(size),
    move: playLine,
    result: board => board.boxes.includes(null) ? undefined : dotsWinner(board.scores),
  },
  fourfold: {
    title: 'Fourfold',
    subtitle: 'Four in a Row',
    rules: 'Choose a column to drop a counter. Connect four horizontally, vertically, or diagonally to win.',
    make: makeFourfoldBoard,
    move: dropCounter,
    result: board => board.finished ? board.winner : undefined,
  },
};

const pageGame = location.pathname.split('/').pop().replace(/\.html$/, '');
if (Object.hasOwn(games, pageGame)) $('game').value = pageGame;
$('game').onchange = () => { $('size-field').hidden = $('game').value !== 'dots_and_boxes'; };
$('game').onchange();
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
    const res = await fetch('/api/rooms', {
      method: 'POST', headers,
      body: JSON.stringify({ game, clientId: id(), options: game === 'dots_and_boxes' ? { size: Number($('size').value) } : {} }),
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

function enterRoom(code) {
  let ws, retryTimer, pingTimer, board, seat, hostSeat, round, seq, phase;
  let game, renderBoard;
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
  $('share').addEventListener('toggle', () => {
    if (!$('share').open || $('qr').childElementCount) return;
    const qr = globalThis.qrcode(0, 'M');
    qr.addData(inviteUrl(code).href);
    qr.make();
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Scan to join this room');
    const count = qr.getModuleCount();
    const scale = Math.max(2, Math.floor(160 / count));
    canvas.width = canvas.height = (count + 8) * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) ctx.fillRect((col + 4) * scale, (row + 4) * scale, scale, scale);
      }
    }
    $('qr').append(canvas);
  });

  function send(t, fields = {}) {
    if (ws?.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ t, v: 1, ...fields }));
    return true;
  }
  function submitMove(data) {
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
  function resetBoard(options) {
    board = games[game].make(options);
    const container = $('board');
    container.classList.toggle('fourfold-board', game === 'fourfold');
    $('paper').classList.toggle('fourfold-paper', game === 'fourfold');
    renderBoard = game === 'fourfold' ? drawFourfold(container, submitMove) : drawDots(container, board.size);
  }
  function mark(node, owner) {
    if (owner == null) delete node.dataset.seat;
    else node.dataset.seat = owner;
  }
  function render() {
    const host = seat === hostSeat;
    const friend = players.find(player => player.seat !== seat);
    const winner = board ? games[game].result(board) : undefined;
    const finished = winner !== undefined;
    const both = players.filter(player => player.connected).length === 2;
    const playing = phase === 'playing';
    $('players').replaceChildren(...[0, 1].map(index => {
      const player = players.find(item => item.seat === index);
      const card = document.createElement('div');
      card.className = `player player-${index}${playing && !finished && board.turn === index ? ' active' : ''}`;
      card.textContent = player ? player.name + (index === seat ? ' (you)' : '') + (player.connected ? '' : ' · offline') : 'Open seat';
      if (board?.scores) {
        const score = document.createElement('strong');
        score.textContent = board.scores[index];
        card.append(score);
      }
      return card;
    }));
    const name = index => players.find(player => player.seat === index)?.name ?? 'Other player';
    let status = both ? 'Ready to play' : 'Waiting for a friend';
    if (playing) {
      if (finished) status = winner === null ? 'Draw' : `${name(winner)} wins`;
      else status = board.turn === seat ? 'Your turn' : `${name(board.turn)}’s turn`;
    }
    $('turn').textContent = ready ? status : terminal ? 'Disconnected' : 'Connecting…';
    $('paper').hidden = !playing;
    $('start').hidden = !(ready && host && (!playing || finished));
    $('start').disabled = !both;
    $('start').textContent = playing ? 'Rematch' : 'Start game';
    $('leave').hidden = !ready || playing;
    $('claim').hidden = !ready || host || players.some(player => player.seat === hostSeat && player.connected);
    $('remove').hidden = !ready || !host || !friend || (playing && friend.connected);
    $('remove').textContent = playing ? 'Free offline seat' : 'Remove player';
    $('chat').querySelector('button').disabled = !ready;
    renderBoard?.(board, ready && playing && !pending && !finished && board.turn === seat);
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
  $('start').onclick = () => send(phase === 'playing' ? 'rematch' : 'start');
  $('leave').onclick = () => send('leave');
  $('claim').onclick = () => send('claim_host');
  $('remove').onclick = () => send(phase === 'playing' ? 'vacate' : 'kick', { seat: 1 - seat });

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
          ({ phase, seat, hostSeat, round, seq, players } = msg);
          game = msg.game;
          $('game-title').textContent = games[game].title;
          $('game-subtitle').textContent = games[game].subtitle;
          $('game-subtitle').hidden = false;
          $('rules').textContent = games[game].rules;
          document.title = `${games[game].title} · GameRooms`;
          resetBoard(msg.options);
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
          ({ round, players } = msg);
          seq = 0;
          pending = false;
          resetBoard(msg.options);
          break;
        case 'move':
          if (msg.round !== round || msg.seq !== seq + 1) return ws.close(1012);
          seq = msg.seq;
          pending = false;
          board = games[game].move(board, msg.seat, msg.data);
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
