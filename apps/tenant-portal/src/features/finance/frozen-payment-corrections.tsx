import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customInstance } from '@24bid/api-client/http-client';
import { FeedbackNotice, Pagination } from '@24bid/ui';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from '../projects/project-dialog';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { financeErrorMessage } from './finance-feedback';

type Candidate = {
  entryId: string;
  amount: number;
  evidenceNo: string;
  projectId: string;
  sourcePeriod: string;
  targetPeriod: string;
  blockers: string[];
};
type Correction = {
  id: string;
  entryId: string;
  amount: number;
  sourcePeriod: string;
  targetPeriod: string;
  evidenceNo: string;
  reason: string;
  status: string;
  revision: number;
  createdBy: string;
  createdAt: string;
  completedBy?: string;
  reversalId?: string;
};
const labels: Record<string, string> = {
  submitted: '审批中',
  approved: '已批准并冲销',
  rejected: '已驳回',
  withdrawn: '已撤回',
};
export function FrozenPaymentCorrections({ invoiceId }: { invoiceId: string }) {
  const { can } = useBuyerPermissions(),
    client = useQueryClient(),
    base = `/api/v1/buyer/invoices/${encodeURIComponent(invoiceId)}/payment-ledger/corrections`;
  const [expanded, setExpanded] = useState(false),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Candidate | null>(null),
    [detail, setDetail] = useState<Correction | null>(null),
    [reviewing, setReviewing] = useState(false),
    [reason, setReason] = useState(''),
    [evidence, setEvidence] = useState(''),
    [withdrawReason, setWithdrawReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const keys = useRef(new Map<string, string>()),
    held = useRef(false);
  const candidates = useQuery({
    queryKey: [base + '/candidates'],
    queryFn: async () =>
      (
        await customInstance<{ data: Candidate[] }>({
          url: base + '/candidates',
          method: 'GET',
        })
      ).data,
    enabled: expanded,
  });
  const history = useQuery({
    queryKey: [base, { page }],
    queryFn: async () =>
      (
        await customInstance<{ data: { items: Correction[]; total: number } }>({
          url: base,
          method: 'GET',
          params: { page, pageSize: 10 },
        })
      ).data,
    enabled: expanded,
  });
  async function run(fn: () => Promise<unknown>) {
    if (held.current) return;
    held.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      setSelected(null);
      setDetail(null);
      setReviewing(false);
      await client.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === 'string' &&
          (/\/buyer\/(invoices|payment|contracts|budgets|projects)/.test(
            q.queryKey[0],
          ) ||
            q.queryKey[0].startsWith('project-lifecycle')),
      });
      setNotice('办理完成，付款及年度责任台账已更新。');
    } catch (e) {
      setError(financeErrorMessage(e, '办理失败，请重试'));
    } finally {
      setBusy(false);
      held.current = false;
    }
  }
  return (
    <section
      aria-label="跨年冻结付款更正"
      className="min-w-0 space-y-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-bold">跨年冻结付款更正</h3>
        <button
          type="button"
          className={btn}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          更正台账
        </button>
      </header>
      {expanded && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              className={btn}
              title="刷新更正台账"
              aria-label="刷新更正台账"
              onClick={() => {
                void candidates.refetch();
                void history.refetch();
              }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
          {(candidates.isError || history.isError) && (
            <FeedbackNotice
              tone="error"
              message="更正数据加载失败，请刷新或核对查看权限。"
            />
          )}
          {error && <FeedbackNotice tone="error" message={error} />}{' '}
          {notice && <FeedbackNotice tone="success" message={notice} />}
          {candidates.isLoading ? (
            <p role="status">加载冻结流水…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      '原付款凭据 / 流水',
                      '原责任年度 → 当前年度',
                      '整笔更正金额',
                      '操作',
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap px-3 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.data?.map((c) => (
                    <tr key={c.entryId} className="border-t border-slate-100">
                      <td className="max-w-60 break-words px-3 py-3">
                        {c.evidenceNo}
                        <span className="block text-xs text-slate-500">
                          {c.entryId}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {c.sourcePeriod || '待核对'} →{' '}
                        {c.targetPeriod || '待核对'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">
                        {money(c.amount)}
                      </td>
                      <td className="px-3 py-3">
                        {c.blockers.length
                          ? c.blockers.map((b) => (
                              <p
                                key={b}
                                className="max-w-64 break-words text-xs text-amber-700"
                              >
                                {b}
                              </p>
                            ))
                          : can('buyer:payment:reverse') && (
                              <button
                                type="button"
                                className={btn + ' whitespace-nowrap'}
                                onClick={() => {
                                  setSelected(c);
                                  setReason('');
                                  setEvidence('');
                                  setError('');
                                }}
                              >
                                申请更正
                              </button>
                            )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!candidates.isError &&
                !candidates.isLoading &&
                !candidates.data?.length && (
                  <p className="py-5 text-center text-sm text-slate-500">
                    暂无跨年冻结付款
                  </p>
                )}
            </div>
          )}
          <h4 className="border-t border-slate-100 pt-4 text-sm font-bold">
            更正记录
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['申请时间', '状态', '金额', '更正原因', '操作'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.data?.items.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-3 py-3 text-xs">
                      {r.createdAt?.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-3">
                      {labels[r.status] || r.status}
                    </td>
                    <td className="px-3 py-3">{money(r.amount)}</td>
                    <td className="truncate px-3 py-3" title={r.reason}>
                      {r.reason}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className={btn + ' whitespace-nowrap'}
                        onClick={() => {
                          setDetail(r);
                          setWithdrawReason('');
                          setError('');
                        }}
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!history.isError &&
              !history.isLoading &&
              !history.data?.items.length && (
                <p className="py-5 text-center text-sm text-slate-500">
                  暂无更正申请
                </p>
              )}
          </div>
          <Pagination
            page={page}
            pageSize={10}
            total={history.data?.total || 0}
            onPageChange={setPage}
          />
        </>
      )}
      {selected && !reviewing && (
        <ProjectDialog
          title="申请跨年冻结付款更正"
          onClose={() => !busy && setSelected(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim() && evidence.trim()) setReviewing(true);
            }}
          >
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">整笔冲销金额</dt>
                <dd className="font-bold">{money(selected.amount)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">责任年度</dt>
                <dd>
                  {selected.sourcePeriod} → {selected.targetPeriod}
                </dd>
              </div>
            </dl>
            <FeedbackNotice
              tone="info"
              message="批准后保留原付款，另记整笔反向流水。年度台账按更正后口径展示，当前承接年度恢复未付责任。此操作不发起银行退款，不支持部分金额或已归档合同更正。"
            />
            <label className="block text-sm">
              更正凭据号 <span className="text-red-600">*</span>
              <input
                aria-label="更正凭据号"
                className={input}
                required
                maxLength={200}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              更正原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="更正原因"
                className={input + ' h-24'}
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className={btn}
                disabled={busy || !reason.trim() || !evidence.trim()}
              >
                下一步
              </button>
            </div>
          </form>
        </ProjectDialog>
      )}
      {selected && reviewing && (
        <WorkflowSubmitDialog
          businessType="frozen_payment_correction"
          title="提交跨年冻结付款更正审批"
          busy={busy}
          submissionError={error}
          onClose={() => !busy && setReviewing(false)}
          onSubmit={(formData) =>
            void run(async () => {
              const body = {
                  entryId: selected.entryId,
                  evidenceNo: evidence.trim(),
                  reason: reason.trim(),
                  formData,
                },
                fingerprint = JSON.stringify(body);
              let requestKey = keys.current.get(fingerprint);
              if (!requestKey) {
                requestKey = crypto.randomUUID();
                keys.current.set(fingerprint, requestKey);
              }
              return customInstance({
                url: base,
                method: 'POST',
                data: { ...body, requestKey },
              });
            })
          }
        />
      )}
      {detail && (
        <ProjectDialog
          title="更正详情"
          onClose={() => !busy && setDetail(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="font-bold">
              {labels[detail.status]} · {money(detail.amount)}
            </p>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt>原责任年度</dt>
                <dd>{detail.sourcePeriod}</dd>
              </div>
              <div>
                <dt>办理时承接年度</dt>
                <dd>{detail.targetPeriod}</dd>
              </div>
            </dl>
            <p className="break-words">原流水：{detail.entryId}</p>
            <p className="break-words">更正凭据：{detail.evidenceNo}</p>
            <p className="whitespace-pre-wrap break-words">{detail.reason}</p>
            {detail.reversalId && (
              <p className="break-words">反向流水：{detail.reversalId}</p>
            )}
            {can('buyer:workflow:read') && (
              <WorkflowStatusPanel
                businessType="frozen_payment_correction"
                businessId={detail.id}
              />
            )}
            {detail.status === 'submitted' && can('buyer:payment:reverse') && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() =>
                    customInstance({
                      url: base + '/' + detail.id + '/withdraw',
                      method: 'POST',
                      data: { reason: withdrawReason.trim() },
                    }),
                  );
                }}
              >
                <label>
                  撤回原因
                  <textarea
                    aria-label="撤回更正原因"
                    className={input}
                    required
                    maxLength={1000}
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                  />
                </label>
                <button
                  type="submit"
                  className={btn}
                  disabled={busy || !withdrawReason.trim()}
                >
                  撤回本人更正申请
                </button>
              </form>
            )}
            {error && <FeedbackNotice tone="error" message={error} />}
          </div>
        </ProjectDialog>
      )}
    </section>
  );
}
