import {
  MAP, COLS, ROWS, CONTINENTS, TERRS, CODE_INDEX, SEA_LANES, SYMBOLS, NT, cellAt,
  cardSymbol, tradeValue, bestSet, contHolder, reachable, canAttackFrom, canFortifyFrom, mustTrade, reinforcementsFor,
} from './conquest-rules.js';

// Seat colours match the player cards in style.css; `land` is the darker map fill.
const SEAT = [
  { main: '#ff947d', land: '#8f4a3c' }, { main: '#68dfcf', land: '#2c7a70' }, { main: '#ffcc77', land: '#8a6a2e' },
  { main: '#9cd4ff', land: '#3f6f96' }, { main: '#ddb9ff', land: '#6e5291' }, { main: '#a8e07a', land: '#4f7a2f' },
];
const CS = 20;
const MW = COLS * CS;
const MH = ROWS * CS;
const NS = 'http://www.w3.org/2000/svg';
const WRAP = SEA_LANES[0];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const armies = n => plural(n, 'army', 'armies');
const svgEl = (tag, attrs, parent) => {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.appendChild(node);
  return node;
};

export function drawConquest(container, seat, submit, nameOf) {
  let last = null;
  // Local choices that have not been sent yet.
  const ui = { sel: null, target: null, dice: 3, amount: 1, moveN: 1, contFocus: null, place: new Map(), placeLog: [], key: '', rollKey: '' };

  const wrap = document.createElement('div');
  wrap.className = 'cq-map';
  const svg = svgEl('svg', { class: 'cq-svg', preserveAspectRatio: 'xMidYMid meet', role: 'group', 'aria-label': 'World map' });
  const hint = document.createElement('div');
  hint.className = 'cq-hint';
  hint.setAttribute('aria-hidden', 'true');
  const zoom = document.createElement('div');
  zoom.className = 'cq-zoom';
  zoom.innerHTML = '<button type="button" data-zoom="in" aria-label="Zoom in">+</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="fit" aria-label="Show the whole map">⤢</button>';
  wrap.append(svg, hint, zoom);
  const panel = document.createElement('div');
  panel.className = 'cq-panel';
  container.setAttribute('aria-label', 'Conquest');
  container.replaceChildren(wrap, panel);

  // ---------- Map ----------
  const terrNodes = [];
  const fillNodes = [];
  const outlineNodes = [];
  const badgeNodes = [];
  const anchors = [];
  (function buildMap() {
    const defs = svgEl('defs', {}, svg);
    const pat = svgEl('pattern', { id: 'cq-grid', width: CS, height: CS, patternUnits: 'userSpaceOnUse' }, defs);
    svgEl('path', { d: `M ${CS} 0 V ${CS} H 0`, fill: 'none', stroke: 'rgba(170,205,245,.07)', 'stroke-width': 1 }, pat);
    svgEl('rect', { x: -2000, y: -2000, width: MW + 4000, height: MH + 4000, fill: 'url(#cq-grid)', 'pointer-events': 'none' }, svg);
    const lanes = svgEl('g', {}, svg);
    const lands = svgEl('g', {}, svg);
    const lines = svgEl('g', {}, svg);
    const outlines = svgEl('g', {}, svg);
    const badges = svgEl('g', {}, svg);

    // Sea lanes: any neighbour pair that does not share a land edge.
    const touching = new Set();
    TERRS.forEach(t => t.cells.forEach(([c, r]) => {
      for (const o of [cellAt(c + 1, r), cellAt(c, r + 1)]) if (o !== '.' && o !== t.code) touching.add([t.code, o].sort().join(''));
    }));
    const done = new Set();
    const mid = v => v * CS + CS / 2;
    TERRS.forEach(t => t.adj.forEach(o => {
      const key = [t.code, TERRS[o].code].sort().join('');
      if (touching.has(key) || done.has(key)) return;
      done.add(key);
      if (key === [...WRAP].sort().join('')) {
        const ak = TERRS[CODE_INDEX.get(WRAP[0])].cells.reduce((m, cell) => cell[0] < m[0] ? cell : m);
        const kk = TERRS[CODE_INDEX.get(WRAP[1])].cells.reduce((m, cell) => cell[0] > m[0] ? cell : m);
        svgEl('line', { class: 'cq-lane', x1: mid(ak[0]), y1: mid(ak[1]), x2: -14, y2: mid(ak[1]) }, lanes);
        svgEl('line', { class: 'cq-lane', x1: mid(kk[0]), y1: mid(kk[1]), x2: MW + 14, y2: mid(kk[1]) }, lanes);
        svgEl('text', { class: 'cq-wrap', x: 2, y: CS * 1.6, 'text-anchor': 'start' }, lanes).textContent = '◂ to Chukotka';
        svgEl('text', { class: 'cq-wrap', x: MW - 2, y: CS * 0.7, 'text-anchor': 'end' }, lanes).textContent = 'to Klondike ▸';
        return;
      }
      let best = null;
      let bd = Infinity;
      t.cells.forEach(a => TERRS[o].cells.forEach(b => {
        const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
        if (d < bd) { bd = d; best = [a, b]; }
      }));
      svgEl('line', { class: 'cq-lane', x1: mid(best[0][0]), y1: mid(best[0][1]), x2: mid(best[1][0]), y2: mid(best[1][1]) }, lanes);
    }));

    let borderD = '';
    let contD = '';
    let coastD = '';
    TERRS.forEach(t => {
      const g = svgEl('g', { class: 'cq-terr', 'data-t': t.i, tabindex: '0', role: 'button' }, lands);
      let d = '';
      let outlineD = '';
      t.cells.forEach(([c, r]) => {
        const x = c * CS;
        const y = r * CS;
        d += `M${x} ${y}h${CS}v${CS}h-${CS}z`;
        [[cellAt(c, r - 1), `M${x} ${y}h${CS}`], [cellAt(c + 1, r), `M${x + CS} ${y}v${CS}`],
          [cellAt(c, r + 1), `M${x} ${y + CS}h${CS}`], [cellAt(c - 1, r), `M${x} ${y}v${CS}`]].forEach(([o, seg], k) => {
          if (o === t.code) return;
          outlineD += seg;
          if (o === '.') coastD += seg;
          else if (k < 2) {
            if (TERRS[CODE_INDEX.get(o)].cont !== t.cont) contD += seg;
            else borderD += seg;
          }
        });
      });
      fillNodes[t.i] = svgEl('path', { class: 'cq-fill', d, fill: '#24364f' }, g);
      terrNodes[t.i] = g;
      outlineNodes[t.i] = svgEl('path', { class: 'cq-outline', d: outlineD }, outlines);
      g.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(t.i); }
      });
      g.addEventListener('focus', () => { outlineNodes[t.i].classList.add('focus'); showHint(t.i); });
      g.addEventListener('blur', () => { outlineNodes[t.i].classList.remove('focus'); hint.classList.remove('show'); });

      // Badge anchor: the cell deepest inside the territory, nearest its centre.
      const set = new Set(t.cells.map(([c, r]) => `${c},${r}`));
      const cx = t.cells.reduce((s, [c]) => s + c, 0) / t.cells.length;
      const cy = t.cells.reduce((s, [, r]) => s + r, 0) / t.cells.length;
      let bestCell = t.cells[0];
      let bestScore = -Infinity;
      t.cells.forEach(([c, r]) => {
        let depth = 0;
        for (let inside = true; inside && depth < 6;) {
          const k = depth + 1;
          for (let dc = -k; dc <= k && inside; dc++) {
            for (let dr = -k; dr <= k && inside; dr++) if (Math.abs(dc) + Math.abs(dr) <= k && !set.has(`${c + dc},${r + dr}`)) inside = false;
          }
          if (inside) depth++;
        }
        const score = depth * 10 - Math.hypot(c - cx, r - cy);
        if (score > bestScore) { bestScore = score; bestCell = [c, r]; }
      });
      anchors[t.i] = [mid(bestCell[0]), mid(bestCell[1])];
    });
    svgEl('path', { class: 'cq-borders', d: borderD }, lines);
    svgEl('path', { class: 'cq-cont-borders', d: contD }, lines);
    svgEl('path', { class: 'cq-coast', d: coastD }, lines);
    TERRS.forEach(t => {
      const b = svgEl('g', { class: 'cq-badge', 'data-t': t.i, 'aria-hidden': 'true' }, badges);
      svgEl('circle', { r: 11, fill: '#3a4d6a' }, b);
      svgEl('text', { class: 'num' }, b);
      svgEl('text', { class: 'add', x: 12, y: -9 }, b);
      svgEl('text', { class: 'lbl', y: 21 }, b).textContent = t.label;
      badgeNodes[t.i] = b;
    });
  })();

  // ---------- Pan and zoom ----------
  let vb = { x: 0, y: 0, w: MW, h: MH };
  let fitted = true;
  let badgeScale = 0;
  const box = () => {
    const r = wrap.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height), l: r.left, t: r.top };
  };
  const fitBox = () => {
    const { w, h } = box();
    const bw = MW + 30;
    const bh = MH + 20;
    const [fw, fh] = bw / bh > w / h ? [bw, bw * h / w] : [bh * w / h, bh];
    return { x: MW / 2 - fw / 2, y: MH / 2 - fh / 2, w: fw, h: fh };
  };
  function setView(next) {
    const f = fitBox();
    const { w, h } = box();
    const vw = clamp(next.w, f.w / 6, f.w);
    const vh = vw * h / w;
    const x = vw >= MW + 30 ? MW / 2 - vw / 2 : clamp(next.x, -15, MW + 15 - vw);
    const y = vh >= MH + 20 ? MH / 2 - vh / 2 : clamp(next.y, -10, MH + 10 - vh);
    vb = { x, y, w: vw, h: vh };
    fitted = vw >= f.w - 0.5;
    svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`);
    const ppu = w / vw;
    svg.classList.toggle('show-labels', ppu >= 0.72);
    const scale = Math.max(1, 9 / (11 * ppu));
    if (Math.abs(scale - badgeScale) > 0.01) {
      badgeScale = scale;
      badgeNodes.forEach((b, i) => b.setAttribute('transform', `translate(${anchors[i][0]} ${anchors[i][1]}) scale(${scale.toFixed(3)})`));
    }
  }
  const fitMap = () => setView(fitBox());
  const toSvg = (cx, cy) => {
    const b = box();
    return { x: vb.x + (cx - b.l) / b.w * vb.w, y: vb.y + (cy - b.t) / b.h * vb.h };
  };
  function zoomAt(factor, cx, cy) {
    const b = box();
    if (cx === undefined) { cx = b.l + b.w / 2; cy = b.t + b.h / 2; }
    const p = toSvg(cx, cy);
    const nw = vb.w / factor;
    const nh = nw * b.h / b.w;
    setView({ x: p.x - (p.x - vb.x) * (nw / vb.w), y: p.y - (p.y - vb.y) * (nh / vb.h), w: nw, h: nh });
  }
  const pointers = new Map();
  let gesture = null;
  const territoryAt = target => {
    const node = target?.closest?.('[data-t]');
    return node ? Number(node.getAttribute('data-t')) : null;
  };
  // Touches that land just off a coast still pick the nearest territory.
  const nearest = (cx, cy, maxPx) => {
    const p = toSvg(cx, cy);
    let best = null;
    let bd = maxPx * vb.w / box().w;
    TERRS.forEach(t => t.cells.forEach(([c, r]) => {
      const d = Math.hypot(Math.max(c * CS - p.x, 0, p.x - (c + 1) * CS), Math.max(r * CS - p.y, 0, p.y - (r + 1) * CS));
      if (d < bd) { bd = d; best = t.i; }
    }));
    return best;
  };
  svg.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { svg.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) gesture = { type: 'tap', sx: e.clientX, sy: e.clientY, vb0: { ...vb }, terr: territoryAt(e.target), kind: e.pointerType };
    else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, vb0: { ...vb }, m0: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2) };
    }
  });
  svg.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' && !pointers.size) {
      const t = territoryAt(e.target);
      if (t !== null) showHint(t); else hint.classList.remove('show');
    }
    if (!pointers.has(e.pointerId) || !gesture) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const b = box();
    if (gesture.type === 'tap' || gesture.type === 'pan') {
      const dx = e.clientX - gesture.sx;
      const dy = e.clientY - gesture.sy;
      if (gesture.type === 'tap' && Math.hypot(dx, dy) > 8) { gesture.type = 'pan'; svg.classList.add('dragging'); }
      if (gesture.type === 'pan') setView({ x: gesture.vb0.x - dx * gesture.vb0.w / b.w, y: gesture.vb0.y - dy * gesture.vb0.h / b.h, w: gesture.vb0.w, h: gesture.vb0.h });
    } else if (pointers.size >= 2) {
      const [p1, p2] = [...pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y) || 1;
      const f = fitBox();
      const nw = clamp(gesture.vb0.w * gesture.d0 / d, f.w / 6, f.w);
      const scale = nw / b.w;
      setView({ x: gesture.m0.x - ((p1.x + p2.x) / 2 - b.l) * scale, y: gesture.m0.y - ((p1.y + p2.y) / 2 - b.t) * scale, w: nw, h: nw * b.h / b.w });
    }
  });
  const endPointer = e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (gesture?.type === 'tap' && e.type === 'pointerup') {
      const t = gesture.terr ?? (gesture.kind !== 'mouse' ? nearest(e.clientX, e.clientY, 22) : null);
      if (t !== null) activate(t);
    }
    if (pointers.size === 1 && gesture?.type === 'pinch') {
      const [rest] = [...pointers.values()];
      gesture = { type: 'pan', sx: rest.x, sy: rest.y, vb0: { ...vb } };
    } else if (!pointers.size) {
      gesture = null;
      svg.classList.remove('dragging');
    }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pointers.size) hint.classList.remove('show'); });
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 16 : 1) * 0.0015), e.clientX, e.clientY);
  }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(type => wrap.addEventListener(type, e => e.preventDefault()));
  zoom.addEventListener('click', e => {
    const z = e.target.closest('[data-zoom]')?.dataset.zoom;
    if (z === 'in') zoomAt(1.5);
    else if (z === 'out') zoomAt(1 / 1.5);
    else if (z) fitMap();
  });
  new ResizeObserver(() => (fitted ? fitMap() : setView(vb))).observe(wrap);

  // ---------- Helpers over the current view ----------
  const pidName = (view, pid) => pid < 0 ? 'Nobody' : view.seats[pid] === seat ? 'You' : nameOf(view.seats[pid]);
  const colorOf = (view, pid) => SEAT[view.seats[pid]] ?? { main: '#3a4d6a', land: '#24364f' };
  const logText = (view, text) => esc(text).replace(/@(\d)/g, (_, pid) =>
    `<b style="color:${colorOf(view, Number(pid)).main}">${esc(pidName(view, Number(pid)))}</b>`);
  const placed = () => [...ui.place.values()].reduce((a, b) => a + b, 0);
  // How many armies this seat is placing right now, or 0.
  const toPlace = view => view.phase === 'setup' ? view.pool : view.phase === 'reinforce' && view.cur === view.me ? view.reinforce : 0;
  const left = view => toPlace(view) - placed();

  function showHint(t) {
    const view = last?.view;
    if (!view) return;
    const o = view.owner[t];
    const extra = ui.place.get(t) ? ` (+${ui.place.get(t)})` : '';
    hint.innerHTML = `<span class="sw" style="background:${colorOf(view, o).main}"></span><strong>${esc(TERRS[t].name)}</strong> · ${esc(CONTINENTS[TERRS[t].cont].name)} · ${esc(pidName(view, o))} · ${armies(view.armies[t])}${extra}`;
    hint.classList.add('show');
  }

  // ---------- Taps on the map ----------
  function activate(t) {
    const view = last?.view;
    if (!view || view.over) return;
    showHint(t);
    if (ui.contFocus !== null) ui.contFocus = null;
    const me = view.me;
    const mine = view.owner[t] === me;
    if (toPlace(view)) {
      if (!mine) return flash('Place armies on your own territories.');
      if (view.phase === 'reinforce' && mustTrade(view.hand)) return flash('You hold 5 or more cards: trade a set first.');
      const n = ui.amount === 'all' ? left(view) : Math.min(ui.amount, left(view));
      if (n <= 0) return flash('All armies placed. Confirm when ready.');
      ui.place.set(t, (ui.place.get(t) ?? 0) + n);
      ui.placeLog.push([t, n]);
      return paint();
    }
    if (view.cur !== me || !last.active) return;
    if (view.phase === 'attack') {
      if (view.pending) return flash('Choose how many armies to move in first.');
      if (mine) {
        if (ui.sel === t) ui.sel = null;
        else if (canAttackFrom(view, me, t)) ui.sel = t;
        else flash(view.armies[t] < 2 ? `${TERRS[t].name} needs at least 2 armies to attack.` : `${TERRS[t].name} has no enemy neighbours.`);
        ui.target = null;
        return paint();
      }
      if (ui.sel === null) return flash('First choose one of your territories to attack from.');
      if (!TERRS[ui.sel].adj.includes(t)) return flash(`${TERRS[t].name} is not next to ${TERRS[ui.sel].name}.`);
      ui.target = t;
      return paint();
    }
    if (view.phase === 'fortify') {
      if (!mine) return flash('Fortify between your own territories.');
      if (ui.sel === t) { ui.sel = ui.target = null; return paint(); }
      if (ui.sel !== null && reachable(view, ui.sel).has(t)) {
        ui.target = t;
        ui.moveN = view.armies[ui.sel] - 1;
        return paint();
      }
      if (canFortifyFrom(view, me, t)) {
        ui.sel = t;
        ui.target = null;
        return paint();
      }
      flash(ui.sel !== null ? `${TERRS[t].name} is not connected to ${TERRS[ui.sel].name} through your territories.`
        : view.armies[t] < 2 ? `${TERRS[t].name} needs at least 2 armies to move troops.` : `${TERRS[t].name} has no friendly neighbours.`);
    }
  }

  let flashTimer = null;
  function flash(msg) {
    const node = panel.querySelector('.cq-flash');
    if (!node) return;
    node.textContent = msg;
    node.hidden = false;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { node.hidden = true; }, 2600);
  }

  // ---------- Drawing ----------
  function highlights(view) {
    const out = { dim: new Set(), targets: new Set(), sel: null, attack: null, move: null };
    const me = view.me;
    const dimUnless = keep => TERRS.forEach(t => { if (!keep(t.i)) out.dim.add(t.i); });
    if (ui.contFocus !== null) { dimUnless(t => TERRS[t].cont === ui.contFocus); return out; }
    if (view.over) return out;
    if (toPlace(view)) dimUnless(t => view.owner[t] === me);
    else if (view.cur !== me) {
      const r = view.lastRoll;
      if (view.phase === 'attack' && r) { out.sel = r.from; out.attack = r.to; }
    } else if (view.phase === 'attack') {
      if (view.pending) {
        out.sel = view.pending.from;
        out.move = view.pending.to;
        dimUnless(t => t === view.pending.from || t === view.pending.to);
      } else if (ui.sel !== null) {
        out.sel = ui.sel;
        TERRS[ui.sel].adj.forEach(o => { if (view.owner[o] !== me) out.targets.add(o); });
        out.attack = ui.target;
        dimUnless(t => t === ui.sel || out.targets.has(t));
      } else dimUnless(t => canAttackFrom(view, me, t));
    } else if (view.phase === 'fortify') {
      if (ui.sel !== null) {
        out.sel = ui.sel;
        const reach = reachable(view, ui.sel);
        reach.delete(ui.sel);
        reach.forEach(t => out.targets.add(t));
        out.move = ui.target;
        dimUnless(t => t === ui.sel || reach.has(t));
      } else dimUnless(t => canFortifyFrom(view, me, t));
    }
    return out;
  }

  function paintMap(view) {
    const h = highlights(view);
    const shown = new Map(ui.place);
    if (view.phase === 'setup' && view.deployed) for (const [t, n] of view.deployed) shown.set(t, n);
    TERRS.forEach(t => {
      const o = view.owner[t.i];
      const col = colorOf(view, o);
      fillNodes[t.i].setAttribute('fill', col.land);
      terrNodes[t.i].classList.toggle('dim', h.dim.has(t.i));
      const extra = shown.get(t.i) ?? 0;
      terrNodes[t.i].setAttribute('aria-label', `${t.name}, ${pidName(view, o)}, ${armies(view.armies[t.i])}${extra ? `, placing ${extra} more` : ''}`);
      let cls = 'cq-outline';
      if (h.sel === t.i) cls += ' sel';
      else if (h.attack === t.i) cls += ' attack';
      else if (h.move === t.i) cls += ' move';
      else if (h.targets.has(t.i)) cls += ' target';
      if (outlineNodes[t.i].classList.contains('focus')) cls += ' focus';
      outlineNodes[t.i].setAttribute('class', cls);
      const b = badgeNodes[t.i];
      b.querySelector('circle').setAttribute('fill', col.main);
      b.querySelector('.num').textContent = view.armies[t.i];
      b.querySelector('.add').textContent = extra ? `+${extra}` : '';
      b.classList.toggle('dim', h.dim.has(t.i));
    });
  }

  function btn(act, label, { primary = false, danger = false, disabled = false, data = '' } = {}) {
    return `<button type="button" class="${primary ? 'primary' : danger ? 'danger' : ''}" data-act="${act}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`;
  }
  const seg = (act, values, current, label, isDisabled = () => false) =>
    `<div class="cq-seg" role="group" aria-label="${label}">${values.map(([v, text]) =>
      `<button type="button" data-act="${act}" data-v="${v}" aria-pressed="${current === v}" ${isDisabled(v) ? 'disabled' : ''}>${text}</button>`).join('')}</div>`;
  const stepper = (min, max) => `<div class="cq-stepper"><button type="button" data-act="n-min" aria-label="Minimum">«</button>
    <button type="button" data-act="n-dec" aria-label="One fewer">−</button><output aria-live="polite">${ui.moveN}</output>
    <button type="button" data-act="n-inc" aria-label="One more">+</button><button type="button" data-act="n-max" aria-label="Maximum">»</button>
    <small>${min}–${max}</small></div>`;

  function diceHTML(view) {
    const r = view.lastRoll;
    if (!r) return '';
    const n = Math.min(r.a.length, r.d.length);
    const a = r.a.map((v, i) => `<span class="cq-die att${i < n && v <= r.d[i] ? ' lost' : ''}">${v}</span>`).join('');
    const d = r.d.map((v, i) => `<span class="cq-die def${i < n && r.a[i] > v ? ' lost' : ''}">${v}</span>`).join('');
    const who = pidName(view, r.by);
    const summary = `${r.blitz ? `${plural(r.rounds, 'round')}: ` : ''}${who === 'You' ? 'you' : esc(who)} lost ${r.lostA}, ${esc(TERRS[r.to].name)} lost ${r.lostD}.`;
    return `<div class="cq-dice" aria-label="Last roll"><div><span>Attack</span>${a}</div><div><span>Defend</span>${d}</div><p>${summary}</p></div>`;
  }

  function placeHTML(view, my) {
    const remaining = left(view);
    return `<div class="cq-row"><div><small>To place</small><strong class="cq-big">${remaining}</strong></div>
      ${seg('amount', [[1, '1'], [5, '5'], ['all', 'All']], ui.amount, 'Armies per tap')}</div>
      <div class="actions">${btn('undo', 'Undo', { disabled: !ui.placeLog.length })}${btn('random', 'Place the rest at random', { disabled: !remaining })}</div>
      ${view.phase === 'setup'
        ? btn('deploy', 'Confirm deployment', { primary: true, disabled: !my || remaining > 0 })
        : btn('reinforce', `${view.returnToAttack ? 'Back to the attack' : 'Start attacking'} →`, { primary: true, disabled: !my || remaining > 0 || mustTrade(view.hand) })}`;
  }

  function actionsHTML(view, my) {
    const me = view.me;
    if (view.over) {
      const order = view.players.map((_, k) => k).sort((a, b) =>
        (view.players[b].alive - view.players[a].alive) || view.players[b].terr - view.players[a].terr || view.players[b].armies - view.players[a].armies || a - b);
      return `<section class="cq-box"><h3>${esc(pidName(view, view.over.winner))} ${view.seats[view.over.winner] === seat ? 'win' : 'wins'}!</h3>
        <p>${view.over.reason === 'world' ? `Every territory fell in ${view.turnNo} turns.` : `Time’s up after ${view.rounds} rounds. Most territory wins, then most armies.`}</p>
        <ol class="cq-standings">${order.map(k => `<li><i style="background:${colorOf(view, k).main}"></i><b>${esc(pidName(view, k))}</b><span>${view.players[k].alive ? `${view.players[k].terr} territories · ${armies(view.players[k].armies)}` : 'Eliminated'}</span></li>`).join('')}</ol></section>`;
    }
    if (view.phase === 'setup') {
      const waiting = view.players.filter(p => !p.ready).length;
      if (view.deployed) return `<p class="cq-instruction">Deployment locked in. Waiting for ${plural(waiting, 'player')} to place their armies. Everyone’s armies appear together.</p>`;
      return `<p class="cq-instruction">Territories are dealt. Tap your territories to place your <strong>${view.pool}</strong> starting armies, then confirm. Nobody sees your placement until everyone has deployed.</p>${placeHTML(view, my)}`;
    }
    if (view.cur !== me) {
      const doing = { reinforce: 'is reinforcing', attack: 'is attacking', fortify: 'is fortifying' }[view.phase];
      return `<p class="cq-instruction"><b style="color:${colorOf(view, view.cur).main}">${esc(pidName(view, view.cur))}</b> ${doing}.${me < 0 || !view.players[me]?.alive ? '' : ' Tap a territory to see who holds it.'}</p>${view.phase === 'attack' ? diceHTML(view) : ''}`;
    }
    if (view.phase === 'reinforce') {
      const set = bestSet(view.owner, me, view.hand);
      const must = mustTrade(view.hand);
      const remaining = left(view);
      const text = must ? `You hold ${view.hand.length} cards: trade a set before placing armies.`
        : remaining ? `Tap your territories to place <strong>${armies(remaining)}</strong>.`
          : view.returnToAttack ? 'Armies placed. Return to the attack when ready.' : 'All armies placed. Ready to attack.';
      return `<p class="cq-instruction">${text}</p>${must ? '<p class="cq-warn">Five or more cards in hand means you must trade.</p>' : ''}
        ${set ? btn('trade', `Trade a set for +${tradeValue(view.trades)} armies`, { primary: must, disabled: !my }) : ''}${placeHTML(view, my)}`;
    }
    if (view.phase === 'attack') {
      const endButtons = `<div class="actions">${btn('end-attack', 'Fortify →', { disabled: !my })}${btn('end-turn', 'End turn', { disabled: !my })}</div>`;
      if (view.pending) {
        const { from, to, min, max } = view.pending;
        ui.moveN = clamp(ui.moveN, min, max);
        return `<p class="cq-instruction"><strong>${esc(TERRS[to].name)}</strong> is yours! Move armies in from ${esc(TERRS[from].name)}.</p>${diceHTML(view)}${stepper(min, max)}
          ${btn('occupy', `Move ${armies(ui.moveN)}`, { primary: true, disabled: !my })}`;
      }
      if (ui.sel !== null && ui.target !== null) {
        const from = ui.sel;
        const to = ui.target;
        const maxDice = Math.min(3, view.armies[from] - 1);
        ui.dice = clamp(ui.dice, 1, maxDice);
        const sameFight = view.lastRoll && view.lastRoll.from === from && view.lastRoll.to === to;
        return `<p class="cq-instruction">Attack <strong>${esc(TERRS[to].name)}</strong> from ${esc(TERRS[from].name)}.</p>
          <div class="cq-matchup"><div style="--pc:${colorOf(view, me).main}"><span>${esc(TERRS[from].name)}</span><b>${view.armies[from]}</b></div><em>VS</em>
          <div style="--pc:${colorOf(view, view.owner[to]).main}"><span>${esc(TERRS[to].name)}</span><b>${view.armies[to]}</b></div></div>
          <div class="cq-row"><small>Dice</small>${seg('dice', [[1, '1'], [2, '2'], [3, '3']], ui.dice, 'Attack dice', v => v > maxDice)}</div>
          <div class="actions">${btn('roll', 'Roll', { danger: true, disabled: !my })}${btn('blitz', 'Blitz', { disabled: !my })}${btn('cancel', 'Change target')}</div>
          ${sameFight ? diceHTML(view) : ''}${endButtons}`;
      }
      const text = ui.sel !== null
        ? `Attacking from <strong>${esc(TERRS[ui.sel].name)}</strong> (${view.armies[ui.sel]}). Tap a highlighted enemy territory.`
        : 'Tap one of your territories with 2 or more armies to attack from, or move on.';
      return `<p class="cq-instruction">${text}</p>${diceHTML(view)}${ui.sel !== null ? `<div class="actions">${btn('cancel', 'Cancel')}</div>` : ''}${endButtons}`;
    }
    // Fortify
    const card = view.conquered ? '<p class="cq-small">You conquered a territory this turn, so you earn a card when it ends.</p>' : '';
    if (ui.sel !== null && ui.target !== null) {
      const max = view.armies[ui.sel] - 1;
      ui.moveN = clamp(ui.moveN, 1, max);
      return `<p class="cq-instruction">Move armies from <strong>${esc(TERRS[ui.sel].name)}</strong> to <strong>${esc(TERRS[ui.target].name)}</strong>.</p>${stepper(1, max)}
        <div class="actions">${btn('cancel', 'Back')}${btn('fortify', 'Move and end turn', { primary: true, disabled: !my })}</div>${card}`;
    }
    const text = ui.sel !== null ? `Moving from <strong>${esc(TERRS[ui.sel].name)}</strong>. Tap a highlighted territory you own.`
      : 'Optionally make one move between connected territories, then end your turn.';
    return `<p class="cq-instruction">${text}</p><div class="actions">${ui.sel !== null ? btn('cancel', 'Cancel') : ''}${btn('end-turn', 'End turn', { primary: true, disabled: !my })}</div>${card}`;
  }

  function headHTML(view) {
    if (view.phase === 'setup') return `<div class="cq-steps"><span class="on wide">Deploy starting armies</span></div>`;
    if (view.over) return `<div class="cq-steps"><span class="on wide">Game over</span></div>`;
    const idx = { reinforce: 0, attack: 1, fortify: 2 }[view.phase];
    const c = colorOf(view, view.cur).main;
    return `<div class="cq-steps" style="--pc:${c}">${['Reinforce', 'Attack', 'Fortify'].map((s, i) => `<span class="${i === idx ? 'on' : i < idx ? 'done' : ''}">${s}</span>`).join('')}</div>
      <p class="cq-round">Round ${Math.min(view.round, view.rounds)} of ${view.rounds} · <b style="color:${c}">${esc(pidName(view, view.cur))}</b>${view.cur === view.me ? '' : '’s turn'}</p>`;
  }

  function handHTML(view) {
    if (view.phase === 'setup' || view.me < 0) return '';
    const next = `Next set +${tradeValue(view.trades)}`;
    const cards = view.hand.length ? `<div class="cq-cards">${view.hand.map(id => {
      const sym = SYMBOLS[cardSymbol(id)];
      const owned = id < NT && view.owner[id] === view.me;
      return `<div class="cq-card${owned ? ' owned' : ''}" title="${sym.name}${id < NT ? ` · ${esc(TERRS[id].name)}` : ''}"><small>${sym.name}</small><span aria-hidden="true">${sym.glyph}</span><em>${id < NT ? esc(TERRS[id].label) : 'Any'}</em></div>`;
    }).join('')}</div>` : '<p class="cq-small">No cards yet. Conquer a territory during your turn to earn one.</p>';
    return `<section class="cq-hand"><div class="cq-row"><small>Your cards (${view.hand.length}) · hidden from others</small><small>${next}</small></div>${cards}</section>`;
  }

  function playersHTML(view) {
    return `<div class="cq-plist">${view.players.map((p, k) => {
      const reinf = p.alive && view.phase !== 'setup' ? reinforcementsFor(view, k).total : 0;
      const sub = !p.alive ? 'Eliminated' : view.phase === 'setup' ? (p.ready ? 'Deployed' : 'Placing armies')
        : `${p.terr} territories · ${armies(p.armies)} · ${plural(p.cards, 'card')} · +${reinf}/turn`;
      return `<div class="cq-pl${k === view.cur && view.phase !== 'setup' && !view.over ? ' cur' : ''}${p.alive ? '' : ' out'}" style="--pc:${colorOf(view, k).main}">
        <i></i><span><b>${esc(pidName(view, k))}</b><small>${esc(sub)}</small></span></div>`;
    }).join('')}</div>`;
  }

  function regionsHTML(view) {
    return `<details class="cq-drawer"${matchMedia('(min-width: 900px)').matches ? ' open' : ''}><summary>Regions</summary><div class="cq-conts">${CONTINENTS.map((c, ci) => {
      const h = contHolder(view, ci);
      return `<button type="button" class="cq-cont" data-act="cont" data-v="${ci}" aria-pressed="${ui.contFocus === ci}" style="--cc:${c.color};--hc:${h >= 0 ? colorOf(view, h).main : 'transparent'}">
        <i class="cq-dot"></i><span>${c.name}</span><b>+${c.bonus}</b><i class="holder${h >= 0 ? ' held' : ''}" title="${h >= 0 ? `Held by ${esc(pidName(view, h))}` : 'Not held'}"></i></button>`;
    }).join('')}</div></details>`;
  }

  function paint() {
    if (!last?.view) return;
    const { view, active } = last;
    const my = active && view.turn === seat;
    paintMap(view);
    const scroll = panel.scrollTop;
    const focused = panel.contains(document.activeElement) ? document.activeElement.dataset.act : null;
    const regionsOpen = panel.querySelector('.cq-drawer')?.open;
    panel.innerHTML = `${headHTML(view)}<p class="cq-flash" role="status" hidden></p>${actionsHTML(view, my)}${handHTML(view)}${playersHTML(view)}${regionsHTML(view)}
      <details class="cq-drawer cq-log-wrap"><summary>Battle log</summary><ol class="cq-log">${view.log.toReversed().map(entry =>
        `<li style="--lc:${entry.pid >= 0 ? colorOf(view, entry.pid).main : 'var(--border)'}">${logText(view, entry.text)}</li>`).join('')}</ol></details>`;
    if (regionsOpen !== undefined) panel.querySelector('.cq-drawer').open = regionsOpen;
    panel.scrollTop = scroll;
    if (focused) panel.querySelector(`[data-act="${focused}"]:not([disabled])`)?.focus({ preventScroll: true });
  }

  // Clears local choices whenever the game moves to a new step.
  function sync(view) {
    const key = `${view.phase}:${view.cur}:${view.turnNo}:${view.trades}:${view.deployed ? 1 : 0}:${view.returnToAttack}`;
    if (key !== ui.key) {
      ui.key = key;
      ui.place.clear();
      ui.placeLog = [];
      ui.sel = ui.target = null;
    }
    const r = view.lastRoll;
    const rollKey = r ? `${view.turnNo}:${r.from}:${r.to}:${r.a}:${r.d}:${view.armies[r.from]}` : '';
    if (rollKey !== ui.rollKey) {
      ui.rollKey = rollKey;
      if (r && view.cur === view.me) {
        if (view.owner[r.to] === view.me) {
          // After a conquest, carry on from the newly taken territory if it can attack.
          ui.moveN = view.pending ? view.pending.max : 1;
          ui.sel = canAttackFrom(view, view.me, r.to) ? r.to : canAttackFrom(view, view.me, r.from) ? r.from : null;
          ui.target = null;
        } else if (view.armies[r.from] < 2) ui.sel = ui.target = null;
      }
    }
    if (view.pending && view.cur === view.me) ui.sel = ui.target = null;
    if (ui.sel !== null && view.owner[ui.sel] !== view.me) ui.sel = ui.target = null;
    if (ui.target !== null && view.owner[ui.target] === view.me && view.phase === 'attack') ui.target = null;
  }

  function randomFill(view) {
    const mine = TERRS.filter(t => view.owner[t.i] === view.me).map(t => t.i);
    let n = left(view);
    while (n-- > 0) {
      const t = mine[Math.floor(Math.random() * mine.length)];
      ui.place.set(t, (ui.place.get(t) ?? 0) + 1);
      ui.placeLog.push([t, 1]);
    }
  }

  panel.addEventListener('click', event => {
    const b = event.target.closest('[data-act]');
    if (!b || b.disabled || !last) return;
    const { view } = last;
    const v = b.dataset.v;
    const placement = () => Object.fromEntries(ui.place);
    switch (b.dataset.act) {
      case 'amount': ui.amount = v === 'all' ? 'all' : Number(v); break;
      case 'undo': {
        const [t, n] = ui.placeLog.pop() ?? [];
        if (t === undefined) break;
        const rest = ui.place.get(t) - n;
        if (rest > 0) ui.place.set(t, rest); else ui.place.delete(t);
        break;
      }
      case 'random': randomFill(view); break;
      case 'deploy': submit({ action: 'deploy', place: placement() }); break;
      case 'reinforce': submit({ action: 'reinforce', place: placement() }); break;
      case 'trade': {
        const set = bestSet(view.owner, view.me, view.hand);
        if (set) submit({ action: 'trade', cards: set });
        break;
      }
      case 'dice': ui.dice = Number(v); break;
      case 'roll': submit({ action: 'attack', from: ui.sel, to: ui.target, dice: ui.dice, blitz: false }); break;
      case 'blitz': submit({ action: 'attack', from: ui.sel, to: ui.target, blitz: true }); break;
      case 'cancel':
        if (ui.target !== null) ui.target = null; else ui.sel = null;
        break;
      case 'occupy': submit({ action: 'move', n: ui.moveN }); break;
      case 'end-attack': submit({ action: 'endAttack' }); break;
      case 'end-turn': submit({ action: 'endTurn' }); break;
      case 'fortify': submit({ action: 'fortify', from: ui.sel, to: ui.target, n: ui.moveN }); break;
      case 'n-min': ui.moveN = view.pending ? view.pending.min : 1; break;
      case 'n-dec': ui.moveN--; break;
      case 'n-inc': ui.moveN++; break;
      case 'n-max': ui.moveN = 1e9; break;
      case 'cont': ui.contFocus = ui.contFocus === Number(v) ? null : Number(v); break;
      default: return;
    }
    paint();
  });

  return (view, _canMove, _preview, active) => {
    if (!last) requestAnimationFrame(fitMap);
    last = { view, active };
    if (!view) return;
    sync(view);
    paint();
  };
}
