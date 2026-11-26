import {
  CITIES, ROUTES, TICKETS, POINTS, LONGEST_BONUS, CARD_KINDS, proj,
  payOptions, claimProblem, twinBlocked, connected, canTakeMarket,
} from './iron-routes-rules.js';

// Claimed routes use the same colours as the player cards in style.css.
const SEAT_COLORS = ['#ff947d', '#68dfcf', '#ffcc77', '#9cd4ff', '#ddb9ff'];
const CARD = {
  red: { c: '#d83a3a', t: '#fff', s: '♥', n: 'Red' },
  orange: { c: '#ef8a24', t: '#2a1400', s: '▲', n: 'Orange' },
  yellow: { c: '#f2cf2e', t: '#2a2300', s: '★', n: 'Yellow' },
  green: { c: '#2f9e57', t: '#fff', s: '♣', n: 'Green' },
  blue: { c: '#2f6fdb', t: '#fff', s: '●', n: 'Blue' },
  purple: { c: '#8c55d6', t: '#fff', s: '✦', n: 'Purple' },
  black: { c: '#26282b', t: '#fff', s: '■', n: 'Black' },
  white: { c: '#f4f1e8', t: '#222', s: '○', n: 'White' },
  loco: { c: '#888', t: '#fff', s: '✱', n: 'Loco' },
  gray: { c: '#a9afb3', t: '#222', s: '', n: 'Grey' },
};
for (const kind of Object.values(CARD)) if (kind.s) kind.s += '︎';

