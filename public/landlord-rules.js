// Landlord rules, adapted from the single-device game in `Games`.
// The Durable Object owns the state and rolls the dice. Browsers receive landlordView(),
// which hides only the order of the card decks.
//
// Players are referred to by their index in state.players ("pid"); state.seats maps a pid
// to its room seat. Log lines refer to players as "@pid" so each browser can show names.

// ---------- Board data ----------
export const GROUPS = [
  { name: 'Slate', c: '#5d6b80', t: '#fff', cost: 60 },
  { name: 'Mint', c: '#86d9b6', t: '#0f3326', cost: 60 },
  { name: 'Violet', c: '#7b55c9', t: '#fff', cost: 90 },
  { name: 'Sand', c: '#dcc07e', t: '#2d2405', cost: 110 },
  { name: 'Teal', c: '#167f7c', t: '#fff', cost: 140 },
  { name: 'Coral', c: '#ee6f5b', t: '#fff', cost: 160 },
  { name: 'Plum', c: '#7b2d5e', t: '#fff', cost: 190 },
  { name: 'Onyx', c: '#25272b', t: '#f6d77a', cost: 210 },
];
export const SP = [
  { t: 'go', n: 'Payday', sn: 'Payday', ic: '←' },
  { t: 'st', n: 'Mill Lane', sn: 'Mill', g: 0, p: 70, r: [5, 25, 65, 160, 200, 240] },
  { t: 'fund', n: 'Civic Fund', sn: 'Fund', ic: '◈' },
  { t: 'st', n: 'Tanner Row', sn: 'Tanner', g: 0, p: 80, r: [6, 30, 80, 190, 240, 290] },
  { t: 'rr', n: 'North Station', sn: 'North', p: 200, ic: '▤' },
  { t: 'st', n: 'Harbour Street', sn: 'Harbour', g: 1, p: 100, r: [7, 35, 90, 225, 280, 335] },
  { t: 'tax', n: 'Rates Bill', sn: 'Rates', ic: '%', amt: 180 },
  { t: 'st', n: 'Ferry Road', sn: 'Ferry', g: 1, p: 100, r: [7, 35, 90, 225, 280, 335] },
  { t: 'fortune', n: 'Fortune', sn: 'Fortune', ic: '?' },
  { t: 'st', n: 'Quay Walk', sn: 'Quay', g: 1, p: 120, r: [8, 40, 105, 255, 320, 385] },
  { t: 'jail', n: 'Lockup', sn: 'Lockup', ic: '▥' },
  { t: 'st', n: 'Orchard Way', sn: 'Orchard', g: 2, p: 140, r: [10, 50, 130, 320, 400, 480] },
  { t: 'st', n: 'Rose Terrace', sn: 'Rose', g: 2, p: 150, r: [11, 55, 145, 350, 440, 530] },
  { t: 'ut', n: 'Power Works', sn: 'Power', p: 150, ic: '⚡︎' },
  { t: 'st', n: 'Lilac Avenue', sn: 'Lilac', g: 2, p: 160, r: [11, 55, 145, 350, 440, 530] },
  { t: 'fund', n: 'Civic Fund', sn: 'Fund', ic: '◈' },
  { t: 'rr', n: 'Union Depot', sn: 'Union', p: 200, ic: '▤' },
  { t: 'st', n: 'Market Square', sn: 'Market', g: 3, p: 180, r: [13, 65, 170, 415, 520, 625] },
  { t: 'st', n: 'Guild Street', sn: 'Guild', g: 3, p: 190, r: [13, 65, 170, 415, 520, 625] },
  { t: 'st', n: "Weaver's Lane", sn: 'Weaver', g: 3, p: 200, r: [14, 70, 180, 450, 560, 670] },
  { t: 'free', n: 'Town Green', sn: 'Green', ic: '♣︎' },
  { t: 'st', n: 'Theatre Row', sn: 'Theatre', g: 4, p: 220, r: [15, 75, 195, 480, 600, 720] },
  { t: 'st', n: 'Opera Place', sn: 'Opera', g: 4, p: 230, r: [16, 80, 210, 510, 640, 770] },
  { t: 'fortune', n: 'Fortune', sn: 'Fortune', ic: '?' },
  { t: 'st', n: 'Grand Arcade', sn: 'Arcade', g: 4, p: 250, r: [18, 90, 235, 575, 720, 865] },
  { t: 'fund', n: 'Civic Fund', sn: 'Fund', ic: '◈' },
  { t: 'rr', n: 'Harbour Terminal', sn: 'Terminal', p: 200, ic: '▤' },
  { t: 'st', n: 'Abbey Close', sn: 'Abbey', g: 5, p: 260, r: [18, 90, 235, 575, 720, 865] },
  { t: 'ut', n: 'Reservoir', sn: 'Water', p: 150, ic: '◍' },
  { t: 'st', n: "Bishop's Gate", sn: 'Bishop', g: 5, p: 270, r: [19, 95, 245, 610, 760, 910] },
  { t: 'gojail', n: 'Sent to Lockup', sn: 'To Lockup', ic: '⇲' },
  { t: 'st', n: 'Mint Street', sn: 'Mint', g: 5, p: 290, r: [20, 100, 260, 640, 800, 960] },
  { t: 'st', n: 'Regent Gardens', sn: 'Regent', g: 6, p: 300, r: [21, 105, 275, 670, 840, 1010] },
  { t: 'fortune', n: 'Fortune', sn: 'Fortune', ic: '?' },
  { t: 'st', n: 'Beacon Hill', sn: 'Beacon', g: 6, p: 310, r: [22, 110, 285, 705, 880, 1055] },
  { t: 'st', n: 'Parkview Crescent', sn: 'Parkview', g: 6, p: 330, r: [23, 115, 300, 735, 920, 1105] },
  { t: 'rr', n: 'Central Station', sn: 'Central', p: 200, ic: '▤' },
  { t: 'tax', n: 'Toll Road', sn: 'Toll', ic: '◆', amt: 90 },
  { t: 'st', n: 'Summit Heights', sn: 'Summit', g: 7, p: 360, r: [25, 125, 325, 800, 1000, 1200] },
  { t: 'st', n: 'Crown Point', sn: 'Crown', g: 7, p: 420, r: [29, 145, 375, 930, 1160, 1390] },
];
export const SALARY = 180;
export const BAIL = 60;
export const START_CASH = 1600;
export const STATION_RENT = [0, 30, 60, 110, 180];
export const UTIL_MULT = [0, 5, 12];
// Every game is timed: an untimed game can outlast a room's message limit.
export const ROUND_CHOICES = [15, 25, 40];
export const isProp = i => ['st', 'rr', 'ut'].includes(SP[i]?.t);
export const PROPS = SP.map((_, i) => i).filter(isProp);
export const RR = PROPS.filter(i => SP[i].t === 'rr');
export const UT = PROPS.filter(i => SP[i].t === 'ut');
export const GI = GROUPS.map((_, g) => PROPS.filter(i => SP[i].g === g && SP[i].t === 'st'));

