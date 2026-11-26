import { validLine } from '../public/dots-rules.js';
import { validDrop } from '../public/fourfold-rules.js';
import { GO_SIZES, goMoveData } from '../public/go-rules.js';
import { MEMORY_LEVELS, validFlip } from '../public/memory-rules.js';

export const defaultGame = 'dots_and_boxes';
export const clientIdValid = id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);

export function roomOptions(game, options) {
  if (game === 'fourfold' || game === 'northstar') return {};
  if (game === 'memory_match') {
    const level = options?.level ?? 'easy';
    return typeof level === 'string' && Object.hasOwn(MEMORY_LEVELS, level) ? { level } : null;
  }
  if (game === 'go') {
    const size = options?.size ?? GO_SIZES[0];
    return GO_SIZES.includes(size) ? { size } : null;
  }
  if (game !== defaultGame) return null;
  const size = options?.size ?? 4;
  return [4, 5, 6].includes(size) ? { size } : null;
}

export function roomMove(game, options, move) {
  if (game === 'memory_match') return validFlip(options.level, move) ? { card: move.card } : null;
  if (game === 'go') return goMoveData(options.size, move);
  if (game === 'fourfold') return validDrop(move) ? { col: move.col } : null;
  if (!validLine(options.size, move)) return null;
  const { axis, row, col } = move;
  return { axis, row, col };
}
