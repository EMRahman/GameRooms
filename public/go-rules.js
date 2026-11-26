export const GO_SIZES = [9, 13, 19];
export const KOMI = 6.5;

const positionKey = cells => cells.join('');
const stone = seat => seat + 1;

export function makeGoBoard({ size = GO_SIZES[0] } = {}) {
  const cells = Array(size * size).fill(0);
  return {
    size, cells, turn: 0, passes: 0, history: new Set([positionKey(cells)]),
    captures: [0, 0], lastPoint: null, scores: null, winner: undefined, resigned: false,
  };
}

export function goMoveData(size, move) {
  if (move?.action === 'pass' || move?.action === 'resign') return { action: move.action };
  if (move?.action === 'place' && Number.isInteger(move.point) && move.point >= 0 && move.point < size * size) {
    return { action: 'place', point: move.point };
  }
  return null;
}

function neighbors(point, size) {
  const adjacent = [];
  if (point >= size) adjacent.push(point - size);
  if (point < size * (size - 1)) adjacent.push(point + size);
  const col = point % size;
  if (col > 0) adjacent.push(point - 1);
  if (col < size - 1) adjacent.push(point + 1);
  return adjacent;
}

function collect(cells, size, start) {
  const color = cells[start];
  const points = new Set([start]);
  const borders = new Set();
  for (const point of points) {
    for (const next of neighbors(point, size)) {
      if (cells[next] === color) points.add(next);
      else borders.add(cells[next]);
    }
  }
  return { points, borders };
}

function scoreArea(cells, size) {
  const scores = [0, KOMI];
  const seen = new Set();
  for (const [point, color] of cells.entries()) {
    if (color) scores[color - 1]++;
    else if (!seen.has(point)) {
      const { points, borders } = collect(cells, size, point);
      for (const empty of points) seen.add(empty);
      if (borders.size === 1) scores[borders.values().next().value - 1] += points.size;
    }
  }
  return scores;
}

export function playGo(board, seat, move) {
  if (board.winner !== undefined || ![0, 1].includes(seat)) return board;
  const data = goMoveData(board.size, move);
  if (!data) return board;
  if (data.action === 'resign') return { ...board, winner: 1 - seat, resigned: true };
  if (seat !== board.turn) return board;
  if (data.action === 'pass') {
    if (board.passes === 0) return { ...board, turn: 1 - seat, passes: 1, lastPoint: null };
    const scores = scoreArea(board.cells, board.size);
    return { ...board, passes: 2, scores, winner: scores[0] > scores[1] ? 0 : 1 };
  }

  const { point } = data;
  const { size } = board;
  if (board.cells[point] !== 0) return board;

  const cells = board.cells.slice();
  const captures = board.captures.slice();
  cells[point] = stone(seat);
  for (const next of neighbors(point, size)) {
    if (cells[next] !== stone(1 - seat)) continue;
    const group = collect(cells, size, next);
    if (group.borders.has(0)) continue;
    for (const captured of group.points) cells[captured] = 0;
    captures[seat] += group.points.size;
  }
  if (!collect(cells, size, point).borders.has(0)) return board;
  const key = positionKey(cells);
  if (board.history.has(key)) return board;

  return {
    ...board, cells, captures, history: new Set([...board.history, key]),
    turn: 1 - seat, passes: 0, lastPoint: point,
  };
}
