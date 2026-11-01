export default function ConnectionBanner({ connected }) {
  if (connected) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-red-600 px-4 py-1.5 text-center text-xs font-bold uppercase tracking-wider text-white">
      Connection lost — reconnecting…
    </div>
  );
}
