import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, CalendarClock, FileDiff, FileSignature, FileText, History, Info, Paperclip, Plus, ScanText } from 'lucide-react';
import {
  useBuyerContractCreate,
  useBuyerContractList,
  useBuyerContractRenew,
  useBuyerContractReviewApproval,
  useBuyerContractUpdateArchiveStatus,
  useBuyerContractUpdateStatus,
  usePurchaseOrderList,
  useWorkflowContractApprovalSubmit,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  Tabs,
  cn,
} from '@24bid/ui';
import { OwnerAttachments } from '../attachments/owner-attachments';
import { ContractFulfillmentEvents } from './contract-fulfillment-events';
import { ContractAmendments } from './contract-amendments';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { financeErrorMessage } from '../finance/finance-feedback';
import { ContractScheduleSection } from './contract-schedule-section';
import { ContractPaymentReconciliationPanel, ContractReconciliationDetail } from './contract-payment-reconciliation-panel';
import { ContractEsignPanel } from './contract-esign-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { ContractReviewWorkspace } from './review/contract-review-workspace';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

// 到期提醒:距到期天数(已过期为负);60 天内视为「即将到期」。
const RENEWAL_WINDOW_DAYS = 60;
const daysToExpiry = (expiryDate?: string | null): number | null => {
  if (!expiryDate) return null;
  const ms = new Date(`${expiryDate}T00:00:00`).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
};

const FULFILLMENT_NEXT: Record<string, string> = {
  待同步: '同步中',
  同步中: '已完成',
};

function ExpiryChip({ expiryDate, archived }: { expiryDate?: string | null; archived?: boolean }) {
  const d = daysToExpiry(expiryDate);
  if (archived || d == null || d > RENEWAL_WINDOW_DAYS) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-black',
        d < 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
      )}
    >
      <CalendarClock size={11} />
      {d < 0 ? `已过期 ${-d} 天` : `${d} 天后到期`}
    </span>
  );
}

