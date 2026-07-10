import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Send } from 'lucide-react';
import {
  type RfqClarificationResponse,
  useRfqAnswerClarification,
  useRfqClarifications,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 采购方:某 RFQ 的澄清答疑——列出全部提问,逐条答复并可广播。
export function RfqClarificationsBuyer({ rfqId }: { rfqId: string }) {
  const queryClient = useQueryClient();
  const list = useRfqClarifications(rfqId);
  const items = list.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes(`/rfqs/${rfqId}/clarifications`),
    });

  const pending = items.filter((c) => !c.answered).length;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-black text-slate-600">
        <MessageSquare size={14} className="text-blue-600" /> 澄清答疑
        {pending > 0 && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-amber-700">
            {pending} 待答复
          </span>
        )}
      </p>
      {list.isLoading ? (
        <p className="mt-2 text-xs font-bold text-slate-400">加载中…</p>
      ) : items.length === 0 ? (
        <p className="mt-2 text-xs font-bold text-slate-400">暂无供应商提问。</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((c) => (
            <BuyerClarificationRow key={c.id} rfqId={rfqId} clarification={c} onDone={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function BuyerClarificationRow({
  rfqId,
  clarification: c,
  onDone,
}: {
  rfqId: string;
  clarification: RfqClarificationResponse;
  onDone: () => void;
}) {
  const answer = useRfqAnswerClarification();
  const [text, setText] = useState(c.answer ?? '');
  // 未答复默认广播给全部供应商;已答复沿用既有广播设置。
  const [published, setPublished] = useState(c.answered ? !!c.published : true);

  const submit = () => {
    if (!text.trim() || !c.id) return;
    answer.mutate(
      { rfqId, clarificationId: c.id, data: { answer: text, published } },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold leading-5 text-slate-700">
          <span className="text-slate-400">问 · </span>{c.question}
        </p>
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black',
            c.answered ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
          )}
        >
          {c.answered ? (c.published ? '已答复·广播' : '已答复·定向') : '待答复'}
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          className={inputCls}
          placeholder={c.answered ? '修改答复…' : '输入答复…'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          广播全部供应商
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={answer.isPending || !text.trim()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Send size={13} /> {c.answered ? '更新' : '答复'}
        </button>
      </div>
      {answer.isError && (
        <div className="mt-2">
          <FeedbackNotice tone="error" message="答复失败，请稍后再试。" />
        </div>
      )}
    </div>
  );
}
