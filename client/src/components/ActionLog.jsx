import { useEffect, useRef } from 'react';
import { COMBINATION_LABELS, cardLabel, parseCard } from '@poker-tempel/shared';
import { ordinal } from '../lib/format.js';

function describe(entry, players) {
  const name =
    entry.playerIndex !== undefined
      ? (players[entry.playerIndex]?.name ?? `Seat ${entry.playerIndex + 1}`)
      : '';

  switch (entry.type) {
    case 'play': {
      const cards = (entry.cards ?? [])
        .map((key) => cardLabel(parseCard(key)))
        .join(' ');
      return `${name} played ${COMBINATION_LABELS[entry.combinationType] ?? entry.combinationType}${
        cards ? ` · ${cards}` : ''
      }`;
    }
    case 'pass':
      return `${name} passed`;
    case 'trick-reset':
      return `${name} leads the next trick`;
    case 'finish':
      return `${name} finished ${ordinal(entry.placement)}`;
    case 'tempelan-play': {
      const main = (entry.mainCards ?? [])
        .map((key) => cardLabel(parseCard(key)))
        .join(' ');
      const attached = (entry.attachedCards ?? [])
        .map((key) => cardLabel(parseCard(key)))
        .join(' ');
      return `${name} tempeled ${COMBINATION_LABELS[entry.attachedType] ?? entry.attachedType} ${attached} on ${COMBINATION_LABELS[entry.mainType] ?? entry.mainType} ${main}`;
    }
    case 'tempelan-vote':
      return `${name} voted ${entry.vote}`;
    case 'tempelan-accepted':
      return `${name}'s tempelan was accepted`;
    case 'tempelan-rejected':
      return `${name}'s tempelan was rejected`;
    case 'game-over':
      return 'Game over';
    case 'game-start':
      return 'Game started';
    case 'opening-threes':
      return `All 3s discarded · ${players[entry.leader]?.name ?? '3♠ holder'} leads`;
    default:
      return entry.message ?? entry.type;
  }
}

export default function ActionLog({ log, players }) {
  const endRef = useRef(null);
  const entries = (log ?? []).slice(-20);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [entries.length]);

  return (
    <div className="w-full max-w-md rounded-xl border border-emerald-800/40 bg-emerald-950/40 px-3 py-2">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.25em] text-emerald-400/50">
        Action log
      </p>
      <div className="max-h-24 space-y-1 overflow-y-auto pr-1 text-[11px] leading-snug text-emerald-200/70 sm:max-h-28">
        {entries.length === 0 ? (
          <p className="text-emerald-400/40">No actions yet</p>
        ) : (
          entries.map((entry, index) => (
            <p key={`${entry.at}-${index}`} className="truncate">
              <span className="text-emerald-500/60">›</span> {describe(entry, players)}
            </p>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}