const FORTUNE = [
  { txt: 'Payday bonus! Head straight to Payday and collect $180.', a: 'goto', to: 0 },
  { txt: 'Opening night at Opera Place. Move there, and collect $180 if you pass Payday.', a: 'goto', to: 22 },
  { txt: 'Catch the express to Central Station. Collect $180 if you pass Payday.', a: 'goto', to: 36 },
  { txt: 'Spend the afternoon at Market Square. Collect $180 if you pass Payday.', a: 'goto', to: 17 },
  { txt: 'A detour takes you to Lilac Avenue. Collect $180 if you pass Payday.', a: 'goto', to: 14 },
  { txt: 'You missed your stop. Ride on to the next station; if it is owned, pay the owner double.', a: 'nearest', kind: 'rr' },
  { txt: 'The lights are out. Walk to the next utility; if it is owned, pay the owner 12× your dice roll.', a: 'nearest', kind: 'ut' },
  { txt: 'Wrong turn! Move back two spaces.', a: 'back', n: 2 },
  { txt: 'Caught dodging a fare. Go straight to Lockup without passing Payday.', a: 'jail' },
  { txt: 'A lucky scratch card pays $60.', a: 'gain', amt: 60 },
  { txt: 'Parking ticket. Pay $20.', a: 'pay', amt: 20 },
  { txt: 'You host the street party. Pay each player $25.', a: 'payeach', amt: 25 },
  { txt: 'Your roofs need fixing: pay $30 per house and $90 per hotel.', a: 'repairs', h: 30, ho: 90 },
  { txt: 'Bail Pass. Keep this card and use it to leave Lockup for free.', a: 'jailcard' },
];
const FUND = [
  { txt: 'Your community grant is approved. Collect $120.', a: 'gain', amt: 120 },
  { txt: 'Council rates rebate. Collect $40.', a: 'gain', amt: 40 },
  { txt: 'Dentist appointment. Pay $40.', a: 'pay', amt: 40 },
  { txt: 'You win the village bake-off. Collect $30.', a: 'gain', amt: 30 },
  { txt: 'Bail Pass. Keep this card and use it to leave Lockup for free.', a: 'jailcard' },
  { txt: 'An audit finds unpaid fines. Go straight to Lockup without passing Payday.', a: 'jail' },
  { txt: 'Back to Payday. Collect $180.', a: 'goto', to: 0 },
  { txt: 'Your allotment takes first prize. Collect $15 from every player.', a: 'collecteach', amt: 15 },
  { txt: 'Library late fees. Pay $15.', a: 'pay', amt: 15 },
  { txt: 'Your crowdfunding campaign succeeds. Collect $90.', a: 'gain', amt: 90 },
  { txt: 'Flood defence levy: pay $35 per house and $105 per hotel.', a: 'repairs', h: 35, ho: 105 },
  { txt: 'Vet bill for the family dog. Pay $70.', a: 'pay', amt: 70 },
  { txt: 'An old savings bond pays out. Collect $75.', a: 'gain', amt: 75 },
  { txt: 'Sponsor a charity fun run. Pay $30.', a: 'pay', amt: 30 },
];
const DECKS = { fortune: FORTUNE, fund: FUND };
export const DECK_NAMES = { fortune: 'Fortune', fund: 'Civic Fund' };

