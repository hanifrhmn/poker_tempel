import { SUIT_SYMBOLS } from '@poker-tempel/shared';

const SIZES = {
  sm: 'h-16 w-11 rounded-md',
  md: 'h-24 w-16 rounded-lg',
  lg: 'h-28 w-20 rounded-xl sm:h-32 sm:w-24',
};

const RANK_SIZE = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
const SUIT_SIZE = { sm: 'text-lg', md: 'text-2xl', lg: 'text-4xl' };

export default function CardFace({
  card,
  selected = false,
  highlight = 'amber',
  onClick,
  disabled = false,
  size = 'md',
  className = '',
}) {
  const red = card.suit === 'H' || card.suit === 'D';
  const color = red ? 'text-red-600' : 'text-slate-900';
  const interactive = Boolean(onClick) && !disabled;
  const hover = interactive && !selected ? 'hover:-translate-y-2 hover:z-10' : '';
  const ring = highlight === 'sky' ? 'ring-sky-400' : 'ring-amber-400';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`group relative shrink-0 bg-white shadow-lg shadow-black/30 transition-transform duration-150 ${SIZES[size]} ${interactive ? 'cursor-pointer' : 'cursor-default'} ${hover} ${selected ? `-translate-y-4 z-10 ring-2 ${ring}` : ''} ${className}`}
    >
      <span className={`absolute left-1.5 top-1 font-black leading-none ${RANK_SIZE[size]} ${color}`}>
        {card.rank}
      </span>
      <span
        className={`absolute inset-0 flex items-center justify-center ${SUIT_SIZE[size]} ${color}`}
      >
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span
        className={`absolute bottom-1 right-1.5 rotate-180 font-black leading-none ${RANK_SIZE[size]} ${color}`}
      >
        {card.rank}
      </span>
    </button>
  );
}
