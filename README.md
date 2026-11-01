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

## Tests

```bash
npm test
```

## Production build (LAN game night)

```bash
npm run build
npm start
```

Host setup:
1. Run the commands above on the host machine.
2. Find the host's Radmin/ZeroTier IPv4 (`ipconfig`).
3. Allow Node.js / TCP port `3000` through Windows Firewall if prompted.
4. Open `http://<host-ip>:3000`, create a room, and share the invite link.
5. Friends open the link or enter the room code.

In-game:
- Round 1 starts with a visible reveal of everyone's 3s; the 3♠ holder is highlighted before leading.
- Click cards to select, then **Play** (or **Pass** / **Deselect**).
- **Tempel** attaches one extra hand to your play; every active player votes, and the result appears on screen with a sound.
- Sound can be toggled in the header (or on the home screen). Audio starts after your first click or keypress.
- If someone disconnects, their seat becomes a bot after 15 seconds; reconnecting from the same browser restores control.

Environment variables: `PORT` (default `3000`), `HOST` (default `0.0.0.0`).

Troubleshooting:
- Friends cannot connect? Verify the host IP, VPN membership, and that Windows Firewall allows TCP port `3000`.
- Dev mode serves Vite on `:5173`; use the production commands above for game night.

## Docs

- `PRD.md` — product requirements
- `Timeline.md` — build phases
- `current_pg.md` — live progress tracker
