import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RANKS,
  SUITS,
  cardKey,
  cardLabel,
  createDeck,
  deal,
  parseCard,
  shuffle,
  sortHand,
} from '../src/index.js';

function seededRng(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('createDeck builds 52 unique cards with 4 of each rank', () => {
  const deck = createDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(cardKey)).size, 52);

  for (const rank of RANKS) {
    assert.equal(deck.filter((card) => card.rank === rank).length, 4);
  }
  for (const suit of SUITS) {
    assert.equal(deck.filter((card) => card.suit === suit).length, 13);
  }
});

test('parseCard validates rank and suit', () => {
  assert.deepEqual(parseCard('10H'), { rank: '10', suit: 'H' });
  assert.deepEqual(parseCard('AS'), { rank: 'A', suit: 'S' });
  assert.deepEqual(parseCard('2C'), { rank: '2', suit: 'C' });

  assert.throws(() => parseCard('11S'));
  assert.throws(() => parseCard('3X'));
  assert.throws(() => parseCard(''));
  assert.throws(() => parseCard('H'));
});

test('cardKey and cardLabel round-trip a card', () => {
  const card = parseCard('10D');
  assert.equal(cardKey(card), '10D');
  assert.equal(cardLabel(card), '10♦');
});

test('sortHand orders 3 low, 2 high, then suit', () => {
  const cards = ['2S', '3H', '10D', 'AC', 'KS', '3S'].map(parseCard);
  assert.deepEqual(
    sortHand(cards).map(cardKey),
    ['3S', '3H', '10D', 'KS', 'AC', '2S'],
  );
});

test('shuffle preserves cards and does not mutate input', () => {
  const deck = createDeck();
  const shuffled = shuffle(deck, seededRng(42));
  assert.equal(shuffled.length, 52);
  assert.equal(new Set(shuffled.map(cardKey)).size, 52);
  assert.deepEqual(deck, createDeck());
});

test('deal gives 13 unique cards to each of 4 players', () => {
  const hands = deal(shuffle(createDeck(), seededRng(7)), 4, 13);
  assert.equal(hands.length, 4);
  for (const hand of hands) assert.equal(hand.length, 13);
  assert.equal(new Set(hands.flat().map(cardKey)).size, 52);
});
