# Current Progress

Last updated: 2026-11-02

## Overall status

| Phase | Name | Status |
| :---: | :--- | :--- |
| 0 | Project Setup & Scaffolding | Done |
| 1 | Core Game Engine | Done |
| 2 | Session Flow & Opening Rules | Done |
| 3 | Multiplayer Server | Done |
| 4 | Frontend UI | Done |
| 5 | Tempelan | Done |
| 6 | Bots (AI) | Done |
| 7 | Polish & LAN Testing | Done |

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

## Phase 3 — Multiplayer Server

Status: **Done**

Built in `server/src/`:
- `room-manager.js` — in-memory room lifecycle: 5-char room codes, create/join, host control, add/remove bots, start game, play/pass, next round, end session, leave, disconnect handling, turn/bot timers
- `bot.js` — minimal rule-based controller (lowest single or pass) for lobby bots and disconnect takeover; full AI stays in Phase 6
- `server.js` — Socket.io wiring, Express health/static serving, personalized `room:state` broadcasts, `game:event` feed
- `index.js` — production bootstrap

Socket API:
- Client → server: `room:create`, `room:join` (with `playerId` for reconnect), `room:addBot`, `room:removeBot`, `room:start`, `room:nextRound`, `room:endSession`, `room:leave`, `game:play`, `game:pass`
- Server → client: `room:state` (personalized; only `you.hand` is included) and `game:event` (one event per action)
- All actions use ack callbacks with `{ ok, error? }`

Authoritative state & privacy:
- The server owns the session/engine; clients receive their own hand plus public info only (turn, active play, card counts, placements, scores, log)
- `room:state` carries a monotonic `version` so pushes can be ordered/deduped
- Internal engine Sets are never serialized

Timers & reconnection:
- Turn timer (default 30s): auto-pass when responding, auto-play the lowest single when leading
- Bots act after a short pacing delay; lobby bots play automatically
- Disconnect: 15s grace, then the seat becomes bot-controlled; reconnecting with the stored `playerId` restores human control
- Host transfers to the next connected human on disconnect/leave; leaving mid-game converts the seat to a bot; abandoned rooms are deleted

Effect-ready events:
- Play events include `cards`, `combinationType`, `isBomb`, `beaten` (type/cards/primary rank/value/suit), and an `at` timestamp
- `game-start`, `opening-threes`, `pass`, `trick-reset`, `finish`, and `game-over` are emitted in order for future sound/animation effects

Verified:
- `npm test` → 54/54 passing (37 shared + 17 server)
- Four Socket.io clients create/join/start and play a complete round with private hands, then advance to round 2 with the winner leading
- Timeout auto-play/pass, disconnect takeover, reconnect, host transfer, lobby leave, and effect events are covered by tests
- Production `npm start` serves `/api/health` and the built client

Decisions:
- `playerId` doubles as the reconnect secret (stored client-side in Phase 4) and is never shown to other players
- Disconnected humans keep seat ownership during the grace period and can reclaim a bot-controlled seat; explicit leave relinquishes ownership
- Bots are intentionally minimal in this phase (lowest single/pass) and will be upgraded in Phase 6

## Phase 4 — Frontend UI

Status: **Done**

Built in `client/src/`:
- `hooks/useRoom.js` — socket lifecycle, identity persistence, auto-rejoin on reload/reconnect, action wrapper with error toasts
- `HomeScreen` — name entry, create room, join by 5-char code, invite-link prefill via `?room=CODE`
- `LobbyScreen` — four seat cards with host/bot/online badges, add/remove bots (host), invite link with clipboard fallback for plain-HTTP LAN, start button gated on a full table
- `GameScreen` — hand dock with click selection, Deselect/Pass/Play, live combination validation, opponent panels, active play, turn timer, action log, responsive table layout
- `RoundEndOverlay` — placement list with round points and totals, host "Next round"/"End session"
- `GameEndOverlay` — final standings by score, back to home
- Shared components: `CardFace`, `PlayerPanel`, `ActionLog`, `TurnTimer`, `RoomHeader`, `ConnectionBanner`, `ErrorToast`, `CopyLinkButton`, `Button`

Client behavior:
- Own hand rendered from `room.you.hand`; opponents only expose counts/status (server privacy preserved)
- Hand auto-sorted by rank/suit; selection validated with the shared engine (`detectCombination` + `canPlayCombination`) for instant UX, server re-validates every action
- Player statuses: Your turn / Thinking / Passed / Waiting / Done, with 1st–4th badges and bot/offline indicators
- Turn timer driven by server `turnDeadline` + newly exposed `turnTimeoutMs`; turns auto-play/pass server-side
- Identity (`code`, `playerId`, `name`) stored in `localStorage`; refresh/reconnect auto-rejoins the same seat; leaving clears it
- Invite links work over Radmin/ZeroTier IPs; copy uses `navigator.clipboard` with a `execCommand` fallback on insecure origins
- Connection banner on socket loss; error toast for rejected actions

