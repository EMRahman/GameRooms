export const SEA_SIZE = 10;
const AREA = SEA_SIZE ** 2;
const FLEET = [
  ['Carrier', 5], ['Battleship', 4], ['Cruiser', 3], ['Submarine', 3], ['Destroyer', 2],
];

function touches(a, b) {
  return Math.abs(Math.floor(a / SEA_SIZE) - Math.floor(b / SEA_SIZE)) <= 1 &&
    Math.abs((a % SEA_SIZE) - (b % SEA_SIZE)) <= 1;
}

function randomIndex(length) {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296 * length);
}

const placements = FLEET.map(([name, size]) => {
  const candidates = [];
  for (let start = 0; start < AREA; start++) {
    for (const step of [1, SEA_SIZE]) {
      if (step === 1 ? start % SEA_SIZE + size > SEA_SIZE : start + (size - 1) * step >= AREA) continue;
      candidates.push({ name, cells: Array.from({ length: size }, (_, offset) => start + offset * step) });
    }
  }
  return candidates;
});

function randomFleet(index = 0, fleet = []) {
  if (index === FLEET.length) return fleet;
  const candidates = placements[index].filter(ship => ship.cells.every(point =>
    fleet.every(existing => existing.cells.every(other => !touches(point, other)))));
  while (candidates.length) {
    const [ship] = candidates.splice(randomIndex(candidates.length), 1);
    const result = randomFleet(index + 1, [...fleet, ship]);
    if (result) return result;
  }
  return null;
}

export function makeBattle() {
  return {
    fleets: [randomFleet(), randomFleet()],
    locked: [false, false],
    shots: [Array(AREA).fill(null), Array(AREA).fill(null)],
    stage: 'deployment', turn: 0, winner: null, lastShot: null,
  };
}

function sunk(ship, shots) {
  return ship.cells.every(point => shots[point] === 'hit');
}

// The Durable Object only persists the mutated battle after a successful action.
export function applyNorthstar(battle, seat, move) {
  if (!move || ![0, 1].includes(seat)) return false;
  if (battle.stage === 'deployment' && !battle.locked[seat]) {
    if (move.action === 'shuffle') {
      battle.fleets[seat] = randomFleet();
      return true;
    }
    if (move.action === 'lock') {
      battle.locked[seat] = true;
      if (battle.locked.every(Boolean)) battle.stage = 'battle';
      return true;
    }
  }
  const point = move.point;
  if (move.action !== 'fire' || battle.stage !== 'battle' || battle.turn !== seat ||
      !Number.isInteger(point) || point < 0 || point >= AREA || battle.shots[seat][point] !== null) return false;
  const enemy = battle.fleets[1 - seat];
  const ship = enemy.find(candidate => candidate.cells.includes(point));
  const shots = battle.shots[seat];
  shots[point] = ship ? 'hit' : 'miss';
  battle.lastShot = { seat, point, result: shots[point], sunk: ship && sunk(ship, shots) ? ship.name : null };
  if (enemy.every(candidate => sunk(candidate, shots))) {
    battle.winner = seat;
    battle.stage = 'finished';
  } else if (!ship) battle.turn = 1 - seat;
  return true;
}

export function northstarView(battle, seat) {
  const incoming = battle.shots[1 - seat];
  const outgoing = battle.shots[seat];
  return {
    stage: battle.stage,
    turn: battle.turn,
    winner: battle.winner,
    locked: battle.locked,
    lastShot: battle.lastShot,
    fleet: battle.fleets[seat],
    incoming,
    outgoing,
    enemySunk: battle.fleets[1 - seat].filter(ship => sunk(ship, outgoing)).map(ship => ship.name),
  };
}
