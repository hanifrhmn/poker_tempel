import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SESSION_STATUS,
  canPlayCombination,
  cardKey,
  detectCombination,
  sortHand,
} from '@poker-tempel/shared';
import { createRoomManager } from '../src/room-manager.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeManager(options = {}) {
  return createRoomManager({
    turnTimeoutMs: 60_000,
    disconnectGraceMs: 10_000,
    botDelayMs: 10_000,
    ...options,
  });
}

function createRoomWithHumans(manager, names = ['A', 'B', 'C', 'D']) {
  const created = manager.createRoom({ name: names[0] });
  assert.equal(created.ok, true);

  const code = created.code;
  const players = [{ seat: 0, playerId: created.playerId, name: names[0] }];

  for (let index = 1; index < names.length; index += 1) {
    const joined = manager.joinRoom({ code, name: names[index] });
    assert.equal(joined.ok, true);
    players.push({ seat: joined.seat, playerId: joined.playerId, name: names[index] });
  }

  return { code, players, hostId: created.playerId };
}

function playFullRound(manager, code, players) {
  const room = manager.getRoom(code);
  let guard = 0;

  while (room.session.status === SESSION_STATUS.PLAYING && guard < 3000) {
    guard += 1;
    const game = room.session.currentGame;
    const seat = game.turn;
    const player = players.find((entry) => entry.seat === seat);
    const active = game.activePlay?.combination ?? null;
    const hand = sortHand(game.players[seat].hand);

    let played = false;
    for (const card of hand) {
      const combination = detectCombination([card]);
      if (!canPlayCombination(combination, active)) continue;

      const result = manager.play({
        code,
        playerId: player.playerId,
        cards: [cardKey(card)],
      });
      assert.equal(result.ok, true);
      played = true;
      break;
    }

    if (!played) {
      const result = manager.pass({ code, playerId: player.playerId });
      assert.equal(result.ok, true);
    }
  }

  assert.equal(guard < 3000, true);
}

test('creates rooms, joins players, and enforces capacity', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const created = manager.createRoom({ name: ' Alice ' });
  assert.equal(created.ok, true);
  assert.equal(created.code.length, 5);
  assert.equal(created.seat, 0);
  assert.equal(created.state.status, SESSION_STATUS.LOBBY);
  assert.equal(created.state.hostSeat, 0);
  assert.equal(created.state.yourSeat, 0);
  assert.equal(created.state.slots[0].name, 'Alice');

  assert.equal(manager.joinRoom({ code: 'ZZZZZ', name: 'X' }).error, 'Room not found');

  for (const name of ['B', 'C', 'D']) {
    assert.equal(manager.joinRoom({ code: created.code, name }).ok, true);
  }
  assert.equal(manager.joinRoom({ code: created.code, name: 'E' }).error, 'Room is full');

  const state = manager.getStateFor(manager.getRoom(created.code), created.playerId);
  assert.deepEqual(
    state.slots.map((slot) => slot.name),
    ['Alice', 'B', 'C', 'D'],
  );
});

test('host can add and remove bots in the lobby', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const created = manager.createRoom({ name: 'Host' });
  const code = created.code;

  assert.equal(manager.addBot({ code }).error, 'Only the host can do that');

  const first = manager.addBot({ code, playerId: created.playerId });
  assert.equal(first.ok, true);
  assert.equal(first.seat, 1);

  const guest = manager.joinRoom({ code, name: 'Guest' });
  assert.equal(
    manager.removeBot({ code, playerId: guest.playerId, seat: 1 }).error,
    'Only the host can do that',
  );

  assert.equal(manager.removeBot({ code, playerId: created.playerId, seat: 1 }).ok, true);
  assert.equal(manager.getRoom(code).slots[1], null);
  assert.equal(
    manager.removeBot({ code, playerId: created.playerId, seat: 0 }).error,
    'That seat is not a removable bot',
  );
});

