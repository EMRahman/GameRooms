import { validLine } from '../public/dots-rules.js';
import { validDrop } from '../public/fourfold-rules.js';

export const defaultGame = 'dots_and_boxes';
export const clientIdValid = id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);

export function roomOptions(game, options) {
  if (game === 'fourfold') return {};
  if (game !== defaultGame) return null;
  const size = options?.size ?? 4;
  return [4, 5, 6].includes(size) ? { size } : null;
}

export function roomMove(game, options, move) {
  if (game === 'fourfold') return validDrop(move) ? { col: move.col } : null;
  if (!validLine(options.size, move)) return null;
  const { axis, row, col } = move;
  return { axis, row, col };
}