export const money = n => '$' + Math.round(n).toLocaleString('en-US');
const range = n => Array.from({ length: n }, (_, i) => i);

// ---------- Pure helpers shared by the server and the board ----------
// Each takes the game state or a view, which have the same `players` and `props` shape.

export const owned = (S, pid) => PROPS.filter(i => S.props[i].o === pid);
export const ownsGroup = (S, pid, g) => GI[g].every(i => S.props[i].o === pid);
export const alive = S => S.players.map((_, i) => i).filter(i => !S.players[i].out);
export const unmortCost = i => Math.round(SP[i].p * 0.55);

export function rentFor(S, i, opt = {}) {
  const sp = SP[i];
  const pr = S.props[i];
  const o = pr.o;
  if (sp.t === 'st') {
    if (pr.h > 0) return sp.r[pr.h];
    return sp.r[0] * (ownsGroup(S, o, sp.g) ? 2 : 1);
  }
  if (sp.t === 'rr') return STATION_RENT[RR.filter(j => S.props[j].o === o).length] * (opt.mult || 1);
  const n = UT.filter(j => S.props[j].o === o).length;
  return (S.dice[0] + S.dice[1]) * UTIL_MULT[opt.util10 ? 2 : n];
}

export function netWorth(S, pid) {
  const p = S.players[pid];
  if (p.out) return 0;
  return p.cash + owned(S, pid).reduce((sum, i) => {
    const pr = S.props[i];
    const build = SP[i].t === 'st' ? pr.h * GROUPS[SP[i].g].cost : 0;
    return sum + (pr.m ? SP[i].p / 2 : SP[i].p) + build;
  }, 0);
}

export function maxRaise(S, pid) {
  return S.players[pid].cash + owned(S, pid).reduce((sum, i) => {
    const pr = S.props[i];
    const half = SP[i].t === 'st' ? Math.floor(GROUPS[SP[i].g].cost / 2) * pr.h : 0;
    return sum + half + (pr.m ? 0 : SP[i].p / 2);
  }, 0);
}

export function buildReason(S, pid, i) {
  const sp = SP[i];
  const pr = S.props[i];
  if (sp.t !== 'st') return 'Only streets can be built on.';
  if (pr.o !== pid) return 'You don’t own this street.';
  if (!ownsGroup(S, pid, sp.g)) return 'Own every street in the group first.';
  if (GI[sp.g].some(j => S.props[j].m)) return 'Unmortgage the whole group first.';
  if (pr.h >= 5) return 'This street already has a hotel.';
  if (pr.h > Math.min(...GI[sp.g].map(j => S.props[j].h))) return 'Build evenly across the group.';
  if (pr.h === 4 && S.hotels < 1) return 'The bank has no hotels left.';
  if (pr.h < 4 && S.houses < 1) return 'The bank has no houses left.';
  if (S.players[pid].cash < GROUPS[sp.g].cost) return 'Not enough cash.';
  return '';
}

export function sellReason(S, pid, i) {
  const sp = SP[i];
  const pr = S.props[i];
  if (sp.t !== 'st' || pr.o !== pid || pr.h === 0) return 'No buildings to sell.';
  if (pr.h < Math.max(...GI[sp.g].map(j => S.props[j].h))) return 'Sell evenly across the group.';
  return '';
}

export function mortReason(S, pid, i) {
  const pr = S.props[i];
  if (pr.o !== pid) return 'You don’t own this.';
  if (pr.m) return 'Already mortgaged.';
  if (SP[i].t === 'st' && GI[SP[i].g].some(j => S.props[j].h > 0)) return 'Sell all buildings in this group first.';
  return '';
}

export const tradeable = (S, pid) => owned(S, pid).filter(i => SP[i].t !== 'st' || GI[SP[i].g].every(j => S.props[j].h === 0));

