import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useQualificationLedgerList, type QualificationLedgerRow } from '@24bid/api-client';
import { Pagination, ResponsiveTableFrame, SearchInput } from '@24bid/ui';

const labels: Record<string, string> = { expired: '已过期', expiring: '30天内到期', unknown: '未登记有效期', valid: '有效期超过30天' };
export function QualificationExpiryLedger({ onOpen }: { onOpen: (id: string) => void }) {
  const [state, setState] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const query = useQualificationLedgerList({ state, keyword, page, pageSize: 8 });
  const data = query.data?.data;
  const rows = data?.items ?? [];
  const details = (r: QualificationLedgerRow) => <button type="button" disabled={!r.relationId} onClick={() => r.relationId && onOpen(r.relationId)} className="h-8 shrink-0 whitespace-nowrap rounded-md border border-slate-200 px-3 text-xs font-bold text-blue-700">详情</button>;
  return <section aria-label="跨供应商到期台账" className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="到期状态" value={state} onChange={e => { setState(e.target.value); setPage(1); }} className="h-10 max-w-full rounded-lg border border-slate-200 bg-white px-3 text-sm">
        <option value="all">全部有效期</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select>
      <SearchInput placeholder="搜索供应商、资质类型或证号" onSearch={value => { setKeyword(value); setPage(1); }} />
      <button type="button" aria-label="刷新到期台账" title="刷新到期台账" disabled={query.isFetching} onClick={() => void query.refetch()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 disabled:opacity-50"><RefreshCw size={16} /></button>
    </div>
    <p className="text-xs text-slate-500">当前企业合作库的现行启用证照；历史换证与停用证照不计入。到期状态按北京时间计算。</p>
    {query.isError ? <p role="alert" className="text-sm text-red-700">到期台账加载失败，请刷新重试。</p> : query.isLoading ? <p className="text-sm text-slate-500">正在加载到期台账…</p> : rows.length === 0 ? <p className="text-sm text-slate-500">暂无符合条件的证照。</p> : <>
      <ResponsiveTableFrame mobileCards={rows.map(r => <div key={`${r.relationId}-${r.qualificationId}`} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
        <p className="break-words font-bold">{r.supplierName}</p><p className="break-words">{r.qualificationType} · {r.certificateNo || '无证号'}</p>
        <p>{r.expiresAt || '未登记有效期'} · {labels[r.expiryState ?? '']}</p><div className="flex items-center justify-between gap-2"><span>{r.relationStatus}</span>{details(r)}</div>
      </div>)}>
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">供应商 / 合作状态</th><th className="p-3">资质 / 证号</th><th className="w-44 p-3">有效期 / 状态</th><th className="w-24 p-3">操作</th></tr></thead>
          <tbody>{rows.map(r => <tr key={`${r.relationId}-${r.qualificationId}`} className="border-t border-slate-100"><td className="p-3"><p className="break-words font-bold">{r.supplierName}</p><p className="mt-1 text-xs text-slate-500">{r.relationStatus}</p></td><td className="p-3"><p className="break-words">{r.qualificationType}</p><p className="mt-1 break-all text-xs text-slate-500">{r.certificateNo || '无证号'}</p></td><td className="p-3"><p>{r.expiresAt || '—'}</p><p className={`mt-1 text-xs ${r.expiryState === 'expired' ? 'text-red-700' : 'text-slate-500'}`}>{labels[r.expiryState ?? '']}</p></td><td className="p-3">{details(r)}</td></tr>)}</tbody>
        </table>
      </ResponsiveTableFrame>
      <Pagination page={data?.page ?? page} pageSize={8} total={data?.total ?? 0} onPageChange={setPage} />
    </>}
  </section>;
}
