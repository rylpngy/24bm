import { Activity, Database, ShieldCheck } from 'lucide-react';

const toneClasses = {
  loading: 'border-blue-100 bg-blue-50 text-blue-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
};

/** 加载/空/错误态。复刻自旧 ShellState。 */
export function ShellState({
  variant,
  title,
  desc,
  actionLabel,
  onAction,
}: {
  variant: 'loading' | 'error' | 'empty';
  title: string;
  desc: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const Icon = variant === 'error' ? ShieldCheck : variant === 'loading' ? Activity : Database;
  return (
    <div
      className={`flex min-h-[12rem] items-center justify-center rounded-lg border p-6 text-center ${toneClasses[variant]}`}
    >
      <div className="flex max-w-xl flex-col items-center justify-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{title}</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{desc}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-xs font-black shadow-sm transition hover:bg-white/80"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
