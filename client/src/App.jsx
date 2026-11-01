import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io();

const SUITS = [
  { symbol: '♠', className: 'text-slate-900' },
  { symbol: '♥', className: 'text-red-600' },
  { symbol: '♦', className: 'text-red-600' },
  { symbol: '♣', className: 'text-slate-900' },
];

export default function App() {
  const [connected, setConnected] = useState(socket.connected);
  const [health, setHealth] = useState(null);
  const [welcome, setWelcome] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setHealth(null));

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onHello = (payload) => setWelcome(payload.message);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('server:hello', onHello);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('server:hello', onHello);
    };
  }, []);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-emerald-950 px-6 text-emerald-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(16,185,129,0.18),transparent_65%)]" />

      <section className="relative flex w-full max-w-xl flex-col items-center gap-8 rounded-3xl border border-emerald-800/60 bg-emerald-900/40 px-8 py-12 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex items-center gap-3 text-3xl">
          {SUITS.map((suit, index) => (
            <span
              key={suit.symbol}
              className={`${suit.className} drop-shadow-sm ${index % 2 === 0 ? 'translate-y-0' : 'translate-y-1'}`}
            >
              {suit.symbol}
            </span>
          ))}
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-black uppercase tracking-[0.2em] text-amber-300 sm:text-5xl">
            Poker Tempel
          </h1>
          <p className="mt-3 text-sm font-medium tracking-wide text-emerald-200/80">
            Real-time Big Two for you and your friends
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-emerald-700/60 bg-emerald-950/60 px-4 py-2 text-xs font-semibold tracking-wide">
          <span
            className={`size-2.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]' : 'bg-red-500'}`}
          />
          {connected ? 'Server connected' : 'Waiting for server...'}
        </div>

        <p className="h-5 text-center text-xs text-emerald-300/60">
          {welcome || health?.game ? welcome || `Health: ${health.status} · ${health.maxPlayers} players` : ''}
        </p>

        <div className="w-full rounded-2xl border border-dashed border-emerald-700/50 bg-emerald-950/30 px-5 py-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300/80">Phase 0 complete</p>
          <p className="mt-1 text-sm text-emerald-200/70">Scaffolding ready — lobby and game table land next.</p>
        </div>
      </section>
    </main>
  );
}
