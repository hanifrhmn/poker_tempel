import { useEffect, useRef, useState } from 'react';
import { parseCard } from '@poker-tempel/shared';
import CardFace from './CardFace.jsx';
import { playSound } from '../lib/audio.js';

export default function OpeningSequence({ opening, players, mySeat }) {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const lastRevealedRef = useRef(0);
  const leaderChimedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const discards = opening.discards ?? [];
  const duration = Math.max(1, opening.endsAt - opening.startedAt);
  const step = duration / Math.max(discards.length, 1);
  const elapsed = Math.max(0, now - startedAt);
  const revealed = Math.min(discards.length, Math.floor(elapsed / step) + 1);
  const done = revealed >= discards.length;

  useEffect(() => {
    if (revealed > lastRevealedRef.current) {
      lastRevealedRef.current = revealed;
      playSound('card');
    }

    if (done && !leaderChimedRef.current) {
      leaderChimedRef.current = true;
      playSound('turn');
    }
  }, [revealed, done]);

  const leaderName = players[opening.leader]?.name ?? 'The 3♠ holder';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-emerald-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-3xl border border-amber-400/30 bg-emerald-900 p-5 shadow-2xl shadow-black/50 sm:p-6">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/80">
          Opening
        </p>
        <h2 className="mt-1 text-center text-2xl font-black text-amber-200">Discarding 3s</h2>
        <p className="mt-1 text-center text-xs text-emerald-200/60">
          Everyone reveals their 3s — the 3♠ holder leads first.
        </p>

        <div className="mt-4 space-y-2">
          {discards.map((entry, index) => {
            const visible = index < revealed;
            const isLeader = entry.playerIndex === opening.leader;

            return (
              <div
                key={entry.playerIndex}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 transition-all duration-300 ${
                  visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                } ${
                  isLeader && visible
                    ? 'border-amber-400/70 bg-emerald-800/70'
                    : 'border-emerald-800/60 bg-emerald-950/40'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-emerald-50">
                    {players[entry.playerIndex]?.name ?? `Seat ${entry.playerIndex + 1}`}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/60">
                    {isLeader
                      ? '3♠ holder'
                      : entry.playerIndex === mySeat
                        ? 'You'
                        : 'Discarding'}
                  </p>
                </div>
                <div className="flex items-end">
                  {entry.cards.length === 0 ? (
                    <span className="text-xs text-emerald-400/50">No 3s</span>
                  ) : (
                    entry.cards.map((key) => (
                      <CardFace
                        key={key}
                        card={parseCard(key)}
                        size="sm"
                        disabled
                        className={`-ml-2 first:ml-0 ${key === '3S' ? 'ring-2 ring-amber-400' : ''}`}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <p className={`text-sm font-bold ${done ? 'text-emerald-300' : 'text-emerald-300/60'}`}>
            {done ? `${leaderName} holds 3♠ — leading first!` : 'Revealing 3s…'}
          </p>
        </div>
      </div>
    </div>
  );
}
