import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGame,
  parseCard,
  passTurn,
  playCards,
  startTempelan,
  submitTempelanVote,
} from '@poker-tempel/shared';
import { chooseBotMove, chooseBotVote } from '../src/bot.js';

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

test('bot votes based on the attached hand compared with the main hand', () => {
  const accept = game([
    ['QS', '4H', '7D'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  startTempelan(accept, 0, ['QS'], ['4H']);
  assert.equal(chooseBotVote(accept, 1), true);

  submitTempelanVote(accept, 1, true);
  assert.equal(chooseBotVote(accept, 1), null);

  const reject = game([
    ['4H', 'QS', '7D'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  startTempelan(reject, 0, ['4H'], ['QS']);
  assert.equal(chooseBotVote(reject, 1), false);
});

test('bot leads its lowest pair or triple instead of a single', () => {
  const pairState = game([
    ['3S', '3H', '5D'],
    ['4S'],
    ['6S'],
    ['7S'],
  ]);
  assert.deepEqual(chooseBotMove(pairState, 0), {
    type: 'play',
    cards: ['3S', '3H'],
  });

  const tripleState = game([
    ['4S', '4H', '4D', '7C'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  assert.deepEqual(chooseBotMove(tripleState, 0), {
    type: 'play',
    cards: ['4S', '4H', '4D'],
  });
});

test('bot responds with the lowest matching combination', () => {
  const pairState = game([
    ['5S', '5H'],
    ['6S', '6H', '9C'],
    ['7S'],
    ['8S'],
  ]);
  playCards(pairState, 0, ['5S', '5H']);
  assert.deepEqual(chooseBotMove(pairState, 1), {
    type: 'play',
    cards: ['6S', '6H'],
  });

  const seriState = game([
    ['3S', '4S', '5S'],
    ['6S', '7S', '8S', '4H', '5H', '6H'],
    ['9C'],
    ['10C'],
  ]);
  playCards(seriState, 0, ['3S', '4S', '5S']);
  assert.deepEqual(chooseBotMove(seriState, 1), {
    type: 'play',
    cards: ['6S', '7S', '8S'],
  });

  const poloState = game([
    ['3S', '3H', '3D', '4S', '4H'],
    ['5S', '5H', '5D', '6S', '6H'],
    ['7S'],
    ['8S'],
  ]);
  playCards(poloState, 0, ['3S', '3H', '3D', '4S', '4H']);
  assert.deepEqual(chooseBotMove(poloState, 1), {
    type: 'play',
    cards: ['5S', '5H', '5D', '6S', '6H'],
  });

  const flushState = game([
    ['2S'],
    ['3H', '4H', '5H', '6H', '7H'],
    ['4S', '5S', '6S', '7S', '8S'],
    ['9C'],
  ]);
  assert.equal(playCards(flushState, 0, ['2S']).ok, true);
  assert.equal(playCards(flushState, 1, ['3H', '4H', '5H', '6H', '7H']).ok, true);
  assert.deepEqual(chooseBotMove(flushState, 2), {
    type: 'play',
    cards: ['4S', '5S', '6S', '7S', '8S'],
  });
});

test('bot bombs a single 2 only on a coin flip', () => {
  const state = game([
    ['2S'],
    ['5S', '5H', '5D', '5C', '7C'],
    ['8S'],
    ['9S'],
  ]);
  playCards(state, 0, ['2S']);

  assert.deepEqual(chooseBotMove(state, 1, { random: () => 0.1 }), {
    type: 'play',
    cards: ['5S', '5H', '5D', '5C'],
  });
  assert.deepEqual(chooseBotMove(state, 1, { random: () => 0.9 }), { type: 'pass' });

  const noBomb = game([
    ['2S'],
    ['5S', '4H'],
    ['8S'],
    ['9S'],
  ]);
  playCards(noBomb, 0, ['2S']);
  assert.deepEqual(chooseBotMove(noBomb, 1, { random: () => 0.1 }), { type: 'pass' });
});

test('bot chains a higher bomb when the table is a bomb', () => {
  const state = game([
    ['2S'],
    ['5S', '5H', '5D', '5C', '6C'],
    ['7S', '7H', '7D', '7C', '9C'],
    ['8S'],
  ]);

  playCards(state, 0, ['2S']);
  playCards(state, 1, ['5S', '5H', '5D', '5C']);

  assert.deepEqual(chooseBotMove(state, 2), {
    type: 'play',
    cards: ['7S', '7H', '7D', '7C'],
  });
});

test('bot never leads with a bomb', () => {
  const state = game([
    ['3S', '5S', '5H', '5D', '5C'],
    ['4S'],
    ['6S'],
    ['7S'],
  ]);

  assert.deepEqual(chooseBotMove(state, 0), { type: 'play', cards: ['3S'] });
});

test('four bots can finish a full game', () => {
  const state = createGame({ players });
  let guard = 0;

  while (state.status === 'playing' && guard < 1000) {
    guard += 1;
    const seat = state.turn;
    const move = chooseBotMove(state, seat, { random: () => 0.9 });
    assert.ok(move);

    const result =
      move.type === 'play'
        ? playCards(state, seat, move.cards)
        : passTurn(state, seat);
    assert.equal(result.ok, true);
  }

  assert.equal(guard < 1000, true);
  assert.equal(state.status, 'finished');
  assert.equal(state.placements.length, 4);
  assert.deepEqual(
    [...state.placements].sort((a, b) => a - b),
    [0, 1, 2, 3],
  );
});
