import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPlayCombination,
  cardKey,
  createGame,
  detectCombination,
  isLegalFinalPlay,
  parseCard,
  passTurn,
  playCards,
  sortHand,
  startTempelan,
  submitTempelanVote,
} from '../src/index.js';

const players = ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name }));

const cards = (keys) => keys.map(parseCard);

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

function game(hands, startingPlayerIndex = 0) {
  return createGame({
    players,
    hands: hands.map(cards),
    startingPlayerIndex,
  });
}

test('createGame deals 13 unique cards to four players', () => {
  const state = createGame({ players });

  assert.equal(state.players.length, 4);
  for (const player of state.players) {
    assert.equal(player.hand.length, 13);
    assert.equal(player.finished, false);
    assert.equal(player.placement, null);
  }

  const keys = state.players.flatMap((player) => player.hand.map(cardKey));
  assert.equal(new Set(keys).size, 52);
  assert.equal(state.turn, 0);
  assert.equal(state.activePlay, null);
  assert.deepEqual(state.placements, []);
  assert.equal(state.status, 'playing');
});

test('createGame rejects invalid setups', () => {
  assert.throws(() => createGame({ players: players.slice(0, 3) }));

  assert.throws(() =>
    createGame({
      players,
      hands: [cards(['3S']), cards(['3S']), cards(['4S']), cards(['5S'])],
    }),
  );
});

test('enforces turns, hand ownership, and valid combinations', () => {
  const state = game([
    ['3S', '5S', '7S'],
    ['4S', '6S', '8S'],
    ['9S', 'JS', 'KS'],
    ['10S', 'QS', 'AS'],
  ]);

  assert.equal(playCards(state, 1, ['4S']).error, 'Not your turn');
  assert.equal(passTurn(state, 0).error, 'You are leading; play cards');
  assert.equal(playCards(state, 0, ['4H']).error, 'Card not in hand');
  assert.equal(playCards(state, 0, ['3S', '7S']).error, 'Not a valid combination');

  const played = playCards(state, 0, ['3S']);
  assert.equal(played.ok, true);
  assert.equal(played.combination.type, 'single');
  assert.equal(state.turn, 1);
  assert.equal(state.activePlay.playerIndex, 0);

  const firstPlayLog = state.log.filter((entry) => entry.type === 'play').at(-1);
  assert.equal(firstPlayLog.isBomb, false);
  assert.equal(firstPlayLog.beaten, null);

  const state2 = game([
    ['3S', '5S', '7S'],
    ['4S', '6S', '8S'],
    ['9S', 'JS', 'KS'],
    ['10S', 'QS', 'AS'],
  ]);

  playCards(state2, 0, ['5S']);
  assert.equal(
    playCards(state2, 1, ['4S']).error,
    'Does not beat the current combination',
  );
  assert.equal(playCards(state2, 1, ['6S']).ok, true);
});

test('resets the trick after the other three players pass', () => {
  const state = game([
    ['3S', '5S', '7S'],
    ['4S', '6S', '8S'],
    ['9S', 'JS', 'KS'],
    ['10S', 'QS', 'AS'],
  ]);

  playCards(state, 0, ['3S']);
  playCards(state, 1, ['4S']);
  playCards(state, 2, ['9S']);
  playCards(state, 3, ['10S']);

  assert.equal(passTurn(state, 0).ok, true);
  assert.equal(passTurn(state, 1).ok, true);
  const lastPass = passTurn(state, 2);

  assert.equal(lastPass.ok, true);
  assert.equal(lastPass.trickReset, true);
  assert.equal(state.activePlay, null);
  assert.equal(state.passedThisTrick.size, 0);
  assert.equal(state.turn, 3);

  assert.equal(playCards(state, 3, ['QS']).ok, true);
});

