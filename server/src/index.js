import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_NAME, MAX_PLAYERS } from '@poker-tempel/shared';
import express from 'express';
import { Server } from 'socket.io';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../../client/dist');
const hasClientBuild = existsSync(path.join(clientDist, 'index.html'));

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

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

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);
  socket.emit('server:hello', { message: `Welcome to ${GAME_NAME}` });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected ${socket.id} (${reason})`);
  });
});

httpServer.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`[server] ${GAME_NAME} listening on http://${shownHost}:${PORT}`);
  if (hasClientBuild) {
    console.log('[server] serving built client from client/dist');
  } else {
    console.log('[server] no client build found - run "npm run build" for production mode');
  }
});
