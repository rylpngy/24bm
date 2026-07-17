import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, FileText, Gift, Lock, Megaphone, Monitor, PackageSearch, Search, Send, SlidersHorizontal, Store, Timer, Users, Wrench } from 'lucide-react';
import {
  type PublicAnnouncementResponse,
  type PublicOpportunityResponse,
  type PublicSupplierResponse,
  usePublicMallOverview,
  usePublicPortalRegisterSupplier,
  usePublicOpportunityEnroll,
  usePublicOpportunityList,
  usePublicPortalListAnnouncements,
  usePublicProcurementAnnouncementList,
  type PublicProcurementAnnouncementResponse,
  usePublicPortalListSuppliers,
} from '@24bid/api-client';
import { FeedbackNotice, FilterTabs, Pagination, RichTextView, cn, richTextToPlain } from '@24bid/ui';

const AUDIENCE_LABELS: Record<string, string> = { all: '全部用户', buyer: '采购方', supplier: '供应商' };
const AUDIENCE_TONE: Record<string, string> = {
  all: 'bg-blue-50 text-blue-700',
  buyer: 'bg-violet-50 text-violet-600',
  supplier: 'bg-emerald-50 text-emerald-700',
};

function dateText(value?: string) {
  return value?.slice(0, 10) ?? '—';
}