Server additions:
- `room:state` now exposes `turnTimeoutMs` and `passedSeats` (public info only)

Verified:
- `npm run build` → production bundle (290.6 kB JS / 89.7 kB gzip, 32.4 kB CSS)
- `npm test` → 54/54 passing
- Production smoke test: health OK, built client served, Socket.io create-room returns a lobby state with `turnTimeoutMs`
- Browser-level 4-tab playthrough deferred to Phase 7 LAN testing (no browser available in this environment)

Decisions:
- No separate "ready" toggle — all connected players are considered ready and the host starts once seats are filled
- Effects/sounds still deferred to Phase 7; the client already receives `game:event` payloads needed for them

## Phase 5 — Tempelan

Status: **Done**

Engine (`shared/src/game.js`):
- `startTempelan` — validates turn, main play, attached combo, and rejects attached bombs; main can be any legal combo (including a bomb on a single 2), leading or responding; both hands leave the hand immediately and a pending vote is stored
- Voters are the active players except the tempeler; finished players never vote
- `submitTempelanVote` — records votes; the first **no** rejects immediately, all **yes** accepts; `resolvePendingTempelan` handles forced rejection (timeout)
- Accepted → attached hand becomes the active combo; rejected → only the attached hand returns to hand and the main stays active
- Placement/finish only resolves on acceptance when the hand empties
- Emits `tempelan-play`, `tempelan-vote`, `tempelan-accepted`, `tempelan-rejected`, then a normal `play` event; active play carries `tempelan` metadata (`main`, `attached`, `accepted`)
- `playCards` / `passTurn` are blocked while a vote is pending
- Session wrappers (`playTempelan`, `castTempelanVote`, `resolveTempelanVote`) complete the round if resolution ends the game

Server (`server/src/`):
- Room actions `playTempelan` / `castTempelanVote`; socket events `game:tempelan` and `game:tempelanVote`
- 15s vote window (`tempelVoteTimeoutMs`); timeout rejects; the turn timer is paused during the vote and restarts after resolution
- Bots vote after a short delay via `chooseBotVote`: accept when the attached primary rank is ≤ the main primary rank, reject when higher (Q+4 passes, Q+K usually fails)
- `room:state` now exposes `pendingTempelan` (main/attached/voters/votes), `tempelDeadline`, and `tempelVoteTimeoutMs`
- Disconnect takeover adds newly bot-controlled voters to a pending vote

Client (`client/src/`):
- Tempel flow: select a legal main hand → **Tempel** → main cards lock with a sky ring → select exactly one attached hand → **Play tempelan**
- Tempel button is always visible; disabled until the main selection is playable and extra cards remain
- Pending-vote overlay for everyone: main + tempelan cards, combination labels, per-player Yes/No/Waiting, countdown, Accept/Reject for eligible voters, waiting states for the tempeler and finished players
- Action log entries for tempelan play/vote/accept/reject; board shows the accepted/rejected metadata; hand is locked while voting

Verified:
- `npm test` → 68/68 passing (45 shared + 23 server)
- Engine: validation, accept/reject behavior, finish only on acceptance, finished voters excluded, solo auto-accept, bomb main on a single 2
- Server: timer pause, all-yes accept, no-vote rejection, timeout rejection, bot auto-votes, and a Socket.io tempelan accept flow
- `npm run build` and production smoke test pass

Decisions:
- A single no resolves rejection immediately; remaining votes are unnecessary. Timeout rejects.
- Vote deadline starts when the tempelan is played and is not extended by incoming votes.
- Bot voting is intentionally simple for now (rank comparison); Phase 6 can refine it.
- Main and attached card sets must be disjoint; the attached hand must be exactly one valid combination and cannot be a bomb.

## Phase 6 — Bots (AI)

Status: **Done**

Built:
- `shared/src/combinations.js` — `enumeratePlayableCombinations(hand, active)` enumerates every legal 1–5 card combination from a hand for the current table using the existing detector/comparison rules
- `server/src/bot.js` — `chooseBotMove` now plays real Big Two:
  - **Leading:** lowest valid combination by primary rank; more cards win ties, so a pair/triple of the lowest rank is preferred over its single
  - **Responding:** lowest valid combination that beats the table, including pairs, triples, seri, polo, polo seri, and straight flush
  - **Bombing:** a single `2` on the table triggers a 50% bomb attempt (injectable RNG); when bombing, the lowest bomb is chosen
  - **Bomb chaining:** if the table is already a bomb, play the lowest higher same-class bomb
  - Passes when nothing legal beats the table; never leads a bomb (engine-enforced)
- Lobby bots and disconnect takeover automatically use the improved AI; the pacing delay stays configurable (`botDelayMs`, 800ms default)
- Tempelan voting keeps the Phase 5 heuristic (accept if the attached primary rank is ≤ the main rank)

