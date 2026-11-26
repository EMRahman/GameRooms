export function makeBoard(size = 4) {
  return {
    size,
    turn: 0,
    scores: [0, 0],
    horizontal: Array((size + 1) * size).fill(null),
    vertical: Array(size * (size + 1)).fill(null),
    boxes: Array(size * size).fill(null),
  };
}

export function validLine(size, line) {
  if (!line || !Number.isInteger(line.row) || !Number.isInteger(line.col)) return false;
  const { axis, row, col } = line;
  return row >= 0 && col >= 0 && (
    (axis === 'h' && row <= size && col < size) ||
    (axis === 'v' && row < size && col <= size)
  );
}

export function playLine(board, seat, line) {
  const { size } = board;
  if (seat !== board.turn || !board.boxes.includes(null) || !validLine(size, line)) return board;
  const { axis, row, col } = line;
  const key = axis === 'h' ? 'horizontal' : 'vertical';
  const index = row * (axis === 'h' ? size : size + 1) + col;
  if (board[key][index] !== null) return board;

  const next = { ...board, [key]: board[key].slice(), boxes: board.boxes.slice(), scores: board.scores.slice() };
  next[key][index] = seat;
  const neighbors = axis === 'h' ? [[row - 1, col], [row, col]] : [[row, col - 1], [row, col]];
  for (const [r, c] of neighbors) {
    if (r < 0 || c < 0 || r >= size || c >= size) continue;
    const box = r * size + c;
    const left = r * (size + 1) + c;
    if (next.boxes[box] === null && [
      next.horizontal[box], next.horizontal[box + size],
      next.vertical[left], next.vertical[left + 1],
    ].every(edge => edge !== null)) {
      next.boxes[box] = seat;
      next.scores[seat]++;
    }
  }
  if (next.scores[seat] === board.scores[seat]) next.turn = 1 - seat;
  return next;
}
