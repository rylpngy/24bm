import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onBack?: () => void;
  actions?: ReactNode;
  meta?: ReactNode;
}

/** 后台模块和二级详情页共用标题栏。 */
export function PageHeader({ title, subtitle, eyebrow, onBack, actions, meta }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-center gap-3 border-b border-slate-200 pb-5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="返回"
          title="返回"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft size={17} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[11px] font-black text-blue-600">{eyebrow}</p>}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 break-words text-xl font-black leading-tight text-slate-950">{title}</h2>
          {meta}
        </div>
        {subtitle && <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
    </header>
  );
}
