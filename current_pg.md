# Current Progress

Last updated: 2026-11-02

## Overall status

| Phase | Name | Status |
| :---: | :--- | :--- |
| 0 | Project Setup & Scaffolding | Done |
| 1 | Core Game Engine | Done |
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

## Phase 1 — Core Game Engine

Status: **Done**

Built in `shared/src/`:
- `cards.js` — rank order `3 < 4 < ... < K < A < 2`, suits `S/H/D/C`, deck creation, Fisher–Yates shuffle, 4×13 deal, auto-sort (rank then suit), card key/label helpers
- `combinations.js` — detection + validation for Satuan, Duaan, Tigaan, Seri, Polo, Polo Seri, Four of a Kind, Straight Flush; comparison rules; bomb restrictions; `canPlayCombination` guard
- `game.js` — 4-player authoritative state machine: turns, play/pass, trick reset, finished-player skipping, placements, action log; accepts injected hands for deterministic testing
- Unit tests in `shared/test/` (29 tests) covering cards, every combination, comparisons, bombs, trick flow, finishing order, and a full simulated game

Verified:
- `npm test` → 29/29 passing
- Full 52-card simulation ends with all four placements assigned and no stalls

Rule interpretations (documented decisions):
- **Seri comparison** requires the same suit (PRD: "must match exact suit structure") and a higher top rank; **Polo Seri** compares only its 3-card straight component (no suit match required).
- **2-3-4 wrap** treats `2` as the lowest sequence card (`2-3-4` valid, `K-A-2` invalid) for both Seri and 5-card Straight Flush; Ace stays the highest sequence card.
- **Bombs** can never be led. They may beat a single `2` or a higher bomb of the same class (`4-of-a-kind` vs `4-of-a-kind`, `SF` vs `SF`); `SF` and `4-of-a-kind` cannot beat each other. This reconciles PRD §2.4 target rule with the table's "beaten by higher" entries.
- **Trick reset** happens when every other active player has passed (3 passes with 4 players, fewer once players finish), preventing deadlocks in endgame.
- If the last player to play has already finished, the lead passes to the next active player.
- Placements are assigned as hands empty; the game runs until all four players finish (last player plays out their remaining cards).

## How this file is maintained

After each phase completes:
1. Move the phase status to **Done** in the table.
2. Tick the phase checklist and record what was actually built.
3. Add any decisions, deviations from `Timeline.md`, or follow-ups discovered.
4. Update the `Last updated` date.
5. Commit together with the phase's code and push.
