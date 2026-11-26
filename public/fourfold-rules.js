export const ROWS = 6;
export const COLUMNS = 7;

export function makeFourfoldBoard() {
  return {
    cells: Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null)),
    turn: 0,
    moves: 0,
    finished: false,
    winner: null,
    winningCells: [],
  };
}

export function validDrop(move) {
  return Number.isInteger(move?.col) && move.col >= 0 && move.col < COLUMNS;
}

export function dropCounter(board, seat, move) {
  if (board.finished || seat !== board.turn || !validDrop(move)) return board;
  const { col } = move;
  const row = board.cells.findLastIndex(line => line[col] === null);
  if (row === -1) return board;
  const cells = board.cells.map(line => line.slice());
  cells[row][col] = seat;
  const winningCells = findWin(cells, row, col, seat);
  const moves = board.moves + 1;
  return {
    cells, moves, winningCells,
    turn: 1 - seat,
    winner: winningCells.length ? seat : null,
    finished: winningCells.length > 0 || moves === ROWS * COLUMNS,
  };
}

function findWin(cells, row, col, seat) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const line = [[row, col]];
    for (const direction of [-1, 1]) {
      let r = row + dr * direction;
      let c = col + dc * direction;
      while (cells[r]?.[c] === seat) {
        line.push([r, c]);
        r += dr * direction;
        c += dc * direction;
      }
    }
    if (line.length >= 4) return line;
  }
  return [];
}
