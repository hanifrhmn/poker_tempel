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

test('last play timestamp updates only on play events', () => {
  assert.equal(nextLastPlayAt({ type: 'play', at: 123 }, null), 123);
  assert.equal(nextLastPlayAt({ type: 'pass', at: 456 }, 123), 123);
});
