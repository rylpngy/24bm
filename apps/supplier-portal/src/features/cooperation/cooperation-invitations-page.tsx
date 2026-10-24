import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Mail, RefreshCw, X } from 'lucide-react';
import { listSupplierCooperationInvitations, respondSupplierCooperationInvitation, supplierCooperationInvitationsKey,
  type SupplierCooperationInvitation, type SupplierInvitationAction } from '@24bid/api-client';
import { ConfirmDialog, FeedbackNotice, FilterTabs, Pagination, Panel, StatusPill } from '@24bid/ui';

const buttonClass = 'inline-flex min-h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-3 py-2 text-sm font-bold disabled:opacity-50';
const statuses = ['待回复', '已接受', '已拒绝', '已撤回', '全部'];
function errorText(error: unknown) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '办理失败，请重试或刷新邀请。';
}
export function CooperationInvitationsPage({ canRead = false, canManage = false, accountKey = 'current' }: {
  canRead?: boolean; canManage?: boolean; accountKey?: string;
}) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: [...supplierCooperationInvitationsKey, accountKey], enabled: canRead,
    queryFn: async ({ signal }) => {
      const result = await listSupplierCooperationInvitations(signal);
      if (!Array.isArray(result.data)) throw new Error('邀请响应不完整');
      return result;
    } });
  const [filter, setFilter] = useState('待回复');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState('');
  const [target, setTarget] = useState<{ invitation: SupplierCooperationInvitation; action: SupplierInvitationAction } | null>(null);
  const lock = useRef(false);
  const mutation = useMutation({ mutationFn: ({ id, action }: { id: string; action: SupplierInvitationAction }) => respondSupplierCooperationInvitation(id, action),
    onSuccess: async (_result, variables) => {
      setTarget(null); setFeedback(variables.action === 'accept' ? '已接受合作邀请。新合作关系待采购方办理准入；已有关系状态保持不变。' : '已拒绝合作邀请。');
      await client.invalidateQueries({ queryKey: supplierCooperationInvitationsKey });
    }, onSettled: () => { lock.current = false; } });
  const all = query.isError ? [] : query.data?.data ?? [];
  const rows = all.filter(row => (filter === '全部' || row.status === filter)
    && [row.buyerName, row.note, row.category].filter(Boolean).join(' ').toLowerCase().includes(keyword.trim().toLowerCase()));
  const safePage = Math.min(page, Math.max(1, Math.ceil(rows.length / 8)));
  if (!canRead) return null;
  return <Panel title="合作邀请" icon={Mail} subtitle="">
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <FilterTabs items={statuses.map(id => ({ id, label: id }))} value={filter} onChange={id => { setFilter(id); setPage(1); }} />
      <label className="min-w-0 flex-1 text-xs font-bold text-slate-600">搜索采购企业<input value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} className="mt-1 h-9 w-full min-w-0 rounded-md border border-slate-200 px-3 text-sm" /></label>
      <button type="button" aria-label="刷新合作邀请" title="刷新合作邀请" disabled={query.isFetching || mutation.isPending} className={buttonClass} onClick={() => void query.refetch()}><RefreshCw size={16} /></button>
    </div>
    {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
    {mutation.isError && !target && <FeedbackNotice tone="error" message={errorText(mutation.error)} />}
    {query.isError ? <><FeedbackNotice tone="error" message="合作邀请加载失败，请重试。" /><button type="button" className={`${buttonClass} mt-3`} onClick={() => void query.refetch()}>重试</button></>
      : query.isPending ? <FeedbackNotice tone="info" message="正在加载合作邀请…" />
      : rows.length === 0 ? <p className="py-6 text-sm text-slate-500">暂无合作邀请符合当前筛选条件。</p>
      : <><ul className="divide-y divide-slate-200">{rows.slice((safePage - 1) * 8, safePage * 8).map(row => <li key={row.id} className="flex flex-col items-start justify-between gap-4 py-4 sm:flex-row">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="break-all text-sm font-bold">{row.buyerName}</h2><StatusPill label={row.status ?? '未知状态'} /></div>
          {row.category && <p className="mt-2 break-words text-xs text-slate-500">{row.category}</p>}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.note || '无邀请说明'}</p>
          <p className="mt-2 break-words text-xs text-slate-500">发起时间：{row.createdAt?.slice(0, 16).replace('T', ' ') ?? '—'}{row.respondedAt ? ` · 回复时间：${row.respondedAt.slice(0, 16).replace('T', ' ')}` : ''}</p>
        </div>
        {canManage && row.status === '待回复' && row.id && <div className="flex flex-wrap gap-2">{(['accept', 'decline'] as const).map(action => <button key={action} type="button" disabled={mutation.isPending || query.isFetching}
          className={`${buttonClass} ${action === 'accept' ? 'text-emerald-700' : 'text-red-600'}`} onClick={() => { mutation.reset(); setFeedback(''); setTarget({ invitation: row, action }); }}>
          {action === 'accept' ? <Check size={15} /> : <X size={15} />}{action === 'accept' ? '接受邀请' : '拒绝邀请'}</button>)}</div>}
      </li>)}</ul><Pagination page={safePage} pageSize={8} total={rows.length} onPageChange={setPage} /></>}
    <ConfirmDialog open={!!target && canManage && !query.isError} title={target?.action === 'accept' ? '接受合作邀请' : '拒绝合作邀请'}
      message={`${target?.invitation.buyerName ?? ''}：${target?.action === 'accept' ? '接受后新合作关系进入待准入，仍需采购方办理准入审批；已有关系状态不会重置。' : '确认拒绝本次合作邀请？'}${mutation.isError ? ` ${errorText(mutation.error)}` : ''}`}
      confirmLabel={target?.action === 'accept' ? '确认接受' : '确认拒绝'} tone={target?.action === 'accept' ? 'primary' : 'danger'}
      busy={mutation.isPending || query.isFetching} onCancel={() => { if (!lock.current) setTarget(null); }} onConfirm={() => {
        if (!canRead || !canManage || !target?.invitation.id || lock.current || mutation.isPending || query.isFetching || query.isError) return;
        if (!all.some(row => row.id === target.invitation.id && row.status === '待回复')) { setTarget(null); return; }
        lock.current = true; mutation.mutate({ id: target.invitation.id, action: target.action });
      }} />
  </Panel>;
}
