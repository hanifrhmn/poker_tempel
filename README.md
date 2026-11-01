# Poker Tempel

Real-time 4-player Big Two (Capsa Banting) web game for LAN play over Radmin VPN / ZeroTier.

## Stack

- **Client:** React + Vite + Tailwind CSS
- **Server:** Node.js + Express + Socket.io
- **Shared:** game engine and rules used by both sides

## Development

```bash
npm install
npm run dev
```

- Client (dev): http://localhost:5173
- Server: http://localhost:3000
- Health check: http://localhost:3000/api/health

## Production build (LAN game night)

```bash
npm run build
npm start
```

Then open `http://<your Radmin/ZeroTier IPv4>:3000` on every player's machine.

Environment variables: `PORT` (default `3000`), `HOST` (default `0.0.0.0`).

## Docs

- `PRD.md` — product requirements
- `Timeline.md` — build phases
- `current_pg.md` — live progress tracker
