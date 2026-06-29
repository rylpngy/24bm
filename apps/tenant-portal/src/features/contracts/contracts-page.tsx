import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileSignature, Plus } from 'lucide-react';
import {
  useBuyerContractCreate,
  useBuyerContractList,
  useBuyerContractSubmitApproval,
  useBuyerContractUpdateArchiveStatus,
  useBuyerContractUpdateStatus,
  usePurchaseOrderList,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';
import { OwnerAttachments } from '../attachments/owner-attachments';
import { ContractFulfillmentEvents } from './contract-fulfillment-events';
import { ContractAmendments } from './contract-amendments';
import { ContractScheduleSection } from './contract-schedule-section';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const FULFILLMENT_NEXT: Record<string, string> = {
  待同步: '同步中',
  同步中: '已完成',
};

export function ContractsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [orderId, setOrderId] = useState('');
  const [name, setName] = useState('');
  const [attachOpenId, setAttachOpenId] = useState<string | null>(null);
  const [eventsOpenId, setEventsOpenId] = useState<string | null>(null);
  const [scheduleOpenId, setScheduleOpenId] = useState<string | null>(null);
  const [amendOpenId, setAmendOpenId] = useState<string | null>(null);

  const query = useBuyerContractList();
  const orders = usePurchaseOrderList();
  const create = useBuyerContractCreate();
  const submit = useBuyerContractSubmitApproval();
  const updateStatus = useBuyerContractUpdateStatus();
  const archive = useBuyerContractUpdateArchiveStatus();

  const contracts = query.data?.data ?? [];
  const orderList = orders.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/contracts'),
    });

  const submitCreate = () => {
    const order = orderList.find((o) => o.id === orderId);
    if (!order) return;
    create.mutate(
      {
        data: {
          contractNo: `HT-${Date.now().toString().slice(-8)}`,
          contractName: name || `${order.id} 采购合同`,
          relatedOrderId: orderId,
          amount: order.amount ?? 0,
          status: '草案',
          fulfillmentProgress: '待同步',
        },
      },
      {
        onSuccess: () => {
          setShowForm(false);
          setOrderId('');
          setName('');
          setFeedback('合同已创建(草案)');
          refresh();
        },
        onError: () => setFeedback('创建失败：该订单可能已关联合同。'),
      },
    );
  };

  const onSubmitApproval = (c: (typeof contracts)[number]) =>
    submit.mutate(
      { contractId: c.id! },
      { onSuccess: () => { setFeedback('合同已提交审批'); refresh(); } },
    );

  const onAdvance = (c: (typeof contracts)[number]) => {
    const next = FULFILLMENT_NEXT[c.fulfillmentProgress ?? ''];
    if (!next) return;
    updateStatus.mutate(
      { contractId: c.id!, data: { status: c.status ?? '已生效', fulfillmentProgress: next } },
      { onSuccess: () => { setFeedback(`履约推进至「${next}」`); refresh(); } },
    );
  };

  const onArchive = (c: (typeof contracts)[number]) =>
    archive.mutate(
      { contractId: c.id!, data: { archiveStatus: '已归档' } },
      { onSuccess: () => { setFeedback('合同已归档'); refresh(); } },
    );

  return (
    <Panel title="合同管理" icon={FileSignature} subtitle="合同台账 · 审批 · 履约 · 归档">
      <div className="mb-4 flex items-center justify-between gap-2">
        <CountTag>共 {contracts.length} 条</CountTag>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '创建合同'}
        </button>
      </div>
      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}

      {showForm && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-sm font-black text-blue-800">从采购订单创建合同</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">关联订单</label>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
              >
                <option value="">选择订单</option>
                {orderList.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}（{currency(o.amount)}）
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">合同名称</label>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如 办公设备采购合同"
              />
            </div>
          </div>
          <PrimaryActionButton onClick={submitCreate} busy={create.isPending} pendingLabel="创建中" disabled={!orderId}>
            创建合同(草案)
          </PrimaryActionButton>
        </div>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载合同…" />
      ) : contracts.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无合同。可由采购订单生成。" />
      ) : (
        <div className="space-y-3">
          {contracts.map((c) => (
            <div
              key={c.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{c.contractName}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-500">{c.contractNo}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {c.status && <StatusPill label={c.status} />}
                  {c.archiveStatus && <StatusPill label={c.archiveStatus} />}
                  {c.status === '草案' && (
                    <button
                      type="button"
                      onClick={() => onSubmitApproval(c)}
                      disabled={submit.isPending}
                      className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-400"
                    >
                      提交审批
                    </button>
                  )}
                  {c.status === '已生效' && FULFILLMENT_NEXT[c.fulfillmentProgress ?? ''] && (
                    <button
                      type="button"
                      onClick={() => onAdvance(c)}
                      disabled={updateStatus.isPending}
                      className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      推进履约至「{FULFILLMENT_NEXT[c.fulfillmentProgress ?? '']}」
                    </button>
                  )}
                  {c.archiveStatus !== '已归档' && (
                    <button
                      type="button"
                      onClick={() => onArchive(c)}
                      disabled={archive.isPending}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      归档
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="关联订单" value={c.relatedOrderId ?? '—'} />
                <MiniFact label="金额" value={currency(c.amount)} />
                <MiniFact label="履约进度" value={c.fulfillmentProgress ?? '—'} />
                <MiniFact
                  label="合同期限"
                  value={
                    c.effectiveDate || c.expiryDate
                      ? `${c.effectiveDate ?? '—'} ~ ${c.expiryDate ?? '—'}`
                      : '—'
                  }
                />
              </div>

              <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black text-slate-500">合同条款</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <MiniFact label="签订日期" value={c.signDate ?? '—'} />
                  <MiniFact label="生效日期" value={c.effectiveDate ?? '—'} />
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
                    <p className="text-[11px] font-black text-slate-400">付款条款</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {c.paymentTerms || '未约定付款条款。'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
                    <p className="text-[11px] font-black text-slate-400">质保与违约条款</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {c.warrantyTerms || '未约定质保与违约条款。'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {c.id && (
                  <button
                    type="button"
                    onClick={() => setAttachOpenId(attachOpenId === c.id ? null : c.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    {attachOpenId === c.id ? '收起附件' : '合同附件'}
                  </button>
                )}
                {c.id && (
                  <button
                    type="button"
                    onClick={() => setEventsOpenId(eventsOpenId === c.id ? null : c.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    {eventsOpenId === c.id ? '收起履约事件' : '履约事件'}
                  </button>
                )}
                {c.id && (
                  <button
                    type="button"
                    onClick={() => setScheduleOpenId(scheduleOpenId === c.id ? null : c.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 hover:bg-violet-50"
                  >
                    {scheduleOpenId === c.id ? '收起行项与付款' : '行项与付款计划'}
                  </button>
                )}
                {c.id && (
                  <button
                    type="button"
                    onClick={() => setAmendOpenId(amendOpenId === c.id ? null : c.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-white px-3 text-xs font-black text-amber-700 hover:bg-amber-50"
                  >
                    {amendOpenId === c.id ? '收起变更' : '合同变更'}
                  </button>
                )}
              </div>
              {eventsOpenId === c.id && c.id && <ContractFulfillmentEvents contractId={c.id} />}
              {scheduleOpenId === c.id && c.id && <ContractScheduleSection contractId={c.id} />}
              {amendOpenId === c.id && c.id && <ContractAmendments contractId={c.id} />}
              {attachOpenId === c.id && c.id && (
                <OwnerAttachments
                  ownerType="contract"
                  ownerId={c.id}
                  title="合同附件"
                  emptyHint="暂无附件，点击右上角上传合同正本、补充协议等。"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
