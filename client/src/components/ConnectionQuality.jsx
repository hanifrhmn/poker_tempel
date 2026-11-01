import { useLatency } from '../hooks/useLatency.js';

export default function ConnectionQuality() {
  const { connected, latency } = useLatency();

  let dot = 'bg-emerald-400';
  let label = '—';

  if (!connected) {
    dot = 'bg-red-500';
    label = 'Offline';
  } else if (latency === null) {
    label = 'Pinging';
  } else {
    label = `${latency} ms`;
    if (latency >= 200) dot = 'bg-red-500';
    else if (latency >= 80) dot = 'bg-amber-400';
  }

  return (
    <span className="flex items-center gap-1.5" title="Round-trip latency">
      <span className={`size-2 rounded-full ${dot}`} />
      <span>{label}</span>
    </span>
  );
}
