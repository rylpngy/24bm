import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import { useSupplierQuoteAsk, useSupplierQuoteClarifications } from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

// 供应商:某 RFQ 的澄清答疑——看自己提问 + 已广播答复;报价中可提问。
export function RfqClarificationsSupplier({ rfqId, canAsk }: { rfqId: string; canAsk: boolean }) {
  const queryClient = useQueryClient();
  const list = useSupplierQuoteClarifications(rfqId);
  const ask = useSupplierQuoteAsk();
  const [question, setQuestion] = useState('');
  const items = list.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes(`/supplier/rfqs/${rfqId}/clarifications`),
    });

  const submit = () => {
    if (!question.trim()) return;
    ask.mutate(
      { rfqId, data: { question } },
      {
        onSuccess: () => {
          setQuestion('');
          refresh();
        },
      },
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-black text-slate-600">
        <MessageSquare size={14} className="text-emerald-600" /> 澄清答疑
      </p>

      {list.isLoading ? (
        <p className="mt-2 text-xs font-bold text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs font-bold text-slate-400">暂无问答。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold leading-5 text-slate-700">
                  <span className="text-slate-400">问 · </span>{c.question}
                </p>
                {c.published && (
                  <span className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black text-blue-600">
                    公开答复
                  </span>
                )}
              </div>
              {c.answered ? (
                <p className="mt-1.5 rounded-md bg-emerald-50/70 px-2 py-1.5 text-xs font-bold leading-5 text-emerald-800">
                  <span className="text-emerald-500">答 · </span>{c.answer}
                </p>
              ) : (
                <p className="mt-1.5 text-[11px] font-bold text-amber-600">待采购方答复…</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canAsk ? (
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className={inputCls}
            placeholder="向采购方提出澄清问题…"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="button"
            onClick={submit}
            disabled={ask.isPending || !question.trim()}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400',
            )}
          >
            <Send size={13} /> 提问
          </button>
        </div>
      ) : (
        <p className="mt-2 text-[11px] font-bold text-slate-400">仅「报价中」可提问。</p>
      )}
      {ask.isError && (
        <div className="mt-2">
          <FeedbackNotice tone="error" message="提问失败,请稍后再试。" />
        </div>
      )}
    </div>
  );
}
