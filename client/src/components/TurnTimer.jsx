import { useEffect, useState } from 'react';

export default function TurnTimer({ deadline, durationMs = 30_000, name, isMyTurn }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  const remaining = Math.max(0, deadline - now);
  const percent = Math.max(0, Math.min(100, (remaining / durationMs) * 100));
  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining <= 5000;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
        <span className={isMyTurn ? 'text-amber-300' : 'text-emerald-300/60'}>
          {isMyTurn ? 'Your turn' : name ? `${name}'s turn` : 'Turn'}
        </span>
        <span className={urgent ? 'text-red-300' : 'text-emerald-300/60'}>{seconds}s</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-950">
        <div
          className={`h-full transition-[width] duration-100 ${urgent ? 'bg-red-500' : 'bg-amber-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
