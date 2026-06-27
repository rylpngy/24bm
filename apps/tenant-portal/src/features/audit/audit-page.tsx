import { useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useAuditLogList } from '@24bid/api-client';
import { FeedbackNotice, Panel, StatusPill } from '@24bid/ui';

// 操作动作前缀 → 中文标签(目标类型),覆盖主流程审计动作;未命中回退原值。
const TARGET_LABELS: Record<string, string> = {
  purchase_demand: '采购需求',
  material: '物料',
  rfq: '询价',
  award: '定标',
  quote: '报价',
  purchase_order: '采购订单',
  contract: '合同',
  invoice: '发票',
  receipt: '收货',
  buyer_supplier_relation: '供应商',
  supplier_enterprise: '供应商企业',
};

const ACTION_VERB: Record<string, string> = {
  created: '创建',
  updated: '更新',
  submitted: '提交',
  approved: '通过',
  rejected: '驳回',
  awarded: '定标',
  confirmed: '确认',
  shipped: '发货',
  received: '收货',
  paid: '已付款',
  partial_paid: '部分付款',
  archived: '归档',
  admitted: '准入',
  blacklisted: '拉黑',
};

function actionLabel(action?: string) {
  if (!action) return '—';
  const [domain, verb] = action.split('.');
  const v = ACTION_VERB[verb] ?? verb ?? '';
  const d = TARGET_LABELS[domain] ?? domain;
  return `${d}·${v}`;
}

// 审计日志:租户内最近操作留痕(谁、做了什么、对什么、何时)。
export function AuditPage() {
  const [limit, setLimit] = useState(50);
  const audit = useAuditLogList({ limit });
  const logs = audit.data?.data ?? [];

  const grouped = useMemo(() => logs, [logs]);

  return (
    <Panel title="审计日志" icon={History} subtitle="租户内最近操作留痕">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="mr-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
          共 {logs.length} 条
        </span>
        {[50, 100, 200].map((n) => (
          <button key={n} type="button" onClick={() => setLimit(n)}
            className={
              n === limit
                ? 'h-8 rounded-md bg-blue-600 px-3 text-xs font-black text-white'
                : 'h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50'
            }>
            近 {n} 条
          </button>
        ))}
      </div>

      {audit.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载审计日志…" />
      ) : grouped.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无操作记录。" />
      ) : (
        <div className="space-y-2">
          {grouped.map((l) => (
            <div key={l.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <StatusPill label={actionLabel(l.action)} />
                <div className="min-w-0">
                  <p className="break-words font-mono text-xs font-black text-slate-700">{l.targetId}</p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                    {TARGET_LABELS[l.targetType ?? ''] ?? l.targetType}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-black text-slate-600">{l.actorId}</p>
                <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                  {l.createdAt?.slice(0, 19).replace('T', ' ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
