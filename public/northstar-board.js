const SIZE = 10;
const coordinate = point => `${'ABCDEFGHIJ'[point % SIZE]}${Math.floor(point / SIZE) + 1}`;

function makeSea(title, fire) {
  const panel = document.createElement('section');
  const label = document.createElement('h3');
  label.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'northstar-sea';
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', title);
  const cells = Array.from({ length: SIZE ** 2 }, (_, point) => {
    const cell = document.createElement(fire ? 'button' : 'span');
    cell.className = 'northstar-cell';
    if (fire) {
      cell.type = 'button';
      cell.onclick = () => fire({ action: 'fire', point });
    }
    grid.append(cell);
    return cell;
  });
  panel.append(label, grid);
  return { panel, cells };
}

export function drawNorthstar(container, seat, submitMove) {
  const own = makeSea('Your fleet');
  const target = makeSea('Target grid', submitMove);
  const controls = document.createElement('div');
  controls.className = 'actions';
  const shuffle = document.createElement('button');
  shuffle.type = 'button';
  shuffle.textContent = 'Shuffle fleet';
  shuffle.onclick = () => submitMove({ action: 'shuffle' });
  const lock = document.createElement('button');
  lock.type = 'button';
  lock.className = 'primary';
  lock.textContent = 'Lock fleet';
  lock.onclick = () => submitMove({ action: 'lock' });
  const report = document.createElement('p');
  report.className = 'northstar-report';
  report.setAttribute('aria-live', 'polite');
  controls.append(shuffle, lock);
  container.setAttribute('aria-label', 'Northstar battle');
  container.replaceChildren(own.panel, target.panel, controls, report);

  function paint(cell, point, ship, shot) {
    const detail = [ship?.name, shot].filter(Boolean).join(', ');
    cell.dataset.ship = ship ? 'yes' : 'no';
    cell.dataset.shot = shot ?? '';
    cell.textContent = shot === 'hit' ? '×' : shot === 'miss' ? '·' : '';
    cell.setAttribute('aria-label', detail ? `${coordinate(point)}, ${detail}` : coordinate(point));
  }

  return (view, canFire, _preview, active) => {
    if (!view) return;
    const deployment = view.stage === 'deployment';
    controls.hidden = !deployment;
    shuffle.disabled = lock.disabled = !active || view.locked[seat];
    lock.textContent = view.locked[seat] ? 'Fleet locked' : 'Lock fleet';
    target.panel.hidden = deployment;
    for (const [point, cell] of own.cells.entries()) {
      paint(cell, point, view.fleet.find(ship => ship.cells.includes(point)), view.incoming[point]);
    }
    for (const [point, cell] of target.cells.entries()) {
      paint(cell, point, null, view.outgoing[point]);
      cell.disabled = !canFire || view.stage !== 'battle' || view.outgoing[point] !== null;
    }
    const afloat = view.fleet.filter(ship => ship.cells.some(point => view.incoming[point] !== 'hit')).length;
    const shot = view.lastShot;
    const outcome = shot ? ` · ${coordinate(shot.point)} ${shot.result}${shot.sunk ? `, ${shot.sunk} sunk` : ''}` : '';
    report.textContent = deployment ? '' : `Ships afloat: you ${afloat}, opponent ${view.fleet.length - view.enemySunk.length}${outcome}`;
  };
}
