import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import {
  useBuyerContractCreateFulfillmentEvent,
  useBuyerContractListFulfillmentEvents,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';

const ACTION_TYPES = ['收货', '付款', '验收', '变更', '违约', '其他'];

// 合同履约事件时间线:登记并展示合同履约过程的关键事件(收货/付款/验收等)。
export function ContractFulfillmentEvents({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const events = useBuyerContractListFulfillmentEvents(contractId);
  const create = useBuyerContractCreateFulfillmentEvent();
  const [actionType, setActionType] = useState('收货');
  const [targetId, setTargetId] = useState('');
  const [summary, setSummary] = useState('');

  const list = events.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/fulfillment-events'),
    });

  const onAdd = () =>
    create.mutate(
      {
        contractId,
        data: {
          actionType,
          targetId: targetId || contractId,
          summary,
          sourceLabel: '手工登记',
        },
      },
      {
        onSuccess: () => {
          setTargetId('');
          setSummary('');
          refresh();
        },
      },
    );

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600">
        <Activity size={13} /> 履约事件时间线
      </p>

      <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/40 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={inputCls} value={actionType} onChange={(e) => setActionType(e.target.value)}>
            {ACTION_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input className={inputCls} placeholder="关联单据(选填,默认合同)" value={targetId}
            onChange={(e) => setTargetId(e.target.value)} />
          <input className={inputCls} placeholder="事件摘要" value={summary}
            onChange={(e) => setSummary(e.target.value)} />
        </div>
        <PrimaryActionButton onClick={onAdd} busy={create.isPending} pendingLabel="登记中" disabled={!summary}>
          登记履约事件
        </PrimaryActionButton>
      </div>

      <div className="mt-3">
        {events.isLoading ? (
          <p className="text-xs font-bold text-slate-400">加载履约事件…</p>
        ) : list.length === 0 ? (
          <FeedbackNotice tone="info" message="暂无履约事件。登记收货/付款/验收等关键节点。" />
        ) : (
          <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-4">
            {list.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800">{ev.actionType}</span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {ev.createdAt?.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{ev.summary}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">
                    {ev.sourceLabel} · {ev.targetId} · {ev.createdBy}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
