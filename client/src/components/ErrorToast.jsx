import { useEffect } from 'react';

export default function ErrorToast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 rounded-xl border border-red-400/40 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-2xl">
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-red-900"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
