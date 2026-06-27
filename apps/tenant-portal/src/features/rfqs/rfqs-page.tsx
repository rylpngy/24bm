import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import {
  useBuyerSupplierList,
  usePurchaseDemandList,
  useRfqAwardAward,
  useRfqCreate,
  useRfqList,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  MiniFact,
  Panel,
  PrimaryActionButton,
  StatusPill,
  cn,
} from '@24bid/ui';
import { QuoteComparisonTable } from './quote-comparison-table';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export function RfqsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const rfqs = useRfqList();
  const approvedDemands = usePurchaseDemandList({ status: '已通过' });
  const admittedSuppliers = useBuyerSupplierList({ status: '已准入' });
  const create = useRfqCreate();
  const award = useRfqAwardAward();

  const [title, setTitle] = useState('');
  const [demandId, setDemandId] = useState('');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [evaluationMethod, setEvaluationMethod] = useState('最低价');
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

  const toggleSupplier = (id: string) =>
    setSupplierIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <Panel title="询价项目" icon={FileText} subtitle="RFQ 列表 · 邀请 · 比价定标">
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-500">
          共 {list.length} 条
        </span>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
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
                {r.status && <StatusPill label={r.status} />}
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
              {(r.quotes ?? []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenId(openId === r.id ? null : (r.id ?? null))}
                  className="mt-3 inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                >
                  {openId === r.id ? '收起比价' : '比价定标'}
                </button>
              )}
              {openId === r.id && (
                <div className="mt-3">
                  <QuoteComparisonTable
                    quotes={r.quotes ?? []}
                    supplierNames={supplierNames}
                    canAward={r.status === '报价中'}
                    awardingQuoteId={award.isPending ? (award.variables?.data.quoteId ?? null) : null}
                    onAward={(quoteId) => r.id && submitAward(r.id, quoteId)}
                  />
                  {r.status !== '报价中' && (
                    <p className="mt-2 text-xs font-bold text-slate-400">
                      当前状态「{r.status}」，定标入口仅在报价中开放。
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