test('host starts a four-seat game and state hides opponents hands', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const created = manager.createRoom({ name: 'Host' });
  const code = created.code;

  assert.equal(
    manager.startGame({ code, playerId: created.playerId }).error,
    'All 4 seats must be filled',
  );

  const guest = manager.joinRoom({ code, name: 'Guest' });
  assert.equal(
    manager.startGame({ code, playerId: guest.playerId }).error,
    'Only the host can do that',
  );

  assert.equal(manager.addBot({ code, playerId: created.playerId }).ok, true);
  assert.equal(manager.addBot({ code, playerId: created.playerId }).ok, true);
  assert.equal(manager.addBot({ code, playerId: created.playerId }).error, 'Room is full');

  const started = manager.startGame({ code, playerId: created.playerId });
  assert.equal(started.ok, true);
  assert.equal(started.state.status, SESSION_STATUS.PLAYING);
  assert.equal(started.state.round, 1);
  assert.equal(started.state.turnTimeoutMs, 60_000);
  assert.deepEqual(started.state.passedSeats, []);
  assert.equal(manager.startGame({ code, playerId: created.playerId }).error, 'Game already started');

  const hostState = manager.getStateFor(manager.getRoom(code), created.playerId);
  const guestState = manager.getStateFor(manager.getRoom(code), guest.playerId);

  for (const state of [hostState, guestState]) {
    assert.ok(Array.isArray(state.you.hand));
    assert.ok(state.you.hand.length >= 9 && state.you.hand.length <= 13);
    assert.ok(state.players.every((player) => !('hand' in player)));
    assert.equal(
      state.players.reduce((sum, player) => sum + player.cardCount, 0),
      48,
    );
    assert.equal(state.players.filter((player) => player.isBot).length, 2);
  }

  assert.notEqual(
    hostState.you.hand.map(cardKey).join(','),
    guestState.you.hand.map(cardKey).join(','),
  );
});

test('validates plays and passes through the session', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const { code, players } = createRoomWithHumans(manager);
  assert.equal(manager.startGame({ code, playerId: players[0].playerId }).ok, true);

  const room = manager.getRoom(code);
  const turnSeat = room.session.currentGame.turn;
  const turnPlayer = players.find((player) => player.seat === turnSeat);
  const wrongPlayer = players.find((player) => player.seat !== turnSeat);

  const turnHand = sortHand(room.session.currentGame.players[turnSeat].hand);
  const wrongHand = sortHand(room.session.currentGame.players[wrongPlayer.seat].hand);

  assert.equal(
    manager.pass({ code, playerId: turnPlayer.playerId }).error,
    'You are leading; play cards',
  );
  assert.equal(
    manager.play({
      code,
      playerId: wrongPlayer.playerId,
      cards: [cardKey(wrongHand[0])],
    }).error,
    'Not your turn',
  );

  const played = manager.play({
    code,
    playerId: turnPlayer.playerId,
    cards: [cardKey(turnHand[0])],
  });
  assert.equal(played.ok, true);
  assert.equal(played.state.players[turnSeat].cardCount, turnHand.length - 1);
  assert.equal(played.state.activePlay.combination.type, 'single');

  const nextSeat = room.session.currentGame.turn;
  const nextPlayer = players.find((player) => player.seat === nextSeat);
  const passed = manager.pass({ code, playerId: nextPlayer.playerId });
  assert.equal(passed.ok, true);
  assert.ok(passed.state.passedSeats.includes(nextSeat));
});

test('completes a full round and starts the next with the winner leading', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const { code, players } = createRoomWithHumans(manager);
  assert.equal(manager.startGame({ code, playerId: players[0].playerId }).ok, true);

  playFullRound(manager, code, players);

  const room = manager.getRoom(code);
  assert.equal(room.session.status, SESSION_STATUS.ROUND_END);
  assert.equal(room.session.lastRoundResult.placements.length, 4);
  assert.equal(
    room.session.players.reduce((sum, player) => sum + player.score, 0),
    6,
  );

  const winnerSeat = room.session.lastRoundResult.placements[0];
  assert.equal(
    manager.nextRound({
      code,
      playerId: players.find((player) => player.seat !== 0).playerId,
    }).error,
    'Only the host can do that',
  );

  const next = manager.nextRound({ code, playerId: players[0].playerId });
  assert.equal(next.ok, true);
  assert.equal(room.session.status, SESSION_STATUS.PLAYING);
  assert.equal(room.session.round, 2);
  assert.equal(room.session.currentGame.turn, winnerSeat);
  assert.equal(
    room.session.currentGame.players.reduce((sum, player) => sum + player.hand.length, 0),
    52,
  );
});

