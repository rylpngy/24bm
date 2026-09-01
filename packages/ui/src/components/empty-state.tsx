import type { ElementType } from 'react';
import { FileText } from 'lucide-react';

export function EmptyState({
  title,
  description,
  icon: Icon = FileText,
}: {
  title: string;
  description?: string;
  icon?: ElementType;
}) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <Icon size={19} />
      </span>
      <p className="mt-3 text-sm font-black text-slate-600">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs font-bold leading-5 text-slate-400">{description}</p>}
    </div>
  );
}
