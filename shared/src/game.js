import { cardKey, createDeck, deal, parseCard, shuffle, sortHand } from './cards.js';
import {
  canPlayCombination,
  detectCombination,
  isBomb,
  isLegalFinalPlay,
  isLegalFinalPlaySet,
} from './combinations.js';

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

function summarizeCombination(combination) {
  if (!combination) return null;
  return {
    type: combination.type,
    cards: combination.cards.map(cardKey),
    primaryRank: combination.primaryRank,
    primaryValue: combination.primaryValue,
    suit: combination.suit,
  };
}

function settlePlay(state, playerIndex, combination, logEntry, activeExtra = null) {
  state.activePlay = { playerIndex, combination, ...(activeExtra ?? {}) };
  state.passedThisTrick.clear();
  addLog(state, logEntry);

  const player = state.players[playerIndex];
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
    return { finished: finishedNow, placement: player.placement, gameOver: true };
  }

  state.turn = nextActiveIndex(state, playerIndex) ?? playerIndex;
  maybeResetTrick(state);

  return {
    finished: finishedNow,
    placement: player.placement,
    gameOver: state.status === 'finished',
  };
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
    pendingTempelan: null,
    bombPlayed: false,
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
  if (state.pendingTempelan) return fail('A tempelan vote is in progress');
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

  if (player.hand.length === cards.length && !isLegalFinalPlay(combination)) {
    return fail('Cannot finish with a 2 unless it is part of a sequence');
  }

  player.hand = player.hand.filter((card) => !keys.includes(cardKey(card)));
  if (isBomb(combination)) state.bombPlayed = true;

  const settled = settlePlay(state, playerIndex, combination, {
    type: 'play',
    playerIndex,
    combinationType: combination.type,
    cards: cards.map(cardKey),
    isBomb: isBomb(combination),
    beaten: summarizeCombination(active),
    message: `${player.name} played ${combination.type}`,
  });

  return { ok: true, combination, ...settled };
}

