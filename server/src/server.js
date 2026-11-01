import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, MAX_PLAYERS } from '@poker-tempel/shared';
import express from 'express';
import { Server } from 'socket.io';
import { createRoomManager } from './room-manager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');

export function createPokerServer(options = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const manager = createRoomManager(options);

  const hasClientBuild = existsSync(path.join(clientDist, 'index.html'));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      game: GAME_NAME,
      maxPlayers: MAX_PLAYERS,
      uptime: Math.round(process.uptime()),
    });
  });

  if (hasClientBuild) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  function broadcastState(room) {
    for (const slot of room.slots) {
      if (!slot?.connected || !slot.socketId) continue;
      io.to(slot.socketId).emit('room:state', manager.getStateFor(room, slot.playerId));
    }
  }

  manager.onUpdate(broadcastState);
  manager.onEvent((room, event) => {
    io.to(room.code).emit('game:event', { code: room.code, event });
  });

  io.on('connection', (socket) => {
    socket.emit('server:hello', { message: `Welcome to ${GAME_NAME}` });

    const reply = (callback, result) => {
      if (typeof callback === 'function') callback(result);
    };

    const roomAction = (handler) => (payload = {}, callback) => {
      if (!socket.data?.code || !socket.data?.playerId) {
        reply(callback, { ok: false, error: 'Not in a room' });
        return;
      }

      let result;
      try {
        result = handler(payload);
      } catch (error) {
        result = { ok: false, error: error.message };
      }
      reply(callback, result);
    };

    socket.on('room:create', (payload = {}, callback) => {
      const result = manager.createRoom({ name: payload.name, socketId: socket.id });
      if (result.ok) {
        socket.data = { code: result.code, playerId: result.playerId };
        socket.join(result.code);
      }
      reply(callback, result);
    });

    socket.on('room:join', (payload = {}, callback) => {
      const result = manager.joinRoom({
        code: payload.code,
        name: payload.name,
        playerId: payload.playerId,
        socketId: socket.id,
      });
      if (result.ok) {
        socket.data = { code: result.code, playerId: result.playerId };
        socket.join(result.code);
      }
      reply(callback, result);
    });

    socket.on(
      'room:addBot',
      roomAction(() => manager.addBot({ code: socket.data.code, playerId: socket.data.playerId })),
    );

    socket.on(
      'room:removeBot',
      roomAction((payload) =>
        manager.removeBot({
          code: socket.data.code,
          playerId: socket.data.playerId,
          seat: payload.seat,
        }),
      ),
    );

    socket.on(
      'room:start',
      roomAction(() => manager.startGame({ code: socket.data.code, playerId: socket.data.playerId })),
    );

    socket.on(
      'room:nextRound',
      roomAction(() =>
        manager.nextRound({ code: socket.data.code, playerId: socket.data.playerId }),
      ),
    );

    socket.on(
      'room:endSession',
      roomAction(() =>
        manager.endSession({ code: socket.data.code, playerId: socket.data.playerId }),
      ),
    );

    socket.on(
      'game:play',
      roomAction((payload) =>
        manager.play({
          code: socket.data.code,
          playerId: socket.data.playerId,
          cards: payload.cards,
        }),
      ),
    );

    socket.on(
      'game:pass',
      roomAction(() => manager.pass({ code: socket.data.code, playerId: socket.data.playerId })),
    );

    socket.on('room:leave', (payload = {}, callback) => {
      if (!socket.data?.code || !socket.data?.playerId) {
        reply(callback, { ok: false, error: 'Not in a room' });
        return;
      }

      const code = socket.data.code;
      const result = manager.leaveRoom({
        code,
        playerId: socket.data.playerId,
        socketId: socket.id,
      });

      if (result.ok) {
        socket.leave(code);
        socket.data = {};
      }
      reply(callback, result);
    });

    socket.on('disconnect', () => {
      manager.handleDisconnect({ socketId: socket.id });
    });
  });

  async function close() {
    manager.close();
    await new Promise((resolve) => io.close(resolve));
  }

  return { app, httpServer, io, manager, hasClientBuild, close };
}
