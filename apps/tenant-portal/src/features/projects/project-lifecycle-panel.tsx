import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock, FileCheck2, RefreshCw } from 'lucide-react';
import {
  projectLifecyclePreview,
  projectLifecycleHistory,
  projectLifecycleSubmit,
  projectLifecycleWithdraw,
  type ProjectLifecycleKind,
  type ProjectLifecycleRecord,
  type ProcProject,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from './project-dialog';

const names = { carryover: '跨年度承接', liquidation: '已有订单终止清算' };
const states = {
  submitted: '审批中',
  approved: '已批准',
  rejected: '已驳回',
  withdrawn: '已撤回',
};
const error = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } }).response?.data
    ?.message || (e instanceof Error ? e.message : '操作失败，请重试');

export function ProjectLifecyclePanel({
  project: p,
  onChanged,
}: {
  project: ProcProject;
  onChanged: () => Promise<void>;
}) {
  const { can } = useBuyerPermissions();
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(1);
  const [kind, setKind] = useState<ProjectLifecycleKind | null>(null),
    [selected, setSelected] = useState<ProjectLifecycleRecord | null>(null);
  const [target, setTarget] = useState(''),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [notice, setNotice] = useState<{
    tone: 'error' | 'success';
    message: string;
  } | null>(null);
  const preview = useQuery({
    queryKey: ['project-lifecycle-preview', p.id, p.revision],
    queryFn: () => projectLifecyclePreview(p.id),
    enabled: expanded,
  });
  const history = useQuery({
    queryKey: ['project-lifecycle-history', p.id, page, p.revision],
    queryFn: () => projectLifecycleHistory(p.id, page),
    enabled: expanded,
  });
  const manage = p.status === 'approved' && can('buyer:project:manage');
  const annual = Object.values(
    (preview.data?.sources || []).reduce<
      Record<
        string,
        {
          period: string;
          committed: number;
          pending: number;
          paid: number | null;
        }
      >
    >((rows, s) => {
      const r = (rows[s.period] ||= {
        period: s.period,
        committed: 0,
        pending: 0,
        paid: 0,
      });
      r.committed += s.committed;
      r.pending += s.pending;
      r.paid =
        r.paid === null || s.paidAmount === null ? null : r.paid + s.paidAmount;
      return rows;
    }, {}),
  ).sort((a, b) => a.period.localeCompare(b.period));
  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      setKind(null);
      setReviewing(false);
      setSelected(null);
      await onChanged();
      await preview.refetch();
      await history.refetch();
      setNotice({
        tone: 'success',
        message: '操作已完成，年度责任及流程记录已更新。',
      });
    } catch (e) {
      setNotice({ tone: 'error', message: error(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="min-w-0 space-y-4" aria-label="跨年度承接与终止清算">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <h2 className="text-base font-bold">跨年度承接与终止清算</h2>
        <button
          type="button"
          className={btn}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? '收起办理台账' : '展开办理台账'}
        </button>
      </header>
      {notice && <FeedbackNotice {...notice} />}
      {expanded && (
        <>
          {(preview.isError || history.isError) && (
            <FeedbackNotice
              tone="error"
              message="业务核验或台账加载失败，请刷新重试；也请检查预算、合同、订单和流程查看权限。"
            />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>立项年度 {p.period}</span>
              <ArrowRight size={14} />
              <strong>
                当前责任年度 {preview.data?.effectivePeriod || '待核验'}
              </strong>
              <span className="text-slate-500">
                预算占用 {preview.data ? money(preview.data.amount) : '待核验'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                title="刷新核验"
                className={btn}
                onClick={() => {
                  void preview.refetch();
                  void history.refetch();
                }}
              >
                <RefreshCw size={14} />
              </button>
              {manage &&
                (['carryover', 'liquidation'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={btn}
                    disabled={
                      busy ||
                      !preview.data ||
                      preview.isError ||
                      history.isError
                    }
                    onClick={() => {
                      setReason('');
                      setTarget(
                        String(
                          Math.max(
                            Number(preview.data?.effectivePeriod || p.period) +
                              1,
                            new Date().getFullYear(),
                          ),
                        ),
                      );
                      setKind(k);
                    }}
                  >
                    {k === 'carryover' ? (
                      <CalendarClock size={14} />
                    ) : (
                      <FileCheck2 size={14} />
                    )}
                    申请{names[k]}
                  </button>
                ))}
            </div>
          </div>
          {preview.data && (
            <>
              <dl className="grid grid-cols-1 gap-4 border-y border-slate-200 py-4 sm:grid-cols-3">
                {[
                  ['累计预算责任', preview.data.amount],
                  ['已核实净付款', preview.data.paidAmount],
                  ['拟承接未支付责任', preview.data.transferAmount],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="mt-1 font-semibold">
                      {money(typeof value === 'number' ? value : null)}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table
                  className="w-full min-w-[460px] text-left text-sm"
                  aria-label="逐年预算责任分摊"
                >
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      {[
                        '责任年度',
                        '待批占用',
                        '已确认责任',
                        '已核实净付款',
                      ].map((h) => (
                        <th
                          key={h}
                          className="whitespace-nowrap px-4 py-3 font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {annual.map((a) => (
                      <tr key={a.period} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-3">
                          {a.period}
                          {a.period === preview.data?.effectivePeriod
                            ? ' · 当前'
                            : ' · 历史'}
                        </td>
                        <td className="px-4 py-3">{money(a.pending)}</td>
                        <td className="px-4 py-3">{money(a.committed)}</td>
                        <td className="px-4 py-3">
                          {money(
                            preview.data?.paidAmount === null ? null : a.paid,
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {annual.length === 0 && (
                  <p className="p-4 text-sm text-slate-500">
                    暂无已占用的年度预算责任
                  </p>
                )}
              </div>
            </>
          )}
          {history.isLoading ? (
            <p className="text-sm text-slate-500">加载台账…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[680px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-44" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col />
                  <col className="w-20" />
                </colgroup>
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {['业务类型', '责任年度', '状态', '申请原因', '操作'].map(
                      (x) => (
                        <th key={x} className="px-4 py-3 font-medium">
                          {x}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {history.data?.items.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">{names[r.kind]}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {r.sourcePeriod} → {r.targetPeriod}
                      </td>
                      <td className="px-4 py-3">{states[r.status]}</td>
                      <td className="truncate px-4 py-3" title={r.reason}>
                        {r.reason}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className={btn + ' whitespace-nowrap'}
                          onClick={() => {
                            setReason('');
                            setSelected(r);
                          }}
                        >
                          详情
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!history.data?.items.length && !history.isError && (
                <p className="p-6 text-center text-sm text-slate-500">
                  暂无承接或清算申请
                </p>
              )}
            </div>
          )}
          <Pagination
            page={page}
            pageSize={10}
            total={history.data?.total || 0}
            onPageChange={setPage}
          />
        </>
      )}
      {kind && !reviewing && (
        <ProjectDialog
          title={'申请' + names[kind]}
          onClose={() => !busy && setKind(null)}
        >
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500">立项年度（不改写）</dt>
                <dd className="mt-1 font-semibold">{p.period}</dd>
              </div>
              <div>
                <dt className="text-slate-500">当前责任年度</dt>
                <dd className="mt-1 font-semibold">
                  {preview.data?.effectivePeriod}
                </dd>
              </div>
            </dl>
            {(kind === 'carryover'
              ? preview.data?.carryoverBlockers
              : preview.data?.liquidationBlockers
            )?.map((b) => (
              <FeedbackNotice key={b} tone="error" message={b} />
            ))}
            <FeedbackNotice
              tone="info"
              message={
                kind === 'carryover'
                  ? '原年度已付款保留在原责任年度，仅将未支付责任承接至新年度；后续付款计入当前责任年度。原项目、需求、订单日期和年度预算额度不改写，已冻结付款不能直接冲销。'
                  : '保留原订单、收货、发票、付款及合同记录，独立审批后终止项目。未收货、未退款、发票不一致或合同未结清时不能办理。'
              }
            />
            {kind === 'carryover' && (
              <label className="block text-sm font-medium">
                承接年度 <span className="text-red-600">*</span>
                <input
                  aria-label="承接年度"
                  className={input + ' mt-2'}
                  inputMode="numeric"
                  maxLength={4}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </label>
            )}
            <label className="block text-sm font-medium">
              申请原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="申请原因"
                className={input + ' mt-2 min-h-24'}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {notice?.tone === 'error' && <FeedbackNotice {...notice} />}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={btn}
                disabled={busy}
                onClick={() => setKind(null)}
              >
                取消
              </button>
              <button
                type="button"
                className={btn}
                disabled={
                  busy ||
                  !reason.trim() ||
                  (kind === 'carryover' && !/^20\d{2}$/.test(target)) ||
                  !!(kind === 'carryover'
                    ? preview.data?.carryoverBlockers.length
                    : preview.data?.liquidationBlockers.length)
                }
                onClick={() => {
                  setNotice(null);
                  setReviewing(true);
                }}
              >
                提交审批
              </button>
            </div>
          </div>
        </ProjectDialog>
      )}
      {kind && reviewing && (
        <WorkflowSubmitDialog
          businessType={'project_' + kind}
          title={names[kind]}
          busy={busy}
          submissionError={
            notice?.tone === 'error' ? new Error(notice.message) : undefined
          }
          onClose={() => !busy && setReviewing(false)}
          onSubmit={(formData) =>
            void run(() =>
              projectLifecycleSubmit(p.id, {
                revision: p.revision,
                kind,
                targetPeriod: kind === 'carryover' ? target : undefined,
                reason: reason.trim(),
                formData,
              }),
            )
          }
        >
          <p className="text-sm">{reason}</p>
        </WorkflowSubmitDialog>
      )}
      {selected && (
        <ProjectDialog
          title={names[selected.kind] + '详情'}
          onClose={() => !busy && setSelected(null)}
        >
          <div className="space-y-4">
            <p className="text-sm">
              {selected.sourcePeriod} → {selected.targetPeriod} ·{' '}
              {states[selected.status]} · {money(selected.amount)}
            </p>
            <p className="whitespace-pre-wrap break-words text-sm">
              {selected.reason}
            </p>
            {can('buyer:workflow:read') && (
              <WorkflowStatusPanel
                businessType={'project_' + selected.kind}
                businessId={selected.id}
              />
            )}
            {selected.status === 'submitted' && can('buyer:project:manage') && (
              <div className="space-y-2">
                <label className="block text-sm">
                  撤回原因
                  <textarea
                    aria-label="撤回原因"
                    className={input + ' mt-2'}
                    maxLength={1000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className={btn}
                  disabled={busy || !reason.trim()}
                  onClick={() =>
                    void run(() =>
                      projectLifecycleWithdraw(
                        p.id,
                        selected.id,
                        selected.revision,
                        reason.trim(),
                      ),
                    )
                  }
                >
                  撤回本人申请
                </button>
              </div>
            )}
            {notice?.tone === 'error' && <FeedbackNotice {...notice} />}
          </div>
        </ProjectDialog>
      )}
    </section>
  );
}
