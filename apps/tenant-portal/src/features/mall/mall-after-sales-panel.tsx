import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { Check, History, RefreshCw, Undo2 } from 'lucide-react';

interface AfterSales {
  id: string; orderId: string; orderLineId: string; type: string; quantity: number;
  reason: string; status: string; supplierReply?: string; financialStatus?: string;
}
interface ServiceEvent {
  id: string; actorId?: string; actorName?: string; actorRole: string; fromStatus?: string; toStatus: string;
  note?: string; evidenceNo?: string; createdAt: string;
}
const root = '/api/v1/buyer/mall/after-sales';
const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const button = 'inline-flex min-h-9 items-center gap-1 rounded-md border px-3 py-1 text-sm disabled:opacity-50';
function errorMessage(error: unknown) {
  const body = (error as { response?: { data?: { message?: string; error?: { message?: string } } } }).response?.data;
  return body?.message ?? body?.error?.message ?? '售后操作失败，请刷新后重试';
}

export function BuyerMallAfterSalesPanel({ canPurchase = false, orderId }: { canPurchase?: boolean; orderId?: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['buyer-mall-after-sales-lifecycle'],
    queryFn: async () => (await axiosInstance.get<{ data: AfterSales[] }>(root)).data.data });
  const [selected, setSelected] = useState<string | null>(null);
  const history = useQuery({ queryKey: ['buyer-after-sales-history', selected], enabled: selected !== null,
    queryFn: async () => (await axiosInstance.get<{ data: ServiceEvent[] }>(`${root}/${encodeURIComponent(selected!)}/history`)).data.data });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: async ({ id, action }: { id: string; action: 'confirm' | 'withdraw' }) => {
    await axiosInstance.post(`${root}/${encodeURIComponent(id)}/${action}`, { note: notes[id]?.trim() });
  }, onSuccess: async () => {
    setError('');
    await client.invalidateQueries({ queryKey: ['buyer-mall-after-sales-lifecycle'] });
    await client.invalidateQueries({ queryKey: ['buyer-after-sales-history'] });
  }, onError: cause => setError(errorMessage(cause)) });
  const rows = (query.data ?? []).filter(row => !orderId || row.orderId === orderId);
  function handle(id: string, action: 'confirm' | 'withdraw') {
    if (!notes[id]?.trim()) { setError('请填写确认或撤回说明'); return; }
    mutation.mutate({ id, action });
  }
  return <section aria-label="商城售后记录" className="space-y-3">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">售后记录</h2>
      <button className={button} title="刷新售后" aria-label="刷新售后" onClick={() => void query.refetch()}><RefreshCw size={16} /></button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {query.isError ? <p role="alert">售后记录加载失败，请刷新重试</p> : query.isPending ? <p role="status">加载中</p> : rows.length === 0 ? <p>暂无售后记录</p> : rows.map(row => <article key={row.id} className="space-y-2 border-b py-3">
      <div className="flex flex-wrap justify-between gap-2"><strong>{row.type} · {row.quantity}</strong><span>{row.status}</span></div>
      <p className="break-all text-xs text-slate-500">订单 {row.orderId} / {row.orderLineId}</p>
      <p className="break-words text-sm">{row.reason}</p>
      {row.supplierReply && <p className="break-words text-sm">处理回复：{row.supplierReply}</p>}
      <p className="text-sm text-amber-800">{row.financialStatus ?? (row.type === '退货' && row.status === '已完成' ? '退货财务待核对' : '')}</p>
      {canPurchase && ['待处理', '待买方确认'].includes(row.status) && <div className="space-y-2">
        <label className="block text-sm">确认或撤回说明<textarea className={field} aria-label={`确认或撤回说明 ${row.id}`} value={notes[row.id] ?? ''} onChange={e => setNotes({ ...notes, [row.id]: e.target.value })} /></label>
        {row.status === '待买方确认' ? <button className={button} disabled={mutation.isPending} onClick={() => handle(row.id, 'confirm')}><Check size={14} />确认处理结果</button> :
          <button className={button} disabled={mutation.isPending} onClick={() => handle(row.id, 'withdraw')}><Undo2 size={14} />撤回申请</button>}
      </div>}
      <button className={button} aria-expanded={selected === row.id} onClick={() => setSelected(selected === row.id ? null : row.id)}><History size={14} />办理历史</button>
      {selected === row.id && (history.isError ? <p role="alert">历史加载失败</p> : history.isPending ? <p role="status">加载历史中</p> :
        <ol className="space-y-2 text-sm">{history.data?.length === 0 && <li>暂无办理历史</li>}{history.data?.map(event => <li key={event.id} className="break-words">
          <time>{event.createdAt}</time> · {event.actorRole === 'buyer' ? '采购方' : '供应商'} · {event.fromStatus ?? '申请'} → {event.toStatus}
          <p className="break-all">办理人：{event.actorName?.trim() || (event.actorId?.trim() ? `ID: ${event.actorId}` : '未记录办理人')}</p>
          {event.note && <p>{event.note}</p>}{event.evidenceNo && <p>凭据：{event.evidenceNo}</p>}
        </li>)}</ol>)}
    </article>)}
  </section>;
}

export interface AfterSalesOrderLine { id: string; quantity: number; description?: string }
export function BuyerMallAfterSalesRequestForm({ orderId, lines, onSaved }: {
  orderId: string; lines: AfterSalesOrderLine[]; onSaved?: () => void;
}) {
  const client = useQueryClient();
  const [lineId, setLineId] = useState(lines[0]?.id ?? '');
  const [type, setType] = useState('退货');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: async () => {
    await axiosInstance.post(root, { orderId, orderLineId: lineId, type, quantity: Number(quantity), reason: reason.trim() });
  }, onSuccess: async () => {
    setReason(''); setError('');
    await client.invalidateQueries({ queryKey: ['buyer-mall-after-sales-lifecycle'] });
    onSaved?.();
  }, onError: cause => setError(errorMessage(cause)) });
  return <form aria-label="申请售后" className="space-y-3" onSubmit={event => {
    event.preventDefault();
    const line = lines.find(item => item.id === lineId);
    const count = Number(quantity);
    if (!line || !reason.trim() || !Number.isFinite(count) || count <= 0 || count > line.quantity || !/^\d+(\.\d{1,2})?$/.test(quantity)) {
      setError('请选择订单行，填写有效数量和售后原因'); return;
    }
    mutation.mutate();
  }}>
    <label className="block text-sm">订单行<select className={field} value={lineId} onChange={e => setLineId(e.target.value)}>{lines.map(line => <option key={line.id} value={line.id}>{line.description ?? line.id} · {line.quantity}</option>)}</select></label>
    <label className="block text-sm">售后类型<select className={field} value={type} onChange={e => setType(e.target.value)}>{['退货', '换货', '维修'].map(value => <option key={value}>{value}</option>)}</select></label>
    <label className="block text-sm">数量<input className={field} type="number" min="0.01" step="0.01" max={lines.find(line => line.id === lineId)?.quantity} value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
    <label className="block text-sm">售后原因<textarea className={field} value={reason} onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}{mutation.isSuccess && <p role="status">售后申请已提交</p>}
    <button className={button} disabled={mutation.isPending || lines.length === 0}>提交售后申请</button>
  </form>;
}