// Who must act next: a trade's recipient, the current bidder, or the player whose turn it is.
export function actor(S) {
  if (S.over) return -1;
  if (S.trade) return S.trade.to;
  if (S.auction) return S.auction.order[S.auction.at];
  return S.cur;
}

// The current player may build, mortgage and trade while no auction or offer is open.
export const canManage = S => !S.over && !S.auction && !S.trade && ['pre', 'post', 'buy', 'debt'].includes(S.phase);

// ---------- Server-side state ----------

function randomIndex(length) {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * length);
}
function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
const r6 = () => 1 + randomIndex(6);

function log(S, text, pid = -1) {
  S.log.push({ p: pid, text });
  if (S.log.length > 40) S.log.shift();
}

export function makeLandlord(seats, options = {}) {
  const rounds = ROUND_CHOICES.includes(options.rounds) ? options.rounds : 25;
  const S = {
    seats: [...seats],
    players: seats.map(() => ({ cash: START_CASH, pos: 0, jail: false, jailTurns: 0, cards: [], out: false })),
    cur: 0, phase: 'pre', dice: [1, 1], rolled: 0, doubles: 0, again: false,
    props: {}, houses: 36, hotels: 14,
    decks: { fortune: shuffle(range(FORTUNE.length)), fund: shuffle(range(FUND.length)) },
    rounds, round: 1, log: [], card: null, focus: 0, offer: -1, offers: 0,
    debt: null, auction: null, trade: null, over: null,
  };
  for (const i of PROPS) S.props[i] = { o: -1, h: 0, m: false };
  log(S, '@0 goes first.', 0);
  return S;
}

// ---------- Money ----------
function distribute(S, payees) {
  for (const { to, amt } of payees) if (to >= 0) S.players[to].cash += amt;
}

function charge(S, pid, amt, payees, after = null) {
  const p = S.players[pid];
  if (amt <= 0) { if (after) runAfter(S, after); return true; }
  if (p.cash >= amt) {
    p.cash -= amt;
    distribute(S, payees);
    if (after) runAfter(S, after);
    return true;
  }
  // Only the current player gets to choose what to sell. Others raise cash automatically.
  if (pid !== S.cur) {
    autoRaise(S, pid, amt);
    if (p.cash >= amt) { p.cash -= amt; distribute(S, payees); return true; }
    log(S, `@${pid} can't pay ${money(amt)}.`, pid);
    bankrupt(S, pid, creditorOf(payees));
    return false;
  }
  S.debt = { pid, amt, payees, after };
  S.phase = 'debt';
  log(S, `@${pid} owes ${money(amt)} but has ${money(p.cash)}.`, pid);
  return false;
}

function creditorOf(payees) {
  const tos = [...new Set(payees.map(x => x.to))];
  return tos.length === 1 ? tos[0] : -1;
}

function runAfter(S, after) {
  if (after.k === 'move') {
    S.phase = 'moving';
    advance(S, after.n);
  }
}

function payDebt(S) {
  const d = S.debt;
  if (!d || S.players[d.pid].cash < d.amt) return false;
  S.players[d.pid].cash -= d.amt;
  distribute(S, d.payees);
  log(S, `@${d.pid} pays ${money(d.amt)}.`, d.pid);
  S.debt = null;
  S.phase = 'post';
  if (d.after) runAfter(S, d.after);
  return true;
}

function bankrupt(S, pid, cred) {
  const p = S.players[pid];
  for (const i of owned(S, pid)) {
    const pr = S.props[i];
    if (pr.h > 0) {
      p.cash += Math.floor(GROUPS[SP[i].g].cost / 2) * pr.h;
      if (pr.h === 5) S.hotels++; else S.houses += pr.h;
      pr.h = 0;
    }
  }
  if (cred >= 0 && !S.players[cred].out) {
    S.players[cred].cash += p.cash;
    for (const i of owned(S, pid)) S.props[i].o = cred;
    S.players[cred].cards.push(...p.cards);
    log(S, `@${pid} is bankrupt! @${cred} takes everything they had.`, pid);
  } else {
    for (const i of owned(S, pid)) S.props[i] = { o: -1, h: 0, m: false };
    for (const c of p.cards) S.decks[c.kind].push(c.ci);
    log(S, `@${pid} is bankrupt! Their property returns to the bank.`, pid);
  }
  p.cards = [];
  p.cash = 0;
  p.out = true;
  p.jail = false;
  if (S.debt?.pid === pid) S.debt = null;
  if (S.trade && (S.trade.from === pid || S.trade.to === pid)) S.trade = null;
  if (S.auction) {
    const a = S.auction;
    if (!a.passed.includes(pid)) a.passed.push(pid);
    if (a.lead === pid) { a.lead = -1; a.bid = 0; }
  }
  if (checkWinner(S)) return;
  if (pid === S.cur) {
    S.again = false;
    S.phase = 'post';
    endTurn(S);
  }
}

