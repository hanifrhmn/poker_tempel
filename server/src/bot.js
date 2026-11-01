import {
  cardKey,
  enumeratePlayableCombinations,
  isBomb,
  isLegalFinalPlay,
} from '@poker-tempel/shared';

function lowestCombination(candidates) {
  return candidates.reduce((best, candidate) => {
    if (candidate.primaryValue < best.primaryValue) return candidate;
    if (
      candidate.primaryValue === best.primaryValue &&
      candidate.cards.length > best.cards.length
    ) {
      return candidate;
    }
    return best;
  });
}

function lowestBomb(candidates) {
  return candidates.reduce((best, candidate) =>
    candidate.primaryValue < best.primaryValue ? candidate : best,
  );
}

export function chooseBotMove(game, seat, { random = Math.random } = {}) {
  const hand = game.players[seat].hand;
  if (hand.length === 0) return null;

  const active = game.activePlay?.combination ?? null;
  const playable = enumeratePlayableCombinations(hand, active).filter(
    (combination) =>
      hand.length !== combination.cards.length || isLegalFinalPlay(combination),
  );

  if (playable.length === 0) {
    return active ? { type: 'pass' } : null;
  }

  if (!active) {
    const choice = lowestCombination(playable);
    return { type: 'play', cards: choice.cards.map(cardKey) };
  }

  const bombs = playable.filter(isBomb);

  if (active.type === 'single' && active.primaryRank === '2') {
    if (bombs.length === 0) return { type: 'pass' };
    if (random() >= 0.5) return { type: 'pass' };

    const bomb = lowestBomb(bombs);
    return { type: 'play', cards: bomb.cards.map(cardKey) };
  }

  if (bombs.length === playable.length) {
    if (active.type === 'fourOfAKind' || active.type === 'straightFlush') {
      const bomb = lowestBomb(bombs);
      return { type: 'play', cards: bomb.cards.map(cardKey) };
    }
    return { type: 'pass' };
  }

  const choice = lowestCombination(playable.filter((candidate) => !isBomb(candidate)));
  return { type: 'play', cards: choice.cards.map(cardKey) };
}

export function chooseBotVote(game, voterSeat) {
  const pending = game.pendingTempelan;
  if (!pending) return true;
  if (pending.votes?.has(voterSeat)) return null;

  return pending.attached.combination.primaryValue <= pending.main.combination.primaryValue;
}
