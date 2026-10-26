import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { Download, RefreshCw, ShieldCheck } from 'lucide-react';

interface Line {
  receiptLineId: string;
  orderLineId: string;
  description: string;
  receivedQuantity: number;
  qualifiedQuantity: number;
  returnedQuantity: number;
  exchangedQuantity: number;
  unresolvedQuantity: number;
  valid: boolean;
}
interface Candidate {
  afterSalesId: string;
  orderLineId: string;
  kind: string;
  quantity: number;
}
interface Resolution {
  id: string;
  afterSalesId: string;
  quantity: number;
  kind: string;
  physicalEventId: string;
  physicalSha256: string;
  fileName: string;
  reason: string;
  reviewedBy: string;
  reviewedAt: string;
}
interface View {
  orderId: string;
  lines: Line[];
  candidates: Candidate[];
  resolutions: Resolution[];
  canResolve: boolean;
  boundary: string;
}
const field =
  'mt-1 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const button =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-3 text-sm disabled:opacity-50';
export function ReceiptQualityResolution({
  receiptId,
  onRecorded,
}: {
  receiptId: string;
  onRecorded?: (recorded: boolean) => void;
}) {
  const client = useQueryClient(),
    url = `/api/v1/buyer/receipts/${encodeURIComponent(receiptId)}/quality-resolutions`;
  const query = useQuery({
    queryKey: ['receipt-quality', receiptId],
    queryFn: async () =>
      (await axiosInstance.get<{ data: View }>(url)).data.data,
    retry: false,
  });
  const [lineId, setLine] = useState(''),
    [caseId, setCase] = useState(''),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  const data = query.data,
    line = data?.lines.find((l) => l.receiptLineId === lineId);
  useEffect(() => {
    if (data) onRecorded?.(data.resolutions.length > 0);
  }, [data, onRecorded]);
  const candidates = (data?.candidates ?? []).filter(
    (c) =>
      c.orderLineId === line?.orderLineId &&
      c.quantity <= (line?.unresolvedQuantity ?? 0),
  );
  const save = useMutation({
    mutationFn: async () =>
      (
        await axiosInstance.post<{ data: View }>(url, {
          receiptLineId: lineId,
          afterSalesId: caseId,
          reason: reason.trim(),
        })
      ).data.data,
    onSuccess: async (next) => {
      setError('');
      setCase('');
      setReason('');
      client.setQueryData(['receipt-quality', receiptId], next);
      await client.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' &&
          /buyer\/(receipts|invoices|three-way-matches|contracts)/.test(
            q.queryKey[0],
          ),
      });
    },
    onError: (e) =>
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message ?? '质量核销失败，请刷新后重试',
      ),
  });
  async function download(r: Resolution) {
    try {
      const result = await axiosInstance.get(
        `/api/v1/buyer/mall/after-sales/${encodeURIComponent(r.afterSalesId)}/physical/${encodeURIComponent(r.physicalEventId)}/file`,
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(result.data as Blob),
        a = document.createElement('a');
      a.href = url;
      a.download = r.fileName;
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('实物凭证下载失败，请重试');
    }
  }
  return (
    <section
      aria-label="不合格验收质量核销"
      className="mt-6 space-y-4 border-t border-slate-200 pt-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={18} />
          退换货质量核销
        </h3>
        <button
          className={button}
          aria-label="刷新质量核销"
          title="刷新质量核销"
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {query.isPending && <p role="status">加载质量核销记录…</p>}
      {query.isError && <p role="alert">质量核销记录加载失败，请重试</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className="text-xs text-slate-600">{data.boundary}</p>
          {data.lines.map((l) => (
            <div
              key={l.receiptLineId}
              className="border-l-2 border-blue-200 pl-3 text-sm"
            >
              <strong>{l.description}</strong>
              <p>
                原收货 {l.receivedQuantity} · 原合格 {l.qualifiedQuantity}
              </p>
              <p>
                已退回 {l.returnedQuantity} · 已换货复验 {l.exchangedQuantity} ·{' '}
                <span
                  className={
                    l.unresolvedQuantity > 0 || !l.valid
                      ? 'font-semibold text-red-700'
                      : 'text-emerald-700'
                  }
                >
                  待核销 {l.unresolvedQuantity}
                </span>
              </p>
            </div>
          ))}
          <a
            className="inline-flex py-1 text-sm font-medium text-blue-700"
            href={`?module=orders&recordId=${encodeURIComponent(data.orderId)}`}
          >
            前往关联订单办理退换货 / 清算
          </a>
          {data.canResolve &&
            data.lines.some((l) => l.unresolvedQuantity > 0 && l.valid) && (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!caseId || !reason.trim()) {
                    setError('请选择验收行、已核验售后单并填写核销依据');
                    return;
                  }
                  save.mutate();
                }}
              >
                <label className="block text-sm">
                  待核销验收行
                  <select
                    className={field}
                    required
                    value={lineId}
                    onChange={(e) => {
                      setLine(e.target.value);
                      setCase('');
                    }}
                  >
                    <option value="">请选择</option>
                    {data.lines
                      .filter((l) => l.valid && l.unresolvedQuantity > 0)
                      .map((l) => (
                        <option key={l.receiptLineId} value={l.receiptLineId}>
                          {l.description} · 待核销 {l.unresolvedQuantity}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block text-sm">
                  已完成实物核验的售后单
                  <select
                    className={field}
                    required
                    value={caseId}
                    onChange={(e) => setCase(e.target.value)}
                  >
                    <option value="">请选择</option>
                    {candidates.map((c) => (
                      <option key={c.afterSalesId} value={c.afterSalesId}>
                        {c.kind} · {c.quantity} · {c.afterSalesId}
                      </option>
                    ))}
                  </select>
                </label>
                {line && !candidates.length && (
                  <p className="text-sm text-amber-800">
                    没有可核销的同订单行售后单，请先完成退货签收或换货复验，并由买方确认。
                  </p>
                )}
                <label className="block text-sm">
                  核销依据
                  <textarea
                    className={field}
                    required
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  className={`${button} border-blue-600 bg-blue-600 text-white`}
                  disabled={save.isPending || !caseId || !reason.trim()}
                >
                  {save.isPending ? '登记中' : '确认质量核销'}
                </button>
              </form>
            )}
          {data.resolutions.map((r) => (
            <div
              key={r.id}
              className="border-l-2 border-emerald-200 pl-3 text-sm"
            >
              <strong>
                {r.kind}核销 · {r.quantity}
              </strong>
              <p className="break-all">售后单：{r.afterSalesId}</p>
              <p className="break-words">{r.reason}</p>
              <p className="break-all text-xs text-slate-500">
                {r.reviewedBy} · {r.reviewedAt}
              </p>
              <p className="break-all text-xs text-slate-500">
                SHA256：{r.physicalSha256}
              </p>
              <button
                className={`${button} mt-2`}
                onClick={() => void download(r)}
              >
                <Download size={14} />
                实物核验凭证
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