function checkWinner(S) {
  const live = alive(S);
  if (live.length !== 1) return false;
  S.over = { winner: live[0], reason: 'last' };
  S.phase = 'over';
  S.auction = S.trade = S.debt = null;
  log(S, `@${live[0]} wins! Everyone else is bankrupt.`, live[0]);
  return true;
}

// ---------- Movement ----------
function passGo(S, pid) {
  S.players[pid].cash += SALARY;
  log(S, `@${pid} passes Payday and collects ${money(SALARY)}.`, pid);
}

function advance(S, n) {
  const p = S.players[S.cur];
  const from = p.pos;
  p.pos = (p.pos + n) % 40;
  if (p.pos < from) passGo(S, S.cur);
  log(S, `@${S.cur} moves to ${SP[p.pos].n}.`, S.cur);
  land(S, S.cur);
}

function moveTo(S, pid, to) {
  const p = S.players[pid];
  if (to < p.pos) passGo(S, pid);
  p.pos = to;
}

function sendToJail(S, pid) {
  const p = S.players[pid];
  p.pos = 10;
  p.jail = true;
  p.jailTurns = 0;
  S.again = false;
  S.doubles = 0;
  S.focus = 10;
  log(S, `@${pid} is sent to Lockup.`, pid);
}

function land(S, pid, opt = {}) {
  const i = S.players[pid].pos;
  const sp = SP[i];
  S.focus = i;
  if (isProp(i)) {
    const pr = S.props[i];
    if (pr.o < 0) { S.offer = i; S.phase = 'buy'; return; }
    if (pr.o === pid) return;
    if (pr.m) { log(S, `${sp.n} is mortgaged, so no rent is due.`, pid); return; }
    const rent = rentFor(S, i, opt);
    log(S, `@${pid} pays ${money(rent)} rent to @${pr.o} for ${sp.n}.`, pid);
    charge(S, pid, rent, [{ to: pr.o, amt: rent }]);
    return;
  }
  if (sp.t === 'tax') {
    log(S, `@${pid} pays the ${money(sp.amt)} ${sp.n.toLowerCase()}.`, pid);
    charge(S, pid, sp.amt, [{ to: -1, amt: sp.amt }]);
  } else if (sp.t === 'fortune' || sp.t === 'fund') drawCard(S, pid, sp.t);
  else if (sp.t === 'gojail') sendToJail(S, pid);
}

function drawCard(S, pid, kind) {
  const p = S.players[pid];
  const deck = S.decks[kind];
  const ci = deck.shift();
  const card = DECKS[kind][ci];
  S.card = { kind, txt: card.txt };
  log(S, `@${pid} draws ${DECK_NAMES[kind]}: “${card.txt}”`, pid);
  if (card.a === 'jailcard') p.cards.push({ kind, ci });
  else deck.push(ci);
  const others = alive(S).filter(q => q !== pid);
  switch (card.a) {
    case 'goto':
      moveTo(S, pid, card.to);
      land(S, pid);
      break;
    case 'nearest': {
      let j = p.pos;
      do { j = (j + 1) % 40; } while (SP[j].t !== card.kind);
      moveTo(S, pid, j);
      land(S, pid, card.kind === 'rr' ? { mult: 2 } : { util10: true });
      break;
    }
    case 'back':
      p.pos = (p.pos + 40 - card.n) % 40;
      land(S, pid);
      break;
    case 'jail':
      sendToJail(S, pid);
      break;
    case 'gain':
      p.cash += card.amt;
      break;
    case 'pay':
      charge(S, pid, card.amt, [{ to: -1, amt: card.amt }]);
      break;
    case 'repairs': {
      let hs = 0;
      let ho = 0;
      for (const i of owned(S, pid)) { const h = S.props[i].h; if (h === 5) ho++; else hs += h; }
      const amt = hs * card.h + ho * card.ho;
      if (amt > 0) charge(S, pid, amt, [{ to: -1, amt }]);
      break;
    }
    case 'payeach':
      charge(S, pid, card.amt * others.length, others.map(q => ({ to: q, amt: card.amt })));
      break;
    case 'collecteach':
      for (const q of others) if (!S.players[q].out && !S.over) charge(S, q, card.amt, [{ to: pid, amt: card.amt }]);
      break;
    default:
  }
}

