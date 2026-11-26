import { COLUMNS, ROWS } from './fourfold-rules.js';

export function drawFourfold(container, submitMove) {
  const columns = [];
  container.setAttribute('aria-label', 'Fourfold board');
  container.replaceChildren();
  for (let col = 0; col < COLUMNS; col++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fourfold-column';
    button.onclick = () => submitMove({ col });
    const cells = Array.from({ length: ROWS }, () => {
      const cell = document.createElement('span');
      cell.setAttribute('aria-hidden', 'true');
      button.append(cell);
      return cell;
    });
    container.append(button);
    columns.push({ button, cells });
  }

  return (board, canMove) => {
    columns.forEach(({ button, cells }, col) => {
      const full = board.cells[0][col] !== null;
      button.disabled = !canMove || full;
      const counters = board.cells.map(row => row[col]).reverse().filter(seat => seat !== null);
      const stack = counters.length ? counters.map(seat => seat === 0 ? 'coral' : 'teal').join(', ') : 'empty';
      button.setAttribute('aria-label', `Column ${col + 1}, ${stack}${full ? ', full' : ''}`);
      cells.forEach((cell, row) => {
        const seat = board.cells[row][col];
        if (seat === null) delete cell.dataset.seat;
        else cell.dataset.seat = seat;
        cell.classList.toggle('winning', board.winningCells.some(([r, c]) => r === row && c === col));
      });
    });
  };
}
