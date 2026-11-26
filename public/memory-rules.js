export const MEMORY_LEVELS = {
  easy: { pairs: 8, columns: 4, label: 'Easy · 8 pairs' },
  classic: { pairs: 10, columns: 5, label: 'Classic · 10 pairs' },
  expert: { pairs: 18, columns: 6, label: 'Expert · 18 pairs' },
};

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), seed | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeMemoryBoard({ level }, seed, seats) {
  const { pairs, columns } = MEMORY_LEVELS[level];
  const deck = Array.from({ length: pairs * 2 }, (_, index) => Math.floor(index / 2));
  const random = seededRandom(seed);
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return {
    seats, columns, deck, turn: seats[0], scores: Array(5).fill(0),
    owners: Array(deck.length).fill(null), revealed: null, remaining: pairs,
  };
}

export function validFlip(level, move) {
  return Number.isInteger(move?.card) && move.card >= 0 && move.card < MEMORY_LEVELS[level].pairs * 2;
}

export function flipCard(board, seat, move) {
  const card = move?.card;
  if (seat !== board.turn || !board.remaining || !Number.isInteger(card) ||
      card < 0 || card >= board.deck.length || board.owners[card] !== null || card === board.revealed) return board;
  if (board.revealed === null) return { ...board, revealed: card };
  if (board.deck[board.revealed] !== board.deck[card]) {
    const next = (board.seats.indexOf(seat) + 1) % board.seats.length;
    return { ...board, turn: board.seats[next], revealed: null };
  }
  const owners = board.owners.slice();
  owners[board.revealed] = owners[card] = seat;
  const scores = board.scores.slice();
  scores[seat]++;
  return { ...board, owners, scores, revealed: null, remaining: board.remaining - 1 };
}

export function memoryWinner(board) {
  if (board.remaining) return undefined;
  const best = Math.max(...board.scores);
  const winners = board.seats.filter(seat => board.scores[seat] === best);
  return winners.length === 1 ? winners[0] : null;
}
