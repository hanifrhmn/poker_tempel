# Product Requirement Document (PRD): Custom Web Capsa Banting

## 1. Overview & Objectives
A localized, real-time multiplayer Web Capsa Banting (Big Two) card game web application designed for a 4-player session with custom rules and optional Bot fill-ins over local network (LAN/Radmin VPN).

---

## 2. Core Game Rules & Mechanics

### 2.1 Player Setup & Game Initialization
* **Total Players:** Fixed 4 players. If room has fewer than 4 human players, host can spawn AI Bots to fill vacant slots.
* **Deck & Hand Deal:** Standard 52-card deck, 13 cards dealt per player.
* **Card Ranks (Ascending):** $3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2$.
* **Suit Ranks :** there is no suit rank when the game is ongoing, player must give higher card, we only use rank for deciding whos the first one to play by all players must give out their "3" cards. and the one holding 3 of spade play first.

### 2.2 First Turn & Turn Order
* **Game 1 First Move:** Must be initiated by the player holding **$3\spadesuit$** after all player give out all their "3" card the one holding 3 of spade can play anything (single, pair, thrice, polo, etc).
* **Subsequent Rounds Leader:** The 1st place winner of the previous round leads the first hand in the next game (without needing to play a 3).

### 2.3 Valid Card Combinations

| Combination Type | Description & Requirements | Validation & Comparison Rule |
| :--- | :--- | :--- |
| **Satuan (Single)** | 1 card. | Must strictly beat rank active Single. |
| **Duaan (Pair)** | 2 cards of identical rank. | Higher rank beats lower rank |
| **Tigaan (Thrice)** | 3 cards of identical rank. | Higher rank beats lower rank. |
| **Seri** | 3 cards of consecutive ranks with **IDENTICAL suit** (e.g., $4\spadesuit-5\spadesuit-6\spadesuit$). **No mixed-suit straights allowed.** | Must match exact suit structure; higher top-rank wins. |
| **Polo (Full House)** | 3 cards of identical rank + 1 Pair (5 cards total). | Ranked by the 3-of-a-kind rank. Must strictly exceed previous Polo rank. |
| **Polo Seri** | 3 consecutive-rank cards of **identical suit** + 1 free Pair (5 cards total). | Ranked by the 3-card straight component. |
| **Four of a Kind (Piting/Bom)** | 4 cards of identical rank (no need for addition +1 card) | Bomb, can be beaten by higher four of a kind. straight flush cant beat four of a kind |
| **Straight Flush (Pluser/Bom)** | 5 consecutive-rank cards of **identical suit**. | Bomb. can be be beaten by higher straight flush|

### 2.4 Bomb System & Restrictions
* **Target:** Bombs (Four of a Kind or Straight Flush) can **ONLY** be used to counter/cut a **Single '2'** played on the board.
* **Restrictions:** 
  * Cannot bomb Pairs, Thrice, Polo, or 5-card hands.
  * Cannot bomb a Single non-2 card.

### 2.5 Specialty Sequence Rule: $2-3-4$ Wrap
* Standard 5-card Straight across ranks is disabled.
* Sequence **$2 - 3 - 4$** (of matching suit) is allowed:
  * In this specific combination, **'2' drops to lowest numerical rank**, making **'aces' the highest card in the sequence**.


### 2.6 Round Resolution & Win Condition
* **Play Progression:** Players pass or beat the current combo. When 3 players pass sequentially, the trick resets and the last card layer owner gets a free lead.
* **Game Completion:** Game continues until **all 4 players finish their hand** (Rank 1st, 2nd, 3rd, and 4th place calculated).

### 2.7 Tempelan
* **Availability:** The Tempel button is always available on a player's turn, whether they are beating the current combination or leading a fresh trick.
* **Play:** The player chooses a **main hand** (any valid combination, played under normal rules) and attaches **exactly one additional hand** from their hand (any valid combination, any rank or type — e.g. `Q + K`, `Q + pair of 4s`, `Q + polo`). Bombs cannot be used as the attached hand.
* **Vote:** The other players still in the game (finished players cannot vote) get Yes/No buttons. If every voter says yes, the tempelan is accepted; if any voter says no, it is rejected. Timeout counts as a rejection.
* **Accepted:** Both hands stay played, and the **attached hand becomes the active combination** the next player must beat (e.g. `Q + 4` → next player only needs to beat the `4`; `Q + pair of 4s` → next player must beat the pair of `4s`).
* **Rejected:** Only the attached hand returns to the player's hand. The **main hand stays on the board** as the active combination, and the next player must beat it.
* **Turn:** After the vote resolves, the turn passes to the next active player. If the tempelan empties the player's hand, they finish once the vote resolves (the attached cards must be accepted to count as played).

---

## 3. System Architecture & Technical Stack

```
[ Frontend: HTML5 / Tailwind / React or Vue ]
                      │ (WebSockets)
[ Backend: Node.js (Socket.io) / Express ] ── [ Game State Engine ]
                      │
[ Room Management & Bot Controller (MiniMax / Rule-based) ]
```

### 3.1 Technical Components
* **Frontend:** Single Page Application (HTML5, CSS/Tailwind, JavaScript Framework/Socket Client). Responsive card drag/click selection UI.
* **Backend:** Node.js server using Express & Socket.io for WebSocket state updates.
* **Networking:** Localhost execution with direct port exposure over LAN / Radmin VPN IPv4 (`http://<RADMIN_IP>:3000`).

---

## 4. User Interface & Gameplay Flow

### 4.1 Lobby Setup
1. Host launches local server and creates room.
2. Room displays 4 slots (Human players connect via Radmin IP link).
3. "Add Bot" button for empty slots.
4. "Start Game" enabled when 4 slots are populated.

### 4.2 In-Game Layout
* **Center Board:** Active card stack, last action log, turn indicator timer.
* **Bottom Bar:** Player's own hand (auto-sorted by rank & suit), action buttons (**Play**, **Pass**, **Deselect**).
* **Opponent Panels (Left, Top, Right):** Avatar, card count remaining, current status (Passed/Thinking/Done), Rank badge when finished (1st, 2nd, 3rd, 4th).

---

## 5. Bot (AI) Requirements
* **State Machine:**
  * If leading: Play lowest single/combo containing $3\spadesuit$ (if 1st game first turn), else play smallest valid combination.
  * If responding: Evaluate active table combo. Play lowest valid combination that beats table card. If table card is Single '2' and Bot holds Four of a Kind/Straight Flush, 50% probability to Bomb.
  * If no valid cards beat table: Pass turn.

---

## 6. Non-Functional Requirements
* **Latency:** Local WebSocket response $< 50\text{ ms}$.
* **Reconnection:** If a human disconnects, slot auto-converts to Bot control after 15 seconds to prevent game stall.