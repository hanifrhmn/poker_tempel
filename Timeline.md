# Poker Tempel — Build Timeline

Real-time 4-player Big Two (Capsa Banting) web game for LAN play over Radmin VPN / ZeroTier.
Stack: **React + Vite + Tailwind** (client) · **Node.js + Express + Socket.io** (server) · **shared game engine**.

Each phase ships a working commit pushed to `main`. Progress is tracked in `current_pg.md`.

---

## Phase 0 — Project Setup & Scaffolding

**Goal:** A runnable skeleton of the monorepo.

- npm workspaces: `client/`, `server/`, `shared/`
- Vite + React + Tailwind setup with a placeholder landing screen
- Express + Socket.io server with health check
- Shared game-logic package wired into both sides
- Dev scripts: `npm run dev` (client + server concurrently), `npm run build`, `npm start`
- Server serves the built client in production mode; Vite proxies `/socket.io` in dev
- `.gitignore`, base `README.md`

**Done when:** `npm run dev` serves the placeholder page, `/api/health` responds, and `npm run build && npm start` works.

---

## Phase 1 — Core Game Engine (shared)

**Goal:** Pure, testable Big Two rules with no UI or networking.

- Card model: rank order `3 < 4 < ... < K < A < 2`; suits only matter for first-move and Seri matching
- Deck creation, shuffle, deal (13 cards × 4 players)
- Combination detection & validation:
  - Satuan, Duaan, Tigaan
  - Seri (3 consecutive ranks, identical suit only)
  - Polo, Polo Seri
  - Four of a Kind, Straight Flush
  - `2-3-4` wrap (2 is lowest; Ace highest in that sequence); standard 5-card straights disabled
- Comparison rules for each combination
- Bomb rules: bombs only cut a **single 2**; cannot bomb pairs/thrice/polo/5-card hands
- Trick flow: beat-or-pass, 3 consecutive passes reset the trick, last player leads
- Finish order (1st–4th); game ends when all 4 players are out
- Unit tests for every combination, comparison, and edge case

**Done when:** all engine tests pass, including bomb restrictions and 2-3-4 wrap.

---

## Phase 2 — Session Flow & Opening Rules

**Goal:** Multi-round game lifecycle on top of the engine.

- Game 1 opening: all players play their 3s; holder of **3♠** leads (can play anything)
- Subsequent rounds: previous round's 1st-place player leads
- Round/score tracking across games
- Server-side state machine: `lobby → dealing → playing → round-end → game-end`

**Done when:** a scripted 4-player game runs end-to-end server-side without UI.

---

## Phase 3 — Multiplayer Server

**Goal:** Socket.io rooms and authoritative state sync.

- Room create/join (4 slots), host assignment, join codes/links
- Lobby events: add bot, remove bot, start game
- Authoritative game state per room; broadcast only each player's own hand
- Actions: `play`, `pass`, `deselect`-free (engine validates)
- Turn timer + auto-pass/turn enforcement; action log feed
- Reconnection handling: 15s grace, then slot converts to bot
- Server tests for room lifecycle and illegal action rejection

**Done when:** 4 browser tabs (or Socket.io clients) can play a full game.

---

## Phase 4 — Frontend UI

**Goal:** Playable, readable game table.

- Lobby: room link/join code, 4 slots with ready/host state, add-bot buttons, start button
- In-game layout:
  - Center: active combo, trick info, turn timer, action log
  - Bottom: own hand, auto-sorted, click/drag selection, Play / Pass / Deselect
  - Left/Top/Right opponent panels: avatar, card count, status (Thinking/Passed/Done), rank badge
- Game-end screen with placements
- Responsive + connection status banner

**Done when:** a full game is playable via UI in 4 tabs.

---

## Phase 5 — Tempelan

**Goal:** House rule for stacking a low card under a high single.

- Tempel button appears when the played single is J/Q/K/A (per PRD)
- Attach one lower-rank card; both are played together
- Other 3 players get a Yes/No vote; all yes → accepted, any no → cards return to hand
- Vote timer + timeout behavior (default: reject on timeout)
- UI states for pending/success/failed tempelan

**Done when:** tempelan can be accepted and rejected, with correct state rollback.

---

## Phase 6 — Bots (AI)

**Goal:** Rule-based bots that keep games moving.

- Bots fill empty slots anytime from the lobby
- State machine per PRD §5:
  - Leading: lowest valid combo (must include 3♠ on game 1 opening)
  - Responding: lowest combo that beats the table
  - Single 2 on table + bomb in hand: 50% bomb chance
  - Otherwise pass
- Disconnect takeover: bot plays for disconnected player after 15s
- Bot actions paced with a short "thinking" delay

**Done when:** a human + 3 bots can complete a full game.

---

## Phase 7 — Polish & LAN Testing

**Goal:** Game-night ready.

- Animations and sound effects (card play, turn alert, win)
- Connection quality indicators and reconnect UX
- Visual polish: card faces, table felt, mobile/desktop layout pass
- End-to-end test over Radmin VPN / ZeroTier IPv4 (`http://<IP>:3000`)
- Bug fixes, edge-case audit against PRD, final `current_pg.md` update

**Done when:** 4 real players complete a game on LAN with no stalls.

---

## Dependencies

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7
```

Phase 1 can be developed independently; Phase 6 depends on Phases 1–3. Phases 4 and 5 assume Phase 3 room/action plumbing.
