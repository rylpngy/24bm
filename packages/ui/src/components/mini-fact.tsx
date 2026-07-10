import { cn } from '../lib/cn';

export interface MiniFactProps {
  label: string;
  value: string;
  compact?: boolean;
}

/** 字段卡片——密集展示标签+值。复刻自现有 MiniFact。 */
export function MiniFact({ label, value, compact = false }: MiniFactProps) {
  return (
    <div
      className={cn(
        'min-w-0 rounded-lg border border-slate-100 bg-white/80',
        compact ? 'px-2 py-1.5' : 'px-3 py-2',
      )}
    >
      <p className={cn('font-black text-slate-400', compact ? 'text-[10px]' : 'text-[11px]')}>
        {label}
      </p>
      <p
        className={cn(
          'break-words font-bold text-slate-700',
          compact ? 'mt-0.5 line-clamp-3 text-[11px] leading-4' : 'mt-1 text-xs leading-5',
        )}
      >
        {value}
      </p>
    </div>
  );
}
