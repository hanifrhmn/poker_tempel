import { COMBINATION_LABELS, parseCard } from '@poker-tempel/shared';
import CardFace from './CardFace.jsx';
import { ordinal } from '../lib/format.js';

export default function GameEffects({ effect }) {
  if (!effect) return null;

  if (effect.kind === 'bomb') {
    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-orange-500/25 animate-bomb-flash" />
        <div className="absolute left-1/2 top-1/3 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-amber-300/80 animate-bomb-ring sm:size-32" />
        <div className="absolute inset-x-0 top-[28%] text-center text-6xl font-black tracking-[0.3em] text-amber-300 drop-shadow-[0_0_30px_rgba(251,191,36,0.9)] animate-bomb-text sm:text-8xl">
          BOOM
        </div>
        <div className="absolute inset-x-0 top-[46%] text-center text-xs font-bold uppercase tracking-[0.4em] text-amber-100/80 animate-bomb-text">
          {COMBINATION_LABELS[effect.event.combinationType] ?? 'Bomb'}
        </div>
      </div>
    );
  }

  if (effect.kind === 'slam') {
    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        <div className="absolute inset-0 bg-sky-400/10 animate-slam-flash" />
        <div className="absolute left-1/2 top-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-300/70 animate-slam-ring" />
        <div className="absolute inset-x-0 top-[38%] text-center text-4xl font-black uppercase tracking-[0.4em] text-sky-200 drop-shadow-[0_0_20px_rgba(125,211,252,0.8)] animate-slam-text">
          SLAM
        </div>
      </div>
    );
  }

  if (effect.kind === 'tempelanAccepted') {
    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-emerald-400/10 animate-slam-flash" />
        <div className="rounded-2xl border border-emerald-400/50 bg-emerald-950/85 px-8 py-5 text-center shadow-2xl animate-finish-pop">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-300/80">
            Tempelan
          </p>
          <p className="mt-1 text-3xl font-black uppercase tracking-[0.2em] text-emerald-300">
            Accepted
          </p>
        </div>
      </div>
    );
  }

  if (effect.kind === 'tempelanRejected') {
    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-red-500/10 animate-slam-flash" />
        <div className="rounded-2xl border border-red-400/50 bg-red-950/85 px-8 py-5 text-center shadow-2xl animate-finish-pop">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-300/80">
            Tempelan
          </p>
          <p className="mt-1 text-3xl font-black uppercase tracking-[0.2em] text-red-300">
            Rejected
          </p>
        </div>
      </div>
    );
  }

  if (effect.kind === 'selfBomb') {
    const cards = effect.event.cards ?? [];

    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-orange-600/25 animate-bomb-flash" />
        <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-red-300/80 animate-bomb-ring" />
        <div className="relative flex flex-col items-center gap-3 rounded-2xl border border-red-400/50 bg-red-950/90 px-8 py-5 text-center shadow-2xl animate-finish-pop">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-red-300/80">
            Self bomb
          </p>
          <p className="text-2xl font-black uppercase tracking-[0.15em] text-red-300">
            Last card was a 2
          </p>
          <div className="flex items-end justify-center">
            {cards.map((key) => (
              <CardFace key={key} card={parseCard(key)} size="md" disabled />
            ))}
          </div>
          <p className="text-xs font-semibold text-emerald-200/70">
            {effect.event.playerName} — round reset, discarding 3s again
          </p>
        </div>
      </div>
    );
  }

  if (effect.kind === 'finish') {
    return (
      <div key={effect.id} className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
        <div className="rounded-2xl border border-amber-400/40 bg-emerald-950/80 px-8 py-4 text-center shadow-2xl animate-finish-pop">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/80">
            Player finished
          </p>
          <p className="mt-1 text-3xl font-black text-amber-200">
            {ordinal(effect.event.placement)}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
