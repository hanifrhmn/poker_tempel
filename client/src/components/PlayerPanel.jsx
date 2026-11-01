import { ordinal } from '../lib/format.js';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function PlayerPanel({ player, isTurn, passed, isHost, isYou }) {
  if (!player) return null;

  const status = player.finished
    ? 'Done'
    : isTurn
      ? isYou
        ? 'Your turn'
        : 'Thinking'
      : passed
        ? 'Passed'
        : 'Waiting';

  return (
    <div
      className={`w-full rounded-xl border px-3 py-2 transition-colors ${
        isTurn
          ? 'border-amber-400/70 bg-emerald-800/70 shadow-lg shadow-amber-500/10'
          : 'border-emerald-800/60 bg-emerald-900/50'
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-700 bg-emerald-950 text-xs font-black text-amber-300">
          {initials(player.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-emerald-50">
            {player.name}
            {isYou ? ' (you)' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider">
            {isHost ? <span className="text-amber-300">Host</span> : null}
            {player.isBot ? (
              <span className="text-sky-300">Bot</span>
            ) : (
              <span className={player.connected ? 'text-emerald-400/80' : 'text-red-300'}>
                {player.connected ? 'Online' : 'Offline'}
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black leading-none text-amber-200">{player.cardCount}</p>
          <p className="text-[9px] uppercase tracking-wider text-emerald-400/60">cards</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider">
        <span
          className={
            isTurn
              ? 'text-amber-300'
              : passed
                ? 'text-emerald-400/60'
                : player.finished
                  ? 'text-emerald-300'
                  : 'text-emerald-400/50'
          }
        >
          {status}
        </span>
        {player.finished ? (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 font-black text-emerald-950">
            {ordinal(player.placement)}
          </span>
        ) : (
          <span className="text-emerald-300/60">{player.score} pts</span>
        )}
      </div>
    </div>
  );
}
