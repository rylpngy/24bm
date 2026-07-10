import { cn } from '../lib/cn';

export interface FilterTabItem {
  id: string;
  label: string;
  count?: number;
}

export interface FilterTabsProps {
  items: FilterTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

/** 分段式筛选 Tab——白底滑块高亮 + 计数徽章;用于列表状态筛选,横向可滚动。 */
export function FilterTabs({ items, value, onChange, className }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex max-w-full items-center gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-100/80 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-black transition-all duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-300',
              active
                ? 'bg-white text-blue-700 shadow-sm shadow-slate-300/60 ring-1 ring-slate-200'
                : 'text-slate-500 hover:bg-white/60 hover:text-slate-800 active:scale-[0.97]',
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 font-mono text-[10px] font-black leading-none transition-colors',
                  active ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/80 text-slate-500',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
