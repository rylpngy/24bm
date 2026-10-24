import { useEffect, useId, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import { X } from 'lucide-react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

interface Review {
  id: string;
  receiptId: string;
  decision: string;
  reason: string;
  evidenceNo: string;
  reviewedBy: string;
  reviewedAt: string;
}

const failureMessage = (error: unknown) =>
  (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '复核操作失败，请刷新后重试。';

export function ReceiptDispositionReview({ receiptId, onClose }: { receiptId: string; onClose: () => void }) {
  const { can } = useBuyerPermissions();
  const canReview = can('buyer:receipt:manage') && can('buyer:workflow:review');
  const client = useQueryClient();
  const url = `/api/v1/buyer/receipts/${encodeURIComponent(receiptId)}/disposition-review`;
  const queryKey = ['receipt-disposition-review', receiptId];
  const history = useQuery({ queryKey, queryFn: async ({ signal }) =>
    (await axiosInstance.get<{ data: Review | null }>(url, { signal })).data.data,
    retry: false,
  });
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [evidenceNo, setEvidenceNo] = useState('');
  const headingId = useId();
  const root = useRef<HTMLElement>(null);
  const save = useMutation({
    mutationFn: async () => (await axiosInstance.post<{ data: Review }>(url, {
      decision, reason: reason.trim(), evidenceNo: evidenceNo.trim(),
    })).data.data,
    onSuccess: data => {
      client.setQueryData(queryKey, data);
      client.invalidateQueries({ predicate: q => typeof q.queryKey[0] === 'string'
        && /\/buyer\/(receipts|invoices|three-way-matches)/.test(q.queryKey[0]) });
    },
  });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);

  const record = history.data;
  const submit = () => {
    if (canReview && !record && !history.isPending && !history.isError && decision && reason.trim() && evidenceNo.trim() && !save.isPending) save.mutate();
  };
  const inputCls = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800';
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={event => { if (event.target === event.currentTarget && !save.isPending) onClose(); }}>
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}
      className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-xl outline-none"
      onKeyDown={event => {
        if (event.key === 'Escape' && !save.isPending) { event.stopPropagation(); onClose(); }
        if (event.key === 'Tab') {
          const targets = Array.from(root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled)') ?? []);
          const first = targets[0]; const last = targets[targets.length - 1];
          if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      }}>
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <h2 id={headingId} className="text-lg font-bold">处置复核</h2>
        <button type="button" aria-label="关闭处置复核" title="关闭" disabled={save.isPending} onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded border border-slate-200"><X size={18} /></button>
      </header>
      <p className="my-4 break-words font-mono text-xs text-slate-600">{receiptId}</p>
      {history.isPending ? <FeedbackNotice tone="info" message="正在加载复核记录…" />
        : history.isError ? <div className="space-y-3"><FeedbackNotice tone="error" message={failureMessage(history.error)} />
          <button type="button" onClick={() => history.refetch()} className="text-sm text-blue-700">重新加载</button></div>
        : record ? <dl className="space-y-4 break-words text-sm">
          {[
            ['复核决定', record.decision], ['复核原因', record.reason], ['复核凭证', record.evidenceNo],
            ['复核人', record.reviewedBy], ['复核时间', record.reviewedAt],
          ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-medium">{value}</dd></div>)}
        </dl>
          : canReview ? <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            submit();
          }}>
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-bold">复核决定</legend>
              {['让步接收', '维持退货换货'].map(value => <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="disposition-decision" value={value} checked={decision === value} disabled={save.isPending} onChange={() => setDecision(value)} />{value}
              </label>)}
            </fieldset>
            <label className="block text-sm font-bold">复核原因<textarea className={inputCls} required maxLength={2000} rows={5} value={reason} disabled={save.isPending} onChange={event => setReason(event.target.value)} /></label>
            <label className="block text-sm font-bold">复核凭证<input className={inputCls} required maxLength={500} value={evidenceNo} disabled={save.isPending} onChange={event => setEvidenceNo(event.target.value)} /></label>
            {save.isError && <FeedbackNotice tone="error" message={failureMessage(save.error)} />}
            <PrimaryActionButton onClick={submit} busy={save.isPending} pendingLabel="登记中" disabled={save.isPending || !decision || !reason.trim() || !evidenceNo.trim()}>登记复核</PrimaryActionButton>
          </form> : <FeedbackNotice tone="info" message="当前账号仅可查看复核记录。" />}
    </section>
  </div>;
}
