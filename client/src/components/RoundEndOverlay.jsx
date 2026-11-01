import Button from './Button.jsx';
import { ordinal } from '../lib/format.js';

export default function RoundEndOverlay({ room, send, isHost }) {
  const bySeat = Object.fromEntries((room.players ?? []).map((player) => [player.seat, player]));
  const rows = (room.placements ?? []).map((seat, index) => ({
    ...bySeat[seat],
    place: index + 1,
    points: room.lastRoundResult?.points?.[seat] ?? 0,
  }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-emerald-950/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-emerald-900 p-6 shadow-2xl shadow-black/50">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/70">
          Round {room.round} complete
        </p>
        <h2 className="mt-1 text-center text-3xl font-black text-amber-200">Results</h2>

        <ul className="mt-5 space-y-2">
          {rows.map((row) => (
            <li
              key={row.seat}
              className="flex items-center justify-between rounded-xl bg-emerald-950/60 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 text-xs font-black uppercase text-amber-300">
                  {ordinal(row.place)}
                </span>
                <span className="truncate font-semibold text-emerald-50">{row.name}</span>
                {row.isBot ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-sky-300">
                    Bot
                  </span>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <span className="text-emerald-300/60">+{row.points}</span>
                <span className="font-black text-amber-200">{row.score} pts</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {isHost ? (
            <>
              <Button variant="primary" onClick={() => send('room:nextRound')}>
                Next round
              </Button>
              <Button variant="danger" onClick={() => send('room:endSession')}>
                End session
              </Button>
            </>
          ) : (
            <p className="text-sm text-emerald-300/70">Waiting for the host…</p>
          )}
        </div>
      </div>
    </div>
  );
}
