import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Plus,
  ShieldCheck,
  Timer,
} from 'lucide-react';
import {
  type PendingApprovalTaskResponse,
  type PurchaseDemandResponse,
  type PurchaseOrderResponse,
  type RfqResponse,
  useApprovalInboxPending,
  useApprovalInboxRecent,
  useBuyerSupplierList,
  useDepartmentList,
  useMaterialList,
  usePurchaseDemandList,
  usePurchaseOrderList,
  useRfqCreate,
  useRfqList,
} from '@24bid/api-client';
import { FeedbackNotice, Panel, SearchInput, StatusPill, cn } from '@24bid/ui';
import { ProcurementPlanMergePage } from '../demands/demands-page';

const currency = (value?: number) =>
  value == null ? '--' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const stageSteps = ['需求整合', '方案制定', '方案审批', '采购执行', '验收归档'];

// 进度节点由真实单据推导:方案状态(RFQ)决定前三节点,关联采购订单的状态决定执行/验收节点。
function derivePlanProgress(plan: RfqResponse, order?: PurchaseOrderResponse) {
  if (plan.status === '已流标' || plan.status === '已废标') {
    return { currentIndex: -1, terminated: true as const, stageLabel: plan.status };
  }
  if (order) {
    if (order.status === '已收货') {
      return { currentIndex: 4, terminated: false as const, stageLabel: '验收归档' };
    }
    return { currentIndex: 3, terminated: false as const, stageLabel: '采购执行' };
  }
  if (plan.status === '已定标') {
    return { currentIndex: 3, terminated: false as const, stageLabel: '采购执行' };
  }
  if (plan.status === '已开标' || plan.status === '定标审批中') {
    return { currentIndex: 2, terminated: false as const, stageLabel: '方案审批' };
  }
  return { currentIndex: 1, terminated: false as const, stageLabel: '方案制定' };
}

function planNo(plan: RfqResponse, index = 0) {
  const date = plan.createdAt?.slice(0, 10).replaceAll('-', '') ?? '20260707';
  return `PLAN-${date}-${String(index + 1).padStart(3, '0')}`;
}

function departmentLabel(ids: Array<string | undefined>, departmentNames: Record<string, string>) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  return unique.map((id) => departmentNames[id!] ?? id).join('、') || '--';
}

function methodTone(method?: string) {
  if (method === '竞价') return 'bg-amber-50 text-amber-700';
  if (method === '商城') return 'bg-emerald-50 text-emerald-700';
  if (method === '单一来源') return 'bg-violet-50 text-violet-700';
  return 'bg-blue-50 text-blue-700';
}

function planBudget(demands: PurchaseDemandResponse[]) {
  return demands.reduce((sum, demand) => sum + (demand.budget ?? 0), 0);
}

