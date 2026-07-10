import type { ElementType } from 'react';
import { cn } from '../lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ElementType;
  badge?: string | number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
}

/** 轻量受控横向 Tab——分段式二级导航;用于模块内视图切换。 */
export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {items.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-black transition',
              active
                ? 'bg-white text-blue-700 shadow-sm shadow-slate-200/70 ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/70 hover:text-slate-800',
            )}
          >
            {Icon && <Icon size={15} />}
            {t.label}
            {t.badge != null && t.badge !== '' && (
              <span
                className={cn(
                  'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-black leading-none',
                  active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500',
                )}
              >
                {t.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