// ---------- Turn actions ----------
function roll(S) {
  if (!(S.phase === 'pre' || (S.phase === 'post' && S.again))) return false;
  const p = S.players[S.cur];
  const d = [r6(), r6()];
  S.dice = d;
  S.rolled++;
  S.card = null;
  const tot = d[0] + d[1];
  const dbl = d[0] === d[1];
  S.again = false;
  if (p.jail) {
    if (dbl) {
      p.jail = false;
      p.jailTurns = 0;
      log(S, `@${S.cur} rolls double ${d[0]}s and walks out of Lockup.`, S.cur);
      S.phase = 'moving';
      advance(S, tot);
      return true;
    }
    p.jailTurns++;
    if (p.jailTurns >= 3) {
      log(S, `@${S.cur} rolls ${d[0]} and ${d[1]}, and must pay ${money(BAIL)} to leave Lockup.`, S.cur);
      p.jail = false;
      p.jailTurns = 0;
      S.phase = 'moving';
      charge(S, S.cur, BAIL, [{ to: -1, amt: BAIL }], { k: 'move', n: tot });
      return true;
    }
    log(S, `@${S.cur} rolls ${d[0]} and ${d[1]} and stays in Lockup.`, S.cur);
    S.phase = 'post';
    return true;
  }
  if (dbl) {
    S.doubles++;
    if (S.doubles >= 3) {
      log(S, `@${S.cur} rolls a third double in a row!`, S.cur);
      sendToJail(S, S.cur);
      S.phase = 'post';
      return true;
    }
    S.again = true;
  } else S.doubles = 0;
  log(S, `@${S.cur} rolls ${d[0]} and ${d[1]}${dbl ? ' (doubles!)' : ''}.`, S.cur);
  S.phase = 'moving';
  advance(S, tot);
  return true;
}

function payBail(S) {
  const p = S.players[S.cur];
  if (S.phase !== 'pre' || !p.jail || p.cash < BAIL) return false;
  p.cash -= BAIL;
  p.jail = false;
  p.jailTurns = 0;
  log(S, `@${S.cur} pays ${money(BAIL)} bail.`, S.cur);
  return true;
}

function useJailCard(S) {
  const p = S.players[S.cur];
  if (S.phase !== 'pre' || !p.jail || !p.cards.length) return false;
  const c = p.cards.shift();
  S.decks[c.kind].push(c.ci);
  p.jail = false;
  p.jailTurns = 0;
  log(S, `@${S.cur} uses a Bail Pass.`, S.cur);
  return true;
}

function buy(S) {
  const i = S.offer;
  const p = S.players[S.cur];
  if (S.phase !== 'buy' || i < 0 || p.cash < SP[i].p) return false;
  p.cash -= SP[i].p;
  S.props[i].o = S.cur;
  S.offer = -1;
  S.phase = 'post';
  log(S, `@${S.cur} buys ${SP[i].n} for ${money(SP[i].p)}.`, S.cur);
  return true;
}

// Ends the game now with the richest player winning. The room calls this at its move limit.
export function endLandlord(S) {
  if (S.over) return;
  S.auction = null;
  S.trade = null;
  S.debt = null;
  const ranks = alive(S).sort((a, b) => netWorth(S, b) - netWorth(S, a));
  S.over = { winner: ranks[0], reason: 'limit' };
  S.phase = 'over';
  log(S, `The room reached its move limit. @${ranks[0]} is the richest with ${money(netWorth(S, ranks[0]))}.`, ranks[0]);
}

function endTurn(S) {
  if (S.over) return false;
  const p = S.players[S.cur];
  if ((S.phase !== 'post' || S.again) && !p.out) return false;
  S.doubles = 0;
  S.again = false;
  S.card = null;
  S.offer = -1;
  S.offers = 0;
  const n = S.players.length;
  let next = S.cur;
  do {
    next = (next + 1) % n;
    if (next === 0) S.round++;
  } while (S.players[next].out);
  if (S.rounds && S.round > S.rounds) {
    const ranks = alive(S).sort((a, b) => netWorth(S, b) - netWorth(S, a));
    S.over = { winner: ranks[0], reason: 'time' };
    S.phase = 'over';
    log(S, `Time is up! @${ranks[0]} is the richest with ${money(netWorth(S, ranks[0]))}.`, ranks[0]);
    return true;
  }
  S.cur = next;
  S.phase = 'pre';
  S.focus = S.players[next].pos;
  log(S, `@${next}'s turn.`, next);
  return true;
}

// ---------- Building and mortgages ----------
function build(S, pid, i) {
  if (buildReason(S, pid, i)) return false;
  const pr = S.props[i];
  if (pr.h === 4) { S.hotels--; S.houses += 4; } else S.houses--;
  pr.h++;
  S.players[pid].cash -= GROUPS[SP[i].g].cost;
  log(S, `@${pid} builds ${pr.h === 5 ? 'a hotel' : 'a house'} on ${SP[i].n}.`, pid);
  return true;
}

