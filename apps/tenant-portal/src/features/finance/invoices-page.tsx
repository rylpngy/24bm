import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Banknote, ClipboardCheck, Info, Receipt, Scale } from 'lucide-react';
import {
  useBuyerPaymentList,
  useBuyerPaymentPaymentAuditLogs,
  useBuyerSupplierList,
  useWorkflowPaymentRequestCreate,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
} from '@24bid/ui';
import { ReconciliationVariancePanel } from './reconciliation-variance-panel';
import { PaymentBatchesPage } from './payment-batches-page';
import { financeErrorMessage } from './finance-feedback';
import { InvoiceLineMatchPanel } from './invoice-line-match-panel';
import { PaymentLedgerPanel } from './payment-ledger-panel';
import { PaymentReviewsPage } from './payment-reviews-page';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

const PAYMENT_ACTION_LABELS: Record<string, string> = {
  'invoice.paid': '登记已付款',
  'invoice.partial_paid': '登记部分付款',
};

// 付款执行记录:发票的付款审计流水(谁、何时、登记了什么)。
function PaymentExecutionTimeline({ invoiceId }: { invoiceId: string }) {
  const audit = useBuyerPaymentPaymentAuditLogs(invoiceId);
  const logs = audit.data?.data ?? [];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <h3 className="text-base font-black text-slate-950">付款执行记录</h3>
      {audit.isLoading ? (
        <p className="mt-2 text-xs font-bold text-slate-400">加载付款流水…</p>
      ) : audit.isError ? (
        <FeedbackNotice tone="error" message={financeErrorMessage(audit.error, '付款流水加载失败，请刷新重试。')} />
      ) : logs.length === 0 ? (
        <p className="mt-2 text-xs font-bold text-slate-400">尚无付款登记记录。</p>
      ) : (
        <div className="mt-3 space-y-2">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <span className="text-xs font-black text-slate-700">
                {PAYMENT_ACTION_LABELS[l.action ?? ''] ?? l.action}
              </span>
              <span className="font-mono text-xs font-bold text-slate-400">
                {l.actorId} · {l.createdAt?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// S6:发票付款 + 三单匹配。表格台账 → 对账详情页(发票信息/三单匹配/行级对账/付款流水)。
// 二级页:对账差异处理(从对账详情进入,返回详情)、付款批次(从台账进入,返回台账)。
export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [subpage, setSubpage] = useState<'none' | 'variance' | 'batches' | 'reviews'>(() => new URLSearchParams(window.location.search).get('financeView') === 'reviews' ? 'reviews' : 'none');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('recordId'));
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [paymentRequestDraft, setPaymentRequestDraft] = useState<{
    invoiceId: string;
    paymentBatchNo: string;
    remark: string;
  } | null>(null);

  const query = useBuyerPaymentList();
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const paymentRequest = useWorkflowPaymentRequestCreate();
  const allInvoices = query.data?.data ?? [];

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    (suppliersQuery.data?.data ?? []).forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliersQuery.data]);

  const statuses = [
    '全部',
    ...Array.from(new Set(allInvoices.map((inv) => inv.paymentStatus).filter(Boolean) as string[])),
  ];
  const kw = keyword.toLowerCase();
  const invoices = allInvoices.filter((inv) => {
    if (statusFilter !== '全部' && inv.paymentStatus !== statusFilter) return false;
    if (!kw) return true;
    return [inv.invoiceNo, inv.invoiceCode, inv.orderId, inv.id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(kw);
  });
  const statusCount = (s: string) =>
    s === '全部' ? allInvoices.length : allInvoices.filter((inv) => inv.paymentStatus === s).length;
  const totalAmount = allInvoices.reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
  const varianceCount = allInvoices.filter((inv) => (inv.varianceAmount ?? 0) !== 0).length;
  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = invoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(invoices|payment)/.test(q.queryKey[0] as string),
    });

  const selected = selectedId ? allInvoices.find((inv) => inv.id === selectedId) : undefined;

  if (query.isError) {
    return <FeedbackNotice tone="error" message={financeErrorMessage(query.error, '发票数据加载失败，请刷新重试。')} />;
  }

  if (subpage === 'reviews') return <PaymentReviewsPage onBack={() => setSubpage('none')} onInvoice={id => { setSelectedId(id); setSubpage('none'); }} />;

  // ── 二级页:付款批次(发票付款的批量执行工作台) ─────────────
  if (subpage === 'batches') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSubpage('none')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回发票台账"
            >
              <ArrowLeft size={18} />
            </button>
            <Banknote size={18} className="shrink-0 text-blue-600" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-slate-950">付款批次</h1>
              <p className="mt-0.5 text-xs font-bold text-slate-500">
                已通过的付款申请按批次汇总执行 · 属于发票付款的批量执行环节
              </p>
            </div>
          </div>
        </div>
        <PaymentBatchesPage />
      </div>
    );
  }

  // ── 二级页:对账差异处理(从对账详情进入,返回详情) ─────────
  if (selected && subpage === 'variance') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSubpage('none')}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回对账详情"
            >
              <ArrowLeft size={18} />
            </button>
            <Scale size={18} className="shrink-0 text-amber-600" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-slate-950">对账差异处理</h1>
              <p className="mt-0.5 font-mono text-xs font-bold text-slate-500">
                发票 {selected.invoiceNo ?? selected.id} · 处理完成后返回对账详情继续付款登记
              </p>
            </div>
          </div>
        </div>
        <ReconciliationVariancePanel focusInvoiceId={selected.id} />
      </div>
    );
  }

  // ── 对账详情页 ─────────────────────────────────────────────
  if (selected) {
    const inv = selected;
    const variance = inv.varianceAmount ?? 0;
    const matched = variance === 0;
    const busy = paymentRequest.isPending;
    const payable = inv.paymentStatus === '待付款' || inv.paymentStatus === '部分付款';
    const supplierName = inv.supplierId ? (supplierNames[inv.supplierId] ?? inv.supplierId) : '—';
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回发票台账"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words font-mono text-xl font-black text-slate-950">{inv.invoiceNo ?? inv.id}</h1>
                {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                {inv.overdue && (
                  <span className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                    逾期 {inv.overdueDays} 天
                  </span>
                )}
                {!matched && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                    对账差异 {currency(variance)}
                  </span>
                )}
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                订单 {inv.orderId ?? '—'} · 开票日期 {inv.invoiceDate ?? '—'}
              </p>
            </div>
            <p className="shrink-0 font-mono text-xl font-black text-slate-950">{currency(inv.amount)}</p>
          </div>
        </div>

        {actionError ? <FeedbackNotice tone="error" message={actionError} />
          : feedback && <FeedbackNotice tone="success" message={feedback} />}

        {inv.id && <WorkflowStatusPanel businessType="payment_request" businessId={inv.id} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            {/* 发票信息 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">发票信息(增值税专用发票)</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="发票代码" value={inv.invoiceCode || '—'} />
                <MiniFact label="发票号码" value={inv.invoiceNo ?? '—'} />
                <MiniFact label="开票日期" value={inv.invoiceDate ?? '—'} />
                <MiniFact label="税率" value={inv.taxRate != null ? `${inv.taxRate}%` : '—'} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <MiniFact label="不含税金额" value={currency(inv.netAmount)} />
                <MiniFact label="税额" value={currency(inv.taxAmount)} />
                <MiniFact label="价税合计" value={currency(inv.amount)} />
              </div>
              {(inv.lineItems ?? []).length > 0 && (
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <p className="bg-slate-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    发票行项明细({(inv.lineItems ?? []).length} 项 · 源自订单)
                  </p>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5">品名/规格</th>
                        <th className="px-3 py-1.5 text-right">数量</th>
                        <th className="px-3 py-1.5 text-right">单价</th>
                        <th className="px-3 py-1.5 text-right">行金额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(inv.lineItems ?? []).map((l) => (
                        <tr key={l.id} className="font-bold text-slate-700">
                          <td className="px-3 py-1.5">{l.description}</td>
                          <td className="px-3 py-1.5 text-right">
                            {l.quantity}
                            {l.unit ? ` ${l.unit}` : ''}
                          </td>
                          <td className="px-3 py-1.5 text-right">{currency(l.unitPrice)}</td>
                          <td className="px-3 py-1.5 text-right font-black text-slate-900">{currency(l.lineAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 三单匹配 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">三单匹配</h3>
              <p className="mt-3 text-xs font-black text-slate-500">金额维度</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <MiniFact label="发票金额" value={currency(inv.amount)} />
                <MiniFact label="订单金额" value={currency(inv.orderAmount)} />
                <MiniFact label="收货状态" value={inv.receiptStatus ?? '—'} />
                <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-[11px] font-black text-slate-400">匹配</span>
                  <StatusPill label={matched ? '已匹配' : `差异 ${currency(variance)}`} />
                </div>
              </div>
              <p className="mt-3 text-xs font-black text-slate-500">数量维度</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <MiniFact label="收货数量" value={inv.receivedQuantity != null ? String(inv.receivedQuantity) : '—'} />
                <MiniFact label="合格数量" value={inv.qualifiedQuantity != null ? String(inv.qualifiedQuantity) : '—'} />
                <MiniFact label="合格率" value={inv.qualifiedRate != null ? `${inv.qualifiedRate}%` : '—'} />
                <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-[11px] font-black text-slate-400">数量</span>
                  <StatusPill label={inv.quantityMatchStatus ?? '待收货'} />
                </div>
              </div>
              {inv.id && (
                <div className="mt-3">
                  <p className="text-xs font-black text-slate-500">行级对账(逐行匹配)</p>
                  <InvoiceLineMatchPanel invoiceId={inv.id} />
                </div>
              )}
            </section>

            {/* 对账差异处理引导 */}
            {!matched && (
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
                <p className="flex items-center gap-2 text-xs font-black text-amber-800">
                  <AlertTriangle size={14} className="shrink-0" />
                  本发票与订单存在 {currency(variance)} 对账差异,建议先在「对账差异处理」完成核对与处置,再登记付款。
                </p>
                <button
                  type="button"
                  onClick={() => setSubpage('variance')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-amber-600 px-4 text-xs font-black text-white transition hover:bg-amber-700"
                >
                  <Scale size={13} /> 去处理差异
                </button>
              </section>
            )}

            {/* 付款执行记录 */}
            {inv.id && <PaymentLedgerPanel key={inv.id} invoiceId={inv.id} />}
            {inv.id && <PaymentExecutionTimeline invoiceId={inv.id} />}
          </div>

          {/* 右栏:关键信息 */}
          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Info size={15} className="text-blue-400" /> 关键信息
              </p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['供应商', supplierName],
                  ['价税合计', currency(inv.amount)],
                  ['付款状态', inv.paymentStatus ?? '—'],
                  ['付款到期日', inv.dueDate ?? '—'],
                  ['对账阶段', inv.reconciliationStatus ?? '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {inv.overdue && (
              <section className="rounded-lg border border-red-200 bg-red-50/60 p-4">
                <p className="flex items-center gap-1.5 text-xs font-black text-red-700">
                  <AlertTriangle size={13} /> 该发票已逾期 {inv.overdueDays} 天
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-600">请尽快完成付款登记,避免影响供应商合作关系。</p>
              </section>
            )}
          </div>
        </div>

        {/* 底部悬浮操作条:付款登记 */}
        <div className="sticky bottom-4 z-30 rounded-lg border border-slate-200 bg-white/95 px-5 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <Receipt size={14} className="shrink-0 text-blue-600" />
              <span>
                当前状态 <StatusPill label={inv.paymentStatus ?? '—'} />
                <span className="ml-2">
                  {!payable
                    ? '本发票已完成付款登记。'
                    : matched
                      ? '付款申请及批次审批通过后，按实际金额登记。'
                      : '存在对账差异,登记付款前建议先完成差异处置。'}
                </span>
              </span>
            </div>
            {payable && inv.id && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPaymentRequestDraft({
                      invoiceId: inv.id!,
                      paymentBatchNo: `PAY-${new Date().toISOString().slice(0, 7).replace('-', '')}-${(inv.supplierId ?? 'GENERAL').slice(-6).toUpperCase()}`,
                      remark: '',
                    })
                  }
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-black text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                >
                  提交付款申请
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('payment-amount-ledger')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  disabled={busy}
                  className="inline-flex h-10 items-center rounded-lg bg-emerald-600 px-5 text-sm font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
                >
                  登记付款金额
                </button>
              </div>
            )}
          </div>
        </div>
        {paymentRequestDraft && (
          <WorkflowSubmitDialog
            businessType="payment_request"
            title={`发票 ${inv.invoiceNo ?? inv.id} · 付款申请`}
            busy={paymentRequest.isPending}
            submissionError={paymentRequest.error}
            onClose={() => setPaymentRequestDraft(null)}
            onSubmit={(formData) => {
              const paymentBatchNo = paymentRequestDraft.paymentBatchNo.trim();
              if (!paymentBatchNo) {
                setActionError('请填写付款批次号后再提交。');
                return;
              }
              paymentRequest.mutate(
                {
                  invoiceId: paymentRequestDraft.invoiceId,
                  requestStatus: '付款申请审批中',
                  paymentBatchNo,
                  remark: paymentRequestDraft.remark.trim() || undefined,
                  formData,
                },
                {
                  onSuccess: () => {
                    setActionError(null);
                    setPaymentRequestDraft(null);
                    setFeedback('付款申请已提交审批，待候选审批人办理。');
                    refresh();
                  },
                  onError: (error) => setActionError(financeErrorMessage(error, '付款申请提交失败，请稍后重试。')),
                },
              );
            }}
          >
            <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
              <label className="block text-xs font-black text-slate-600">
                付款批次号<span className="ml-1 text-red-500">*</span>
                <input
                  value={paymentRequestDraft.paymentBatchNo}
                  onChange={(event) => setPaymentRequestDraft((current) => current && ({ ...current, paymentBatchNo: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="block text-xs font-black text-slate-600">
                关联订单
                <input
                  value={inv.orderId ?? '—'}
                  readOnly
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-500"
                />
              </label>
              <label className="block text-xs font-black text-slate-600 sm:col-span-2">
                申请备注
                <textarea
                  value={paymentRequestDraft.remark}
                  onChange={(event) => setPaymentRequestDraft((current) => current && ({ ...current, remark: event.target.value }))}
                  placeholder="说明付款依据、计划日期或其他补充信息"
                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          </WorkflowSubmitDialog>
        )}
      </div>
    );
  }

  // ── 台账列表 ─────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <Panel title="发票付款" icon={Receipt} subtitle="发票台账 · 三单匹配 · 付款登记">
          <div className="mb-4 grid gap-2 sm:grid-cols-4">
            <MiniFact label="发票总数" value={String(allInvoices.length)} />
            <MiniFact label="待付款" value={String(statusCount('待付款'))} />
            <MiniFact label="存在对账差异" value={`${varianceCount} 张`} />
            <MiniFact label="发票总额" value={currency(totalAmount)} />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            <FilterTabs
              items={statuses.map((s) => ({ id: s, label: s, count: s === '全部' ? undefined : statusCount(s) }))}
              value={statusFilter}
              onChange={(id) => {
                setStatusFilter(id);
                setPage(1);
              }}
            />
            <SearchInput
              className="mb-0 ml-auto"
              placeholder="按发票号 / 发票代码 / 订单号搜索"
              onSearch={(k) => {
                setKeyword(k);
                setPage(1);
              }}
            />
            <button
              type="button"
              onClick={() => setSubpage('batches')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Banknote size={15} className="text-blue-600" /> 付款批次
            </button>
            <button type="button" onClick={() => setSubpage('reviews')} className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><ClipboardCheck size={15} className="text-blue-600" />历史付款核对</button>
          </div>

          {(actionError || feedback) && (
            <div className="mb-4">
              <FeedbackNotice tone={actionError ? 'error' : 'success'} message={actionError ?? feedback!} />
            </div>
          )}

          {query.isLoading ? (
            <FeedbackNotice tone="info" message="正在加载发票…" />
          ) : invoices.length === 0 ? (
            <FeedbackNotice
              tone="info"
              message={
                keyword || statusFilter !== '全部'
                  ? '没有符合条件的发票。'
                  : '暂无发票。供应商对已收货订单开票后出现。'
              }
            />
          ) : (
            <>
              <ResponsiveTableFrame
                mobileCards={pageItems.map((inv, i) => (
                  <div key={inv.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-mono font-black text-slate-950">
                          <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                          {inv.invoiceNo ?? inv.id}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">订单 {inv.orderId}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                        <span className="font-mono text-sm font-black text-slate-900">{currency(inv.amount)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => inv.id && setSelectedId(inv.id)}
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
                      <th className="px-5 py-4">发票</th>
                      <th className="px-5 py-4">关联订单</th>
                      <th className="px-5 py-4">开票日期</th>
                      <th className="px-5 py-4">三单匹配</th>
                      <th className="px-5 py-4">付款状态</th>
                      <th className="px-5 py-4 text-right">价税合计</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageItems.map((inv, i) => {
                      const variance = inv.varianceAmount ?? 0;
                      const matched = variance === 0;
                      const payable = inv.paymentStatus === '待付款' || inv.paymentStatus === '部分付款';
                      return (
                        <tr key={inv.id} className="hover:bg-blue-50/30">
                          <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                            {(safePage - 1) * PAGE_SIZE + i + 1}
                          </td>
                          <td className="px-5 py-5">
                            <p className="w-40 truncate font-mono text-xs font-black text-slate-900" title={inv.invoiceNo ?? undefined}>
                              {inv.invoiceNo ?? inv.id}
                            </p>
                            <p className="mt-1 w-40 truncate font-mono text-[11px] font-bold text-slate-400" title={inv.invoiceCode ?? undefined}>
                              {inv.invoiceCode || '代码未填'}
                            </p>
                          </td>
                          <td className="px-5 py-5">
                            <p className="w-36 truncate font-mono text-xs font-black text-slate-500" title={inv.orderId ?? undefined}>
                              {inv.orderId ?? '—'}
                            </p>
                          </td>
                          <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{inv.invoiceDate ?? '—'}</td>
                          <td className="px-5 py-5">
                            {matched ? (
                              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">已匹配</span>
                            ) : (
                              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-700">
                                差异 {currency(variance)}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-5">
                            <div className="flex flex-col gap-1">
                              {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                              {inv.overdue && (
                                <span className="text-[11px] font-black text-red-600">· 逾期 {inv.overdueDays} 天</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(inv.amount)}</td>
                          <td className="px-5 py-5 text-right">
                            <div className="flex justify-end gap-2">
                              {payable && (
                                <button
                                  type="button"
                                  onClick={() => inv.id && setSelectedId(inv.id)}
                                  className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                                >
                                  去付款
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => inv.id && setSelectedId(inv.id)}
                                className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                              >
                                详情
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
              <Pagination page={safePage} pageSize={PAGE_SIZE} total={invoices.length} onPageChange={setPage} />
            </>
          )}
      </Panel>
    </div>
  );
}
