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
  type PurchaseDemandResponse,
  type RfqResponse,
  useBuyerSupplierList,
  useMaterialList,
  usePurchaseDemandList,
  useRfqCreate,
  useRfqList,
} from '@24bid/api-client';
import { FeedbackNotice, Panel, SearchInput, StatusPill, cn } from '@24bid/ui';
import { ProcurementPlanMergePage } from '../demands/demands-page';

const currency = (value?: number) =>
  value == null ? '--' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const stageByStatus: Record<string, string> = {
  报价中: '方案制定',
  已开标: '方案审批',
  已定标: '采购执行',
  已流标: '已结束',
  已废标: '已结束',
};

const stageSteps = ['需求整合', '方案制定', '方案审批', '采购执行', '验收归档'];

function planNo(plan: RfqResponse, index = 0) {
  const date = plan.createdAt?.slice(0, 10).replaceAll('-', '') ?? '20260707';
  return `PLAN-${date}-${String(index + 1).padStart(3, '0')}`;
}

function departmentLabel(ids: Array<string | undefined>) {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const map: Record<string, string> = {
    'dept-it': '信息化部',
    'dept-admin': '行政部',
    'dept-finance': '财务部',
    'dept-purchase': '采购部',
    'dept-hq': '集团总部',
  };
  return unique.map((id) => map[id!] ?? id).join('、') || '--';
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
  onOpen,
  onCreate,
}: {
  plans: RfqResponse[];
  demands: PurchaseDemandResponse[];
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
                    <p className="font-black text-slate-950">{plan.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{departmentLabel(linked.map((d) => d.departmentId))}</p>
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                      <i className="h-2 w-2 rounded-full bg-blue-600" /> {stageByStatus[plan.status ?? ''] ?? '方案制定'}
                    </span>
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
  supplierNames,
  materialNames,
  onBack,
}: {
  plan: RfqResponse;
  index: number;
  demands: PurchaseDemandResponse[];
  supplierNames: Record<string, string>;
  materialNames: Record<string, { name: string; unit: string }>;
  onBack: () => void;
}) {
  const linked = demands.filter((demand) => plan.demandIds?.includes(demand.id ?? ''));
  const budget = planBudget(linked);
  const currentStage = stageByStatus[plan.status ?? ''] ?? '方案制定';
  const currentIndex = Math.max(0, stageSteps.indexOf(currentStage));
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
                方案编号: {planNo(plan, index)} · 创建日期: {plan.createdAt?.slice(0, 10) ?? '--'} · 申请部门: {departmentLabel(linked.map((d) => d.departmentId))}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50" type="button">
              <FileText size={15} /> 查看原件
            </button>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700" type="button">
              <CheckCircle2 size={15} /> 审批通过
            </button>
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
            <div className="grid grid-cols-5 items-start gap-3">
              {stageSteps.map((step, stepIndex) => {
                const done = stepIndex < currentIndex;
                const current = stepIndex === currentIndex;
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
                    <p className="mt-1 text-[11px] font-bold text-slate-400">{done ? '已完成' : current ? '处理中' : '待开始'}</p>
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
              此阶段系统已自动收集并整合 {linked.length} 条采购需求。通过 AI 语义分析，识别相似物资与相近交期，
              建议合并采购以提升议价能力，预计可节约采购成本约 5%-8%。
            </p>
            <div className="mt-5 rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-500">整合需求来源</p>
              <div className="mt-3 space-y-2">
                {linked.map((demand) => (
                  <p key={demand.id} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-500" /> 需求单 {demand.id}（{departmentLabel([demand.departmentId])}）
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
                <p className="text-lg font-black">AI 风险雷达</p>
                <p className="font-mono text-xs font-black uppercase text-slate-400">Risk Scanner</p>
              </div>
            </div>
            <div className="mt-10 text-center text-sm font-bold text-slate-400">点击扫描方案中的潜在合规风险</div>
            <button className="mt-5 h-11 w-full rounded-lg bg-white text-sm font-black text-slate-950" type="button">
              开始 AI 扫描
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <ShieldCheck size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">审批流转</h3>
            </div>
            <div className="space-y-5 border-l border-slate-100 pl-5">
              {stageSteps.slice(0, 3).map((step, stepIndex) => (
                <div key={step} className="relative">
                  <i className={cn('absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full', stepIndex < currentIndex ? 'bg-emerald-500' : 'bg-blue-600')} />
                  <p className="text-sm font-black text-slate-950">{step}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{stepIndex < currentIndex ? '系统自动 · 已完成' : stepIndex === currentIndex ? '王总监 · 处理中' : '待处理'}</p>
                  {stepIndex === currentIndex && <span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">当前节点</span>}
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

export function ProcurementPlansPage() {
  const rfqs = useRfqList();
  const demandsQuery = usePurchaseDemandList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const materialsQuery = useMaterialList();
  const createRfq = useRfqCreate();
  const [selected, setSelected] = useState<RfqResponse | null>(null);
  const [creating, setCreating] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planPlace, setPlanPlace] = useState('上海市浦东新区张江园区');
  const [planMethod, setPlanMethod] = useState('询比');
  const [collectionMethod, setCollectionMethod] = useState('公开');
  const [planUrgency, setPlanUrgency] = useState('普通');
  const [approvalRequired, setApprovalRequired] = useState('否');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);

  const demands = demandsQuery.data?.data ?? [];
  const mergeDemands = demands.filter((demand) => demand.status === '已通过' && demand.id);
  const selectedBudget = mergeDemands.reduce((sum, demand) => sum + (demand.budget ?? 0), 0);
  const selectedDepartments = Array.from(
    new Set(mergeDemands.map((demand) => demand.departmentId).filter((id): id is string => !!id)),
  );
  const selectedContent = mergeDemands.map((demand) => demand.title).filter(Boolean).join('、');
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
    const demandIds = mergeDemands.map((demand) => demand.id).filter((id): id is string => !!id);
    if (demandIds.length === 0) return;
    createRfq.mutate(
      {
        data: {
          title: planTitle || `采购方案-${mergeDemands[0]?.title ?? '合并需求'}`,
          demandIds,
          invitedSupplierIds: supplierIds,
          deadlineAt: planDate ? `${planDate}T18:00:00+08:00` : undefined,
          method: planMethod,
          evaluationMethod: planMethod === '竞价' ? '最低价' : '综合评分',
          quoteRequirement: `采购内容：${selectedContent || '合并采购需求'}；预算合计：${currency(selectedBudget)}。`,
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
        supplierNames={supplierNames}
        materialNames={materialNames}
        onBack={() => setSelected(null)}
      />
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
        onBack={() => {
          resetCreateForm();
          setCreating(false);
        }}
        onSubmit={submitProcurementPlan}
      />
    );
  }

  return <PlanList plans={plans} demands={demands} onOpen={setSelected} onCreate={() => setCreating(true)} />;
}
