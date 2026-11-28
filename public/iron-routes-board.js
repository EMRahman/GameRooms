import {
  MAPS, POINTS, LONGEST_BONUS, CARD_KINDS, STATION_LIMIT, STATION_POINTS, ironMap, routePoints, pathLength,
  payOptions, claimProblem, twinBlocked, canTakeMarket, ticketConnections,
  tunnelExtra, tunnelPayments, stationPayments, stationsBuilt,
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

const NS = 'http://www.w3.org/2000/svg';
// Station targets stay at least this many screen pixels across at every zoom.
const STATION_TARGET_SIZE = 44;
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

// Sea, graticule, neighbouring countries, land, inland seas, lakes and borders of one map.
function drawTerrain(target, data) {
  const pts = list => list.map(([lon, lat]) => data.proj(lon, lat).join(',')).join(' ');
  const base = svgEl('g', { 'aria-hidden': 'true' }, target);
  svgEl('rect', { x: -1000, y: -1000, width: 3000, height: 3000, class: 'water' }, base);
  const [[lon0, lon1, lonStep], [lat0, lat1, latStep]] = data.grat;
  for (let lon = lon0; lon <= lon1; lon += lonStep) {
    const [x] = data.proj(lon, 0);
    svgEl('line', { class: 'grat', x1: x, y1: -1000, x2: x, y2: 2000 }, base);
  }
  for (let lat = lat0; lat <= lat1; lat += latStep) {
    const [, y] = data.proj(0, lat);
    svgEl('line', { class: 'grat', x1: -1000, y1: y, x2: 2000, y2: y }, base);
  }
  for (const land of data.abroad ?? []) svgEl('polygon', { class: 'abroad', points: pts(land) }, base);
  for (const land of data.land) svgEl('polygon', { class: 'land', points: pts(land) }, base);
  for (const sea of data.seas) svgEl('polygon', { class: 'sea', points: pts(sea) }, base);
  for (const lake of data.lakes) svgEl('polygon', { class: 'lake', points: pts(lake) }, base);
  for (const border of data.borders) svgEl('polyline', { class: 'border', points: pts(border) }, base);
}

// A small picture of a map for the room setup sheet.
export function drawMapPreview(id) {
  const data = MAPS[id];
  const { x, y, w, h } = data.full;
  const svg = svgEl('svg', { class: 'iron-preview', viewBox: `${x} ${y} ${w} ${h}`, 'aria-hidden': 'true', focusable: 'false' });
  drawTerrain(svg, data);
  const cities = Object.fromEntries(Object.entries(data.cities).map(([key, [, lon, lat]]) => [key, data.proj(lon, lat)]));
  for (const [a, b, color] of data.routes) {
    svgEl('path', { class: 'track', d: pathD(routePoints(data, a, b)), stroke: CARD[color].c }, svg);
  }
  for (const [cx, cy] of Object.values(cities)) svgEl('circle', { class: 'stop', cx, cy, r: 6 }, svg);
  return svg;
}

// Shifts a polyline sideways by `off`, mitring the corners so twin tracks stay parallel.
function offsetPath(points, off) {
  if (!off) return points;
  const normal = (p, q) => {
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return [-(q[1] - p[1]) / length, (q[0] - p[0]) / length];
  };
  return points.map((p, i) => {
    const n1 = i > 0 ? normal(points[i - 1], p) : null;
    const n2 = i < points.length - 1 ? normal(p, points[i + 1]) : null;
    if (!n1 || !n2) {
      const n = n1 ?? n2;
      return [p[0] + n[0] * off, p[1] + n[1] * off];
    }
    const k = off / (1 + n1[0] * n2[0] + n1[1] * n2[1]);
    return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k];
  });
}

// The part of a polyline between distances s0 and s1 from its start.
function slicePath(points, s0, s1) {
  const out = [];
  let travelled = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const length = Math.hypot(x2 - x1, y2 - y1);
    const from = Math.max(s0, travelled);
    const to = Math.min(s1, travelled + length);
    if (to > from) {
      const at = s => [x1 + (x2 - x1) * (s - travelled) / length, y1 + (y2 - y1) * (s - travelled) / length];
      if (!out.length) out.push(at(from));
      out.push(at(to));
    }
    travelled += length;
  }
  return out;
}