function PageShell({
  icon: Icon,
  title,
  subtitle,
  onBack,
  children,
}: {
  icon: typeof Store;
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-7 flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            aria-label="返回"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black text-slate-950">
            <Icon size={24} className="text-blue-600" />
            {title}
          </h1>
          <p className="mt-1.5 text-sm font-bold text-slate-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// 供应商名录:平台认证供应商的公开列表(真实数据),支持搜索与行业筛选。
export function PortalSuppliersPage({ onLogin }: { onLogin: () => void }) {
  const suppliers = usePublicPortalListSuppliers();
  const [keyword, setKeyword] = useState('');
  const [industry, setIndustry] = useState('全部行业');
  const [selected, setSelected] = useState<PublicSupplierResponse | null>(null);

  const list = suppliers.data?.data ?? [];
  const industries = useMemo(
    () => ['全部行业', ...Array.from(new Set(list.map((s) => s.industry).filter(Boolean) as string[]))],
    [list],
  );
  const filtered = list.filter((s) => {
    if (industry !== '全部行业' && s.industry !== industry) return false;
    const kw = keyword.trim().toLowerCase();
    if (kw && ![s.name, s.industry].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
    return true;
  });

  if (selected) {
    return (
      <PageShell
        icon={Store}
        title={selected.name ?? '供应商详情'}
        subtitle="平台认证供应商 · 公开信息"
        onBack={() => setSelected(null)}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-lg font-black text-white">
                {(selected.name ?? '?').slice(0, 1)}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-xl font-black text-slate-950">
                  {selected.name}
                  {selected.verified && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">
                      <BadgeCheck size={13} /> 平台认证
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-sm font-bold text-slate-500">主营行业:{selected.industry || '—'}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">认证状态</p>
                <p className="mt-1.5 text-sm font-black text-slate-950">
                  {selected.verifiedStatus === 'approved' ? '认证通过' : '认证审核中'}
                </p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">企业编号</p>
                <p className="mt-1.5 break-all font-mono text-sm font-black text-slate-950">{selected.id}</p>
              </div>
            </div>
            <p className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
              公开页仅展示平台认证的基础信息;证照、联系人与交易记录等属企业隐私,登录后在业务流程中按权限可见。
            </p>
          </section>
          <aside className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="text-base font-black">与该供应商合作?</p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-400">
                采购方登录后可在「供应商库」发起邀请与准入,完成资质核验后即可进入询比、竞价或商城采购流程。
              </p>
              <button
                type="button"
                onClick={onLogin}
                className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white transition hover:bg-blue-500"
              >
                登录发起合作
              </button>
            </section>
          </aside>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell icon={Store} title="供应商名录" subtitle="平台认证供应商公开名录 · 实时数据">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {industries.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setIndustry(item)}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                item === industry
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索供应商名称、行业"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {suppliers.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商名录…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={keyword || industry !== '全部行业' ? '没有符合条件的供应商。' : '暂无认证供应商,企业入驻审核通过后展示在此。'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s)}
              className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 font-black text-white">
                  {(s.name ?? '?').slice(0, 1)}
                </span>
                {s.verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">
                    <BadgeCheck size={12} /> 认证
                  </span>
                )}
              </div>
              <p className="mt-3 truncate text-base font-black text-slate-950">{s.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{s.industry || '行业未填写'}</p>
              <p className="mt-3 text-xs font-black text-blue-600">查看公开信息 →</p>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// 平台公告:生效公告列表 + 二级详情(真实数据)。
const PROC_ANN_TONE: Record<string, string> = {
  采购公告: 'bg-blue-50 text-blue-700',
  变更公告: 'bg-amber-50 text-amber-700',
  定标公告: 'bg-emerald-50 text-emerald-700',
  终止公告: 'bg-red-50 text-red-600',
};

const money = (v?: number) => (v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`);

// 采购公告详情:模板化展示(公告头 + 项目信息 + 分类型正文区块 + 关键信息侧栏)。
function ProcurementAnnouncementDetail({
  a,
  onBack,
}: {
  a: PublicProcurementAnnouncementResponse;
  onBack: () => void;
}) {
  let idx = 0;
  const next = () => ++idx;
  return (
    <PageShell
      icon={Megaphone}
      title={a.title ?? '采购公告'}
      subtitle={`${a.buyerName ?? '采购人'} · 发布于 ${dateText(a.publishedAt)}`}
      onBack={onBack}
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <span className={cn('rounded-md px-2.5 py-1 text-xs font-black', PROC_ANN_TONE[a.type ?? ''] ?? 'bg-slate-100 text-slate-600')}>
              {a.type}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <CalendarDays size={14} /> {dateText(a.publishedAt)}
            </span>
            <span className="text-xs font-bold text-slate-400">项目编号 {a.rfqId}</span>
          </div>

          <DetailSection index={next()} title="公告正文">{a.summary ?? '—'}</DetailSection>

          {a.type === '采购公告' && (
            <>
              {a.quoteRequirement && <DetailSection index={next()} title="报价要求">{a.quoteRequirement}</DetailSection>}
              {a.deliveryRequirement && <DetailSection index={next()} title="交付要求">{a.deliveryRequirement}</DetailSection>}
            </>
          )}
          {a.type === '定标公告' && (
            <DetailSection index={next()} title="定标结果">
              {`中标供应商:${a.awardedSupplierName ?? '—'}\n中标含税总价:${a.awardAmount != null ? money(a.awardAmount) : '按结果公告为准'}\n公示说明:对定标结果如有异议,请在公示期内联系采购人。`}
            </DetailSection>
          )}
          {a.type === '终止公告' && (
            <DetailSection index={next()} title="终止说明">
              {`${a.closeReason ?? '—'}\n关联采购需求已释放,后续如重新采购将另行发布公告。`}
            </DetailSection>
          )}
        </section>

        <aside className="h-fit rounded-lg bg-slate-900 p-6 text-white shadow-sm">
          <p className="text-sm font-black">关键信息</p>
          <dl className="mt-5 space-y-4 [&_dd]:!text-white [&_dt]:!text-slate-400">
            <SideFact icon={Users} label="采购人" value={a.buyerName ?? '—'} />
            <SideFact icon={Megaphone} label="采购方式" value={a.method ?? '询价'} />
            <SideFact icon={CalendarDays} label="评选方式" value={a.evaluationMethod ?? '最低价'} />
            {a.deadlineAt && <SideFact icon={CalendarDays} label="报价截止" value={dateText(a.deadlineAt)} em />}
            {a.awardedSupplierName && <SideFact icon={Users} label="中标供应商" value={a.awardedSupplierName} />}
          </dl>
        </aside>
      </div>
    </PageShell>
  );
}

export function PortalAnnouncementsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const announcements = usePublicPortalListAnnouncements();
  const procAnnouncements = usePublicProcurementAnnouncementList();
  const [tab, setTab] = useState<'procurement' | 'platform'>('procurement');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<PublicAnnouncementResponse | null>(null);
  const [selectedProc, setSelectedProc] = useState<PublicProcurementAnnouncementResponse | null>(null);
  const [annPage, setAnnPage] = useState(1);
  const ANN_PAGE_SIZE = 10;

  const list = announcements.data?.data ?? [];
  const filtered = list.filter((a) => {
    const kw = keyword.trim().toLowerCase();
    return !kw || [a.title, richTextToPlain(a.content ?? '')].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const procList = (procAnnouncements.data?.data ?? []).filter((a) => {
    const kw = keyword.trim().toLowerCase();
    return !kw || [a.title, a.summary, a.buyerName].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });

  if (selectedProc) {
    return <ProcurementAnnouncementDetail a={selectedProc} onBack={() => setSelectedProc(null)} />;
  }

  if (selected) {
    return (
      <PageShell
        icon={Megaphone}
        title={selected.title ?? '公告详情'}
        subtitle={`发布于 ${dateText(selected.createdAt)} · 面向${AUDIENCE_LABELS[selected.audience ?? ''] ?? selected.audience}`}
        onBack={() => setSelected(null)}
      >
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-4">
            <span className={cn('rounded-md px-2.5 py-1 text-xs font-black', AUDIENCE_TONE[selected.audience ?? ''] ?? 'bg-slate-100 text-slate-600')}>
              {AUDIENCE_LABELS[selected.audience ?? ''] ?? selected.audience}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400">
              <CalendarDays size={14} /> {dateText(selected.createdAt)}
            </span>
          </div>
          <RichTextView html={selected.content ?? ''} className="mt-5 leading-7" />
        </section>
      </PageShell>
    );
  }

  const body = (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {([['procurement', `采购公告 ${procList.length ? `(${procList.length})` : ''}`], ['platform', `平台公告 ${filtered.length ? `(${filtered.length})` : ''}`]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setTab(id); setAnnPage(1); }}
              className={cn(
                'rounded-md px-4 py-2 text-sm font-black transition',
                tab === id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索公告标题、内容"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {tab === 'procurement' ? (
        procAnnouncements.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载采购公告…" />
        ) : procList.length === 0 ? (
          <FeedbackNotice tone="info" message={keyword ? '没有符合条件的采购公告。' : '暂无采购公告。采购人发布询价/定标后自动生成并公示在此。'} />
        ) : (
          <>
          <div className="space-y-3">
            {procList.slice((annPage - 1) * ANN_PAGE_SIZE, annPage * ANN_PAGE_SIZE).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedProc(a)}
                className={cn('w-full rounded-xl border-l-4 border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
                  a.type === '定标公告' ? 'border-l-emerald-400' : a.type === '终止公告' ? 'border-l-red-300' : a.type === '变更公告' ? 'border-l-amber-300' : 'border-l-blue-400')}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-black', PROC_ANN_TONE[a.type ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                    {a.type}
                  </span>
                  {a.method && <span className="shrink-0 rounded-md bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-600">{a.method}</span>}
                  <p className="min-w-0 flex-1 truncate text-lg font-black leading-snug text-slate-950">{a.title}</p>
                </div>
                <p className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-6 text-slate-500">{a.summary}</p>
                <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-50 pt-3 text-xs font-bold text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><Users size={13} />{a.buyerName}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />发布于 {dateText(a.publishedAt)}</span>
                </p>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={annPage} pageSize={ANN_PAGE_SIZE} total={procList.length} onPageChange={setAnnPage} />
          </div>
          </>
        )
      ) : announcements.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载平台公告…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword ? '没有符合条件的公告。' : '暂无生效公告。'} />
      ) : (
        <>
        <div className="space-y-3">
          {filtered.slice((annPage - 1) * ANN_PAGE_SIZE, annPage * ANN_PAGE_SIZE).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="w-full rounded-xl border-l-4 border-l-violet-400 border border-slate-200 bg-white px-6 py-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('rounded-md px-2.5 py-1 text-xs font-black', AUDIENCE_TONE[a.audience ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {AUDIENCE_LABELS[a.audience ?? ''] ?? a.audience}
                </span>
                <p className="min-w-0 flex-1 truncate text-lg font-black leading-snug text-slate-950">{a.title}</p>
              </div>
              <p className="mt-2.5 line-clamp-2 text-[13px] font-semibold leading-6 text-slate-500">{richTextToPlain(a.content ?? '')}</p>
              <p className="mt-3 flex items-center gap-1.5 border-t border-slate-50 pt-3 text-xs font-bold text-slate-400">
                <CalendarDays size={13} /> 发布于 {dateText(a.createdAt)}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-4">
          <Pagination page={annPage} pageSize={ANN_PAGE_SIZE} total={filtered.length} onPageChange={setAnnPage} />
        </div>
        </>
      )}
    </>
  );

  if (embedded) {
    return body;
  }
  return (
    <PageShell icon={Megaphone} title="公告中心" subtitle="采购公告 · 变更公告 · 定标公告 · 平台公告,全部实时数据">
      {body}
    </PageShell>
  );
}

// 首页「优质供应商」真实数据板块:有认证供应商时展示真实名录,空态引导入驻。
export function HomeSuppliersSection({
  onOpenDirectory,
}: {
  onOpenDirectory: () => void;
}) {
  const suppliers = usePublicPortalListSuppliers();
  const list = (suppliers.data?.data ?? []).slice(0, 6);

  return (
    <div>
      {list.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <Users size={28} className="mx-auto text-slate-300" />
          <p className="mt-3 text-sm font-black text-slate-700">暂无认证供应商</p>
          <p className="mt-1 text-xs font-bold text-slate-400">企业入驻并通过平台审核后,将在此公开展示。</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={onOpenDirectory}
              className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
            >
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-white">
                {(s.name ?? '?').slice(0, 2)}
              </div>
              <p className="mt-4 truncate text-sm font-black text-slate-950">{s.name}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-slate-400">
                {s.verified && <BadgeCheck size={12} className="text-emerald-500" />}
                {s.industry || '—'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 首页「最新公告」真实数据条:采购公告(招标/询比等业务公告)与平台公告按时间混排取最新 3 条。
export function HomeAnnouncementsStrip({ onOpenAll }: { onOpenAll: () => void }) {
  const announcements = usePublicPortalListAnnouncements();
  const procAnnouncements = usePublicProcurementAnnouncementList();
  const merged = [
    ...(procAnnouncements.data?.data ?? []).map((a) => ({
      id: a.id ?? '',
      title: a.title ?? '',
      tag: a.type ?? '采购公告',
      tagCls: a.type === '定标公告' ? 'bg-emerald-50 text-emerald-700'
        : a.type === '终止公告' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700',
      meta: `${a.buyerName ?? ''}`,
      at: a.publishedAt ?? '',
    })),
    ...(announcements.data?.data ?? []).map((a) => ({
      id: a.id ?? '',
      title: a.title ?? '',
      tag: '平台公告',
      tagCls: 'bg-violet-50 text-violet-700',
      meta: AUDIENCE_LABELS[a.audience ?? ''] ?? a.audience ?? '',
      at: a.createdAt ?? '',
    })),
  ]
    .sort((x, y) => (y.at || '').localeCompare(x.at || ''))
    .slice(0, 3);
  if (merged.length === 0) return null;

  return (
    <section className="bg-white py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Megaphone size={16} className="text-blue-600" /> 最新公告
            </p>
            <button type="button" onClick={onOpenAll} className="text-xs font-black text-blue-600 hover:text-blue-700">
              查看全部 →
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {merged.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={onOpenAll}
                className="rounded-lg border border-white bg-white p-3 text-left shadow-sm transition hover:border-blue-200"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-black ${a.tagCls}`}>{a.tag}</span>
                  <p className="min-w-0 truncate text-sm font-black text-slate-900">{a.title}</p>
                </div>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {a.meta} · {dateText(a.at)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const OPPORTUNITY_STATUS_TONE: Record<string, string> = {
  报价中: 'bg-emerald-50 text-emerald-700',
  发售中: 'bg-emerald-50 text-emerald-700',
  已开标: 'bg-blue-50 text-blue-700',
  评标中: 'bg-amber-50 text-amber-700',
  定标审批中: 'bg-amber-50 text-amber-700',
  已定标: 'bg-slate-100 text-slate-600',
  已流标: 'bg-red-50 text-red-600',
};

function opportunityStatusLabel(o: PublicOpportunityResponse) {
  if (o.status === '报价中') return '报名与报价中';
  if (o.status === '发售中') return '招标文件发售中';
  if (o.status === '已定标') return o.resultAnnouncedAt ? '结果已公示' : '已定标';
  return o.status ?? '—';
}

function deadlineText(deadlineAt?: string) {
  if (!deadlineAt) return '—';
  const ms = new Date(deadlineAt).getTime() - Date.now();
  if (ms <= 0) return '已截止';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `剩余 ${Math.max(1, hours)} 小时`;
  return `剩余 ${Math.floor(hours / 24)} 天`;
}

// 报名参与表单:无需登录的报名登记,采购方审核后转正式邀请。
function EnrollForm({ rfqId }: { rfqId: string }) {
  const enroll = usePublicOpportunityEnroll();
  const [form, setForm] = useState({ companyName: '', contactName: '', contactPhone: '', note: '' });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = form.companyName.trim() && form.contactName.trim() && form.contactPhone.trim();

  if (done) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-5 text-center">
        <CheckCircle2 size={28} className="mx-auto text-emerald-500" />
        <p className="mt-3 text-sm font-black text-emerald-800">报名已提交</p>
        <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
          采购方审核通过后将向贵司发出正式询价邀请;若贵司尚未入驻平台,采购方会先引导完成入驻与准入。
        </p>
      </div>
    );
  }

  const inputCls =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        enroll.mutate(
          { rfqId, data: { ...form, note: form.note || undefined } },
          {
            onSuccess: () => setDone(true),
            onError: (err) =>
              setError(
                (err as { response?: { data?: { message?: string } } }).response?.data?.message
                  ?? '报名失败,请稍后重试',
              ),
          },
        );
      }}
    >
      <div>
        <label className="text-xs font-black text-slate-500">企业名称 *</label>
        <input className={inputCls} value={form.companyName} placeholder="与营业执照一致的企业全称"
          onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-black text-slate-500">联系人 *</label>
          <input className={inputCls} value={form.contactName} placeholder="姓名"
            onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-black text-slate-500">联系电话 *</label>
          <input className={inputCls} value={form.contactPhone} placeholder="手机 / 座机"
            onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="text-xs font-black text-slate-500">报名说明(选填)</label>
        <textarea className="min-h-[64px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          value={form.note} placeholder="简述贵司优势、同类项目经验等"
          onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </div>
      {error && <FeedbackNotice tone="error" message={error} />}
      <button
        type="submit"
        disabled={!ready || enroll.isPending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.98] disabled:bg-blue-200"
      >
        <Send size={15} /> {enroll.isPending ? '提交中…' : '提交报名'}
      </button>
      <p className="text-[11px] font-bold leading-4 text-slate-400">
        提交即表示同意采购方在本项目范围内使用上述联系信息;已入驻供应商受理后可直接在供应商门户报价。
      </p>
    </form>
  );
}

// 商机大厅:平台上采购人发布项目的公开列表(真实数据)+ 二级详情(含报名参与)。
// 布局参考验收提供的原型;组件规范(按钮/边框/间距)与系统统一。
export function PortalOpportunitiesPage({ initialTab }: { initialTab?: string } = {}) {
  const opportunities = usePublicOpportunityList();
  const [keyword, setKeyword] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [methodFilter, setMethodFilter] = useState(initialTab ?? 'all');
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [selected, setSelected] = useState<PublicOpportunityResponse | null>(null);
  const [oppPage, setOppPage] = useState(1);
  const OPP_PAGE_SIZE = 10;

  const list = opportunities.data?.data ?? [];
  const methods = Array.from(new Set(list.map((o) => o.method).filter(Boolean) as string[]));
  const categories = [
    '全部',
    ...Array.from(new Set(list.flatMap((o) => (o.categories ?? '').split('、')).filter(Boolean))),
  ];
  const filtered = list.filter((o) => {
    if (methodFilter !== 'all' && o.method !== methodFilter) return false;
    if (categoryFilter !== '全部' && !(o.categories ?? '').includes(categoryFilter)) return false;
    const kw = keyword.trim().toLowerCase();
    if (kw && ![o.title, o.buyerName, o.id].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
    return true;
  });

  if (selected) {
    return <OpportunityDetail opportunity={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* 头部面板:标题 + 方式页签 + 搜索 + 品类筛选 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-slate-950">
          <PackageSearch size={24} className="text-blue-600" />
          商机与公告
        </h1>
        <p className="mt-1.5 text-sm font-bold text-slate-500">询比 · 竞价 · 招标项目公开信息与采购/平台公告,全部实时数据</p>
        <div className="mt-5">
          <FilterTabs
            items={[
              { id: 'all', label: '全部商机', count: list.length },
              ...methods.map((m) => ({ id: m, label: `${m}采购`, count: list.filter((o) => o.method === m).length })),
              { id: 'ann', label: '公告中心' },
            ]}
            value={methodFilter}
            onChange={(id) => { setMethodFilter(id); setOppPage(1); }}
          />
        </div>
        {methodFilter !== 'ann' && (<>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setKeyword(searchDraft);
            setOppPage(1);
          }}
        >
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="搜索项目名称、采购方、项目编号…"
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            type="submit"
            className="inline-flex h-11 shrink-0 items-center rounded-lg bg-blue-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.98]"
          >
            搜索
          </button>
        </form>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-400">物资分类:</span>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { setCategoryFilter(c); setOppPage(1); }}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                c === categoryFilter
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {c}
            </button>
          ))}
        </div>
        </>)}
      </section>

      {methodFilter === 'ann' ? (
        <div className="mt-5">
          <PortalAnnouncementsPage embedded />
        </div>
      ) : (
      <div className="mt-5">
        {opportunities.isLoading ? (
          <FeedbackNotice tone="info" message="正在加载商机…" />
        ) : filtered.length === 0 ? (
          <FeedbackNotice tone="info" message={keyword || methodFilter !== 'all' || categoryFilter !== '全部' ? '没有符合条件的商机。' : '暂无公开商机,采购人发布项目后展示在此。'} />
        ) : (
          <>
          <div className="space-y-3">
            {filtered.slice((oppPage - 1) * OPP_PAGE_SIZE, oppPage * OPP_PAGE_SIZE).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelected(o)}
                className={cn('flex w-full items-center gap-5 rounded-xl border-l-4 border border-slate-200 bg-white px-6 py-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md',
                  o.method === '招标' ? 'border-l-blue-500' : o.method === '竞价' ? 'border-l-amber-400' : 'border-l-emerald-400')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className={cn('shrink-0 rounded-md px-2.5 py-1 text-xs font-black', OPPORTUNITY_STATUS_TONE[o.status ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                      {opportunityStatusLabel(o)}
                    </span>
                    <span className="shrink-0 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-600">{o.method}采购</span>
                  </div>
                  <p className="mt-2.5 truncate text-xl font-black leading-snug text-slate-950">{o.title}</p>
                  <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-slate-50 pt-3 text-xs font-bold text-slate-400">
                    <span className="inline-flex items-center gap-1.5"><Users size={13} />{o.buyerName}</span>
                    {o.categories && <span>{o.categories}</span>}
                    <span className="inline-flex items-center gap-1.5"><CalendarDays size={13} />发布于 {dateText(o.createdAt)}</span>
                    {(o.status === '报价中' || o.status === '发售中') && <span className="font-black text-amber-600">{deadlineText(o.deadlineAt)}</span>}
                  </p>
                </div>
                <div className="shrink-0 border-l border-slate-100 pl-5 text-right">
                  <p className="text-[11px] font-black text-slate-400">预算金额</p>
                  <p className="mt-1 font-mono text-2xl font-black tracking-tight text-slate-950">
                    {(o.budget ?? 0) > 0 ? `¥${Math.round((o.budget ?? 0) / 10000).toLocaleString('zh-CN')}万` : '公开'}
                  </p>
                </div>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <ArrowLeft size={17} className="rotate-180" />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <Pagination page={oppPage} pageSize={OPP_PAGE_SIZE} total={filtered.length} onPageChange={setOppPage} />
          </div>
          </>
        )}
      </div>
      )}
    </div>
  );
}

// 商机详情(二级):正文分节 + 右侧关键信息卡与报名操作,布局参考原型、规范沿用系统。
function OpportunityDetail({
  opportunity: o,
  onBack,
}: {
  opportunity: PublicOpportunityResponse;
  onBack: () => void;
}) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const isTender = o.method === '招标';
  const enrollable = !isTender && o.status === '报价中';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-black text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} /> 返回大厅
      </button>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* 主栏 */}
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50 sm:p-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className={cn('rounded-md px-2.5 py-1 text-xs font-black', OPPORTUNITY_STATUS_TONE[o.status ?? ''] ?? 'bg-slate-100 text-slate-600')}>
              {opportunityStatusLabel(o)}
            </span>
            <span className="rounded-md bg-violet-50 px-2.5 py-1 text-xs font-black text-violet-600">{o.method}采购</span>
            <span className="font-mono text-xs font-bold text-slate-400">项目编号:{o.id}</span>
          </div>
          <h1 className="mt-4 break-words text-2xl font-black leading-snug text-slate-950 sm:text-3xl">{o.title}</h1>

          {isTender ? (
            <>
              <DetailSection index={1} title="招标文件获取">
                {'招标文件正文须在供应商工作台「招标项目」中领取后查阅(公开招标发售期内可自助领取)。'}
              </DetailSection>
              <DetailSection index={2} title="投标与开标">
                {'投标递交即加密密封(SHA-256 指纹凭证),开标前招标人不可见内容;到达约定开标时间后统一解封唱标并公示指纹核验结果。'}
              </DetailSection>
              <DetailSection index={3} title="参与须知">
                {`3.1 本项目评标办法为「${o.evaluationMethod ?? '—'}」。\n3.2 已入驻并通过平台认证的供应商,登录供应商工作台即可领取文件并在递交截止前完成投标。\n3.3 尚未入驻的企业,请先完成供应商入驻与认证。`}
              </DetailSection>
            </>
          ) : (
            <>
          <DetailSection index={1} title="采购内容与报价要求">
            {o.quoteRequirement || '详见报价邀请;受理报名后可在供应商门户查看完整要求。'}
          </DetailSection>
          <DetailSection index={2} title="交付与商务要求">
            {o.deliveryRequirement || '以正式询价函为准。'}
          </DetailSection>
          <DetailSection index={3} title="报名与参与须知">
            {`3.1 本项目评选方式为「${o.evaluationMethod ?? '—'}」。\n3.2 已入驻并通过平台认证的供应商,报名经采购方受理后将收到正式询价邀请,可在供应商门户直接报价。\n3.3 尚未入驻的企业,报名后由采购方引导完成入驻与准入,再进入报价环节。`}
          </DetailSection>
            </>
          )}
        </section>

        {/* 侧栏:关键信息 + 报名 */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <p className="text-base font-black text-slate-950">项目关键信息</p>
            <dl className="mt-4 space-y-4">
              <SideFact icon={Users} label="采购单位" value={o.buyerName ?? '—'} />
              <SideFact
                icon={PackageSearch}
                label="项目预算"
                value={(o.budget ?? 0) > 0 ? `¥${Math.round((o.budget ?? 0) / 10000).toLocaleString('zh-CN')}万` : '公开征集'}
                em
              />
              {o.categories && <SideFact icon={Store} label="物资分类" value={o.categories} />}
              <SideFact icon={CalendarDays} label="发布时间" value={dateText(o.createdAt)} />
              {enrollable && (
                <SideFact icon={Timer} label="报价截止" value={`${dateText(o.deadlineAt)} · ${deadlineText(o.deadlineAt)}`} />
              )}
              {isTender && o.status === '发售中' && (
                <SideFact icon={Timer} label="投标递交截止" value={`${dateText(o.deadlineAt)} · ${deadlineText(o.deadlineAt)}`} />
              )}
            </dl>
            <div className="mt-5 border-t border-slate-100 pt-4">
              {enrollable ? (
                <button
                  type="button"
                  onClick={() => setEnrollOpen((v) => !v)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.98]"
                >
                  <Send size={15} /> {enrollOpen ? '收起报名表' : '立即报名'}
                </button>
              ) : isTender ? (
                <FeedbackNotice tone="info" message={o.status === '发售中'
                  ? '公开招标项目:请登录供应商工作台,在「招标项目」中领取招标文件并在递交截止前完成加密投标。'
                  : `该招标项目当前为「${opportunityStatusLabel(o)}」。`} />
              ) : (
                <FeedbackNotice tone="info" message={`该项目当前为「${opportunityStatusLabel(o)}」,报名已结束。`} />
              )}
            </div>
          </section>
          {enrollable && enrollOpen && (
            <section className="rounded-lg border border-blue-100 bg-blue-50/30 p-5">
              <p className="text-sm font-black text-slate-950">报名参与</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                填写企业与联系人信息;采购方受理后将发出正式询价邀请。
              </p>
              <div className="mt-4">
                <EnrollForm rfqId={o.id!} />
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

// 正文分节:序号 + 左侧蓝条标题(布局参考原型)。
function DetailSection({ index, title, children }: { index: number; title: string; children: string }) {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-2.5">
        <span className="h-5 w-1 shrink-0 rounded-full bg-blue-600" />
        <h2 className="text-base font-black text-slate-950">{index}. {title}</h2>
      </div>
      <p className="mt-3 whitespace-pre-wrap pl-3.5 text-sm font-semibold leading-7 text-slate-700">
        {children.replace(/\\n/g, '\n')}
      </p>
    </div>
  );
}

function SideFact({
  icon: Icon,
  label,
  value,
  em = false,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  em?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-black text-slate-400">{label}</dt>
      <dd className={cn('mt-1 flex items-start gap-1.5 break-words font-black text-slate-950', em ? 'text-2xl' : 'text-sm')}>
        <Icon size={em ? 18 : 14} className="mt-1 shrink-0 text-slate-400" />
        <span className="min-w-0">{value}</span>
      </dd>
    </div>
  );
}

// 公开商城页:品类分布与精选商品为真实在架数据;协议价按租户隔离,登录后可见。
export function PortalMallPage({ onLogin }: { onLogin: () => void }) {
  const overview = usePublicMallOverview();
  const data = overview.data?.data;
  const categoryIcons = [FileText, Monitor, Wrench, Gift, SlidersHorizontal, Store];
  const categoryTones = [
    'bg-blue-50 text-blue-600',
    'bg-violet-50 text-violet-600',
    'bg-amber-50 text-amber-600',
    'bg-rose-50 text-rose-600',
    'bg-emerald-50 text-emerald-600',
    'bg-slate-100 text-slate-600',
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Hero:深色横幅 + 登录查看协议价 */}
      <section className="relative overflow-hidden rounded-lg bg-slate-950 px-6 py-14 text-center shadow-sm sm:px-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(37,99,235,0.3),transparent_40%),radial-gradient(circle_at_75%_70%,rgba(124,58,237,0.22),transparent_36%)]" />
        <div className="relative">
          <h1 className="text-3xl font-black text-white sm:text-4xl">智采云企业商城</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold leading-7 text-slate-400">
            平台认证供应商的协议价货架,为企业提供协议价采购、统一结算、阳光透明的一站式物资采购体验。
          </p>
          <button
            type="button"
            onClick={onLogin}
            className="mt-7 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-sm font-black text-slate-950 shadow-sm transition hover:bg-slate-100 active:scale-[0.98]"
          >
            <Lock size={15} /> 登录查看企业专属价
          </button>
        </div>
      </section>

      {/* 热门品类:真实在架统计 */}
      <h2 className="mt-10 text-xl font-black text-slate-950">热门品类</h2>
      {overview.isLoading ? (
        <div className="mt-4"><FeedbackNotice tone="info" message="正在加载品类…" /></div>
      ) : (data?.categories ?? []).length === 0 ? (
        <div className="mt-4"><FeedbackNotice tone="info" message="暂无在架商品,供应商发布协议价货架后展示在此。" /></div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {(data?.categories ?? []).slice(0, 5).map((c, index) => {
            const Icon = categoryIcons[index % categoryIcons.length];
            return (
              <button
                key={c.category}
                type="button"
                onClick={onLogin}
                className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <span className={cn('mx-auto flex h-12 w-12 items-center justify-center rounded-lg', categoryTones[index % categoryTones.length])}>
                  <Icon size={22} />
                </span>
                <p className="mt-4 text-sm font-black text-slate-950">{c.category}</p>
                <p className="mt-1 font-mono text-xs font-bold text-slate-400">{c.listingCount} 款在架</p>
              </button>
            );
          })}
        </div>
      )}

      {/* 精选商品:真实在架商品,价格登录可见 */}
      <h2 className="mt-10 text-xl font-black text-slate-950">精选商品</h2>
      {(data?.featured ?? []).length === 0 ? (
        <div className="mt-4"><FeedbackNotice tone="info" message="暂无精选商品。" /></div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(data?.featured ?? []).map((item) => (
            <div key={item.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200">
              <span className="flex h-24 items-center justify-center rounded-lg bg-slate-50 text-slate-300">
                <Store size={30} />
              </span>
              <p className="mt-4 truncate text-sm font-black text-slate-950">{item.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{item.category} · 按{item.unit}计</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">协议价登录可见</span>
                <button type="button" onClick={onLogin} className="text-xs font-black text-blue-600 hover:text-blue-700">
                  登录查看 →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 首页「最新商机」真实数据板块:最新 6 条公开商机。
export function HomeOpportunitiesSection({ onOpenHall }: { onOpenHall: () => void }) {
  const opportunities = usePublicOpportunityList();
  const list = (opportunities.data?.data ?? []).slice(0, 6);

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <PackageSearch size={28} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-black text-slate-700">暂无公开商机</p>
        <p className="mt-1 text-xs font-bold text-slate-400">采购人发布询价/竞价项目后,将在此公开展示。</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {list.map((o) => (
        <button key={o.id} type="button" onClick={onOpenHall}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30">
          <div className="flex gap-2">
            <span className={cn('rounded-md px-2 py-1 text-[11px] font-black', OPPORTUNITY_STATUS_TONE[o.status ?? ''] ?? 'bg-slate-100 text-slate-600')}>
              {opportunityStatusLabel(o)}
            </span>
            <span className="rounded-md bg-violet-50 px-2 py-1 text-[11px] font-black text-violet-600">{o.method}采购</span>
          </div>
          <h3 className="mt-4 line-clamp-2 min-h-12 text-sm font-black leading-6 text-slate-950">{o.title}</h3>
          <div className="mt-5 flex items-center justify-between gap-3 text-xs font-bold text-slate-400">
            <span className="inline-flex min-w-0 items-center gap-1.5"><Users size={14} className="shrink-0" /><span className="truncate">{o.buyerName}</span></span>
            <span className="shrink-0">{dateText(o.createdAt)}</span>
          </div>
        </button>
      ))}
    </div>
  );
}



// 供应商入驻申请:提交后进入平台企业审核工作流(待初审→初审通过→准入通过→开通账号)。
export function PortalSupplierRegisterPage() {
  const register = usePublicPortalRegisterSupplier();
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    creditCode: '',
    legalPerson: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    businessScope: '',
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const ready =
    form.companyName.trim() && form.industry.trim() && form.creditCode.trim() && form.legalPerson.trim()
    && form.contactName.trim() && form.contactPhone.trim() && form.contactEmail.trim();

  const steps = [
    { title: '提交申请', desc: '填写企业与联系人信息' },
    { title: '平台初审', desc: '运营团队核对基础资料' },
    { title: '复审准入', desc: '资料与风险双确认后准入' },
    { title: '开通账号', desc: '通过后平台联系开通登录账号' },
  ];

  const inputCls =
    'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  if (done) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
        <h1 className="mt-5 text-2xl font-black text-slate-950">入驻申请已提交</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-bold leading-6 text-slate-500">
          平台运营团队将按「初审 → 复审准入」流程审核您的资料;
          审核结果与账号开通信息将通过预留的联系方式通知({form.contactEmail} / {form.contactPhone})。
        </p>
        <div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className={cn('rounded-lg border p-3', index === 0 ? 'border-emerald-100 bg-emerald-50' : 'border-slate-200 bg-white')}>
              <p className={cn('text-xs font-black', index === 0 ? 'text-emerald-700' : 'text-slate-700')}>{index + 1}. {step.title}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{index === 0 ? '已完成' : step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-7">
        <h1 className="flex items-center gap-2.5 text-2xl font-black text-slate-950">
          <Store size={24} className="text-blue-600" />
          供应商入驻申请
        </h1>
        <p className="mt-1.5 text-sm font-bold text-slate-500">
          提交后进入平台准入审核,通过后即可参与询价、竞价与商城供货
          <span className="ml-2 text-xs text-slate-400">(<span className="text-red-500">*</span> 为必填项)</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* 流程说明 */}
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">入驻流程</p>
            <div className="mt-4 space-y-5 border-l border-slate-200 pl-4">
              {steps.map((step, index) => (
                <div key={step.title} className="relative">
                  <span className={cn('absolute -left-[1.28rem] top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black', index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500')}>
                    {index + 1}
                  </span>
                  <p className="text-sm font-black text-slate-900">{step.title}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-blue-100 bg-blue-50/40 p-4 text-xs font-bold leading-5 text-slate-600">
            准入通过后,贵司将进入平台认证供应商名录;采购方可在其供应商库中与贵司建立合作,
            并通过询价邀请、商机报名受理等方式向贵司发起业务。
          </section>
        </aside>

        {/* 申请表单 */}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            register.mutate(
              { data: { ...form, businessScope: form.businessScope || undefined } },
              {
                onSuccess: () => setDone(true),
                onError: (err) =>
                  setError(
                    (err as { response?: { data?: { message?: string } } }).response?.data?.message
                      ?? '提交失败,请稍后重试',
                  ),
              },
            );
          }}
        >
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">企业信息</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>企业名称</span>
                <input className={cn(inputCls, 'mt-1.5')} placeholder="与营业执照一致的企业全称" value={form.companyName} onChange={(e) => set('companyName')(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>所属行业</span>
                <input className={cn(inputCls, 'mt-1.5')} placeholder="如:机电设备" value={form.industry} onChange={(e) => set('industry')(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>统一社会信用代码</span>
                <input className={cn(inputCls, 'mt-1.5')} placeholder="91xxxxxxxxxxxxxxxx" value={form.creditCode} onChange={(e) => set('creditCode')(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>法定代表人</span>
                <input className={cn(inputCls, 'mt-1.5')} value={form.legalPerson} onChange={(e) => set('legalPerson')(e.target.value)} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-black text-slate-500">经营范围(选填)</span>
                <textarea className="mt-1.5 min-h-[72px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  placeholder="主营产品与服务范围" value={form.businessScope} onChange={(e) => set('businessScope')(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-black text-slate-950">联系人信息</p>
            <p className="mt-1 text-xs font-bold text-slate-400">审核结果与账号开通信息将通过以下联系方式通知</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>联系人姓名</span>
                <input className={cn(inputCls, 'mt-1.5')} value={form.contactName} onChange={(e) => set('contactName')(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>联系电话</span>
                <input className={cn(inputCls, 'mt-1.5')} value={form.contactPhone} onChange={(e) => set('contactPhone')(e.target.value)} />
              </label>
              <label className="block">
                <span className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>联系邮箱</span>
                <input className={cn(inputCls, 'mt-1.5')} value={form.contactEmail} onChange={(e) => set('contactEmail')(e.target.value)} />
              </label>
            </div>
          </section>

          {error && <FeedbackNotice tone="error" message={error} />}
          <button
            type="submit"
            disabled={!ready || register.isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-black text-white shadow-sm transition hover:bg-blue-500 active:scale-[0.98] disabled:bg-blue-200 sm:w-auto sm:px-10"
          >
            <Send size={15} /> {register.isPending ? '提交中…' : '提交入驻申请'}
          </button>
        </form>
      </div>
    </div>
  );
}
