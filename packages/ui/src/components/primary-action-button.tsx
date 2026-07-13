import type { ElementType, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface PrimaryActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  pendingLabel?: string;
  icon?: ElementType;
  fullWidth?: boolean;
  flushTop?: boolean;
  size?: 'sm' | 'md';
  tone?: 'blue' | 'emerald' | 'amber' | 'red';
  testId?: string;
}

const toneClasses = {
  blue: 'bg-blue-600 hover:bg-blue-700',
  emerald: 'bg-emerald-600 hover:bg-emerald-700',
  amber: 'bg-amber-600 hover:bg-amber-700',
  red: 'bg-red-600 hover:bg-red-700',
} as const;

const sizeClasses = {
  sm: 'h-9 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
} as const;

/** 主操作按钮——tone + size 可配，busy 态。复刻自现有 PrimaryActionButton。 */
export function PrimaryActionButton({
  children,
  onClick,
  disabled = false,
  busy = false,
  pendingLabel,
  icon: Icon,
  fullWidth = false,
  flushTop = false,
  size = 'sm',
  tone = 'blue',
  testId,
}: PrimaryActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-center font-black leading-4 text-white shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white disabled:shadow-none',
        flushTop ? '' : 'mt-3',
        fullWidth && 'w-full',
        sizeClasses[size],
        toneClasses[tone],
      )}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      <span className="min-w-0 max-w-full break-words">
        {busy && pendingLabel ? pendingLabel : children}
      </span>
    </button>
  );
}
