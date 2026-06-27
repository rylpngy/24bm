import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import {
  useBuyerPaymentList,
  useBuyerPaymentPaymentAuditLogs,
  useBuyerPaymentUpdate,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, SearchInput, StatusPill, cn } from '@24bid/ui';
import { ReconciliationVariancePanel } from './reconciliation-variance-panel';
import { ReportExportBar } from './report-export-bar';
import { InvoiceLineMatchPanel } from './invoice-line-match-panel';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

const PAYMENT_ACTION_LABELS: Record<string, string> = {
  'invoice.paid': '登记已付款',
  'invoice.partial_paid': '登记部分付款',
};

// 付款执行记录：展开某张发票的付款审计流水(谁、何时、登记了什么)。
function PaymentExecutionTimeline({ invoiceId }: { invoiceId: string }) {
  const audit = useBuyerPaymentPaymentAuditLogs(invoiceId);
  const logs = audit.data?.data ?? [];
  return (
    <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black text-slate-500">付款执行记录</p>
      {audit.isLoading ? (
        <p className="mt-2 text-xs font-bold text-slate-400">加载付款流水…</p>
      ) : logs.length === 0 ? (
        <p className="mt-2 text-xs font-bold text-slate-400">尚无付款登记记录。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2"
            >
              <span className="text-xs font-black text-slate-700">
                {PAYMENT_ACTION_LABELS[l.action ?? ''] ?? l.action}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {l.actorId} · {l.createdAt?.slice(0, 16).replace('T', ' ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// S6：发票付款 + 三单匹配。发票列表 + 付款登记(待付款→部分付款→已付款)。
export function InvoicesPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [lineMatchId, setLineMatchId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);

  const query = useBuyerPaymentList();
  const pay = useBuyerPaymentUpdate();
  const allInvoices = query.data?.data ?? [];
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
  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = invoices.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/invoices'),
    });

  const register = (invoiceId: string, paymentStatus: string) => {
    pay.mutate(
      { invoiceId, data: { paymentStatus } },
      {
        onSuccess: () => {
          setFeedback(`发票 ${invoiceId} 已登记为「${paymentStatus}」`);
          refresh();
        },
        onError: () => setFeedback('付款登记失败：可能存在三单差异或金额不一致。'),
      },
    );
  };

  return (
    <div className="space-y-5">
      <ReportExportBar />
      <ReconciliationVariancePanel />
    <Panel title="发票付款" icon={Receipt} subtitle="发票 · 三单匹配 · 付款登记">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="发票总数" value={String(allInvoices.length)} />
        <MiniFact label="待付款" value={String(statusCount('待付款'))} />
        <MiniFact label="已付款" value={String(statusCount('已付款'))} />
        <MiniFact label="发票总额" value={currency(totalAmount)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === statusFilter
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {s !== '全部' && statusCount(s) > 0 && <span className="ml-1 text-slate-400">{statusCount(s)}</span>}
            </button>
          ))}
        </div>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按发票号 / 发票代码 / 订单号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
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
        <div className="space-y-3">
          {pageItems.map((inv, i) => {
            const variance = inv.varianceAmount ?? 0;
            const matched = variance === 0;
            const busy = pay.isPending && pay.variables?.invoiceId === inv.id;
            return (
              <div
                key={inv.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}.
                      </span>
                      {inv.invoiceNo ?? inv.id}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">订单 {inv.orderId}</p>
                  </div>
                  {inv.paymentStatus && <StatusPill label={inv.paymentStatus} />}
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">发票信息（增值税专用发票）</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="发票代码" value={inv.invoiceCode || '—'} />
                    <MiniFact label="发票号码" value={inv.invoiceNo ?? '—'} />
                    <MiniFact label="开票日期" value={inv.invoiceDate ?? '—'} />
                    <MiniFact
                      label="税率"
                      value={inv.taxRate != null ? `${inv.taxRate}%` : '—'}
                    />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <MiniFact label="不含税金额" value={currency(inv.netAmount)} />
                    <MiniFact label="税额" value={currency(inv.taxAmount)} />
                    <MiniFact label="价税合计" value={currency(inv.amount)} />
                  </div>
                  {(inv.lineItems ?? []).length > 0 && (
                    <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <p className="bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        发票行项明细（{(inv.lineItems ?? []).length} 项 · 源自订单）
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
                </div>

                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">三单匹配 · 金额维度</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="发票金额" value={currency(inv.amount)} />
                    <MiniFact label="订单金额" value={currency(inv.orderAmount)} />
                    <MiniFact label="收货状态" value={inv.receiptStatus ?? '—'} />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
                      <span className="text-[11px] font-black text-slate-400">匹配</span>
                      <StatusPill label={matched ? '已匹配' : `差异 ${currency(variance)}`} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs font-black text-slate-500">三单匹配 · 数量维度</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <MiniFact label="收货数量" value={inv.receivedQuantity != null ? String(inv.receivedQuantity) : '—'} />
                    <MiniFact label="合格数量" value={inv.qualifiedQuantity != null ? String(inv.qualifiedQuantity) : '—'} />
                    <MiniFact label="合格率" value={inv.qualifiedRate != null ? `${inv.qualifiedRate}%` : '—'} />
                    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white/80 px-3 py-2">
                      <span className="text-[11px] font-black text-slate-400">数量</span>
                      <StatusPill label={inv.quantityMatchStatus ?? '待收货'} />
                    </div>
                  </div>

                  {inv.id && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => setLineMatchId((cur) => (cur === inv.id ? null : inv.id!))}
                        className="text-xs font-black text-blue-600 hover:text-blue-700"
                      >
                        {lineMatchId === inv.id ? '收起行级对账 ▲' : '查看行级对账（逐行匹配）▾'}
                      </button>
                      {lineMatchId === inv.id && <InvoiceLineMatchPanel invoiceId={inv.id} />}
                    </div>
                  )}
                </div>

                {(inv.paymentStatus === '待付款' || inv.paymentStatus === '部分付款') && inv.id && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {inv.paymentStatus === '待付款' && (
                      <button
                        type="button"
                        onClick={() => register(inv.id!, '部分付款')}
                        disabled={busy}
                        className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-white px-4 text-xs font-black text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                      >
                        登记部分付款
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => register(inv.id!, '已付款')}
                      disabled={busy}
                      className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-400"
                    >
                      {busy ? '登记中' : '登记已付款'}
                    </button>
                  </div>
                )}

                {inv.id && (
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === inv.id ? null : inv.id!)}
                    className="mt-3 inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    {openId === inv.id ? '收起付款记录' : '付款执行记录'}
                  </button>
                )}
                {openId === inv.id && inv.id && <PaymentExecutionTimeline invoiceId={inv.id} />}
              </div>
            );
          })}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={invoices.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
    </div>
  );
}
