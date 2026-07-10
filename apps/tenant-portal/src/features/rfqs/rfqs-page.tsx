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
import {
  CountTag,
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  SearchInput,
  cn,
} from '@24bid/ui';
import { QuoteComparisonTable } from './quote-comparison-table';
import { RfqClarificationsBuyer } from './rfq-clarifications';
import { RfqResultBuyer } from './rfq-result';
import { RfqSupplierPerformance } from './rfq-supplier-performance';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const deadlinePassed = (deadlineAt?: string | null) =>
  deadlineAt ? new Date(deadlineAt).getTime() <= Date.now() : false;

const METHODS = ['询比', '竞价', '商城', '单一来源'];
const SUPPLIER_COLLECTION_METHODS = ['公开', '邀请'];
const STATUS_FILTERS = ['全部', '草稿', '报价中', '已开标', '定标审批中', '已定标', '已流标', '已废标'] as const;
const PAGE_SIZE = 6;

const statusTone = (status?: string | null) => {
  if (status === '报价中') return 'border-amber-100 bg-amber-50 text-amber-700';
  if (status === '已开标') return 'border-blue-100 bg-blue-50 text-blue-700';
  if (status === '定标审批中') return 'border-violet-100 bg-violet-50 text-violet-700';
  if (status === '已定标') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (status === '已流标' || status === '已废标') return 'border-red-100 bg-red-50 text-red-700';
  return 'border-slate-100 bg-slate-50 text-slate-600';
};

const methodTone = (method?: string | null) => {
  if (method === '竞价') return 'bg-amber-50 text-amber-700';
  if (method === '商城') return 'bg-emerald-50 text-emerald-700';
  if (method === '单一来源') return 'bg-violet-50 text-violet-700';
  return 'bg-blue-50 text-blue-700';
};

const deadlineText = (deadlineAt?: string | null) => deadlineAt?.slice(0, 10) ?? '—';

// 各采购方式定标门槛提示。
const awardGateHint = (method?: string, bidders = 0): string => {
  if (method === '商城') return '商城采购按商品目录/货架规则执行，不强制供应商报价定标。';
  if (method === '单一来源') return bidders >= 1 ? '单一来源已收到报价，可定标。' : '单一来源须有 1 家有效报价。';
  return bidders >= 3
    ? `已收到 ${bidders} 家有效报价,满足法定家数。`
    : `${method ?? '询比'}定标须不少于 3 家有效报价(当前 ${bidders} 家),否则应予流标。`;
};
// 进行中可终止;终态显示终止类型。
const ABORTED_STATUS: Record<string, string> = { 已流标: '流标', 已废标: '废标' };