test('tracks finishing order and skips finished players', () => {
  const state = game([
    ['3S'],
    ['4S', '5S'],
    ['6S'],
    ['7S'],
  ]);

  const first = playCards(state, 0, ['3S']);
  assert.equal(first.finished, true);
  assert.equal(first.placement, 1);
  assert.equal(state.turn, 1);

  const second = playCards(state, 1, ['4S']);
  assert.equal(second.finished, false);

  const third = playCards(state, 2, ['6S']);
  assert.equal(third.finished, true);
  assert.equal(third.placement, 2);

  const fourth = playCards(state, 3, ['7S']);
  assert.equal(fourth.finished, true);
  assert.equal(fourth.placement, 3);
  assert.equal(state.turn, 1);

  assert.equal(passTurn(state, 1).ok, true);
  assert.equal(state.activePlay, null);
  assert.equal(state.turn, 1);

  const last = playCards(state, 1, ['5S']);
  assert.equal(last.ok, true);
  assert.equal(last.placement, 4);
  assert.equal(last.gameOver, true);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.placements, [0, 2, 3, 1]);
  assert.deepEqual(
    state.players.map((player) => player.placement),
    [1, 4, 2, 3],
  );
});

test('a bomb starts a bomb battle and the last bomber loses', () => {
  const state = game([
    ['2S', '3S'],
    ['5S', '5H', '5D', '5C'],
    ['7S'],
    ['8S'],
  ]);

  assert.equal(playCards(state, 0, ['2S']).ok, true);

  const bomb = playCards(state, 1, ['5S', '5H', '5D', '5C']);
  assert.equal(bomb.ok, true);
  assert.equal(bomb.finished, true);
  assert.equal(bomb.placement, 1);
  assert.equal(state.turn, 2);
  assert.equal(state.bombBattle.bombs.length, 1);
  assert.equal(state.bombBattle.loser, null);

  const bombLog = state.log.filter((entry) => entry.type === 'play').at(-1);
  assert.equal(bombLog.isBomb, true);
  assert.equal(bombLog.beaten.type, 'single');
  assert.equal(bombLog.beaten.primaryRank, '2');
  assert.equal(typeof bombLog.at, 'number');
  assert.equal(state.bombPlayed, true);

  assert.equal(
    playCards(state, 2, ['7S']).error,
    'Does not beat the current combination',
  );

  assert.equal(passTurn(state, 2).ok, true);
  assert.equal(passTurn(state, 3).ok, true);
  const lastPass = passTurn(state, 0);

  assert.equal(lastPass.ok, true);
  assert.equal(lastPass.bombEnd, true);
  assert.equal(lastPass.loser, 1);
  assert.equal(state.status, 'bomb-end');
  assert.equal(state.bombBattle.loser, 1);
  assert.equal(state.turn, null);
  assert.ok(state.log.some((entry) => entry.type === 'bomb-battle-end'));
  assert.equal(playCards(state, 2, ['7S']).error, 'Game is not in progress');
});

test('a higher bomb continues the battle and becomes the loser', () => {
  const state = game([
    ['2S', '3C'],
    ['5S', '5H', '5D', '5C', '6C'],
    ['7S', '7H', '7D', '7C', '8C'],
    ['9S', '10S'],
  ]);

  assert.equal(playCards(state, 0, ['2S']).ok, true);
  assert.equal(playCards(state, 1, ['5S', '5H', '5D', '5C']).ok, true);
  assert.equal(playCards(state, 2, ['7S', '7H', '7D', '7C']).ok, true);

  assert.equal(passTurn(state, 3).ok, true);
  assert.equal(passTurn(state, 0).ok, true);
  const lastPass = passTurn(state, 1);

  assert.equal(lastPass.bombEnd, true);
  assert.equal(lastPass.loser, 2);
  assert.equal(state.status, 'bomb-end');
  assert.equal(state.bombBattle.bombs.length, 2);
  assert.deepEqual(
    state.bombBattle.bombs.map((entry) => entry.playerIndex),
    [1, 2],
  );
});

test('rejects leading with a bomb', () => {
  const state = game([
    ['3S', '3H', '3D', '3C'],
    ['4S', '5S'],
    ['6S'],
    ['7S'],
  ]);

  assert.equal(
    playCards(state, 0, ['3S', '3H', '3D', '3C']).error,
    'Bombs cannot be led',
  );
  assert.equal(state.turn, 0);
});