Opening note:
- Round 1 discards all 3s and the 3♠ holder leads, so PRD §5's "lead with the 3♠ combo" is covered by the session opening rule; bots lead their lowest valid combination when they open.

Verified:
- `npm test` → 77/77 passing (47 shared + 30 server)
- Enumerator tests: leading excludes bombs and only responses that beat the table are returned
- Bot tests: lowest pair/triple leads, pair/seri/polo/straight-flush responses, 50% bomb on a single 2 (both outcomes), no bomb leads, bomb chaining, and four bots completing a full game
- Room-manager test: a human + 3 bots complete a full round with real timers
- `npm run build` passes (client bundle unchanged; enumerator is tree-shaken from the browser build)

Decisions:
- "Lowest combination" is ordered by primary rank, with more cards preferred on ties; this keeps leads conservative while allowing the bot to shed pairs/triples of its lowest rank
- Bots do not initiate tempelan (not required by PRD §5); they still vote on them
- Bot decisions remain synchronous and side-effect free; randomness is injectable for deterministic tests

## Phase 7 — Polish & LAN Testing

Status: **Done** (implementation verified; physical 4-player Radmin/ZeroTier run is the only remaining manual step)

Built:
- **Sound** (`client/src/lib/audio.js`) — Web Audio API synthesis with no external assets or CDNs: card play, pass, turn alert, slam, bomb, and win sounds. Mute toggle persists in `localStorage`; audio unlocks on the first click/keypress.
- **Effects** (`useGameEffects`, `GameEffects`, `effectRules`):
  - active cards animate in; hands deal with a staggered animation
  - **bomb explosion** overlay with screen shake and boom sound
  - **slam** effect on beats within 2.5s, using server event timestamps
  - finish popup + win jingle; all effects also fire on bot turns
- **Connection quality** — `client:ping`/ack RTT measured every 5s with a Good/Fair/Poor indicator in the header; disconnect banner and auto-rejoin were already in place
- **Polish** — richer card faces (corner suits, gradients), mini card-back counters on opponent panels, turn glow on the hand dock, scroll-safe round/game overlays, updated home/game copy

Verified:
- `npm test` → 83/83 passing (47 shared + 31 server + 5 client)
- Client effect-rule tests cover bomb/slam/timing/finish/pass classification; server socket test covers latency pings
- `npm run build` → 304.95 kB JS / 94.05 kB gzip, 43.77 kB CSS / 7.92 kB gzip
- **LAN-interface smoke test** — server bound to `0.0.0.0`, reached through the Wi-Fi IPv4 (`192.168.18.98`): health OK, built client served (200), Socket.io connected, room created with three bots, game started (`playing`, host hand dealt)
- Physical 4-player Radmin/ZeroTier run remains for the user's own network

Final PRD audit:
- All gameplay, lobby, UI, bot, tempelan, reconnection, and LAN requirements are implemented
- Documented interpretations remain: round-1 3s discard opening, bomb chaining, trick reset when all remaining players pass, placeholder 3/2/1/0 score table, tempelan v2, bot lead heuristic
- Known limits: rooms are in-memory (a server restart clears them); the LAN smoke test used the local Wi-Fi adapter rather than the actual VPN adapters; no browser automation was available for UI E2E, so the 4-tab visual playthrough is part of the manual game-night check

## Rule revisions

### Tempelan v2 (2026-11-02)

PRD §2.7 and Timeline.md Phase 5 were updated to the clarified rules; **implemented in Phase 5** (see above).

- Tempel button is always available — every turn, whether beating or leading a fresh trick
- Main hand: any valid combo under normal play rules
- Attach exactly one extra valid hand of any rank/type (e.g. `Q + K`, `Q + pair of 4s`, `Q + polo`); bombs cannot be attached
- Voters: the other players still in the game — players who already finished cannot vote
- All yes → accepted: attached hand survives and becomes the active combo the next player must beat
- Any no → rejected: only the attached hand returns to the player's hand; the main hand stays as the active play
- Turn passes to the next active player after resolution; timeout counts as rejection
- Engine impact (done): pending-vote state, both hands removed at play time, attached-hand rollback on rejection, and accepted plays swapping the active combo to the attached combination

## Planned enhancements

- **Effect-ready event design** — implemented in Phase 3: one socket event per action (`play`, `pass`, `trick-reset`, `finish`, `game-over`) with seat, cards, combo type, beaten combo, timestamps, and an explicit bomb flag; personalized serializable state with a monotonic version
- **Effects stack** — implemented in Phase 7: CSS keyframes + Web Audio API only (no animation library, no external CDNs); sounds for card play, turn alert, bomb, and win; explosion effect on bomb plays; slam effect on fast beats using event timing; effects also fire on bot turns

## How this file is maintained

After each phase completes:
1. Move the phase status to **Done** in the table.
2. Tick the phase checklist and record what was actually built.
3. Add any decisions, deviations from `Timeline.md`, or follow-ups discovered.
4. Update the `Last updated` date.
5. Commit together with the phase's code and push.
