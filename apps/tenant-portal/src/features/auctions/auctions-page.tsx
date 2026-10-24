import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, CheckCircle2, Gavel, LockOpen, Plus, Timer, TrendingDown, Trophy, Zap } from 'lucide-react';
import {
  type RfqResponse,
  useBuyerSupplierList,
  usePurchaseDemandList,
  useRfqAbort,
  useRfqList,
  useRfqOpen,
  useAuctionStream,
} from '@24bid/api-client';
import {
  ConfirmDialog,
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';
import { RfqCreateWizard } from '../rfqs/rfq-create-wizard';
import { useAuthStore } from '../../lib/auth-store';

const currency = (v?: number | null) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const PAGE_SIZE = 8;

// 竞价阶段(映射真实 RFQ 状态):竞价立项→邀请供应商→发布竞价→正式竞价→结果确认。
const STAGES = ['竞价立项', '邀请供应商', '发布竞价', '正式竞价', '结果确认'] as const;

const stageOf = (rfq: RfqResponse): { index: number; label: string; tone: string } => {
  const s = rfq.status ?? '';
  if (s === '草稿') {
    return (rfq.invitedSupplierIds ?? []).length > 0
      ? { index: 2, label: '发布竞价', tone: 'bg-blue-50 text-blue-700' }
      : { index: 1, label: '邀请供应商', tone: 'bg-slate-100 text-slate-600' };
  }
  if (s === '报价中') return { index: 3, label: '正式竞价', tone: 'bg-amber-100 text-amber-700' };
  if (s === '已开标' || s === '定标审批中') return { index: 4, label: '结果确认', tone: 'bg-violet-100 text-violet-700' };
  if (s === '已定标') return { index: 5, label: '已完成', tone: 'bg-emerald-100 text-emerald-700' };
  return { index: 5, label: '已终止', tone: 'bg-red-100 text-red-700' };
};

function useCountdown(deadlineAt?: string | null, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  if (!deadlineAt) return '--:--';
  const ms = new Date(deadlineAt).getTime() - now;
  if (ms <= 0) return '00:00';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// 价格趋势:按出价时间推进的全场最低价阶梯(真实报价序列),内联 SVG 无依赖。
function PriceTrend({ points }: { points: { t: number; low: number }[] }) {
  if (points.length < 2) {
    return <p className="text-xs font-bold text-slate-400">出价满 2 笔后展示价格趋势。</p>;
  }
  const w = 560;
  const h = 120;
  const pad = 8;
  const minT = points[0].t;
  const maxT = points[points.length - 1].t;
  const lows = points.map((p) => p.low);
  const minL = Math.min(...lows);
  const maxL = Math.max(...lows);
  const x = (t: number) => pad + ((t - minT) / Math.max(1, maxT - minT)) * (w - pad * 2);
  const y = (v: number) => pad + ((maxL - v) / Math.max(1, maxL - minL)) * (h - pad * 2);
  // 阶梯线:每次刷新最低价时水平推进后垂直下探。
  let d = `M ${x(points[0].t)} ${y(points[0].low)}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${x(points[i].t)} ${y(points[i - 1].low)} L ${x(points[i].t)} ${y(points[i].low)}`;
  }
  d += ` L ${w - pad} ${y(points[points.length - 1].low)}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" role="img" aria-label="价格趋势阶梯图">
      <path d={`${d} L ${w - pad} ${h - pad} L ${x(points[0].t)} ${h - pad} Z`} fill="rgb(16 185 129 / 0.08)" stroke="none" />
      <path d={d} fill="none" stroke="rgb(16 185 129)" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

// 竞价采购:竞价项目台账 + 竞价立项(预设方式)+ 实时竞价台(出价流/排行/趋势)。
export function AuctionsPage({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [stageFilter, setStageFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<'open-early' | 'no-bid' | null>(null);

  // G-1 竞价实时推送:SSE 通道畅通时由服务端事件驱动刷新;断流回落 5s 轮询(改造前行为)。
  const token = useAuthStore((s) => s.session?.token);
  const [live, setLive] = useState(false);
  const rfqsQuery = useRfqList(undefined, {
    query: {
      refetchInterval: (query) =>
        !live
        && ((query.state.data?.data ?? []) as RfqResponse[]).some(
          (r) => r.method === '竞价' && r.status === '报价中',
        )
          ? 5_000
          : false,
    },
  });
  const hasLiveAuction = (rfqsQuery.data?.data ?? []).some(
    (r) => r.method === '竞价' && r.status === '报价中',
  );
  const onAuctionEvent = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (q.queryKey[0] as string).includes('/buyer/rfqs'),
    });
  }, [queryClient]);
  const stream = useAuctionStream({
    scope: 'buyer', token, enabled: hasLiveAuction, onEvent: onAuctionEvent,
  });
  useEffect(() => setLive(stream.live), [stream.live]);
  // 立项候选:仅「已通过」审批的需求;供应商仅「已准入」(后端邀请守卫同口径,未准入选了也会被拒)。
  const demandsQuery = usePurchaseDemandList({ status: '已通过' });
  const suppliersQuery = useBuyerSupplierList({ status: '已准入' });
  const open = useRfqOpen();
  const abort = useRfqAbort();

  const auctions = (rfqsQuery.data?.data ?? []).filter((r) => r.method === '竞价');
  const demands = demandsQuery.data?.data ?? [];
  const suppliers = suppliersQuery.data?.data ?? [];

  const supplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    suppliers.forEach((s) => {
      if (s.supplierId) map[s.supplierId] = s.supplierName ?? s.supplierId;
    });
    return map;
  }, [suppliers]);

  const budgetOf = (rfq: RfqResponse) =>
    demands
      .filter((d) => rfq.demandIds?.includes(d.id ?? ''))
      .reduce((sum, d) => sum + (d.budget ?? 0), 0);

  const stageLabels = ['全部', ...Array.from(new Set(auctions.map((r) => stageOf(r).label)))];
  const kw = keyword.toLowerCase();
  const list = auctions.filter((r) => {
    if (stageFilter !== '全部' && stageOf(r).label !== stageFilter) return false;
    if (!kw) return true;
    return [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const stageCount = (l: string) =>
    l === '全部' ? auctions.length : auctions.filter((r) => stageOf(r).label === l).length;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const liveCount = auctions.filter((r) => r.status === '报价中').length;

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(rfqs|demands)/.test(q.queryKey[0] as string),
    });
  };
  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试',
    );

  const selected = selectedId ? auctions.find((r) => r.id === selectedId) : undefined;
  const quoting = selected?.status === '报价中';
  const countdown = useCountdown(selected?.deadlineAt, !!quoting);

  // ── 竞价立项(复用询比向导,方式锁定竞价) ─────────────────────
  if (showForm) {
    return (
      <RfqCreateWizard
        demands={demands.filter((d) => !d.linkedRfqId)}
        suppliers={suppliers}
        initialMethod="竞价"
        onDone={(message) => {
          setShowForm(false);
          setFeedback(message);
          refresh();
        }}
        onCancel={() => {
          setShowForm(false);
          refresh();
        }}
      />
    );
  }

  // ── 实时竞价台 ─────────────────────────────────────────────
  if (selected) {
    const r = selected;
    const quotes = [...(r.quotes ?? [])].sort(
      (a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''),
    );
    const asc = [...quotes].sort((a, b) => (a.submittedAt ?? '').localeCompare(b.submittedAt ?? ''));
    // 出价流降幅:相对上一笔全场最低价。
    let runningLow = Number.POSITIVE_INFINITY;
    const trend: { t: number; low: number }[] = [];
    const dropByQuoteId: Record<string, number> = {};
    asc.forEach((q) => {
      if (q.amount == null || !q.submittedAt) return;
      const prevLow = runningLow;
      runningLow = Math.min(runningLow, q.amount);
      dropByQuoteId[q.id ?? ''] = Number.isFinite(prevLow) ? Math.max(0, prevLow - q.amount) : 0;
      trend.push({ t: new Date(q.submittedAt).getTime(), low: runningLow });
    });
    const lowest = r.auctionLowestAmount ?? (Number.isFinite(runningLow) ? runningLow : null);
    // 排行榜:每家供应商最新一笔,按金额升序;未出价受邀方垫底。
    const latestBySupplier = new Map<string, (typeof quotes)[number]>();
    asc.forEach((q) => q.supplierId && latestBySupplier.set(q.supplierId, q));
    const ranked = Array.from(latestBySupplier.values()).sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0)
      || (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '') || (a.id ?? '').localeCompare(b.id ?? ''));
    const waiting = (r.invitedSupplierIds ?? []).filter((sid) => !latestBySupplier.has(sid));
    const stage = stageOf(r);
    const maxAmount = Math.max(...ranked.map((q) => q.amount ?? 0), 1);
    const ended = !quoting && stage.index >= 4;

    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回竞价列表"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-xl font-black text-slate-950">{r.title}</h1>
                {r.status && <StatusPill label={r.status} />}
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', stage.tone)}>{stage.label}</span>
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                项目流水号 {r.id} · 类型 竞价 · 第 {r.currentRound ?? 1} 轮{r.finalRound ? '(最终轮)' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('rfqs')}
              className="inline-flex h-9 shrink-0 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              完整项目详情
            </button>
          </div>
        </div>

        {/* 竞价五阶段 */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <div className="grid grid-cols-5 items-start gap-2">
            {STAGES.map((label, index) => {
              const done = index < stage.index && stage.index <= 5;
              const current = index === stage.index && stage.index < 5;
              return (
                <div key={label} className="relative text-center">
                  {index < STAGES.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
                  <span
                    className={cn(
                      'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                      done
                        ? 'border-emerald-100 bg-emerald-500 text-white'
                        : current
                          ? 'border-blue-100 bg-blue-600 text-white'
                          : 'border-slate-200 text-slate-300',
                    )}
                  >
                    {done ? <CheckCircle2 size={17} /> : index === 4 ? <Trophy size={16} /> : index === 3 ? <Gavel size={16} /> : <i className="h-2 w-2 rounded-full bg-current" />}
                  </span>
                  <p className={cn('mt-2 text-xs font-black', done || current ? 'text-blue-700' : 'text-slate-500')}>{label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {error && <FeedbackNotice tone="error" message={error} />}

        {/* 深色实时状态横幅 */}
        <div className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="break-words text-xl font-black">{r.title}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-black',
                    quoting ? 'bg-emerald-500/20 text-emerald-300' : ended ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-300',
                  )}
                >
                  <Zap size={11} /> {quoting ? 'LIVE · 竞价进行中' : ended ? 'ENDED · 已截标' : 'READY · 未开始'}
                </span>
                <span className="font-mono">ID: {r.id}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Time Remaining</p>
                <p className="mt-1 font-mono text-3xl font-black">{quoting ? countdown : '--:--'}</p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="text-right">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Current Lowest</p>
                <p className="mt-1 font-mono text-3xl font-black text-emerald-400">{currency(lowest)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* 操作 + 规则 */}
        <div className="flex flex-wrap items-center gap-2">
          {quoting && (
            <>
              <button
                type="button"
                disabled={open.isPending || !r.deadlineAt || new Date(r.deadlineAt).getTime() > Date.now()}
                onClick={() => setConfirmAction('open-early')}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                <LockOpen size={15} /> 结束竞价并开标
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction('no-bid')}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-sm font-black text-red-600 hover:bg-red-50"
              >
                <Ban size={15} /> 流标
              </button>
            </>
          )}
          {(r.status === '已开标' || r.status === '定标审批中') && (
            <button
              type="button"
              onClick={() => onNavigate('rfqs')}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700"
            >
              <Trophy size={15} /> 前往定标决策
            </button>
          )}
          <div className="ml-auto rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-[11px] font-bold text-amber-800">
            规则:起拍价 {currency(r.auctionStartPrice)} · 最小降幅 {currency(r.auctionMinDecrement ?? 0)}
            {r.auctionPlannedStart && ` · 计划开始 ${r.auctionPlannedStart.slice(0, 16).replace('T', ' ')}`}
            {(r.auctionSoftCloseTriggerMinutes ?? 5) > 0
              ? ` · 防狙击:截止前 ${r.auctionSoftCloseTriggerMinutes ?? 5} 分钟出价顺延 ${r.auctionSoftCloseExtendMinutes ?? 5} 分钟`
              : ' · 自动延时已关闭'}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* 实时出价流 */}
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
                <Zap size={18} className="text-blue-600" /> 实时出价流
              </h3>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                {quotes.length} 记录
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {quotes.length === 0 ? (
                <FeedbackNotice tone="info" message={quoting ? '等待供应商出价…(每 5 秒自动刷新)' : '暂无出价记录。'} />
              ) : (
                quotes.map((q, i) => {
                  const name = q.supplierId ? (supplierNames[q.supplierId] ?? q.supplierId) : '—';
                  const drop = dropByQuoteId[q.id ?? ''] ?? 0;
                  return (
                    <div
                      key={q.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                        i === 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-white',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-600">
                        {name.slice(0, 1)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-black text-slate-950">
                          {name}
                          {i === 0 && (
                            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">NEW</span>
                          )}
                        </p>
                        <p className="font-mono text-[11px] font-bold text-slate-400">
                          {q.submittedAt?.slice(11, 19)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-black text-slate-950">{currency(q.amount)}</p>
                        {drop > 0 && (
                          <p className="flex items-center justify-end gap-0.5 font-mono text-[11px] font-black text-emerald-600">
                            <TrendingDown size={11} /> {drop.toLocaleString('zh-CN')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <div className="min-w-0 space-y-4">
            {/* 实时排行榜 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-950">
                <Trophy size={18} className="text-blue-600" /> 实时竞价排行榜
              </h3>
              <div className="mt-3 space-y-2.5">
                {ranked.length === 0 && waiting.length === 0 && (
                  <FeedbackNotice tone="info" message="尚无受邀供应商。" />
                )}
                {ranked.map((q, i) => {
                  const name = q.supplierId ? (supplierNames[q.supplierId] ?? q.supplierId) : '—';
                  const width = Math.max(12, Math.round(((maxAmount - (q.amount ?? 0)) / maxAmount) * 100) + 12);
                  return (
                    <div key={q.supplierId} className={cn('rounded-lg border px-3 py-2.5', i === 0 ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100')}>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black',
                            i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-slate-300 text-white' : i === 2 ? 'bg-orange-300 text-white' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {i + 1}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm font-black text-slate-950">{name}</p>
                        <p className="shrink-0 font-mono text-sm font-black text-slate-950">
                          {currency(q.amount)}
                          {i === 0 && <span className="ml-1.5 rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-black text-white">领先</span>}
                        </p>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className={cn('h-full rounded-full', i === 0 ? 'bg-emerald-500' : 'bg-blue-400')} style={{ width: `${Math.min(100, width)}%` }} />
                      </div>
                    </div>
                  );
                })}
                {waiting.map((sid) => (
                  <div key={sid} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-black text-slate-400">
                      —
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-500">{supplierNames[sid] ?? sid}</p>
                    <p className="shrink-0 text-xs font-bold text-slate-400">等待出价…</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 价格趋势 */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <p className="text-sm font-black text-slate-950">价格趋势图</p>
              <div className="mt-3">
                <PriceTrend points={trend} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <MiniFact label="起拍价" value={currency(r.auctionStartPrice)} />
                <MiniFact label="当前最低" value={currency(lowest)} />
                <MiniFact
                  label="累计降幅"
                  value={
                    r.auctionStartPrice != null && lowest != null
                      ? currency(Number(r.auctionStartPrice) - Number(lowest))
                      : '—'
                  }
                />
                <MiniFact label="保留价(内部)" value={currency(r.auctionReservePrice)} />
              </div>
              {r.auctionReservePrice != null && lowest != null && (
                <p className={cn('mt-2 text-[11px] font-black', Number(lowest) <= Number(r.auctionReservePrice) ? 'text-emerald-700' : 'text-amber-700')}>
                  {Number(lowest) <= Number(r.auctionReservePrice)
                    ? '当前最低价已达到保留价(底价)以内,可放心定标。'
                    : `当前最低价仍高于保留价 ${currency(Number(lowest) - Number(r.auctionReservePrice))},可视情况继续竞价或谈判。`}
                </p>
              )}
            </section>
          </div>
        </div>

        <ConfirmDialog
          open={confirmAction === 'open-early'}
          tone="primary"
          title="结束竞价并开标"
          message="竞价截止后开标，进入评标定标环节。确认继续?"
          confirmLabel="确认开标"
          busy={open.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            r.id && open.mutate(
              { rfqId: r.id, data: { force: false } },
              { onSuccess: () => { setConfirmAction(null); refresh(); }, onError: (e) => { setConfirmAction(null); reportError(e); } },
            );
          }}
        />
        <ConfirmDialog
          open={confirmAction === 'no-bid'}
          tone="danger"
          title="确认流标"
          message="流标将终止本竞价项目并释放关联需求,终止公告将同步门户公示。"
          confirmLabel="确认流标"
          busy={abort.isPending}
          onCancel={() => setConfirmAction(null)}
          onConfirm={() => {
            r.id && abort.mutate(
              { rfqId: r.id, data: { kind: '流标', reason: '有效出价不足,予以流标' } },
              { onSuccess: () => { setConfirmAction(null); setSelectedId(null); refresh(); }, onError: (e) => { setConfirmAction(null); reportError(e); } },
            );
          }}
        />
      </div>
    );
  }

  // ── 竞价台账 ─────────────────────────────────────────────
  return (
    <Panel title="竞价采购" icon={Gavel} subtitle="在线竞价管理 · 实时出价与排行">
      {hasLiveAuction && (
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-black',
            live ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'animate-pulse bg-emerald-500' : 'bg-slate-400')} />
            {live ? '实时推送已连接' : '实时推送重连中 · 每 5 秒刷新'}
          </span>
        </div>
      )}
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="竞价项目" value={`${auctions.length} 个`} />
        <MiniFact label="竞价进行中" value={`${liveCount} 个`} />
        <MiniFact label="待开标确认" value={`${auctions.filter((r) => r.status === '已开标' || r.status === '定标审批中').length} 个`} />
        <MiniFact label="已定标" value={`${auctions.filter((r) => r.status === '已定标').length} 个`} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={stageLabels.map((l) => ({ id: l, label: l, count: l === '全部' ? undefined : stageCount(l) }))}
          value={stageFilter}
          onChange={(id) => {
            setStageFilter(id);
            setPage(1);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            className="mb-0"
            placeholder="按项目名称 / 编号搜索"
            onSearch={(k) => {
              setKeyword(k);
              setPage(1);
            }}
          />
          <button
            type="button"
            onClick={() => {
              // 打开向导前强制刷新需求候选,避免展示已被其他项目绑定的需求。
              void demandsQuery.refetch();
              setShowForm(true);
            }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> 发起竞价立项
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-4">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {error && (
        <div className="mb-4">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {rfqsQuery.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载竞价项目…" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || stageFilter !== '全部'
              ? '没有符合条件的竞价项目。'
              : '暂无竞价项目。点击「发起竞价立项」创建首个在线竞价。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((r, i) => {
              const stage = stageOf(r);
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">
                        <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                        {r.title}
                      </p>
                      <p className="mt-1 w-44 truncate font-mono text-xs font-bold text-slate-400" title={r.id}>{r.id}</p>
                    </div>
                    <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-black', stage.tone)}>{stage.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => r.id && setSelectedId(r.id)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    进入竞价台
                  </button>
                </div>
              );
            })}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">项目编号</th>
                  <th className="px-5 py-4">项目名称</th>
                  <th className="px-5 py-4 text-right">预算</th>
                  <th className="px-5 py-4">截止日期</th>
                  <th className="px-5 py-4">项目阶段</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((r, i) => {
                  const stage = stageOf(r);
                  const budget = budgetOf(r);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-40 truncate font-mono text-xs font-black text-slate-500" title={r.id}>{r.id}</p>
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-black text-slate-950">{r.title}</p>
                        {(r.currentRound ?? 1) > 1 && (
                          <p className="mt-1 text-[11px] font-black text-violet-700">第{r.currentRound}轮{r.finalRound ? '·最终' : ''}</p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">
                        {budget > 0 ? currency(budget) : '—'}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{r.deadlineAt?.slice(0, 10) ?? '—'}</td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.status && <StatusPill label={r.status} />}
                          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', stage.tone)}>{stage.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {r.status === '报价中' && (
                            <button
                              type="button"
                              onClick={() => r.id && setSelectedId(r.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                            >
                              <Timer size={12} /> 竞价台
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => r.id && setSelectedId(r.id)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                          >
                            查看详情
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={list.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
