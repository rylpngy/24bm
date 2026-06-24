import { Search } from 'lucide-react';

export interface ListToolbarProps {
  title: string;
  recordCount: number;
  filterLabel: string;
  actionLabel?: string;
}

/** 列表工具条——左蓝竖线 + 计数 + 筛选提示。复刻自现有 ListToolbar。 */
export function ListToolbar({ title, recordCount, filterLabel, actionLabel }: ListToolbarProps) {
  return (
    <div
      aria-label={`${title} 列表工具条`}
      className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white/95 p-3 shadow-sm shadow-slate-200/70 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words text-sm font-black text-slate-950">{title}</p>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">
            共 {recordCount} 条
          </span>
        </div>
        <p className="mt-1 text-xs font-bold text-slate-500">当前筛选：{filterLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-slate-600">
          <Search size={16} />
          顶部搜索
        </span>
        <span className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-slate-600">
          状态筛选
        </span>
        {actionLabel && (
          <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-slate-900 px-2.5 text-xs font-black text-white">
            {actionLabel}
          </span>
        )}
      </div>
    </div>
  );
}
