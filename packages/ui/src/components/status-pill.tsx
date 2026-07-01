import { resolveStatusTone, statusToneClasses } from '@24bid/shared';
import { cn } from '../lib/cn';

export interface StatusPillProps {
  label: string;
  className?: string;
}

/**
 * 状态标签——按中文状态文本自动配色（绿/黄/灰）。
 */
export function StatusPill({ label, className }: StatusPillProps) {
  const tone = resolveStatusTone(label);
  return (
    <span
      className={cn(
        'inline-flex max-w-full min-w-0 items-center break-words rounded-lg border px-2 py-1 text-xs font-black leading-4',
        statusToneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
