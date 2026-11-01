import { useEffect, useMemo, useState } from 'react';
import {
  COMBINATION_LABELS,
  canPlayCombination,
  cardKey,
  detectCombination,
} from '@poker-tempel/shared';
import ActionLog from './ActionLog.jsx';
import Button from './Button.jsx';
import CardFace from './CardFace.jsx';
import GameEndOverlay from './GameEndOverlay.jsx';
import PlayerPanel from './PlayerPanel.jsx';
import RoomHeader from './RoomHeader.jsx';
import RoundEndOverlay from './RoundEndOverlay.jsx';
import TurnTimer from './TurnTimer.jsx';
import { ordinal } from '../lib/format.js';

export default function GameScreen({ room, send, onLeave }) {
  const [selected, setSelected] = useState(() => new Set());

  const mySeat = room.yourSeat;
  const isHost = mySeat === room.hostSeat;
  const isPlaying = room.status === 'playing';
  const isMyTurn = isPlaying && room.turn === mySeat;
  const hand = room.you?.hand ?? [];
  const handSignature = hand.map(cardKey).join(',');
  const active = room.activePlay?.combination ?? null;
  const players = room.players ?? [];
  const playerBySeat = Object.fromEntries(players.map((player) => [player.seat, player]));
  const passedSeats = new Set(room.passedSeats ?? []);
  const opponents = [1, 2, 3].map((offset) => (mySeat + offset) % 4);
  const currentPlayer = playerBySeat[room.turn];
  const activePlayer = room.activePlay ? playerBySeat[room.activePlay.playerIndex] : null;
  const me = playerBySeat[mySeat];

  useEffect(() => {
    setSelected(new Set());
  }, [handSignature, room.round, room.status]);

  const selectedCards = useMemo(
    () => hand.filter((card) => selected.has(cardKey(card))),
    [hand, selected],
  );
  const combination = selectedCards.length > 0 ? detectCombination(selectedCards) : null;
  const beatsTable = Boolean(combination && canPlayCombination(combination, active));
  const canPlay = Boolean(isMyTurn && beatsTable);

  const toggle = (card) => {
    setSelected((previous) => {
      const next = new Set(previous);
      const key = cardKey(card);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const play = async () => {
    if (!canPlay) return;
    const result = await send('game:play', { cards: [...selected] });
    if (result?.ok) setSelected(new Set());
  };

  const pass = async () => {
    if (!isMyTurn || !active) return;
    const result = await send('game:pass');
    if (result?.ok) setSelected(new Set());
  };

  const selectionHint = !combination
    ? 'Not a valid combination'
    : !isMyTurn
      ? 'Waiting for your turn'
      : beatsTable
        ? 'Ready to play'
        : 'Cannot beat the table';

  const dockTitle = me?.finished
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

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 pb-3 sm:px-6">
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
                  <div className="flex items-end justify-center pt-2">
                    {active.cards.map((card) => (
                      <CardFace
                        key={cardKey(card)}
                        card={card}
                        size="lg"
                        disabled
                        className="-ml-4 first:ml-0 sm:-ml-6"
                      />
                    ))}
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300/80">
                    {COMBINATION_LABELS[active.type] ?? active.type}
                  </p>
                </>
              ) : (
                <p className="text-sm text-emerald-200/40">No cards on the table</p>
              )}
            </div>

            <ActionLog log={room.log} players={players} />
          </div>
        </section>

        <section className="sticky bottom-0 z-20 mt-3 rounded-2xl border border-emerald-800/60 bg-emerald-900/85 p-3 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300/60">
                Your hand · {hand.length} cards
              </p>
              <p className="truncate text-sm font-bold text-amber-200">{dockTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setSelected(new Set())}
                disabled={selected.size === 0}
              >
                Deselect
              </Button>
              <Button variant="secondary" onClick={pass} disabled={!isMyTurn || !active}>
                Pass
              </Button>
              <Button variant="primary" onClick={play} disabled={!canPlay}>
                Play
              </Button>
            </div>
          </div>

          <div className="mt-2 overflow-x-auto pb-1">
            <div className="mx-auto flex min-w-max items-end justify-center px-3 pt-4">
              {hand.map((card, index) => (
                <CardFace
                  key={cardKey(card)}
                  card={card}
                  selected={selected.has(cardKey(card))}
                  onClick={() => toggle(card)}
                  className={index === 0 ? '' : '-ml-3 sm:-ml-5'}
                />
              ))}
            </div>
          </div>

          <div className="mt-1 flex h-5 items-center justify-center text-xs">
            {selected.size > 0 ? (
              <span
                className={
                  !combination
                    ? 'text-amber-300/80'
                    : canPlay
                      ? 'text-emerald-300'
                      : 'text-red-300'
                }
              >
                {combination
                  ? `${COMBINATION_LABELS[combination.type] ?? combination.type} · ${selectionHint}`
                  : selectionHint}
              </span>
            ) : null}
          </div>
        </section>
      </main>

      {room.status === 'round-end' ? (
        <RoundEndOverlay room={room} send={send} isHost={isHost} />
      ) : null}
      {room.status === 'game-end' ? <GameEndOverlay room={room} onLeave={onLeave} /> : null}
    </div>
  );
}
