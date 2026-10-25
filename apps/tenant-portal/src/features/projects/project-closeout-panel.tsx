import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, CalendarClock, RefreshCw, Square } from 'lucide-react';
import {
  projectMonitor,
  projectAdjustmentHistory,
  projectCloseoutAction,
  downloadReport,
  type ProcProject,
  type ProjectProgress,
  type ProjectAdjustment,
} from '@24bid/api-client';
import { FeedbackNotice, ConfirmDialog, Pagination } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from './project-dialog';
const names: Record<string, string> = {
  rework: '需求重新编制',
  cancel: '分包终止',
  terminate: '项目终止',
  milestone: '计划调整',
};
const error = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data
    ?.message || (e instanceof Error ? e.message : '操作失败，请重试。');
export function ProjectCloseoutPanel({
  project: p,
  onChanged,
}: {
  project: ProcProject;
  onChanged: () => Promise<void>;
}) {
  const { can } = useBuyerPermissions();
  const manage = p.status === 'approved' && can('buyer:project:manage');
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<{
      tone: 'error' | 'success';
      message: string;
    } | null>(null);
  const [action, setAction] = useState<{
      row: ProjectProgress;
      kind: 'rework' | 'stop';
    } | null>(null),
    [planning, setPlanning] = useState<ProjectProgress | null>(null),
    [key, setKey] = useState('demand'),
    [date, setDate] = useState(''),
    [reason, setReason] = useState(''),
    [detail, setDetail] = useState<ProjectAdjustment | null>(null);
  const monitor = useQuery({
    queryKey: ['project-monitor', p.id],
    queryFn: () => projectMonitor(p.id),
    enabled: expanded,
  });
  const history = useQuery({
    queryKey: ['project-adjustments', p.id, page],
    queryFn: () => projectAdjustmentHistory(p.id, page),
    enabled: expanded,
  });
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      setAction(null);
      setPlanning(null);
      await onChanged();
      setMessage({
        tone: 'success',
        message: '操作已完成，业务状态和预算占用已重新核验。',
      });
    } catch (e) {
      setMessage({ tone: 'error', message: error(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="min-w-0 space-y-4" aria-label="项目执行监控">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-base font-bold">执行监控与调整记录</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '收起执行监控' : '展开执行监控'}
          </button>
          {['closed', 'terminated'].includes(p.status) &&
            can('buyer:workflow:read') && (
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    downloadReport(
                      '/api/v1/buyer/projects/' +
                        encodeURIComponent(p.id) +
                        '/archive/download',
                      '项目档案.zip',
                    ),
                  )
                }
              >
                <Download size={14} />
                整项目档案
              </button>
            )}
        </div>
      </header>
      {message && <FeedbackNotice {...message} />}
      {expanded && (
        <>
          {monitor.isLoading && <p role="status">正在核验实际执行进度…</p>}
          {monitor.isError ? (
            <FeedbackNotice
              tone="error"
              message="执行监控加载失败或缺少源业务权限，请刷新重试。"
            />
          ) : (
            monitor.data && (
              <>
                <div className="flex flex-wrap gap-5 text-sm">
                  <span>
                    有效分包{' '}
                    {
                      monitor.data.packages.filter(
                        (r) => r.status !== 'cancelled',
                      ).length
                    }
                  </span>
                  <span>
                    已结项{' '}
                    {
                      monitor.data.packages.filter((r) => r.status === 'closed')
                        .length
                    }
                  </span>
                  <span
                    className={monitor.data.overdueCount ? 'text-red-600' : ''}
                  >
                    逾期节点 {monitor.data.overdueCount}
                  </span>
                  <span>
                    未分配批准金额 {money(monitor.data.unallocatedAmount)}
                  </span>
                  {monitor.data.changesPending && (
                    <span className="text-amber-700">
                      立项变更审批中，调整操作暂时冻结。
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1180px] table-fixed text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="w-56 p-3">分包</th>
                        {[
                          '需求审批',
                          '下发采购',
                          '生成订单',
                          '收货登记',
                          '净付款登记',
                          '结项归档',
                        ].map((t) => (
                          <th className="w-32 p-3" key={t}>
                            {t}
                          </th>
                        ))}
                        <th className="w-64 bg-slate-50 p-3 md:sticky md:right-0 md:z-10">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitor.data.packages.map((row) => (
                        <tr
                          key={row.packageId}
                          className="border-b border-slate-100"
                        >
                          <td
                            className="truncate p-3 font-bold"
                            title={row.title}
                          >
                            {row.title}
                            <p className="mt-1 font-normal text-slate-500">
                              {row.status === 'cancelled'
                                ? '已终止'
                                : row.status === 'closed'
                                  ? '已结项'
                                  : '办理中'}
                            </p>
                          </td>
                          {row.milestones.map((m) => (
                            <td key={m.key} className="p-3">
                              <span
                                title={m.evidence}
                                className={
                                  'whitespace-nowrap ' +
                                  (m.overdue
                                    ? 'text-red-600'
                                    : m.complete
                                      ? 'text-emerald-700'
                                      : 'text-slate-500')
                                }
                              >
                                {row.status === 'cancelled'
                                  ? '已终止'
                                  : m.complete
                                    ? '已完成'
                                    : m.overdue
                                      ? '已逾期'
                                      : '待办理'}
                              </span>
                              <p className="mt-1 whitespace-nowrap text-slate-400">
                                {m.dueDate || '未设计划'}
                              </p>
                            </td>
                          ))}
                          <td className="bg-white p-3 md:sticky md:right-0">
                            <div className="flex gap-2">
                              {manage &&
                                ['draft', 'ready'].includes(row.status) && (
                                  <>
                                    <button
                                      type="button"
                                      className={btn}
                                      title="设置计划节点日期"
                                      disabled={
                                        busy || monitor.data.changesPending
                                      }
                                      onClick={() => {
                                        setPlanning(row);
                                        setKey('demand');
                                        setDate(
                                          row.milestones[0]?.dueDate || '',
                                        );
                                        setReason('');
                                        setMessage(null);
                                      }}
                                    >
                                      <CalendarClock size={14} />
                                      计划
                                    </button>
                                    {can('buyer:demand:create') && (
                                      <>
                                        <button
                                          type="button"
                                          className={btn}
                                          title="未下发采购的需求退回草稿，必须重新审批"
                                          disabled={
                                            busy ||
                                            !row.canRework ||
                                            monitor.data.changesPending
                                          }
                                          onClick={() => {
                                            setAction({ row, kind: 'rework' });
                                            setMessage(null);
                                          }}
                                        >
                                          <RefreshCw size={14} />
                                          重编
                                        </button>
                                        <button
                                          type="button"
                                          className={btn}
                                          title="仅无订单且采购尚未下发或已流标废标可终止"
                                          disabled={
                                            busy ||
                                            !row.canStop ||
                                            monitor.data.changesPending
                                          }
                                          onClick={() => {
                                            setAction({ row, kind: 'stop' });
                                            setMessage(null);
                                          }}
                                        >
                                          <Square size={14} />
                                          终止
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {monitor.data.packages.length === 0 && (
                  <p className="text-sm text-slate-400">
                    暂无分包。原单执行仍在采购执行与结算中查看。
                  </p>
                )}
              </>
            )
          )}
          <h3 className="text-sm font-bold">调整历史</h3>
          {history.isError ? (
            <FeedbackNotice tone="error" message="调整记录读取失败，请重试。" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] table-fixed text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        '调整事项',
                        '原因',
                        '占用减少',
                        '办理人 / 时间',
                        '操作',
                      ].map((t) => (
                        <th key={t} className="p-3">
                          {t}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.data?.items.map((h) => (
                      <tr key={h.id} className="border-b border-slate-100">
                        <td className="p-3">{names[h.action] || h.action}</td>
                        <td className="truncate p-3" title={h.reason}>
                          {h.reason}
                        </td>
                        <td className="p-3">{money(h.releasedAmount)}</td>
                        <td className="truncate p-3" title={h.actorId}>
                          {h.actorName || h.actorId}
                          <p className="text-slate-400">
                            {new Date(h.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            className={btn}
                            onClick={() => setDetail(h)}
                          >
                            详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={10}
                total={history.data?.total || 0}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}
      {planning && (
        <ProjectDialog
          title="采购分包节点计划"
          busy={busy}
          onClose={() => setPlanning(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() =>
                projectCloseoutAction(p.id, planning.packageId, 'milestones', {
                  revision: planning.revision,
                  milestone: key,
                  dueDate: date,
                  reason,
                }),
              );
            }}
          >
            {message?.tone === 'error' && <FeedbackNotice {...message} />}
            <label className="block text-sm">
              计划节点
              <select
                aria-label="计划节点"
                className={input}
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setDate(
                    planning.milestones.find((m) => m.key === e.target.value)
                      ?.dueDate || '',
                  );
                }}
              >
                {planning.milestones.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              计划完成日期 *
              <input
                aria-label="计划完成日期"
                type="date"
                className={input}
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              调整原因 *
              <textarea
                aria-label="计划调整原因"
                className={input}
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <footer className="flex justify-end">
              <button type="submit" className={btn} disabled={busy}>
                保存计划
              </button>
            </footer>
          </form>
        </ProjectDialog>
      )}
      {detail && (
        <ProjectDialog title="业务调整记录" onClose={() => setDetail(null)}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            {[
              ['操作', names[detail.action]],
              ['办理人', detail.actorName || detail.actorId],
              ['时间', new Date(detail.createdAt).toLocaleString('zh-CN')],
              ['预算占用减少', money(detail.releasedAmount)],
              ['原因', detail.reason],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-400">{k}</dt>
                <dd className="mt-1 break-words">{v}</dd>
              </div>
            ))}
          </dl>
          <details>
            <summary className="cursor-pointer text-sm font-bold">
              处理前原始记录
            </summary>
            <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-all bg-slate-50 p-3 text-xs">
              {JSON.stringify(JSON.parse(detail.snapshot), null, 2)}
            </pre>
          </details>
        </ProjectDialog>
      )}
      <ConfirmDialog
        open={!!action}
        title={action?.kind === 'rework' ? '需求重新编制' : '终止采购分包'}
        message={
          message?.tone === 'error'
            ? message.message
            : action?.kind === 'rework'
              ? '仅未下发采购的分包可重编；由本人发起的在审需求会先真实撤回，再退回草稿，保留历史并重新审批。'
              : '仅未采购或无订单流标/废标执行可以终止；需求将取消并释放占用，原记录和审批历史保留。已有订单须在履约与财务中处理。'
        }
        input={{ label: '办理原因', minLength: 1 }}
        busy={busy}
        onCancel={() => setAction(null)}
        onConfirm={(reason) => {
          if (action)
            void run(() =>
              projectCloseoutAction(p.id, action.row.packageId, action.kind, {
                revision: action.row.revision,
                reason,
              }),
            );
        }}
      />
    </section>
  );
}
