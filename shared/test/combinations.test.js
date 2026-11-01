import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPlayCombination,
  detectCombination,
  parseCard,
  beats,
  isBomb,
} from '../src/index.js';

function hand(keys) {
  return keys.map(parseCard);
}

function combo(...keys) {
  return detectCombination(hand(keys));
}

test('detects basic combinations', () => {
  assert.equal(combo('3S').type, 'single');
  assert.equal(combo('3S', '3H').type, 'pair');
  assert.equal(combo('3S', '3H', '3D').type, 'triple');
  assert.equal(combo('3S', '3H', '3D', '3C').type, 'fourOfAKind');
  assert.equal(isBomb(combo('3S', '3H', '3D', '3C')), true);
});

test('detects valid seri and the 2-3-4 wrap', () => {
  const seri = combo('4S', '5S', '6S');
  assert.equal(seri.type, 'seri');
  assert.equal(seri.suit, 'S');
  assert.equal(seri.primaryRank, '6');
  assert.equal(seri.primaryValue, 6);

  const wrap = combo('2H', '3H', '4H');
  assert.equal(wrap.type, 'seri');
  assert.equal(wrap.primaryRank, '4');
  assert.equal(wrap.primaryValue, 4);

  const aceHigh = combo('QH', 'KH', 'AH');
  assert.equal(aceHigh.type, 'seri');
  assert.equal(aceHigh.primaryRank, 'A');
  assert.equal(aceHigh.primaryValue, 14);
});

test('rejects invalid seri', () => {
  assert.equal(combo('4S', '5S', '6H'), null);
  assert.equal(combo('KS', 'AH', '2S'), null);
  assert.equal(combo('3S', '4S', '5S', '6S'), null);
});

test('detects polo (full house)', () => {
  const polo = combo('9S', '9H', '9D', '4S', '4H');
  assert.equal(polo.type, 'polo');
  assert.equal(polo.primaryRank, '9');
  assert.equal(polo.primaryValue, 9);
});

test('detects polo seri with a free pair', () => {
  const poloSeri = combo('4S', '5S', '6S', '9H', '9D');
  assert.equal(poloSeri.type, 'poloSeri');
  assert.equal(poloSeri.primaryRank, '6');
  assert.equal(poloSeri.primaryValue, 6);

  const overlappingPair = combo('5S', '6S', '7S', '5H', '5D');
  assert.equal(overlappingPair.type, 'poloSeri');
  assert.equal(overlappingPair.primaryRank, '7');
});

test('detects straight flush including the 2-low wrap', () => {
  const low = combo('2S', '3S', '4S', '5S', '6S');
  assert.equal(low.type, 'straightFlush');
  assert.equal(low.primaryRank, '6');
  assert.equal(low.primaryValue, 6);

  const aceHigh = combo('10H', 'JH', 'QH', 'KH', 'AH');
  assert.equal(aceHigh.type, 'straightFlush');
  assert.equal(aceHigh.primaryRank, 'A');
  assert.equal(aceHigh.primaryValue, 14);
});

test('rejects invalid five-card combinations', () => {
  assert.equal(combo('3S', '4H', '5D', '6C', '7S'), null);
  assert.equal(combo('3S', '3H', '4S', '4H', '5S'), null);
  assert.equal(combo('3S', '3H', '3D', '3C', '4S'), null);
  assert.equal(combo('4S', '5S', '6H', '9H', '9D'), null);
  assert.equal(combo('KS', 'AS', '2S', '3S', '4S'), null);
  assert.equal(combo('3S', '4S', '5S', '6S', '8S'), null);
});

test('rejects invalid input', () => {
  assert.equal(detectCombination([]), null);
  assert.equal(detectCombination(hand(['3S', '3S'])), null);
  assert.equal(
    detectCombination(hand(['3S', '4S', '5S', '6S', '7S', '8S'])),
    null,
  );
});

test('compares singles, pairs, triples, and polo by rank', () => {
  assert.equal(beats(combo('4S'), combo('3H')), true);
  assert.equal(beats(combo('3S'), combo('4H')), false);
  assert.equal(beats(combo('2S'), combo('AH')), true);
  assert.equal(beats(combo('AH'), combo('2S')), false);

  assert.equal(beats(combo('4S', '4H'), combo('3S', '3H')), true);
  assert.equal(beats(combo('4S', '4H', '4D'), combo('3S', '3H', '3D')), true);
  assert.equal(
    beats(combo('9S', '9H', '9D', '4S', '4H'), combo('8S', '8H', '8D', 'AH', 'AD')),
    true,
  );
});

