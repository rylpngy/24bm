import { useId, type ReactNode } from 'react';
import { cn } from '@24bid/ui';

export const applicationFormTabs = [
  { id: 'basic', label: '基本信息' },
  { id: 'equipment', label: '设备清单' },
  { id: 'mall', label: '商城确认' },
  { id: 'requirements', label: '采购要求' },
  { id: 'delivery', label: '交付验收' },
  { id: 'routing', label: '流程确认' },
];

export function requiredFieldTab(label: string): string {
  if (/商城最终|商城供应商|商城确认单价|配置标准单价|商城选型人员/.test(label)) return 'mall';
  if (/^第 \d+ 条|设备清单|核心产品/.test(label)) return 'equipment';
  if (['采购标的功能', '采购目标', '购置理由及必要性'].includes(label)) return 'requirements';
  if (['采购项目名称', '申报单位', '经费来源', '经费主管单位', '项目负责人', '技术负责人'].includes(label)) return 'basic';
  return 'delivery';
}

export function ApplicationTabs({ tabs, value, onChange, children, label = '申报信息分类' }: {
  tabs: Array<{ id: string; label: string; badge?: number }>;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label?: string;
}) {
  const id = useId();
  return <div className="min-w-0 space-y-5">
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-2 pt-2">
      {tabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
        id={`${id}-${tab.id}`} aria-selected={value === tab.id} aria-controls={`${id}-panel`}
        tabIndex={value === tab.id ? 0 : -1}
        onClick={() => onChange(tab.id)}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          onChange(tabs[next].id);
          document.getElementById(`${id}-${tabs[next].id}`)?.focus();
        }}
        className={cn('inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
          value === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800')}>
        {tab.label}{!!tab.badge && <span aria-label={`待完成${tab.badge}项`} className="rounded bg-amber-50 px-1.5 text-xs text-amber-700">{tab.badge}</span>}
      </button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} className="min-w-0 space-y-5">{children}</div>
  </div>;
}
