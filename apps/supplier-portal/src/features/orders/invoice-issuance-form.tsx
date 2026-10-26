import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customInstance } from '@24bid/api-client/http-client';
import { RefreshCw, FileText } from 'lucide-react';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import { invoiceLineCents } from './invoice-issuance-amount';

interface Line {
  orderLineId: string;
  description: string;
  unit: string;
  orderedQuantity: number;
  unitPrice: number;
  invoicedQuantity: number;
  remainingQuantity: number;
}
interface Preview {
  orderId: string;
  orderAmount: number;
  invoicedAmount: number;
  remainingAmount: number;
  lines: Line[];
  blockers: string[];
}
interface History {
  id: string;
  invoiceNo: string;
  amount: number;
  paymentStatus: string;
}
const input =
  'h-10 w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700';
const money = (n: number) =>
  n.toLocaleString('zh-CN', { style: 'currency', currency: 'CNY' });
export function InvoiceIssuanceForm({
  orderId,
  onSaved,
  onClose,
}: {
  orderId: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const url = `/api/v1/supplier/orders/${encodeURIComponent(orderId)}/invoices`,
    client = useQueryClient();
  const preview = useQuery({
    queryKey: [url + '/preview'],
    queryFn: () =>
      customInstance<{ data: Preview }>({
        url: url + '/preview',
        method: 'GET',
      }),
  });
  const history = useQuery({
    queryKey: ['/api/v1/supplier/invoices', { orderId }],
    queryFn: () =>
      customInstance<{ data: History[] }>({
        url: '/api/v1/supplier/invoices',
        method: 'GET',
        params: { orderId },
      }),
  });
  const [quantities, setQuantities] = useState<Record<string, string>>({}),
    [number, setNumber] = useState(''),
    [code, setCode] = useState(''),
    [tax, setTax] = useState('13'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const initialized = useRef(false),
    held = useRef(false),
    keys = useRef(new Map<string, string>()),
    data = preview.data?.data;
  useEffect(() => {
    if (data && !initialized.current) {
      initialized.current = true;
      setQuantities(
        Object.fromEntries(
          data.lines.map((l) => [l.orderLineId, String(l.remainingQuantity)]),
        ),
      );
    }
  }, [data]);
  const selected = (data?.lines || []).filter(
    (l) => Number(quantities[l.orderLineId] || 0) > 0,
  );
  const cents = selected.map((l) =>
    invoiceLineCents(quantities[l.orderLineId] || '0', l.unitPrice),
  );
  const valid =
    !!data &&
    !preview.isError &&
    !data.blockers.length &&
    selected.length > 0 &&
    cents.every((n) => n !== null) &&
    Object.values(quantities).every(
      (q) => q === '' || (/^\d+(\.\d{1,4})?$/.test(q) && Number(q) >= 0),
    ) &&
    selected.every(
      (l) => Number(quantities[l.orderLineId]) <= l.remainingQuantity,
    );
  const total = cents.reduce<number>((sum, n) => sum + (n ?? 0), 0) / 100;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (held.current) return;
    setError('');
    const rate = Number(tax);
    if (
      !valid ||
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 100 ||
      !Number.isSafeInteger(Math.round(total * 100)) ||
      total <= 0 ||
      !number.trim()
    ) {
      setError('请填写发票号码、有效税率及剩余范围内的本次开票数量。');
      return;
    }
    const body = {
      amount: total,
      invoiceNo: number.trim(),
      invoiceCode: code.trim(),
      taxRate: rate,
      lineItems: selected.map((l) => ({
        orderLineId: l.orderLineId,
        quantity: Number(quantities[l.orderLineId]),
      })),
    };
    const fingerprint = JSON.stringify(body);
    let key = keys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(fingerprint, key);
    }
    held.current = true;
    setBusy(true);
    let saved = false;
    try {
      await customInstance({
        url,
        method: 'POST',
        data: { ...body, requestKey: key },
      });
      saved = true;
      await client.invalidateQueries({ queryKey: [url + '/preview'] });
      await client.invalidateQueries({
        queryKey: ['/api/v1/supplier/invoices'],
      });
      onSaved();
    } catch (e) {
      setError(
        saved
          ? '发票已保存，刷新失败。请刷新后核对，不要重新开票。'
          : (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message ||
              '提交失败，可保留当前内容重试；相同请求不会重复开票。',
      );
    } finally {
      held.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      aria-label="分次开票"
      className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-semibold">
          <FileText size={16} />
          开具发票
        </h3>
        <button
          type="button"
          title="刷新剩余可开数量"
          aria-label="刷新剩余可开数量"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200"
          disabled={busy}
          onClick={async () => {
            const r = await preview.refetch();
            if (r.data)
              setQuantities(
                Object.fromEntries(
                  r.data.data.lines.map((l) => [
                    l.orderLineId,
                    String(l.remainingQuantity),
                  ]),
                ),
              );
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {preview.isLoading && <p role="status">加载开票余额…</p>}
      {preview.isError && (
        <FeedbackNotice
          tone="error"
          message="开票余额加载失败，请刷新后重试。"
        />
      )}
      {data && (
        <>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {[
              ['订单金额', data.orderAmount],
              ['累计已开', data.invoicedAmount],
              ['剩余可开', data.remainingAmount],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-500">{label}</dt>
                <dd className="font-semibold tabular-nums">
                  {money(value as number)}
                </dd>
              </div>
            ))}
          </dl>
          {data.blockers.map((b) => (
            <FeedbackNotice key={b} tone="info" message={b} />
          ))}
          {!data.blockers.length && (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-4"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="min-w-0 text-sm">
                  发票号码 <span className="text-red-600">*</span>
                  <input
                    className={input}
                    aria-label="发票号码"
                    placeholder="发票号码"
                    required
                    maxLength={100}
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </label>
                <label className="min-w-0 text-sm">
                  发票代码
                  <input
                    className={input}
                    placeholder="发票代码"
                    maxLength={100}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
                <label className="min-w-0 text-sm">
                  税率 %
                  <input
                    className={input}
                    aria-label="税率%"
                    placeholder="税率%"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                  />
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="p-2">物料</th>
                      <th className="p-2">订单数量</th>
                      <th className="p-2">已开 / 剩余</th>
                      <th className="p-2">单价</th>
                      <th className="w-36 p-2">本次开票数量</th>
                      <th className="p-2">本次金额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((l) => (
                      <tr
                        key={l.orderLineId}
                        className="border-b border-slate-100"
                      >
                        <td className="max-w-52 break-words p-2">
                          {l.description}
                          <span className="block text-xs text-slate-400">
                            {l.unit}
                          </span>
                        </td>
                        <td className="p-2">{l.orderedQuantity}</td>
                        <td className="whitespace-nowrap p-2">
                          {l.invoicedQuantity} / {l.remainingQuantity}
                        </td>
                        <td className="p-2 tabular-nums">
                          {money(l.unitPrice)}
                        </td>
                        <td className="p-2">
                          <input
                            className={input}
                            aria-label={`${l.description}本次开票数量`}
                            type="number"
                            min="0"
                            max={l.remainingQuantity}
                            step="0.0001"
                            disabled={l.remainingQuantity === 0 || busy}
                            value={quantities[l.orderLineId] ?? ''}
                            onChange={(e) =>
                              setQuantities({
                                ...quantities,
                                [l.orderLineId]: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="p-2 tabular-nums">
                          {money(
                            (invoiceLineCents(
                              quantities[l.orderLineId] || '0',
                              l.unitPrice,
                            ) ?? 0) / 100,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="text-sm tabular-nums">
                  本次价税合计 {money(total)}
                </strong>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md border border-slate-200 px-3 text-sm"
                    disabled={busy}
                    onClick={onClose}
                  >
                    取消
                  </button>
                  <PrimaryActionButton
                    type="submit"
                    onClick={() => {}}
                    flushTop
                    busy={busy}
                    pendingLabel="开票中"
                    disabled={!valid || total <= 0 || !number.trim()}
                  >
                    提交开票
                  </PrimaryActionButton>
                </div>
              </div>
            </form>
          )}
        </>
      )}
      {error && <FeedbackNotice tone="error" message={error} />}
      {!!history.data?.data.length && (
        <div className="overflow-x-auto border-t border-slate-100 pt-3">
          <h4 className="mb-2 text-sm font-semibold">已开票记录</h4>
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">发票号码</th>
                <th>金额</th>
                <th>付款状态</th>
              </tr>
            </thead>
            <tbody>
              {history.data.data.map((i) => (
                <tr key={i.id}>
                  <td className="max-w-48 break-words py-2">{i.invoiceNo}</td>
                  <td className="tabular-nums">{money(i.amount)}</td>
                  <td>{i.paymentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {history.isError && (
        <FeedbackNotice tone="error" message="已开票记录加载失败。" />
      )}
      {!!data?.blockers.length && (
        <button
          type="button"
          className="h-9 rounded-md border border-slate-200 px-3 text-sm"
          onClick={onClose}
        >
          关闭
        </button>
      )}
    </section>
  );
}