test('seri must match suit and beat the top rank', () => {
  assert.equal(beats(combo('4S', '5S', '6S'), combo('3S', '4S', '5S')), true);
  assert.equal(beats(combo('3S', '4S', '5S'), combo('4S', '5S', '6S')), false);
  assert.equal(beats(combo('4H', '5H', '6H'), combo('3S', '4S', '5S')), false);
  assert.equal(beats(combo('2S', '3S', '4S'), combo('QH', 'KH', 'AH')), false);
});

test('polo seri is ranked by its three-card straight component', () => {
  assert.equal(
    beats(combo('5S', '6S', '7S', '3H', '3D'), combo('4S', '5S', '6S', '9H', '9D')),
    true,
  );
  assert.equal(
    beats(combo('5H', '6H', '7H', '3S', '3D'), combo('4S', '5S', '6S', '9H', '9D')),
    true,
  );
  assert.equal(
    beats(combo('4S', '5S', '6S', '9H', '9D'), combo('5H', '6H', '7H', '3S', '3D')),
    false,
  );
});

test('straight flush compares by top rank', () => {
  assert.equal(
    beats(combo('10H', 'JH', 'QH', 'KH', 'AH'), combo('2S', '3S', '4S', '5S', '6S')),
    true,
  );
  assert.equal(
    beats(combo('2H', '3H', '4H', '5H', '6H'), combo('2S', '3S', '4S', '5S', '6S')),
    false,
  );
  assert.equal(
    beats(combo('2S', '3S', '4S', '5S', '6S'), combo('10H', 'JH', 'QH', 'KH', 'AH')),
    false,
  );
});

test('bombs only beat a single 2 or a higher bomb of the same kind', () => {
  assert.equal(beats(combo('3S', '3H', '3D', '3C'), combo('2S')), true);
  assert.equal(beats(combo('2S', '3S', '4S', '5S', '6S'), combo('2H')), true);

  assert.equal(beats(combo('3S', '3H', '3D', '3C'), combo('AS')), false);
  assert.equal(beats(combo('3S', '3H', '3D', '3C'), combo('2S', '2H')), false);
  assert.equal(beats(combo('3S', '3H', '3D', '3C'), combo('2S', '2H', '2D')), false);
  assert.equal(
    beats(combo('3S', '3H', '3D', '3C'), combo('2S', '2H', '2D', '2C')),
    false,
  );

  assert.equal(
    beats(combo('4S', '4H', '4D', '4C'), combo('3S', '3H', '3D', '3C')),
    true,
  );
  assert.equal(
    beats(combo('3S', '3H', '3D', '3C'), combo('4S', '4H', '4D', '4C')),
    false,
  );

  assert.equal(
    beats(combo('2H', '3H', '4H', '5H', '6H'), combo('2S', '3S', '4S', '5S', '6S')),
    false,
  );
  assert.equal(
    beats(combo('10H', 'JH', 'QH', 'KH', 'AH'), combo('2S', '3S', '4S', '5S', '6S')),
    true,
  );
});

test('straight flush and four of a kind cannot beat each other', () => {
  const four = combo('3S', '3H', '3D', '3C');
  const straightFlush = combo('2S', '3S', '4S', '5S', '6S');
  assert.equal(beats(straightFlush, four), false);
  assert.equal(beats(four, straightFlush), false);
});

test('bombs cannot be led but other combinations can', () => {
  assert.equal(canPlayCombination(combo('3S', '3H', '3D', '3C'), null), false);
  assert.equal(canPlayCombination(combo('2S', '3S', '4S', '5S', '6S'), null), false);
  assert.equal(canPlayCombination(combo('3S'), null), true);
  assert.equal(canPlayCombination(combo('3S', '3H'), null), true);
  assert.equal(canPlayCombination(combo('3S', '3H', '3D'), null), true);
  assert.equal(canPlayCombination(combo('4S', '5S', '6S'), null), true);
  assert.equal(canPlayCombination(combo('9S', '9H', '9D', '4S', '4H'), null), true);
  assert.equal(canPlayCombination(combo('4S', '5S', '6S', '9H', '9D'), null), true);

  assert.equal(canPlayCombination(combo('3S', '3H', '3D', '3C'), combo('2H')), true);
  assert.equal(canPlayCombination(combo('3S', '3H', '3D', '3C'), combo('AH')), false);
});
