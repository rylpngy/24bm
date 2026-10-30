import { useId, type ReactNode } from 'react';
import { cn } from '@24bid/ui';

export const rfqDetailTabs = [
  { id: 'overview', label: '项目概览' },
  { id: 'suppliers', label: '供应商参与' },
  { id: 'quotations', label: '报价与版本' },
  { id: 'technical', label: '技术比价' },
  { id: 'comparison', label: '比价定标' },
  { id: 'announcements', label: '澄清公告' },
  { id: 'result', label: '审批与结果' },
];

export function defaultRfqTab(status?: string): string {
  if (status === '报价中') return 'suppliers';
  if (status === '已开标') return 'comparison';
  if (status === '定标审批中' || status === '已定标') return 'result';
  return 'overview';
}

export function RfqDetailTabs({ value, onChange, children }: {
  value: string; onChange: (value: string) => void; children: ReactNode;
}) {
  const id = useId();
  return <div className="min-w-0 space-y-4">
    <div role="tablist" aria-label="询比价项目分类" className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-2 pt-2">
      {rfqDetailTabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
        id={`${id}-${tab.id}`} aria-controls={`${id}-panel`} aria-selected={value === tab.id}
        tabIndex={value === tab.id ? 0 : -1} onClick={() => onChange(tab.id)}
        onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % rfqDetailTabs.length
            : event.key === 'ArrowLeft' ? (index + rfqDetailTabs.length - 1) % rfqDetailTabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? rfqDetailTabs.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault();
          onChange(rfqDetailTabs[next].id);
          document.getElementById(`${id}-${rfqDetailTabs[next].id}`)?.focus();
        }}
        className={cn('inline-flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300',
          value === tab.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800')}>
        {tab.label}
      </button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`} className="min-w-0 space-y-4">{children}</div>
  </div>;
}
