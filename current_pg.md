# Current Progress

Last updated: 2026-11-02

## Overall status

| Phase | Name | Status |
| :---: | :--- | :--- |
| 0 | Project Setup & Scaffolding | Done |
| 1 | Core Game Engine | Done |
| 2 | Session Flow & Opening Rules | Done |
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

## Phase 2 — Session Flow & Opening Rules

Status: **Done**

Built in `shared/src/session.js`:
- Session state machine: `lobby → dealing → playing → round-end → game-end`
- `createSession` — 4 players, optional `maxRounds`, configurable `scoreTable`
- Round 1 opening: deal 13 each, **every player discards all their 3s**, the **3♠ holder leads** and can play any legal combo; an `opening-threes` log entry records each player's discarded cards and the leader
- Later rounds: fresh 52-card deal, **previous round's 1st-place player leads**, no 3-discarding
- `play`/`pass` wrappers delegate to the engine and auto-complete the round when all players finish
- Round results: finish order, per-player score, wins, and placement history; `lastRoundResult`
- `maxRounds` auto-ends the session; `endSession` lets the host end from lobby/round-end (not mid-round)
- `getStandings` sorts by score, then wins, then seat

Verified:
- `npm test` → 37/37 passing (8 new session tests)
- Scripted full sessions run end-to-end without UI: single-card strategy completes round 1, transitions to round 2 with the winner leading, and accumulates scores correctly

Decisions:
- Opening "give out all 3s" interpreted as **discard all rank-3 cards before the first trick** (known Capsa variant), leaving 48 cards in play for round 1
- Scoring table is a placeholder (PRD defines no points): 1st = 3, 2nd = 2, 3rd = 1, 4th = 0; overridable via `scoreTable`
- Session logic lives in `shared/` so the Phase 3 server remains authoritative and can reuse it directly

## Rule revisions

### Tempelan v2 (2026-11-02)

PRD §2.7 and Timeline.md Phase 5 updated to the clarified rules (implementation pending in Phase 5):

- Tempel button is always available — every turn, whether beating or leading a fresh trick
- Main hand: any valid combo under normal play rules
- Attach exactly one extra valid hand of any rank/type (e.g. `Q + K`, `Q + pair of 4s`, `Q + polo`); bombs cannot be attached
- Voters: the other players still in the game — players who already finished cannot vote
- All yes → accepted: attached hand survives and becomes the active combo the next player must beat
- Any no → rejected: only the attached hand returns to the player's hand; the main hand stays as the active play
- Turn passes to the next active player after resolution; timeout counts as rejection
- Engine impact for Phase 5: needs a pending-vote state, both hands removed at play time, and attached-hand rollback on rejection (accepted play replaces the active combo with the attached combination)

## Planned enhancements (approved, not yet built)

- **Effect-ready event design (Phase 3):** one socket event per action (`play`, `pass`, `trick-reset`, `finish`, `game-over`) with seat, cards, combo type, beaten combo, timestamps, and an explicit bomb flag; serialize public state (Sets → arrays)
- **Effects stack (Phase 7):** CSS keyframes + Web Audio API only (no animation library, no external CDNs); sounds for card play, turn alert, bomb, and win; explosion effect on bomb plays; slam effect on fast beats using event timing; effects also fire on bot turns

## How this file is maintained

After each phase completes:
1. Move the phase status to **Done** in the table.
2. Tick the phase checklist and record what was actually built.
3. Add any decisions, deviations from `Timeline.md`, or follow-ups discovered.
4. Update the `Last updated` date.
5. Commit together with the phase's code and push.
