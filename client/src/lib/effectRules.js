export const SLAM_WINDOW_MS = 2500;

export function classifyGameEvent(event, lastPlayAt = null) {
  if (!event) return null;

  if (event.type === 'play') {
    const delta = lastPlayAt === null ? Infinity : event.at - lastPlayAt;
    if (event.isBomb) return { kind: 'bomb', sound: 'bomb', delta };
    if (event.beaten && delta <= SLAM_WINDOW_MS) {
      return { kind: 'slam', sound: 'slam', delta };
    }
    return { kind: 'play', sound: 'card', delta };
  }

  switch (event.type) {
    case 'tempelan-play':
      return { kind: 'play', sound: 'card', delta: null };
    case 'pass':
      return { kind: 'pass', sound: 'pass', delta: null };
    case 'trick-reset':
      return { kind: 'reset', sound: null, delta: null };
    case 'finish':
      return { kind: 'finish', sound: 'win', delta: null };
    case 'game-over':
      return { kind: 'win', sound: null, delta: null };
    default:
      return null;
  }
}

export function nextLastPlayAt(event, lastPlayAt = null) {
  return event?.type === 'play' ? event.at : lastPlayAt;
}
