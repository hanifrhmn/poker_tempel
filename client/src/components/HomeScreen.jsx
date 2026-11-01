import { useState } from 'react';
import { getRoomFromUrl, loadName, saveName } from '../lib/storage.js';
import Button from './Button.jsx';

export default function HomeScreen({ connected, busy, onCreate, onJoin }) {
  const [name, setName] = useState(() => loadName());
  const [code, setCode] = useState(() => getRoomFromUrl());

  const nameReady = name.trim().length > 0;
  const disabled = !connected || busy || !nameReady;

  const create = async (event) => {
    event.preventDefault();
    if (disabled) return;
    saveName(name.trim());
    await onCreate(name.trim());
  };

  const join = async (event) => {
    event.preventDefault();
    if (disabled || !code.trim()) return;
    saveName(name.trim());
    await onJoin(code.trim().toUpperCase(), name.trim());
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_65%)]" />

      <div className="relative w-full max-w-3xl">
        <div className="text-center">
          <p className="text-3xl tracking-[0.3em] text-emerald-200/80">♠ ♥ ♦ ♣</p>
          <h1 className="mt-4 text-4xl font-black uppercase tracking-[0.2em] text-amber-300 sm:text-5xl">
            Poker Tempel
          </h1>
          <p className="mt-2 text-sm text-emerald-200/70">
            Real-time Big Two for you and your friends on the same network
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-emerald-800/60 bg-emerald-900/50 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
          <label htmlFor="player-name" className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300/70">
            Your name
          </label>
          <input
            id="player-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            autoFocus
            placeholder="e.g. Hanif"
            className="mt-2 w-full rounded-xl border border-emerald-700/70 bg-emerald-950/70 px-4 py-3 text-sm text-emerald-50 placeholder:text-emerald-500/50 focus:border-amber-400 focus:outline-none"
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <form
              onSubmit={create}
              className="flex flex-col rounded-2xl border border-emerald-800/50 bg-emerald-950/40 p-4"
            >
              <p className="text-sm font-bold text-emerald-100">Start a table</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-emerald-300/60">
                Create a room, share the invite link, and fill empty seats with bots.
              </p>
              <Button type="submit" variant="primary" disabled={disabled} className="mt-4 w-full py-2.5">
                {busy ? 'Please wait…' : 'Create room'}
              </Button>
            </form>

            <form
              onSubmit={join}
              className="flex flex-col rounded-2xl border border-emerald-800/50 bg-emerald-950/40 p-4"
            >
              <label htmlFor="room-code" className="text-sm font-bold text-emerald-100">
                Join a room
              </label>
              <input
                id="room-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={5}
                placeholder="ROOM CODE"
                className="mt-3 w-full rounded-xl border border-emerald-700/70 bg-emerald-950/70 px-3 py-2 text-center text-sm font-bold tracking-[0.3em] text-emerald-50 placeholder:text-emerald-500/40 focus:border-amber-400 focus:outline-none"
              />
              <Button
                type="submit"
                variant="secondary"
                disabled={disabled || !code.trim()}
                className="mt-4 w-full py-2.5"
              >
                Join room
              </Button>
            </form>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-300/60">
            <span className={`size-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
            {connected ? 'Server connected' : 'Waiting for server…'}
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-emerald-300/50">
          Host runs the server, friends open the invite link over Radmin VPN or ZeroTier.
        </p>
      </div>
    </div>
  );
}
