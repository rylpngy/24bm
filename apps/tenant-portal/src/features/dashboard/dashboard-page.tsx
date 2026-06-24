import { useMemo } from 'react';
import { Activity, ClipboardCheck, FileText, Package, TrendingUp, Users } from 'lucide-react';
import { useBuyerWorkspaceLoad } from '@24bid/api-client';
import {
  DetailSection,
  Panel,
  ShellState,
  StatusPill,
  WorkflowRail,
  type WorkflowStep,
} from '@24bid/ui';

const currency = (v: number) => `¥${v.toLocaleString('zh-CN')}`;

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-black text-slate-400">{label}</p>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${accent}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="mt-2 font-mono text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function DashboardPage() {
  const ws = useBuyerWorkspaceLoad();
  const data = ws.data?.data;

  const kpis = useMemo(() => {
    const orders = data?.orders ?? [];
    const totalSpend = orders.reduce((s, o) => s + (o.amount ?? 0), 0);
    const received = orders.filter((o) => o.status === '已收货').length;
    const fulfillRate = orders.length ? Math.round((received / orders.length) * 100) : 0;
    const activeRfqs = (data?.rfqs ?? []).filter((r) =>
      ['报价中', '定标审批中'].includes(r.status ?? ''),
    ).length;
    return {
      totalSpend,
      fulfillRate,
      activeRfqs,
      suppliers: (data?.suppliers ?? []).length,
      materials: (data?.materials ?? []).length,
      demands: (data?.demands ?? []).length,
    };
  }, [data]);

  const workflow = useMemo<WorkflowStep[]>(() => {
    const d = data?.demands ?? [];
    const r = data?.rfqs ?? [];
    const o = data?.orders ?? [];
    const inv = data?.invoices ?? [];
    const has = (arr: unknown[]) => arr.length > 0;
    const some = <T,>(arr: T[], f: (x: T) => boolean) => arr.some(f);
    const st = (done: boolean, doing: boolean) => (done ? '已完成' : doing ? '进行中' : '待开始');
    return [
      { key: 'demand', label: '需求申请', owner: '采购方', status: st(has(d), false) },
      { key: 'approval', label: '需求审批', owner: '审批人', status: st(some(d, (x) => x.status === '已通过'), some(d, (x) => x.status === '审批中')) },
      { key: 'rfq', label: '询价发布', owner: '采购方', status: st(has(r), false) },
      { key: 'quote', label: '供应商报价', owner: '供应商', status: st(some(r, (x) => (x.quotes ?? []).length > 0), false) },
      { key: 'award', label: '比价定标', owner: '采购方', status: st(some(r, (x) => x.status === '已定标'), some(r, (x) => x.status === '定标审批中')) },
      { key: 'order', label: '采购订单', owner: '采购方', status: st(has(o), false) },
      { key: 'delivery', label: '供应商发货', owner: '供应商', status: st(some(o, (x) => ['已发货', '已收货'].includes(x.status ?? '')), false) },
      { key: 'receipt', label: '收货验收', owner: '采购方', status: st(some(o, (x) => x.status === '已收货'), false) },
      { key: 'payment', label: '发票付款', owner: '采购方', status: st(some(inv, (x) => x.paymentStatus === '已付款'), some(inv, (x) => x.paymentStatus === '待付款')) },
    ];
  }, [data]);

  const todo = data?.todoSummary;
  const recent = data?.recentApprovals ?? [];

  if (ws.isLoading) {
    return <ShellState variant="loading" title="正在加载工作台" desc="拉取采购概览、待办与履约进度…" />;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi icon={TrendingUp} label="采购订单总额" value={currency(kpis.totalSpend)} accent="bg-blue-50 text-blue-700" />
        <Kpi icon={ClipboardCheck} label="待办审批" value={String(todo?.pendingApprovalCount ?? 0)} accent="bg-amber-50 text-amber-700" />
        <Kpi icon={FileText} label="活跃询价" value={String(kpis.activeRfqs)} accent="bg-indigo-50 text-indigo-700" />
        <Kpi icon={Activity} label="履约率" value={`${kpis.fulfillRate}%`} accent="bg-emerald-50 text-emerald-700" />
        <Kpi icon={Users} label="私域供应商" value={String(kpis.suppliers)} accent="bg-cyan-50 text-cyan-700" />
        <Kpi icon={Package} label="物料/需求" value={`${kpis.materials} / ${kpis.demands}`} accent="bg-slate-100 text-slate-600" />
      </div>

      <Panel title="采购主线进度" icon={Activity} subtitle="需求 → 询价 → 定标 → 订单 → 收货 → 付款">
        <WorkflowRail steps={workflow} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="待办聚合" icon={ClipboardCheck} subtitle="按主流程节点统计">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: '待审批', value: todo?.pendingApprovalCount ?? 0 },
              { label: '待定标', value: todo?.pendingAwardCount ?? 0 },
              { label: '待收货', value: todo?.pendingReceiptCount ?? 0 },
              { label: '待付款', value: todo?.pendingPaymentCount ?? 0 },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-400">{t.label}</p>
                <p className="mt-1 font-mono text-xl font-black text-slate-950">{t.value}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="最近审批" icon={ClipboardCheck} subtitle="已处理记录">
          {recent.length === 0 ? (
            <ShellState variant="empty" title="暂无审批记录" desc="处理审批后将在此汇总。" />
          ) : (
            <DetailSection title="最近处理" countLabel={`${recent.length} 条`}>
              <div className="space-y-2">
                {recent.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-900">{t.summaryTitle}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">{t.bizType}</p>
                    </div>
                    {t.businessStatus && <StatusPill label={t.businessStatus} />}
                  </div>
                ))}
              </div>
            </DetailSection>
          )}
        </Panel>
      </div>
    </div>
  );
}
