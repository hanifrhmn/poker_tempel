import { useState } from 'react';
import { isSoundEnabled, setSoundEnabled } from '../lib/audio.js';

export default function SoundToggle() {
  const [enabled, setEnabledState] = useState(() => isSoundEnabled());

  const toggle = () => {
    const next = !enabled;
    setEnabledState(next);
    setSoundEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className="rounded-full border border-emerald-700 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-200/80 transition-colors hover:bg-emerald-900"
    >
      {enabled ? 'Sound on' : 'Sound off'}
    </button>
  );
}
