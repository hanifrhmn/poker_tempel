import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, parseCard, playCards } from '@poker-tempel/shared';
import { chooseBotMove } from '../src/bot.js';

const players = ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name }));
const cards = (keys) => keys.map(parseCard);

function game(hands) {
  return createGame({ players, hands: hands.map(cards) });
}

test('bot leads with its lowest card', () => {
  const state = game([
    ['2S', '3H', '5D'],
    ['4S'],
    ['6S'],
    ['7S'],
  ]);

  assert.deepEqual(chooseBotMove(state, 0), { type: 'play', cards: ['3H'] });
});

test('bot plays the lowest single that beats the table', () => {
  const state = game([
    ['5S'],
    ['4S', '6S', '9H'],
    ['7S'],
    ['8S'],
  ]);

  playCards(state, 0, ['5S']);

  assert.deepEqual(chooseBotMove(state, 1), { type: 'play', cards: ['6S'] });
});

test('bot passes when nothing beats the table', () => {
  const state = game([
    ['5S'],
    ['4S', '3H'],
    ['7S'],
    ['8S'],
  ]);

  playCards(state, 0, ['5S']);

  assert.deepEqual(chooseBotMove(state, 1), { type: 'pass' });
});

test('bot returns null with an empty hand', () => {
  const state = game([
    ['5S'],
    ['4S'],
    ['7S'],
    ['8S'],
  ]);

  playCards(state, 0, ['5S']);
  state.players[0].hand = [];

  assert.equal(chooseBotMove(state, 0), null);
});