function sell(S, pid, i) {
  if (sellReason(S, pid, i)) return false;
  const pr = S.props[i];
  const half = Math.floor(GROUPS[SP[i].g].cost / 2);
  if (pr.h === 5) {
    S.hotels++;
    if (S.houses >= 4) { S.houses -= 4; pr.h = 4; S.players[pid].cash += half; }
    else { pr.h = 0; S.players[pid].cash += half * 5; }
    log(S, `@${pid} sells a hotel on ${SP[i].n}.`, pid);
  } else {
    S.houses++;
    pr.h--;
    S.players[pid].cash += half;
    log(S, `@${pid} sells a house on ${SP[i].n}.`, pid);
  }
  return true;
}

function mortgage(S, pid, i) {
  if (mortReason(S, pid, i)) return false;
  S.props[i].m = true;
  S.players[pid].cash += SP[i].p / 2;
  log(S, `@${pid} mortgages ${SP[i].n} for ${money(SP[i].p / 2)}.`, pid);
  return true;
}

function unmortgage(S, pid, i) {
  const pr = S.props[i];
  if (pr.o !== pid || !pr.m || S.players[pid].cash < unmortCost(i)) return false;
  S.players[pid].cash -= unmortCost(i);
  pr.m = false;
  log(S, `@${pid} unmortgages ${SP[i].n}.`, pid);
  return true;
}

function autoRaise(S, pid, amt) {
  const p = S.players[pid];
  for (let guard = 200; p.cash < amt && guard > 0; guard--) {
    const mine = owned(S, pid);
    const loose = mine.filter(i => !mortReason(S, pid, i) && !(SP[i].t === 'st' && ownsGroup(S, pid, SP[i].g))).sort((a, b) => SP[a].p - SP[b].p);
    if (loose.length) { mortgage(S, pid, loose[0]); continue; }
    const sellable = mine.filter(i => !sellReason(S, pid, i)).sort((a, b) => GROUPS[SP[a].g].cost - GROUPS[SP[b].g].cost);
    if (sellable.length) { sell(S, pid, sellable[0]); continue; }
    const any = mine.filter(i => !mortReason(S, pid, i)).sort((a, b) => SP[a].p - SP[b].p);
    if (any.length) { mortgage(S, pid, any[0]); continue; }
    break;
  }
}

// ---------- Auctions ----------
function startAuction(S) {
  if (S.phase !== 'buy') return false;
  const n = S.players.length;
  const order = range(n).map(k => (S.cur + k) % n).filter(q => !S.players[q].out);
  S.auction = { i: S.offer, bid: 0, lead: -1, order, at: 0, passed: [] };
  S.offer = -1;
  S.phase = 'auction';
  log(S, `${SP[S.auction.i].n} goes up for auction.`, S.cur);
  return true;
}

function auctionBid(S, q, amount) {
  const a = S.auction;
  if (!Number.isInteger(amount) || amount <= a.bid || amount > S.players[q].cash) return false;
  a.bid = amount;
  a.lead = q;
  log(S, `@${q} bids ${money(amount)}.`, q);
  nextBidder(S);
  return true;
}

function auctionPass(S, q) {
  S.auction.passed.push(q);
  log(S, `@${q} drops out of the auction.`, q);
  nextBidder(S);
  return true;
}

function nextBidder(S) {
  const a = S.auction;
  const active = a.order.filter(q => !a.passed.includes(q) && !S.players[q].out);
  if (!active.length || (active.length === 1 && active[0] === a.lead)) return closeAuction(S);
  do a.at = (a.at + 1) % a.order.length;
  while (a.passed.includes(a.order[a.at]) || S.players[a.order[a.at]].out || a.order[a.at] === a.lead);
}

function closeAuction(S) {
  const a = S.auction;
  if (a.lead >= 0) {
    S.players[a.lead].cash -= a.bid;
    S.props[a.i].o = a.lead;
    log(S, `@${a.lead} wins ${SP[a.i].n} for ${money(a.bid)}.`, a.lead);
  } else log(S, `Nobody bids. ${SP[a.i].n} stays with the bank.`);
  S.auction = null;
  S.phase = 'post';
}

// ---------- Trades ----------
function tradeValid(S, t) {
  const P = S.players;
  if (P[t.from].out || P[t.to].out) return false;
  const okFrom = t.give.every(i => tradeable(S, t.from).includes(i));
  const okTo = t.get.every(i => tradeable(S, t.to).includes(i));
  return okFrom && okTo && P[t.from].cash >= t.cg && P[t.to].cash >= t.ct && t.give.length + t.get.length > 0;
}

