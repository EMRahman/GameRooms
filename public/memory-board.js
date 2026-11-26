const symbols = ['☀', '☾', '✦', '♞', '❋', '⌁', '◈', '♬', '⚓', '☂', '✿', '♜', '✈', '⌛', '⚡', '☕', '♣', '∞'];
const names = ['Sun', 'Moon', 'Star', 'Knight', 'Snowflake', 'Wave', 'Gem', 'Music', 'Anchor', 'Umbrella', 'Flower', 'Castle', 'Plane', 'Hourglass', 'Lightning', 'Coffee', 'Club', 'Infinity'];

export function drawMemory(container, board, submitMove) {
  container.setAttribute('aria-label', 'Memory Match cards');
  container.style.setProperty('--memory-columns', board.columns);
  const buttons = board.deck.map((_, card) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'memory-card';
    button.onclick = () => submitMove({ card });
    return button;
  });
  container.replaceChildren(...buttons);
  return (state, canMove, preview = []) => {
    for (const [card, button] of buttons.entries()) {
      const owner = state.owners[card];
      const shown = card === state.revealed || owner !== null || preview.includes(card);
      const pair = state.deck[card];
      button.textContent = shown ? symbols[pair] : '';
      button.disabled = !canMove || shown;
      button.classList.toggle('face-up', shown);
      if (owner === null) delete button.dataset.owner;
      else button.dataset.owner = owner;
      button.setAttribute('aria-label', shown ? `Card ${card + 1}, ${names[pair]}${owner === null ? '' : ', matched'}` : `Flip card ${card + 1}`);
    }
  };
}
