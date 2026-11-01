import { cardKey, createDeck, deal, shuffle } from './cards.js';
import {
  PLAYER_COUNT,
  createGame,
  passTurn,
  playCards,
  resolvePendingTempelan,
  startTempelan,
  submitTempelanVote,
} from './game.js';

export const SESSION_STATUS = Object.freeze({
  LOBBY: 'lobby',
  DEALING: 'dealing',
  PLAYING: 'playing',
  ROUND_END: 'round-end',
  GAME_END: 'game-end',
});

export const DEFAULT_SCORE_TABLE = Object.freeze({ 1: 3, 2: 2, 3: 1, 4: 0 });

function fail(error) {
  return { ok: false, error };
}

export function createSession({ players, scoreTable = DEFAULT_SCORE_TABLE, maxRounds = null } = {}) {
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) {
    throw new Error(`Poker Tempel requires exactly ${PLAYER_COUNT} players`);
  }

  const ids = players.map((player, index) => player?.id ?? `player-${index}`);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Player ids must be unique');
  }
  if (maxRounds !== null && (!Number.isInteger(maxRounds) || maxRounds < 1)) {
    throw new Error('maxRounds must be a positive integer or null');
  }

  return {
    status: SESSION_STATUS.LOBBY,
    round: 0,
    maxRounds,
    scoreTable: { ...DEFAULT_SCORE_TABLE, ...scoreTable },
    players: players.map((player, index) => ({
      id: ids[index],
      name: player?.name ?? `Player ${index + 1}`,
      isBot: Boolean(player?.isBot),
      score: 0,
      wins: 0,
      bombLosses: 0,
      placements: [],
    })),
    currentGame: null,
    lastRoundResult: null,
    lastSelfBomb: null,
    lastBombResult: null,
  };
}

function completeRound(session) {
  const placements = [...session.currentGame.placements];
  const points = {};

  placements.forEach((seatIndex, index) => {
    const placement = index + 1;
    const player = session.players[seatIndex];
    const awarded = session.scoreTable[placement] ?? 0;

    player.placements.push(placement);
    player.score += awarded;
    if (placement === 1) player.wins += 1;
    points[seatIndex] = awarded;
  });

  session.lastRoundResult = {
    round: session.round,
    placements,
    points,
    bombPlayed: Boolean(session.currentGame.bombPlayed),
  };

  session.status =
    session.maxRounds !== null && session.round >= session.maxRounds
      ? SESSION_STATUS.GAME_END
      : SESSION_STATUS.ROUND_END;
}

export function startSession(session, { rng = Math.random } = {}) {
  if (session.status !== SESSION_STATUS.LOBBY) {
    return fail('Session has already started');
  }
  return startNextRound(session, { rng });
}

export function startNextRound(
  session,
  { rng = Math.random, forceOpening = false, openingReason = null } = {},
) {
  const canStart =
    session.status === SESSION_STATUS.LOBBY ||
    session.status === SESSION_STATUS.ROUND_END ||
    (forceOpening && session.status === SESSION_STATUS.PLAYING);

  if (!canStart) {
    return fail('Cannot start a round right now');
  }
  if (session.maxRounds !== null && session.round >= session.maxRounds) {
    return fail('All rounds are complete');
  }

  session.round += 1;
  session.status = SESSION_STATUS.DEALING;

  const hands = deal(shuffle(createDeck(), rng), PLAYER_COUNT, 13);
  const bombReset = Boolean(session.lastRoundResult?.bombPlayed);
  const openingNeeded = session.round === 1 || forceOpening || bombReset;
  let startingPlayerIndex;
  let opening = null;

  if (openingNeeded) {
    startingPlayerIndex = hands.findIndex((hand) =>
      hand.some((card) => card.rank === '3' && card.suit === 'S'),
    );
    if (startingPlayerIndex === -1) {
      throw new Error('Deal did not contain the 3 of spades');
    }

    opening = {
      leader: startingPlayerIndex,
      discards: hands.map((hand, playerIndex) => ({
        playerIndex,
        cards: hand.filter((card) => card.rank === '3').map(cardKey),
      })),
      reason:
        openingReason ??
        (session.round === 1 ? 'first-round' : forceOpening ? 'self-bomb' : 'bomb'),
    };
  } else {
    startingPlayerIndex = session.lastRoundResult.placements[0];
  }

  const preparedHands = opening
    ? hands.map((hand) => hand.filter((card) => card.rank !== '3'))
    : hands;

  const game = createGame({
    players: session.players,
    hands: preparedHands,
    startingPlayerIndex,
  });

  if (opening) {
    game.log.push({
      type: 'opening-threes',
      at: Date.now(),
      leader: opening.leader,
      discards: opening.discards,
      message: 'Opening: everyone reveals their 3s',
    });
  }

  session.currentGame = game;
  session.status = SESSION_STATUS.PLAYING;

  return { ok: true, game, opening };
}

