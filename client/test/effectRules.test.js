import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SLAM_WINDOW_MS,
  classifyGameEvent,
  nextLastPlayAt,
} from '../src/lib/effectRules.js';

test('bomb plays trigger the explosion effect', () => {
  const event = { type: 'play', isBomb: true, beaten: { type: 'single' }, at: 1000 };
  const effect = classifyGameEvent(event, 900);

  assert.equal(effect.kind, 'bomb');
  assert.equal(effect.sound, 'bomb');
});

test('fast beats trigger the slam effect', () => {
  const event = { type: 'play', isBomb: false, beaten: { type: 'single' }, at: 2000 };
  const effect = classifyGameEvent(event, 2000 - SLAM_WINDOW_MS + 1);

  assert.equal(effect.kind, 'slam');
  assert.equal(effect.sound, 'slam');
});

test('slow beats and fresh leads do not trigger a slam', () => {
  const slow = { type: 'play', isBomb: false, beaten: { type: 'single' }, at: 8000 };
  assert.equal(classifyGameEvent(slow, 1000).kind, 'play');

  const lead = { type: 'play', isBomb: false, beaten: null, at: 2000 };
  assert.equal(classifyGameEvent(lead, 1500).kind, 'play');
});

test('passes, finishes, and game over classify correctly', () => {
  assert.equal(classifyGameEvent({ type: 'pass' }, null).kind, 'pass');
  assert.equal(classifyGameEvent({ type: 'finish', placement: 1 }, null).kind, 'finish');
  assert.equal(classifyGameEvent({ type: 'game-over' }, null).kind, 'win');
  assert.equal(classifyGameEvent({ type: 'unknown' }, null), null);
  assert.equal(classifyGameEvent(null, null), null);
});

test('tempelan results show accepted or rejected feedback', () => {
  const accepted = classifyGameEvent({ type: 'tempelan-accepted' }, null);
  const rejected = classifyGameEvent({ type: 'tempelan-rejected' }, null);

  assert.equal(accepted.kind, 'tempelanAccepted');
  assert.equal(accepted.sound, 'tempelAccept');
  assert.equal(rejected.kind, 'tempelanRejected');
  assert.equal(rejected.sound, 'tempelReject');
});

test('tempelan-resolved plays keep the result banner instead of a slam', () => {
  const event = {
    type: 'play',
    isBomb: true,
    beaten: { type: 'single' },
    tempelan: { accepted: true },
    at: 2000,
  };
  const effect = classifyGameEvent(event, 1500);

  assert.equal(effect.kind, 'play');
  assert.equal(effect.sound, 'card');
});

test('self bombs trigger the explosion effect', () => {
  const effect = classifyGameEvent(
    { type: 'self-bomb', playerName: 'A', cards: ['2S'], at: 1000 },
    null,
  );

  assert.equal(effect.kind, 'selfBomb');
  assert.equal(effect.sound, 'bomb');
});

test('bomb battles trigger the explosion effect', () => {
  const effect = classifyGameEvent(
    {
      type: 'bomb-battle',
      playerName: 'A',
      bombs: [{ playerIndex: 0, cards: ['5S', '5H', '5D', '5C'] }],
      at: 1000,
    },
    null,
  );

  assert.equal(effect.kind, 'bombBattle');
  assert.equal(effect.sound, 'bomb');
});

test('last play timestamp updates only on play events', () => {
  assert.equal(nextLastPlayAt({ type: 'play', at: 123 }, null), 123);
  assert.equal(nextLastPlayAt({ type: 'pass', at: 456 }, 123), 123);
});
