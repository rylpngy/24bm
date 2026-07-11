import { useMemo, useState } from 'react';
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, Megaphone, PackageSearch, Search, Send, Store, Timer, Users } from 'lucide-react';
import {
  type PublicAnnouncementResponse,
  type PublicOpportunityResponse,
  type PublicSupplierResponse,
  usePublicOpportunityEnroll,
  usePublicOpportunityList,
  usePublicPortalListAnnouncements,
  usePublicPortalListSuppliers,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

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
export function PortalAnnouncementsPage() {
  const announcements = usePublicPortalListAnnouncements();
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<PublicAnnouncementResponse | null>(null);

  const list = announcements.data?.data ?? [];
  const filtered = list.filter((a) => {
    const kw = keyword.trim().toLowerCase();
    return !kw || [a.title, a.content].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });

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
          <p className="mt-5 whitespace-pre-wrap break-words text-sm font-semibold leading-7 text-slate-700">
            {selected.content}
          </p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell icon={Megaphone} title="平台公告" subtitle="平台运营方发布的生效公告 · 实时数据">
      <div className="mb-5 flex justify-end">
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

      {announcements.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载平台公告…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword ? '没有符合条件的公告。' : '暂无生效公告。'} />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="w-full rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/20"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn('rounded-md px-2.5 py-1 text-xs font-black', AUDIENCE_TONE[a.audience ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {AUDIENCE_LABELS[a.audience ?? ''] ?? a.audience}
                </span>
                <p className="min-w-0 flex-1 truncate text-base font-black text-slate-950">{a.title}</p>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-400">
                  <CalendarDays size={14} /> {dateText(a.createdAt)}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{a.content}</p>
            </button>
          ))}
        </div>
      )}
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

// 首页「平台公告」真实数据条:最新 3 条生效公告。
export function HomeAnnouncementsStrip({ onOpenAll }: { onOpenAll: () => void }) {
  const announcements = usePublicPortalListAnnouncements();
  const list = (announcements.data?.data ?? []).slice(0, 3);
  if (list.length === 0) return null;

  return (
    <section className="bg-white py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-black text-slate-950">
              <Megaphone size={16} className="text-blue-600" /> 平台公告
            </p>
            <button type="button" onClick={onOpenAll} className="text-xs font-black text-blue-600 hover:text-blue-700">
              查看全部 →
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {list.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={onOpenAll}
                className="rounded-lg border border-white bg-white p-3 text-left shadow-sm transition hover:border-blue-200"
              >
                <p className="truncate text-sm font-black text-slate-900">{a.title}</p>
                <p className="mt-1 text-[11px] font-bold text-slate-400">
                  {AUDIENCE_LABELS[a.audience ?? ''] ?? a.audience} · {dateText(a.createdAt)}
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
  已开标: 'bg-blue-50 text-blue-700',
  定标审批中: 'bg-amber-50 text-amber-700',
  已定标: 'bg-slate-100 text-slate-600',
};

function opportunityStatusLabel(o: PublicOpportunityResponse) {
  if (o.status === '报价中') return '报名与报价中';
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
export function PortalOpportunitiesPage() {
  const opportunities = usePublicOpportunityList();
  const [keyword, setKeyword] = useState('');
  const [methodFilter, setMethodFilter] = useState('全部方式');
  const [selected, setSelected] = useState<PublicOpportunityResponse | null>(null);

  const list = opportunities.data?.data ?? [];
  const methods = ['全部方式', ...Array.from(new Set(list.map((o) => o.method).filter(Boolean) as string[]))];
  const filtered = list.filter((o) => {
    if (methodFilter !== '全部方式' && o.method !== methodFilter) return false;
    const kw = keyword.trim().toLowerCase();
    if (kw && ![o.title, o.buyerName, o.method].filter(Boolean).join(' ').toLowerCase().includes(kw)) return false;
    return true;
  });

  if (selected) {
    const enrollable = selected.status === '报价中';
    return (
      <PageShell
        icon={PackageSearch}
        title={selected.title ?? '商机详情'}
        subtitle={`${selected.buyerName ?? '采购方'} · ${selected.method ?? '询比'}采购 · 发布于 ${dateText(selected.createdAt)}`}
        onBack={() => setSelected(null)}
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-black', OPPORTUNITY_STATUS_TONE[selected.status ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {opportunityStatusLabel(selected)}
                </span>
                <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-black text-violet-600">{selected.method}采购</span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">评选:{selected.evaluationMethod ?? '—'}</span>
                {enrollable && (
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-black text-amber-600">
                    <Timer size={14} /> {deadlineText(selected.deadlineAt)} · 截止 {dateText(selected.deadlineAt)}
                  </span>
                )}
              </div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-400">采购内容与报价要求</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                    {selected.quoteRequirement || '详见报价邀请;受理报名后可在供应商门户查看完整要求。'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-400">交付与商务要求</p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                    {selected.deliveryRequirement || '以正式询价函为准。'}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-400">采购方</p>
                  <p className="mt-1.5 text-sm font-black text-slate-950">{selected.buyerName}</p>
                  <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">项目编号 {selected.id}</p>
                </div>
              </div>
            </section>
          </div>
          <aside>
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-base font-black text-slate-950">
                <Send size={16} className="text-blue-600" /> 报名参与
              </p>
              {enrollable ? (
                <>
                  <p className="mt-1.5 text-xs font-bold leading-5 text-slate-500">
                    填写企业与联系人信息完成报名;采购方受理后将发出正式询价邀请。
                  </p>
                  <div className="mt-4">
                    <EnrollForm rfqId={selected.id!} />
                  </div>
                </>
              ) : (
                <FeedbackNotice tone="info" message={`该项目当前为「${opportunityStatusLabel(selected)}」,报名已结束。`} />
              )}
            </section>
          </aside>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell icon={PackageSearch} title="商机大厅" subtitle="平台采购人发布的项目公开信息 · 实时数据">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {methods.map((m) => (
            <button key={m} type="button" onClick={() => setMethodFilter(m)}
              className={cn('h-8 rounded-md border px-3 text-xs font-black transition',
                m === methodFilter ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
              {m}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜索项目、采购方"
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      {opportunities.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载商机…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword || methodFilter !== '全部方式' ? '没有符合条件的商机。' : '暂无公开商机,采购人发布项目后展示在此。'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((o) => (
            <button key={o.id} type="button" onClick={() => setSelected(o)}
              className="rounded-lg border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
              <div className="flex items-center gap-2">
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-black', OPPORTUNITY_STATUS_TONE[o.status ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {opportunityStatusLabel(o)}
                </span>
                <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-black text-violet-600">{o.method}</span>
                {o.status === '报价中' && (
                  <span className="ml-auto text-[11px] font-black text-amber-600">{deadlineText(o.deadlineAt)}</span>
                )}
              </div>
              <p className="mt-3 line-clamp-2 min-h-11 text-sm font-black leading-6 text-slate-950">{o.title}</p>
              <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="truncate">{o.buyerName}</span>
                <span className="shrink-0">{dateText(o.createdAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </PageShell>
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

