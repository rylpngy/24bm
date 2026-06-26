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

/** 轻量受控横向 Tab——一条标签栏 + 选中下划线;用于详情页二级切换。 */
export function Tabs({ items, value, onChange }: TabsProps) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-200">
      {items.map((t) => {
        const active = t.id === value;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-black transition',
              '-mb-px border-b-2',
              active
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800',
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