test('a full game of singles reaches a complete finish order', () => {
  const state = createGame({ players, rng: seededRng(123) });
  let guard = 0;

  while (state.status === 'playing' && guard < 2000) {
    guard += 1;
    const index = state.turn;
    const active = state.activePlay?.combination ?? null;
    const sorted = sortHand(state.players[index].hand);

    const playable = sorted.filter((card) => {
      const combination = detectCombination([card]);
      if (!canPlayCombination(combination, active)) return false;
      if (sorted.length === 1 && !isLegalFinalPlay(combination)) return false;
      return true;
    });

    if (playable.length > 0) {
      const two = playable.find((card) => card.rank === '2');
      const choice = sorted.length > 1 && two ? two : playable[0];

      const result = playCards(state, index, [cardKey(choice)]);
      assert.equal(result.ok, true);
    } else {
      const result = passTurn(state, index);
      assert.equal(result.ok, true);
    }
  }

  assert.equal(guard < 2000, true);
  assert.equal(state.status, 'finished');
  assert.equal(state.placements.length, 4);
  assert.deepEqual(
    [...state.placements].sort((a, b) => a - b),
    [0, 1, 2, 3],
  );

  for (const player of state.players) {
    assert.equal(player.finished, true);
    assert.equal(player.hand.length, 0);
  }
});

test('validates tempelan main and attached hands', () => {
  const base = () =>
    game([
      ['QS', '4H', '7D'],
      ['5S'],
      ['6S'],
      ['8S'],
    ]);

  assert.equal(startTempelan(base(), 1, ['5S'], ['6S']).error, 'Not your turn');
  assert.equal(startTempelan(base(), 0, ['QS'], ['QS']).error, 'Duplicate cards selected');
  assert.equal(
    startTempelan(base(), 0, ['QS', '4H'], ['7D']).error,
    'Main hand is not a valid combination',
  );
  assert.equal(
    startTempelan(base(), 0, ['QS'], ['4H', '7D']).error,
    'Tempelan hand is not a valid combination',
  );
  assert.equal(startTempelan(base(), 0, ['9C'], ['4H']).error, 'Card not in hand');

  const bombAttached = game([
    ['QS', '5S', '5H', '5D', '5C'],
    ['6S'],
    ['7S'],
    ['8S'],
  ]);
  assert.equal(
    startTempelan(bombAttached, 0, ['QS'], ['5S', '5H', '5D', '5C']).error,
    'Bombs cannot be tempeled',
  );

  const bombLead = game([
    ['5S', '5H', '5D', '5C', 'QS'],
    ['6S'],
    ['7S'],
    ['8S'],
  ]);
  assert.equal(
    startTempelan(bombLead, 0, ['5S', '5H', '5D', '5C'], ['QS']).error,
    'Bombs cannot be used in a tempelan',
  );

  const cannotBeat = game([
    ['5S'],
    ['6S', '3H'],
    ['7S'],
    ['8S'],
  ]);
  playCards(cannotBeat, 0, ['5S']);
  assert.equal(
    startTempelan(cannotBeat, 1, ['3H'], ['6S']).error,
    'Main hand does not beat the current combination',
  );

  const started = startTempelan(base(), 0, ['QS'], ['7D']);
  const state = base();
  const pending = startTempelan(state, 0, ['QS'], ['7D']);

  assert.equal(started.ok, true);
  assert.equal(pending.ok, true);
  assert.equal(pending.resolved, false);
  assert.deepEqual(state.players[0].hand.map(cardKey), ['4H']);
  assert.deepEqual(state.pendingTempelan.voters, [1, 2, 3]);
  assert.deepEqual(state.pendingTempelan.main.cards, ['QS']);
  assert.deepEqual(state.pendingTempelan.attached.cards, ['7D']);
  assert.equal(state.turn, 0);
  assert.equal(playCards(state, 0, ['4H']).error, 'A tempelan vote is in progress');
  assert.equal(passTurn(state, 0).error, 'A tempelan vote is in progress');
});

