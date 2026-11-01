import { useEffect, useMemo, useState } from 'react';
import {
  COMBINATION_LABELS,
  canPlayCombination,
  cardKey,
  detectCombination,
  isBomb,
  isLegalFinalPlay,
  isLegalFinalPlaySet,
} from '@poker-tempel/shared';
import ActionLog from './ActionLog.jsx';
import Button from './Button.jsx';
import CardFace from './CardFace.jsx';
import GameEffects from './GameEffects.jsx';
import GameEndOverlay from './GameEndOverlay.jsx';
import OpeningSequence from './OpeningSequence.jsx';
import PlayerPanel from './PlayerPanel.jsx';
import RoomHeader from './RoomHeader.jsx';
import RoundEndOverlay from './RoundEndOverlay.jsx';
import TempelanVotePanel from './TempelanVotePanel.jsx';
import TurnTimer from './TurnTimer.jsx';
import { useGameEffects } from '../hooks/useGameEffects.js';
import { ordinal } from '../lib/format.js';

export default function GameScreen({ room, send, onLeave }) {
  const [selected, setSelected] = useState(() => new Set());
  const [tempelMode, setTempelMode] = useState(false);
  const [tempelMain, setTempelMain] = useState([]);

  const mySeat = room.yourSeat;
  const isHost = mySeat === room.hostSeat;
  const isPlaying = room.status === 'playing';
  const isMyTurn = isPlaying && room.turn === mySeat;
  const hand = room.you?.hand ?? [];
  const handSignature = hand.map(cardKey).join(',');
  const active = room.activePlay?.combination ?? null;
  const tempelanInfo = room.activePlay?.tempelan ?? null;
  const hasPendingTempelan = Boolean(room.pendingTempelan);
  const hasOpening = Boolean(room.opening);
  const players = room.players ?? [];
  const playerBySeat = Object.fromEntries(players.map((player) => [player.seat, player]));
  const passedSeats = new Set(room.passedSeats ?? []);
  const opponents = [1, 2, 3].map((offset) => (mySeat + offset) % 4);
  const currentPlayer = playerBySeat[room.turn];
  const activePlayer = room.activePlay ? playerBySeat[room.activePlay.playerIndex] : null;
  const me = playerBySeat[mySeat];
  const effect = useGameEffects({ room, mySeat });

  useEffect(() => {
    setSelected(new Set());
    if (!isMyTurn || hasPendingTempelan || !isPlaying) {
      setTempelMode(false);
      setTempelMain([]);
    }
  }, [handSignature, room.round, room.status, isMyTurn, hasPendingTempelan, isPlaying]);

  const selectedCards = useMemo(
    () => hand.filter((card) => selected.has(cardKey(card))),
    [hand, selected],
  );
  const combination = selectedCards.length > 0 ? detectCombination(selectedCards) : null;
  const wouldEmptyHand = selectedCards.length > 0 && selectedCards.length === hand.length;
  const legalFinal =
    !wouldEmptyHand || (combination ? isLegalFinalPlay(combination) : true);
  const beatsTable = Boolean(combination && canPlayCombination(combination, active));
  const canPlay = Boolean(isMyTurn && beatsTable && legalFinal);

  const tempelMainCards = useMemo(
    () => hand.filter((card) => tempelMain.includes(cardKey(card))),
    [hand, tempelMain],
  );
  const tempelMainCombination =
    tempelMainCards.length > 0 ? detectCombination(tempelMainCards) : null;
  const attachedCombination =
    tempelMode && selectedCards.length > 0 ? detectCombination(selectedCards) : null;
  const tempelWouldEmpty =
    tempelMain.length > 0 && tempelMain.length + selected.size === hand.length;
  const tempelFinalLegal =
    !tempelWouldEmpty ||
    Boolean(
      tempelMainCombination &&
        attachedCombination &&
        isLegalFinalPlaySet([tempelMainCombination, attachedCombination]),
    );
  const canTempelPlay = Boolean(
    isMyTurn &&
      attachedCombination &&
      !isBomb(attachedCombination) &&
      tempelFinalLegal,
  );
  const canStartTempel = Boolean(canPlay && hand.length > selected.size);

  const toggle = (card) => {
    const key = cardKey(card);
    if (tempelMode && tempelMain.includes(key)) return;

    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const play = async () => {
    if (!canPlay || tempelMode) return;
    const result = await send('game:play', { cards: [...selected] });
    if (result?.ok) setSelected(new Set());
  };

  const pass = async () => {
    if (!isMyTurn || !active || tempelMode) return;
    const result = await send('game:pass');
    if (result?.ok) setSelected(new Set());
  };

  const startTempel = () => {
    if (!canStartTempel) return;
    setTempelMain([...selected]);
    setSelected(new Set());
    setTempelMode(true);
  };

  const cancelTempel = () => {
    setTempelMode(false);
    setTempelMain([]);
    setSelected(new Set());
  };

  const submitTempel = async () => {
    if (!canTempelPlay) return;
    const result = await send('game:tempelan', {
      mainCards: tempelMain,
      attachedCards: [...selected],
    });
    if (result?.ok) {
      setTempelMode(false);
      setTempelMain([]);
      setSelected(new Set());
    }
  };

  const normalHint = !combination
    ? 'Not a valid combination'
    : wouldEmptyHand && !legalFinal
      ? 'Cannot finish with a 2'
      : !isMyTurn
        ? 'Waiting for your turn'
        : beatsTable
          ? 'Ready to play'
          : 'Cannot beat the table';

  const tempelHint = !selected.size
    ? 'Pick one extra hand to tempel'
    : !attachedCombination
      ? 'Not a valid combination'
      : isBomb(attachedCombination)
        ? 'Bombs cannot be tempeled'
        : !tempelFinalLegal
          ? 'Cannot finish with a 2'
          : 'Ready to tempel';

  const hintText = tempelMode
    ? attachedCombination
      ? `${COMBINATION_LABELS[attachedCombination.type] ?? attachedCombination.type} · ${tempelHint}`
      : tempelHint
    : combination
      ? `${COMBINATION_LABELS[combination.type] ?? combination.type} · ${normalHint}`
      : normalHint;

  const hintColor = tempelMode
    ? canTempelPlay
      ? 'text-emerald-300'
      : attachedCombination && (isBomb(attachedCombination) || !tempelFinalLegal)
        ? 'text-red-300'
        : 'text-amber-300/80'
    : !combination
      ? 'text-amber-300/80'
      : canPlay
        ? 'text-emerald-300'
        : 'text-red-300';

  const dockTitle = hasOpening
    ? 'Revealing opening 3s…'
    : tempelMode
      ? `Main: ${tempelMainCombination ? COMBINATION_LABELS[tempelMainCombination.type] : 'hand'} · now pick the tempelan hand`
      : me?.finished
        ? `You finished ${ordinal(me.placement)}`
        : !isPlaying
          ? room.status === 'round-end'
            ? 'Round complete'
            : 'Session complete'
          : isMyTurn
            ? active
              ? 'Beat the active play'
              : 'Lead the trick'
            : `${currentPlayer?.name ?? '…'} is thinking`;

  const opponentPositions = [
    'md:absolute md:left-0 md:top-1/2 md:w-48 md:-translate-y-1/2',
    'md:absolute md:left-1/2 md:top-0 md:w-48 md:-translate-x-1/2',
    'md:absolute md:right-0 md:top-1/2 md:w-48 md:-translate-y-1/2',
  ];

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-emerald-950 text-emerald-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.16),transparent_65%)]" />
      <RoomHeader room={room} onLeave={onLeave} />

      <main
        className={`relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pb-3 sm:px-6 ${
          effect?.kind === 'bomb' || effect?.kind === 'slam' ? 'animate-screen-shake' : ''
        }`}
      >
        <section className="relative mt-3 flex-1">
          <div className="relative grid grid-cols-3 gap-2 md:h-40 md:block">
            {opponents.map((seat, index) => (
              <div key={seat} className={opponentPositions[index]}>
                <PlayerPanel
                  player={playerBySeat[seat]}
                  isTurn={isPlaying && room.turn === seat}
                  passed={passedSeats.has(seat)}
                  isHost={room.hostSeat === seat}
                  isYou={false}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 md:mt-2">
            <TurnTimer
              deadline={room.turnDeadline}
              durationMs={room.turnTimeoutMs}
              name={currentPlayer?.name}
              isMyTurn={isMyTurn}
            />

            <div className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-emerald-800/40 bg-emerald-900/20 px-3 py-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300/50">
                {activePlayer
                  ? `${activePlayer.name} played`
                  : isPlaying
                    ? currentPlayer
                      ? `${currentPlayer.name} leads`
                      : 'Waiting…'
                    : 'Table'}
              </p>

              {active ? (
                <>
                  <div
                    key={`${room.activePlay.playerIndex}-${active.cards.map(cardKey).join('-')}`}
                    className="flex items-end justify-center pt-2"
                  >
                    {active.cards.map((card, index) => (
                      <CardFace
                        key={cardKey(card)}
                        card={card}
                        size="lg"
                        disabled
                        className="-ml-4 first:ml-0 sm:-ml-6 animate-card-play"
                        style={{ animationDelay: `${index * 35}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/80">
                    {COMBINATION_LABELS[active.type] ?? active.type}
                  </p>
                  {tempelanInfo ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/70">
                      Tempelan {tempelanInfo.accepted ? 'accepted' : 'rejected'} ·{' '}
                      {COMBINATION_LABELS[tempelanInfo.main.combination.type]} +{' '}
                      {COMBINATION_LABELS[tempelanInfo.attached.combination.type]}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-emerald-200/40">No cards on the table</p>
              )}
            </div>

            <ActionLog log={room.log} players={players} />
          </div>
        </section>

        <section
          className={`sticky bottom-0 z-20 mt-3 rounded-2xl border bg-emerald-900/85 p-3 shadow-2xl shadow-black/40 backdrop-blur transition-shadow ${
            isMyTurn && !hasPendingTempelan
              ? 'border-amber-400/70 ring-2 ring-amber-400/40'
              : 'border-emerald-800/60'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300/60">
                Your hand · {hand.length} cards
              </p>
              <p className="truncate text-sm font-bold text-amber-200">{dockTitle}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tempelMode ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(new Set())}
                    disabled={selected.size === 0}
                  >
                    Deselect
                  </Button>
                  <Button variant="secondary" onClick={cancelTempel}>
                    Cancel
                  </Button>
                  <Button variant="primary" onClick={submitTempel} disabled={!canTempelPlay}>
                    Play tempelan
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setSelected(new Set())}
                    disabled={selected.size === 0}
                  >
                    Deselect
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={pass}
                    disabled={!isMyTurn || !active || hasPendingTempelan || hasOpening}
                  >
                    Pass
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={startTempel}
                    disabled={!canStartTempel || hasPendingTempelan || hasOpening}
                  >
                    Tempel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={play}
                    disabled={!canPlay || hasPendingTempelan || hasOpening}
                  >
                    Play
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-2 overflow-x-auto pb-1">
            <div
              key={`hand-${room.round}`}
              className="mx-auto flex min-w-max items-end justify-center px-3 pt-4"
            >
              {hand.map((card, index) => {
                const key = cardKey(card);
                const isMain = tempelMode && tempelMain.includes(key);
                const isSelected = selected.has(key);
                const locked = hasPendingTempelan || hasOpening || isMain || !isPlaying;

                return (
                  <CardFace
                    key={key}
                    card={card}
                    selected={isMain || isSelected}
                    highlight={isMain ? 'sky' : 'amber'}
                    disabled={locked}
                    onClick={locked ? undefined : () => toggle(card)}
                    className={`${index === 0 ? '' : '-ml-3 sm:-ml-5'} animate-deal`}
                    style={{ animationDelay: `${Math.min(index, 14) * 25}ms` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="mt-1 flex h-5 items-center justify-center text-xs">
            {selected.size > 0 || tempelMode ? (
              <span className={hintColor}>{hintText}</span>
            ) : null}
          </div>
        </section>
      </main>

      {hasOpening ? (
        <OpeningSequence opening={room.opening} players={players} mySeat={mySeat} />
      ) : null}
      {room.pendingTempelan ? (
        <TempelanVotePanel
          pending={room.pendingTempelan}
          players={players}
          mySeat={mySeat}
          tempelDeadline={room.tempelDeadline}
          durationMs={room.tempelVoteTimeoutMs}
          onVote={(vote) => send('game:tempelanVote', { vote })}
        />
      ) : null}
      {room.status === 'round-end' ? (
        <RoundEndOverlay room={room} send={send} isHost={isHost} />
      ) : null}
      {room.status === 'game-end' ? <GameEndOverlay room={room} onLeave={onLeave} /> : null}
      <GameEffects effect={effect} />
    </div>
  );
}
