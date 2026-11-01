import { useEffect, useState } from 'react';
import { COMBINATION_LABELS, parseCard } from '@poker-tempel/shared';
import Button from './Button.jsx';
import CardFace from './CardFace.jsx';

function CardGroup({ label, cards, combination }) {
  return (
    <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400/60">
        {label}
      </p>
      <div className="mt-2 flex items-end">
        {cards.map((key) => (
          <CardFace
            key={key}
            card={parseCard(key)}
            size="sm"
            disabled
            className="-ml-2 first:ml-0"
          />
        ))}
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-amber-300/80">
        {COMBINATION_LABELS[combination.type] ?? combination.type}
      </p>
    </div>
  );
}

export default function TempelanVotePanel({
  pending,
  players,
  mySeat,
  tempelDeadline,
  durationMs = 15_000,
  onVote,
}) {
  const [now, setNow] = useState(() => Date.now());
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!tempelDeadline) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [tempelDeadline]);

  const tempelPlayer = players[pending.playerIndex];
  const myVote = pending.votes[mySeat];
  const isVoter = pending.voters.includes(mySeat);
  const isTempelPlayer = pending.playerIndex === mySeat;
  const remaining = tempelDeadline ? Math.max(0, tempelDeadline - now) : 0;
  const percent = Math.min(100, (remaining / durationMs) * 100);
  const seconds = Math.ceil(remaining / 1000);

  const vote = async (value) => {
    setVoting(true);
    await onVote(value);
    setVoting(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-emerald-950/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-sky-400/30 bg-emerald-900 p-5 shadow-2xl shadow-black/50 sm:p-6">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-sky-300/80">
          Tempelan
        </p>
        <h2 className="mt-1 text-center text-2xl font-black text-emerald-50">
          {tempelPlayer?.name} wants to tempel
        </h2>
        <p className="mt-1 text-center text-xs text-emerald-200/60">
          Every player still in the game must accept for the attached hand to stay.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <CardGroup
            label="Main play"
            cards={pending.main.cards}
            combination={pending.main.combination}
          />
          <CardGroup
            label="Tempelan"
            cards={pending.attached.cards}
            combination={pending.attached.combination}
          />
        </div>

        <div className="mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/50 p-3">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">
            <span>Votes</span>
            <span>{seconds}s</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-emerald-950">
            <div
              className="h-full bg-sky-400 transition-[width] duration-100"
              style={{ width: `${percent}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1.5">
            {pending.voters.map((seat) => {
              const player = players[seat];
              const value = pending.votes[seat];
              return (
                <li key={seat} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate text-emerald-100">
                    {player?.name ?? `Seat ${seat + 1}`}
                  </span>
                  <span
                    className={
                      value === undefined
                        ? 'text-emerald-400/50'
                        : value
                          ? 'text-emerald-300'
                          : 'text-red-300'
                    }
                  >
                    {value === undefined ? 'Waiting…' : value ? 'Yes' : 'No'}
                  </span>
                </li>
              );
            })}
            {pending.voters.length === 0 ? (
              <li className="text-sm text-emerald-400/50">No voters</li>
            ) : null}
          </ul>
        </div>

        <div className="mt-5 flex flex-col items-center gap-2">
          {isVoter && myVote === undefined ? (
            <div className="flex gap-3">
              <Button variant="primary" onClick={() => vote(true)} disabled={voting}>
                Accept
              </Button>
              <Button variant="danger" onClick={() => vote(false)} disabled={voting}>
                Reject
              </Button>
            </div>
          ) : isTempelPlayer ? (
            <p className="text-sm text-emerald-300/70">Waiting for the other players…</p>
          ) : isVoter ? (
            <p className="text-sm text-emerald-300/70">
              You voted {myVote ? 'yes' : 'no'}. Waiting…
            </p>
          ) : (
            <p className="text-sm text-emerald-300/70">Watching the vote…</p>
          )}
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/40">
            Timeout counts as a rejection
          </p>
        </div>
      </div>
    </div>
  );
}