const LAND = [[-131, 53], [-55, 53], [-55, 47], [-60, 46.5], [-64, 45.5], [-66.5, 44.8], [-70, 43.6], [-70.6, 42.6], [-70, 41.8], [-71.5, 41.4], [-74, 40.6], [-74.2, 39.6], [-75.5, 38.6], [-76, 37], [-75.6, 35.3], [-77, 34.6], [-78.5, 33.8], [-80, 32.6], [-81.4, 30.8], [-81.2, 29.6], [-80.3, 28.2], [-79.9, 26.5], [-80.1, 25.2], [-81.2, 25.3], [-81.8, 26.2], [-82.7, 27.8], [-82.8, 29], [-84, 30], [-85.5, 29.7], [-86.5, 30.4], [-88, 30.4], [-89.3, 30.2], [-89.4, 29.2], [-90.5, 29.1], [-92, 29.6], [-94, 29.6], [-95, 29.2], [-96.5, 28.3], [-97.3, 27.4], [-97.4, 25.8], [-97.7, 24], [-97.9, 19], [-112, 19], [-112, 24.5], [-114.2, 28], [-115.8, 30.3], [-117.1, 32.5], [-117.6, 33.4], [-118.5, 34], [-120.6, 34.6], [-121.9, 36.6], [-122.6, 37.6], [-123, 38.3], [-123.8, 39.6], [-124.3, 40.4], [-124.2, 42], [-124, 44], [-124, 46.2], [-124.7, 48.4], [-123.3, 48.4], [-122.8, 49], [-124, 49.8], [-125.5, 50.5], [-127.5, 51], [-131, 53]];
const LAKES = [
  [[-92.1, 46.7], [-90, 46.6], [-87.5, 46.5], [-84.6, 46.5], [-84.8, 47.5], [-86, 48.7], [-88.5, 48.4], [-90, 47.8], [-91.5, 47.2]],
  [[-87.8, 42.2], [-86.8, 41.7], [-86.2, 42.5], [-86.4, 44], [-85.6, 45.3], [-84.9, 45.8], [-86.5, 45.9], [-87.5, 45.2], [-87.9, 44]],
  [[-84.5, 45.9], [-83.5, 45.4], [-82.5, 44.5], [-82.4, 43], [-81.7, 43.6], [-81.7, 44.8], [-80.2, 45], [-80.6, 45.9], [-82.5, 46.1]],
  [[-83.4, 41.8], [-81.5, 41.6], [-79, 42.4], [-79.2, 42.9], [-81, 42.6], [-83, 42.1]],
  [[-79.8, 43.3], [-78, 43.3], [-76.3, 43.5], [-76.3, 44.1], [-77.5, 44], [-79.4, 43.75]],
];
const BORDERS = [
  [[-123.3, 49], [-95.2, 49], [-95.2, 49.4], [-89.5, 48], [-84.6, 46.5], [-82.4, 45.4], [-82.5, 43], [-83.1, 42], [-79, 42.6], [-79, 43.3], [-76.5, 44.2], [-74.7, 45], [-71.5, 45], [-70, 46.5], [-69, 47.4], [-67.8, 47.1], [-67.8, 45.6], [-67, 44.8]],
  [[-117.1, 32.5], [-114.7, 32.7], [-111, 31.3], [-108.2, 31.3], [-106.5, 31.8], [-104.5, 29.6], [-103, 29], [-101.4, 29.8], [-99.5, 27.5], [-97.2, 25.9]],
];
const FULL = { x: -52, y: -14, w: 944, h: 618 };
const NS = 'http://www.w3.org/2000/svg';
const points = list => list.map(([lon, lat]) => proj(lon, lat).join(',')).join(' ');
const cityName = key => CITIES[key][0];
const routeName = route => `${cityName(route.a)}–${cityName(route.b)}`;
const ticketName = ticket => `${cityName(ticket.a)} → ${cityName(ticket.b)}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function svgEl(tag, attrs, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  parent?.append(node);
  return node;
}
function html(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
function button(className, text, onclick) {
  const node = html('button', className, text);
  node.type = 'button';
  node.onclick = onclick;
  return node;
}
function card(kind, tag = 'button') {
  const node = html(tag, `iron-card${kind === 'loco' ? ' loco' : ''}`);
  if (tag === 'button') node.type = 'button';
  node.style.setProperty('--cc', CARD[kind].c);
  node.style.setProperty('--ct', CARD[kind].t);
  node.append(html('span', 'sym', CARD[kind].s));
  return node;
}
function payLabel(option) {
  const parts = [];
  if (option.n) parts.push(`${option.n} ${CARD[option.c].n.toLowerCase()}`);
  if (option.loco) parts.push(`${option.loco} loco`);
  return parts.join(' + ');
}

function routeGeometry(route) {
  const A = CITIES[route.a];
  const B = CITIES[route.b];
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const length = Math.hypot(dx, dy);
  const [ux, uy] = [dx / length, dy / length];
  const [ox, oy] = [-uy * route.side * 5.5, ux * route.side * 5.5];
  const trim = 9;
  const gap = 2.2;
  const car = (length - trim * 2 - gap * (route.len - 1)) / route.len;
  let cars = '';
  for (let i = 0; i < route.len; i++) {
    const start = trim + i * (car + gap);
    const x = A.x + ox + ux * start;
    const y = A.y + oy + uy * start;
    cars += `M${x.toFixed(1)} ${y.toFixed(1)}L${(x + ux * car).toFixed(1)} ${(y + uy * car).toFixed(1)}`;
  }
  const line = `M${(A.x + ox).toFixed(1)} ${(A.y + oy).toFixed(1)}L${(B.x + ox).toFixed(1)} ${(B.y + oy).toFixed(1)}`;
  return { cars, line };
}

export function drawIronRoutes(container, seat, submit, nameOf) {
  let selected = -1;
  let highlighted = -1;
  let picks = new Set();
  let pickKey = '';
  let last = null;

  // ---------- Map ----------
  const mapWrap = html('div', 'iron-map');
  const svg = svgEl('svg', { viewBox: `${FULL.x} ${FULL.y} ${FULL.w} ${FULL.h}`, role: 'group', 'aria-label': 'Railway map' });
  const base = svgEl('g', { 'aria-hidden': 'true' }, svg);
  svgEl('rect', { x: -300, y: -300, width: 1500, height: 1200, class: 'sea' }, base);
  svgEl('polygon', { class: 'land', points: points(LAND) }, base);
  for (const lake of LAKES) svgEl('polygon', { class: 'lake', points: points(lake) }, base);
  for (const border of BORDERS) svgEl('polyline', { class: 'border', points: points(border) }, base);
  const routeLayer = svgEl('g', {}, svg);
  const routeNodes = ROUTES.map(route => {
    const group = svgEl('g', { class: 'route' }, routeLayer);
    const { cars, line } = routeGeometry(route);
    svgEl('path', { class: 'out', d: cars }, group);
    const carPath = svgEl('path', { class: 'car', d: cars, stroke: CARD[route.c].c }, group);
    const hit = svgEl('path', { class: 'hit', d: line, 'data-route': route.id }, group);
    const title = svgEl('title', {}, hit);
    return { group, carPath, title };
  });
  const cityLayer = svgEl('g', {}, svg);
  const cityNodes = Object.fromEntries(Object.entries(CITIES).map(([key, city]) => {
    const group = svgEl('g', { class: 'city' }, cityLayer);
    svgEl('circle', { cx: city.x, cy: city.y, r: 6 }, group);
    const side = city[3];
    const label = svgEl('text', {
      x: city.x + (side === 'l' ? -10 : side === 'r' ? 10 : 0),
      y: city.y + (side === 't' ? -11 : side === 'b' ? 19 : 4),
      'text-anchor': side === 'l' ? 'end' : side === 'r' ? 'start' : 'middle',
    }, group);
    label.textContent = city[0];
    return [key, group];
  }));

  // Pan and zoom. While fully zoomed out, touch scrolls the page instead of the map.
  let frame = { ...FULL };
  let dragged = false;
  let gesture = null;
  const pointers = new Map();
  function applyFrame() {
    frame.w = Math.max(FULL.w / 6, Math.min(FULL.w, frame.w));
    frame.h = frame.w * FULL.h / FULL.w;
    frame.x = Math.max(FULL.x - frame.w * 0.25, Math.min(FULL.x + FULL.w - frame.w * 0.75, frame.x));
    frame.y = Math.max(FULL.y - frame.h * 0.25, Math.min(FULL.y + FULL.h - frame.h * 0.75, frame.y));
    if (frame.w >= FULL.w) frame = { ...FULL };
    mapWrap.classList.toggle('zoomed', frame.w < FULL.w);
    svg.setAttribute('viewBox', `${frame.x.toFixed(1)} ${frame.y.toFixed(1)} ${frame.w.toFixed(1)} ${frame.h.toFixed(1)}`);
  }
  function toMap(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: frame.x + frame.w / 2, y: frame.y + frame.h / 2 };
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }
  function zoomAt(clientX, clientY, factor) {
    const point = toMap(clientX, clientY);
    const width = Math.max(FULL.w / 6, Math.min(FULL.w, frame.w * factor));
    const k = width / frame.w;
    frame.x = point.x - (point.x - frame.x) * k;
    frame.y = point.y - (point.y - frame.y) * k;
    frame.w = width;
    applyFrame();
  }
  function zoomCentre(factor) {
    const box = svg.getBoundingClientRect();
    zoomAt(box.left + box.width / 2, box.top + box.height / 2, factor);
  }
  function startGesture() {
    const list = [...pointers.values()];
    if (list.length === 1) gesture = { kind: 'pan', x: list[0].x, y: list[0].y, frame: { ...frame } };
    else if (list.length === 2) {
      const [a, b] = list;
      gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), w: frame.w, mid: toMap((a.x + b.x) / 2, (a.y + b.y) / 2) };
      dragged = true;
    }
  }
  svg.addEventListener('pointerdown', event => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) dragged = false;
    startGesture();
  });
  svg.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || !gesture || frame.w >= FULL.w && pointers.size === 1) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const list = [...pointers.values()];
    const box = svg.getBoundingClientRect();
    const scale = Math.max(frame.w / box.width, frame.h / box.height);
    if (gesture.kind === 'pan' && list.length === 1) {
      const dx = list[0].x - gesture.x;
      const dy = list[0].y - gesture.y;
      if (!dragged && Math.hypot(dx, dy) < 7) return;
      dragged = true;
      frame.x = gesture.frame.x - dx * scale;
      frame.y = gesture.frame.y - dy * scale;
      applyFrame();
    } else if (gesture.kind === 'pinch' && list.length === 2) {
      const [a, b] = list;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (!d || !gesture.d) return;
      const width = Math.max(FULL.w / 6, Math.min(FULL.w, gesture.w * gesture.d / d));
      const mid = toMap((a.x + b.x) / 2, (a.y + b.y) / 2);
      const k = width / frame.w;
      frame.x = gesture.mid.x - (mid.x - frame.x) * k;
      frame.y = gesture.mid.y - (mid.y - frame.y) * k;
      frame.w = width;
      applyFrame();
    }
  });
  const endPointer = event => {
    if (!pointers.delete(event.pointerId)) return;
    if (pointers.size) startGesture();
    else gesture = null;
  };
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) svg.addEventListener(type, endPointer);
  svg.addEventListener('wheel', event => {
    event.preventDefault();
    zoomAt(event.clientX, event.clientY, event.deltaY > 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });
  svg.addEventListener('click', event => {
    if (dragged) { dragged = false; return; }
    const hit = event.target.closest('[data-route]');
    const id = hit ? Number(hit.dataset.route) : -1;
    select(id === selected ? -1 : id);
  });
  const zoom = html('div', 'iron-zoom');
  zoom.append(
    button('', '+', () => zoomCentre(1 / 1.4)),
    button('', '−', () => zoomCentre(1.4)),
    button('', 'Fit', () => { frame = { ...FULL }; applyFrame(); }),
  );
  zoom.children[0].setAttribute('aria-label', 'Zoom in');
  zoom.children[1].setAttribute('aria-label', 'Zoom out');
  mapWrap.append(svg, zoom);

  // ---------- Panel ----------
  const banner = html('p', 'iron-banner');
  const instruction = html('p', 'iron-instruction');
  instruction.setAttribute('aria-live', 'polite');
  const choose = html('section', 'iron-choose');
  const chooseList = html('div', 'iron-tickets');
  const keep = button('primary', '', () => submit({ action: 'tickets', keep: [...picks] }));
  choose.append(html('h3', '', 'Destination tickets'), chooseList, keep);
  const market = html('div', 'iron-market');
  market.setAttribute('role', 'group');
  market.setAttribute('aria-label', 'Face-up train cards and deck');
  const drawTickets = button('', '', () => submit({ action: 'drawTickets' }));
  const claimBox = html('section', 'iron-claim');
  const handTitle = html('h3', '', 'Your hand');
  const hand = html('div', 'iron-hand');
  const ticketTitle = html('h3', '', 'Your tickets · tap to highlight');
  const tickets = html('div', 'iron-tickets');
  const claimable = html('details', 'iron-more');
  const results = html('section', 'iron-results');
  const rivals = html('ul', 'iron-rivals');
  const logPanel = html('details', 'iron-more');
  const logList = html('ol', 'iron-log');
  logPanel.append(html('summary', '', 'Game log'), logList);
  const panel = html('div', 'iron-panel');
  panel.append(instruction, choose, market, drawTickets, claimBox, results, handTitle, hand, ticketTitle, tickets, claimable, rivals, logPanel);
  container.setAttribute('aria-label', 'Iron Routes');
  container.replaceChildren(mapWrap, banner, panel);
  applyFrame();

  function select(id) {
    selected = id;
    paint();
  }

  function paintMap(view) {
    const count = view.seats.length;
    for (const route of ROUTES) {
      const { group, carPath, title } = routeNodes[route.id];
      const owner = view.owner[route.id];
      group.classList.toggle('claimed', owner !== undefined);
      group.classList.toggle('blocked', twinBlocked(view.owner, count, route));
      group.classList.toggle('sel', selected === route.id);
      carPath.setAttribute('stroke', owner !== undefined ? SEAT_COLORS[owner] : CARD[route.c].c);
      title.textContent = `${routeName(route)}, ${route.len} ${route.c === 'gray' ? 'grey' : route.c}${owner !== undefined ? `, claimed by ${nameOf(owner)}` : ''}`;
    }
    const hi = new Set();
    const done = new Set();
    for (const id of view.me?.pending ?? []) hi.add(TICKETS[id].a).add(TICKETS[id].b);
    if (highlighted >= 0) {
      const ticket = TICKETS[highlighted];
      hi.add(ticket.a).add(ticket.b);
      if (connected(view.owner, seat, ticket.a, ticket.b)) done.add(ticket.a).add(ticket.b);
    }
    for (const [key, node] of Object.entries(cityNodes)) {
      node.classList.toggle('hi', hi.has(key));
      node.classList.toggle('done', done.has(key));
    }
  }

  function paintChoice(view, active, myTurn) {
    const me = view.me;
    const open = Boolean(me?.pending.length) && (view.setup || (myTurn && view.phase === 'tickets'));
    choose.hidden = !open;
    if (!open) return;
    const key = me.pending.join(',');
    if (key !== pickKey) {
      pickKey = key;
      picks = new Set(me.pending);
      chooseList.replaceChildren(...me.pending.map(id => {
        const ticket = TICKETS[id];
        const label = html('label', 'iron-ticket pick');
        const box = html('input');
        box.type = 'checkbox';
        box.checked = true;
        box.onchange = () => {
          if (box.checked) picks.add(id);
          else picks.delete(id);
          paint();
        };
        const text = html('span');
        text.append(html('b', '', ticketName(ticket)), html('small', '', 'Destination'));
        label.append(box, text, html('span', 'pts', String(ticket.pts)));
        return label;
      }));
    }
    const min = Math.min(me.minKeep, me.pending.length);
    keep.disabled = !active || picks.size < min;
    keep.textContent = `Keep ${plural(picks.size, 'ticket')}`;
  }

  function paintMarket(view, myTurn) {
    const show = !view.setup && !view.over;
    market.hidden = drawTickets.hidden = !show;
    if (!show) return;
    const canDraw = myTurn && (view.phase === 'turn' || view.phase === 'draw2');
    const slots = Array.from({ length: 5 }, (_, index) => {
      const kind = view.market[index];
      if (!kind) {
        const empty = html('button', 'iron-card empty', 'Empty');
        empty.disabled = true;
        return empty;
      }
      const node = card(kind);
      node.append(CARD[kind].n);
      node.setAttribute('aria-label', `Take face-up ${CARD[kind].n} card`);
      node.disabled = !canDraw || !canTakeMarket(view.market, view.phase, index);
      node.onclick = () => submit({ action: 'draw', source: index });
      return node;
    });
    const deck = html('button', 'iron-card deck');
    deck.type = 'button';
    deck.append(html('span', 'sym', '▤'), 'Deck', html('span', 'n', String(view.deck)));
    deck.setAttribute('aria-label', `Draw from the deck, ${view.deck} cards`);
    deck.disabled = !canDraw || !view.deck;
    deck.onclick = () => submit({ action: 'draw', source: 'deck' });
    market.replaceChildren(...slots, deck);
    drawTickets.textContent = `Draw destination tickets (${view.ticketDeck} left)`;
    drawTickets.hidden = !myTurn || view.phase !== 'turn';
    drawTickets.disabled = !view.ticketDeck;
  }

  function paintClaim(view, myTurn) {
    const route = ROUTES[selected];
    claimBox.hidden = !route || Boolean(view.over);
    if (claimBox.hidden) return;
    const owner = view.owner[route.id];
    const colour = route.c === 'gray' ? 'Grey (any one colour)' : CARD[route.c].n;
    const facts = [plural(route.len, 'space'), colour, `worth ${plural(POINTS[route.len], 'point')}`];
    if (route.twin >= 0) facts.push('double route');
    if (owner !== undefined) facts.push(`claimed by ${owner === seat ? 'you' : nameOf(owner)}`);
    const parts = [html('h3', '', routeName(route)), html('p', '', facts.join(' · '))];
    const me = view.me;
    if (owner === undefined && myTurn && view.phase === 'turn' && me) {
      const mine = view.players.find(player => player.seat === seat);
      const problem = claimProblem(view.owner, view.seats.length, seat, mine.trains, me.hand, route);
      if (problem) parts.push(html('p', '', problem));
      else {
        const row = html('div', 'actions');
        for (const option of payOptions(me.hand, route)) {
          row.append(button(option.main ? 'primary' : '', `Claim: ${payLabel(option)}`,
            () => submit({ action: 'claim', route: route.id, color: option.c, count: option.n, loco: option.loco })));
        }
        parts.push(row);
      }
    }
    parts.push(button('', 'Clear selection', () => select(-1)));
    claimBox.replaceChildren(...parts);
  }

  function paintHand(view, myTurn) {
    const me = view.me;
    handTitle.hidden = hand.hidden = ticketTitle.hidden = tickets.hidden = !me;
    claimable.hidden = true;
    if (!me) return;
    hand.replaceChildren(...CARD_KINDS.map(kind => {
      const node = card(kind, 'div');
      node.classList.toggle('zero', !me.hand[kind]);
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', `${me.hand[kind]} ${CARD[kind].n}`);
      node.append(html('b', '', String(me.hand[kind])));
      return node;
    }));
    tickets.replaceChildren(...(me.tickets.length ? me.tickets.map(id => {
      const ticket = TICKETS[id];
      const done = connected(view.owner, seat, ticket.a, ticket.b);
      const node = button(`iron-ticket${done ? ' done' : ''}${highlighted === id ? ' sel' : ''}`, '', () => {
        highlighted = highlighted === id ? -1 : id;
        paint();
      });
      const text = html('span');
      text.append(html('b', '', ticketName(ticket)), html('small', '', done ? 'Complete ✓' : 'Not connected yet'));
      node.append(text, html('span', 'pts', String(ticket.pts)));
      return node;
    }) : [html('small', '', 'No tickets yet.')]));
    if (myTurn && view.phase === 'turn') {
      const mine = view.players.find(player => player.seat === seat);
      const routes = ROUTES.filter(route => !claimProblem(view.owner, view.seats.length, seat, mine.trains, me.hand, route))
        .sort((a, b) => b.len - a.len);
      claimable.hidden = !routes.length;
      const list = html('div', 'iron-route-list');
      list.append(...routes.map(route => {
        const node = button('', '', () => select(route.id));
        const pip = html('span', 'pip');
        pip.style.setProperty('--cc', CARD[route.c].c);
        node.append(pip, routeName(route), html('small', '', `${route.len} · ${plural(POINTS[route.len], 'pt')}`));
        return node;
      }));
      claimable.replaceChildren(html('summary', '', `Routes you can claim (${routes.length})`), list);
    }
  }

  function paintResults(view) {
    results.hidden = !view.over;
    if (!view.over) return;
    const table = html('table');
    const head = html('tr');
    for (const label of ['Player', 'Routes', 'Tickets', 'Longest', 'Total']) head.append(html('th', '', label));
    table.append(head);
    for (const row of view.over.rows) {
      const tr = html('tr');
      const name = html('td', `player-${row.seat}`, nameOf(row.seat));
      tr.append(name, html('td', '', String(row.routes)), html('td', '', `+${row.plus} / −${row.minus}`),
        html('td', '', `${row.longest}${row.bonus ? ` +${LONGEST_BONUS}` : ''}`), html('td', '', String(row.total)));
      table.append(tr);
    }
    const lists = view.over.rows.map(row => {
      const block = html('div');
      block.append(html('h4', `player-${row.seat}`, nameOf(row.seat)));
      const list = html('div', 'iron-tickets');
      list.append(...row.tickets.map(({ id, done }) => {
        const node = html('div', `iron-ticket ${done ? 'done' : 'lost'}`);
        const text = html('span');
        text.append(html('b', '', ticketName(TICKETS[id])), html('small', '', done ? 'Complete' : 'Missed'));
        node.append(text, html('span', 'pts', `${done ? '+' : '−'}${TICKETS[id].pts}`));
        return node;
      }));
      block.append(list);
      return block;
    });
    results.replaceChildren(html('h3', '', 'Final scores'), table, ...lists);
  }

  function paint() {
    if (!last?.view) return;
    const { view, canMove, active } = last;
    const myTurn = canMove && view.turn === seat;
    paintMap(view);
    const final = view.finalBy;
    banner.hidden = final === null;
    if (final !== null) banner.textContent = `${final === seat ? 'You are' : `${nameOf(final)} is`} nearly out of trains. Everyone gets one final turn.`;
    let text;
    if (view.over) text = 'Game over. Final scores and tickets are below.';
    else if (view.setup) text = view.me?.pending.length
      ? 'Choose your starting tickets. Keep at least 2. Unfinished tickets cost their value at the end.'
      : 'Waiting for everyone to choose tickets.';
    else if (myTurn && view.phase === 'tickets') text = 'Keep at least 1 of the new destination tickets.';
    else if (myTurn && view.phase === 'draw2') text = 'Take one more train card. A face-up locomotive can’t be your second card.';
    else if (myTurn) text = 'Draw 2 train cards, claim a route by tapping it on the map, or draw destination tickets.';
    else text = `${nameOf(view.turn)} is playing. Tap a route to see its details.`;
    instruction.textContent = text;
    paintChoice(view, active, myTurn);
    paintMarket(view, myTurn);
    paintClaim(view, myTurn);
    paintResults(view);
    paintHand(view, myTurn);
    rivals.replaceChildren(...view.players.map(player => {
      const item = html('li', `player-${player.seat}`);
      item.append(html('b', '', player.seat === seat ? 'You' : nameOf(player.seat)),
        ` · ${plural(player.trains, 'train')} · ${plural(player.cards, 'card')} · ${plural(player.tickets, 'ticket')}${player.choosing ? ' · choosing tickets' : ''}`);
      return item;
    }));
    logList.replaceChildren(...view.log.toReversed().map(entry => {
      const item = html('li');
      if (entry.seat !== null) item.append(html('b', `player-${entry.seat}`, nameOf(entry.seat)), ' ');
      item.append(entry.text);
      return item;
    }));
  }

  return (view, canMove, _preview, active) => {
    last = { view, canMove, active };
    paint();
  };
}
