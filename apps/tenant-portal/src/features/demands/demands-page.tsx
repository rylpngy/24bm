import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { usePurchaseDemandList } from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  ResponsiveTableFrame,
  StatusPill,
  cn,
} from '@24bid/ui';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const STATUS_FILTERS = ['全部', '草稿', '审批中', '已通过', '已驳回'] as const;

// S1a：采购需求列表(读)。状态筛选经 usePurchaseDemandList 真实查询后端。
export function DemandsPage() {
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const query = usePurchaseDemandList(status === '全部' ? undefined : { status });
  const demands = query.data?.data ?? [];

  return (
    <Panel title="采购需求" icon={ClipboardList} subtitle="需求列表 · 审批提交 · 转询价">
      <ListToolbar
        title="采购需求"
        recordCount={demands.length}
        filterLabel={status}
        actionLabel="新建需求"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'h-8 rounded-md border px-3 text-xs font-black transition',
              s === status
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载需求列表…" />
      ) : demands.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无采购需求。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={demands.map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{d.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{d.id}</p>
                </div>
                {d.status && <StatusPill label={d.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="申请部门" value={d.departmentId ?? '—'} />
                <MiniFact label="预算金额" value={currency(d.budget)} />
              </div>
            </div>
          ))}
        >
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">需求编号</th>
                <th className="px-4 py-3">标题</th>
                <th className="px-4 py-3">申请部门</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">预算金额</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {demands.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-4 font-mono font-black text-slate-700">{d.id}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{d.title}</td>
                  <td className="px-4 py-4 text-slate-600">{d.departmentId}</td>
                  <td className="px-4 py-4">{d.status && <StatusPill label={d.status} />}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {currency(d.budget)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}
    </Panel>
  );
}
