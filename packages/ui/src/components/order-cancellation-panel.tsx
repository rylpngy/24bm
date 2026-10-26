import { useState } from 'react';
import { XCircle, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';
import { Pagination } from './pagination';
interface Entry {
  id: string;
  status: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  completedBy?: string;
  completedAt?: string;
  response?: string;
}
interface State {
  data?: { blockers: string[]; items: Entry[]; total: number; actorId: string };
  loading: boolean;
  loadError: boolean;
  error: string;
  busy: boolean;
  page: number;
  setPage: (page: number) => void;
  refresh: () => unknown;
  act: (action: string, reason: string, id?: string) => Promise<boolean>;
}
const labels: Record<string, string> = {
  request: '申请取消订单',
  accept: '同意取消',
  reject: '拒绝取消',
  withdraw: '撤回本人申请',
  pending: '等待供应商确认',
  accepted: '双方已取消',
  rejected: '供应商已拒绝',
  withdrawn: '已撤回',
};
const button =
  'inline-flex h-9 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export function OrderCancellationPanel({
  state: s,
  supplier = false,
  canManage = false,
}: {
  state: State;
  supplier?: boolean;
  canManage?: boolean;
}) {
  const [action, setAction] = useState<{ kind: string; id?: string } | null>(
    null,
  );
  return (
    <section
      aria-label="订单取消协商"
      className="min-w-0 space-y-3 rounded-lg border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-slate-900">订单取消协商</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={button}
            onClick={() => void s.refresh()}
            title="刷新取消台账"
            aria-label="刷新取消台账"
          >
            <RefreshCw size={14} />
          </button>
          {!supplier && canManage && s.data && s.data.blockers.length === 0 && (
            <button
              type="button"
              className={button}
              onClick={() => setAction({ kind: 'request' })}
            >
              <XCircle size={14} />
              申请取消订单
            </button>
          )}
        </div>
      </div>
      {s.loading && <p className="text-sm text-slate-500">加载取消台账…</p>}
      {(s.loadError || s.error) && (
        <p role="alert" className="break-words text-sm text-red-600">
          {s.error || '取消台账加载失败，请刷新重试'}
        </p>
      )}
      {!supplier &&
        s.data?.blockers.map((b) => (
          <p key={b} className="text-xs text-slate-500">
            {b}
          </p>
        ))}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {['申请时间 / 发起人', '取消原因', '状态 / 回复', '操作'].map(
                (t) => (
                  <th className={'whitespace-nowrap px-3 py-2'+(t==='操作'?' sticky right-0 bg-slate-50':'')} key={t}>
                    {t}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {s.data?.items.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="w-44 max-w-44 px-3 py-3">
                  <p>{e.createdAt.slice(0, 19).replace('T', ' ')}</p>
                  <p className="mt-1 truncate text-slate-500" title={e.createdBy}>{e.createdBy}</p>
                </td>
                <td className="max-w-56 break-words px-3 py-3">{e.reason}</td>
                <td className="max-w-56 break-words px-3 py-3">
                  <p>{labels[e.status] || e.status}</p>
                  <p className="mt-1 text-slate-500">{e.response}</p>
                  {e.completedBy && (
                    <p className="mt-1 break-all text-slate-500">
                      {e.completedBy} ·{' '}
                      {e.completedAt?.slice(0, 19).replace('T', ' ')}
                    </p>
                  )}
                </td>
                <td className="sticky right-0 bg-white px-3 py-3">
                  <div className="flex flex-nowrap justify-end gap-2">
                    {canManage &&
                      e.status === 'pending' &&
                      (supplier
                        ? ['accept', 'reject']
                        : s.data?.actorId === e.createdBy
                          ? ['withdraw']
                          : []
                      ).map((kind) => (
                        <button
                          type="button"
                          key={kind}
                          className={button}
                          disabled={s.busy}
                          onClick={() => setAction({ kind, id: e.id })}
                        >
                          {labels[kind]}
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.data?.total === 0 && (
        <p className="py-3 text-center text-xs text-slate-500">暂无取消记录</p>
      )}
      <Pagination
        page={s.page}
        pageSize={10}
        total={s.data?.total || 0}
        onPageChange={s.setPage}
      />
      <ConfirmDialog
        open={!!action}
        title={labels[action?.kind || 'request']}
        message="仅处理未发货且无合同、发票的订单。申请期间暂停履约；双方确认后取消，保留原订单及操作记录。"
        tone={action?.kind === 'accept' ? 'danger' : 'primary'}
        input={{ label: '办理原因' }}
        busy={s.busy}
        onCancel={() => !s.busy && setAction(null)}
        onConfirm={(reason) => {
          if (action)
            void s.act(action.kind, reason, action.id).then((ok) => {
              if (ok) setAction(null);
            });
        }}
      />
      {action && s.error && (
        <div
          role="alert"
          className="fixed bottom-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {s.error}
        </div>
      )}
    </section>
  );
}
