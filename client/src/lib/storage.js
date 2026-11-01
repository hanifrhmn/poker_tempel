const IDENTITY_KEY = 'poker-tempel:identity';
const NAME_KEY = 'poker-tempel:name';

export function loadIdentity() {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity) {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    return;
  }
}

export function clearIdentity() {
  try {
    localStorage.removeItem(IDENTITY_KEY);
  } catch {
    return;
  }
}

export function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    return;
  }
}

export function getRoomFromUrl() {
  return (new URLSearchParams(window.location.search).get('room') || '').toUpperCase();
}

export function setRoomInUrl(code) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('room', code);
  else url.searchParams.delete('room');
  window.history.replaceState({}, '', url);
}
