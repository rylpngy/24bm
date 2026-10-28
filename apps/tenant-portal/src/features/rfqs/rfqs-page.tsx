import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import {
  type RfqResponse,
  useBuyerSupplierList,
  usePurchaseDemandList,
  useRfqList,
} from '@24bid/api-client';
import {
  CountTag,
  FeedbackNotice,
  Pagination,
  Panel,
  SearchInput,
  cn,
} from '@24bid/ui';
import { RfqCreateWizard } from './rfq-create-wizard';
import { RfqProjectDetail } from './rfq-project-detail';

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
  const [resumeDraft, setResumeDraft] = useState<RfqResponse | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const closeDetail = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('recordId');
    window.history.replaceState(null, '', url);
    setSelectedId(null);
  };

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

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get('recordId');
    if (!selectedId && recordId && list.some((item) => item.id === recordId)) setSelectedId(recordId);
  }, [list, selectedId]);

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

  const demandBudgetOf = (rfq: RfqResponse) =>
    (allDemands.data?.data ?? [])
      .filter((demand) => rfq.demandIds?.includes(demand.id ?? ''))
      .reduce((sum, demand) => sum + (demand.budget ?? 0), 0);

  if (showForm) {
    return (
      <RfqCreateWizard
        demands={demands.filter((d) => !d.linkedRfqId)}
        suppliers={suppliers}
        resumeDraft={resumeDraft ?? undefined}
        onDone={(message) => {
          setShowForm(false);
          setResumeDraft(null);
          setFeedback(message);
          refresh();
        }}
        onCancel={() => {
          setShowForm(false);
          setResumeDraft(null);
          refresh();
        }}
      />
    );
  }

  if (selectedId) {
    const fresh = list.find((r) => r.id === selectedId);
    if (fresh) {
      return (
        <RfqProjectDetail
          rfq={fresh}
          budget={demandBudgetOf(fresh)}
          supplierNames={supplierNames}
          onBack={closeDetail}
          onResumeDraft={() => {
            setResumeDraft(fresh);
            closeDetail();
            setShowForm(true);
          }}
        />
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
          onClick={() => { setResumeDraft(null); void approvedDemands.refetch(); setShowForm(true); }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> 发起询价立项
        </button>
      </div>

      {feedback && (
        <div className="mb-3">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CountTag>共 {list.length} 条</CountTag>
        <CountTag>当前展示 {filtered.length} 条</CountTag>
        <CountTag>报价中 {list.filter((r) => r.status === '报价中').length} 条</CountTag>
        <CountTag>待定标 {list.filter((r) => r.status === '已开标').length} 条</CountTag>
      </div>

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
                    <p className="flex flex-wrap items-center gap-2 break-words font-black text-slate-950">
                      {r.title}
                      {(r.demandIds?.length ?? 0) > 0 &&
                        r.demandIds!.every((id) =>
                          (allDemands.data?.data ?? []).find((d) => d.id === id)?.source === '直录登记',
                        ) && (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-black text-amber-700">直接创建</span>
                        )}
                    </p>
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
