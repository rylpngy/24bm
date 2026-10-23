import { useState } from 'react';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useBuyerNotificationList, useBuyerNotificationMarkRead } from '@24bid/api-client';

export function BuyerNotifications() {
  const query = useBuyerNotificationList({ limit: 200 });
  const markRead = useBuyerNotificationMarkRead();
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  const notices = query.data?.data ?? [];
  const pages = Math.max(1, Math.ceil(notices.length / 5));
  const current = Math.min(page, pages - 1);
  const button = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40';
  return (
    <section aria-label="站内通知" className="border-t border-slate-200 py-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Bell size={18} />站内通知</h2>
        <button type="button" className={button} aria-label="刷新通知" title="刷新通知" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={16} /></button>
      </div>
      {(query.isError || error) && <p role="alert" className="mt-3 text-sm text-red-600">{error || '通知加载失败，请重试。'}</p>}
      {query.isLoading ? <p className="py-4 text-sm text-slate-500">正在加载通知…</p> : !query.isError && notices.length === 0 ? <p className="py-4 text-sm text-slate-500">暂无通知</p> : (
        <ul className="mt-3 divide-y divide-slate-100">
          {notices.slice(current * 5, current * 5 + 5).map(notice => (
            <li key={notice.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-slate-900">{notice.title}</p>
                <p className="mt-1 break-all text-xs leading-5 text-slate-500">{notice.content}</p>
                <p className="mt-1 text-xs text-slate-400">{notice.createdAt?.slice(0, 16).replace('T', ' ')}</p>
              </div>
              {notice.read ? <span className="shrink-0 text-xs text-slate-400">已读</span> : (
                <button type="button" className={button} title="标为已读" aria-label={`标为已读：${notice.title}`} disabled={markRead.isPending || !notice.id} onClick={() => {
                  setError('');
                  markRead.mutate({ notificationId: notice.id! }, { onSuccess: () => void query.refetch(), onError: () => setError('标记已读失败，请重试。') });
                }}><CheckCheck size={16} /></button>
              )}
            </li>
          ))}
        </ul>
      )}
      {notices.length > 5 && <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-500">
        <span>最近 {notices.length} 条 · {current + 1}/{pages}</span>
        <button type="button" className={button} title="上一页通知" aria-label="上一页通知" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronLeft size={16} /></button>
        <button type="button" className={button} title="下一页通知" aria-label="下一页通知" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}><ChevronRight size={16} /></button>
      </div>}
    </section>
  );
}
