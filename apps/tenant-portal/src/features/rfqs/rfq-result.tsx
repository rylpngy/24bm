import { useQueryClient } from '@tanstack/react-query';
import { Award, Download, FileText, Stamp } from 'lucide-react';
import {
  downloadReport,
  useRfqIssueNotice,
  useRfqNotice,
  useRfqResult,
  useRfqVerifyNotice,
} from '@24bid/api-client';
import { ShieldCheck } from 'lucide-react';
import { FeedbackNotice, cn } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 采购方:已定标 RFQ 的结果公示——中标人 + 中标通知书 + 本轮报价排名。
export function RfqResultBuyer({ rfqId, supplierNames }: { rfqId: string; supplierNames: Record<string, string> }) {
  const result = useRfqResult(rfqId);
  const d = result.data?.data;
  const name = (id?: string) => (id ? (supplierNames[id] ?? id) : '—');

  if (result.isLoading) return <p className="mt-3 text-xs font-bold text-slate-400">加载结果…</p>;
  if (!d) return null;

  return (
    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
      <p className="flex items-center gap-1.5 text-sm font-black text-emerald-800">
        <Award size={16} /> 定标结果公示
      </p>
      <div className="mt-2 rounded-lg border border-emerald-100 bg-white p-3">
        <p className="text-xs font-black text-slate-500">中标供应商</p>
        <p className="mt-0.5 text-base font-black text-emerald-700">
          {name(d.winnerSupplierId)}
          <span className="ml-2 text-sm text-slate-500">{currency(d.winnerAmount)}</span>
        </p>
        {d.awardReason && <p className="mt-1 text-[11px] font-bold text-slate-400">定标理由:{d.awardReason}</p>}
      </div>

      {(d.rankings ?? []).length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
              <tr>
                <th className="px-3 py-1.5">名次</th>
                <th className="px-3 py-1.5">供应商</th>
                <th className="px-3 py-1.5 text-right">含税总价</th>
                <th className="px-3 py-1.5 text-right">交期</th>
                <th className="px-3 py-1.5 text-right">结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(d.rankings ?? []).map((r) => (
                <tr key={r.supplierId} className={cn('font-bold', r.awarded ? 'bg-emerald-50/60 text-emerald-700' : 'text-slate-600')}>
                  <td className="px-3 py-1.5">{r.rank}</td>
                  <td className="px-3 py-1.5">{name(r.supplierId)}</td>
                  <td className="px-3 py-1.5 text-right">{currency(r.amount)}</td>
                  <td className="px-3 py-1.5 text-right">{r.deliveryDays != null ? `${r.deliveryDays} 天` : '—'}</td>
                  <td className="px-3 py-1.5 text-right">
                    {r.awarded ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">★ 中标</span>
                    ) : (
                      <span className="text-[11px] text-slate-400">落标</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {d.notice && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-black text-slate-400">
            <FileText size={12} /> 中标通知书
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-700">{d.notice}</p>
          <AwardNotice rfqId={rfqId} />
        </div>
      )}
      {result.isError && <FeedbackNotice tone="error" message="结果加载失败。" />}
    </div>
  );
}

// 中标通知书签发(电子签章)+ PDF 下载。
function AwardNotice({ rfqId }: { rfqId: string }) {
  const queryClient = useQueryClient();
  const notice = useRfqNotice(rfqId);
  const issue = useRfqIssueNotice();
  const n = notice.data?.data;
  const verify = useRfqVerifyNotice(rfqId, { query: { enabled: !!n?.issued } });
  const v = verify.data?.data;

  const onIssue = () =>
    issue.mutate(
      { rfqId },
      {
        onSuccess: () =>
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes(`/rfqs/${rfqId}/notice`),
          }),
      },
    );

  if (n?.issued) {
    return (
      <div className="mt-2 rounded-lg border border-red-100 bg-red-50/40 p-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-red-700">
            <Stamp size={13} /> 已签发(电子签章)· 印章号 {n.sealNo} · 签发人 {n.issuedBy}
          </p>
          <button
            type="button"
            onClick={() => downloadReport(`/api/v1/buyer/rfqs/${rfqId}/notice.pdf`, `中标通知书-${rfqId}.pdf`)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
          >
            <Download size={13} /> 下载 PDF
          </button>
        </div>
        {v && (
          <p
            className={cn(
              'mt-1.5 flex items-center gap-1.5 text-[11px] font-bold',
              v.valid ? 'text-emerald-700' : 'text-red-700',
            )}
            title={v.signature ?? ''}
          >
            <ShieldCheck size={12} />
            防伪验签:{v.valid ? '✓ 有效(未被篡改)' : '✗ 失效(内容已变更)'} · {v.algorithm}
            {v.signature && <span className="font-mono text-slate-400"> · {v.signature.slice(0, 16)}…</span>}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onIssue}
      disabled={issue.isPending}
      className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
    >
      <Stamp size={14} /> {issue.isPending ? '签发中…' : '签发中标通知书(电子签章)'}
    </button>
  );
}