test('accepting a tempelan makes the attached hand the target', () => {
  const state = game([
    ['QS', '4H', '7D'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);

  startTempelan(state, 0, ['QS'], ['4H']);

  assert.equal(submitTempelanVote(state, 0, true).error, 'You cannot vote on this tempelan');
  assert.equal(submitTempelanVote(state, 1, true).resolved, false);
  assert.equal(submitTempelanVote(state, 1, true).error, 'You already voted');
  assert.equal(submitTempelanVote(state, 2, true).resolved, false);

  const resolved = submitTempelanVote(state, 3, true);

  assert.equal(resolved.resolved, true);
  assert.equal(resolved.accepted, true);
  assert.equal(state.pendingTempelan, null);
  assert.equal(state.activePlay.combination.type, 'single');
  assert.equal(state.activePlay.combination.primaryRank, '4');
  assert.equal(state.activePlay.tempelan.accepted, true);
  assert.equal(state.activePlay.tempelan.main.cards[0], 'QS');
  assert.equal(state.turn, 1);
  assert.deepEqual(state.players[0].hand.map(cardKey), ['7D']);
  assert.ok(state.log.some((entry) => entry.type === 'tempelan-accepted'));

  const playLog = state.log.filter((entry) => entry.type === 'play').at(-1);
  assert.deepEqual(playLog.cards, ['4H']);
  assert.equal(playLog.tempelan.accepted, true);
});

test('rejecting a tempelan returns only the attached hand', () => {
  const state = game([
    ['QS', '4H', '7D'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);

  startTempelan(state, 0, ['QS'], ['4H']);
  const resolved = submitTempelanVote(state, 1, false);

  assert.equal(resolved.resolved, true);
  assert.equal(resolved.accepted, false);
  assert.equal(state.pendingTempelan, null);
  assert.equal(state.activePlay.combination.primaryRank, 'Q');
  assert.equal(state.activePlay.tempelan.accepted, false);
  assert.deepEqual(state.players[0].hand.map(cardKey), ['4H', '7D']);
  assert.equal(state.turn, 1);
  assert.ok(state.log.some((entry) => entry.type === 'tempelan-rejected'));
});

test('a tempelan finishes the player only when accepted', () => {
  const rejected = game([
    ['QS', '4H'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  startTempelan(rejected, 0, ['QS'], ['4H']);
  submitTempelanVote(rejected, 1, false);

  assert.equal(rejected.players[0].finished, false);
  assert.equal(rejected.players[0].placement, null);
  assert.deepEqual(rejected.players[0].hand.map(cardKey), ['4H']);
  assert.equal(rejected.activePlay.combination.primaryRank, 'Q');

  const accepted = game([
    ['QS', '4H'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  startTempelan(accepted, 0, ['QS'], ['4H']);
  submitTempelanVote(accepted, 1, true);
  submitTempelanVote(accepted, 2, true);
  submitTempelanVote(accepted, 3, true);

  assert.equal(accepted.players[0].finished, true);
  assert.equal(accepted.players[0].placement, 1);
  assert.equal(accepted.status, 'playing');
  assert.equal(accepted.activePlay.combination.primaryRank, '4');
  assert.equal(accepted.turn, 1);
});

test('finished players cannot vote on a tempelan', () => {
  const state = game([
    ['3S'],
    ['5S', '4H', '6D'],
    ['7S', '9S'],
    ['8S', '10S'],
  ]);

  playCards(state, 0, ['3S']);

  const started = startTempelan(state, 1, ['5S'], ['4H']);

  assert.equal(started.ok, true);
  assert.deepEqual(state.pendingTempelan.voters, [2, 3]);
  assert.equal(submitTempelanVote(state, 0, true).error, 'You cannot vote on this tempelan');

  assert.equal(submitTempelanVote(state, 2, true).resolved, false);
  const resolved = submitTempelanVote(state, 3, true);

  assert.equal(resolved.accepted, true);
  assert.equal(state.turn, 2);
  assert.deepEqual(state.players[1].hand.map(cardKey), ['6D']);
});

test('bombs cannot be used as a tempelan main hand', () => {
  const state = game([
    ['2S', '3C'],
    ['5S', '5H', '5D', '5C', '6D'],
    ['7S'],
    ['8S'],
  ]);

  assert.equal(playCards(state, 0, ['2S']).ok, true);
  assert.equal(state.activePlay.combination.primaryRank, '2');

  assert.equal(
    startTempelan(state, 1, ['5S', '5H', '5D', '5C'], ['6D']).error,
    'Bombs cannot be used in a tempelan',
  );
});

test('cannot finish with a 2 unless it is part of a sequence', () => {
  const single = game([
    ['2S'],
    ['3S'],
    ['4S'],
    ['5S'],
  ]);
  assert.equal(
    playCards(single, 0, ['2S']).error,
    'Cannot finish with a 2 unless it is part of a sequence',
  );

  const pair = game([
    ['2S', '2H'],
    ['3S'],
    ['4S'],
    ['5S'],
  ]);
  assert.equal(
    playCards(pair, 0, ['2S', '2H']).error,
    'Cannot finish with a 2 unless it is part of a sequence',
  );

  const nonFinal = game([
    ['2S', '3H'],
    ['4S'],
    ['5S'],
    ['6S'],
  ]);
  assert.equal(playCards(nonFinal, 0, ['2S']).ok, true);
  assert.equal(nonFinal.players[0].finished, false);

  const seri = game([
    ['2S', '3S', '4S'],
    ['5S', '5H'],
    ['6S'],
    ['7S'],
  ]);
  assert.equal(playCards(seri, 0, ['2S', '3S', '4S']).ok, true);
  assert.equal(seri.players[0].finished, true);

  const poloSeri = game([
    ['2S', '3S', '4S', '5H', '5D'],
    ['6S'],
    ['7S'],
    ['8S'],
  ]);
  assert.equal(playCards(poloSeri, 0, ['2S', '3S', '4S', '5H', '5D']).ok, true);
  assert.equal(poloSeri.players[0].finished, true);

  const poloPairTwos = game([
    ['3S', '3H', '3D', '2S', '2H'],
    ['4S'],
    ['5S'],
    ['6S'],
  ]);
  assert.equal(
    playCards(poloPairTwos, 0, ['3S', '3H', '3D', '2S', '2H']).error,
    'Cannot finish with a 2 unless it is part of a sequence',
  );

  const straightFlush = game(
    [
      ['2S', '3S', '4S', '5S', '6S'],
      ['8S'],
      ['9S'],
      ['2H', '7C'],
    ],
    3,
  );
  assert.equal(playCards(straightFlush, 3, ['2H']).ok, true);
  assert.equal(playCards(straightFlush, 0, ['2S', '3S', '4S', '5S', '6S']).ok, true);
  assert.equal(straightFlush.players[0].finished, true);
});

test('tempelan cannot finish with a high 2', () => {
  const finalState = game([
    ['QS', '2H'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  assert.equal(
    startTempelan(finalState, 0, ['QS'], ['2H']).error,
    'Cannot finish with a 2 unless it is part of a sequence',
  );

  const legalSeri = game([
    ['QS', '2S', '3S', '4S'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  assert.equal(startTempelan(legalSeri, 0, ['QS'], ['2S', '3S', '4S']).ok, true);

  const notFinal = game([
    ['QS', '2H', '7D'],
    ['5S'],
    ['6S'],
    ['8S'],
  ]);
  assert.equal(startTempelan(notFinal, 0, ['QS'], ['2H']).ok, true);
});

test('a tempelan with no other active players auto-accepts', () => {
  const state = game([
    ['3S'],
    ['5S', '4H'],
    ['6S'],
    ['7S'],
  ]);

  state.players[0].finished = true;
  state.players[0].placement = 1;
  state.players[2].finished = true;
  state.players[2].placement = 2;
  state.players[3].finished = true;
  state.players[3].placement = 3;
  state.placements = [0, 2, 3];
  state.turn = 1;

  const result = startTempelan(state, 1, ['5S'], ['4H']);

  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);
  assert.equal(result.accepted, true);
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.placements, [0, 2, 3, 1]);
  assert.equal(state.players[1].placement, 4);
});
