import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, FileText, Lock, LockOpen, Plus, RotateCcw } from 'lucide-react';
import {
  useBuyerSupplierList,
  usePurchaseDemandList,
  useRfqAwardAward,
  useRfqCreate,
  useRfqAbort,
  useRfqList,
  useRfqOpen,
  useRfqStartNewRound,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill, cn } from '@24bid/ui';
import { QuoteComparisonTable } from './quote-comparison-table';
import { RfqClarificationsBuyer } from './rfq-clarifications';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const deadlinePassed = (deadlineAt?: string | null) =>
  deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;

const METHODS = ['公开招标', '邀请招标', '竞争性谈判', '询价', '单一来源'];
// 进行中可终止;终态显示终止类型。
const ABORTED_STATUS: Record<string, string> = { 已流标: '流标', 已废标: '废标' };

export function RfqsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rfqs = useRfqList();
  const approvedDemands = usePurchaseDemandList({ status: '已通过' });
  const admittedSuppliers = useBuyerSupplierList({ status: '已准入' });
  const create = useRfqCreate();
  const award = useRfqAwardAward();
  const open = useRfqOpen();
  const newRound = useRfqStartNewRound();
  const abort = useRfqAbort();
  const [roundForm, setRoundForm] = useState<{ rfqId: string; deadline: string; final: boolean } | null>(null);

  const [title, setTitle] = useState('');
  const [demandId, setDemandId] = useState('');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [evaluationMethod, setEvaluationMethod] = useState('最低价');
  const [method, setMethod] = useState('询价');
  const [quoteRequirement, setQuoteRequirement] = useState('');
  const [deliveryRequirement, setDeliveryRequirement] = useState('');

  const list = rfqs.data?.data ?? [];
  const demands = approvedDemands.data?.data ?? [];
  const suppliers = admittedSuppliers.data?.data ?? [];

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliers]);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(rfqs|demands)/.test(q.queryKey[0] as string),
    });

  const submitCreate = () => {
    create.mutate(
      {
        data: {
          title,
          demandIds: demandId ? [demandId] : [],
          invitedSupplierIds: supplierIds,
          deadlineAt: deadline ? `${deadline}T18:00:00+08:00` : undefined,
          evaluationMethod,
          method,
          quoteRequirement: quoteRequirement || undefined,
          deliveryRequirement: deliveryRequirement || undefined,
        },
      },
      {
        onSuccess: () => {
          setTitle('');
          setDemandId('');
          setSupplierIds([]);
          setDeadline('');
          setEvaluationMethod('最低价');
          setMethod('询价');
          setQuoteRequirement('');
          setDeliveryRequirement('');
          setShowForm(false);
          refresh();
        },
      },
    );
  };

  const submitAward = (rfqId: string, quoteId: string) => {
    award.mutate(
      { rfqId, data: { quoteId, reason: '含税总价与交期综合最优' } },
      { onSuccess: () => refresh() },
    );
  };

  const submitNewRound = () => {
    if (!roundForm || !roundForm.deadline) return;
    newRound.mutate(
      {
        rfqId: roundForm.rfqId,
        data: { deadlineAt: `${roundForm.deadline}T18:00:00+08:00`, finalRound: roundForm.final },
      },
      {
        onSuccess: () => {
          setRoundForm(null);
          refresh();
        },
      },
    );
  };

  const submitAbort = (rfqId: string, kind: '流标' | '废标') => {
    const reason = window.prompt(`请输入${kind}理由(将记录在案):`, '');
    if (reason === null) return;
    abort.mutate({ rfqId, data: { kind, reason } }, { onSuccess: () => refresh() });
  };

  const submitOpen = (rfqId: string, deadlineAt?: string) => {
    const passed = deadlinePassed(deadlineAt);
    if (!passed) {
      const ok = window.confirm('报价截止时间尚未到达。强制开标将提前结束报价收集，确认继续？');
      if (!ok) return;
    }
    open.mutate({ rfqId, data: { force: !passed } }, { onSuccess: () => refresh() });
  };

  const toggleSupplier = (id: string) =>
    setSupplierIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <Panel title="询价项目" icon={FileText} subtitle="RFQ 列表 · 邀请 · 比价定标">
      <div className="mb-4 flex items-center justify-between gap-2">
        <CountTag>共 {list.length} 条</CountTag>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> {showForm ? '收起' : '创建询价'}
        </button>
      </div>

      {showForm && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-sm font-black text-blue-800">创建询价(从已通过需求)</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">询价标题</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">关联需求(已通过)</label>
              <select className={inputCls} value={demandId} onChange={(e) => setDemandId(e.target.value)}>
                <option value="">选择需求</option>
                {demands.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">报价截止</label>
              <input
                className={inputCls}
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">评选方式</label>
              <select
                className={inputCls}
                value={evaluationMethod}
                onChange={(e) => setEvaluationMethod(e.target.value)}
              >
                <option value="最低价">最低价</option>
                <option value="综合评分">综合评分</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">采购方式</label>
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                {method === '单一来源' ? '需且仅邀请 1 家供应商。' : '须邀请不少于 3 家供应商。'}
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">报价要求</label>
              <textarea
                className={cn(inputCls, 'min-h-[64px] resize-y')}
                placeholder="如：报价含13%增值税专票，单价精确到分，报价有效期不少于30天。"
                value={quoteRequirement}
                onChange={(e) => setQuoteRequirement(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">交付要求</label>
              <textarea
                className={cn(inputCls, 'min-h-[64px] resize-y')}
                placeholder="如：到货地址、到货时限、质保期限与验收方式。"
                value={deliveryRequirement}
                onChange={(e) => setDeliveryRequirement(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="text-xs font-black text-slate-500">邀请供应商(已准入)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {suppliers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => s.supplierId && toggleSupplier(s.supplierId)}
                  className={cn(
                    'h-8 rounded-md border px-3 text-xs font-black transition',
                    s.supplierId && supplierIds.includes(s.supplierId)
                      ? 'border-blue-300 bg-blue-100 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {s.supplierName}
                </button>
              ))}
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="创建失败：需求需已通过且未关联其它询价。" />
            </div>
          )}
          <PrimaryActionButton
            onClick={submitCreate}
            busy={create.isPending}
            pendingLabel="创建中"
            disabled={!title || !demandId || supplierIds.length === 0}
          >
            创建询价
          </PrimaryActionButton>
        </div>
      )}

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载询价项目…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无询价项目，点击创建。" />
      ) : (
        <div className="space-y-3">
          {list.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{r.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{r.id}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.method && (
                    <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[11px] font-black text-sky-700">
                      {r.method}
                    </span>
                  )}
                  {(r.currentRound ?? 1) > 1 && (
                    <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-700">
                      第{r.currentRound}轮{r.finalRound ? '·最终' : ''}
                    </span>
                  )}
                  {r.status && <StatusPill label={r.status} />}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <MiniFact label="邀请供应商" value={String((r.invitedSupplierIds ?? []).length)} />
                <MiniFact label="收到报价" value={String((r.quotes ?? []).length)} />
                <MiniFact label="报价截止" value={r.deadlineAt?.slice(0, 10) ?? '—'} />
                <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
              </div>
              {(r.quoteRequirement || r.deliveryRequirement) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-black text-slate-400">报价要求</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {r.quoteRequirement || '未填写。'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-black text-slate-400">交付要求</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {r.deliveryRequirement || '未填写。'}
                    </p>
                  </div>
                </div>
              )}
              {ABORTED_STATUS[r.status ?? ''] && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
                  <p className="text-xs font-black text-red-700">
                    本询价已{ABORTED_STATUS[r.status ?? '']}
                  </p>
                  {r.closeReason && (
                    <p className="mt-0.5 text-[11px] font-bold text-red-600/80">理由:{r.closeReason}</p>
                  )}
                </div>
              )}

              {r.id && <RfqClarificationsBuyer rfqId={r.id} />}

              {r.status === '报价中' ? (
                // 封存:报价明细对采购方不可见,需开标后方可比价定标。
                <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <Lock size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-xs font-black text-amber-800">报价封存中</p>
                      <p className="mt-0.5 text-[11px] font-bold text-amber-700/80">
                        已收到 {(r.quotes ?? []).length} 家报价,报价明细在开标后可见。
                        {deadlinePassed(r.deadlineAt)
                          ? ' 截止已过,可直接开标。'
                          : ' 未到截止,可强制开标。'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => r.id && submitOpen(r.id, r.deadlineAt ?? undefined)}
                    disabled={open.isPending && open.variables?.rfqId === r.id}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400 sm:self-auto"
                  >
                    <LockOpen size={14} />
                    {open.isPending && open.variables?.rfqId === r.id
                      ? '开标中…'
                      : deadlinePassed(r.deadlineAt)
                        ? '开标'
                        : '强制开标'}
                  </button>
                  <button
                    type="button"
                    onClick={() => r.id && submitAbort(r.id, '流标')}
                    className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 sm:self-auto"
                  >
                    <Ban size={14} /> 流标
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(r.quotes ?? []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === r.id ? null : (r.id ?? null))}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                      >
                        <LockOpen size={13} />
                        {openId === r.id ? '收起比价' : '比价定标'}
                      </button>
                    )}
                    {r.status === '已开标' && !r.finalRound && (
                      <button
                        type="button"
                        onClick={() =>
                          r.id && setRoundForm({ rfqId: r.id, deadline: '', final: false })
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-violet-200 bg-white px-3 text-xs font-black text-violet-700 hover:bg-violet-50"
                      >
                        <RotateCcw size={13} /> 再次报价
                      </button>
                    )}
                    {r.status === '已开标' && (
                      <>
                        <button
                          type="button"
                          onClick={() => r.id && submitAbort(r.id, '流标')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
                        >
                          <Ban size={13} /> 流标
                        </button>
                        <button
                          type="button"
                          onClick={() => r.id && submitAbort(r.id, '废标')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
                        >
                          <Ban size={13} /> 废标
                        </button>
                      </>
                    )}
                  </div>
                  {openId === r.id && (
                    <div className="mt-3">
                      <QuoteComparisonTable
                        quotes={r.quotes ?? []}
                        supplierNames={supplierNames}
                        canAward={r.status === '已开标'}
                        awardingQuoteId={award.isPending ? (award.variables?.data.quoteId ?? null) : null}
                        onAward={(quoteId) => r.id && submitAward(r.id, quoteId)}
                      />
                      {r.status !== '已开标' && (
                        <p className="mt-2 text-xs font-bold text-slate-400">
                          当前状态「{r.status}」，定标入口仅在已开标时开放。
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {roundForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={() => setRoundForm(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-black text-slate-950">发起新一轮报价</p>
            <p className="mt-0.5 text-xs font-bold text-slate-400">
              将重新封存,受邀供应商在新一轮重新报价;评标只看最新一轮。
            </p>
            <div className="mt-4">
              <label className="text-xs font-black text-slate-500">新报价截止日期</label>
              <input
                type="date"
                className={inputCls}
                value={roundForm.deadline}
                onChange={(e) => setRoundForm({ ...roundForm, deadline: e.target.value })}
              />
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-700">
              <input
                type="checkbox"
                checked={roundForm.final}
                onChange={(e) => setRoundForm({ ...roundForm, final: e.target.checked })}
              />
              最终轮(BAFO · 最后一次报价机会)
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRoundForm(null)}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitNewRound}
                disabled={newRound.isPending || !roundForm.deadline}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
              >
                <RotateCcw size={14} /> {newRound.isPending ? '发起中…' : '确认发起'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
