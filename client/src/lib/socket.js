import { io } from 'socket.io-client';

export const socket = io();

export function emitAck(event, payload = {}) {
  return new Promise((resolve) => {
    socket.timeout(5000).emit(event, payload, (error, response) => {
      if (error) {
        resolve({ ok: false, error: 'Server did not respond' });
        return;
      }
      resolve(response ?? { ok: false, error: 'Empty response' });
    });
  });
}
