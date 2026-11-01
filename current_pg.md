# Current Progress

Last updated: 2026-11-02

## Overall status

| Phase | Name | Status |
| :---: | :--- | :--- |
| 0 | Project Setup & Scaffolding | Done |
| 1 | Core Game Engine | Not started |
| 2 | Session Flow & Opening Rules | Not started |
| 3 | Multiplayer Server | Not started |
| 4 | Frontend UI | Not started |
| 5 | Tempelan | Not started |
| 6 | Bots (AI) | Not started |
| 7 | Polish & LAN Testing | Not started |

Legend: `Not started` · `In progress` · `Done`

## Repository

- Remote: https://github.com/hanifrhmn/poker_tempel
- Branch: `main`
- Docs: `PRD.md`, `Timeline.md`, `current_pg.md`

## Phase 0 — Project Setup & Scaffolding

Status: **Done**

Built:
- npm workspaces monorepo: `client/`, `server/`, `shared/` (`@poker-tempel/*`)
- React 19 + Vite 8 + Tailwind CSS 4 client with a themed placeholder landing page
- Express 5 + Socket.io 4 server with `/api/health` and a `server:hello` event
- Shared package exporting game constants (`GAME_NAME`, `MAX_PLAYERS`, `HAND_SIZE`, `DISCONNECT_BOT_TAKEOVER_MS`)
- Dev: `npm run dev` runs server (`node --watch`) and Vite concurrently; `/api` and `/socket.io` proxied to port 3000
- Prod: `npm run build` then `npm start`; server serves `client/dist` with SPA fallback
- Root `.gitignore` and `README.md`

Verified:
- `npm install`, `npm run build`, `npm start` → `/api/health` returns `ok`, built page served with 200
- `npm run dev` → Vite on `:5173`, proxied health check `ok`, Socket.io connection works

Decisions:
- Plain JavaScript with ESM (no TypeScript) to keep the build simple
- Tailwind v4 via `@tailwindcss/vite` (no PostCSS config needed)
- Server is authoritative; clients will never receive other players' hands

Notes: Vite dev binds localhost only — game-night play uses the production server on `0.0.0.0:3000`.

## How this file is maintained

After each phase completes:
1. Move the phase status to **Done** in the table.
2. Tick the phase checklist and record what was actually built.
3. Add any decisions, deviations from `Timeline.md`, or follow-ups discovered.
4. Update the `Last updated` date.
5. Commit together with the phase's code and push.
