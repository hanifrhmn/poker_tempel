import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canPlayCombination,
  cardKey,
  detectCombination,
  sortHand,
} from '@poker-tempel/shared';
import { io as createClient } from 'socket.io-client';
import { createPokerServer } from '../src/server.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function connectClient(url) {
  const socket = createClient(url, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
  });

  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function emitAck(socket, event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function waitForState(socket, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('room:state', onState);
      reject(new Error('Timed out waiting for room:state'));
    }, timeoutMs);

    function onState(state) {
      if (!predicate(state)) return;
      clearTimeout(timer);
      socket.off('room:state', onState);
      resolve(state);
    }

    socket.on('room:state', onState);
  });
}

async function startServer(options = {}) {
  const server = createPokerServer(options);
  await new Promise((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test('socket clients create, join, start, and receive private state', async (t) => {
  const { server, url } = await startServer({
    turnTimeoutMs: 60_000,
    disconnectGraceMs: 500,
    botDelayMs: 60_000,
  });
  const clients = [];

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  const health = await (await fetch(`${url}/api/health`)).json();
  assert.equal(health.status, 'ok');

  const alice = await connectClient(url);
  const bob = await connectClient(url);
  clients.push(alice, bob);

  const created = await emitAck(alice, 'room:create', { name: 'Alice' });
  assert.equal(created.ok, true);
  assert.equal(created.state.status, 'lobby');

  const joined = await emitAck(bob, 'room:join', { code: created.code, name: 'Bob' });
  assert.equal(joined.ok, true);
  assert.equal(joined.seat, 1);

  assert.equal((await emitAck(bob, 'room:addBot')).ok, false);
  assert.equal((await emitAck(alice, 'room:addBot')).ok, true);
  assert.equal((await emitAck(alice, 'room:addBot')).ok, true);

  const events = [];
  alice.on('game:event', (payload) => events.push(payload.event));
  const bobStatePromise = waitForState(bob, (state) => state.status === 'playing');

  const started = await emitAck(alice, 'room:start');
  assert.equal(started.ok, true);
  assert.equal(started.state.status, 'playing');

  const bobState = await bobStatePromise;
  assert.equal(bobState.you.seat, 1);
  assert.ok(bobState.you.hand.length >= 9 && bobState.you.hand.length <= 13);
  assert.ok(bobState.players.every((player) => !('hand' in player)));
  assert.equal(
    bobState.players.reduce((sum, player) => sum + player.cardCount, 0),
    48,
  );

  await delay(30);
  assert.ok(events.some((event) => event.type === 'game-start'));
  assert.ok(events.some((event) => event.type === 'opening-threes'));

  const turn = bobState.turn;
  const wrongClient = turn === 0 ? bob : alice;
  const wrongState = turn === 0 ? bobState : started.state;

  assert.notEqual(wrongState.you.seat, turn);
  const invalid = await emitAck(wrongClient, 'game:play', {
    cards: [cardKey(wrongState.you.hand[0])],
  });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error, 'Not your turn');
});

test('disconnected players are bot-controlled after grace and can reconnect', async (t) => {
  const { server, url } = await startServer({
    turnTimeoutMs: 60_000,
    disconnectGraceMs: 150,
    botDelayMs: 60_000,
  });
  const clients = [];

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  const alice = await connectClient(url);
  const bob = await connectClient(url);
  clients.push(alice, bob);

  const created = await emitAck(alice, 'room:create', { name: 'Alice' });
  const joined = await emitAck(bob, 'room:join', { code: created.code, name: 'Bob' });
  assert.equal(joined.ok, true);

  assert.equal((await emitAck(alice, 'room:addBot')).ok, true);
  assert.equal((await emitAck(alice, 'room:addBot')).ok, true);
  assert.equal((await emitAck(alice, 'room:start')).ok, true);

  const disconnectedState = waitForState(
    alice,
    (state) => state.status === 'playing' && state.slots[1]?.connected === false,
  );
  const takeoverState = waitForState(
    alice,
    (state) => state.status === 'playing' && state.slots[1]?.isBot === true,
  );

  bob.disconnect();
  const afterDisconnect = await disconnectedState;
  assert.equal(afterDisconnect.slots[1].isBot, false);

  const afterTakeover = await takeoverState;
  assert.equal(afterTakeover.slots[1].connected, false);

  const bob2 = await connectClient(url);
  clients.push(bob2);

  const reconnectState = waitForState(
    bob2,
    (state) => state.status === 'playing' && state.slots[1]?.isBot === false,
  );
  const reconnected = await emitAck(bob2, 'room:join', {
    code: created.code,
    playerId: joined.playerId,
  });

  assert.equal(reconnected.ok, true);
  const afterReconnect = await reconnectState;
  assert.equal(afterReconnect.slots[1].connected, true);
  assert.ok(Array.isArray(afterReconnect.you.hand));
});

test('four socket clients can play a full round and advance to round 2', async (t) => {
  const { server, url } = await startServer({
    turnTimeoutMs: 60_000,
    disconnectGraceMs: 1_000,
    botDelayMs: 60_000,
  });
  const clients = [];

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  const names = ['Alice', 'Bob', 'Carol', 'Dave'];
  for (const name of names) {
    clients.push(await connectClient(url));
  }

  const created = await emitAck(clients[0], 'room:create', { name: names[0] });
  assert.equal(created.ok, true);
  const code = created.code;
  const seats = [created.seat];

  for (let index = 1; index < clients.length; index += 1) {
    const joined = await emitAck(clients[index], 'room:join', {
      code,
      name: names[index],
    });
    assert.equal(joined.ok, true);
    seats.push(joined.seat);
  }
  assert.deepEqual(seats, [0, 1, 2, 3]);

  const trackers = clients.map(() => ({ state: null, events: [] }));
  clients.forEach((client, index) => {
    client.on('room:state', (state) => {
      trackers[index].state = state;
    });
    client.on('game:event', (payload) => {
      trackers[index].events.push(payload.event);
    });
  });

  const firstStates = clients.map((client) =>
    waitForState(client, (state) => state.status === 'playing'),
  );
  assert.equal((await emitAck(clients[0], 'room:start')).ok, true);
  const playingStates = await Promise.all(firstStates);
  playingStates.forEach((state, index) => {
    trackers[index].state = state;
  });

  let guard = 0;
  while (guard < 3000) {
    guard += 1;
    const publicState = trackers[0].state;
    if (publicState.status !== 'playing') break;

    const seat = publicState.turn;
    const actorState = trackers[seat].state;
    const active = actorState.activePlay?.combination ?? null;
    const hand = sortHand(actorState.you.hand);

    let action = { type: 'pass' };
    for (const card of hand) {
      const combination = detectCombination([card]);
      if (!canPlayCombination(combination, active)) continue;
      action = { type: 'play', cards: [cardKey(card)] };
      break;
    }

    const version = publicState.version;
    const result =
      action.type === 'play'
        ? await emitAck(clients[seat], 'game:play', { cards: action.cards })
        : await emitAck(clients[seat], 'game:pass');
    assert.equal(result.ok, true);

    const updated = await Promise.all(
      clients.map((client, index) =>
        trackers[index].state?.version > version
          ? trackers[index].state
          : waitForState(client, (state) => state.version > version),
      ),
    );
    updated.forEach((state, index) => {
      trackers[index].state = state;
    });
  }

  assert.equal(guard < 3000, true);

  const finalState = trackers[0].state;
  assert.equal(finalState.status, 'round-end');
  assert.equal(finalState.placements.length, 4);
  assert.deepEqual(
    [...finalState.placements].sort((a, b) => a - b),
    [0, 1, 2, 3],
  );
  assert.ok(finalState.players.every((player) => player.finished));

  const eventTypes = new Set(trackers[0].events.map((event) => event.type));
  assert.ok(eventTypes.has('play'));
  assert.ok(eventTypes.has('finish'));
  assert.ok(eventTypes.has('game-over'));

  const next = await emitAck(clients[0], 'room:nextRound');
  assert.equal(next.ok, true);
  assert.equal(next.state.status, 'playing');
  assert.equal(next.state.round, 2);
  assert.equal(next.state.turn, finalState.lastRoundResult.placements[0]);
});

test('socket clients can play a tempelan and vote on it', async (t) => {
  const { server, url } = await startServer({
    turnTimeoutMs: 60_000,
    tempelVoteTimeoutMs: 60_000,
    disconnectGraceMs: 1_000,
    botDelayMs: 60_000,
    botVoteDelayMs: 60_000,
  });
  const clients = [];

  t.after(async () => {
    for (const client of clients) client.disconnect();
    await server.close();
  });

  const names = ['Alice', 'Bob', 'Carol', 'Dave'];
  for (const name of names) {
    clients.push(await connectClient(url));
  }

  const created = await emitAck(clients[0], 'room:create', { name: names[0] });
  const code = created.code;

  for (let index = 1; index < clients.length; index += 1) {
    const joined = await emitAck(clients[index], 'room:join', {
      code,
      name: names[index],
    });
    assert.equal(joined.ok, true);
  }

  const playingStates = clients.map((client) =>
    waitForState(client, (state) => state.status === 'playing'),
  );
  assert.equal((await emitAck(clients[0], 'room:start')).ok, true);
  const states = await Promise.all(playingStates);

  const turnSeat = states[0].turn;
  const actor = clients[turnSeat];
  const actorState = states[turnSeat];
  const hand = sortHand(actorState.you.hand);
  const main = cardKey(hand[0]);
  const attached = cardKey(hand[1]);

  const started = await emitAck(actor, 'game:tempelan', {
    mainCards: [main],
    attachedCards: [attached],
  });

  assert.equal(started.ok, true);
  assert.equal(started.state.pendingTempelan.playerIndex, turnSeat);
  assert.equal(started.state.pendingTempelan.voters.length, 3);

  let final = null;
  for (const voterSeat of started.state.pendingTempelan.voters) {
    const result = await emitAck(clients[voterSeat], 'game:tempelanVote', {
      vote: true,
    });
    assert.equal(result.ok, true);
    final = result;
  }

  assert.equal(final.resolved, true);
  assert.equal(final.accepted, true);
  assert.equal(final.state.pendingTempelan, null);
  assert.equal(cardKey(final.state.activePlay.combination.cards[0]), attached);
});
