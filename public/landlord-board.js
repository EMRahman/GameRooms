import {
  GROUPS, SP, BAIL, SALARY, STATION_RENT, UTIL_MULT, RR, UT, DECK_NAMES,
  money, owned, ownsGroup, rentFor, maxRaise, buildReason, sellReason, mortReason, unmortCost, tradeable, canManage, isProp,
} from './landlord-rules.js';

// Seat colours match the player cards in style.css.
const SEAT_COLORS = ['#ff947d', '#68dfcf', '#ffcc77', '#9cd4ff', '#ddb9ff', '#a8e07a'];
const TOKENS = ['★', '♞', '♜', '♠', '♛', '◆'].map(t => t + '︎');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const range = n => Array.from({ length: n }, (_, i) => i);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const swatch = i => SP[i].t === 'st' ? GROUPS[SP[i].g].c : SP[i].t === 'rr' ? '#2a2f2b' : '#58706a';

function gridPos(i) {
  if (i <= 10) return { r: 11, c: 11 - i, side: i === 0 || i === 10 ? 'corner' : 'b' };
  if (i <= 20) return { r: 11 - (i - 10), c: 1, side: i === 20 ? 'corner' : 'l' };
  if (i <= 30) return { r: 1, c: 1 + (i - 20), side: i === 30 ? 'corner' : 't' };
  return { r: 1 + (i - 30), c: 11, side: 'r' };
}

function dieHTML(v) {
  const pips = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[v] || [];
  return range(9).map(k => `<i class="${pips.includes(k + 1) ? 'on' : ''}"></i>`).join('');
}