function PlanList({
  plans,
  demands,
  orders,
  departmentNames,
  onOpen,
  onCreate,
}: {
  plans: RfqResponse[];
  demands: PurchaseDemandResponse[];
  orders: PurchaseOrderResponse[];
  departmentNames: Record<string, string>;
  onOpen: (plan: RfqResponse) => void;
  onCreate: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [method, setMethod] = useState('全部采购方式');
  const filtered = plans.filter((plan, index) => {
    const linked = demands.filter((demand) => plan.demandIds?.includes(demand.id ?? ''));
    const haystack = [planNo(plan, index), plan.title, plan.quoteRequirement, linked.map((d) => d.title).join(' ')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return (!keyword || haystack.includes(keyword.toLowerCase())) && (method === '全部采购方式' || plan.method === method);
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Panel title="采购计划" icon={ClipboardCheck} subtitle="需求合并 · 方案审批 · 执行监控">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 outline-none transition hover:bg-slate-50 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          <option>全部采购方式</option>
          <option>询比</option>
          <option>竞价</option>
          <option>商城</option>
          <option>单一来源</option>
        </select>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="搜索项目编号、名称、采购内容"
          onSearch={(value) => setKeyword(value)}
        />
        <button
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          type="button"
          onClick={onCreate}
        >
          <Plus size={14} /> 新建计划
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black text-slate-500">
            <tr>
              <th className="px-5 py-4">序号</th>
              <th className="px-5 py-4">项目编号</th>
              <th className="px-5 py-4">项目名称</th>
              <th className="px-5 py-4">采购内容</th>
              <th className="px-5 py-4">采购方式</th>
              <th className="px-5 py-4">当前阶段</th>
              <th className="px-5 py-4 text-right">操作</th>
            </tr>
          </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
            {filtered.map((plan, index) => {
              const linked = demands.filter((demand) => plan.demandIds?.includes(demand.id ?? ''));
              return (
                <tr key={plan.id} className="hover:bg-blue-50/30">
                  <td className="px-5 py-5 font-mono font-black text-slate-400">{index + 1}</td>
                  <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{planNo(plan, index)}</td>
                  <td className="px-5 py-5">
                    <p className="flex items-center gap-2 font-black text-slate-950">
                      {plan.title}
                      {linked.length > 0 && linked.every((d) => d.source === '直录登记') && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">直接创建</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{departmentLabel(linked.map((d) => d.departmentId), departmentNames)}</p>
                  </td>
                  <td className="px-5 py-5">
                    <p className="max-w-sm truncate text-sm font-bold text-slate-600">
                      {linked.map((d) => d.title).join('、') || plan.quoteRequirement || '--'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      <span className="rounded bg-slate-100 px-2 py-1">预算</span> {currency(planBudget(linked))}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    <span className={cn('rounded-md px-2 py-1 text-xs font-black', methodTone(plan.method))}>{plan.method ?? '询比'}</span>
                  </td>
                  <td className="px-5 py-5">
                    {(() => {
                      const progress = derivePlanProgress(plan, orders.find((o) => o.rfqId === plan.id));
                      return (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black',
                            progress.terminated ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700',
                          )}
                        >
                          <i className={cn('h-2 w-2 rounded-full', progress.terminated ? 'bg-red-500' : 'bg-blue-600')} />
                          {progress.stageLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-5 text-right">
                    <button
                      type="button"
                      onClick={() => onOpen(plan)}
                      className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </Panel>
    </div>
  );
}

function PlanDetail({
  plan,
  index,
  demands,
  order,
  awardApproval,
  supplierNames,
  materialNames,
  departmentNames,
  onBack,
  onNavigate,
}: {
  plan: RfqResponse;
  index: number;
  demands: PurchaseDemandResponse[];
  order?: PurchaseOrderResponse;
  awardApproval?: PendingApprovalTaskResponse;
  supplierNames: Record<string, string>;
  materialNames: Record<string, { name: string; unit: string }>;
  departmentNames: Record<string, string>;
  onBack: () => void;
  onNavigate?: (moduleId: string) => void;
}) {
  const linked = demands.filter((demand) => plan.demandIds?.includes(demand.id ?? ''));
  const budget = planBudget(linked);
  const progress = derivePlanProgress(plan, order);
  const currentIndex = progress.currentIndex;
  // 方案合规检查:基于当前方案的真实数据逐条核对(非模拟)。
  const complianceChecks = (() => {
    const checks: Array<{ ok: boolean; text: string }> = [];
    const supplierCount = plan.invitedSupplierIds?.length ?? 0;
    const quoteCount = plan.quotes?.length ?? 0;
    if (plan.method === '单一来源') {
      checks.push({ ok: supplierCount === 1, text: `单一来源须定向 1 家供应商(当前 ${supplierCount} 家)` });
      checks.push({ ok: Boolean(plan.singleSourceReason), text: '来源说明留痕(审批依据)' });
    } else if (plan.method !== '商城') {
      checks.push({
        ok: supplierCount === 0 || supplierCount >= 3,
        text: `${plan.method ?? '询比'}邀请供应商不少于 3 家(当前 ${supplierCount} 家,公开征集可为 0)`,
      });
    }
    if (plan.method === '竞价') {
      checks.push({ ok: plan.auctionStartPrice != null, text: '竞价起拍价已设置' });
    }
    if (plan.status === '报价中') {
      const overdue = plan.deadlineAt ? new Date(plan.deadlineAt).getTime() < Date.now() : false;
      checks.push({ ok: !overdue, text: overdue ? '报价截止已过,应尽快开标或顺延' : '报价截止时间未过' });
    }
    if (plan.status === '已开标' && plan.method !== '商城' && plan.method !== '单一来源') {
      checks.push({ ok: quoteCount >= 3, text: `定标须不少于 3 家有效报价(当前 ${quoteCount} 家)` });
    }
    checks.push({ ok: linked.length > 0, text: `已关联 ${linked.length} 条已通过需求` });
    return checks;
  })();
  const lineItems = linked.flatMap((demand) =>
    (demand.lineItems ?? []).map((line) => ({
      demand,
      materialId: line.materialId,
      quantity: line.quantity ?? 0,
      amount: (demand.budget ?? 0) / Math.max(1, demand.lineItems?.length ?? 1),
    })),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-words text-xl font-black text-slate-950">{plan.title}</h2>
                <StatusPill label={plan.status ?? '方案制定'} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                方案编号: {planNo(plan, index)} · 关联询比 {plan.id} · 创建日期: {plan.createdAt?.slice(0, 10) ?? '--'} · 申请部门: {departmentLabel(linked.map((d) => d.departmentId), departmentNames)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {(plan.status === '报价中' || plan.status === '已开标' || plan.status === '定标审批中') && onNavigate && (
              <button
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700"
                type="button"
                onClick={() => onNavigate('quotes')}
              >
                <CheckCircle2 size={15} /> 前往报价对比{plan.status === '报价中' ? '' : '定标'}
              </button>
            )}
            {(plan.status === '已定标' || order) && onNavigate && (
              <button
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                type="button"
                onClick={() => onNavigate('orders')}
              >
                <FileText size={15} /> 查看采购订单
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black text-slate-400">采购预算</p>
              <p className="mt-2 font-mono text-xl font-black text-slate-950">{currency(budget)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black text-slate-400">采购方式</p>
              <p className="mt-2 text-xl font-black text-blue-600">{plan.method ?? '询比'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black text-slate-400">征集方式</p>
              <p className="mt-2 text-xl font-black text-slate-950">{plan.method === '商城' ? '商品目录' : plan.method === '单一来源' ? '定向供应商' : '供应商参与'}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-8 flex items-center gap-2">
              <Timer size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">执行进度跟踪</h3>
            </div>
            {progress.terminated && (
              <div className="mb-4 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-xs font-black text-red-700">
                本方案已{plan.status}{plan.closeReason ? `:${plan.closeReason}` : ''},流程终止。
              </div>
            )}
            <div className="grid grid-cols-5 items-start gap-3">
              {stageSteps.map((step, stepIndex) => {
                const done = !progress.terminated && stepIndex < currentIndex;
                const current = !progress.terminated && stepIndex === currentIndex;
                return (
                  <div key={step} className="relative text-center">
                    {stepIndex < stageSteps.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
                    <span
                      className={cn(
                        'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                        done ? 'border-emerald-100 bg-emerald-500 text-white' : current ? 'border-blue-100 bg-blue-600 text-white' : 'border-slate-200 text-slate-300',
                      )}
                    >
                      {done ? <CheckCircle2 size={18} /> : current ? <Timer size={18} /> : <i className="h-2 w-2 rounded-full bg-current" />}
                    </span>
                    <p className={cn('mt-3 text-xs font-black', done || current ? 'text-blue-700' : 'text-slate-500')}>{step}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">
                      {(() => {
                        if (progress.terminated) return stepIndex === 0 ? '已完成' : '已终止';
                        if (done) return '已完成';
                        if (!current) return '待开始';
                        if (stepIndex === 1) return `报价中 · ${plan.quotes?.length ?? 0} 家已报`;
                        if (stepIndex === 2) return plan.status === '定标审批中' ? '定标审批中' : '开标评标中';
                        if (stepIndex === 3) return order ? `订单${order.status ?? ''}` : '待生成订单';
                        if (stepIndex === 4) return '货物已收,待归档';
                        return '处理中';
                      })()}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <ClipboardCheck size={18} className="text-violet-600" />
              <h3 className="text-base font-black text-slate-950">需求整合阶段详情</h3>
              <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-600">已完成</span>
            </div>
            <p className="border-t border-slate-100 pt-5 text-sm font-bold leading-7 text-slate-600">
              本方案整合 {linked.length} 条已通过采购需求,合计预算 {currency(budget)},覆盖部门
              {departmentLabel(linked.map((d) => d.departmentId), departmentNames)};合并采购统一征集报价。
            </p>
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">整合需求来源</p>
              <div className="mt-3 space-y-2">
                {linked.map((demand) => (
                  <p key={demand.id} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 需求单 {demand.id}（{departmentLabel([demand.departmentId], departmentNames)}）
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">采购物资明细</h3>
            </div>
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="px-4 py-3">序号</th>
                  <th className="px-4 py-3">物资名称</th>
                  <th className="px-4 py-3">数量</th>
                  <th className="px-4 py-3">单位</th>
                  <th className="px-4 py-3 text-right">预算小计</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineItems.map((item, itemIndex) => (
                  <tr key={`${item.demand.id}-${item.materialId}-${itemIndex}`}>
                    <td className="px-4 py-4 font-mono font-black text-slate-400">{itemIndex + 1}</td>
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-950">{materialNames[item.materialId ?? '']?.name ?? item.materialId}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{item.materialId}</p>
                    </td>
                    <td className="px-4 py-4 font-mono font-black text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-4 text-slate-500">{materialNames[item.materialId ?? '']?.unit ?? '项'}</td>
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900">{currency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg bg-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600"><Bot size={20} /></span>
              <div>
                <p className="text-lg font-black">方案合规检查</p>
                <p className="font-mono text-xs font-black uppercase text-slate-400">基于方案实际数据核对</p>
              </div>
            </div>
            <div className="mt-5 space-y-2">
              {complianceChecks.map((check) => (
                <div
                  key={check.text}
                  className={cn(
                    'flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold',
                    check.ok ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300',
                  )}
                >
                  <span className="mt-0.5 shrink-0">{check.ok ? '✓' : '✗'}</span>
                  <span className="leading-5">{check.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">审批流转</h3>
            </div>
            <div className="space-y-5 border-l border-slate-100 pl-5">
              {[
                {
                  label: '需求整合',
                  desc: `已整合 ${linked.length} 条已通过需求`,
                  done: linked.length > 0,
                  active: false,
                },
                {
                  label: '报价征集',
                  desc: plan.status === '报价中'
                    ? `截止 ${plan.deadlineAt?.slice(0, 10) ?? '--'} · ${plan.quotes?.length ?? 0} 家已报价`
                    : `已收 ${plan.quotes?.length ?? 0} 家报价`,
                  done: plan.status !== '报价中',
                  active: plan.status === '报价中',
                },
                {
                  label: '定标审批',
                  desc: awardApproval
                    ? `${awardApproval.status ?? '待审批'} · 提交人 ${awardApproval.submittedByName ?? '--'}${awardApproval.actedAt ? ` · ${awardApproval.actedAt.slice(0, 10)}` : ''}${awardApproval.reviewComment ? ` · ${awardApproval.reviewComment}` : ''}`
                    : plan.status === '已定标'
                      ? '定标已生效'
                      : '尚未发起定标审批',
                  done: plan.status === '已定标' || awardApproval?.status === '已通过',
                  active: plan.status === '定标审批中' || awardApproval?.status === '待审批',
                },
              ].map((node) => (
                <div key={node.label} className="relative">
                  <i className={cn('absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full', node.done ? 'bg-emerald-500' : node.active ? 'bg-blue-600' : 'bg-slate-300')} />
                  <p className="text-sm font-black text-slate-950">{node.label}</p>
                  <p className="mt-1 break-words text-xs font-bold text-slate-500">{node.desc}</p>
                  {node.active && <span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">当前节点</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-950">邀请供应商</h3>
            <div className="mt-4 space-y-2">
              {(plan.invitedSupplierIds ?? []).map((id) => (
                <div key={id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  {supplierNames[id] ?? id}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProcurementPlansPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const rfqs = useRfqList();
  const demandsQuery = usePurchaseDemandList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const materialsQuery = useMaterialList();
  const ordersQuery = usePurchaseOrderList();
  const departmentsQuery = useDepartmentList();
  const pendingApprovals = useApprovalInboxPending();
  const recentApprovals = useApprovalInboxRecent();
  const createRfq = useRfqCreate();
  const [selected, setSelected] = useState<RfqResponse | null>(null);
  const [creating, setCreating] = useState(false);
  // 立项方式:merge=基于需求合并(显式勾选);direct=采购部门直录(反登「直录登记」需求保闭环)。
  const [createMode, setCreateMode] = useState<'pick' | 'merge' | 'direct'>('pick');
  const [selectedDemandIds, setSelectedDemandIds] = useState<string[]>([]);
  const [directRows, setDirectRows] = useState<Array<{ materialId: string; quantity: number }>>([]);
  const [directDepartmentId, setDirectDepartmentId] = useState('');
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planPlace, setPlanPlace] = useState('上海市浦东新区张江园区');
  const [planMethod, setPlanMethod] = useState('询比');
  const [collectionMethod, setCollectionMethod] = useState('公开');
  const [planUrgency, setPlanUrgency] = useState('普通');
  const [approvalRequired, setApprovalRequired] = useState('否');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);

  const demands = demandsQuery.data?.data ?? [];
  const orders = ordersQuery.data?.data ?? [];
  const departmentNames = useMemo(() => {
    const map: Record<string, string> = {};
    (departmentsQuery.data?.data ?? []).forEach((dept) => {
      if (dept.id) map[dept.id] = dept.name ?? dept.id;
    });
    return map;
  }, [departmentsQuery.data]);
  // 定标审批任务:待办 + 近期已办中匹配本方案(bizType=rfq_award, bizId=RFQ id)。
  const awardApprovals = useMemo(
    () =>
      [...(pendingApprovals.data?.data ?? []), ...(recentApprovals.data?.data ?? [])].filter(
        (task) => task.bizType === 'rfq_award',
      ),
    [pendingApprovals.data, recentApprovals.data],
  );
  // 可合并池:已通过且未关联计划的需求;实际合并范围由用户显式勾选。
  const mergeCandidates = demands.filter(
    (demand) => demand.status === '已通过' && demand.id && !demand.linkedRfqId,
  );
  const mergeDemands = mergeCandidates.filter((demand) => selectedDemandIds.includes(demand.id!));
  const selectedBudget = mergeDemands.reduce((sum, demand) => sum + (demand.budget ?? 0), 0);
  const selectedDepartments = Array.from(
    new Set(mergeDemands.map((demand) => demand.departmentId).filter((id): id is string => !!id)),
  );
  const selectedContent = mergeDemands.map((demand) => demand.title).filter(Boolean).join('、');
  const materialRefIndex = useMemo(() => {
    const map: Record<string, number> = {};
    (materialsQuery.data?.data ?? []).forEach((m) => {
      if (m.id) map[m.id] = m.referencePrice ?? 0;
    });
    return map;
  }, [materialsQuery.data?.data]);
  const directBudget = directRows.reduce(
    (sum, row) => sum + (materialRefIndex[row.materialId] ?? 0) * row.quantity,
    0,
  );
  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersQuery.data?.data ?? []).forEach((supplier) => {
      if (supplier.supplierId) map[supplier.supplierId] = supplier.supplierName ?? supplier.supplierId;
    });
    return map;
  }, [suppliersQuery.data?.data]);
  const materialNames = useMemo(() => {
    const map: Record<string, { name: string; unit: string }> = {};
    (materialsQuery.data?.data ?? []).forEach((material) => {
      if (material.id) map[material.id] = { name: material.name ?? material.id, unit: material.unit ?? '项' };
    });
    return map;
  }, [materialsQuery.data?.data]);

  const plans = (rfqs.data?.data ?? []).filter((rfq) => (rfq.demandIds?.length ?? 0) > 0);

  const toggleSupplier = (id?: string) => {
    if (!id) return;
    setSupplierIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const resetCreateForm = () => {
    setCreateMode('pick');
    setSelectedDemandIds([]);
    setDirectRows([]);
    setDirectDepartmentId('');
    setPlanTitle('');
    setPlanDate('');
    setPlanPlace('上海市浦东新区张江园区');
    setPlanMethod('询比');
    setCollectionMethod('公开');
    setPlanUrgency('普通');
    setApprovalRequired('否');
    setSupplierIds([]);
  };

  const supplierCollectionLabel =
    planMethod === '商城' ? '目录采购' : planMethod === '单一来源' ? '定向' : collectionMethod;

  const submitProcurementPlan = () => {
    const isDirect = createMode === 'direct';
    const demandIds = isDirect
      ? []
      : mergeDemands.map((demand) => demand.id).filter((id): id is string => !!id);
    if (!isDirect && demandIds.length === 0) return;
    if (isDirect && (directRows.length === 0 || !directDepartmentId)) return;
    createRfq.mutate(
      {
        data: {
          title: planTitle || (isDirect ? '直录采购方案' : `采购方案-${mergeDemands[0]?.title ?? '合并需求'}`),
          demandIds,
          ...(isDirect
            ? {
                directItems: directRows.filter((row) => row.materialId && row.quantity > 0),
                directDepartmentId,
                directBudget,
              }
            : {}),
          invitedSupplierIds: supplierIds,
          deadlineAt: planDate ? `${planDate}T18:00:00+08:00` : undefined,
          method: planMethod,
          evaluationMethod: planMethod === '竞价' ? '最低价' : '综合评分',
          quoteRequirement: createMode === 'direct'
            ? `采购内容：直录明细 ${directRows.length} 项；预算合计(参考价测算)：${currency(directBudget)}。`
            : `采购内容：${selectedContent || '合并采购需求'}；预算合计：${currency(selectedBudget)}。`,
          deliveryRequirement: `采购时间：${planDate || '待定'}；采购地点：${planPlace || '待定'}；采购方式：${planMethod}；供应商征集方式：${supplierCollectionLabel}。`,
        },
      },
      {
        onSuccess: () => {
          resetCreateForm();
          setCreating(false);
          rfqs.refetch();
          demandsQuery.refetch();
        },
      },
    );
  };

  if (rfqs.isLoading || demandsQuery.isLoading) {
    return (
      <Panel title="采购计划" icon={ClipboardCheck} subtitle="需求合并 · 方案审批 · 执行监控">
        <FeedbackNotice tone="info" message="正在加载采购计划…" />
      </Panel>
    );
  }

  if (selected) {
    const fresh = plans.find((plan) => plan.id === selected.id) ?? selected;
    return (
      <PlanDetail
        plan={fresh}
        index={plans.findIndex((plan) => plan.id === fresh.id)}
        demands={demands}
        order={orders.find((o) => o.rfqId === fresh.id)}
        awardApproval={awardApprovals.find((task) => task.bizId === fresh.id)}
        supplierNames={supplierNames}
        materialNames={materialNames}
        departmentNames={departmentNames}
        onBack={() => setSelected(null)}
        onNavigate={onNavigate}
      />
    );
  }

  if (creating && createMode === 'pick') {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <section className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => { resetCreateForm(); setCreating(false); }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回列表"
            >
              ←
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-950">新建采购计划</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">选择立项方式:基于部门申报的需求合并,或采购部门直接创建</p>
            </div>
          </div>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-base font-black text-slate-950">基于需求合并立项</p>
            <p className="mt-1.5 text-xs font-bold leading-5 text-slate-500">
              勾选业务部门已申报且审批通过的需求,合并形成采购计划。可选 {mergeCandidates.length} 条(已通过且未关联计划)。
            </p>
            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {mergeCandidates.length === 0 ? (
                <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                  暂无可合并的需求。业务部门审批通过的需求会出现在这里;也可以使用右侧「直接创建」。
                </p>
              ) : (
                mergeCandidates.map((demand) => (
                  <label
                    key={demand.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5 hover:border-blue-200"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDemandIds.includes(demand.id!)}
                      onChange={() =>
                        setSelectedDemandIds((current) =>
                          current.includes(demand.id!)
                            ? current.filter((id) => id !== demand.id)
                            : [...current, demand.id!],
                        )
                      }
                      className="h-4 w-4 accent-blue-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-slate-900">{demand.title}</span>
                      <span className="mt-0.5 block text-xs font-bold text-slate-400">
                        {demand.id} · {departmentNames[demand.departmentId ?? ''] ?? demand.departmentId} · {currency(demand.budget ?? 0)}
                        {demand.source === '直录登记' ? ' · 直录登记' : ''}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <button
              type="button"
              disabled={selectedDemandIds.length === 0}
              onClick={() => setCreateMode('merge')}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-300"
            >
              合并 {selectedDemandIds.length} 条需求,进入方案编辑
            </button>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <p className="flex items-center gap-2 text-base font-black text-slate-950">
              直接创建(直录)
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">采购部门专用场景</span>
            </p>
            <p className="mt-1.5 text-xs font-bold leading-5 text-slate-500">
              不基于既有需求,直接录入采购内容。提交时系统自动登记一条来源为「直录登记」的需求并挂链,
              需求回链、品类支出与预算口径保持完整闭环,全程审计留痕。
            </p>
            <ul className="mt-4 space-y-1.5 text-xs font-bold text-slate-500">
              <li>· 采购内容:物料 + 数量,预算按物料参考价自动测算</li>
              <li>· 须选择归口部门,便于统计与追溯</li>
              <li>· 列表与详情将标注「直接创建」来源徽标</li>
            </ul>
            <button
              type="button"
              onClick={() => { setDirectRows([{ materialId: '', quantity: 1 }]); setCreateMode('direct'); }}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-white text-sm font-black text-slate-900 transition hover:bg-slate-50"
            >
              直接创建,进入方案编辑
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (creating) {
    return (
      <ProcurementPlanMergePage
        selectedDemands={mergeDemands}
        selectedBudget={selectedBudget}
        selectedDepartments={selectedDepartments}
        selectedContent={selectedContent}
        planTitle={planTitle}
        setPlanTitle={setPlanTitle}
        planDate={planDate}
        setPlanDate={setPlanDate}
        planPlace={planPlace}
        setPlanPlace={setPlanPlace}
        planMethod={planMethod}
        setPlanMethod={setPlanMethod}
        collectionMethod={collectionMethod}
        setCollectionMethod={setCollectionMethod}
        planUrgency={planUrgency}
        setPlanUrgency={setPlanUrgency}
        approvalRequired={approvalRequired}
        setApprovalRequired={setApprovalRequired}
        suppliers={suppliersQuery.data?.data ?? []}
        supplierIds={supplierIds}
        setSupplierIds={setSupplierIds}
        toggleSupplier={toggleSupplier}
        createError={createRfq.isError}
        createPending={createRfq.isPending}
        onBack={() => setCreateMode('pick')}
        onSubmit={submitProcurementPlan}
        {...(createMode === 'direct'
          ? {
              directRows,
              setDirectRows,
              directDepartmentId,
              setDirectDepartmentId,
              departments: departmentsQuery.data?.data ?? [],
            }
          : {})}
      />
    );
  }

  return (
    <PlanList
      plans={plans}
      demands={demands}
      orders={orders}
      departmentNames={departmentNames}
      onOpen={setSelected}
      onCreate={() => setCreating(true)}
    />
  );
}
