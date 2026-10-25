import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckSquare, ClipboardList, Layers3, Plus, X } from 'lucide-react';
import {
  type PurchaseDemandResponse,
  useBuyerSupplierList,
  useDemandPage,
  useDemandDetail,
  useRfqCreate,
  useWorkflowPurchaseDemandSubmit,
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
import { ProcurementPlanMergePage } from '../procurement-plans/procurement-plan-form';
import { currency, departmentLabel } from './demand-format';
import { DemandCreateForm } from './demand-create-form';
import { DemandDetail } from './demand-detail';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';

const STATUS_FILTERS = ['全部', '草稿', '审批中', '已通过', '已驳回', '已取消'] as const;
export function DemandsPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [submitDemand, setSubmitDemand] = useState<PurchaseDemandResponse | null>(null);
  const [selected, setSelected] = useState<PurchaseDemandResponse | null>(() => {
    const id = new URLSearchParams(window.location.search).get('recordId');
    return id ? { id } : null;
  });
  const [selectedRows, setSelectedRows] = useState<Record<string, PurchaseDemandResponse>>({});
  const selectedIds = Object.keys(selectedRows);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planTitle, setPlanTitle] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [planPlace, setPlanPlace] = useState('上海市浦东新区张江园区');
  const [planMethod, setPlanMethod] = useState('询比');
  const [collectionMethod, setCollectionMethod] = useState('公开');
  const [planUrgency, setPlanUrgency] = useState('普通');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);

  const PAGE_SIZE = 8;
  const query = useDemandPage({ page, pageSize: PAGE_SIZE,
    status: status === '全部' ? undefined : status, keyword: keyword || undefined }, !selected);
  const detailQuery = useDemandDetail(selected?.id);
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const submit = useWorkflowPurchaseDemandSubmit();
  const createRfq = useRfqCreate();
  const suppliers = suppliersQuery.data?.data ?? [];
  const total = query.data?.data.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = query.data?.data.items ?? [];
  const selectedDemands = Object.values(selectedRows);
  // 可合并 = 已通过且未被其他计划关联(与后端 requireUnlinkedDemand 规则一致)。
  const selectablePageItems = pageItems.filter((d) => d.status === '已通过' && d.id && !d.linkedRfqId);
  const selectedBudget = selectedDemands.reduce((sum, d) => sum + (d.budget ?? 0), 0);
  const selectedDepartments = Array.from(
    new Set(selectedDemands.map((d) => d.departmentId).filter((id): id is string => !!id)),
  );
  const selectedContent = selectedDemands.map((d) => d.title).filter(Boolean).join('、');

  useEffect(() => {
    if (query.data && page > pageCount) setPage(pageCount);
  }, [query.data, page, pageCount]);

  useEffect(() => {
    if (!query.data) return;
    // Refresh selected records on revisiting a page; never lose selections on other pages.
    setSelectedRows((current) => {
      const next = { ...current };
      let changed = false;
      for (const row of query.data.data.items) {
        if (!row.id || !next[row.id]) continue;
        if (row.status !== '已通过' || row.linkedRfqId) { delete next[row.id]; changed = true; }
        else if (next[row.id] !== row) { next[row.id] = row; changed = true; }
      }
      return changed ? next : current;
    });
  }, [query.data]);

  if (selected) {
    const onBack = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('recordId');
      window.history.replaceState(null, '', url.toString());
      setSelected(null);
    };
    if (!detailQuery.data || detailQuery.isError) return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} />返回需求列表</button>
        <p role={detailQuery.isError ? 'alert' : 'status'}>{detailQuery.isError ? '需求详情加载失败或无访问权限，请返回列表重试。' : '正在加载需求详情…'}</p>
      </div>
    );
    return <DemandDetail demand={detailQuery.data.data} onBack={onBack} />;
  }

  const refreshDemands = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(demands|rfqs)/.test(q.queryKey[0] as string),
    });

  const handleSubmitForApproval = (demand: PurchaseDemandResponse) => setSubmitDemand(demand);

  const submitForApproval = (formData: Record<string, unknown>) => {
    if (!submitDemand?.id) return;
    submit.mutate(
      { demandId: submitDemand.id, formData },
      { onSuccess: () => { setSubmitDemand(null); refreshDemands(); } },
    );
  };

  const toggleDemand = (id?: string) => {
    if (!id) return;
    setSelectedRows((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else {
        const row = selectablePageItems.find((item) => item.id === id);
        if (row) next[id] = row;
      }
      return next;
    });
  };

  const togglePageSelection = () => {
    const pageIds = selectablePageItems.map((d) => d.id!).filter(Boolean);
    const allSelected = pageIds.every((id) => selectedIds.includes(id));
    setSelectedRows((current) => {
      const next = { ...current };
      for (const row of selectablePageItems) {
        if (allSelected) delete next[row.id!];
        else next[row.id!] = row;
      }
      return next;
    });
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
          setSelectedRows({});
          setSupplierIds([]);
          setPlanTitle('');
          setPlanDate('');
          setPlanPlace('上海市浦东新区张江园区');
          setPlanMethod('询比');
          setCollectionMethod('公开');
          setPlanUrgency('普通');
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
        suppliers={suppliers}
        supplierIds={supplierIds}
        setSupplierIds={setSupplierIds}
        toggleSupplier={toggleSupplier}
        createError={createRfq.isError}
        createErrorMessage={(createRfq.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message}
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
                  setSelectedRows({});
                  setShowPlanForm(false);
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                <X size={14} /> 清空
              </button>
            </div>
          </div>

        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载需求列表…" />
      ) : query.isError ? (
        <FeedbackNotice tone="error" message="需求列表加载失败，请刷新后重试。" />
      ) : pageItems.length === 0 ? (
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
                    disabled={d.status !== '已通过' || !!d.linkedRfqId}
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
                  onClick={() => handleSubmitForApproval(d)}
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
                      disabled={d.status !== '已通过' || !!d.linkedRfqId}
                      onChange={() => toggleDemand(d.id)}
                      aria-label={`选择需求 ${d.id}`}
                    />
                  </td>
                  <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{d.id}</td>
                  <td className="px-5 py-5">
                    <p className="flex items-center gap-2 font-black text-slate-950">
                      {d.title}
                      {d.source === '直录登记' && (
                        <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">直录登记</span>
                      )}
                      {d.linkedRfqId && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-700">已关联计划</span>
                      )}
                    </p>
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
                          onClick={() => handleSubmitForApproval(d)}
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
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </>
      )}
    </Panel>
    {submitDemand && (
      <WorkflowSubmitDialog
        businessType="purchase_demand"
        title={submitDemand.title ?? submitDemand.id ?? '采购需求'}
        busy={submit.isPending}
        submissionError={submit.error}
        onClose={() => setSubmitDemand(null)}
        onSubmit={submitForApproval}
      />
    )}
    </div>
  );
}
