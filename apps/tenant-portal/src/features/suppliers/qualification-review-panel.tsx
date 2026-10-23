import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import { qualificationReviews, decideQualificationReview, downloadReport } from '@24bid/api-client';
import { FilterTabs, Pagination } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const labels = { pending: '待复核', approved: '已通过', rejected: '已退回', superseded: '已被新版替代' };
export function QualificationReviewPanel({ relationId }: { relationId?: string }) {
  const { can } = useBuyerPermissions();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['/buyer/suppliers/qualification-reviews'], queryFn: () => qualificationReviews('buyer') });
  const [tab, setTab] = useState('pending');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const all = (query.data ?? []).filter(r => !relationId || r.relationId === relationId);
  const rows = all.filter(r => tab === 'pending' ? r.status === 'pending' : r.status !== 'pending');
  const currentPage = Math.min(page, Math.max(1, Math.ceil(rows.length / 6)));
  async function decide(id: number, approved: boolean) {
    if (submitting.current) return;
    if (!comment.trim()) { setMessage('请填写复核意见；退回时请明确需要补充的材料。'); return; }
    submitting.current = true; setBusy(true); setMessage('');
    try {
      await decideQualificationReview(id, approved, comment.trim());
      setSelected(null); setComment('');
      setMessage(approved ? '复核通过，已保留本企业的复核记录。' : '已退回，供应商可查看意见并重新换证提交。');
      await client.invalidateQueries({ queryKey: ['/buyer/suppliers/qualification-reviews'] });
    } catch (error) {
      setMessage((error as { response?: { data?: { message?: string } } }).response?.data?.message || '复核失败，请刷新后重试。');
      await query.refetch();
    } finally { submitting.current = false; setBusy(false); }
  }
  async function download(relation: string, id: string) {
    try { await downloadReport(`/api/v1/buyer/suppliers/${relation}/qualifications/${id}/download`, '资质原件'); }
    catch { setMessage('原件下载失败，请核实原件后再作复核结论。'); }
  }
  return <section className="mb-5 border-b border-slate-200 pb-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-sm font-bold text-slate-900">资质变更复核</h3>
      <button type="button" title="刷新复核" aria-label="刷新复核" disabled={query.isFetching || busy} className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 disabled:opacity-50" onClick={() => void query.refetch()}><RefreshCw size={15} /></button>
      <FilterTabs value={tab} items={[{ id: 'pending', label: '待复核', count: all.filter(r => r.status === 'pending').length }, { id: 'history', label: '复核记录' }]} onChange={id => { setTab(id); setPage(1); setSelected(null); }} />
    </div>
    {message && <p role="status" className="mb-3 text-sm text-slate-700">{message}</p>}
    {query.isLoading ? <p>正在加载复核记录…</p> : query.isError ? <p role="alert">复核记录加载失败。<button className="ml-2 text-blue-600" onClick={() => void query.refetch()}>重试</button></p> : rows.length === 0 ? <p className="text-sm text-slate-500">{tab === 'pending' ? '暂无待复核资质' : '暂无复核记录'}</p> : <>
      <ul className="divide-y divide-slate-100">
        {rows.slice((currentPage - 1) * 6, currentPage * 6).map(r => <li key={r.id} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-words text-sm font-bold">{r.supplierName} · {r.qualificationType}</p>
            <span className="text-xs text-slate-600">{labels[r.status]}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-blue-600">
            <button type="button" className="inline-flex items-center gap-1" onClick={() => void download(r.relationId, r.previousId)}><Download size={14} />旧版原件</button>
            <button type="button" className="inline-flex items-center gap-1" onClick={() => void download(r.relationId, r.qualificationId)}><Download size={14} />新版原件</button>
            {r.status === 'pending' && can('buyer:workflow:review') && <button type="button" disabled={busy || query.isError} onClick={() => { setSelected(r.id); setComment(''); setMessage(''); }}>办理复核</button>}
          </div>
          {r.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">复核意见：{r.comment}</p>}
          <p className="mt-2 text-xs text-slate-500">{r.reviewedAt ? `办理时间：${new Date(r.reviewedAt).toLocaleString('zh-CN')} · 办理人：${r.actorId}` : `提交时间：${new Date(r.createdAt).toLocaleString('zh-CN')}`}</p>
          {selected === r.id && r.status === 'pending' && <div className="mt-3 space-y-2">
            <label className="block text-sm">复核意见 <span className="text-red-600">*</span><textarea aria-label="资质复核意见" maxLength={2000} disabled={busy} value={comment} onChange={e => setComment(e.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-2" /></label>
            <div className="flex flex-wrap gap-2">
              <button disabled={busy} onClick={() => void decide(r.id, true)} className="h-9 rounded-md bg-blue-600 px-3 text-sm text-white disabled:opacity-50">确认通过</button>
              <button disabled={busy} onClick={() => void decide(r.id, false)} className="h-9 rounded-md border border-red-200 px-3 text-sm text-red-700 disabled:opacity-50">退回补件</button>
              <button disabled={busy} onClick={() => setSelected(null)} className="h-9 px-3 text-sm text-slate-600">取消</button>
            </div>
          </div>}
        </li>)}
      </ul><Pagination page={currentPage} pageSize={6} total={rows.length} onPageChange={setPage} />
    </>}
  </section>;
}
