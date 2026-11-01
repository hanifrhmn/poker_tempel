import Button from './Button.jsx';

export default function GameEndOverlay({ room, onLeave }) {
  const standings =
    room.standings ?? [...(room.players ?? [])].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-emerald-950/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-amber-400/30 bg-emerald-900 p-6 shadow-2xl shadow-black/50">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.35em] text-amber-300/70">
          Session complete
        </p>
        <h2 className="mt-1 text-center text-3xl font-black text-amber-200">Final standings</h2>

        <ol className="mt-5 space-y-2">
          {standings.map((player, index) => (
            <li
              key={player.seat}
              className="flex items-center justify-between rounded-xl bg-emerald-950/60 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-7 shrink-0 text-center text-sm font-black text-amber-300">
                  {index + 1}
                </span>
                <span className="truncate font-semibold text-emerald-50">
                  {player.name}
                  {player.isBot ? (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                      Bot
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-black text-amber-200">{player.score} pts</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/60">
                  {player.wins} {player.wins === 1 ? 'win' : 'wins'}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={onLeave}>
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
