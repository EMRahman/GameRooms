export const game = 'dots_and_boxes';
export const clientIdValid = id => typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id);
