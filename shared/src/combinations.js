import { RANK_VALUE, SEQUENCE_VALUE, SUITS, cardKey, sortHand } from './cards.js';

export const COMBINATION_TYPES = Object.freeze({
  SINGLE: 'single',
  PAIR: 'pair',
  TRIPLE: 'triple',
  SERI: 'seri',
  POLO: 'polo',
  POLO_SERI: 'poloSeri',
  FOUR_OF_A_KIND: 'fourOfAKind',
  STRAIGHT_FLUSH: 'straightFlush',
});

export const COMBINATION_LABELS = Object.freeze({
  single: 'Satuan',
  pair: 'Duaan',
  triple: 'Tigaan',
  seri: 'Seri',
  polo: 'Polo',
  poloSeri: 'Polo Seri',
  fourOfAKind: 'Four of a Kind',
  straightFlush: 'Straight Flush',
});

const BOMB_TYPES = new Set([COMBINATION_TYPES.FOUR_OF_A_KIND, COMBINATION_TYPES.STRAIGHT_FLUSH]);

function makeCombination(type, cards, primaryRank, primaryValue, suit = null, sequenceCards = null) {
  return {
    type,
    cards: sortHand(cards),
    primaryRank,
    primaryValue,
    suit,
    sequenceCards: sequenceCards ? sortHand(sequenceCards) : null,
  };
}

function rankGroups(cards) {
  const groups = new Map();
  for (const card of cards) {
    if (!groups.has(card.rank)) groups.set(card.rank, []);
    groups.get(card.rank).push(card);
  }
  return groups;
}

function sequenceInfo(cards) {
  if (cards.length < 2) return null;
  const suit = cards[0].suit;
  if (!SUITS.includes(suit) || cards.some((card) => card.suit !== suit)) return null;

  const values = cards.map((card) => SEQUENCE_VALUE[card.rank]).sort((a, b) => a - b);
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] !== values[i - 1] + 1) return null;
  }

  const topValue = values[values.length - 1];
  const topCard = cards.find((card) => SEQUENCE_VALUE[card.rank] === topValue);
  return { suit, topValue, topRank: topCard.rank };
}

function findPoloSeri(cards) {
  let best = null;

  for (let i = 0; i < cards.length - 2; i += 1) {
    for (let j = i + 1; j < cards.length - 1; j += 1) {
      for (let k = j + 1; k < cards.length; k += 1) {
        const straightCards = [cards[i], cards[j], cards[k]];
        const rest = cards.filter((_, index) => index !== i && index !== j && index !== k);
        if (rest.length !== 2 || rest[0].rank !== rest[1].rank) continue;

        const sequence = sequenceInfo(straightCards);
        if (!sequence) continue;

        const combination = makeCombination(
          COMBINATION_TYPES.POLO_SERI,
          cards,
          sequence.topRank,
          sequence.topValue,
          sequence.suit,
          straightCards,
        );
        if (!best || combination.primaryValue > best.primaryValue) {
          best = combination;
        }
      }
    }
  }

  return best;
}

export function detectCombination(cards) {
  if (!Array.isArray(cards) || cards.length === 0 || cards.length > 5) return null;

  const keys = cards.map(cardKey);
  if (new Set(keys).size !== keys.length) return null;

  const sorted = sortHand(cards);
  const groups = rankGroups(sorted);

  if (sorted.length === 1) {
    const card = sorted[0];
    return makeCombination(
      COMBINATION_TYPES.SINGLE,
      sorted,
      card.rank,
      RANK_VALUE[card.rank],
    );
  }

  if (sorted.length === 2) {
    if (groups.size !== 1) return null;
    return makeCombination(
      COMBINATION_TYPES.PAIR,
      sorted,
      sorted[0].rank,
      RANK_VALUE[sorted[0].rank],
    );
  }

  if (sorted.length === 3) {
    if (groups.size === 1) {
      return makeCombination(
        COMBINATION_TYPES.TRIPLE,
        sorted,
        sorted[0].rank,
        RANK_VALUE[sorted[0].rank],
      );
    }

    const sequence = sequenceInfo(sorted);
    if (sequence) {
      return makeCombination(
        COMBINATION_TYPES.SERI,
        sorted,
        sequence.topRank,
        sequence.topValue,
        sequence.suit,
        sorted,
      );
    }

    return null;
  }

  if (sorted.length === 4) {
    if (groups.size !== 1) return null;
    return makeCombination(
      COMBINATION_TYPES.FOUR_OF_A_KIND,
      sorted,
      sorted[0].rank,
      RANK_VALUE[sorted[0].rank],
    );
  }

  const straightFlush = sequenceInfo(sorted);
  if (straightFlush) {
    return makeCombination(
      COMBINATION_TYPES.STRAIGHT_FLUSH,
      sorted,
      straightFlush.topRank,
      straightFlush.topValue,
      straightFlush.suit,
      sorted,
    );
  }

  if (groups.size === 2) {
    const groupList = [...groups.values()];
    const triple = groupList.find((group) => group.length === 3);
    const pair = groupList.find((group) => group.length === 2);
    if (triple && pair) {
      return makeCombination(
        COMBINATION_TYPES.POLO,
        sorted,
        triple[0].rank,
        RANK_VALUE[triple[0].rank],
      );
    }
  }

  return findPoloSeri(sorted);
}

export function isBomb(combination) {
  return Boolean(combination) && BOMB_TYPES.has(combination.type);
}

export function beats(candidate, active) {
  if (!candidate || !active) return false;

  if (candidate.type === active.type) {
    if (candidate.type === COMBINATION_TYPES.SERI) {
      return candidate.suit === active.suit && candidate.primaryValue > active.primaryValue;
    }
    return candidate.primaryValue > active.primaryValue;
  }

  if (isBomb(candidate) && active.type === COMBINATION_TYPES.SINGLE && active.primaryRank === '2') {
    return true;
  }

  return false;
}

export function canPlayCombination(combination, active) {
  if (!combination) return false;
  if (!active) return !isBomb(combination);
  return beats(combination, active);
}

export function enumeratePlayableCombinations(hand, active = null) {
  const results = [];
  const cards = [...hand];
  const picked = [];

  const visit = (start) => {
    if (picked.length > 0) {
      const combination = detectCombination(picked);
      if (combination && canPlayCombination(combination, active)) {
        results.push(combination);
      }
    }

    if (picked.length === 5) return;

    for (let index = start; index < cards.length; index += 1) {
      picked.push(cards[index]);
      visit(index + 1);
      picked.pop();
    }
  };

  visit(0);
  return results;
}

export function isLegalFinalPlaySet(combinations) {
  const list = (combinations ?? []).filter(Boolean);
  const twos = list.flatMap((combination) => combination.cards).filter((card) => card.rank === '2');
  if (twos.length === 0) return true;

  const sequenceKeys = new Set();

  for (const combination of list) {
    if (
      combination.type === COMBINATION_TYPES.SERI ||
      combination.type === COMBINATION_TYPES.STRAIGHT_FLUSH
    ) {
      combination.cards
        .filter((card) => card.rank === '2')
        .forEach((card) => sequenceKeys.add(cardKey(card)));
    } else if (
      combination.type === COMBINATION_TYPES.POLO_SERI &&
      combination.sequenceCards
    ) {
      combination.sequenceCards
        .filter((card) => card.rank === '2')
        .forEach((card) => sequenceKeys.add(cardKey(card)));
    }
  }

  return twos.every((card) => sequenceKeys.has(cardKey(card)));
}

export function isLegalFinalPlay(combination) {
  return Boolean(combination) && isLegalFinalPlaySet([combination]);
}
