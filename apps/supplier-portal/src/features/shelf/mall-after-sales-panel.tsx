import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { Check, History, Play, RefreshCw, X } from 'lucide-react';

interface AfterSales {
  id: string; orderId: string; orderLineId: string; type: string; quantity: number;
  reason: string; status: string; supplierReply?: string; financialStatus?: string;
}
interface ServiceEvent {
  id: string; actorRole: string; fromStatus?: string; toStatus: string;
  note?: string; evidenceNo?: string; createdAt: string;
}
const root = '/api/v1/supplier/mall/after-sales';
const field = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const button = 'inline-flex min-h-9 items-center gap-1 rounded-md border px-3 py-1 text-sm disabled:opacity-50';
function errorMessage(error: unknown) {
  const body = (error as { response?: { data?: { message?: string; error?: { message?: string } } } }).response?.data;
  return body?.message ?? body?.error?.message ?? '售后操作失败，请刷新后重试';
}

export function SupplierMallAfterSalesPanel({ canManage = false }: { canManage?: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['supplier-mall-after-sales-lifecycle'],
    queryFn: async () => (await axiosInstance.get<{ data: AfterSales[] }>(root)).data.data });
  const [selected, setSelected] = useState<string | null>(null);
  const history = useQuery({ queryKey: ['supplier-after-sales-history', selected], enabled: selected !== null,
    queryFn: async () => (await axiosInstance.get<{ data: ServiceEvent[] }>(`${root}/${encodeURIComponent(selected!)}/history`)).data.data });
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const mutation = useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => {
    await axiosInstance.put(`${root}/${encodeURIComponent(id)}`, { status, reply: replies[id]?.trim(), evidenceNo: evidence[id]?.trim() });
  }, onSuccess: async () => {
    setError('');
    await client.invalidateQueries({ queryKey: ['supplier-mall-after-sales-lifecycle'] });
    await client.invalidateQueries({ queryKey: ['supplier-after-sales-history'] });
  }, onError: (cause) => setError(errorMessage(cause)) });
  function handle(id: string, status: string) {
    setError('');
    if ((status === '已拒绝' || status === '已完成') && !replies[id]?.trim()) {
      setError('请填写处理回复'); return;
    }
    if (status === '已完成' && !evidence[id]?.trim()) { setError('请填写处理凭据编号'); return; }
    mutation.mutate({ id, status });
  }
  return <section aria-label="商城售后办理" className="space-y-3">
    <div className="flex items-center justify-between"><h2 className="text-base font-semibold">商城售后办理</h2>
      <button className={button} title="刷新售后" aria-label="刷新售后" onClick={() => void query.refetch()}><RefreshCw size={16} /></button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {query.isError ? <p role="alert">售后记录加载失败，请刷新重试</p> : query.isPending ? <p role="status">加载中</p> :
      query.data?.length === 0 ? <p>暂无售后记录</p> : query.data?.map(row => <article key={row.id} className="space-y-2 border-b py-3">
        <div className="flex flex-wrap justify-between gap-2"><strong>{row.type} · {row.quantity}</strong><span>{row.status}</span></div>
        <p className="break-all text-xs text-slate-500">订单 {row.orderId} / {row.orderLineId}</p>
        <p className="break-words text-sm">{row.reason}</p>
        {row.supplierReply && <p className="break-words text-sm">处理回复：{row.supplierReply}</p>}
        <p className="text-sm text-amber-800">{row.financialStatus ?? (row.type === '退货' && row.status === '已完成' ? '退货财务待核对' : '')}</p>
        {canManage && ['待处理', '处理中'].includes(row.status) && <div className="space-y-2">
          <label className="block text-sm">处理回复<textarea className={field} aria-label={`处理回复 ${row.id}`} value={replies[row.id] ?? ''} onChange={e => setReplies({ ...replies, [row.id]: e.target.value })} /></label>
          {row.status === '处理中' && <label className="block text-sm">处理凭据编号<input className={field} aria-label={`处理凭据编号 ${row.id}`} value={evidence[row.id] ?? ''} onChange={e => setEvidence({ ...evidence, [row.id]: e.target.value })} /></label>}
          <div className="flex flex-wrap gap-2">
            {row.status === '待处理' ? <button className={button} disabled={mutation.isPending} onClick={() => handle(row.id, '处理中')}><Play size={14} />开始办理</button> :
              <button className={button} disabled={mutation.isPending} onClick={() => handle(row.id, '已完成')}><Check size={14} />提交买方确认</button>}
            <button className={button} disabled={mutation.isPending} onClick={() => handle(row.id, '已拒绝')}><X size={14} />拒绝申请</button>
          </div>
        </div>}
        <button className={button} aria-expanded={selected === row.id} onClick={() => setSelected(selected === row.id ? null : row.id)}><History size={14} />办理历史</button>
        {selected === row.id && (history.isError ? <p role="alert">历史加载失败</p> : history.isPending ? <p role="status">加载历史中</p> :
          <ol className="space-y-2 text-sm">{history.data?.length === 0 && <li>暂无办理历史</li>}{history.data?.map(event => <li key={event.id} className="break-words">
            <time>{event.createdAt}</time> · {event.actorRole === 'buyer' ? '采购方' : '供应商'} · {event.fromStatus ?? '申请'} → {event.toStatus}
            {event.note && <p>{event.note}</p>}{event.evidenceNo && <p>凭据：{event.evidenceNo}</p>}
          </li>)}</ol>)}
      </article>)}
  </section>;
}
