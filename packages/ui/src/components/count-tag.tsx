import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface CountTagProps {
  children: ReactNode;
  className?: string;
}

/** 列表工具条统计标签——「共 N 条」「队列 N 家」等计数胶囊。统一灰底描边样式。 */
export function CountTag({ children, className }: CountTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500',
        className,
      )}
    >
      {children}
    </span>
  );
}