test('turn timeouts auto-play when leading and auto-pass when responding', async (t) => {
  const manager = makeManager({ turnTimeoutMs: 40 });
  t.after(() => manager.close());

  const { code, players } = createRoomWithHumans(manager);
  assert.equal(manager.startGame({ code, playerId: players[0].playerId }).ok, true);

  const room = manager.getRoom(code);
  await delay(300);

  const log = room.session.currentGame.log;
  assert.ok(log.some((entry) => entry.type === 'play'));
  assert.ok(log.some((entry) => entry.type === 'pass'));
  assert.equal(room.session.currentGame.status, 'playing');
});

test('disconnect converts the seat to a bot and reconnect restores control', async (t) => {
  const manager = makeManager({ disconnectGraceMs: 30 });
  t.after(() => manager.close());

  const created = manager.createRoom({ name: 'Host', socketId: 'socket-host' });
  const code = created.code;
  const joined = manager.joinRoom({ code, name: 'Guest', socketId: 'socket-guest' });

  assert.equal(manager.addBot({ code, playerId: created.playerId }).ok, true);
  assert.equal(manager.addBot({ code, playerId: created.playerId }).ok, true);
  assert.equal(manager.startGame({ code, playerId: created.playerId }).ok, true);

  manager.handleDisconnect({ socketId: 'socket-guest' });
  let state = manager.getStateFor(manager.getRoom(code), created.playerId);
  assert.equal(state.slots[1].connected, false);
  assert.equal(state.slots[1].isBot, false);

  await delay(80);
  state = manager.getStateFor(manager.getRoom(code), created.playerId);
  assert.equal(state.slots[1].isBot, true);

  const rejoin = manager.joinRoom({
    code,
    playerId: joined.playerId,
    socketId: 'socket-guest-2',
  });
  assert.equal(rejoin.ok, true);
  state = manager.getStateFor(manager.getRoom(code), created.playerId);
  assert.equal(state.slots[1].connected, true);
  assert.equal(state.slots[1].isBot, false);

  manager.handleDisconnect({ socketId: 'socket-host' });
  await delay(80);
  state = manager.getStateFor(manager.getRoom(code), joined.playerId);
  assert.equal(state.hostSeat, 1);
});

test('leaving the lobby frees the seat and abandons empty rooms', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const created = manager.createRoom({ name: 'Host' });
  const code = created.code;
  const joined = manager.joinRoom({ code, name: 'Guest' });

  assert.equal(manager.leaveRoom({ code, playerId: joined.playerId }).ok, true);
  assert.equal(manager.getRoom(code).slots[1], null);

  assert.equal(manager.leaveRoom({ code, playerId: created.playerId }).ok, true);
  assert.equal(manager.getRoom(code), undefined);
});

test('leaving during a game converts the seat to a bot', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const { code, players } = createRoomWithHumans(manager);
  assert.equal(manager.startGame({ code, playerId: players[0].playerId }).ok, true);

  const leaver = players[2];
  assert.equal(manager.leaveRoom({ code, playerId: leaver.playerId }).ok, true);

  const room = manager.getRoom(code);
  assert.ok(room);
  assert.equal(room.slots[leaver.seat].isBot, true);
  assert.equal(room.slots[leaver.seat].playerId, null);
  assert.equal(room.slots[leaver.seat].connected, false);

  const state = manager.getStateFor(room, players[0].playerId);
  assert.equal(state.players[leaver.seat].isBot, true);
});

test('emits effect-ready game events', (t) => {
  const manager = makeManager();
  t.after(() => manager.close());

  const events = [];
  manager.onEvent((_room, event) => events.push(event));

  const { code, players } = createRoomWithHumans(manager);
  assert.equal(manager.startGame({ code, playerId: players[0].playerId }).ok, true);

  assert.ok(events.some((event) => event.type === 'game-start'));
  assert.ok(events.some((event) => event.type === 'opening-threes'));

  const room = manager.getRoom(code);
  const turnSeat = room.session.currentGame.turn;
  const turnPlayer = players.find((player) => player.seat === turnSeat);
  const hand = sortHand(room.session.currentGame.players[turnSeat].hand);

  assert.equal(
    manager.play({
      code,
      playerId: turnPlayer.playerId,
      cards: [cardKey(hand[0])],
    }).ok,
    true,
  );

  const playEvent = events.filter((event) => event.type === 'play').at(-1);
  assert.ok(playEvent);
  assert.equal(playEvent.isBomb, false);
  assert.equal(playEvent.beaten, null);
  assert.equal(typeof playEvent.at, 'number');
  assert.ok(Array.isArray(playEvent.cards));
});
