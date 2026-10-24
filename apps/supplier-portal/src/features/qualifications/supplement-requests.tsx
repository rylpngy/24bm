import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { qualificationSupplements, replyQualificationSupplement, type SupplierQualificationResponse } from '@24bid/api-client';
import { FeedbackNotice, Pagination } from '@24bid/ui';

const states: Record<string, string> = { requested: '待补件', returned: '退回补正', submitted: '已提交待采购方审批', closed: '已完成', cancelled: '已取消' };
export function SupplementRequests({ qualifications, canManage }: { qualifications: SupplierQualificationResponse[]; canManage: boolean }) {
  const [page, setPage] = useState(1); const [selected, setSelected] = useState<string | null>(null);
  const [replacement, setReplacement] = useState(''); const [response, setResponse] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['/supplier/qualifications/supplements', page], queryFn: () => qualificationSupplements('supplier', page) });
  const rows = query.isError ? [] : query.data?.items ?? [];
  const current = rows.find(r => r.id === selected);
  const button = 'inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-bold disabled:opacity-40';
  return <section className="mb-5 space-y-3 border-b border-slate-200 pb-5" aria-label="采购方补件任务">
    <header className="flex items-center justify-between gap-3"><h3 className="text-sm font-bold">采购方补件任务</h3><button type="button" className={button} disabled={busy || query.isFetching} onClick={() => void query.refetch()}>刷新任务</button></header>
    {message && <p role="status" className="text-sm text-slate-600">{message}</p>}
    {query.isError ? <FeedbackNotice tone="error" message="补件任务加载失败，请刷新后重试。" /> : query.isLoading ? <p className="text-sm">正在加载补件任务…</p> : !rows.length ? <p className="text-sm text-slate-500">暂无采购方补件任务。</p> : <><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{['采购企业 / 证照', '补件要求', '期限', '状态', '操作'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(r => <tr key={r.id}><td className="p-3 font-bold">{r.tenantName}<p className="mt-1 text-xs font-normal">{r.qualificationType}</p></td><td className="max-w-72 p-3"><p className="truncate" title={r.reason}>{r.reason}</p>{r.response && <p className="mt-1 truncate text-xs text-slate-500" title={r.response}>回复：{r.response}</p>}</td><td className="whitespace-nowrap p-3">{r.dueDate}</td><td className="whitespace-nowrap p-3">{states[r.status]}</td><td className="p-3">{canManage && ['requested', 'returned'].includes(r.status) && <button type="button" className={button} disabled={busy} onClick={() => { setSelected(r.id); setReplacement(''); setResponse(''); setMessage(''); }}>提交补件回复</button>}</td></tr>)}</tbody></table></div><Pagination page={page} pageSize={10} total={query.data?.total ?? 0} onPageChange={p => { setPage(p); setSelected(null); }} /></>}
    {current && canManage && <form className="space-y-3 rounded-md border border-slate-200 p-4" onSubmit={e => { e.preventDefault(); if (busy) return; setBusy(true); setMessage(''); void replyQualificationSupplement(current.id, { replacementId: replacement, response: response.trim(), revision: current.revision }).then(() => { setSelected(null); setMessage('补件回复已提交，待采购企业审核；请在复核反馈中查看结论。'); return client.invalidateQueries({ predicate: q => String(q.queryKey[0]).includes('/supplier/qualifications') }); }).catch(e => setMessage((e as { response?: { data?: { message?: string } } }).response?.data?.message ?? '补件提交失败，请刷新后重试。')).finally(() => setBusy(false)); }}>
      <p className="whitespace-pre-wrap text-sm">{current.tenantName}：{current.reason}</p>
      <p className="text-xs text-slate-500">请先在下方证照台账变更原证照、上传并归档新版，再选择同一换证链的最新原件。不会覆盖其他采购企业的审核结论。</p>
      <label className="block text-sm font-bold">新版原件 *<select aria-label="补件新版原件" required disabled={busy} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 font-normal" value={replacement} onChange={e => setReplacement(e.target.value)}><option value="">请选择已归档的新版证照</option>{qualifications.filter(q => q.status === 'active' && q.id !== current.qualificationId && q.qualificationType === current.qualificationType).map(q => <option key={q.id} value={q.id}>{q.qualificationType} · {q.certificateNo || q.fileName}</option>)}</select></label>
      <label className="block text-sm font-bold">补件说明 *<textarea aria-label="补件回复说明" required maxLength={2000} disabled={busy} className="mt-1 min-h-24 w-full rounded-md border border-slate-200 p-3 font-normal" value={response} onChange={e => setResponse(e.target.value)} /></label>
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={() => setSelected(null)}>取消</button><button type="submit" className={button} disabled={busy}>确认提交补件</button></div>
    </form>}
  </section>;
}