export function passTurn(state, playerIndex) {
  if (!state || state.status !== 'playing') return fail('Game is not in progress');
  if (state.pendingTempelan) return fail('A tempelan vote is in progress');
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

export function startTempelan(state, playerIndex, mainKeys, attachedKeys) {
  if (!state || state.status !== 'playing') return fail('Game is not in progress');
  if (state.pendingTempelan) return fail('A tempelan vote is already in progress');
  if (!Number.isInteger(playerIndex) || !state.players[playerIndex]) return fail('Invalid player');
  if (state.turn !== playerIndex) return fail('Not your turn');
  if (!Array.isArray(mainKeys) || mainKeys.length === 0) return fail('Select a main hand');
  if (!Array.isArray(attachedKeys) || attachedKeys.length === 0) {
    return fail('Select a hand to tempel');
  }

  const allKeys = [...mainKeys, ...attachedKeys];
  if (new Set(allKeys).size !== allKeys.length) return fail('Duplicate cards selected');

  const player = state.players[playerIndex];
  const handByKey = new Map(player.hand.map((card) => [cardKey(card), card]));
  const mainCards = [];
  const attachedCards = [];

  for (const key of mainKeys) {
    const card = handByKey.get(key);
    if (!card) return fail('Card not in hand');
    mainCards.push(card);
  }
  for (const key of attachedKeys) {
    const card = handByKey.get(key);
    if (!card) return fail('Card not in hand');
    attachedCards.push(card);
  }

  const mainCombination = detectCombination(mainCards);
  if (!mainCombination) return fail('Main hand is not a valid combination');

  const attachedCombination = detectCombination(attachedCards);
  if (!attachedCombination) return fail('Tempelan hand is not a valid combination');
  if (isBomb(attachedCombination)) return fail('Bombs cannot be tempeled');

  const active = state.activePlay?.combination ?? null;
  if (!canPlayCombination(mainCombination, active)) {
    if (!active) return fail('Bombs cannot be led');
    return fail('Main hand does not beat the current combination');
  }

  if (player.hand.length === mainCards.length + attachedCards.length) {
    const twos = [...mainCards, ...attachedCards].filter((card) => card.rank === '2');
    if (
      twos.length > 0 &&
      !isLegalFinalPlaySet([mainCombination, attachedCombination])
    ) {
      return fail('Cannot finish with a 2 unless it is part of a sequence');
    }
  }

  if (isBomb(mainCombination)) state.bombPlayed = true;

  player.hand = player.hand.filter((card) => !allKeys.includes(cardKey(card)));

  const voters = activeIndexes(state).filter((seat) => seat !== playerIndex);

  state.pendingTempelan = {
    playerIndex,
    main: { combination: mainCombination, cards: mainCards.map(cardKey) },
    attached: { combination: attachedCombination, cards: attachedCards.map(cardKey) },
    voters,
    votes: new Map(),
    beaten: summarizeCombination(active),
  };

  addLog(state, {
    type: 'tempelan-play',
    playerIndex,
    mainType: mainCombination.type,
    mainCards: mainCards.map(cardKey),
    attachedType: attachedCombination.type,
    attachedCards: attachedCards.map(cardKey),
    beaten: state.pendingTempelan.beaten,
    message: `${player.name} tempeled ${attachedCombination.type} on ${mainCombination.type}`,
  });

  if (voters.length === 0) {
    return resolveTempelanInternal(state, true);
  }

  return {
    ok: true,
    resolved: false,
    main: mainCombination,
    attached: attachedCombination,
    voters,
  };
}

export function submitTempelanVote(state, voterSeat, vote) {
  if (!state?.pendingTempelan) return fail('No tempelan vote in progress');

  const pending = state.pendingTempelan;
  if (!Number.isInteger(voterSeat) || !pending.voters.includes(voterSeat)) {
    return fail('You cannot vote on this tempelan');
  }
  if (pending.votes.has(voterSeat)) return fail('You already voted');

  const value = Boolean(vote);
  pending.votes.set(voterSeat, value);

  addLog(state, {
    type: 'tempelan-vote',
    playerIndex: voterSeat,
    vote: value ? 'yes' : 'no',
    message: `${state.players[voterSeat].name} voted ${value ? 'yes' : 'no'}`,
  });

  if (!value) return resolveTempelanInternal(state, false);

  const allYes = pending.voters.every((seat) => pending.votes.get(seat) === true);
  if (allYes) return resolveTempelanInternal(state, true);

  return { ok: true, resolved: false };
}

export function resolvePendingTempelan(state, accepted) {
  if (!state?.pendingTempelan) return fail('No tempelan vote in progress');
  return resolveTempelanInternal(state, Boolean(accepted));
}

function resolveTempelanInternal(state, accepted) {
  const pending = state.pendingTempelan;
  const player = state.players[pending.playerIndex];
  const target = accepted ? pending.attached : pending.main;

  if (!accepted) {
    const returned = pending.attached.cards.map(parseCard);
    player.hand = sortHand([...player.hand, ...returned]);
  }

  state.pendingTempelan = null;

  addLog(
    state,
    accepted
      ? {
          type: 'tempelan-accepted',
          playerIndex: pending.playerIndex,
          mainCards: pending.main.cards,
          cards: pending.attached.cards,
          message: `${player.name}'s tempelan was accepted`,
        }
      : {
          type: 'tempelan-rejected',
          playerIndex: pending.playerIndex,
          returned: pending.attached.cards,
          message: `${player.name}'s tempelan was rejected`,
        },
  );

  const tempelan = {
    playerIndex: pending.playerIndex,
    main: pending.main,
    attached: pending.attached,
    accepted,
  };

  const settled = settlePlay(
    state,
    pending.playerIndex,
    target.combination,
    {
      type: 'play',
      playerIndex: pending.playerIndex,
      combinationType: target.combination.type,
      cards: target.cards,
      isBomb: isBomb(target.combination),
      beaten: pending.beaten,
      tempelan,
      message: `${player.name} played ${target.combination.type}`,
    },
    { tempelan },
  );

  return {
    ok: true,
    resolved: true,
    accepted,
    combination: target.combination,
    ...settled,
  };
}
