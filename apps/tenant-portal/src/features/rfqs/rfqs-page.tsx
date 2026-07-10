import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import {
  type RfqResponse,
  useBuyerSupplierList,
  usePurchaseDemandList,
  useRfqCreate,
  useRfqList,
} from '@24bid/api-client';
import {
  CountTag,
  FeedbackNotice,
  Pagination,
  Panel,
  PrimaryActionButton,
  SearchInput,
  cn,
} from '@24bid/ui';
import { RfqProjectDetail } from './rfq-project-detail';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

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

// 进行中可终止;终态显示终止类型。
const ABORTED_STATUS: Record<string, string> = { 已流标: '流标', 已废标: '废标' };

// 列表「项目阶段」徽章:流程节点视角(报价对比/定标是流程一环)。
const stageLabelOf = (status?: string | null) =>
  status === '报价中' ? '接收报价'
    : status === '已开标' || status === '定标审批中' ? '定标决策'
      : status === '已定标' ? '已定标'
        : ABORTED_STATUS[status ?? ''] ? '已终止' : '接收报价';

export function RfqsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 竞价进行中时自动轮询(5s),竞价动态(最低价/截止顺延)即时可见。
  const rfqs = useRfqList(undefined, {
    query: {
      refetchInterval: (query) =>
        ((query.state.data?.data ?? []) as RfqResponse[]).some(
          (r) => r.method === '竞价' && r.status === '报价中',
        )
          ? 5_000
          : false,
    },
  });
  const approvedDemands = usePurchaseDemandList({ status: '已通过' });
  const allDemands = usePurchaseDemandList();
  const admittedSuppliers = useBuyerSupplierList({ status: '已准入' });
  const create = useRfqCreate();

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
  // 单一来源专属:来源说明(必填,审批留痕)。
  const [singleSourceReason, setSingleSourceReason] = useState('');

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
  const singleSourceReasonMet = method !== '单一来源' || singleSourceReason.trim().length > 0;

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
          singleSourceReason: method === '单一来源' ? singleSourceReason.trim() : undefined,
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
          setSingleSourceReason('');
          setShowForm(false);
          refresh();
        },
      },
    );
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

  const demandBudgetOf = (rfq: RfqResponse) =>
    (allDemands.data?.data ?? [])
      .filter((demand) => rfq.demandIds?.includes(demand.id ?? ''))
      .reduce((sum, demand) => sum + (demand.budget ?? 0), 0);

  if (selectedId) {
    const fresh = list.find((r) => r.id === selectedId);
    if (fresh) {
      return (
        <Panel title="询比项目" icon={FileText} subtitle="项目全流程:立项 · 报价 · 定标决策">
          <RfqProjectDetail
            rfq={fresh}
            budget={demandBudgetOf(fresh)}
            supplierNames={supplierNames}
            onBack={() => setSelectedId(null)}
          />
        </Panel>
      );
    }
  }

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
          {method === '单一来源' && (
            <div className="mt-3">
              <label className="text-xs font-black text-slate-500">来源说明(必填,审批留痕)</label>
              <textarea
                className={cn(inputCls, 'min-h-[64px] resize-y')}
                placeholder="说明定向选择该供应商的依据,如:原厂唯一授权服务商/专利技术唯一来源。"
                value={singleSourceReason}
                onChange={(e) => setSingleSourceReason(e.target.value)}
              />
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
            disabled={!title || !demandId || !supplierRequirementMet || !auctionParamsMet || !singleSourceReasonMet}
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
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">序号</th>
                <th className="px-4 py-3">项目编号</th>
                <th className="px-4 py-3">项目名称</th>
                <th className="px-4 py-3 text-right">预算</th>
                <th className="px-4 py-3">截止日期</th>
                <th className="px-4 py-3">项目阶段</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageItems.map((r, i) => (
                <tr key={r.id} className="hover:bg-blue-50/30">
                  <td className="px-4 py-4 font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs font-black text-slate-500">{r.id}</td>
                  <td className="px-4 py-4">
                    <p className="break-words font-black text-slate-950">{r.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      <span className={cn('mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-black', methodTone(r.method))}>
                        {r.method ?? '询比'}
                      </span>
                      {r.evaluationMethod ?? '最低价'}
                      {(r.currentRound ?? 1) > 1 && ` · 第${r.currentRound}轮${r.finalRound ? '(最终)' : ''}`}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-950">
                    ¥{demandBudgetOf(r).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-600">{deadlineText(r.deadlineAt)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {r.status && (
                        <span className={cn('rounded-md border px-2 py-1 text-[11px] font-black', statusTone(r.status))}>
                          {r.status}
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-black text-white',
                          ABORTED_STATUS[r.status ?? ''] ? 'bg-red-500' : 'bg-slate-900',
                        )}
                      >
                        {stageLabelOf(r.status)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id ?? null)}
                      className="h-8 rounded-md border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 hover:bg-blue-50"
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}

    </Panel>
  );
}
