const STORAGE_KEY = 'poker-tempel:sound';

let context = null;
let noise = null;
let enabled = loadEnabled();

function loadEnabled() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isSoundEnabled() {
  return enabled;
}

export function setSoundEnabled(value) {
  enabled = Boolean(value);
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    return;
  }
  if (enabled) {
    initAudio();
    playSound('turn');
  }
}

export function initAudio() {
  if (typeof window === 'undefined') return;
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context = new AudioContext();
  }
  if (context.state === 'suspended') {
    context.resume().catch(() => {});
  }
}

function getNoise() {
  if (noise) return noise;
  const length = Math.floor(context.sampleRate * 1.2);
  noise = context.createBuffer(1, length, context.sampleRate);
  const data = noise.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    data[index] = Math.random() * 2 - 1;
  }
  return noise;
}

function tone({
  frequency,
  endFrequency,
  duration,
  when = 0,
  type = 'sine',
  gain = 0.08,
}) {
  const start = context.currentTime + when;
  const oscillator = context.createOscillator();
  const volume = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, start + duration);
  }

  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(volume).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.05);
}

function burst({ duration = 0.15, when = 0, gain = 0.08, frequency = 1200, type = 'highpass' }) {
  const start = context.currentTime + when;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();

  source.buffer = getNoise();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(gain, start);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  source.connect(filter).connect(volume).connect(context.destination);
  source.start(start);
  source.stop(start + duration + 0.05);
}

export function playSound(name) {
  if (!enabled || !context || context.state !== 'running') return;

  switch (name) {
    case 'card':
      burst({ duration: 0.07, gain: 0.05, frequency: 1800 });
      tone({ frequency: 720, endFrequency: 520, duration: 0.08, gain: 0.03, type: 'triangle' });
      break;
    case 'pass':
      tone({ frequency: 220, endFrequency: 170, duration: 0.12, gain: 0.04, type: 'triangle' });
      break;
    case 'turn':
      tone({ frequency: 660, duration: 0.1, gain: 0.05 });
      tone({ frequency: 990, duration: 0.14, gain: 0.045, when: 0.09 });
      break;
    case 'slam':
      burst({ duration: 0.18, gain: 0.09, frequency: 700 });
      tone({ frequency: 150, endFrequency: 60, duration: 0.22, gain: 0.09, type: 'sine' });
      break;
    case 'tempelAccept':
      [660, 880, 1320].forEach((frequency, index) => {
        tone({ frequency, duration: 0.16, gain: 0.05, when: index * 0.09, type: 'triangle' });
      });
      break;
    case 'tempelReject':
      tone({ frequency: 330, endFrequency: 180, duration: 0.32, gain: 0.07, type: 'sawtooth' });
      burst({ duration: 0.18, gain: 0.05, frequency: 500, type: 'lowpass' });
      break;
    case 'bomb':
      burst({ duration: 0.55, gain: 0.16, frequency: 400, type: 'lowpass' });
      tone({ frequency: 90, endFrequency: 35, duration: 0.65, gain: 0.18, type: 'sine' });
      tone({ frequency: 180, endFrequency: 50, duration: 0.35, gain: 0.08, type: 'sawtooth', when: 0.03 });
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone({ frequency, duration: 0.16, gain: 0.055, when: index * 0.11, type: 'triangle' });
      });
      break;
    default:
      break;
  }
}
