import { GAME_NAME } from '@poker-tempel/shared';
import { createPokerServer } from './server.js';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const { httpServer, hasClientBuild } = createPokerServer();

httpServer.listen(PORT, HOST, () => {
  const shownHost = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`[server] ${GAME_NAME} listening on http://${shownHost}:${PORT}`);
  if (hasClientBuild) {
    console.log('[server] serving built client from client/dist');
  } else {
    console.log('[server] no client build found - run "npm run build" for production mode');
  }
});
