import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileDiff } from 'lucide-react';
import {
  useBuyerContractCreateAmendment,
  useBuyerContractListAmendments,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';

const CHANGE_TYPES = ['金额变更', '工期变更', '条款变更', '范围变更'];

// 合同变更/补充协议:登记金额/工期/条款/范围变更,金额与工期变更应用到主合同,留痕成时间线。
export function ContractAmendments({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const amendments = useBuyerContractListAmendments(contractId);
  const create = useBuyerContractCreateAmendment();
  const [changeType, setChangeType] = useState('金额变更');
  const [newAmount, setNewAmount] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [reason, setReason] = useState('');

  const list = amendments.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/contracts/.test(q.queryKey[0] as string),
    });

  const onAdd = () =>
    create.mutate(
      {
        contractId,
        data: {
          changeType,
          newAmount: changeType === '金额变更' && newAmount ? Number(newAmount) : undefined,
          newExpiryDate: changeType === '工期变更' && newExpiry ? newExpiry : undefined,
          reason,
        },
      },
      {
        onSuccess: () => {
          setNewAmount('');
          setNewExpiry('');
          setReason('');
          refresh();
        },
      },
    );

  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  const canAdd =
    reason.trim().length > 0 &&
    (changeType !== '金额变更' || newAmount.trim().length > 0) &&
    (changeType !== '工期变更' || newExpiry.trim().length > 0);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600">
        <FileDiff size={13} /> 合同变更 / 补充协议
      </p>

      <div className="mt-2 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <select className={inputCls} value={changeType} onChange={(e) => setChangeType(e.target.value)}>
            {CHANGE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {changeType === '金额变更' ? (
            <input className={inputCls} type="number" placeholder="变更后金额(含税)" value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)} />
          ) : changeType === '工期变更' ? (
            <input className={inputCls} type="date" placeholder="变更后到期日" value={newExpiry}
              onChange={(e) => setNewExpiry(e.target.value)} />
          ) : (
            <div className="flex items-center text-[11px] font-bold text-slate-400">
              条款/范围变更仅留痕,不改主合同金额与工期
            </div>
          )}
          <input className={inputCls} placeholder="变更理由(必填)" value={reason}
            onChange={(e) => setReason(e.target.value)} />
        </div>
        <PrimaryActionButton onClick={onAdd} busy={create.isPending} pendingLabel="登记中" disabled={!canAdd}>
          登记变更
        </PrimaryActionButton>
        {create.isError && (
          <p className="mt-2 text-xs font-bold text-red-600">
            登记失败:金额/工期变更需填写变更后值;已归档合同不可变更。
          </p>
        )}
      </div>

      <div className="mt-3">
        {amendments.isLoading ? (
          <p className="text-xs font-bold text-slate-400">加载变更记录…</p>
        ) : list.length === 0 ? (
          <FeedbackNotice tone="info" message="暂无变更记录。登记金额/工期/条款变更后在此留痕。" />
        ) : (
          <ol className="relative ml-2 space-y-3 border-l border-amber-200 pl-4">
            {list.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800">
                      变更#{a.seq} · {a.changeType}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      {a.createdAt?.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                  {a.changeType === '金额变更' && (
                    <p className="mt-1 font-mono text-xs font-black text-slate-700">
                      ¥{Number(a.oldAmount ?? 0).toLocaleString()} → ¥{Number(a.newAmount ?? 0).toLocaleString()}
                    </p>
                  )}
                  {a.changeType === '工期变更' && (
                    <p className="mt-1 font-mono text-xs font-black text-slate-700">
                      {a.oldExpiryDate ?? '—'} → {a.newExpiryDate ?? '—'}
                    </p>
                  )}
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">{a.reason}</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">{a.actorId}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