const pathD = points => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');

function routeGeometry(route) {
  const points = offsetPath(route.pts, route.side * 5.5);
  const trim = 9;
  const gap = 2.2;
  const car = (pathLength(points) - trim * 2 - gap * (route.len - 1)) / route.len;
  let cars = '';
  for (let i = 0; i < route.len; i++) {
    const start = trim + i * (car + gap);
    cars += pathD(slicePath(points, start, start + car));
  }
  return { cars, line: pathD(points) };
}

// Draws a built map's terrain, tracks and labelled cities into `svg`.
function drawNetwork(svg, map) {
  svg.style.aspectRatio = `${map.data.full.w} / ${map.data.full.h}`;
  drawTerrain(svg, map.data);
  const routeLayer = svgEl('g', {}, svg);
  const routeNodes = map.routes.map(route => {
    const group = svgEl('g', { class: 'route' }, routeLayer);
    const { cars, line } = routeGeometry(route);
    svgEl('path', { class: 'out', d: cars }, group);
    const carPath = svgEl('path', { class: 'car', d: cars, stroke: CARD[route.c].c }, group);
    const bore = route.tunnel ? svgEl('path', { class: 'bore', d: cars }, group) : null;
    const hit = svgEl('path', { class: 'hit', d: line, 'data-route': route.id }, group);
    const title = svgEl('title', {}, hit);
    return { group, carPath, bore, title };
  });
  const cityLayer = svgEl('g', {}, svg);
  const cityNodes = Object.fromEntries(Object.entries(map.cities).map(([key, city]) => {
    const group = svgEl('g', { class: 'city' }, cityLayer);
    svgEl('circle', { class: 'stop', cx: city.x, cy: city.y, r: 6 }, group);
    const station = svgEl('path', {
      class: 'station', d: 'M-7 -1L0 -7L7 -1V6H-7Z M-2 6V1H2V6', transform: `translate(${city.x} ${city.y})`,
    }, group);
    station.style.display = 'none';
    const side = city[3];
    const label = svgEl('text', {
      x: city.x + (side === 'l' ? -10 : side === 'r' ? 10 : 0),
      y: city.y + (side === 't' ? -11 : side === 'b' ? 19 : 4),
      'text-anchor': side === 'l' ? 'end' : side === 'r' ? 'start' : 'middle',
    }, group);
    label.textContent = city[0];
    return [key, { group, station }];
  }));
  return { routeNodes, cityNodes };
}

// Pan and zoom for a map `svg`, added to `wrap` with its zoom buttons. While fully zoomed out,
// touch scrolls the page instead of the map. `dragged()` says whether the last press was a drag.
function panZoom(svg, wrap) {
  let FULL = { x: 0, y: 0, w: 1, h: 1 };
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
    wrap.classList.toggle('zoomed', frame.w < FULL.w);
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
  const zoom = html('div', 'iron-zoom');
  zoom.append(
    button('', '+', () => zoomCentre(1 / 1.4)),
    button('', '−', () => zoomCentre(1.4)),
    button('', 'Fit', () => { frame = { ...FULL }; applyFrame(); }),
  );
  zoom.children[0].setAttribute('aria-label', 'Zoom in');
  zoom.children[1].setAttribute('aria-label', 'Zoom out');
  wrap.append(svg, zoom);
  return {
    // Shows the whole of a map whose full extent is `full`.
    show(full) {
      FULL = { ...full };
      frame = { ...FULL };
      applyFrame();
    },
    dragged() {
      const was = dragged;
      dragged = false;
      return was;
    },
  };
}

// A full-size view of a map with city names, panned and zoomed like the board, for the room setup sheet.
export function mapPeek() {
  const element = html('div', 'iron-map iron-peek');
  const svg = svgEl('svg', { role: 'img' });
  const zoomer = panZoom(svg, element);
  return {
    element,
    show(id) {
      const map = ironMap(id);
      svg.replaceChildren();
      svg.setAttribute('aria-label', `Railway map of ${map.name}`);
      element.style.setProperty('--ar', (map.data.full.w / map.data.full.h).toFixed(4));
      drawNetwork(svg, map);
      zoomer.show(map.data.full);
    },
  };
}

