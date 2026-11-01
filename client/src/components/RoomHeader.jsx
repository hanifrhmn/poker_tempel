import ConnectionQuality from './ConnectionQuality.jsx';
import CopyLinkButton from './CopyLinkButton.jsx';
import SoundToggle from './SoundToggle.jsx';

export default function RoomHeader({ room, onLeave }) {
  const leave = () => {
    if (window.confirm('Leave the room?')) onLeave();
  };

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-800/50 bg-emerald-950/80 px-3 py-2 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="text-base font-black uppercase tracking-[0.2em] text-amber-300 sm:text-lg">
          Poker Tempel
        </span>
        <span className="rounded-full border border-emerald-700 bg-emerald-900 px-3 py-1 text-xs font-bold tracking-[0.25em] text-emerald-100">
          {room.code}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-emerald-300/70">
        {room.round > 0 ? <span>Round {room.round}</span> : <span>Lobby</span>}
        <ConnectionQuality />
        <SoundToggle />
        <CopyLinkButton
          code={room.code}
          label="Copy link"
          className="rounded-full border border-emerald-700 px-3 py-1 hover:bg-emerald-900"
        />
        <button
          type="button"
          onClick={leave}
          className="text-emerald-400/70 transition-colors hover:text-red-300"
        >
          Leave
        </button>
      </div>
    </header>
  );
}