export function resetRoundAfterSelfBomb(
  session,
  { playerIndex, cards = [], rng = Math.random } = {},
) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  const oldGame = session.currentGame;
  const playerName = oldGame?.players[playerIndex]?.name ?? `Player ${playerIndex + 1}`;
  const at = Date.now();
  const started = startNextRound(session, {
    rng,
    forceOpening: true,
    openingReason: 'self-bomb',
  });
  if (!started.ok) return started;

  const event = {
    type: 'self-bomb',
    at,
    playerIndex,
    playerName,
    cards: [...cards],
    message: `${playerName}'s last card was a 2 — self bomb!`,
  };

  started.game.log.unshift(event);
  session.lastSelfBomb = event;

  return { ...started, selfBomb: event };
}

export function resetRoundAfterBombBattle(
  session,
  { loserSeat, bombs = [], rng = Math.random } = {},
) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  const oldGame = session.currentGame;
  const loser = session.players[loserSeat];
  const playerName =
    oldGame?.players[loserSeat]?.name ?? loser?.name ?? `Player ${loserSeat + 1}`;
  const at = Date.now();

  const started = startNextRound(session, {
    rng,
    forceOpening: true,
    openingReason: 'bomb-battle',
  });
  if (!started.ok) return started;

  const event = {
    type: 'bomb-battle',
    at,
    loserSeat,
    playerName,
    bombs: bombs.map((bomb) => ({ ...bomb, cards: [...bomb.cards] })),
    message: `${playerName} lost the bomb battle with the last bomb!`,
  };

  started.game.log.unshift(event);
  if (loser) loser.bombLosses += 1;
  session.lastBombResult = event;

  return { ...started, bombBattle: event };
}

function finishAction(session, result) {
  if (!result.ok) {
    result.sessionStatus = session.status;
    return result;
  }

  if (session.currentGame.status === 'bomb-end') {
    result.bombEnd = true;
    result.sessionStatus = session.status;
    return result;
  }

  if (session.currentGame.status === 'finished') {
    completeRound(session);
    result.roundOver = true;
  }

  result.sessionStatus = session.status;
  return result;
}

export function play(session, playerIndex, cardKeys) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  return finishAction(session, playCards(session.currentGame, playerIndex, cardKeys));
}

export function pass(session, playerIndex) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  return finishAction(session, passTurn(session.currentGame, playerIndex));
}

export function playTempelan(session, playerIndex, mainCards, attachedCards) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  return finishAction(
    session,
    startTempelan(session.currentGame, playerIndex, mainCards, attachedCards),
  );
}

export function castTempelanVote(session, voterSeat, vote) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  return finishAction(session, submitTempelanVote(session.currentGame, voterSeat, vote));
}

export function resolveTempelanVote(session, accepted = false) {
  if (session.status !== SESSION_STATUS.PLAYING) {
    return fail('Round is not in progress');
  }

  return finishAction(session, resolvePendingTempelan(session.currentGame, accepted));
}

export function endSession(session) {
  if (session.status === SESSION_STATUS.GAME_END) {
    return fail('Session already ended');
  }
  if (session.status === SESSION_STATUS.PLAYING || session.status === SESSION_STATUS.DEALING) {
    return fail('Finish the current round first');
  }

  session.status = SESSION_STATUS.GAME_END;
  return { ok: true };
}

export function getStandings(session) {
  return session.players
    .map((player, seat) => ({ seat, ...player }))
    .sort((a, b) => b.score - a.score || b.wins - a.wins || a.seat - b.seat);
}