// 合同管理:表格台账 → 详情页(条款/附件/履约/变更/行项付款),操作收敛底部悬浮条。
export function ContractsPage() {
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:contract:manage');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [name, setName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [reviewMode,setReviewMode]=useState(()=>new URLSearchParams(window.location.search).get('view')==='review');

  const query = useBuyerContractList();
  const orders = usePurchaseOrderList();
  const create = useBuyerContractCreate();
  const submit = useWorkflowContractApprovalSubmit();
  const reviewApproval = useBuyerContractReviewApproval();
  const renew = useBuyerContractRenew();
  const updateStatus = useBuyerContractUpdateStatus();
  const archive = useBuyerContractUpdateArchiveStatus();

  const contracts = query.isError ? [] : query.data?.data ?? [];
  const orderList = orders.data?.data ?? [];

  const statuses = ['全部', ...Array.from(new Set(contracts.map((c) => c.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const filtered = contracts.filter((c) => {
    if (statusFilter !== '全部' && c.status !== statusFilter) return false;
    if (!kw) return true;
    return [c.contractName, c.contractNo, c.relatedOrderId].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) =>
    s === '全部' ? contracts.length : contracts.filter((c) => c.status === s).length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get('recordId');
    if (!selectedId && recordId && contracts.some((item) => item.id === recordId)) setSelectedId(recordId);
  }, [contracts, selectedId]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/contracts'),
    });

  const submitCreate = () => {
    if (!canManage) return;
    const order = orderList.find((o) => o.id === orderId);
    if (!order || order.amount == null || order.amount <= 0) return;
    create.mutate(
      {
        data: {
          contractNo: `HT-${Date.now().toString().slice(-8)}`,
          contractName: name || `${order.id} 采购合同`,
          relatedOrderId: orderId,
          amount: order.amount,
          status: '草案',
          fulfillmentProgress: '待同步',
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setOrderId('');
          setName('');
          setFeedback('合同已创建(草案)');
          refresh();
        },
        onError: () => setFeedback('创建失败:该订单可能已关联合同。'),
      },
    );
  };

  const [detailTab, setDetailTab] = useState('info');
  const [visitedTabs, setVisitedTabs] = useState<string[]>(['info']);
  const changeDetailTab = (tab: string) => {
    setDetailTab(tab);
    setVisitedTabs((visited) => visited.includes(tab) ? visited : [...visited, tab]);
  };
  const openDetail = (id?: string) => {
    if (!id) return;
    setDetailTab('info');
    setVisitedTabs(['info']);
    setSelectedId(id);
  };

  const selected = selectedId ? contracts.find((c) => c.id === selectedId) : undefined;

  if(reviewMode)return <ContractReviewWorkspace canManage={canManage} onBack={()=>{
    const url=new URL(window.location.href);url.searchParams.delete('view');url.searchParams.delete('reviewDocument');window.history.replaceState(null,'',url);setReviewMode(false);
  }}/>;

  if (query.isError) return <FeedbackNotice tone="error" message={financeErrorMessage(query.error, '合同加载失败')} />;
  const failedAction = [create, submit, reviewApproval, renew, updateStatus, archive].find((action) => action.isError);

  // ── 详情页 ────────────────────────────────────────────────
  if (selected) {
    const c = selected;
    const busy = submit.isPending || reviewApproval.isPending || renew.isPending || updateStatus.isPending || archive.isPending;
    const d = daysToExpiry(c.expiryDate);
    const nextFulfillment = FULFILLMENT_NEXT[c.fulfillmentProgress ?? ''];
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                const url = new URL(window.location.href);
                url.searchParams.delete('recordId');
                window.history.replaceState(null, '', url);
                setSelectedId(null);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回合同台账"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black text-slate-950">{c.contractName}</h1>
                {c.status && <StatusPill label={c.status} />}
                {c.archiveStatus === '已归档' && <StatusPill label="已归档" />}
                <ExpiryChip expiryDate={c.expiryDate} archived={c.archiveStatus === '已归档'} />
                {c.renewalStatus === '已发起续签' && (
                  <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">已发起续签</span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {c.contractNo} · 关联订单 {c.relatedOrderId ? <a className="break-all text-blue-700 hover:underline" href={`?${new URLSearchParams({ ...(new URLSearchParams(window.location.search).get('solution') === 'ludong-poc' ? { solution: 'ludong-poc' } : {}), module: 'orders', recordId: c.relatedOrderId })}`}>{c.relatedOrderId}</a> : '—'}
              </p>
            </div>
            <p className="shrink-0 font-mono text-xl font-black text-slate-950">{currency(c.amount)}</p>
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {failedAction && <FeedbackNotice tone="error" message={financeErrorMessage(failedAction.error, '合同操作失败')} />}

        <div className="min-w-0 space-y-4">
            <Tabs
              items={[
                { id: 'info', label: '基本信息', icon: FileText },
                { id: 'fulfillment', label: '履约记录', icon: CalendarClock },
                { id: 'reconciliation', label: '付款对账', icon: Banknote },
                { id: 'amendments', label: '合同变更', icon: FileDiff },
                { id: 'review', label: '智能审查', icon: ScanText },
                { id: 'approval', label: '审批记录', icon: History },
                { id: 'files', label: '附件与签署', icon: Paperclip },
              ]}
              value={detailTab}
              onChange={changeDetailTab}
            />

            <div hidden={detailTab !== 'info'} className="space-y-4">
            <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            {/* 合同条款 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">合同条款</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="签订日期" value={c.signDate ?? '—'} />
                <MiniFact label="生效日期" value={c.effectiveDate ?? '—'} />
                <MiniFact label="到期日期" value={c.expiryDate ?? '—'} />
                <MiniFact label="履约进度" value={c.fulfillmentProgress ?? '—'} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">付款条款</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {c.paymentTerms || '未约定付款条款。'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-[11px] font-black text-slate-400">质保与违约条款</p>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                    {c.warrantyTerms || '未约定质保与违约条款。'}
                  </p>
                </div>
              </div>
            </section>
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Info size={15} className="text-blue-400" /> 关键信息
              </p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['合同编号', c.contractNo ?? '—'],
                  ['合同金额', currency(c.amount)],
                  ['合同状态', c.status ?? '—'],
                  ['合同期限', c.effectiveDate || c.expiryDate ? `${c.effectiveDate ?? '—'} ~ ${c.expiryDate ?? '—'}` : '—'],
                  ['归档状态', c.archiveStatus ?? '未归档'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {d != null && d <= RENEWAL_WINDOW_DAYS && c.archiveStatus !== '已归档' && (
              <section className={cn('rounded-lg border p-4', d < 0 ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60')}>
                <p className={cn('flex items-center gap-1.5 text-xs font-black', d < 0 ? 'text-red-700' : 'text-amber-800')}>
                  <CalendarClock size={13} /> {d < 0 ? `合同已过期 ${-d} 天` : `合同将于 ${d} 天后到期`}
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-600">
                  {c.renewalStatus === '已发起续签' ? '续签流程已发起,请跟进签署。' : '可在下方操作条发起续签。'}
                </p>
              </section>
            )}
          </div>
            </div>
            </div>

            {/* 仅首次访问时加载，之后隐藏而不卸载，保留未保存的输入。 */}
            {visitedTabs.includes('fulfillment') && <div hidden={detailTab !== 'fulfillment'}>
              {c.id && <ContractFulfillmentEvents key={c.id} contractId={c.id} />}
            </div>}
            {visitedTabs.includes('reconciliation') && <div hidden={detailTab !== 'reconciliation'} className="space-y-4">
              <ContractReconciliationDetail contract={c} />
              {c.id && <ContractScheduleSection key={c.id} contractId={c.id} />}
            </div>}
            {visitedTabs.includes('amendments') && <div hidden={detailTab !== 'amendments'}>
              {c.id && <ContractAmendments key={c.id} contractId={c.id} status={c.status} archiveStatus={c.archiveStatus} />}
            </div>}
            {visitedTabs.includes('review') && <div hidden={detailTab !== 'review'} className="space-y-4">
              <FeedbackNotice tone="info" message="仅展示本合同关联的审查材料；校对稿与原件分别保留，不自动覆盖正式合同。" />
              <ContractReviewWorkspace key={c.id} contractId={c.id} embedded canManage={canManage} onBack={() => changeDetailTab('info')} />
            </div>}
            {visitedTabs.includes('approval') && <div hidden={detailTab !== 'approval'}>
              {c.id && <WorkflowStatusPanel key={c.id} businessType="contract_approval" businessId={c.id} />}
            </div>}
            {visitedTabs.includes('files') && <div hidden={detailTab !== 'files'} className="space-y-4">
              {c.id && <ContractEsignPanel key={`esign-${c.id}`} contractId={c.id} />}
              {c.id && <OwnerAttachments key={`attachments-${c.id}`} ownerType="contract" ownerId={c.id} title="合同附件"
                emptyHint="暂无附件,点击右上角上传合同正本、补充协议等。" />}
            </div>}
        </div>

        {/* 底部悬浮操作条:阶段化动作常驻可见 */}
        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <FileSignature size={14} className="shrink-0 text-blue-600" />
              <span>
                当前状态 <StatusPill label={c.status ?? '—'} />
                <span className="ml-2">
                  {c.status === '草案'
                    ? '草案确认无误后提交审批。'
                    : c.status === '审批中'
                      ? '合同在审批中,可直接复核。'
                      : c.status === '已生效'
                        ? '合同已生效,可推进履约或归档。'
                        : '可执行归档等操作。'}
                </span>
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canManage && c.archiveStatus !== '已归档' && c.status === '草案' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowApprovalDialog(true)}
                  className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
                >
                  提交审批
                </button>
              )}
              {canManage && c.archiveStatus !== '已归档' && c.status === '审批中' && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      reviewApproval.mutate(
                        { contractId: c.id!, data: { approved: true, comment: '合同条款复核通过' } },
                        {
                          onSuccess: () => { setFeedback('合同审批通过,已生效'); refresh(); },
                          onError: () => setFeedback('复核失败:合同可能不在审批中或审批任务已被处理。'),
                        },
                      )
                    }
                    className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-5 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-300"
                  >
                    审批通过
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      reviewApproval.mutate(
                        { contractId: c.id!, data: { approved: false, comment: '合同条款需修订后重新提交' } },
                        {
                          onSuccess: () => { setFeedback('合同审批已驳回,退回草案'); refresh(); },
                          onError: () => setFeedback('复核失败:合同可能不在审批中或审批任务已被处理。'),
                        },
                      )
                    }
                    className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-4 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    驳回
                  </button>
                </>
              )}
              {canManage && c.archiveStatus !== '已归档' && c.status === '已生效' && nextFulfillment && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    updateStatus.mutate(
                      { contractId: c.id!, data: { status: c.status ?? '已生效', fulfillmentProgress: nextFulfillment } },
                      { onSuccess: () => { setFeedback(`履约推进至「${nextFulfillment}」`); refresh(); } },
                    )
                  }
                  className="inline-flex h-10 items-center rounded-lg border border-indigo-200 bg-white px-4 text-sm font-black text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                >
                  推进履约至「{nextFulfillment}」
                </button>
              )}
              {canManage && c.renewalStatus !== '已发起续签' && c.archiveStatus !== '已归档' && d != null && d <= RENEWAL_WINDOW_DAYS && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    renew.mutate({ contractId: c.id! }, { onSuccess: () => { setFeedback('已发起续签,可在到期前完成续签流程'); refresh(); } })
                  }
                  className="inline-flex h-10 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  发起续签
                </button>
              )}
              {canManage && c.status === '已生效' && c.archiveStatus !== '已归档' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    archive.mutate(
                      { contractId: c.id!, data: { archiveStatus: '已归档' } },
                      { onSuccess: () => { setFeedback('合同已归档'); refresh(); } },
                    )
                  }
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  归档
                </button>
              )}
            </div>
          </div>
        </div>
        {showApprovalDialog && c.id && (
          <WorkflowSubmitDialog
            businessType="contract_approval"
            title={c.contractName ?? '合同审批'}
            busy={submit.isPending}
            submissionError={submit.error}
            onClose={() => setShowApprovalDialog(false)}
            onSubmit={(formData) =>
              submit.mutate(
                { contractId: c.id!, formData },
                {
                  onSuccess: () => {
                    setShowApprovalDialog(false);
                    setFeedback('合同已提交审批，待候选审批人办理。');
                    refresh();
                  },
                  onError: () => setFeedback('提交失败：请确认已发布合同审批流程并重试。'),
                },
              )
            }
          />
        )}
      </div>
    );
  }

  // ── 列表页 ────────────────────────────────────────────────
  return (
    <Panel title="合同管理" icon={FileSignature} subtitle="合同台账 · 审批 · 履约 · 归档">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button type="button" onClick={()=>setReviewMode(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700"><ScanText size={14}/>智能审查</button>
          <SearchInput
            className="mb-0"
            placeholder="按合同名称 / 编号 / 订单号搜索"
            onSearch={(k) => {
              setKeyword(k);
              setPage(1);
            }}
          />
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> {showForm ? '收起' : '创建合同'}
          </button>
        </div>
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {showForm && canManage && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-sm font-black text-blue-800">从采购订单创建合同</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">
                <span className="mr-1 text-red-500">*</span>关联订单
              </label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                <option value="">选择订单</option>
                {orderList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}({currency(o.amount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">合同名称(选填)</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如 办公设备采购合同"
              />
            </div>
          </div>
          <PrimaryActionButton onClick={submitCreate} busy={create.isPending} pendingLabel="创建中" disabled={!orderId}>
            创建合同(草案)
          </PrimaryActionButton>
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载合同…" />
      ) : contracts.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无合同。可由采购订单生成。" />
      ) : (
        <>
          <div className="mb-4">
            <ContractPaymentReconciliationPanel contracts={contracts} summaryOnly />
          </div>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((c, i) => (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {c.contractName}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{c.contractNo}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {c.status && <StatusPill label={c.status} />}
                    <span className="font-mono text-sm font-black text-slate-900">{currency(c.amount)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openDetail(c.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  查看详情
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">合同</th>
                  <th className="px-5 py-4">关联订单</th>
                  <th className="px-5 py-4">合同期限</th>
                  <th className="px-5 py-4">履约进度</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">合同金额</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((c, i) => (
                  <tr key={c.id} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5">
                      <p className="flex items-center gap-2 font-black text-slate-950">
                        {c.contractName}
                        <ExpiryChip expiryDate={c.expiryDate} archived={c.archiveStatus === '已归档'} />
                      </p>
                      <p className="mt-1 w-40 truncate font-mono text-[11px] font-bold text-slate-400" title={c.contractNo ?? undefined}>
                        {c.contractNo}
                      </p>
                    </td>
                    <td className="px-5 py-5">
                      <p className="w-40 truncate font-mono text-xs font-black text-slate-500" title={c.relatedOrderId ?? undefined}>
                        {c.relatedOrderId ?? '—'}
                      </p>
                    </td>
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">
                      {c.effectiveDate || c.expiryDate ? `${c.effectiveDate ?? '—'} ~ ${c.expiryDate ?? '—'}` : '—'}
                    </td>
                    <td className="px-5 py-5 text-sm font-bold text-slate-600">{c.fulfillmentProgress ?? '—'}</td>
                    <td className="px-5 py-5">
                      <div className="flex flex-col gap-1">
                        {c.status && <StatusPill label={c.status} />}
                        {c.archiveStatus === '已归档' && (
                          <span className="text-[11px] font-bold text-slate-400">· 已归档</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(c.amount)}</td>
                    <td className="px-5 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {c.status === '草案' && (
                          <button
                            type="button"
                            onClick={() => openDetail(c.id)}
                            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            提交审批
                          </button>
                        )}
                        {c.status === '审批中' && (
                          <button
                            type="button"
                            onClick={() => openDetail(c.id)}
                            className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                          >
                            去复核
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetail(c.id)}
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
  );
}
