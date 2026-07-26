import { useEffect, useRef, useState, type ElementType } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileText,
  Gavel,
  Info,
  Send,
} from 'lucide-react';
import {
  type QuoteResponse,
  type RfqItemResponse,
  type RfqResponse,
  useSupplierQuoteDecline,
  useSupplierQuoteListList,
  useSupplierQuoteListRfqs,
  useSupplierQuoteMarkViewed,
  useSupplierQuoteSubmit,
  useSupplierEsignSign,
  useSupplierEsignList,
} from '@24bid/api-client';
import {
  ConfirmDialog,
  EsignRecordList,
  FilterTabs,
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  SignaturePad,
  StatusPill,
  cn,
} from '@24bid/ui';
import { RfqClarificationsSupplier } from './rfq-clarifications-supplier';
import { RfqResultSupplier } from './rfq-result-supplier';
import { useAuthStore } from '../../lib/auth-store';

// 报价行由采购清单驱动:品名/规格/单位/数量取自清单(采购方给定,不可改),供应商只填单价。
interface LineRow {
  demandItemId: string;
  description: string;
  specification?: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

interface QuoteForm {
  taxRate: string;
  deliveryDays: string;
  lines: LineRow[];
}

const defaultForm = (): QuoteForm => ({ taxRate: '13', deliveryDays: '7', lines: [] });

// 按项目采购清单生成报价行(保留已填单价,清单变更时以清单为准)。
const linesFromRfqItems = (items: RfqItemResponse[] | undefined, previous?: LineRow[]): LineRow[] =>
  (items ?? []).map((item) => ({
    demandItemId: item.demandItemId ?? '',
    description: item.materialName ?? item.materialId ?? '',
    specification: item.specification ?? undefined,
    unit: item.unit ?? '项',
    quantity: String(item.quantity ?? ''),
    unitPrice: previous?.find((l) => l.demandItemId === item.demandItemId)?.unitPrice ?? '',
  }));

const currency = (v: number) => `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const lineAmount = (l: LineRow) => (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
const formTotal = (f: QuoteForm) => f.lines.reduce((sum, l) => sum + lineAmount(l), 0);
const shortDate = (v?: string) => v?.slice(0, 10) ?? '—';
const shortTime = (v?: string) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : null);

const methodTone: Record<string, string> = {
  询价: 'bg-blue-50 text-blue-700',
  竞价: 'bg-amber-50 text-amber-700',
  商城: 'bg-violet-50 text-violet-700',
  单一来源: 'bg-slate-100 text-slate-600',
};

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

function MethodChip({ method }: { method?: string }) {
  const m = method || '询价';
  return (
    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', methodTone[m] ?? methodTone['询价'])}>
      {m}
    </span>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={18} className="text-blue-600" />
      <h3 className="text-base font-black text-slate-950">{title}</h3>
    </div>
  );
}

// 项目进度节点:真实时间戳,无时间则灰显待办。
function ProgressNode({
  label,
  time,
  done,
  last,
}: {
  label: string;
  time: string | null;
  done: boolean;
  last?: boolean;
}) {
  return (
    <div className="relative pl-5">
      {!last && <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" />}
      <span
        className={cn(
          'absolute left-0 top-1.5 h-2 w-2 rounded-full',
          done ? 'bg-emerald-500' : 'bg-slate-300',
        )}
      />
      <p className={cn('text-sm font-black', done ? 'text-slate-950' : 'text-slate-400')}>{label}</p>
      <p className="mt-1 pb-3 font-mono text-xs font-bold text-slate-400">{time ?? '待进行'}</p>
    </div>
  );
}

// 报价单电子签署记录:展示本方签署留痕(签署人/时间/内容指纹/笔迹)。
function QuoteEsignRecords({ quoteId }: { quoteId: string }) {
  const records = useSupplierEsignList({ targetType: 'quote', targetId: quoteId });
  const list = records.data?.data ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mt-3">
      <EsignRecordList records={list} />
    </div>
  );
}

// 询比邀请:列表(商机卡片) → 详情(报价单/要求/澄清 + 关键信息/项目进度)双层结构。
export function OpportunitiesPage({ onExitDetail }: { onExitDetail?: () => void } = {}) {
  const queryClient = useQueryClient();
  const supplierId = useAuthStore((s) => s.session?.supplierId ?? '');
  // 竞价进行中时自动轮询(5s),让当前最低价/截止顺延即时可见;无在场竞价则不轮询。
  const rfqs = useSupplierQuoteListRfqs(undefined, {
    query: {
      refetchInterval: (query) =>
        ((query.state.data?.data ?? []) as RfqResponse[]).some(
          (r) => r.method === '竞价' && r.status === '报价中',
        )
          ? 5_000
          : false,
    },
  });
  const myQuotes = useSupplierQuoteListList();
  const submit = useSupplierQuoteSubmit();
  const esign = useSupplierEsignSign();
  const displayName = useAuthStore((st) => st.session?.displayName ?? '');
  // 报价单电子签署:每个项目一份手写签名(询比/单一来源必签;竞价出价免签保时效)。
  const [signatures, setSignatures] = useState<Record<string, string | null>>({});
  const markViewed = useSupplierQuoteMarkViewed();
  const decline = useSupplierQuoteDecline();
  // 已读回执:进入商机列表即视为查看,幂等且每个询价只上报一次。
  const viewedOnce = useRef(new Set<string>());
  const rfqData = rfqs.data?.data ?? [];
  useEffect(() => {
    rfqData.forEach((r) => {
      const mine = (r.invitations ?? [])[0];
      if (r.id && r.status === '报价中' && mine && !mine.viewedAt && !viewedOnce.current.has(r.id)) {
        viewedOnce.current.add(r.id);
        markViewed.mutate({ rfqId: r.id });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqData.length]);

  // 报价行按采购清单播种:清单到达或行数变化时重建(保留已填单价),
  // 保证品名/规格/单位/数量恒等于采购方清单,供应商只补单价。
  useEffect(() => {
    setForms((current) => {
      let changed = false;
      const next = { ...current };
      rfqData.forEach((r) => {
        const items = r.items ?? [];
        if (!r.id || items.length === 0) return;
        const form = current[r.id] ?? defaultForm();
        if (form.lines.length === items.length
            && form.lines.every((l, i) => l.demandItemId === items[i].demandItemId)) {
          return;
        }
        next[r.id] = { ...form, lines: linesFromRfqItems(items, form.lines) };
        changed = true;
      });
      return changed ? next : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqData]);

  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, QuoteForm>>({});
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  // 支持 ?rfq= 深链:从「项目邀请 / 项目管理」页跳入时直达对应项目详情。
  const [selectedId, setSelectedId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get('rfq'),
  );
  const [declineOpen, setDeclineOpen] = useState(false);

  const all = rfqs.data?.data ?? [];
  const statuses = ['全部', ...Array.from(new Set(all.map((r) => r.status).filter(Boolean) as string[]))];
  const kw = keyword.toLowerCase();
  const list = all.filter((r) => {
    if (statusFilter !== '全部' && r.status !== statusFilter) return false;
    if (!kw) return true;
    return [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const statusCount = (s: string) => (s === '全部' ? all.length : all.filter((r) => r.status === s).length);
  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = list.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const formFor = (id: string) => forms[id] ?? defaultForm();
  const setForm = (id: string, patch: Partial<QuoteForm>) =>
    setForms((f) => ({ ...f, [id]: { ...formFor(id), ...patch } }));
  const setLine = (id: string, idx: number, patch: Partial<LineRow>) => {
    const f = formFor(id);
    const lines = f.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setForm(id, { lines });
  };

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/supplier\/(rfqs|quotes|esign-records)/.test(q.queryKey[0] as string),
    });

  // 有效行:清单给定数量 + 供应商已填单价(品名/数量不由供应商决定)。
  const validLines = (f: QuoteForm) =>
    f.lines.filter((l) => Number(l.quantity) > 0 && Number(l.unitPrice) > 0);
  // 清单全部行都报了价才可提交(按采购清单报价,不可漏行)。
  const allLinesPriced = (f: QuoteForm) => f.lines.length > 0 && validLines(f).length === f.lines.length;

  const onSubmit = (rfqId: string, requireSign: boolean) => {
    const f = formFor(rfqId);
    const lines = validLines(f);
    if (!allLinesPriced(f)) {
      setError('请对采购清单的全部行项填写单价后再提交。');
      return;
    }
    const signature = signatures[rfqId] ?? null;
    if (requireSign && !signature) {
      setError('请先在签名板上手写签名——报价单须电子签署后提交。');
      return;
    }
    submit.mutate(
      {
        rfqId,
        data: {
          amount: formTotal(f),
          taxRate: Number(f.taxRate) || 0,
          deliveryDays: Number(f.deliveryDays) || 0,
          lineItems: lines.map((l) => ({
            description: l.description.trim(),
            unit: l.unit.trim() || '项',
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice),
            demandItemId: l.demandItemId,
          })),
        },
      },
      {
        onSuccess: (res) => {
          // 报价落库后即刻电子签署:签署记录绑定报价单内容指纹,双方后续可核验。
          const quoteId = res.data?.id;
          if (signature && quoteId) {
            esign.mutate(
              { data: { targetType: 'quote', targetId: quoteId, signatureImage: signature, signerName: displayName } },
              { onSettled: refresh },
            );
          }
          setFeedback(`询比 ${rfqId} 报价已提交${signature ? '并完成电子签署' : ''}（${lines.length} 个行项，合计 ${currency(formTotal(f))}）`);
          setForms((s) => ({ ...s, [rfqId]: defaultForm() }));
          setSignatures((s) => ({ ...s, [rfqId]: null }));
          setError(null);
          refresh();
        },
        onError: () => {
          setError(`询比 ${rfqId} 报价提交失败：可能已提交过报价或询比已截止。`);
        },
      },
    );
  };

  // 我的最新报价(多轮取最近提交)。
  const myQuoteFor = (rfqId?: string): QuoteResponse | undefined =>
    (myQuotes.data?.data ?? [])
      .filter((q) => q.rfqId === rfqId)
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0];

  const selected = selectedId ? all.find((r) => r.id === selectedId) : undefined;

  // ── 详情视图 ────────────────────────────────────────────────
  if (selected) {
    const r = selected;
    const f = formFor(r.id ?? '');
    const myInvitation = (r.invitations ?? [])[0];
    const declined = myInvitation?.inviteStatus === '已拒绝';
    const quoting = r.status === '报价中' && !declined;
    const busy = submit.isPending && submit.variables?.rfqId === r.id;
    const total = formTotal(f);
    const myQuote = myQuoteFor(r.id);
    // 供应商视角 r.quotes 不含他方报价,须用自己的报价记录判断是否可拒绝。
    const canDecline = r.status === '报价中' && !declined && !myQuote;

    return (
      <div className="space-y-4">
        <ConfirmDialog
          open={declineOpen}
          tone="danger"
          title="拒绝参与本次询价"
          message="拒绝后本项目将不可再报价,采购方会收到您的拒绝回执。"
          confirmLabel="确认拒绝"
          input={{ label: '拒绝原因', placeholder: '如:产能排期冲突', optional: true }}
          busy={decline.isPending}
          onCancel={() => setDeclineOpen(false)}
          onConfirm={(reason) => {
            r.id &&
              decline.mutate(
                { rfqId: r.id, data: { reason: reason || undefined } },
                {
                  onSuccess: () => { setDeclineOpen(false); refresh(); },
                  onError: () => { setDeclineOpen(false); setError('拒绝失败:可能已提交报价。'); },
                },
              );
          }}
        />
        {/* 头部:返回 + 标题 + 状态,右侧动作 */}
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => (onExitDetail ? onExitDetail() : setSelectedId(null))}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
              aria-label="返回项目列表"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <MethodChip method={r.method} />
                {(r.currentRound ?? 1) > 1 && (
                  <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-700">
                    第{r.currentRound}轮{r.finalRound ? '·最终' : ''}
                  </span>
                )}
                <h1 className="text-xl font-black text-slate-950">{r.title}</h1>
                {r.status && <StatusPill label={r.status} />}
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {r.id} · 报价截止 {shortDate(r.deadlineAt)}
              </p>
            </div>
            {canDecline && (
              <button
                type="button"
                disabled={decline.isPending}
                onClick={() => setDeclineOpen(true)}
                className="inline-flex h-9 shrink-0 items-center rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                拒绝参与
              </button>
            )}
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {error && <FeedbackNotice tone="error" message={error} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_21rem]">
          <div className="space-y-4">
            {/* 报价/交付要求 */}
            {(r.quoteRequirement || r.deliveryRequirement || r.singleSourceReason) && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <SectionTitle icon={FileText} title="项目要求" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-black text-slate-400">报价要求</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {r.quoteRequirement || '—'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[11px] font-black text-slate-400">交付要求</p>
                    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                      {r.deliveryRequirement || '—'}
                    </p>
                  </div>
                  {r.singleSourceReason && (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 sm:col-span-2">
                      <p className="text-[11px] font-black text-slate-400">单一来源理由</p>
                      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                        {r.singleSourceReason}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 竞价实时状态 */}
            {r.method === '竞价' && (() => {
              const myBid = myQuote?.amount != null ? myQuote : undefined;
              const leading =
                myBid?.amount != null
                && r.auctionLowestAmount != null
                && myBid.amount <= r.auctionLowestAmount;
              const remainingMs = r.deadlineAt ? new Date(r.deadlineAt).getTime() - Date.now() : null;
              const remainingText =
                remainingMs == null
                  ? '—'
                  : remainingMs <= 0
                    ? '已截止'
                    : remainingMs < 3_600_000
                      ? `${Math.ceil(remainingMs / 60_000)} 分钟`
                      : `${Math.floor(remainingMs / 3_600_000)} 小时`;
              const live = r.status === '报价中' && (remainingMs == null || remainingMs > 0);
              const cap = r.auctionLowestAmount != null
                ? r.auctionLowestAmount - (r.auctionMinDecrement ?? 0)
                : r.auctionStartPrice ?? 0;
              return (
                /* 竞价大厅:与采购端实时竞价台同气质的深色 hero——倒计时/当前最低/我的排名/出价上限 */
                <section className="overflow-hidden rounded-lg bg-slate-900 p-5 text-white shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-black">
                      <Gavel size={15} className="text-amber-400" /> 竞价大厅
                      {live ? (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-red-500/20 px-2 py-0.5 text-[11px] font-black text-red-300">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> LIVE
                        </span>
                      ) : (
                        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-black text-slate-300">
                          {r.status === '报价中' ? '已截止' : r.status}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
                      {r.auctionMyRank != null && (
                        <span className={`rounded-md px-2 py-0.5 ${r.auctionMyRank === 1 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                          {r.auctionMyRank === 1 ? '当前领先' : `当前第 ${r.auctionMyRank} 名`}
                        </span>
                      )}
                      {myBid?.amount != null && r.auctionLowestAmount != null && !leading && (
                        <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-red-300">已被超越</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">当前最低报价</p>
                      <p className="mt-0.5 font-mono text-xl font-black text-amber-300">
                        {r.auctionLowestAmount != null
                          ? `¥${r.auctionLowestAmount.toLocaleString('zh-CN')}`
                          : r.auctionShowLowest === false ? '未公开' : '暂无出价'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">剩余时间</p>
                      <p className="mt-0.5 font-mono text-xl font-black">{remainingText}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">起拍价(最高限价)</p>
                      <p className="mt-0.5 font-mono text-sm font-black text-slate-200">
                        ¥{r.auctionStartPrice?.toLocaleString('zh-CN') ?? '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-400">本次出价上限</p>
                      <p className="mt-0.5 font-mono text-sm font-black text-slate-200">¥{cap.toLocaleString('zh-CN')}</p>
                    </div>
                  </div>
                  <p className="mt-3 border-t border-white/10 pt-2 text-[11px] font-bold text-slate-400">
                    最小降价步长 ¥{(r.auctionMinDecrement ?? 0).toLocaleString('zh-CN')} · 临近截止的出价将自动顺延(防狙击) · 每 5 秒自动刷新
                  </p>
                </section>
              );
            })()}

            {declined && (
              <FeedbackNotice
                tone="error"
                message={`已拒绝参与本次询价${myInvitation?.declineReason ? `:${myInvitation.declineReason}` : ''}。`}
              />
            )}

            {/* 开标情况:已开标后进入评标定标,供应商可见自身报价与流程状态 */}
            {(r.status === '已开标' || r.status === '定标审批中') && (
              <section className="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
                <SectionTitle icon={Gavel} title="开标情况" />
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="开标时间" value={shortTime(r.openedAt) ?? '—'} />
                  <MiniFact label="当前轮次" value={`第 ${r.currentRound ?? 1} 轮${r.finalRound ? '(最终轮)' : ''}`} />
                  <MiniFact label="流程状态" value={r.status === '定标审批中' ? '评标完成 · 定标审批中' : '评标定标进行中'} />
                </div>
                <p className="mt-3 text-xs font-bold leading-5 text-slate-600">
                  {myQuote
                    ? '您的报价已随开标解封进入比价评审;定标结果公示后将通过站内通知与本页「定标结果」告知。'
                    : '本项目已开标;您未提交报价,不参与本轮评审。'}
                  {r.status === '已开标' && !r.finalRound && ' 若采购方发起新一轮报价,您将收到再次报价邀请。'}
                </p>
              </section>
            )}

            {/* 我的报价单:已提交后展示明细回执 */}
            {myQuote && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <SectionTitle icon={ClipboardList} title="我的报价单" />
                {myQuote.id && <QuoteEsignRecords quoteId={myQuote.id} />}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-black text-emerald-700">报价总价(含税)</p>
                    <p className="mt-0.5 font-mono text-2xl font-black text-emerald-700">
                      {myQuote.amount != null ? currency(myQuote.amount) : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-400">报价时间</p>
                    <p className="mt-0.5 font-mono text-xs font-black text-slate-600">
                      {shortTime(myQuote.submittedAt) ?? '—'}
                    </p>
                  </div>
                </div>
                {(myQuote.lineItems ?? []).length > 0 && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                        <tr>
                          <th className="px-3 py-2">品名/规格</th>
                          <th className="px-3 py-2 text-right">数量</th>
                          <th className="px-3 py-2 text-right">单价</th>
                          <th className="px-3 py-2 text-right">小计</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(myQuote.lineItems ?? []).map((l) => (
                          <tr key={l.id} className="font-bold text-slate-700">
                            <td className="px-3 py-2">{l.description}</td>
                            <td className="px-3 py-2 text-right">
                              {l.quantity}
                              {l.unit ? ` ${l.unit}` : ''}
                            </td>
                            <td className="px-3 py-2 text-right">{l.unitPrice != null ? currency(l.unitPrice) : '—'}</td>
                            <td className="px-3 py-2 text-right font-black text-slate-900">
                              {l.lineAmount != null ? currency(l.lineAmount) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MiniFact label="税率" value={myQuote.taxRate != null ? `${myQuote.taxRate}%` : '—'} />
                  <MiniFact label="承诺交期" value={myQuote.deliveryDays != null ? `${myQuote.deliveryDays} 天内` : '—'} />
                </div>
              </section>
            )}

            {/* 按行报价:报价中开放(竞价多轮可再次出价) */}
            {quoting && (!myQuote || r.method === '竞价') && (
              <section className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-black text-emerald-800">
                    {myQuote ? '再次出价' : '按采购清单报价'}
                  </p>
                  <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-black text-emerald-700">
                    清单共 {f.lines.length} 行 · 已报 {validLines(f).length} 行
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  品名、规格、单位与数量由采购方在采购清单中给定,不可修改;请对每一行填写您的单价。
                </p>

                {f.lines.length === 0 ? (
                  <FeedbackNotice
                    tone="info"
                    message="本项目未提供采购清单明细,请通过澄清答疑向采购方确认后再报价。"
                  />
                ) : (
                  <div className="mt-2 overflow-hidden rounded-lg border border-emerald-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-white/70 text-[11px] font-black text-slate-500">
                        <tr>
                          <th className="px-3 py-2">采购清单行(采购方给定)</th>
                          <th className="w-24 px-3 py-2 text-right">数量</th>
                          <th className="w-32 px-3 py-2 text-right">
                            <span className="mr-1 text-red-500">*</span>我方单价
                          </th>
                          <th className="w-28 px-3 py-2 text-right">行金额</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-100/70 bg-white">
                        {f.lines.map((l, idx) => (
                          <tr key={l.demandItemId || idx}>
                            <td className="px-3 py-2">
                              <p className="font-black text-slate-900">{l.description}</p>
                              {l.specification && (
                                <p className="mt-0.5 text-[11px] font-bold text-slate-400">{l.specification}</p>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-700">
                              {l.quantity} {l.unit}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                className={cn(inputCls, 'text-right')}
                                type="number"
                                min="0"
                                value={l.unitPrice}
                                placeholder="0.00"
                                aria-label={`${l.description} 单价`}
                                onChange={(e) => setLine(r.id ?? '', idx, { unitPrice: e.target.value })}
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-900">
                              {currency(lineAmount(l))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-500">税率(%)</label>
                    <input className={inputCls} type="number" value={f.taxRate}
                      onChange={(e) => setForm(r.id ?? '', { taxRate: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] font-black text-slate-500">交期(天)</label>
                    <input className={inputCls} type="number" value={f.deliveryDays}
                      onChange={(e) => setForm(r.id ?? '', { deliveryDays: e.target.value })} />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="text-[11px] font-black text-slate-500">报价合计(含税)</label>
                    <p className="py-2 text-lg font-black text-emerald-700">{currency(total)}</p>
                  </div>
                </div>

                {r.method !== '竞价' && (
                  <div className="mt-3">
                    <p className="text-[11px] font-black text-slate-500">
                      <span className="mr-1 text-red-500">*</span>报价单电子签署(提交前须手写签名,签署记录含单据内容指纹)
                    </p>
                    <SignaturePad
                      className="mt-1.5"
                      onChange={(dataUrl) => setSignatures((s) => ({ ...s, [r.id ?? '']: dataUrl }))}
                    />
                  </div>
                )}
                <PrimaryActionButton onClick={() => r.id && onSubmit(r.id, r.method !== '竞价')} busy={busy} pendingLabel="提交中"
                  disabled={!allLinesPriced(f) || (r.method !== '竞价' && !signatures[r.id ?? ''])}>
                  {r.method !== '竞价' ? '签署并提交报价' : '提交报价'}
                </PrimaryActionButton>
              </section>
            )}
            {!quoting && !myQuote && !declined && (
              <FeedbackNotice tone="info" message={`当前状态「${r.status}」,报价入口仅在报价中开放。`} />
            )}

            {/* 开标大厅:开标后唱标公开——各家报价按金额升序公示,他方匿名、我方高亮 */}
            {r.openedAt && (r.quotes ?? []).length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionTitle icon={Gavel} title={r.method === '竞价' ? '开标大厅 · 竞价成交排序' : '开标大厅 · 唱标记录'} />
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                    开标时间 {shortTime(r.openedAt)}
                  </span>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  开标后各受邀方报价对全体参与人公示(仅公开报价总额,他方身份与明细不披露)。
                </p>
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                      <tr>
                        <th className="w-16 px-3 py-2 text-center">名次</th>
                        <th className="px-3 py-2">参与方</th>
                        <th className="px-3 py-2 text-right">报价金额(含税)</th>
                        <th className="px-3 py-2 text-right">报价时间</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(r.quotes ?? []).map((q, i) => {
                        const mine = q.supplierId === supplierId;
                        return (
                          <tr key={q.id} className={mine ? 'bg-emerald-50/60' : undefined}>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-[11px] font-black ${
                                i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                              }`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-3 py-2 font-black">
                              {mine ? (
                                <span className="text-emerald-700">我方报价</span>
                              ) : (
                                <span className="text-slate-500">参与供应商 {i + 1}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-black text-slate-900">
                              {q.amount != null ? currency(q.amount) : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-slate-400">
                              {shortTime(q.submittedAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 定标结果 */}
            {r.status === '已定标' && r.id && supplierId && (
              <RfqResultSupplier rfqId={r.id} supplierId={supplierId} />
            )}

            {/* 澄清答疑 */}
            {r.id && <RfqClarificationsSupplier rfqId={r.id} canAsk={quoting} />}
          </div>

          {/* 右栏:关键信息(深色) + 项目进度 */}
          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black">
                <Info size={15} className="text-blue-400" /> 关键信息
              </p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['采购方式', r.method || '询价'],
                  ['评选方式', r.evaluationMethod ?? '最低价'],
                  ['报价截止', shortDate(r.deadlineAt)],
                  ['当前轮次', `第 ${r.currentRound ?? 1} 轮${r.finalRound ? '(最终轮)' : ''}`],
                  ['我的参与', declined ? '已拒绝参与' : myQuote ? '已提交报价' : '未报价'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <SectionTitle icon={CalendarClock} title="项目进度" />
              <div className="mt-4">
                <ProgressNode label="收到邀请" time={shortTime(r.createdAt)} done={!!r.createdAt} />
                <ProgressNode label="查看询价函" time={shortTime(myInvitation?.viewedAt)} done={!!myInvitation?.viewedAt} />
                <ProgressNode label="提交报价" time={shortTime(myQuote?.submittedAt)} done={!!myQuote} />
                <ProgressNode label="开标" time={shortTime(r.openedAt)} done={!!r.openedAt} />
                <ProgressNode
                  label="结果公示"
                  time={shortTime(r.resultAnnouncedAt)}
                  done={!!r.resultAnnouncedAt || r.status === '已定标'}
                  last
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // ── 列表视图 ────────────────────────────────────────────────
  return (
    <Panel title="询比邀请" icon={Send} subtitle="可报价商机 · 点击进入详情报价">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={statuses.map((s) => ({
            id: s,
            label: s,
            count: s === '全部' ? undefined : statusCount(s),
          }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按询比标题 / 编号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
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

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载询比邀请…" />
      ) : rfqs.isError ? (
        <FeedbackNotice tone="error" message="商机加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : list.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的询比。'
              : '暂无询比邀请。被采购方邀请后出现在此。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((r, i) => {
              const myInvitation = (r.invitations ?? [])[0];
              const declined = myInvitation?.inviteStatus === '已拒绝';
              const quoting = r.status === '报价中' && !declined;
              const myQuote = myQuoteFor(r.id);
              return (
                <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <MethodChip method={r.method} />
                        <span className="font-mono text-[11px] font-bold text-slate-400">
                          {(safePage - 1) * PAGE_SIZE + i + 1}. {r.id}
                        </span>
                      </div>
                      <p className="mt-1.5 break-words font-black text-slate-950">{r.title}</p>
                    </div>
                    {r.status && <StatusPill label={r.status} />}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <MiniFact label="报价截止" value={shortDate(r.deadlineAt)} />
                    <MiniFact
                      label="我的参与"
                      value={myQuote?.amount != null ? currency(myQuote.amount) : declined ? '已拒绝' : '未报价'}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => r.id && setSelectedId(r.id)}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    {quoting && !myQuote ? '立即报价' : '查看详情'}
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
                  <th className="px-5 py-4">评选方式</th>
                  <th className="px-5 py-4">我的参与</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4">报价截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((r, i) => {
                  const myInvitation = (r.invitations ?? [])[0];
                  const declined = myInvitation?.inviteStatus === '已拒绝';
                  const quoting = r.status === '报价中' && !declined;
                  const myQuote = myQuoteFor(r.id);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{r.id}</td>
                      <td className="px-5 py-5">
                        <p className="flex items-center gap-2 font-black text-slate-950">
                          <MethodChip method={r.method} />
                          {r.title}
                          {(r.currentRound ?? 1) > 1 && (
                            <span className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[11px] font-black text-violet-700">
                              第{r.currentRound}轮{r.finalRound ? '·最终' : ''}
                            </span>
                          )}
                        </p>
                        {r.quoteRequirement && (
                          <p className="mt-1 max-w-md truncate text-xs font-bold text-slate-400">
                            询价摘要:{r.quoteRequirement}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-sm font-bold text-slate-600">{r.evaluationMethod ?? '最低价'}</td>
                      <td className="px-5 py-5">
                        {myQuote?.amount != null ? (
                          <span className="font-mono text-xs font-black text-emerald-700">{currency(myQuote.amount)}</span>
                        ) : declined ? (
                          <span className="text-xs font-black text-red-600">已拒绝</span>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">未报价</span>
                        )}
                      </td>
                      <td className="px-5 py-5">{r.status && <StatusPill label={r.status} />}</td>
                      <td className={cn('px-5 py-5 font-mono text-xs font-black', quoting ? 'text-red-600' : 'text-slate-400')}>
                        {shortDate(r.deadlineAt)}
                      </td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {quoting && !myQuote && (
                            <button
                              type="button"
                              onClick={() => r.id && setSelectedId(r.id)}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                            >
                              立即报价
                            </button>
                          )}
                          {quoting && myQuote && r.method === '竞价' && (
                            <button
                              type="button"
                              onClick={() => r.id && setSelectedId(r.id)}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                            >
                              继续出价
                            </button>
                          )}
                          {(r.status === '已开标' || r.status === '定标审批中') && (
                            <button
                              type="button"
                              onClick={() => r.id && setSelectedId(r.id)}
                              className="inline-flex h-8 items-center rounded-md border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-50"
                            >
                              查看开标情况
                            </button>
                          )}
                          {r.status === '已定标' && (
                            <button
                              type="button"
                              onClick={() => r.id && setSelectedId(r.id)}
                              className="inline-flex h-8 items-center rounded-md border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-700 transition hover:bg-emerald-50"
                            >
                              查看定标结果
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => r.id && setSelectedId(r.id)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                          >
                            详情
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
