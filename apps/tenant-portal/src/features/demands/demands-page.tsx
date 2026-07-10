import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, CheckSquare, ClipboardList, Layers3, Plus, Search, Sparkles, Users, X } from 'lucide-react';
import {
  useMaterialList,
  type BuyerSupplierResponse,
  type PurchaseDemandResponse,
  useBuyerSupplierList,
  usePurchaseDemandList,
  usePurchaseDemandSubmit,
  useRfqCreate,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';
import { DemandCreateForm } from './demand-create-form';
import { DemandDetail } from './demand-detail';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const STATUS_FILTERS = ['全部', '草稿', '审批中', '已通过', '已驳回'] as const;
const PROCUREMENT_METHODS = ['询比', '竞价', '商城', '单一来源'];
const SUPPLIER_COLLECTION_METHODS = ['公开', '邀请'];

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const departmentMap: Record<string, string> = {
  'dept-it': '信息化部',
  'dept-admin': '行政部',
  'dept-finance': '财务部',
  'dept-purchase': '采购部',
  'dept-hq': '集团总部',
};

function departmentLabel(id?: string) {
  return id ? departmentMap[id] ?? id : '—';
}

export function DemandsPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<PurchaseDemandResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planPlace, setPlanPlace] = useState('上海市浦东新区张江园区');
  const [planMethod, setPlanMethod] = useState('询比');
  const [collectionMethod, setCollectionMethod] = useState('公开');
  const [planUrgency, setPlanUrgency] = useState('普通');
  const [approvalRequired, setApprovalRequired] = useState('否');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);

  const query = usePurchaseDemandList(status === '全部' ? undefined : { status });
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const submit = usePurchaseDemandSubmit();
  const createRfq = useRfqCreate();
  const demands = query.data?.data ?? [];
  const suppliers = suppliersQuery.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const filtered = demands.filter(
    (d) =>
      !kw || [d.title, d.id, d.departmentId].filter(Boolean).join(' ').toLowerCase().includes(kw),
  );
  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedDemands = demands.filter((d) => d.id && selectedIds.includes(d.id));
  const selectablePageItems = pageItems.filter((d) => d.status === '已通过' && d.id);
  const selectedBudget = selectedDemands.reduce((sum, d) => sum + (d.budget ?? 0), 0);
  const selectedDepartments = Array.from(
    new Set(selectedDemands.map((d) => d.departmentId).filter((id): id is string => !!id)),
  );
  const selectedContent = selectedDemands.map((d) => d.title).filter(Boolean).join('、');

  if (selected) {
    const fresh = demands.find((d) => d.id === selected.id) ?? selected;
    return <DemandDetail demand={fresh} onBack={() => setSelected(null)} />;
  }

  const refreshDemands = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(demands|rfqs)/.test(q.queryKey[0] as string),
    });

  const handleSubmitForApproval = (demandId: string) => {
    submit.mutate({ demandId }, { onSuccess: () => refreshDemands() });
  };

  const toggleDemand = (id?: string) => {
    if (!id) return;
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const togglePageSelection = () => {
    const pageIds = selectablePageItems.map((d) => d.id!).filter(Boolean);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedIds((cur) =>
      allSelected ? cur.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...cur, ...pageIds])),
    );
  };

  const toggleSupplier = (id?: string) => {
    if (!id) return;
    setSupplierIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const supplierCollectionLabel =
    planMethod === '商城' ? '目录采购' : planMethod === '单一来源' ? '定向' : collectionMethod;

  const submitProcurementPlan = () => {
    if (selectedIds.length === 0) return;
    createRfq.mutate(
      {
        data: {
          title: planTitle || `采购方案-${selectedDemands[0]?.title ?? '合并需求'}`,
          demandIds: selectedIds,
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
          setSelectedIds([]);
          setSupplierIds([]);
          setPlanTitle('');
          setPlanDate('');
          setPlanPlace('上海市浦东新区张江园区');
          setPlanMethod('询比');
          setCollectionMethod('公开');
          setPlanUrgency('普通');
          setApprovalRequired('否');
          setShowPlanForm(false);
          refreshDemands();
          onNavigate?.('procurement-plans');
        },
      },
    );
  };

  if (showForm) {
    return (
      <DemandCreateForm
        onBack={() => setShowForm(false)}
        onCreated={() => {
          setShowForm(false);
          refreshDemands();
        }}
      />
    );
  }

  if (showPlanForm && selectedIds.length > 0) {
    return (
      <ProcurementPlanMergePage
        selectedDemands={selectedDemands}
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
        suppliers={suppliers}
        supplierIds={supplierIds}
        setSupplierIds={setSupplierIds}
        toggleSupplier={toggleSupplier}
        createError={createRfq.isError}
        createPending={createRfq.isPending}
        onBack={() => setShowPlanForm(false)}
        onSubmit={submitProcurementPlan}
      />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
    <Panel title="采购需求" icon={ClipboardList} subtitle="需求列表 · 审批提交 · 转采购计划">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
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
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按标题 / 编号 / 部门搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> 新建需求
        </button>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Layers3 size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-slate-950">
                  已选择 {selectedIds.length} 条采购需求，可合并生成采购计划
                </p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  预算合计 {currency(selectedBudget)} · 涉及部门 {selectedDepartments.join('、') || '—'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowPlanForm((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800"
              >
                <CheckSquare size={14} /> {showPlanForm ? '收起方案' : '合并采购计划'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  setShowPlanForm(false);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                <X size={14} /> 清空
              </button>
            </div>
          </div>

          {showPlanForm && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-sm font-black text-slate-950">采购计划 / 采购方案</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-black text-slate-500">采购方案名称</label>
                  <input
                    className={inputCls}
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder="如：信息化部办公终端集中采购方案"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500">采购时间 / 报价截止</label>
                  <input className={inputCls} type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500">采购地点</label>
                  <input className={inputCls} value={planPlace} onChange={(e) => setPlanPlace(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500">采购方式</label>
                  <select className={inputCls} value={planMethod} onChange={(e) => setPlanMethod(e.target.value)}>
                    {PROCUREMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">采购内容</p>
                  <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{selectedContent || '—'}</p>
                  <p className="mt-2 text-xs font-black text-slate-500">预算合计：{currency(selectedBudget)}</p>
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500">参与供应商</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {suppliers.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSupplier(s.supplierId)}
                        className={cn(
                          'h-8 rounded-md border px-3 text-xs font-black transition',
                          s.supplierId && supplierIds.includes(s.supplierId)
                            ? 'border-blue-300 bg-blue-100 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                        )}
                      >
                        {s.supplierName ?? s.supplierId}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] font-bold text-slate-400">
                    询比、竞价建议不少于 3 家；单一来源选择 1 家；商城采购不强制选择供应商。
                  </p>
                </div>
              </div>
              {createRfq.isError && (
                <FeedbackNotice tone="error" message="采购计划创建失败：请确认所选需求均为已通过且未被其他采购计划关联，供应商数量符合采购方式要求。" />
              )}
              <div className="mt-4 flex justify-end">
                <PrimaryActionButton
                  onClick={submitProcurementPlan}
                  busy={createRfq.isPending}
                  pendingLabel="生成中"
                  disabled={selectedIds.length === 0 || supplierIds.length === 0 || !planDate}
                >
                  生成采购计划
                </PrimaryActionButton>
              </div>
            </div>
          )}
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载需求列表…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无采购需求。" />
      ) : (
        <>
        <ResponsiveTableFrame
          mobileCards={pageItems.map((d) => (
            <div
              key={d.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={!!d.id && selectedIds.includes(d.id)}
                    disabled={d.status !== '已通过'}
                    onChange={() => toggleDemand(d.id)}
                    aria-label={`选择需求 ${d.id}`}
                  />
                  <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{d.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{d.id}</p>
                  </div>
                </div>
                {d.status && <StatusPill label={d.status} />}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="申请部门" value={d.departmentId ?? '—'} />
                <MiniFact label="预算金额" value={currency(d.budget)} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(d)}
                className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                查看详情
              </button>
              {d.status === '草稿' && d.id && (
                <PrimaryActionButton
                  onClick={() => handleSubmitForApproval(d.id!)}
                  busy={submit.isPending && submit.variables?.demandId === d.id}
                  pendingLabel="提交中"
                  fullWidth
                >
                  提交审批
                </PrimaryActionButton>
              )}
            </div>
          ))}
        >
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="w-10 px-3 py-4 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                    checked={selectablePageItems.length > 0 && selectablePageItems.every((d) => d.id && selectedIds.includes(d.id))}
                    onChange={togglePageSelection}
                    aria-label="选择当前页已通过需求"
                  />
                </th>
                <th className="w-12 px-2 py-4 text-center">序号</th>
                <th className="px-5 py-4">需求编号</th>
                <th className="px-5 py-4">需求标题</th>
                <th className="px-5 py-4">申请部门</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4 text-right">预算金额</th>
                <th className="px-5 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageItems.map((d, i) => (
                <tr key={d.id} className="hover:bg-blue-50/30">
                  <td className="px-3 py-5 text-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      checked={!!d.id && selectedIds.includes(d.id)}
                      disabled={d.status !== '已通过'}
                      onChange={() => toggleDemand(d.id)}
                      aria-label={`选择需求 ${d.id}`}
                    />
                  </td>
                  <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{d.id}</td>
                  <td className="px-5 py-5">
                    <p className="font-black text-slate-950">{d.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {d.expectedDeliveryDate ? `期望交期 ${d.expectedDeliveryDate}` : d.priority ? `优先级 ${d.priority}` : '待补充交付信息'}
                    </p>
                  </td>
                  <td className="px-5 py-5 text-sm font-bold text-slate-600">{departmentLabel(d.departmentId)}</td>
                  <td className="px-5 py-5">{d.status && <StatusPill label={d.status} />}</td>
                  <td className="px-5 py-5 text-right font-mono font-black text-slate-900">
                    {currency(d.budget)}
                  </td>
                  <td className="px-5 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {d.status === '草稿' && d.id && (
                        <button
                          type="button"
                          onClick={() => handleSubmitForApproval(d.id!)}
                          disabled={submit.isPending && submit.variables?.demandId === d.id}
                          className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                        >
                          {submit.isPending && submit.variables?.demandId === d.id ? '提交中' : '提交审批'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(d)}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        详情
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
    </div>
  );
}

export function ProcurementPlanMergePage({
  selectedDemands,
  selectedBudget,
  selectedDepartments,
  selectedContent,
  planTitle,
  setPlanTitle,
  planDate,
  setPlanDate,
  planPlace,
  setPlanPlace,
  planMethod,
  setPlanMethod,
  collectionMethod,
  setCollectionMethod,
  planUrgency,
  setPlanUrgency,
  approvalRequired,
  setApprovalRequired,
  suppliers,
  supplierIds,
  setSupplierIds,
  toggleSupplier,
  createError,
  createPending,
  onBack,
  onSubmit,
}: {
  selectedDemands: PurchaseDemandResponse[];
  selectedBudget: number;
  selectedDepartments: string[];
  selectedContent: string;
  planTitle: string;
  setPlanTitle: (value: string) => void;
  planDate: string;
  setPlanDate: (value: string) => void;
  planPlace: string;
  setPlanPlace: (value: string) => void;
  planMethod: string;
  setPlanMethod: (value: string) => void;
  collectionMethod: string;
  setCollectionMethod: (value: string) => void;
  planUrgency: string;
  setPlanUrgency: (value: string) => void;
  approvalRequired: string;
  setApprovalRequired: (value: string) => void;
  suppliers: BuyerSupplierResponse[];
  supplierIds: string[];
  setSupplierIds: (value: string[]) => void;
  toggleSupplier: (id?: string) => void;
  createError: boolean;
  createPending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const materialsForRef = useMaterialList();
  const materialIndex = useMemo(() => {
    const map: Record<string, { referencePrice: number; category: string; name: string }> = {};
    (materialsForRef.data?.data ?? []).forEach((m) => {
      if (m.id) map[m.id] = { referencePrice: m.referencePrice ?? 0, category: m.category ?? '其他', name: m.name ?? m.id };
    });
    return map;
  }, [materialsForRef.data]);
  // 市场参考价:所选需求行项 × 物料参考价(真实数据,替代此前"预算×0.96"的假测算)。
  const marketReference = selectedDemands.reduce(
    (sum, demand) =>
      sum +
      (demand.lineItems ?? []).reduce(
        (lineSum, line) =>
          lineSum + (materialIndex[line.materialId ?? '']?.referencePrice ?? 0) * (line.quantity ?? 0),
        0,
      ),
    0,
  );
  const budgetDeviation = marketReference > 0 ? (selectedBudget - marketReference) / marketReference : null;
  const demandCategories = Array.from(
    new Set(
      selectedDemands.flatMap((demand) =>
        (demand.lineItems ?? []).map((line) => materialIndex[line.materialId ?? '']?.category).filter(Boolean),
      ),
    ),
  ) as string[];
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [recommendNote, setRecommendNote] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierKeyword, setSupplierKeyword] = useState('');
  const mergedRows = selectedDemands.flatMap((d) =>
    (d.lineItems?.length ? d.lineItems : [{ materialId: d.title, quantity: 1 }]).map((line) => ({
      demandId: d.id,
      demandTitle: d.title,
      materialName: line.materialId || d.title || '示例物资',
      spec: d.departmentId || '常规规格',
      quantity: line.quantity ?? 1,
      unit: '个',
      budgetUnit: Math.round((d.budget ?? 0) / Math.max(line.quantity ?? 1, 1)),
      subtotal: d.budget ?? 0,
    })),
  );
  const isSingleSource = planMethod === '单一来源';
  const isOpenSolicitation = planMethod !== '商城' && planMethod !== '单一来源' && collectionMethod === '公开';
  const supplierSelectionRequired = planMethod === '单一来源' || (planMethod !== '商城' && collectionMethod === '邀请');
  const selectedSuppliers = suppliers.filter((supplier) => supplier.supplierId && supplierIds.includes(supplier.supplierId));
  const supplierKw = supplierKeyword.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter((supplier) => {
    const text = [supplier.supplierName, supplier.supplierId].filter(Boolean).join(' ').toLowerCase();
    return !supplierKw || text.includes(supplierKw);
  });
  const supplierRequirementMet = !supplierSelectionRequired || (isSingleSource ? supplierIds.length === 1 : supplierIds.length >= 3);
  const canSubmit = selectedDemands.length > 0 && supplierRequirementMet && !!planDate;

  const handlePlanMethodChange = (value: string) => {
    setPlanMethod(value);
    setSupplierKeyword('');
    if (value === '商城') {
      setSupplierIds([]);
      setSupplierDialogOpen(false);
    } else if (value === '单一来源' && supplierIds.length > 1) {
      setSupplierIds(supplierIds.slice(0, 1));
    }
  };

  const handleCollectionMethodChange = (value: string) => {
    setCollectionMethod(value);
    if (value === '公开') {
      setSupplierIds([]);
      setSupplierDialogOpen(false);
    }
  };

  const selectSupplier = (supplierId?: string) => {
    if (!supplierId) return;
    if (isSingleSource) {
      setSupplierIds([supplierId]);
      return;
    }
    toggleSupplier(supplierId);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="返回采购需求"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-950">新建采购方案</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              填写方案基本信息与执行策略 · 已合并 {selectedDemands.length} 条需求 · 涉及部门 {selectedDepartments.join('、') || '—'}
            </p>
          </div>
        </div>
      </section>

      <MergeSection accent="blue" title="基本信息">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_22rem]">
          <Field label="项目名称" required>
            <input
              className={inputCls}
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="请输入项目名称"
            />
          </Field>
          <Field label="紧急程度" required>
            <select className={inputCls} value={planUrgency} onChange={(e) => setPlanUrgency(e.target.value)}>
              {['普通', '紧急', '特急'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="是否需要审批" required>
            <div className="flex gap-3">
              {['是', '否'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setApprovalRequired(item)}
                  className={cn(
                    'inline-flex h-10 min-w-20 items-center justify-center rounded-lg border px-4 text-sm font-black',
                    approvalRequired === item
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600',
                  )}
                >
                  <span
                    className={cn(
                      'mr-2 h-4 w-4 rounded-full border',
                      approvalRequired === item ? 'border-blue-600 bg-blue-600 shadow-[inset_0_0_0_4px_white]' : 'border-slate-300',
                    )}
                  />
                  {item}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </MergeSection>

      <MergeSection accent="emerald" title="申请信息">
        <div className="grid gap-6 lg:grid-cols-2">
          <Field label="采购预算（元）">
            <input className={inputCls} value={selectedBudget} readOnly />
          </Field>
          <Field label="项目概况介绍">
            <textarea
              className={`${inputCls} min-h-24 resize-none`}
              value={selectedContent || '由多个已审批采购需求合并生成，统一形成采购方案并进入寻源执行。'}
              readOnly
            />
          </Field>
          <Field label="采购方式与供应商征集方式">
            <div className="grid gap-3 sm:grid-cols-2">
              <select className={inputCls} value={planMethod} onChange={(e) => handlePlanMethodChange(e.target.value)}>
                {PROCUREMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {planMethod === '询比' || planMethod === '竞价' ? (
                <select className={inputCls} value={collectionMethod} onChange={(e) => handleCollectionMethodChange(e.target.value)}>
                  {SUPPLIER_COLLECTION_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">
                  {planMethod === '商城' ? '目录采购，不限定供应商征集' : '单一来源，定向选择 1 家供应商'}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {planMethod === '商城'
                ? '商城采购按商品目录和供应商货架执行。'
                : planMethod === '单一来源'
                  ? '单一来源属于定向采购，需要选择 1 家供应商并保留审批依据。'
                  : collectionMethod === '公开'
                    ? `${planMethod}采用公开征集，不预先限定具体供应商。`
                    : `${planMethod}采用邀请征集，需要从供应商库选择不少于 3 家供应商。`}
            </p>
            <button
              type="button"
              onClick={() => setShowSuggestion((v) => !v)}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-50 px-3 text-xs font-black text-violet-600 hover:bg-violet-100"
            >
              <Sparkles size={14} /> {showSuggestion ? '收起方案建议' : '方案建议(基于所选需求)'}
            </button>
            {showSuggestion && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs font-bold text-violet-800">
                <p>
                  · 预算规模 {currency(selectedBudget)}:
                  {selectedBudget >= 500000
                    ? '金额较大,建议采用竞价引入价格竞争,或询比+多轮 BAFO。'
                    : selectedBudget < 50000 && demandCategories.length <= 1
                      ? '金额较小且品类单一,若有协议价商品可走商城直购降低流程成本。'
                      : '建议采用询比,兼顾效率与竞争。'}
                </p>
                <p>
                  · 品类分布:{demandCategories.length > 0 ? demandCategories.join('、') : '所选需求行项未关联物料品类'}
                  {demandCategories.length > 1 && ';品类跨度较大,可考虑拆分方案分别征集。'}
                </p>
                <p>
                  · 已准入供应商 {suppliers.length} 家可选
                  {planMethod !== '商城' && planMethod !== '单一来源' && suppliers.length < 3 && ';不足 3 家,邀请征集无法满足法定家数,建议公开征集或先补充准入。'}
                </p>
              </div>
            )}
            {isOpenSolicitation && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                当前为公开征集，提交方案时不需要选择具体供应商，后续由符合条件的供应商参与响应。
              </div>
            )}
            {supplierSelectionRequired && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">参与供应商</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {isSingleSource ? '单一来源需定向选择 1 家供应商，并支持条件检索。' : `${planMethod}需选择不少于 3 家供应商，并支持条件检索。`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupplierDialogOpen(true)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-xs font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    <Users size={14} />
                    选择供应商
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSuppliers.length > 0 ? (
                    selectedSuppliers.map((supplier) => (
                      <span
                        key={supplier.supplierId}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700"
                      >
                        {supplier.supplierName ?? supplier.supplierId}
                        <button
                          type="button"
                          onClick={() => toggleSupplier(supplier.supplierId)}
                          className="text-blue-400 hover:text-blue-700"
                          aria-label="移除供应商"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-amber-600">尚未选择供应商，提交前需要完成选择。</span>
                  )}
                </div>
              </div>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="采购时间 / 报价截止">
              <input className={inputCls} type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </Field>
            <Field label="采购地点">
              <input className={inputCls} value={planPlace} onChange={(e) => setPlanPlace(e.target.value)} />
            </Field>
          </div>
        </div>
      </MergeSection>

      <MergeSection accent="violet" title="采购内容明细">
        <p className="mb-3 text-xs font-bold text-slate-500">
          合并创建采购计划时，采购内容由已选采购需求自动汇总，提交前不允许再增删或替换物料。
        </p>
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">序号</th>
                <th className="px-4 py-3">物资名称</th>
                <th className="px-4 py-3">规格型号</th>
                <th className="px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">预算单价</th>
                <th className="px-4 py-3 text-right text-blue-600">市场参考价</th>
                <th className="px-4 py-3 text-right">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {mergedRows.map((row, index) => (
                <tr key={`${row.demandId}-${index}`} className="font-bold text-slate-700">
                  <td className="px-4 py-4 font-mono text-slate-400">{index + 1}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{row.materialName}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.demandTitle}</p>
                  </td>
                  <td className="px-4 py-4">{row.spec}</td>
                  <td className="px-4 py-4 text-right font-mono">{row.quantity}</td>
                  <td className="px-4 py-4">{row.unit}</td>
                  <td className="px-4 py-4 text-right font-mono">{currency(row.budgetUnit)}</td>
                  <td className="px-4 py-4 text-right font-mono text-slate-400">{currency(Math.round(row.budgetUnit * 0.96))}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-950">{currency(row.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={6} />
                <td className="px-4 py-4 text-right text-xs font-black text-slate-500">合计预算</td>
                <td className="px-4 py-4 text-right text-xl font-black text-violet-600">{currency(selectedBudget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                <Calculator size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-blue-900">预算合理性核对(基于物料参考价)</p>
                <p className="mt-1 text-xs font-bold text-blue-700">
                  {marketReference > 0 ? (
                    <>
                      方案总预算 {currency(selectedBudget)},物料参考价合计 {currency(marketReference)}
                      (偏差 {budgetDeviation != null ? `${(budgetDeviation * 100).toFixed(1)}%` : '—'})。
                      {budgetDeviation != null && Math.abs(budgetDeviation) <= 0.15 ? (
                        <span className="text-emerald-600"> 预算与参考价偏差在 15% 以内,合理。</span>
                      ) : (
                        <span className="text-red-600"> 预算与参考价偏差超过 15%,建议复核数量与单价或在方案说明中补充原因。</span>
                      )}
                    </>
                  ) : (
                    <>方案总预算 {currency(selectedBudget)};所选需求行项暂无物料参考价,无法核对,请在物料目录维护参考价。</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {createError && (
          <div className="mt-4">
            <FeedbackNotice tone="error" message="采购计划创建失败：请确认所选需求均为已通过且未被其他采购计划关联，供应商数量符合采购方式要求。" />
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 hover:bg-slate-50"
          >
            返回选择
          </button>
          <PrimaryActionButton
            onClick={onSubmit}
            busy={createPending}
            pendingLabel="生成中"
            disabled={!canSubmit}
          >
            生成采购计划
          </PrimaryActionButton>
        </div>
      </MergeSection>

      {supplierDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  选择参与供应商
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {isSingleSource ? '单选供应商;可按品类匹配与绩效评分推荐候选。' : '多选供应商,至少 3 家;可按品类匹配与绩效评分推荐候选。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={supplierKeyword}
                    onChange={(e) => setSupplierKeyword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    placeholder="按供应商名称 / 编号搜索"
                    autoFocus
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // 推荐规则(真实数据):品类匹配优先,其次绩效评分;单一来源取 1 家,其余取前 3。
                    const ranked = [...suppliers].sort((a, b) => {
                      const matchA = (a.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
                      const matchB = (b.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
                      if (matchA !== matchB) return matchB - matchA;
                      return (b.performanceScore ?? 0) - (a.performanceScore ?? 0);
                    });
                    const picked = ranked.slice(0, isSingleSource ? 1 : 3);
                    setSupplierIds(picked.map((sup) => sup.supplierId!).filter(Boolean));
                    setRecommendNote(
                      picked.length === 0
                        ? '暂无已准入供应商可推荐。'
                        : `已按品类匹配与绩效评分选中:${picked
                            .map((sup) => {
                              const matched = (sup.categories ?? []).filter((c) => demandCategories.includes(c));
                              return `${sup.supplierName}(评分 ${sup.performanceScore ?? '—'}${matched.length ? ` · 品类 ${matched.join('/')}` : ''})`;
                            })
                            .join('、')}`,
                    );
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-4 text-xs font-black text-violet-700 hover:bg-violet-100"
                >
                  <Sparkles size={14} />
                  按评分推荐
                </button>
              </div>
              {recommendNote && (
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs font-bold text-violet-700">
                  {recommendNote}
                </div>
              )}
              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-100">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => {
                    const id = supplier.supplierId;
                    const checked = !!id && supplierIds.includes(id);
                    return (
                      <button
                        key={supplier.id ?? id}
                        type="button"
                        onClick={() => selectSupplier(id)}
                        className={cn(
                          'flex w-full items-center justify-between border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50',
                          checked && 'bg-blue-50/60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center border',
                              isSingleSource ? 'rounded-full' : 'rounded-md',
                              checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white',
                            )}
                          >
                            {checked && <CheckSquare size={13} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {supplier.supplierName ?? supplier.supplierId}
                            </span>
                            <span className="mt-1 block text-xs font-bold text-slate-400">{supplier.supplierId ?? '—'}</span>
                          </span>
                        </div>
                        <span className="ml-4 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                          已准入
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">没有匹配的供应商</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold text-slate-500">
                已选择 {supplierIds.length} 家，{isSingleSource ? '单一来源仅需 1 家。' : '询比/竞价至少需要 3 家。'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSupplierDialogOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierDialogOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-5 text-sm font-black text-white hover:bg-slate-800"
                >
                  确认选择
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MergeSection({
  accent,
  title,
  action,
  children,
}: {
  accent: 'blue' | 'emerald' | 'violet';
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const accentCls = {
    blue: 'before:bg-blue-600',
    emerald: 'before:bg-emerald-500',
    violet: 'before:bg-violet-500',
  }[accent];

  return (
    <section
      className={cn(
        'relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm before:absolute before:left-0 before:top-9 before:h-6 before:w-1 before:rounded-r-full',
        accentCls,
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-slate-500">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </span>
      {children}
    </label>
  );
}
