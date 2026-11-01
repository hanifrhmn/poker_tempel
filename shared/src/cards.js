export const SUITS = ['S', 'H', 'D', 'C'];

export const SUIT_SYMBOLS = Object.freeze({
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
});

export const SUIT_NAMES = Object.freeze({
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
});

export const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

export const RANK_VALUE = Object.freeze(
  Object.fromEntries(RANKS.map((rank, index) => [rank, index + 3])),
);

export const SEQUENCE_VALUE = Object.freeze({ ...RANK_VALUE, '2': 2 });

const SUIT_ORDER = Object.freeze({ S: 0, H: 1, D: 2, C: 3 });

export function createDeck() {
  return RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })));
}

export function parseCard(key) {
  if (typeof key !== 'string' || key.length < 2) {
    throw new Error(`Invalid card: ${key}`);
  }
  const suit = key.slice(-1);
  const rank = key.slice(0, -1);
  if (!RANKS.includes(rank) || !SUITS.includes(suit)) {
    throw new Error(`Invalid card: ${key}`);
  }
  return { rank, suit };
}

export function cardKey(card) {
  return `${card.rank}${card.suit}`;
}

export function cardLabel(card) {
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

export function sortHand(cards) {
  return [...cards].sort(
    (a, b) =>
      RANK_VALUE[a.rank] - RANK_VALUE[b.rank] || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit],
  );
}

export function shuffle(cards, rng = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function deal(deck, playerCount = 4, handSize = 13) {
  if (deck.length < playerCount * handSize) {
    throw new Error('Not enough cards to deal');
  }
  const hands = Array.from({ length: playerCount }, () => []);
  for (let i = 0; i < playerCount * handSize; i += 1) {
    hands[i % playerCount].push(deck[i]);
  }
  return hands;
}
