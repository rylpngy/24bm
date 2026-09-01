import type { ElementType, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ActionButtonProps {
  children: ReactNode;
  onClick: () => void;
  icon?: ElementType;
  disabled?: boolean;
  tone?: 'neutral' | 'blue' | 'red';
  size?: 'sm' | 'md';
  title?: string;
}

const tones = {
  neutral: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  red: 'border-red-200 bg-white text-red-700 hover:bg-red-50',
} as const;

/** 标准次级操作按钮，适用于列表行、详情页工具区和对话框次操作。 */
export function ActionButton({
  children,
  onClick,
  icon: Icon,
  disabled = false,
  tone = 'neutral',
  size = 'sm',
  title,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border font-black transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' ? 'h-10 px-4 text-sm' : 'h-9 px-3 text-xs',
        tones[tone],
      )}
    >
      {Icon && <Icon size={size === 'md' ? 16 : 13} className="shrink-0" />}
      {children}
    </button>
  );
}
