import type { ElementType, ReactNode } from 'react';
import { cn } from '@24bid/ui';

type Tone = 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'slate';

const toneClasses: Record<Tone, { card: string; icon: string; accent: string }> = {
  blue: {
    card: 'border-blue-100 bg-white',
    icon: 'bg-blue-50 text-blue-600',
    accent: 'bg-blue-500',
  },
  emerald: {
    card: 'border-emerald-100 bg-white',
    icon: 'bg-emerald-50 text-emerald-600',
    accent: 'bg-emerald-500',
  },
  amber: {
    card: 'border-amber-100 bg-white',
    icon: 'bg-amber-50 text-amber-600',
    accent: 'bg-amber-500',
  },
  violet: {
    card: 'border-violet-100 bg-white',
    icon: 'bg-violet-50 text-violet-600',
    accent: 'bg-violet-500',
  },
  rose: {
    card: 'border-rose-100 bg-white',
    icon: 'bg-rose-50 text-rose-600',
    accent: 'bg-rose-500',
  },
  slate: {
    card: 'border-slate-200 bg-white',
    icon: 'bg-slate-100 text-slate-600',
    accent: 'bg-slate-400',
  },
};

export function SupplierMetricGrid({ children, columns = 4 }: { children: ReactNode; columns?: 4 | 5 }) {
  return (
    <div
      className={cn(
        'mb-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3 sm:grid-cols-2',
        columns === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  );
}

export function SupplierMetricCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'blue',
}: {
  icon: ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  const cls = toneClasses[tone];
  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-lg border p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/70',
        cls.card,
      )}
    >
      <span className={cn('absolute inset-x-0 top-0 h-0.5', cls.accent)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-slate-400">{label}</p>
          <p className="mt-1 font-mono text-xl font-black leading-none text-slate-950">{value}</p>
          {hint && <p className="mt-1 truncate text-xs font-bold text-slate-500">{hint}</p>}
        </div>
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            cls.icon,
          )}
        >
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

export function SupplierSummaryChips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function SupplierSummaryChip({
  icon: Icon,
  label,
  value,
  tone = 'blue',
}: {
  icon: ElementType;
  label: string;
  value: string;
  tone?: Tone;
}) {
  const cls = toneClasses[tone];
  return (
    <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 shadow-sm shadow-slate-200/40">
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-md', cls.icon)}>
        <Icon size={12} />
      </span>
      {label}
      <strong className="font-mono text-sm text-slate-950">{value}</strong>
    </span>
  );
}
