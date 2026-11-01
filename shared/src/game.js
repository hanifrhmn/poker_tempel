import { cardKey, createDeck, deal, parseCard, shuffle, sortHand } from './cards.js';
import { canPlayCombination, detectCombination } from './combinations.js';

export const PLAYER_COUNT = 4;

function fail(error) {
  return { ok: false, error };
}

function addLog(state, entry) {
  state.log.push({ ...entry, at: Date.now() });
}

function activeIndexes(state) {
  return state.players
    .map((player, index) => (player.finished ? null : index))
    .filter((index) => index !== null);
}

function nextActiveIndex(state, from) {
  for (let step = 1; step < state.players.length; step += 1) {
    const index = (from + step) % state.players.length;
    if (!state.players[index].finished) return index;
  }
  return null;
}

function maybeResetTrick(state) {
  if (!state.activePlay || state.status !== 'playing') return;

  const owner = state.activePlay.playerIndex;
  const others = activeIndexes(state).filter((index) => index !== owner);
  const allOthersPassed =
    others.length === 0 || others.every((index) => state.passedThisTrick.has(index));

  if (!allOthersPassed) return;

  const leader = state.players[owner].finished ? nextActiveIndex(state, owner) : owner;

  state.activePlay = null;
  state.passedThisTrick.clear();

  if (leader === null) {
    state.status = 'finished';
    state.turn = null;
  } else {
    state.turn = leader;
    addLog(state, {
      type: 'trick-reset',
      playerIndex: leader,
      message: `${state.players[leader].name} leads the next trick`,
    });
  }
}

export function createGame({ players, hands, startingPlayerIndex = 0, rng = Math.random } = {}) {
  if (!Array.isArray(players) || players.length !== PLAYER_COUNT) {
    throw new Error(`Poker Tempel requires exactly ${PLAYER_COUNT} players`);
  }
  if (
    !Number.isInteger(startingPlayerIndex) ||
    startingPlayerIndex < 0 ||
    startingPlayerIndex >= PLAYER_COUNT
  ) {
    throw new Error('startingPlayerIndex must be a valid seat index');
  }

  let dealtHands;
  if (hands) {
    if (!Array.isArray(hands) || hands.length !== PLAYER_COUNT) {
      throw new Error(`Hands must be provided for all ${PLAYER_COUNT} players`);
    }
    dealtHands = hands.map((hand) => {
      if (!Array.isArray(hand)) throw new Error('Each hand must be an array of cards');
      return sortHand(hand.map((card) => (typeof card === 'string' ? parseCard(card) : card)));
    });
  } else {
    dealtHands = deal(shuffle(createDeck(), rng), PLAYER_COUNT, 13);
  }

  const keys = dealtHands.flat().map(cardKey);
  if (new Set(keys).size !== keys.length) {
    throw new Error('Duplicate cards in hands');
  }

  const state = {
    players: players.map((player, index) => ({
      id: player?.id ?? `player-${index}`,
      name: player?.name ?? `Player ${index + 1}`,
      isBot: Boolean(player?.isBot),
      hand: dealtHands[index],
      finished: false,
      placement: null,
    })),
    turn: startingPlayerIndex,
    activePlay: null,
    passedThisTrick: new Set(),
    placements: [],
    status: 'playing',
    log: [],
  };

  addLog(state, {
    type: 'game-start',
    playerIndex: startingPlayerIndex,
    message: `${state.players[startingPlayerIndex].name} leads first`,
  });

  return state;
}

export function playCards(state, playerIndex, keys) {
  if (!state || state.status !== 'playing') return fail('Game is not in progress');
  if (!Number.isInteger(playerIndex) || !state.players[playerIndex]) return fail('Invalid player');
  if (state.turn !== playerIndex) return fail('Not your turn');
  if (!Array.isArray(keys) || keys.length === 0) return fail('No cards selected');
  if (new Set(keys).size !== keys.length) return fail('Duplicate cards selected');

  const player = state.players[playerIndex];
  const handByKey = new Map(player.hand.map((card) => [cardKey(card), card]));
  const cards = [];

  for (const key of keys) {
    const card = handByKey.get(key);
    if (!card) return fail('Card not in hand');
    cards.push(card);
  }

  const combination = detectCombination(cards);
  if (!combination) return fail('Not a valid combination');

  const active = state.activePlay?.combination ?? null;
  if (!canPlayCombination(combination, active)) {
    if (!active) return fail('Bombs cannot be led');
    return fail('Does not beat the current combination');
  }

  player.hand = player.hand.filter((card) => !keys.includes(cardKey(card)));
  state.activePlay = { playerIndex, combination };
  state.passedThisTrick.clear();

  addLog(state, {
    type: 'play',
    playerIndex,
    combinationType: combination.type,
    cards: cards.map(cardKey),
    message: `${player.name} played ${combination.type}`,
  });

  let finishedNow = false;
  if (player.hand.length === 0 && !player.finished) {
    player.finished = true;
    player.placement = state.placements.length + 1;
    state.placements.push(playerIndex);
    finishedNow = true;
    addLog(state, {
      type: 'finish',
      playerIndex,
      placement: player.placement,
      message: `${player.name} finished #${player.placement}`,
    });
  }

  if (activeIndexes(state).length === 0) {
    state.status = 'finished';
    state.turn = null;
    addLog(state, { type: 'game-over', message: 'Game over' });
    return {
      ok: true,
      combination,
      finished: finishedNow,
      placement: player.placement,
      gameOver: true,
    };
  }

  state.turn = nextActiveIndex(state, playerIndex) ?? playerIndex;
  maybeResetTrick(state);

  return {
    ok: true,
    combination,
    finished: finishedNow,
    placement: player.placement,
    gameOver: state.status === 'finished',
  };
}

export function passTurn(state, playerIndex) {
  if (!state || state.status !== 'playing') return fail('Game is not in progress');
  if (!Number.isInteger(playerIndex) || !state.players[playerIndex]) return fail('Invalid player');
  if (state.turn !== playerIndex) return fail('Not your turn');
  if (!state.activePlay) return fail('You are leading; play cards');

  const player = state.players[playerIndex];
  state.passedThisTrick.add(playerIndex);
  addLog(state, {
    type: 'pass',
    playerIndex,
    message: `${player.name} passed`,
  });

  maybeResetTrick(state);

  if (state.activePlay) {
    state.turn = nextActiveIndex(state, playerIndex) ?? playerIndex;
  }

  return {
    ok: true,
    trickReset: !state.activePlay,
    gameOver: state.status === 'finished',
  };
}
