import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SCORE_TABLE,
  SESSION_STATUS,
  canPlayCombination,
  cardKey,
  createGame,
  createSession,
  detectCombination,
  endSession,
  getStandings,
  parseCard,
  pass,
  play,
  playTempelan,
  sortHand,
  startNextRound,
  startSession,
} from '../src/index.js';

const players = ['A', 'B', 'C', 'D'].map((name) => ({ id: name, name }));

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

function playRoundWithSingles(session) {
  let guard = 0;

  while (session.status === SESSION_STATUS.PLAYING && guard < 3000) {
    guard += 1;
    const game = session.currentGame;
    const index = game.turn;
    const active = game.activePlay?.combination ?? null;
    const sorted = sortHand(game.players[index].hand);

    let played = false;
    for (const card of sorted) {
      const combination = detectCombination([card]);
      if (!canPlayCombination(combination, active)) continue;

      const result = play(session, index, [cardKey(card)]);
      assert.equal(result.ok, true);
      played = true;
      break;
    }

    if (!played) {
      const result = pass(session, index);
      assert.equal(result.ok, true);
    }
  }

  assert.equal(guard < 3000, true);
}

test('createSession validates players and starts in the lobby', () => {
  const session = createSession({ players });

  assert.equal(session.status, SESSION_STATUS.LOBBY);
  assert.equal(session.round, 0);
  assert.equal(session.maxRounds, null);
  assert.equal(session.currentGame, null);
  assert.equal(session.lastRoundResult, null);
  assert.equal(session.players.length, 4);

  for (const player of session.players) {
    assert.equal(player.score, 0);
    assert.equal(player.wins, 0);
    assert.deepEqual(player.placements, []);
  }

  assert.throws(() => createSession({ players: players.slice(0, 3) }));
  assert.throws(() =>
    createSession({ players: [players[0], players[0], players[2], players[3]] }),
  );
  assert.throws(() => createSession({ players, maxRounds: 0 }));
});

test('round 1 discards every 3 and the 3S holder leads', () => {
  const session = createSession({ players });
  const started = startSession(session, { rng: seededRng(42) });

  assert.equal(started.ok, true);
  assert.equal(session.status, SESSION_STATUS.PLAYING);
  assert.equal(session.round, 1);

  const game = session.currentGame;
  const cardsInHands = game.players.flatMap((player) => player.hand);

  assert.ok(started.opening);
  assert.equal(started.opening.leader, game.turn);
  assert.deepEqual(
    started.opening.discards.flatMap((entry) => entry.cards).sort(),
    ['3C', '3D', '3H', '3S'],
  );

  assert.equal(cardsInHands.length, 48);
  assert.equal(cardsInHands.filter((card) => card.rank === '3').length, 0);
  assert.equal(new Set(cardsInHands.map(cardKey)).size, 48);

  const opening = game.log.find((entry) => entry.type === 'opening-threes');
  assert.ok(opening);
  assert.equal(opening.leader, game.turn);

  const discarded = opening.discards.flatMap((entry) => entry.cards);
  assert.equal(discarded.length, 4);
  assert.deepEqual([...discarded].sort(), ['3C', '3D', '3H', '3S']);
  assert.ok(opening.discards[opening.leader].cards.includes('3S'));

  for (const entry of opening.discards) {
    assert.equal(game.players[entry.playerIndex].hand.some((card) => card.rank === '3'), false);
  }
});

test('completing round 1 awards scores and records placements', () => {
  const session = createSession({ players });
  startSession(session, { rng: seededRng(7) });
  playRoundWithSingles(session);

  assert.equal(session.status, SESSION_STATUS.ROUND_END);
  assert.equal(session.currentGame.status, 'finished');
  assert.equal(session.lastRoundResult.round, 1);
  assert.equal(session.lastRoundResult.placements.length, 4);
  assert.deepEqual(
    [...session.lastRoundResult.placements].sort((a, b) => a - b),
    [0, 1, 2, 3],
  );

  session.lastRoundResult.placements.forEach((seat, index) => {
    const placement = index + 1;
    const player = session.players[seat];
    const awarded = DEFAULT_SCORE_TABLE[placement];

    assert.equal(player.placements[0], placement);
    assert.equal(player.score, awarded);
    assert.equal(session.lastRoundResult.points[seat], awarded);
  });

  const winnerSeat = session.lastRoundResult.placements[0];
  assert.equal(session.players[winnerSeat].wins, 1);
  for (const [index, player] of session.players.entries()) {
    if (index !== winnerSeat) assert.equal(player.wins, 0);
  }
});