function propList(list) {
  return Array.isArray(list) && list.length <= PROPS.length && new Set(list).size === list.length &&
    list.every(i => Number.isInteger(i) && isProp(i));
}
const cashAmount = n => Number.isInteger(n) && n >= 0;

function propose(S, move) {
  const n = S.players.length;
  if (!['pre', 'post'].includes(S.phase) || S.offers >= 5) return false;
  const t = { from: S.cur, to: move.to, give: move.give, get: move.get, cg: move.cg ?? 0, ct: move.ct ?? 0 };
  if (!Number.isInteger(t.to) || t.to < 0 || t.to >= n || t.to === t.from) return false;
  if (!propList(t.give) || !propList(t.get) || !cashAmount(t.cg) || !cashAmount(t.ct) || !tradeValid(S, t)) return false;
  S.trade = t;
  S.offers++;
  log(S, `@${t.from} offers @${t.to} a trade.`, t.from);
  return true;
}

export function describeSide(props, cash) {
  const parts = props.map(i => SP[i].n);
  if (cash > 0) parts.push(money(cash));
  return parts.length ? parts.join(', ') : 'nothing';
}

function respond(S, accept) {
  const t = S.trade;
  S.trade = null;
  if (accept && tradeValid(S, t)) {
    for (const i of t.give) S.props[i].o = t.to;
    for (const i of t.get) S.props[i].o = t.from;
    S.players[t.from].cash += t.ct - t.cg;
    S.players[t.to].cash += t.cg - t.ct;
    log(S, `@${t.from} and @${t.to} trade: ${describeSide(t.give, t.cg)} for ${describeSide(t.get, t.ct)}.`, t.from);
  } else log(S, `@${t.to} declines the offer from @${t.from}.`, t.to);
  return true;
}

// ---------- Move entry point ----------

// Mutates `S` and returns true only for a legal action by `seat`.
export function applyLandlord(S, seat, move) {
  const pid = S.seats.indexOf(seat);
  if (pid < 0 || S.over || !move || typeof move !== 'object' || S.players[pid].out) return false;
  const ok = act(S, pid, move);
  if (ok && !S.over) {
    if (S.phase === 'moving') S.phase = 'post';
    if (S.phase === 'post' && S.players[S.cur].out) endTurn(S);
  }
  return ok;
}

function act(S, pid, move) {
  const { action } = move;
  if (S.trade) {
    if (action === 'respond' && pid === S.trade.to) return respond(S, Boolean(move.accept));
    if (action === 'cancelTrade' && pid === S.trade.from) {
      S.trade = null;
      log(S, `@${pid} withdraws the offer.`, pid);
      return true;
    }
    return false;
  }
  if (S.auction) {
    if (pid !== actor(S)) return false;
    if (action === 'bid') return auctionBid(S, pid, move.amount);
    if (action === 'pass') return auctionPass(S, pid);
    return false;
  }
  if (pid !== S.cur) return false;
  const i = move.i;
  switch (action) {
    case 'roll': return roll(S);
    case 'bail': return payBail(S);
    case 'card': return useJailCard(S);
    case 'buy': return buy(S);
    case 'auction': return startAuction(S);
    case 'end': return endTurn(S);
    case 'pay': return S.phase === 'debt' && payDebt(S);
    case 'raise':
      if (S.phase !== 'debt' || S.players[pid].cash >= S.debt.amt) return false;
      autoRaise(S, pid, S.debt.amt);
      return true;
    case 'bankrupt':
      if (S.phase !== 'debt') return false;
      bankrupt(S, pid, creditorOf(S.debt.payees));
      return true;
    case 'build': return canManage(S) && isProp(i) && build(S, pid, i);
    case 'sell': return canManage(S) && isProp(i) && sell(S, pid, i);
    case 'mortgage': return canManage(S) && isProp(i) && mortgage(S, pid, i);
    case 'unmortgage': return canManage(S) && isProp(i) && unmortgage(S, pid, i);
    case 'trade': return propose(S, move);
    default: return false;
  }
}

// Everything is public except the order of the card decks.
export function landlordView(S, seat) {
  const { decks, debt, ...rest } = S;
  const scores = [];
  S.players.forEach((p, pid) => { scores[S.seats[pid]] = p.out ? 'Out' : money(p.cash); });
  const who = actor(S);
  return {
    ...rest,
    players: S.players.map((p, pid) => ({ ...p, cards: p.cards.length, seat: S.seats[pid], worth: netWorth(S, pid) })),
    debt: debt && { pid: debt.pid, amt: debt.amt, to: creditorOf(debt.payees) },
    me: S.seats.indexOf(seat),
    turn: who >= 0 ? S.seats[who] : null,
    scores,
    winner: S.over ? S.seats[S.over.winner] : undefined,
  };
}