export function RfqsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
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
  const [roundForm, setRoundForm] = useState<
    { rfqId: string; deadline: string; final: boolean; note: string; method?: string } | null
  >(null);

  const [title, setTitle] = useState('');
  const [demandId, setDemandId] = useState('');
  const [supplierIds, setSupplierIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState('');
  const [evaluationMethod, setEvaluationMethod] = useState('最低价');
  const [method, setMethod] = useState('询比');
  const [collectionMethod, setCollectionMethod] = useState('公开');
  const [quoteRequirement, setQuoteRequirement] = useState('');
  const [deliveryRequirement, setDeliveryRequirement] = useState('');
  // 竞价专属参数:起拍价(必填)与最小降价步长(选填)。
  const [auctionStartPrice, setAuctionStartPrice] = useState('');
  const [auctionMinDecrement, setAuctionMinDecrement] = useState('');

  const list = rfqs.data?.data ?? [];
  const demands = approvedDemands.data?.data ?? [];
  const suppliers = admittedSuppliers.data?.data ?? [];
  const filtered = list.filter((r) => {
    const statusMatched = status === '全部' || r.status === status;
    const kw = keyword.trim().toLowerCase();
    const keywordMatched =
      !kw ||
      [r.title, r.id, r.status, r.method, r.quoteRequirement, r.deliveryRequirement]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(kw);
    return statusMatched && keywordMatched;
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliers]);

  const supplierCollectionLabel =
    method === '商城' ? '目录采购' : method === '单一来源' ? '定向' : collectionMethod;
  const supplierSelectionRequired =
    method === '单一来源' || (method !== '商城' && collectionMethod === '邀请');
  const supplierRequirementMet =
    !supplierSelectionRequired || (method === '单一来源' ? supplierIds.length === 1 : supplierIds.length >= 3);
  const auctionParamsMet = method !== '竞价' || Number(auctionStartPrice) > 0;

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
          auctionStartPrice: method === '竞价' ? Number(auctionStartPrice) : undefined,
          auctionMinDecrement:
            method === '竞价' && auctionMinDecrement ? Number(auctionMinDecrement) : undefined,
          quoteRequirement: quoteRequirement || undefined,
          deliveryRequirement:
            [deliveryRequirement, `供应商征集方式：${supplierCollectionLabel}`].filter(Boolean).join('\n') || undefined,
        },
      },
      {
        onSuccess: () => {
          setTitle('');
          setDemandId('');
          setSupplierIds([]);
          setDeadline('');
          setEvaluationMethod('最低价');
          setMethod('询比');
          setCollectionMethod('公开');
          setQuoteRequirement('');
          setDeliveryRequirement('');
          setAuctionStartPrice('');
          setAuctionMinDecrement('');
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
        data: {
          deadlineAt: `${roundForm.deadline}T18:00:00+08:00`,
          finalRound: roundForm.final,
          note: roundForm.note || undefined,
        },
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
    setSupplierIds((cur) =>
      method === '单一来源' ? (cur.includes(id) ? [] : [id]) : cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const handleMethodChange = (value: string) => {
    setMethod(value);
    if (value === '商城') {
      setSupplierIds([]);
    } else if (value === '单一来源' && supplierIds.length > 1) {
      setSupplierIds(supplierIds.slice(0, 1));
    }
  };

  const handleCollectionMethodChange = (value: string) => {
    setCollectionMethod(value);
    if (value === '公开') {
      setSupplierIds([]);
    }
  };

  return (
    <Panel title="询比项目" icon={FileText} subtitle="询比列表 · 邀请 · 比价定标">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === status
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按标题 / 编号 / 方式 / 要求搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> {showForm ? '收起' : '创建询比'}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CountTag>共 {list.length} 条</CountTag>
        <CountTag>当前展示 {filtered.length} 条</CountTag>
        <CountTag>报价中 {list.filter((r) => r.status === '报价中').length} 条</CountTag>
        <CountTag>待定标 {list.filter((r) => r.status === '已开标').length} 条</CountTag>
      </div>

      {showForm && (
        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Plus size={18} />
            </span>
            <div>
              <p className="text-sm font-black text-blue-800">创建询比(从已通过需求)</p>
              <p className="mt-1 text-xs font-bold text-blue-700/70">选择采购需求、供应商与截止时间后发起报价邀请。</p>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500">询比标题</label>
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
              <select className={inputCls} value={method} onChange={(e) => handleMethodChange(e.target.value)}>
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">供应商征集方式</label>
              {method === '询比' || method === '竞价' ? (
                <select className={inputCls} value={collectionMethod} onChange={(e) => handleCollectionMethodChange(e.target.value)}>
                  {SUPPLIER_COLLECTION_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <div className={cn(inputCls, 'flex items-center text-slate-500')}>
                  {method === '商城' ? '目录采购' : '定向'}
                </div>
              )}
              <p className="mt-1 text-[11px] font-bold text-slate-400">
                {method === '商城'
                  ? '商城采购不按供应商征集方式执行。'
                  : method === '单一来源'
                    ? '单一来源须定向选择 1 家供应商。'
                    : collectionMethod === '公开'
                      ? `${method}公开征集，不预先限定供应商。`
                      : `${method}邀请征集，需选择不少于 3 家供应商。`}
              </p>
            </div>
          </div>
          {method === '竞价' && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-black text-slate-500">起拍价(元,必填)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  placeholder="如 100000"
                  value={auctionStartPrice}
                  onChange={(e) => setAuctionStartPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-black text-slate-500">最小降价步长(元,选填)</label>
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  placeholder="缺省 0,即只须低于当前最低价"
                  value={auctionMinDecrement}
                  onChange={(e) => setAuctionMinDecrement(e.target.value)}
                />
              </div>
            </div>
          )}
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
          {method !== '商城' && method !== '单一来源' && collectionMethod === '公开' && (
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
              当前为公开征集，创建项目时不限定具体供应商。
            </div>
          )}
          {supplierSelectionRequired && (
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
          )}
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="创建失败：需求需已通过且未关联其它询比项目。" />
            </div>
          )}
          <PrimaryActionButton
            onClick={submitCreate}
            busy={create.isPending}
            pendingLabel="创建中"
            disabled={!title || !demandId || !supplierRequirementMet || !auctionParamsMet}
          >
            创建询比
          </PrimaryActionButton>
        </div>
      )}

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载询比项目…" />
      ) : list.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无询比项目，点击创建。" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message="没有符合当前筛选条件的询比项目。" />
      ) : (
        <>
        <div className="space-y-3">
          {pageItems.map((r) => (
            <div
              key={r.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] font-black text-slate-500">
                      {r.id}
                    </span>
                    {r.method && (
                      <span className={cn('rounded-md px-2 py-1 text-[11px] font-black', methodTone(r.method))}>
                        {r.method}
                      </span>
                    )}
                    {(r.currentRound ?? 1) > 1 && (
                      <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-700">
                        第{r.currentRound}轮{r.finalRound ? ' · 最终' : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 break-words text-base font-black text-slate-950">{r.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    {r.evaluationMethod ?? '最低价'} · 报价截止 {deadlineText(r.deadlineAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.status && (
                    <span className={cn('rounded-lg border px-3 py-1 text-xs font-black', statusTone(r.status))}>
                      {r.status}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid gap-2 p-4 sm:grid-cols-4">
                <MiniFact label="邀请供应商" value={String((r.invitedSupplierIds ?? []).length)} />
                <MiniFact label="收到报价" value={String((r.quotes ?? []).length)} />
                <MiniFact label="报价截止" value={deadlineText(r.deadlineAt)} />
                <MiniFact label="评选方式" value={r.evaluationMethod ?? '最低价'} />
              </div>
              {(r.quoteRequirement || r.deliveryRequirement) && (
                <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
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
                <div className="mx-4 mb-4 rounded-lg border border-red-200 bg-red-50/60 p-3">
                  <p className="text-xs font-black text-red-700">
                    本询比已{ABORTED_STATUS[r.status ?? '']}
                  </p>
                  {r.closeReason && (
                    <p className="mt-0.5 text-[11px] font-bold text-red-600/80">理由:{r.closeReason}</p>
                  )}
                </div>
              )}

              {r.status === '已定标' && r.id && (
                <div className="px-4 pb-4">
                  <RfqResultBuyer rfqId={r.id} supplierNames={supplierNames} />
                </div>
              )}

              {r.id && (
                <div className="px-4 pb-4">
                  <RfqClarificationsBuyer rfqId={r.id} />
                </div>
              )}

              {r.status === '报价中' ? (
                // 封存:报价明细对采购方不可见,需开标后方可比价定标。
                <div className="mx-4 mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
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
                          r.id &&
                          setRoundForm({ rfqId: r.id, deadline: '', final: false, note: '', method: r.method ?? undefined })
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
                    <div className="mt-3 px-4 pb-4">
                      <div className="mb-2 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-[11px] font-bold text-sky-700">
                        {r.method ?? '采购方式'} · 定标门槛:{awardGateHint(r.method ?? undefined, (r.quotes ?? []).length)}
                      </div>
                      {r.method === '竞价' && (
                        <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] font-bold text-amber-700">
                          竞价规则:起拍价 ¥{r.auctionStartPrice?.toLocaleString('zh-CN') ?? '—'}
                          {' · '}最小降价步长 ¥{r.auctionMinDecrement?.toLocaleString('zh-CN') ?? '0'}
                          {' · '}当前最低报价 {r.auctionLowestAmount != null ? `¥${r.auctionLowestAmount.toLocaleString('zh-CN')}` : '暂无出价'}
                        </div>
                      )}
                      {r.id && <RfqSupplierPerformance rfqId={r.id} supplierNames={supplierNames} />}
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
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
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
            <div className="mt-3">
              <label className="text-xs font-black text-slate-500">
                轮次说明（可选）
              </label>
              <textarea
                className={cn(inputCls, 'min-h-[56px] resize-y')}
                placeholder="本轮谈判要点、让价要求等,记入审计留痕。"
                value={roundForm.note}
                onChange={(e) => setRoundForm({ ...roundForm, note: e.target.value })}
              />
            </div>
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
