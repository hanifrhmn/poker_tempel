import { randomUUID } from 'node:crypto';
import {
  SESSION_STATUS,
  cardKey,
  castTempelanVote as castTempelanVoteSession,
  createSession,
  endSession as endSessionEngine,
  getStandings,
  pass as passSession,
  play as playSession,
  playTempelan as playTempelanSession,
  resetRoundAfterBombBattle,
  resetRoundAfterSelfBomb,
  resolveTempelanVote as resolveTempelanVoteSession,
  sortHand,
  startNextRound,
  startSession,
} from '@poker-tempel/shared';
import { chooseBotMove, chooseBotVote } from './bot.js';

const ROOM_CODE_LENGTH = 5;
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_NAME_LENGTH = 24;
const MAX_LOG_ENTRIES = 50;
const SEAT_COUNT = 4;

function fail(error) {
  return { ok: false, error };
}

function cleanName(name) {
  return String(name ?? '').trim().slice(0, MAX_NAME_LENGTH);
}

function makeSlot({ playerId = null, name, isBot = false, socketId = null, connected = false }) {
  return {
    playerId,
    name,
    isBot,
    connected,
    socketId,
    disconnectTimer: null,
  };
}

function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

export function createRoomManager(options = {}) {
  const config = {
    turnTimeoutMs: 30_000,
    disconnectGraceMs: 15_000,
    botDelayMs: 800,
    tempelVoteTimeoutMs: 15_000,
    botVoteDelayMs: 700,
    openingDurationMs: 3_600,
    ...options,
  };

  const rooms = new Map();
  const socketIndex = new Map();
  const updateListeners = new Set();
  const eventListeners = new Set();

  function onUpdate(listener) {
    updateListeners.add(listener);
    return () => updateListeners.delete(listener);
  }

  function onEvent(listener) {
    eventListeners.add(listener);
    return () => eventListeners.delete(listener);
  }

  function emitUpdate(room) {
    room.version += 1;
    for (const listener of updateListeners) listener(room);
  }

  function emitGameEvent(room, event) {
    for (const listener of eventListeners) listener(room, event);
  }

  function emitEventsForGame(room, game, events) {
    if (room.session?.currentGame !== game) return;
    for (const event of events) emitGameEvent(room, event);
  }

  function getRoomByCode(code) {
    return rooms.get(normalizeCode(code));
  }

  function seatOf(room, playerId) {
    if (!playerId) return -1;
    return room.slots.findIndex((slot) => slot?.playerId === playerId);
  }

  function requireHost(room, playerId) {
    if (!playerId || room.hostId !== playerId) return 'Only the host can do that';
    const seat = seatOf(room, playerId);
    if (seat === -1) return 'You are not in this room';
    if (!room.slots[seat].connected) return 'You are not connected';
    return null;
  }

  function transferHost(room) {
    const owned = room.slots.filter((slot) => slot?.playerId);
    const next = owned.find((slot) => slot.connected) ?? owned[0];
    room.hostId = next?.playerId ?? null;
  }

  function clearActionTimers(room) {
    if (room.turnTimer) clearTimeout(room.turnTimer);
    if (room.botTimer) clearTimeout(room.botTimer);
    room.turnTimer = null;
    room.botTimer = null;
  }

  function clearTempelTimers(room) {
    if (room.tempelTimer) clearTimeout(room.tempelTimer);
    if (room.botVoteTimer) clearTimeout(room.botVoteTimer);
    room.tempelTimer = null;
    room.botVoteTimer = null;
    room.tempelDeadline = null;
  }

  function clearRoomTimers(room) {
    clearActionTimers(room);
    clearTempelTimers(room);
    if (room.openingTimer) clearTimeout(room.openingTimer);
    room.openingTimer = null;
    room.opening = null;
    for (const slot of room.slots) {
      if (slot?.disconnectTimer) clearTimeout(slot.disconnectTimer);
      if (slot) slot.disconnectTimer = null;
    }
  }

  function deleteRoom(room) {
    clearRoomTimers(room);
    rooms.delete(room.code);
    for (const slot of room.slots) {
      if (slot?.socketId) socketIndex.delete(slot.socketId);
    }
  }

  function cleanupIfAbandoned(room) {
    const hasHumanOwner = room.slots.some((slot) => slot?.playerId);
    if (!hasHumanOwner) deleteRoom(room);
  }

  function armTempelVote(room) {
    if (room.tempelTimer) return;

    const deadline = Date.now() + config.tempelVoteTimeoutMs;
    room.tempelDeadline = deadline;
    room.tempelTimer = setTimeout(() => {
      if (room.tempelDeadline !== deadline) return;
      onTempelTimeout(room.code);
    }, config.tempelVoteTimeoutMs);
  }

  function scheduleBotVotes(room) {
    if (room.botVoteTimer) return;

    const pending = room.session?.currentGame?.pendingTempelan;
    if (!pending) return;

    const hasBot = pending.voters.some(
      (seat) => room.slots[seat]?.isBot && !pending.votes.has(seat),
    );
    if (!hasBot) return;

    room.botVoteTimer = setTimeout(() => {
      room.botVoteTimer = null;
      castBotVotes(room.code);
    }, config.botVoteDelayMs);
  }

  function castBotVotes(code) {
    const room = rooms.get(code);
    if (!room?.session) return;

    const game = room.session.currentGame;
    if (!game.pendingTempelan) return;

    const logStart = game.log.length;

    for (const seat of [...game.pendingTempelan.voters]) {
      if (!room.slots[seat]?.isBot) continue;
      if (game.pendingTempelan.votes.has(seat)) continue;

      const vote = chooseBotVote(game, seat);
      if (vote === null) continue;

      const result = castTempelanVoteSession(room.session, seat, vote);
      if (!result.ok) continue;
      if (result.resolved) break;
    }

    if (game.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return;
    }

    const events = game.log.slice(logStart);
    syncTimers(room);
    emitUpdate(room);
    emitEventsForGame(room, game, events);
  }

  function onTempelTimeout(code) {
    const room = rooms.get(code);
    if (!room?.session?.currentGame.pendingTempelan) return;

    const game = room.session.currentGame;
    const logStart = game.log.length;
    const result = resolveTempelanVoteSession(room.session, false);
    if (!result.ok) return;

    if (game.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return;
    }

    const events = game.log.slice(logStart);
    syncTimers(room);
    emitUpdate(room);
    emitEventsForGame(room, game, events);
  }

  function clearOpeningTimer(room) {
    if (room.openingTimer) clearTimeout(room.openingTimer);
    room.openingTimer = null;
    room.opening = null;
  }

  function beginOpening(room, opening) {
    if (!opening || config.openingDurationMs <= 0) return;

    clearOpeningTimer(room);
    const startedAt = Date.now();
    room.opening = {
      leader: opening.leader,
      discards: opening.discards,
      reason: opening.reason ?? 'first-round',
      startedAt,
      endsAt: startedAt + config.openingDurationMs,
    };
    room.openingTimer = setTimeout(
      () => finishOpening(room.code),
      config.openingDurationMs,
    );
  }

  function finishOpening(code) {
    const room = rooms.get(code);
    if (!room?.opening) return;

    const opening = room.opening;
    room.opening = null;
    room.openingTimer = null;

    const game = room.session?.currentGame;
    const events = [];

    if (game) {
      const leaderName = game.players[opening.leader]?.name ?? 'The 3♠ holder';
      const prefix =
        opening.reason === 'bomb'
          ? 'Bomb reset'
          : opening.reason === 'self-bomb'
            ? 'Self bomb reset'
            : opening.reason === 'bomb-battle'
              ? 'Bomb battle reset'
              : 'All 3s discarded';
      const event = {
        type: 'opening-complete',
        at: Date.now(),
        playerIndex: opening.leader,
        message: `${prefix} — ${leaderName} leads first`,
      };
      game.log.push(event);
      events.push(event);
    }

    syncTimers(room);
    emitUpdate(room);
    if (game) emitEventsForGame(room, game, events);
  }

  function isStuckWithPoker(game) {
    if (!game || game.status !== 'playing' || game.pendingTempelan) return false;
    if (game.activePlay) return false;
    const hand = game.players[game.turn]?.hand ?? [];
    return hand.length === 1 && hand[0].rank === '2';
  }

  function triggerSelfBomb(room) {
    const session = room.session;
    const game = session?.currentGame;
    if (!game) return;

    const seat = game.turn;
    const cards = game.players[seat].hand.map(cardKey);
    const result = resetRoundAfterSelfBomb(session, { playerIndex: seat, cards });
    if (!result.ok) return;

    if (result.opening) beginOpening(room, result.opening);

    const events = [...result.game.log];
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);
  }

  function triggerBombBattleReset(room) {
    const session = room.session;
    const game = session?.currentGame;
    const battle = game?.bombBattle;
    if (!battle || battle.loser === null || battle.loser === undefined) return;

    const result = resetRoundAfterBombBattle(session, {
      loserSeat: battle.loser,
      bombs: battle.bombs,
    });
    if (!result.ok) return;

    if (result.opening) beginOpening(room, result.opening);

    const events = [...result.game.log];
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);
  }

  function syncTimers(room) {
    clearActionTimers(room);

    const session = room.session;
    if (!session || session.status !== SESSION_STATUS.PLAYING) {
      room.turnDeadline = null;
      clearTempelTimers(room);
      return;
    }

    if (session.currentGame.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return;
    }

    if (room.opening) {
      room.turnDeadline = null;
      return;
    }

    const game = session.currentGame;
    if (game.pendingTempelan) {
      room.turnDeadline = null;
      armTempelVote(room);
      scheduleBotVotes(room);
      return;
    }

    if (isStuckWithPoker(game)) {
      triggerSelfBomb(room);
      return;
    }

    clearTempelTimers(room);

    const seat = game.turn;
    const deadline = Date.now() + config.turnTimeoutMs;
    room.turnDeadline = deadline;
    room.turnTimer = setTimeout(() => {
      if (room.turnDeadline !== deadline) return;
      onTurnTimeout(room.code);
    }, config.turnTimeoutMs);

    const slot = room.slots[seat];
    if (slot?.isBot) {
      room.botTimer = setTimeout(() => {
        if (room.session?.currentGame?.turn !== seat) return;
        if (!room.slots[seat]?.isBot) return;
        onBotTurn(room.code, seat);
      }, config.botDelayMs);
    }
  }

  function performAction(room, seat, action) {
    const game = room.session.currentGame;
    const logStart = game.log.length;
    const result =
      action.type === 'play'
        ? playSession(room.session, seat, action.cards)
        : passSession(room.session, seat);

    if (!result.ok) return result;

    if (room.session.currentGame.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return result;
    }

    const events = game.log.slice(logStart);
    syncTimers(room);
    emitUpdate(room);
    emitEventsForGame(room, game, events);
    return result;
  }

  function onTurnTimeout(code) {
    const room = rooms.get(code);
    if (!room?.session || room.session.status !== SESSION_STATUS.PLAYING) return;
    if (room.opening) return;

    const game = room.session.currentGame;
    const seat = game.turn;
    if (isStuckWithPoker(game)) {
      triggerSelfBomb(room);
      return;
    }
    if (game.activePlay) {
      performAction(room, seat, { type: 'pass' });
      return;
    }

    const hand = sortHand(game.players[seat].hand);
    if (hand.length === 0) return;
    performAction(room, seat, { type: 'play', cards: [cardKey(hand[0])] });
  }

  function onBotTurn(code, seat) {
    const room = rooms.get(code);
    if (!room?.session || room.session.status !== SESSION_STATUS.PLAYING) return;
    if (room.opening) return;

    const game = room.session.currentGame;
    if (game.turn !== seat || !room.slots[seat]?.isBot) return;

    const move = chooseBotMove(game, seat);
    if (!move) {
      if (isStuckWithPoker(game)) triggerSelfBomb(room);
      return;
    }

    const result = performAction(room, seat, move);
    if (result.ok) return;

    const hand = sortHand(game.players[seat].hand);
    if (game.activePlay) {
      performAction(room, seat, { type: 'pass' });
    } else if (hand.length > 0) {
      performAction(room, seat, { type: 'play', cards: [cardKey(hand[0])] });
    }
  }

  function getStateFor(room, playerId) {
    const viewerSeat = seatOf(room, playerId);
    const slots = room.slots.map((slot, seat) =>
      slot
        ? {
            seat,
            name: slot.name,
            isBot: slot.isBot,
            connected: slot.connected,
          }
        : null,
    );
    const hostSeat = room.slots.findIndex(
      (slot) => slot?.playerId && slot.playerId === room.hostId,
    );
    const base = {
      code: room.code,
      hostSeat,
      slots,
      yourSeat: viewerSeat,
      version: room.version,
      turnTimeoutMs: config.turnTimeoutMs,
      tempelVoteTimeoutMs: config.tempelVoteTimeoutMs,
    };

    if (!room.session) {
      return { ...base, status: SESSION_STATUS.LOBBY };
    }

    const session = room.session;
    const game = session.currentGame;
    const pending = game.pendingTempelan;
    const players = game.players.map((player, seat) => {
      const slot = room.slots[seat];
      const stats = session.players[seat];
      return {
        seat,
        name: player.name,
        isBot: slot?.isBot ?? player.isBot,
        connected: slot?.connected ?? false,
        cardCount: player.hand.length,
        finished: player.finished,
        placement: player.placement,
        score: stats.score,
        wins: stats.wins,
        bombLosses: stats.bombLosses ?? 0,
        placements: [...stats.placements],
      };
    });

    const state = {
      ...base,
      status: session.status,
      round: session.round,
      maxRounds: session.maxRounds,
      turn: game.turn,
      turnDeadline: room.turnDeadline,
      activePlay: game.activePlay,
      passedSeats: [...game.passedThisTrick],
      bombPlayed: game.bombPlayed,
      opening: room.opening,
      pendingTempelan: pending
        ? {
            playerIndex: pending.playerIndex,
            main: pending.main,
            attached: pending.attached,
            voters: [...pending.voters],
            votes: Object.fromEntries(pending.votes),
          }
        : null,
      tempelDeadline: room.tempelDeadline,
      placements: [...game.placements],
      players,
      log: game.log.slice(-MAX_LOG_ENTRIES),
      lastRoundResult: session.lastRoundResult,
      you:
        viewerSeat === -1
          ? null
          : {
              seat: viewerSeat,
              name: game.players[viewerSeat].name,
              hand: [...game.players[viewerSeat].hand],
            },
    };

    if (session.status === SESSION_STATUS.GAME_END) {
      state.standings = getStandings(session);
    }

    return state;
  }

  function createRoom({ name, socketId = null } = {}) {
    const clean = cleanName(name);
    if (!clean) return fail('Name is required');

    let code;
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
      ).join('');
    } while (rooms.has(code));

    const playerId = randomUUID();
    const room = {
      code,
      hostId: playerId,
      slots: Array(SEAT_COUNT).fill(null),
      session: null,
      turnDeadline: null,
      turnTimer: null,
      botTimer: null,
      tempelDeadline: null,
      tempelTimer: null,
      botVoteTimer: null,
      opening: null,
      openingTimer: null,
      version: 0,
    };

    room.slots[0] = makeSlot({ playerId, name: clean, socketId, connected: true });
    rooms.set(code, room);
    if (socketId) socketIndex.set(socketId, { code, playerId });
    emitUpdate(room);

    return {
      ok: true,
      code,
      playerId,
      seat: 0,
      state: getStateFor(room, playerId),
    };
  }

  function joinRoom({ code, name, playerId: reconnectId = null, socketId = null } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    if (reconnectId) {
      const seat = seatOf(room, reconnectId);
      if (seat === -1) return fail('Seat not found');

      const slot = room.slots[seat];
      if (slot.disconnectTimer) {
        clearTimeout(slot.disconnectTimer);
        slot.disconnectTimer = null;
      }
      slot.connected = true;
      slot.isBot = false;
      slot.socketId = socketId;
      if (socketId) socketIndex.set(socketId, { code: room.code, playerId: reconnectId });

      syncTimers(room);
      emitUpdate(room);

      return {
        ok: true,
        code: room.code,
        playerId: reconnectId,
        seat,
        state: getStateFor(room, reconnectId),
      };
    }

    if (room.session) return fail('Game already started');

    const seat = room.slots.findIndex((slot) => slot === null);
    if (seat === -1) return fail('Room is full');

    const clean = cleanName(name);
    if (!clean) return fail('Name is required');

    const newPlayerId = randomUUID();
    room.slots[seat] = makeSlot({
      playerId: newPlayerId,
      name: clean,
      socketId,
      connected: true,
    });
    if (socketId) socketIndex.set(socketId, { code: room.code, playerId: newPlayerId });
    emitUpdate(room);

    return {
      ok: true,
      code: room.code,
      playerId: newPlayerId,
      seat,
      state: getStateFor(room, newPlayerId),
    };
  }

  function addBot({ code, playerId } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const hostError = requireHost(room, playerId);
    if (hostError) return fail(hostError);
    if (room.session) return fail('Game already started');

    const seat = room.slots.findIndex((slot) => slot === null);
    if (seat === -1) return fail('Room is full');

    room.slots[seat] = makeSlot({ name: `Bot ${seat + 1}`, isBot: true });
    emitUpdate(room);
    return { ok: true, seat, state: getStateFor(room, playerId) };
  }

  function removeBot({ code, playerId, seat } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const hostError = requireHost(room, playerId);
    if (hostError) return fail(hostError);
    if (room.session) return fail('Game already started');
    if (!Number.isInteger(seat) || !room.slots[seat]) return fail('Invalid seat');

    const slot = room.slots[seat];
    if (!slot.isBot || slot.playerId) return fail('That seat is not a removable bot');

    room.slots[seat] = null;
    emitUpdate(room);
    return { ok: true, state: getStateFor(room, playerId) };
  }

  function startGame({ code, playerId } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const hostError = requireHost(room, playerId);
    if (hostError) return fail(hostError);
    if (room.session) return fail('Game already started');
    if (room.slots.some((slot) => !slot)) return fail('All 4 seats must be filled');

    const session = createSession({
      players: room.slots.map((slot, seat) => ({
        id: slot.playerId ?? `bot-${room.code}-${seat}`,
        name: slot.name,
        isBot: slot.isBot,
      })),
    });

    const started = startSession(session);
    if (!started.ok) return started;

    room.session = session;
    if (started.opening) beginOpening(room, started.opening);
    const events = [...session.currentGame.log];
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);

    return { ok: true, state: getStateFor(room, playerId) };
  }

  function play({ code, playerId, cards } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const seat = seatOf(room, playerId);
    if (seat === -1) return fail('You are not in this room');
    if (!room.slots[seat].connected) return fail('You are disconnected');
    if (!room.session) return fail('Game has not started');
    if (room.session.status !== SESSION_STATUS.PLAYING) return fail('Round is not in progress');
    if (room.opening) return fail('Opening discards are still being revealed');

    const result = performAction(room, seat, { type: 'play', cards });
    if (!result.ok) return result;
    return { ...result, state: getStateFor(room, playerId) };
  }

  function pass({ code, playerId } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const seat = seatOf(room, playerId);
    if (seat === -1) return fail('You are not in this room');
    if (!room.slots[seat].connected) return fail('You are disconnected');
    if (!room.session) return fail('Game has not started');
    if (room.session.status !== SESSION_STATUS.PLAYING) return fail('Round is not in progress');
    if (room.opening) return fail('Opening discards are still being revealed');

    const result = performAction(room, seat, { type: 'pass' });
    if (!result.ok) return result;
    return { ...result, state: getStateFor(room, playerId) };
  }

  function playTempelan({ code, playerId, mainCards, attachedCards } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const seat = seatOf(room, playerId);
    if (seat === -1) return fail('You are not in this room');
    if (!room.slots[seat].connected) return fail('You are disconnected');
    if (!room.session) return fail('Game has not started');
    if (room.session.status !== SESSION_STATUS.PLAYING) return fail('Round is not in progress');
    if (room.opening) return fail('Opening discards are still being revealed');

    const game = room.session.currentGame;
    const logStart = game.log.length;
    const result = playTempelanSession(room.session, seat, mainCards, attachedCards);
    if (!result.ok) return result;

    if (room.session.currentGame.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return { ...result, state: getStateFor(room, playerId) };
    }

    const events = game.log.slice(logStart);
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);

    return { ...result, state: getStateFor(room, playerId) };
  }

  function castTempelanVote({ code, playerId, vote } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const seat = seatOf(room, playerId);
    if (seat === -1) return fail('You are not in this room');
    if (!room.slots[seat].connected) return fail('You are disconnected');
    if (!room.session) return fail('Game has not started');
    if (room.session.status !== SESSION_STATUS.PLAYING) return fail('Round is not in progress');
    if (typeof vote !== 'boolean') return fail('Vote must be yes or no');

    const game = room.session.currentGame;
    if (!game.pendingTempelan) return fail('No tempelan vote in progress');

    const logStart = game.log.length;
    const result = castTempelanVoteSession(room.session, seat, vote);
    if (!result.ok) return result;

    if (room.session.currentGame.status === 'bomb-end') {
      triggerBombBattleReset(room);
      return { ...result, state: getStateFor(room, playerId) };
    }

    const events = game.log.slice(logStart);
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);

    return { ...result, state: getStateFor(room, playerId) };
  }

  function nextRound({ code, playerId } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const hostError = requireHost(room, playerId);
    if (hostError) return fail(hostError);
    if (!room.session) return fail('Game has not started');
    if (room.session.status !== SESSION_STATUS.ROUND_END) return fail('Round is not finished');

    const started = startNextRound(room.session);
    if (!started.ok) return started;

    if (started.opening) beginOpening(room, started.opening);
    const events = [...room.session.currentGame.log];
    syncTimers(room);
    emitUpdate(room);
    for (const event of events) emitGameEvent(room, event);

    return { ok: true, state: getStateFor(room, playerId) };
  }

  function endSession({ code, playerId } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const hostError = requireHost(room, playerId);
    if (hostError) return fail(hostError);
    if (!room.session) return fail('Game has not started');

    const ended = endSessionEngine(room.session);
    if (!ended.ok) return ended;

    syncTimers(room);
    emitUpdate(room);
    return { ok: true, state: getStateFor(room, playerId) };
  }

  function leaveRoom({ code, playerId, socketId = null } = {}) {
    const room = getRoomByCode(code);
    if (!room) return fail('Room not found');

    const seat = seatOf(room, playerId);
    if (seat === -1) return fail('You are not in this room');

    const slot = room.slots[seat];
    if (slot.disconnectTimer) {
      clearTimeout(slot.disconnectTimer);
      slot.disconnectTimer = null;
    }
    if (slot.socketId) socketIndex.delete(slot.socketId);
    if (socketId) socketIndex.delete(socketId);

    if (room.session) {
      slot.playerId = null;
      slot.connected = false;
      slot.socketId = null;
      slot.isBot = true;
    } else {
      room.slots[seat] = null;
    }

    if (room.hostId === playerId) transferHost(room);
    cleanupIfAbandoned(room);

    if (rooms.has(room.code)) {
      syncTimers(room);
      emitUpdate(room);
    }

    return { ok: true };
  }

  function handleDisconnect({ socketId } = {}) {
    const entry = socketIndex.get(socketId);
    if (!entry) return;

    socketIndex.delete(socketId);
    const room = rooms.get(entry.code);
    if (!room) return;

    const seat = seatOf(room, entry.playerId);
    if (seat === -1) return;

    const slot = room.slots[seat];
    if (slot.socketId !== socketId) return;

    slot.connected = false;
    slot.socketId = null;
    if (slot.disconnectTimer) clearTimeout(slot.disconnectTimer);

    slot.disconnectTimer = setTimeout(() => {
      slot.disconnectTimer = null;
      if (slot.connected || !rooms.has(room.code)) return;

      slot.isBot = true;
      if (room.hostId === slot.playerId) transferHost(room);
      syncTimers(room);
      emitUpdate(room);
    }, config.disconnectGraceMs);

    emitUpdate(room);
  }

  function close() {
    for (const room of rooms.values()) clearRoomTimers(room);
    rooms.clear();
    socketIndex.clear();
    updateListeners.clear();
    eventListeners.clear();
  }

  return {
    config: { ...config },
    createRoom,
    joinRoom,
    addBot,
    removeBot,
    startGame,
    play,
    pass,
    playTempelan,
    castTempelanVote,
    nextRound,
    endSession,
    leaveRoom,
    handleDisconnect,
    getStateFor,
    getRoom: getRoomByCode,
    onUpdate,
    onEvent,
    close,
  };
}
