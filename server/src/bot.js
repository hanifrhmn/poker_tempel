import {
  canPlayCombination,
  cardKey,
  detectCombination,
  sortHand,
} from '@poker-tempel/shared';

export function chooseBotMove(game, seat) {
  const hand = sortHand(game.players[seat].hand);
  if (hand.length === 0) return null;

  const active = game.activePlay?.combination ?? null;
  if (!active) {
    return { type: 'play', cards: [cardKey(hand[0])] };
  }

  for (const card of hand) {
    const combination = detectCombination([card]);
    if (canPlayCombination(combination, active)) {
      return { type: 'play', cards: [cardKey(card)] };
    }
  }

  return { type: 'pass' };
}
