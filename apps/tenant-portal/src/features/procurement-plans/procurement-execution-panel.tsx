import { useRef, useState } from 'react';
import { Archive, Download, RefreshCw } from 'lucide-react';
import { downloadReport } from '@24bid/api-client';
import { createProcurementArchive, useProcurementExecution } from '@24bid/api-client/procurement-execution';
import { FeedbackNotice, StatusPill } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const readPermissions = ['demand', 'rfq', 'order', 'contract', 'receipt', 'invoice', 'workflow'].map(x => `buyer:${x}:read`);
const money = (value: number | null) => value == null ? '待核对' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const buttonStyle = 'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50';
const modules = new Set(['demands', 'rfqs', 'orders', 'contracts', 'receipts', 'invoices']);

export function ProcurementExecutionPanel({ rfqId }: { rfqId: string }) {
  const { can } = useBuyerPermissions();
  const readable = readPermissions.every(can);
  const query = useProcurementExecution(rfqId, readable);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string }>();
  const lock = useRef(false);
  const data = !query.isError ? query.data?.data : undefined;
  const perform = async (action: () => Promise<unknown>, message: string, refresh = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setFeedback(undefined);
    try { await action(); setFeedback({ tone: 'success', message }); if (refresh) { setRemark(''); await query.refetch(); } }
    catch (error) {
      let response = (error as { response?: { data?: unknown } })?.response?.data;
      if (response instanceof Blob) { try { response = JSON.parse(await response.text()); } catch { response = undefined; } }
      const message = (response as { message?: unknown })?.message;
      setFeedback({ tone: 'error', message: typeof message === 'string' ? message : '操作失败，请刷新核对后重试。' });
    } finally { lock.current = false; setBusy(false); }
  };
  return <section aria-label="项目执行与归档" className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-6">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
      <h3 className="flex items-center gap-2 text-base font-black text-slate-900"><Archive size={18} className="text-blue-600" />项目执行与归档</h3>
      {readable && <button className={buttonStyle} disabled={busy || query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={15} />刷新台账</button>}
    </header>
    {!readable ? <FeedbackNotice tone="info" message="查看完整执行台账需具备需求、询比、订单、合同、收货、财务及流程读取权限。" />
      : query.isError ? <FeedbackNotice tone="error" message="执行台账加载失败，请刷新后重试。" />
      : query.isPending || !data ? <p className="text-sm text-slate-500">正在加载执行台账…</p> : <>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-100 pb-4 lg:grid-cols-3">
          {[['需求预算', data.budgetAmount], ['订单金额', data.orderAmount], ['累计开票', data.invoicedAmount], ['净付款', data.paidAmount], ['未付金额', data.remainingAmount]].map(([label, value]) => <div key={label as string} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-all text-sm font-bold tabular-nums text-slate-900">{money(value as number | null)}</dd></div>)}
        </dl>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[540px] table-fixed text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr><th className="w-12 px-3 py-3">序号</th><th className="px-3 py-3">关联单据</th><th className="w-28 px-3 py-3">状态</th><th className="w-32 px-3 py-3 text-right">金额</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.documents.map((document, index) => <tr key={`${document.module}-${document.id}`}>
              <td className="px-3 py-3 text-slate-400">{index + 1}</td><td className="px-3 py-3"><a href={modules.has(document.module) ? `?module=${document.module}&recordId=${encodeURIComponent(document.recordId)}` : undefined} className="block truncate font-bold text-blue-700" title={document.label}>{document.label}</a></td>
              <td className="px-3 py-3"><StatusPill label={document.status} /></td><td className="px-3 py-3 text-right tabular-nums">{document.amount == null ? '—' : money(document.amount)}</td>
            </tr>)}{data.documents.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-slate-400">暂无关联单据</td></tr>}</tbody>
          </table>
        </div>
        <div className="mt-4 border-b border-slate-100 pb-4">
          <h4 className="text-sm font-bold text-slate-800">归档核查</h4>
          {data.blockers.length ? <ul className="mt-2 list-inside list-disc space-y-1 break-words text-xs leading-5 text-amber-800">{data.blockers.map((reason, i) => <li key={i}>{reason}</li>)}</ul> : <p className="mt-2 text-xs text-emerald-700">当前单据核查通过，可生成归档快照。</p>}
          {can('buyer:rfq:manage') && <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">归档说明<span className="ml-1 text-red-600">*</span><textarea aria-label="归档说明" value={remark} maxLength={1000} disabled={busy || !data.canArchive} onChange={e => setRemark(e.target.value)} className="mt-1 block min-h-20 w-full rounded-md border border-slate-200 p-2 text-sm font-normal disabled:bg-slate-50" /></label>
            <button className={buttonStyle} disabled={busy || query.isFetching || !data.canArchive || !remark.trim()} onClick={() => void perform(() => createProcurementArchive(rfqId, remark.trim()), '归档快照已生成。', true)}><Archive size={15} />生成归档快照</button>
          </div>}
        </div>
        <section className="mt-4"><h4 className="text-sm font-bold text-slate-800">归档记录</h4>
          {data.archives.length === 0 ? <p className="mt-2 text-xs text-slate-500">尚未归档</p> : <ol className="mt-2 divide-y divide-slate-100">{data.archives.map(archive => <li key={archive.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 text-xs"><p className={archive.stale ? 'text-amber-700' : 'text-emerald-700'}>{archive.stale ? '历史快照 · 当前数据已变化' : '已归档'}</p><p className="mt-1 break-all text-slate-500">{new Date(archive.createdAt).toLocaleString('zh-CN', { hour12: false })} · {archive.createdBy}</p><p className="mt-1 max-w-48 truncate font-mono text-[11px] text-slate-400" title={archive.sha256}>SHA256 {archive.sha256}</p></div>
            <button className={buttonStyle} disabled={busy} onClick={() => void perform(() => downloadReport(`/api/v1/buyer/rfqs/${encodeURIComponent(rfqId)}/execution/archives/${encodeURIComponent(archive.id)}/download`, '采购项目归档.zip'), '归档包已下载。')}><Download size={15} />下载归档包</button>
          </li>)}</ol>}
        </section>
      </>}
    {feedback && <div className="mt-3"><FeedbackNotice {...feedback} /></div>}
  </section>;
}