test('round 2 deals a full deck and the previous winner leads', () => {
  const session = createSession({ players });
  startSession(session, { rng: seededRng(21) });
  playRoundWithSingles(session);

  const winnerSeat = session.lastRoundResult.placements[0];
  const started = startNextRound(session);

  assert.equal(started.ok, true);
  assert.equal(session.status, SESSION_STATUS.PLAYING);
  assert.equal(session.round, 2);
  assert.equal(session.currentGame.turn, winnerSeat);
  assert.equal(session.currentGame.log.some((entry) => entry.type === 'opening-threes'), false);

  const cardsInHands = session.currentGame.players.flatMap((player) => player.hand);
  assert.equal(cardsInHands.length, 52);
  assert.equal(new Set(cardsInHands.map(cardKey)).size, 52);
  for (const player of session.currentGame.players) {
    assert.equal(player.hand.length, 13);
  }

  playRoundWithSingles(session);

  assert.equal(session.status, SESSION_STATUS.ROUND_END);
  assert.equal(session.lastRoundResult.round, 2);
  for (const player of session.players) {
    assert.equal(player.placements.length, 2);
  }
  assert.equal(
    session.players.reduce((total, player) => total + player.score, 0),
    (3 + 2 + 1 + 0) * 2,
  );
});

test('maxRounds ends the session automatically', () => {
  const session = createSession({ players, maxRounds: 1 });
  startSession(session, { rng: seededRng(11) });
  playRoundWithSingles(session);

  assert.equal(session.status, SESSION_STATUS.GAME_END);
  assert.equal(startNextRound(session).error, 'Cannot start a round right now');
  assert.equal(endSession(session).error, 'Session already ended');
});

test('endSession ends a lobby or finished-round session but not mid-round', () => {
  const lobbySession = createSession({ players });
  assert.equal(endSession(lobbySession).ok, true);
  assert.equal(lobbySession.status, SESSION_STATUS.GAME_END);

  const session = createSession({ players });
  startSession(session, { rng: seededRng(5) });
  assert.equal(endSession(session).error, 'Finish the current round first');

  playRoundWithSingles(session);
  assert.equal(session.status, SESSION_STATUS.ROUND_END);
  assert.equal(endSession(session).ok, true);
  assert.equal(session.status, SESSION_STATUS.GAME_END);
});

test('rejects invalid session actions', () => {
  const session = createSession({ players });

  assert.equal(play(session, 0, ['3S']).error, 'Round is not in progress');
  assert.equal(pass(session, 0).error, 'Round is not in progress');

  startSession(session, { rng: seededRng(3) });

  assert.equal(startSession(session).error, 'Session has already started');
  assert.equal(startNextRound(session).error, 'Cannot start a round right now');

  const game = session.currentGame;
  const notTurn = (game.turn + 1) % 4;
  const card = cardKey(game.players[notTurn].hand[0]);
  assert.equal(play(session, notTurn, [card]).error, 'Not your turn');
});

test('standings rank players by points then wins', () => {
  const session = createSession({ players });
  startSession(session, { rng: seededRng(9) });
  playRoundWithSingles(session);

  const standings = getStandings(session);

  assert.equal(standings.length, 4);
  assert.equal(standings[0].seat, session.lastRoundResult.placements[0]);
  assert.equal(standings[0].wins, 1);

  for (let index = 1; index < standings.length; index += 1) {
    assert.ok(standings[index - 1].score >= standings[index].score);
  }
});

test('playTempelan completes the round when the last player finishes', () => {
  const session = createSession({ players });
  session.status = SESSION_STATUS.PLAYING;
  session.round = 1;

  const game = createGame({
    players,
    hands: [
      ['QS', '4H'],
      ['5S'],
      ['6S'],
      ['7S'],
    ].map((keys) => keys.map(parseCard)),
    startingPlayerIndex: 0,
  });

  game.players[1].finished = true;
  game.players[1].placement = 1;
  game.players[2].finished = true;
  game.players[2].placement = 2;
  game.players[3].finished = true;
  game.players[3].placement = 3;
  game.placements = [1, 2, 3];
  session.currentGame = game;

  const result = playTempelan(session, 0, ['QS'], ['4H']);

  assert.equal(result.ok, true);
  assert.equal(result.resolved, true);
  assert.equal(result.roundOver, true);
  assert.equal(session.status, SESSION_STATUS.ROUND_END);
  assert.deepEqual(session.lastRoundResult.placements, [1, 2, 3, 0]);
  assert.equal(session.players[0].placements[0], 4);
  assert.equal(session.players[0].score, DEFAULT_SCORE_TABLE[4]);
});