export function drawLandlord(container, seat, submit, nameOf) {
  let last = null;
  let focus = -1;        // space whose deed is open
  let listPid = null;    // player whose property list is open
  let draft = null;      // trade being written
  let lastRolled = -1;

  const board = document.createElement('div');
  board.className = 'll-board';
  board.setAttribute('role', 'group');
  board.setAttribute('aria-label', 'Landlord board');
  const center = document.createElement('div');
  center.className = 'll-center';
  center.innerHTML = '<div class="ll-logo" aria-hidden="true">Landlord</div><div class="ll-dice" aria-label="Dice"></div><div class="ll-card" hidden></div><p class="ll-msg" aria-live="polite"></p><p class="ll-round"></p>';
  board.append(center);
  const cells = SP.map((sp, i) => {
    const pos = gridPos(i);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `ll-sp ${pos.side === 'corner' ? 'corner side-b' : 'side-' + pos.side}`;
    el.style.gridRow = pos.r;
    el.style.gridColumn = pos.c;
    el.dataset.space = i;
    let inner = sp.t === 'st' ? `<span class="strip" style="--gc:${GROUPS[sp.g].c}"></span>` : '';
    inner += '<span class="lbl">';
    if (sp.ic) inner += `<span class="ic" aria-hidden="true">${sp.ic}</span>`;
    inner += `<span class="nm">${esc(pos.side === 'l' || pos.side === 'r' ? sp.n : sp.sn)}</span>`;
    if (sp.p || sp.amt) inner += `<span class="pr">${money(sp.p || sp.amt)}</span>`;
    el.innerHTML = inner + '</span><span class="tk"></span>';
    board.append(el);
    return el;
  });
  const panel = document.createElement('div');
  panel.className = 'll-panel';
  container.setAttribute('aria-label', 'Landlord');
  container.replaceChildren(board, panel);

  // The board scales its type and tokens from its own width.
  const resize = new ResizeObserver(() => {
    const width = board.clientWidth;
    board.style.setProperty('--b', `${width}px`);
    board.classList.toggle('compact', width < 620);
  });
  resize.observe(board);

  const pidName = (view, pid) => pid < 0 ? 'the bank' : view.seats[pid] === seat ? 'You' : nameOf(view.seats[pid]);
  const token = (view, pid, extra = '') => `<span class="ll-piece${extra}" style="--pc:${SEAT_COLORS[view.seats[pid]]}" aria-hidden="true">${TOKENS[view.seats[pid]]}</span>`;
  const logText = (view, text) => esc(text.replace(/@(\d)/g, (_, pid) => pidName(view, Number(pid))));

  function paintBoard(view) {
    SP.forEach((sp, i) => {
      const el = cells[i];
      const pr = view.props[i];
      let label = sp.n;
      el.classList.toggle('focus', focus === i || (focus < 0 && view.focus === i));
      if (pr) {
        el.classList.toggle('owned', pr.o >= 0);
        el.style.setProperty('--oc', pr.o >= 0 ? SEAT_COLORS[view.seats[pr.o]] : 'transparent');
        el.classList.toggle('mort', pr.m);
        const strip = el.querySelector('.strip');
        if (strip) strip.innerHTML = pr.h === 5 ? '<i class="ht"></i>' : '<i class="hs"></i>'.repeat(pr.h);
        label += pr.o >= 0 ? `, owned by ${pidName(view, pr.o)}` : `, for sale at ${money(sp.p)}`;
        if (pr.h === 5) label += ', hotel'; else if (pr.h) label += `, ${plural(pr.h, 'house')}`;
        if (pr.m) label += ', mortgaged';
      }
      const here = range(view.players.length).filter(k => !view.players[k].out && view.players[k].pos === i);
      el.querySelector('.tk').innerHTML = here.map(k => token(view, k,
        `${view.players[k].jail ? ' jailed' : ''}${k === view.cur && !view.over ? ' active' : ''}`)).join('');
      if (here.length) label += `. Here: ${here.map(k => pidName(view, k) + (view.players[k].jail ? ' (in Lockup)' : '')).join(', ')}`;
      el.setAttribute('aria-label', label);
    });
    const key = `${view.rolled}:${view.cur}`;
    center.querySelector('.ll-dice').innerHTML = view.dice.map(v =>
      `<div class="ll-die${view.rolled && key !== lastRolled ? ' roll' : ''}" role="img" aria-label="${v}">${dieHTML(v)}</div>`).join('');
    lastRolled = key;
    const card = center.querySelector('.ll-card');
    card.hidden = !view.card;
    if (view.card) {
      card.className = `ll-card ${view.card.kind}`;
      card.innerHTML = `<b>${DECK_NAMES[view.card.kind]}</b>${esc(view.card.txt)}`;
    }
    const lastLog = view.log.at(-1);
    center.querySelector('.ll-msg').innerHTML = view.card || !lastLog ? '' : logText(view, lastLog.text);
    center.querySelector('.ll-round').textContent = `Round ${Math.min(view.round, view.rounds)} of ${view.rounds}`;
  }

  // ---------- Panel sections ----------
  function nowHTML(view) {
    const p = view.players[view.cur];
    const status = p.out ? 'Bankrupt' : p.jail ? `In Lockup · try ${p.jailTurns + 1} of 3` : p.pos === 10 ? 'Just visiting Lockup' : `On ${SP[p.pos].n}`;
    return `<section class="ll-now">${token(view, view.cur, ' big')}<div><b>${esc(pidName(view, view.cur))}</b><small>${esc(status)}</small></div><span class="ll-cash">${money(p.cash)}</span></section>`;
  }

  function btn(act, label, { primary = false, danger = false, disabled = false, data = '' } = {}) {
    return `<button type="button" class="${primary ? 'primary' : danger ? 'danger' : ''}" data-act="${act}" ${data} ${disabled ? 'disabled' : ''}>${label}</button>`;
  }

  function actionsHTML(view, my) {
    const me = view.me;
    const p = view.players[view.cur];
    if (view.over) {
      const ranks = range(view.players.length).sort((a, b) => (view.players[a].out - view.players[b].out) || view.players[b].worth - view.players[a].worth);
      return `<section class="ll-box"><h3>${esc(pidName(view, view.over.winner))} ${view.seats[view.over.winner] === seat ? 'win' : 'wins'}!</h3>
        <p>${view.over.reason === 'time' ? `Time’s up after ${view.rounds} rounds. Final net worth:` : 'Every rival has gone bankrupt.'}</p>
        <ol class="ll-standings">${ranks.map(k => `<li>${token(view, k)}<b>${esc(pidName(view, k))}</b><span>${view.players[k].out ? 'Bankrupt' : money(view.players[k].worth)}</span></li>`).join('')}</ol></section>`;
    }
    if (view.trade) return offerHTML(view, my);
    if (view.auction) return auctionHTML(view, my);
    if (view.cur !== me) return `<p class="ll-instruction">${esc(pidName(view, view.cur))} is playing. Tap any space to see its deed.</p>`;
    let instr = '';
    let html = '';
    if (view.phase === 'pre' && p.jail) {
      instr = `You’re in Lockup. Pay ${money(BAIL)}, use a Bail Pass, or try to roll doubles.`;
      html = btn('roll', 'Roll for doubles', { primary: true, disabled: !my }) + btn('bail', `Pay ${money(BAIL)}`, { disabled: !my || p.cash < BAIL }) +
        (p.cards ? btn('card', 'Use Bail Pass', { disabled: !my }) : '');
    } else if (view.phase === 'pre') {
      instr = 'Your turn. Roll the dice. You can build, mortgage or trade first.';
      html = btn('roll', 'Roll dice', { primary: true, disabled: !my });
    } else if (view.phase === 'buy') {
      const sp = SP[view.offer];
      instr = `<strong>${esc(sp.n)}</strong> is for sale. Buy it, or put it up for auction.${p.cash < sp.p ? ' You need more cash to buy it. Mortgage something first, or auction it.' : ''}`;
      html = btn('buy', `Buy for ${money(sp.p)}`, { primary: true, disabled: !my || p.cash < sp.p }) + btn('auction', 'Auction', { disabled: !my });
    } else if (view.phase === 'debt') {
      const d = view.debt;
      const most = maxRaise(view, me);
      instr = `You owe <strong>${money(d.amt)}</strong> to ${esc(pidName(view, d.to))} and have ${money(p.cash)}. Sell buildings or mortgage property (tap a space) to raise cash. You could raise up to ${money(most)}.`;
      html = btn('pay', `Pay ${money(d.amt)}`, { primary: true, disabled: !my || p.cash < d.amt }) +
        btn('raise', 'Raise cash for me', { disabled: !my || most < d.amt || p.cash >= d.amt }) + btn('bankrupt', 'Declare bankruptcy', { danger: true, disabled: !my });
    } else if (view.phase === 'post') {
      instr = view.again ? 'Doubles! Roll again.' : 'Build, trade or mortgage now, or end your turn.';
      html = view.again ? btn('roll', 'Roll again', { primary: true, disabled: !my }) : btn('end', 'End turn', { primary: true, disabled: !my });
    }
    if (['pre', 'post'].includes(view.phase) && !draft) html += btn('trade', 'Propose a trade', { disabled: !my || view.offers >= 5 });
    return `<p class="ll-instruction">${instr}</p><div class="actions">${html}</div>`;
  }

  function sideList(view, props, cash) {
    const items = props.map(i => `<li>${esc(SP[i].n)}${view.props[i].m ? ' (mortgaged)' : ''}</li>`);
    if (cash > 0) items.push(`<li>${money(cash)}</li>`);
    return items.length ? `<ul>${items.join('')}</ul>` : '<p>Nothing</p>';
  }

  function offerHTML(view, active) {
    const t = view.trade;
    const mine = view.me === t.to;
    let controls = `<p class="ll-instruction">Waiting for ${esc(pidName(view, t.to))} to answer.</p>`;
    if (mine) controls = `<div class="actions">${btn('accept', 'Accept', { primary: true, disabled: !active })}${btn('decline', 'Decline', { disabled: !active })}</div>`;
    else if (view.me === t.from) controls += `<div class="actions">${btn('withdraw', 'Withdraw offer', { disabled: !active })}</div>`;
    return `<section class="ll-box"><h3>Trade offer</h3><p>${esc(pidName(view, t.from))} ${mine ? 'offers you' : `offer${view.me === t.from ? '' : 's'} ${esc(pidName(view, t.to))}`} a trade.</p>
      <div class="ll-offer"><div><h4>${esc(pidName(view, t.to))} ${mine ? 'get' : 'gets'}</h4>${sideList(view, t.give, t.cg)}</div>
      <div><h4>${esc(pidName(view, t.from))} ${view.me === t.from ? 'get' : 'gets'}</h4>${sideList(view, t.get, t.ct)}</div></div>${controls}</section>`;
  }

  function auctionHTML(view, active) {
    const a = view.auction;
    const sp = SP[a.i];
    const q = a.order[a.at];
    const lead = a.lead >= 0 ? `${esc(pidName(view, a.lead))} ${view.seats[a.lead] === seat ? 'lead' : 'leads'}` : 'No bids yet';
    let controls = `<p class="ll-instruction">${esc(pidName(view, q))} is deciding…</p>`;
    if (q === view.me) {
      const cash = view.players[q].cash;
      controls = `<div class="ll-bids">${[1, 10, 50, 100].map(n => {
        const v = a.bid + n;
        return `<button type="button" data-act="bid" data-v="${v}" ${!active || v > cash ? 'disabled' : ''}>+${n}<small>${money(v)}</small></button>`;
      }).join('')}</div><div class="actions">${btn('pass', 'Drop out', { disabled: !active })}</div>`;
    }
    return `<section class="ll-box"><h3>Auction: ${esc(sp.n)}</h3><p>Listed at ${money(sp.p)}${sp.t === 'st' ? ` · ${GROUPS[sp.g].name} group` : ''}</p>
      <div class="ll-bid-now"><strong>${money(a.bid)}</strong><span>${lead}</span></div>
      <p>${q === view.me ? `Your bid · ${money(view.players[q].cash)} cash` : `${esc(pidName(view, q))} to bid`}</p>${controls}
      <p class="ll-small">Still in: ${a.order.filter(k => !a.passed.includes(k)).map(k => esc(pidName(view, k))).join(', ')}</p></section>`;
  }

  function deedHTML(view, i, my) {
    const sp = SP[i];
    const pr = view.props[i];
    const close = btn('close-deed', 'Close');
    if (!pr) {
      const desc = {
        go: `Collect ${money(SALARY)} every time you pass or land here.`,
        fund: 'Draw a Civic Fund card.',
        fortune: 'Draw a Fortune card.',
        tax: `Pay ${money(sp.amt || 0)} to the bank.`,
        jail: `Just visiting, unless you were sent here. Anyone held here pays ${money(BAIL)}, uses a Bail Pass, or rolls doubles to leave.`,
        free: 'A quiet park. Nothing happens here.',
        gojail: 'You are sent straight to Lockup, without passing Payday.',
      }[sp.t];
      return `<section class="ll-deed"><div class="head"><small>Space ${i}</small><strong>${esc(sp.n)}</strong></div><div class="body"><p>${esc(desc)}</p></div></section><div class="actions">${close}</div>`;
    }
    const g = sp.t === 'st' ? GROUPS[sp.g] : null;
    const head = g ? `style="--gc:${g.c};--gt:${g.t}"` : `style="--gc:${swatch(i)}"`;
    const ownCount = list => list.filter(j => view.props[j].o === pr.o).length;
    let rows = '';
    if (g) {
      const full = pr.o >= 0 && ownsGroup(view, pr.o, sp.g);
      const lvl = pr.h > 0 ? pr.h : full ? -1 : 0;
      rows += `<tr class="${pr.o >= 0 && lvl === 0 ? 'now' : ''}"><td>Rent</td><td>${money(sp.r[0])}</td></tr>`;
      rows += `<tr class="${pr.o >= 0 && lvl === -1 ? 'now' : ''}"><td>With the full colour group</td><td>${money(sp.r[0] * 2)}</td></tr>`;
      for (let h = 1; h <= 5; h++) rows += `<tr class="${pr.h === h ? 'now' : ''}"><td>${h === 5 ? 'With a hotel' : `With ${plural(h, 'house')}`}</td><td>${money(sp.r[h])}</td></tr>`;
      rows += `<tr><td>Each house or hotel costs</td><td>${money(g.cost)}</td></tr>`;
    } else if (sp.t === 'rr') {
      const n = pr.o >= 0 ? ownCount(RR) : 0;
      STATION_RENT.slice(1).forEach((v, k) => { rows += `<tr class="${n === k + 1 ? 'now' : ''}"><td>${plural(k + 1, 'station')} owned</td><td>${money(v)}</td></tr>`; });
    } else {
      const n = pr.o >= 0 ? ownCount(UT) : 0;
      rows += `<tr class="${n === 1 ? 'now' : ''}"><td>One utility owned</td><td>${UTIL_MULT[1]}× dice</td></tr><tr class="${n === 2 ? 'now' : ''}"><td>Both utilities owned</td><td>${UTIL_MULT[2]}× dice</td></tr>`;
    }
    rows += `<tr><td>Mortgage value</td><td>${money(sp.p / 2)}</td></tr>`;
    const owner = pr.o >= 0
      ? `Owned by ${esc(pidName(view, pr.o))}${pr.m ? ' · mortgaged' : ''}${pr.h === 5 ? ' · hotel' : pr.h ? ` · ${plural(pr.h, 'house')}` : ''}`
      : `For sale · ${money(sp.p)}`;
    let acts = '';
    const me = view.me;
    if (pr.o === me && view.cur === me && canManage(view)) {
      const data = `data-i="${i}"`;
      if (g) {
        const why = buildReason(view, me, i);
        if (why && pr.h < 5) acts += `<p class="ll-small">${esc(why)}</p>`;
        acts += btn('build', `Build ${pr.h === 4 ? 'hotel' : 'house'} −${money(g.cost)}`, { primary: true, disabled: !my || Boolean(why), data });
        if (pr.h > 0) acts += btn('sell', `Sell ${pr.h === 5 ? 'hotel' : 'house'} +${money(Math.floor(g.cost / 2))}`, { disabled: !my || Boolean(sellReason(view, me, i)), data });
      }
      acts += pr.m
        ? btn('unmortgage', `Unmortgage −${money(unmortCost(i))}`, { disabled: !my || view.players[me].cash < unmortCost(i), data })
        : btn('mortgage', `Mortgage +${money(sp.p / 2)}`, { disabled: !my || Boolean(mortReason(view, me, i)), data });
    }
    return `<section class="ll-deed"><div class="head" ${head}><small>${g ? g.name + ' group' : sp.t === 'rr' ? 'Station' : 'Utility'} · Price ${money(sp.p)}</small><strong>${esc(sp.n)}</strong></div>
      <div class="body"><table>${rows}</table><p class="owner">${owner}</p></div></section><div class="actions">${acts}${close}</div>`;
  }

  function tradeHTML(view) {
    const me = view.me;
    const others = range(view.players.length).filter(k => k !== me && !view.players[k].out);
    if (!others.includes(draft.to)) draft.to = others[0];
    const col = (pid, side, cashKey) => {
      const items = tradeable(view, pid);
      const cash = view.players[pid].cash;
      return `<div><h4>${esc(pidName(view, pid))} ${pid === me ? 'give' : 'gives'}</h4><div class="ll-tlist">${items.length ? items.map(i =>
        `<label class="ll-titem" style="--gc:${swatch(i)}"><input type="checkbox" data-side="${side}" value="${i}" ${draft[side].has(i) ? 'checked' : ''}><i></i><span>${esc(SP[i].n)}</span><small>${view.props[i].m ? 'M · ' : ''}${money(SP[i].p)}</small></label>`).join('')
        : '<p class="ll-small">Nothing tradeable.</p>'}</div>
        <label class="ll-cash-in"><span>Cash</span><input type="number" inputmode="numeric" min="0" step="10" max="${cash}" data-cash="${cashKey}" value="${draft[cashKey] || ''}" placeholder="$0 of ${money(cash)}"></label></div>`;
    };
    return `<section class="ll-box"><h3>Propose a trade</h3><p class="ll-small">Streets in a colour group with buildings can't be traded.</p>
      <div class="ll-chips">${others.map(k => `<button type="button" class="ll-chip" data-act="trade-to" data-p="${k}" aria-pressed="${k === draft.to}">${token(view, k)}${esc(pidName(view, k))}</button>`).join('')}</div>
      <div class="ll-trade">${col(me, 'give', 'cg')}${col(draft.to, 'get', 'ct')}</div>
      <div class="actions">${btn('send-trade', 'Send offer', { primary: true })}${btn('cancel-trade', 'Cancel')}</div></section>`;
  }

  function playersHTML(view) {
    return `<h3 class="ll-title">Players</h3><div class="ll-plist">${view.players.map((q, k) => {
      const mine = owned(view, k);
      const sw = mine.map(i => `<i class="${view.props[i].m ? 'm' : ''}" style="--gc:${swatch(i)}"></i>`).join('');
      const sub = q.out ? 'Bankrupt' : `${q.jail ? 'In Lockup · ' : ''}${mine.length} owned${q.cards ? ` · ${q.cards} Bail Pass${q.cards > 1 ? 'es' : ''}` : ''}`;
      return `<button type="button" class="ll-pl player-${view.seats[k]}${k === view.cur ? ' cur' : ''}${q.out ? ' out' : ''}" data-act="list" data-p="${k}" aria-pressed="${listPid === k}">
        ${token(view, k)}<span><span class="nm">${esc(pidName(view, k))}</span><span class="sub">${esc(sub)}</span>${sw ? `<span class="sw" aria-hidden="true">${sw}</span>` : ''}</span><span class="money">${money(q.cash)}</span></button>`;
    }).join('')}</div>`;
  }

  function listHTML(view) {
    if (listPid === null) return '';
    const mine = owned(view, listPid);
    const q = view.players[listPid];
    return `<section class="ll-box"><h3>${esc(pidName(view, listPid))}: ${money(q.cash)} cash · net worth ${money(q.worth)}</h3><div class="ll-props">${mine.length ? mine.map(i => {
      const pr = view.props[i];
      const sp = SP[i];
      const st = [pr.m ? 'Mortgaged' : '', pr.h === 5 ? 'Hotel' : pr.h ? plural(pr.h, 'house') : '', sp.t === 'st' && ownsGroup(view, listPid, sp.g) ? 'Full group' : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="ll-prow" data-act="deed" data-i="${i}" style="--gc:${swatch(i)}"><i></i><span>${esc(sp.n)}<small>${esc(st || 'Rent ' + money(pr.m ? 0 : rentFor(view, i)))}</small></span><small>${money(sp.p)}</small></button>`;
    }).join('') : '<p class="ll-small">No property yet.</p>'}</div>${btn('close-list', 'Close')}</section>`;
  }

  function paint() {
    if (!last?.view) return;
    const { view, active } = last;
    const my = active && view.turn === seat;
    if (draft && (view.over || view.trade || view.auction || view.cur !== view.me || !['pre', 'post'].includes(view.phase))) draft = null;
    paintBoard(view);
    const scroll = panel.scrollTop;
    // Keep focus on the control the player just used when the panel redraws.
    const focused = document.activeElement && panel.contains(document.activeElement) ? document.activeElement.dataset.act : null;
    const shownDeed = focus >= 0 ? focus : view.phase === 'buy' && !view.trade ? view.offer : view.auction ? view.auction.i : -1;
    panel.innerHTML = nowHTML(view) + actionsHTML(view, my) + (draft ? tradeHTML(view) : '') +
      (shownDeed >= 0 && !draft ? deedHTML(view, shownDeed, my) : '') + listHTML(view) + playersHTML(view) +
      `<details class="ll-log-wrap" open><summary>Game log</summary><ol class="ll-log">${view.log.toReversed().map(entry =>
        `<li class="${entry.p >= 0 ? `player-${view.seats[entry.p]}` : ''}">${logText(view, entry.text)}</li>`).join('')}</ol></details>`;
    panel.scrollTop = scroll;
    if (focused) panel.querySelector(`[data-act="${focused}"]:not([disabled])`)?.focus({ preventScroll: true });
  }

  board.addEventListener('click', event => {
    const cell = event.target.closest('[data-space]');
    if (!cell) return;
    const i = Number(cell.dataset.space);
    focus = focus === i ? -1 : i;
    paint();
  });
  panel.addEventListener('change', event => {
    const input = event.target;
    if (!draft) return;
    if (input.dataset.side) {
      const set = draft[input.dataset.side];
      if (input.checked) set.add(Number(input.value)); else set.delete(Number(input.value));
    }
  });
  panel.addEventListener('input', event => {
    const input = event.target;
    if (draft && input.dataset.cash) draft[input.dataset.cash] = Math.max(0, Math.floor(Number(input.value) || 0));
  });
  panel.addEventListener('click', event => {
    const b = event.target.closest('[data-act]');
    if (!b || !last) return;
    const { view } = last;
    const i = Number(b.dataset.i);
    switch (b.dataset.act) {
      case 'roll': case 'bail': case 'card': case 'buy': case 'auction': case 'end': case 'pay': case 'raise': case 'pass':
        submit({ action: b.dataset.act });
        break;
      case 'bankrupt':
        if (window.confirm('Declare bankruptcy? You will leave the game.')) submit({ action: 'bankrupt' });
        break;
      case 'build': case 'sell': case 'mortgage': case 'unmortgage':
        if (isProp(i)) submit({ action: b.dataset.act, i });
        break;
      case 'bid': submit({ action: 'bid', amount: Number(b.dataset.v) }); break;
      case 'accept': submit({ action: 'respond', accept: true }); break;
      case 'decline': submit({ action: 'respond', accept: false }); break;
      case 'withdraw': submit({ action: 'cancelTrade' }); break;
      case 'trade':
        draft = { to: -1, give: new Set(), get: new Set(), cg: 0, ct: 0 };
        focus = -1;
        paint();
        break;
      case 'trade-to':
        draft.to = Number(b.dataset.p);
        draft.get = new Set();
        draft.ct = 0;
        paint();
        break;
      case 'send-trade': {
        const me = view.players[view.me];
        const them = view.players[draft.to];
        const move = { action: 'trade', to: draft.to, give: [...draft.give], get: [...draft.get], cg: draft.cg, ct: draft.ct };
        if (!move.give.length && !move.get.length) { b.textContent = 'Choose a property first'; return; }
        if (move.cg > me.cash || move.ct > them.cash) { b.textContent = 'Not enough cash'; return; }
        draft = null;
        submit(move);
        paint();
        break;
      }
      case 'cancel-trade': draft = null; paint(); break;
      case 'deed': focus = i; paint(); break;
      case 'close-deed': focus = -1; paint(); break;
      case 'list': listPid = listPid === Number(b.dataset.p) ? null : Number(b.dataset.p); paint(); break;
      case 'close-list': listPid = null; paint(); break;
      default:
    }
  });

  return (view, _canMove, _preview, active) => {
    last = { view, active };
    paint();
  };
}
