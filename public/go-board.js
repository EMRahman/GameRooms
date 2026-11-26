export function drawGo(container, size, submitMove) {
  container.setAttribute('aria-label', `Go board, ${size} by ${size}`);
  container.style.setProperty('--go-size', size);
  container.replaceChildren();
  const points = [];
  const star = size === 9 ? 2 : 3;
  const starPoints = new Set([star, (size - 1) / 2, size - 1 - star]);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const point = row * size + col;
      const button = document.createElement('button');
      const mark = document.createElement('span');
      const coordinate = `${'ABCDEFGHJKLMNOPQRST'[col]}${size - row}`;
      button.type = 'button';
      button.tabIndex = point === 0 ? 0 : -1;
      button.className = 'go-point';
      button.classList.toggle('go-left', col === 0);
      button.classList.toggle('go-right', col === size - 1);
      button.classList.toggle('go-top', row === 0);
      button.classList.toggle('go-bottom', row === size - 1);
      if (starPoints.has(row) && starPoints.has(col)) mark.classList.add('go-star');
      mark.setAttribute('aria-hidden', 'true');
      button.append(mark);
      button.onclick = () => submitMove({ action: 'place', point });
      button.addEventListener('focus', () => {
        for (const entry of points) entry.button.tabIndex = entry.button === button ? 0 : -1;
      });
      button.addEventListener('keydown', event => {
        const next = { ArrowLeft: col > 0 ? point - 1 : null,
          ArrowRight: col < size - 1 ? point + 1 : null,
          ArrowUp: row > 0 ? point - size : null,
          ArrowDown: row < size - 1 ? point + size : null }[event.key];
        if (next == null) return;
        event.preventDefault();
        points[next].button.focus();
      });
      container.append(button);
      points.push({ button, coordinate });
    }
  }

  return (board, canMove) => {
    for (const [point, { button, coordinate }] of points.entries()) {
      const color = board.cells[point];
      if (color) button.dataset.stone = color;
      else delete button.dataset.stone;
      button.classList.toggle('last-move', point === board.lastPoint);
      button.setAttribute('aria-disabled', String(!canMove || color !== 0));
      button.setAttribute('aria-label', `${coordinate}, ${['empty', 'black stone', 'white stone'][color]}`);
    }
  };
}
