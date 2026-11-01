const VARIANTS = {
  primary:
    'bg-amber-400 text-emerald-950 hover:bg-amber-300 disabled:bg-emerald-800 disabled:text-emerald-600',
  secondary:
    'border border-emerald-600/80 bg-emerald-900/80 text-emerald-100 hover:bg-emerald-800 disabled:opacity-40',
  danger: 'border border-red-500/50 bg-red-950/70 text-red-200 hover:bg-red-900/70',
  ghost: 'text-emerald-300/80 hover:text-emerald-100 disabled:opacity-40',
};

export default function Button({ variant = 'secondary', className = '', type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`rounded-full px-4 py-2 text-sm font-bold tracking-wide transition-colors disabled:cursor-not-allowed ${VARIANTS[variant] ?? VARIANTS.secondary} ${className}`}
      {...props}
    />
  );
}
