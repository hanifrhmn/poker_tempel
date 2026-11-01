import Button from './Button.jsx';
import CopyLinkButton from './CopyLinkButton.jsx';
import RoomHeader from './RoomHeader.jsx';

export default function LobbyScreen({ room, onStart, onAddBot, onRemoveBot, onLeave }) {
  const isHost = room.yourSeat === room.hostSeat;
  const full = room.slots.every(Boolean);

  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.14),transparent_65%)]" />
      <RoomHeader room={room} onLeave={onLeave} />

      <main className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:py-10">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-300/60">
            Room lobby
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-[0.25em] text-amber-300 sm:text-4xl">
            {room.code}
          </h1>
          <p className="mt-2 text-sm text-emerald-200/70">
            Share the invite link with friends on the same Radmin/ZeroTier network.
          </p>
          <CopyLinkButton
            code={room.code}
            className="mt-3 rounded-full border border-emerald-700 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200 hover:bg-emerald-900"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {room.slots.map((slot, seat) => (
            <div
              key={seat}
              className={`rounded-2xl border p-4 ${
                seat === room.yourSeat
                  ? 'border-amber-400/50 bg-emerald-900/60'
                  : 'border-emerald-800/60 bg-emerald-900/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/60">
                  Seat {seat + 1}
                </span>
                {room.hostSeat === seat ? (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black tracking-wider text-emerald-950">
                    HOST
                  </span>
                ) : null}
              </div>

              {slot ? (
                <>
                  <p className="mt-2 truncate text-lg font-bold text-emerald-50">
                    {slot.name}
                    {seat === room.yourSeat ? (
                      <span className="ml-1 text-xs font-semibold text-emerald-300/60">(you)</span>
                    ) : null}
                  </p>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                    {slot.isBot ? (
                      <span className="text-sky-300">Bot</span>
                    ) : (
                      <span className={slot.connected ? 'text-emerald-400/80' : 'text-red-300'}>
                        {slot.connected ? 'Online' : 'Offline'}
                      </span>
                    )}
                  </div>
                  {isHost && slot.isBot ? (
                    <button
                      type="button"
                      onClick={() => onRemoveBot(seat)}
                      className="mt-3 text-[11px] font-bold uppercase tracking-wider text-red-300/70 hover:text-red-200"
                    >
                      Remove bot
                    </button>
                  ) : null}
                </>
              ) : (
                <div className="mt-3">
                  <p className="text-sm text-emerald-300/50">Empty seat</p>
                  {isHost ? (
                    <Button
                      onClick={onAddBot}
                      className="mt-3 px-3 py-1.5 text-xs"
                    >
                      Add bot
                    </Button>
                  ) : (
                    <p className="mt-1 text-xs text-emerald-400/40">Waiting for a player…</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          {isHost ? (
            <Button
              variant="primary"
              onClick={onStart}
              disabled={!full}
              className="w-full max-w-xs px-6 py-3 text-base"
            >
              {full ? 'Start game' : 'Fill all seats to start'}
            </Button>
          ) : (
            <p className="text-sm font-semibold text-emerald-300/70">
              {full ? 'Waiting for the host to start…' : 'Waiting for more players…'}
            </p>
          )}
          <p className="text-[10px] uppercase tracking-wider text-emerald-400/40">
            Round 1: all 3s are discarded, 3♠ holder leads
          </p>
        </div>
      </main>
    </div>
  );
}