export function drawIronRoutes(container, seat, submit, nameOf) {
  let map = null;
  let selected = -1;
  let highlighted = -1;
  // null when not building a station, '' while picking a city, otherwise the chosen city.
  let stationCity = null;
  let picks = new Set();
  let pickKey = '';
  let last = null;
  let routeNodes = [];
  let cityNodes = {};

  const cityName = key => map.cities[key][0];
  const routeName = route => `${cityName(route.a)}–${cityName(route.b)}`;
  const ticketName = ticket => `${cityName(ticket.a)} → ${cityName(ticket.b)}`;

  // ---------- Map ----------
  const mapWrap = html('div', 'iron-map');
  const svg = svgEl('svg', { role: 'group', 'aria-label': 'Railway map' });

  function buildMap(id, rev) {
    map = ironMap(id, rev);
    selected = -1;
    highlighted = -1;
    stationCity = null;
    svg.replaceChildren();
    svg.setAttribute('aria-label', `Railway map of ${map.name}`);
    ({ routeNodes, cityNodes } = drawNetwork(svg, map));
    zoomer.show(map.data.full);
  }

  const zoomer = panZoom(svg, mapWrap);

  // The nearest visible city within a touch-sized square of the tap, so crowded cities stay pickable.
  function cityAt(clientX, clientY) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const bounds = svg.getBoundingClientRect();
    const half = STATION_TARGET_SIZE / 2;
    let nearest = null;
    let distance = Infinity;
    for (const [key, city] of Object.entries(map.cities)) {
      const centre = new DOMPoint(city.x, city.y).matrixTransform(matrix);
      if (centre.x < bounds.left || centre.x > bounds.right || centre.y < bounds.top || centre.y > bounds.bottom) continue;
      const dx = centre.x - clientX;
      const dy = centre.y - clientY;
      if (Math.abs(dx) > half || Math.abs(dy) > half) continue;
      if (dx * dx + dy * dy < distance) { nearest = key; distance = dx * dx + dy * dy; }
    }
    return nearest;
  }

  svg.addEventListener('click', event => {
    if (zoomer.dragged()) return;
    if (!map || last?.view.phase === 'tunnel') return;
    if (stationCity !== null) {
      const city = cityAt(event.clientX, event.clientY);
      if (city) {
        stationCity = city;
        paint();
        claimBox.querySelector('select')?.focus();
      }
      return;
    }
    const hit = event.target.closest('[data-route]');
    const id = hit ? Number(hit.dataset.route) : -1;
    select(id === selected ? -1 : id);
  });

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
  const turnActions = html('div', 'iron-actions');
  const drawTickets = button('', '', () => submit({ action: 'drawTickets' }));
  const pickStation = button('', '', () => {
    selected = -1;
    stationCity = '';
    paint();
    claimBox.querySelector('select')?.focus();
  });
  turnActions.append(drawTickets, pickStation);
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
  panel.append(instruction, choose, market, turnActions, claimBox, results, handTitle, hand, ticketTitle, tickets, claimable, rivals, logPanel);
  container.setAttribute('aria-label', 'Iron Routes');
  container.replaceChildren(mapWrap, banner, panel);

  function select(id) {
    selected = id;
    stationCity = null;
    paint();
  }

  function paintMap(view, done) {
    const count = view.seats.length;
    const tunnels = Boolean(view.stations);
    mapWrap.classList.toggle('station-pick', stationCity !== null);
    for (const route of map.routes) {
      const { group, carPath, bore, title } = routeNodes[route.id];
      const owner = view.owner[route.id];
      const colour = owner !== undefined ? SEAT_COLORS[owner] : CARD[route.c].c;
      group.classList.toggle('claimed', owner !== undefined);
      group.classList.toggle('blocked', twinBlocked(view.owner, count, route));
      group.classList.toggle('sel', (view.tunnel ? view.tunnel.route : selected) === route.id);
      group.classList.toggle('tunnel', tunnels && route.tunnel);
      carPath.setAttribute('stroke', colour);
      bore?.setAttribute('stroke', colour === CARD.black.c ? '#fffaf0' : '#2c241b');
      const kind = `${route.len} ${route.c === 'gray' ? 'grey' : route.c}${tunnels && route.tunnel ? ' tunnel' : ''}`;
      title.textContent = `${routeName(route)}, ${kind}${owner !== undefined ? `, claimed by ${nameOf(owner)}` : ''}`;
    }
    const hi = new Set();
    const complete = new Set();
    for (const id of view.me?.pending ?? []) hi.add(map.tickets[id].a).add(map.tickets[id].b);
    if (highlighted >= 0) {
      const ticket = map.tickets[highlighted];
      hi.add(ticket.a).add(ticket.b);
      if (done.has(highlighted)) complete.add(ticket.a).add(ticket.b);
    }
    for (const [key, { group, station }] of Object.entries(cityNodes)) {
      const owner = view.stations?.[key];
      station.style.display = owner === undefined ? 'none' : '';
      if (owner !== undefined) station.setAttribute('fill', SEAT_COLORS[owner]);
      group.classList.toggle('hi', hi.has(key));
      group.classList.toggle('done', complete.has(key));
      group.classList.toggle('picked', key === stationCity);
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
        const ticket = map.tickets[id];
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
    const show = !view.setup && !view.over && view.phase !== 'tunnel';
    market.hidden = turnActions.hidden = !show;
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
    turnActions.hidden = !myTurn || view.phase !== 'turn';
    drawTickets.textContent = `Draw destination tickets (${view.ticketDeck} left)`;
    drawTickets.disabled = !view.ticketDeck;
    const left = view.stations ? STATION_LIMIT - stationsBuilt(view.stations, seat) : 0;
    pickStation.hidden = !left;
    pickStation.textContent = `Build station (${left} left)`;
  }

  // One primary button for the payment using the most coloured cards, the rest tucked away.
  function payButtons(options, label, move) {
    const make = option => button(option.main ? 'primary' : '', `${label}${option.n || option.loco ? `: ${payLabel(option)}` : ''}`,
      () => submit({ ...move, color: option.c, count: option.n, loco: option.loco }));
    const row = html('div', 'actions');
    row.append(...options.filter(option => option.main).map(make));
    const rest = options.filter(option => !option.main);
    if (!rest.length) return [row];
    const more = html('details', 'iron-more');
    const extra = html('div', 'actions');
    extra.append(...rest.map(make));
    more.append(html('summary', '', 'More ways to pay'), extra);
    return [row, more];
  }

  function tunnelParts(view, myTurn) {
    const tunnel = view.tunnel;
    const route = map.routes[tunnel.route];
    const extra = tunnelExtra(tunnel);
    const parts = [html('h3', '', `${routeName(route)} tunnel`)];
    if (tunnel.cards.length) {
      const list = html('ul', 'iron-revealed');
      list.setAttribute('aria-label', 'Revealed cards');
      list.append(...tunnel.cards.map(kind => {
        const item = card(kind, 'li');
        item.append(CARD[kind].n);
        return item;
      }));
      parts.push(list);
    } else parts.push(html('p', '', 'No cards left to reveal.'));
    parts.push(html('p', '', `Base payment ${payLabel(tunnel.base) || 'none'}. ${extra ? `${plural(extra, 'extra card')} required.` : 'No extra cards required.'}`));
    if (!myTurn || !view.me) return parts;
    const options = tunnelPayments(view.me.hand, tunnel);
    if (options.length) parts.push(...payButtons(options, extra ? 'Pay extra and claim' : 'Claim tunnel', { action: 'tunnel' }));
    else parts.push(html('p', '', 'You can’t cover the extra cost.'));
    parts.push(button('', 'Abandon attempt', () => submit({ action: 'tunnel', abandon: true })));
    return parts;
  }

  function stationParts(view) {
    const built = stationsBuilt(view.stations, seat);
    const cost = built + 1;
    const owner = stationCity ? view.stations[stationCity] : undefined;
    const parts = [html('h3', '', 'Build a station'),
      html('p', '', 'Borrow one opponent’s track from this city for your tickets. Pick a city on the map or from the list.')];
    const list = html('select');
    list.setAttribute('aria-label', 'Station city');
    const blank = html('option', '', 'Choose a city');
    blank.value = '';
    list.append(blank, ...Object.keys(map.cities).sort((a, b) => cityName(a).localeCompare(cityName(b))).map(key => {
      const option = html('option', '', `${cityName(key)}${view.stations[key] === undefined ? '' : ' (has a station)'}`);
      option.value = key;
      option.selected = key === stationCity;
      return option;
    }));
    list.onchange = () => {
      stationCity = list.value;
      paint();
      claimBox.querySelector('select')?.focus();
    };
    parts.push(list, html('p', '', `${STATION_LIMIT - built} left · costs ${plural(cost, 'card')} of one colour · each unbuilt station is worth ${STATION_POINTS} points`));
    const options = stationPayments(view.stations, seat, view.me.hand);
    if (owner !== undefined) parts.push(html('p', '', `${owner === seat ? 'You already have' : `${nameOf(owner)} already has`} a station here.`));
    else if (!options.length) parts.push(html('p', '', 'You need more cards to build a station.'));
    else if (stationCity) parts.push(...payButtons(options, 'Build station', { action: 'station', city: stationCity }));
    parts.push(button('', 'Cancel', () => select(-1)));
    return parts;
  }

  function routeParts(view, myTurn) {
    const route = map.routes[selected];
    const owner = view.owner[route.id];
    const tunnel = Boolean(view.stations) && route.tunnel;
    const colour = route.c === 'gray' ? 'Grey (any one colour)' : CARD[route.c].n;
    const facts = [plural(route.len, 'space'), colour, `worth ${plural(POINTS[route.len], 'point')}`];
    if (tunnel) facts.push('tunnel');
    if (route.twin >= 0) facts.push('double route');
    if (owner !== undefined) facts.push(`claimed by ${owner === seat ? 'you' : nameOf(owner)}`);
    const parts = [html('h3', '', routeName(route)), html('p', '', facts.join(' · '))];
    const me = view.me;
    if (owner === undefined && myTurn && view.phase === 'turn' && me) {
      const mine = view.players.find(player => player.seat === seat);
      const problem = claimProblem(view.owner, view.seats.length, seat, mine.trains, me.hand, route);
      if (problem) parts.push(html('p', '', problem));
      else {
        if (tunnel) parts.push(html('p', '', 'Three cards are revealed from the deck. Each locomotive, and each card matching your colour, adds one card to the cost.'));
        parts.push(...payButtons(payOptions(me.hand, route), tunnel ? 'Attempt tunnel' : 'Claim', { action: 'claim', route: route.id }));
      }
    }
    parts.push(button('', 'Clear selection', () => select(-1)));
    return parts;
  }

  function paintClaim(view, myTurn) {
    let parts = null;
    if (view.tunnel) parts = tunnelParts(view, myTurn);
    else if (stationCity !== null && myTurn && view.phase === 'turn' && view.stations && view.me) parts = stationParts(view);
    else if (selected >= 0 && !view.over) parts = routeParts(view, myTurn);
    claimBox.hidden = !parts;
    if (parts) claimBox.replaceChildren(...parts);
  }

  function paintHand(view, myTurn, done) {
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
      const ticket = map.tickets[id];
      const complete = done.has(id);
      const node = button(`iron-ticket${complete ? ' done' : ''}${highlighted === id ? ' sel' : ''}`, '', () => {
        highlighted = highlighted === id ? -1 : id;
        paint();
      });
      const text = html('span');
      text.append(html('b', '', ticketName(ticket)), html('small', '', complete ? 'Complete ✓' : 'Not connected yet'));
      node.append(text, html('span', 'pts', String(ticket.pts)));
      return node;
    }) : [html('small', '', 'No tickets yet.')]));
    if (myTurn && view.phase === 'turn') {
      const mine = view.players.find(player => player.seat === seat);
      const routes = map.routes.filter(route => !claimProblem(view.owner, view.seats.length, seat, mine.trains, me.hand, route))
        .sort((a, b) => b.len - a.len);
      claimable.hidden = !routes.length;
      const list = html('div', 'iron-route-list');
      list.append(...routes.map(route => {
        const node = button('', '', () => select(route.id));
        const pip = html('span', 'pip');
        pip.style.setProperty('--cc', CARD[route.c].c);
        const tunnel = view.stations && route.tunnel ? ' · tunnel' : '';
        node.append(pip, routeName(route), html('small', '', `${route.len} · ${plural(POINTS[route.len], 'pt')}${tunnel}`));
        return node;
      }));
      claimable.replaceChildren(html('summary', '', `Routes you can claim (${routes.length})`), list);
    }
  }

  function paintResults(view) {
    results.hidden = !view.over;
    if (!view.over) return;
    const stations = Boolean(view.stations);
    const table = html('table');
    const head = html('tr');
    for (const label of ['Player', 'Routes', 'Tickets', 'Longest', ...(stations ? ['Stations'] : []), 'Total']) head.append(html('th', '', label));
    table.append(head);
    for (const row of view.over.rows) {
      const tr = html('tr');
      const name = html('td', `player-${row.seat}`, nameOf(row.seat));
      tr.append(name, html('td', '', String(row.routes)), html('td', '', `+${row.plus} / −${row.minus}`),
        html('td', '', `${row.longest}${row.bonus ? ` +${LONGEST_BONUS}` : ''}`));
      if (stations) tr.append(html('td', '', String(row.stationPoints ?? 0)));
      tr.append(html('td', '', String(row.total)));
      table.append(tr);
    }
    const lists = view.over.rows.map(row => {
      const block = html('div');
      block.append(html('h4', `player-${row.seat}`, nameOf(row.seat)));
      const borrowed = (row.borrowed ?? []).map(({ city, id }) => `${cityName(city)} station uses ${routeName(map.routes[id])}`);
      if (borrowed.length) block.append(html('p', '', borrowed.join(' · ')));
      const list = html('div', 'iron-tickets');
      list.append(...row.tickets.map(({ id, done }) => {
        const node = html('div', `iron-ticket ${done ? 'done' : 'lost'}`);
        const text = html('span');
        text.append(html('b', '', ticketName(map.tickets[id])), html('small', '', done ? 'Complete' : 'Missed'));
        node.append(text, html('span', 'pts', `${done ? '+' : '−'}${map.tickets[id].pts}`));
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
    if (map?.id !== view.map || map.rev !== view.rev) buildMap(view.map, view.rev);
    const myTurn = canMove && view.turn === seat;
    if (!myTurn || view.phase !== 'turn' || !view.stations) stationCity = null;
    const done = view.me ? ticketConnections(map, view.owner, view.stations, seat, view.me.tickets).done : new Set();
    paintMap(view, done);
    const final = view.finalBy;
    banner.hidden = final === null;
    if (final !== null) banner.textContent = `${final === seat ? 'You are' : `${nameOf(final)} is`} nearly out of trains. Everyone gets one final turn.`;
    let text;
    if (view.over) text = 'Game over. Final scores and tickets are below.';
    else if (view.setup) text = view.me?.pending.length
      ? 'Choose your starting tickets. Keep at least 2. Unfinished tickets cost their value at the end.'
      : 'Waiting for everyone to choose tickets.';
    else if (view.phase === 'tunnel') text = myTurn ? 'Review the revealed cards, then finish or abandon the tunnel.'
      : `${nameOf(view.turn)} is attempting a tunnel.`;
    else if (myTurn && view.phase === 'tickets') text = 'Keep at least 1 of the new destination tickets.';
    else if (myTurn && view.phase === 'draw2') text = 'Take one more train card. A face-up locomotive can’t be your second card.';
    else if (myTurn) text = view.stations
      ? 'Draw 2 train cards, claim a route by tapping it on the map, draw destination tickets, or build a station.'
      : 'Draw 2 train cards, claim a route by tapping it on the map, or draw destination tickets.';
    else text = `${nameOf(view.turn)} is playing. Tap a route to see its details.`;
    instruction.textContent = text;
    paintChoice(view, active, myTurn);
    paintMarket(view, myTurn);
    paintClaim(view, myTurn);
    paintResults(view);
    paintHand(view, myTurn, done);
    rivals.replaceChildren(...view.players.map(player => {
      const item = html('li', `player-${player.seat}`);
      const stations = view.stations ? ` · ${plural(STATION_LIMIT - stationsBuilt(view.stations, player.seat), 'station')} left` : '';
      item.append(html('b', '', player.seat === seat ? 'You' : nameOf(player.seat)),
        ` · ${plural(player.trains, 'train')} · ${plural(player.cards, 'card')} · ${plural(player.tickets, 'ticket')}${stations}${player.choosing ? ' · choosing tickets' : ''}`);
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
