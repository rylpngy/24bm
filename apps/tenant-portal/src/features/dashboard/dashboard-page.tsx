import { useMemo, type ElementType } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  PackageCheck,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Truck,
  Users,
  Timer,
  WalletCards,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useBuyerAnalyticsProcurement, useBuyerWorkspaceLoad } from '@24bid/api-client';
import { MiniFact, Panel, ShellState, StatusPill, cn } from '@24bid/ui';
import { BuyerNotifications } from './buyer-notifications';

const currency = (v: number, compact = false) =>
  compact
    ? `¥${(v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`
    : `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

const shortDate = (value?: string) => value?.slice(0, 10) ?? '待定';

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    // min-w-0:栅格子项默认 min-width:auto,长编号/长标题会把整列撑破(移动端横向滚动的主因)。
    <section className={cn('min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50', className)}>
      {children}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0 text-blue-600" />
          <h2 className="truncate text-base font-black text-slate-950">{title}</h2>
        </div>
        {subtitle && <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function ActionTile({
  icon: Icon,
  title,
  desc,
  module,
  tone,
  onNavigate,
}: {
  icon: ElementType;
  title: string;
  desc: string;
  module: string;
  tone: string;
  onNavigate: (moduleId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(module)}
      className="group flex min-h-[5.5rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:bg-slate-50"
    >
      <span className={cn('flex h-11 w-11 items-center justify-center rounded-lg', tone)}>
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-slate-900">{title}</span>
        <span className="mt-1 block text-xs font-bold text-slate-400">{desc}</span>
      </span>
    </button>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  desc,
  trend,
  tone,
  negative,
}: {
  icon: ElementType;
  label: string;
  value: string;
  desc: string;
  trend: string;
  tone: string;
  negative?: boolean;
}) {
  return (
    <Card className="p-3">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
          <Icon size={18} />
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-1 text-[11px] font-black',
            negative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600',
          )}
        >
          {trend}
        </span>
      </div>
      <p className="mt-3 text-[11px] font-black text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{desc}</p>
    </Card>
  );
}

function NoticeItem({
  icon: Icon,
  title,
  desc,
  time,
  tone,
}: {
  icon: ElementType;
  title: string;
  desc: string;
  time: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-500">{desc}</p>
      </div>
      <span className="shrink-0 text-[11px] font-black text-slate-400">{time}</span>
    </div>
  );
}

function ProgressRow({
  tag,
  title,
  meta,
  progress,
  tone,
}: {
  tag: string;
  title: string;
  meta: string;
  progress: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-black', tone)}>
        {tag}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-400">{meta}</p>
      </div>
      <div className="hidden w-28 shrink-0 items-center gap-2 sm:flex">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
        <span className="w-8 text-right text-[11px] font-black text-slate-400">{progress}%</span>
      </div>
      <ArrowRight size={16} className="shrink-0 text-slate-300" />
    </div>
  );
}

function SpendBar({
  label,
  value,
  max,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  tone: string;
}) {
  const width = max > 0 ? Math.max(8, Math.round((value / max) * 100)) : 8;
  return (
    <div className="grid grid-cols-[4rem_1fr] items-center gap-3">
      <span className="truncate text-xs font-bold text-slate-500">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function DashboardPage({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  const ws = useBuyerWorkspaceLoad();
  const analytics = useBuyerAnalyticsProcurement();
  const categorySpend = analytics.data?.data?.categorySpend;
  const monthlySpend = analytics.data?.data?.monthlySpend;
  const biddingSavings = analytics.data?.data?.biddingSavings;
  const data = ws.data?.data;

  const view = useMemo(() => {
    const demands = data?.demands ?? [];
    const rfqs = data?.rfqs ?? [];
    const orders = data?.orders ?? [];
    const invoices = data?.invoices ?? [];
    const suppliers = data?.suppliers ?? [];
    const pendingApprovals = data?.pendingApprovals ?? [];

    const totalSpend = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
    const approvedBudget = demands
      .filter((demand) => demand.status === '已通过')
      .reduce((sum, demand) => sum + (demand.budget ?? 0), 0);
    const budgetRate = approvedBudget > 0 ? Math.min(99, Math.round((totalSpend / approvedBudget) * 100)) : 0;
    const activeRfqs = rfqs.filter((rfq) => ['报价中', '定标审批中'].includes(rfq.status ?? '')).length;
    const activeProjects = rfqs.filter((rfq) => rfq.status !== '已关闭').length + orders.filter((order) => order.status !== '已收货').length;
    const admittedSuppliers = suppliers.filter((supplier) => supplier.status === '已准入').length;
    const pendingPaymentAmount = invoices
      .filter((invoice) => invoice.paymentStatus === '待付款')
      .reduce((sum, invoice) => sum + (invoice.amount ?? 0), 0);
    // 节约成本 = 比价节支(后端按报价对比真实聚合),不再用系数编造。
    const saving = Math.max(0, Math.round(biddingSavings ?? 0));

    // 支出趋势 = 后端月度订单聚合(真实数据),不再使用写死基线。
    const trend = (monthlySpend ?? []).slice(-6).map((m) => ({
      month: m.period ?? '',
      actual: Math.round((m.totalAmount ?? 0) / 1000),
      orders: m.orderCount ?? 0,
    }));

    const todos = [
      ...pendingApprovals.slice(0, 3).map((task) => ({
        title: task.summaryTitle ?? '审批任务',
        desc: `${task.bizType ?? '业务'} · ${task.businessStatus ?? task.status ?? '待处理'}`,
        time: shortDate(task.createdAt),
        tone: 'bg-blue-50 text-blue-600',
      })),
      ...(activeRfqs > 0
        ? [{ title: '询比方案待跟进', desc: `${activeRfqs} 个询比项目仍在报价或定标中`, time: '今日', tone: 'bg-violet-50 text-violet-600' }]
        : []),
      ...(pendingPaymentAmount > 0
        ? [{ title: '付款登记待处理', desc: `待付款金额 ${currency(pendingPaymentAmount, true)}`, time: '本周', tone: 'bg-amber-50 text-amber-600' }]
        : []),
    ].slice(0, 4);

    const risks = [
      ...invoices
        .filter((invoice) => (invoice.varianceAmount ?? 0) > 0 || invoice.reconciliationStatus === '金额差异')
        .slice(0, 1)
        .map((invoice) => ({
          tone: 'red',
          title: '发票存在对账差异',
          desc: `${invoice.invoiceNo ?? invoice.id} 差异 ${currency(invoice.varianceAmount ?? 0)}`,
        })),
      ...rfqs
        .filter((rfq) => rfq.status === '报价中')
        .slice(0, 1)
        .map((rfq) => ({
          tone: 'amber',
          title: '询比仍在报价中',
          desc: `${rfq.title ?? rfq.id} · 截止 ${shortDate(rfq.deadlineAt)}`,
        })),
    ];

    const projects = [
      ...rfqs.slice(0, 3).map((rfq, index) => ({
        tag: index === 0 ? '询比' : index === 1 ? '竞价' : '评标',
        title: rfq.title ?? rfq.id ?? '询比项目',
        meta: `${shortDate(rfq.deadlineAt)} 截止 · ${rfq.status ?? '进行中'}`,
        progress: rfq.status === '已定标' ? 90 : rfq.status === '报价中' ? 65 : 40,
        tone: index === 0 ? 'bg-blue-50 text-blue-600' : index === 1 ? 'bg-orange-50 text-orange-600' : 'bg-violet-50 text-violet-600',
      })),
      ...orders.slice(0, 1).map((order) => ({
        tag: '订单',
        title: `采购订单 ${order.id}`,
        meta: `${shortDate(order.expectedReceiptDate)} 到货 · ${order.status ?? '执行中'}`,
        progress: order.status === '已收货' ? 100 : order.status === '已发货' ? 70 : 45,
        tone: 'bg-emerald-50 text-emerald-600',
      })),
    ].slice(0, 4);

    // 品类支出来自后端聚合(需求行项 × 物料参考价,按物料分类),替代此前的前端硬编码启发式。
    const spendTones = ['bg-blue-600', 'bg-emerald-500', 'bg-amber-500', 'bg-violet-500'];
    const spendDistribution = (categorySpend ?? []).slice(0, 4).map((c, index) => ({
      label: c.category ?? '其他',
      value: c.totalAmount ?? 0,
      tone: spendTones[index % spendTones.length],
    }));

    const pendingDemandCount = demands.filter((demand) => demand.status === '审批中').length;
    const receivingOrderCount = orders.filter((order) => order.status !== '已收货').length;
    const deadlineWatch = rfqs
      .filter((rfq) => rfq.status === '报价中' && rfq.deadlineAt)
      .sort((a, b) => (a.deadlineAt ?? '').localeCompare(b.deadlineAt ?? ''))
      .slice(0, 2)
      .map((rfq) => ({
        title: rfq.title ?? rfq.id ?? '询比项目',
        deadlineAt: rfq.deadlineAt,
        quotes: (rfq.quotes ?? []).length,
        invited: (rfq.invitedSupplierIds ?? []).length,
      }));

    return {
      totalSpend,
      budgetRate,
      activeRfqs,
      activeProjects,
      admittedSuppliers,
      saving,
      todos,
      risks,
      projects,
      trend,
      spendDistribution,
      pendingCount: data?.todoSummary?.pendingApprovalCount ?? pendingApprovals.length,
      pendingPaymentAmount,
      pendingDemandCount,
      receivingOrderCount,
      deadlineWatch,
    };
  }, [data, categorySpend, monthlySpend, biddingSavings]);

  if (ws.isLoading) {
    return <ShellState variant="loading" title="正在加载采购人首页" desc="拉取采购概览、待办与风险预警…" />;
  }

  return (
    <Panel title="首页看板" icon={BarChart3} subtitle="采购金额、待办、履约进度">
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <ClipboardCheck size={17} />
                  </span>
                  <div>
                    <h1 className="text-lg font-black text-slate-950">下午好，采购负责人</h1>
                    <p className="mt-0.5 text-xs font-bold text-slate-400">采购工作台今日运行正常</p>
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
                  您有 {view.pendingCount} 项待办审批，{view.activeRfqs} 个询比项目需要关注。系统已按采购需求、询比、订单、发票与审批任务自动汇总。
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate('approvals')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                >
                  <ClipboardCheck size={14} /> 处理待办 ({view.pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('analytics')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                >
                  <Sparkles size={14} /> 查看 AI 报告
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <MiniFact label="待办审批" value={`${view.pendingCount} 项`} />
              <MiniFact label="活跃询比" value={`${view.activeRfqs} 个`} />
              <MiniFact label="待付款金额" value={currency(view.pendingPaymentAmount, true)} />
              <MiniFact label="审批中需求" value={`${view.pendingDemandCount} 条`} />
              <MiniFact label="履约中订单" value={`${view.receivingOrderCount} 单`} />
              <MiniFact label="已准入供应商" value={`${view.admittedSuppliers} 家`} />
            </div>
            {/* 临近截止:报价中项目按截止时间排序,直达询比项目处理。 */}
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-amber-800">
                <Timer size={13} /> 临近截止
              </p>
              {view.deadlineWatch.length === 0 ? (
                <p className="mt-1.5 text-xs font-bold text-slate-500">暂无报价中的项目,当前没有临近截止事项。</p>
              ) : (
                <div className="mt-1.5 space-y-1.5">
                  {view.deadlineWatch.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => onNavigate('rfqs')}
                      className="flex w-full flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 py-0.5 text-left transition hover:bg-amber-50"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-black text-slate-900">{item.title}</span>
                      <span className="shrink-0 text-[11px] font-bold text-slate-500">
                        已报价 {item.quotes}{item.invited > 0 ? `/${item.invited}` : ''} 家
                      </span>
                      <span className="shrink-0 font-mono text-[11px] font-black text-amber-700">
                        截止 {shortDate(item.deadlineAt)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <ActionTile icon={FilePlus2} title="发起立项" desc="创建采购需求" module="demands" tone="bg-blue-50 text-blue-600" onNavigate={onNavigate} />
            <ActionTile icon={Search} title="供应商寻源" desc="全网智能匹配" module="suppliers" tone="bg-violet-50 text-violet-600" onNavigate={onNavigate} />
            <ActionTile icon={Truck} title="订单跟踪" desc="查看物流状态" module="orders" tone="bg-orange-50 text-orange-600" onNavigate={onNavigate} />
            <ActionTile icon={BarChart3} title="数据分析" desc="查看支出报表" module="analytics" tone="bg-emerald-50 text-emerald-600" onNavigate={onNavigate} />
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={WalletCards}
            label="本年度累计支出"
            value={currency(view.totalSpend, true)}
            desc={`预算执行率 ${view.budgetRate}%`}
            trend={`订单 ${analytics.data?.data?.orderCount ?? '—'} 单`}
            tone="bg-blue-50 text-blue-600"
          />
          <KpiCard
            icon={Users}
            label="活跃供应商"
            value={String(view.admittedSuppliers)}
            desc={`供应商总数 ${(data?.suppliers ?? []).length} 家`}
            trend={`头部集中度 ${analytics.data?.data?.topSupplierSharePercent ?? '—'}%`}
            tone="bg-indigo-50 text-indigo-600"
          />
          <KpiCard
            icon={ShoppingCart}
            label="进行中项目"
            value={String(view.activeProjects)}
            desc={`${view.activeRfqs} 个询比需跟进`}
            trend={`${view.pendingCount} 项待审批`}
            tone="bg-violet-50 text-violet-600"
          />
          <KpiCard
            icon={ShieldCheck}
            label="累计节约成本"
            value={currency(view.saving, true)}
            desc="按定标价与最高报价差额聚合"
            trend={view.totalSpend > 0 ? `占支出 ${((view.saving / view.totalSpend) * 100).toFixed(1)}%` : '—'}
            tone="bg-emerald-50 text-emerald-600"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Card className="p-4">
          <SectionHeader icon={TrendingUp} title="采购支出趋势" subtitle="近 6 个月订单支出(千元) · 来源:采购分析聚合" />
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={view.trend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashboardSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700 }}
                  formatter={(value) => [`${value}k`, '']}
                />
                <Area type="monotone" dataKey="actual" stroke="#2563eb" fill="url(#dashboardSpend)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </Card>

          <Card className="p-4">
          <SectionHeader
            icon={Bell}
            title="待办事项"
            action={<span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">{view.todos.length}</span>}
          />
          <div className="mt-4">
            {view.todos.length === 0 ? (
              <ShellState variant="empty" title="暂无待办" desc="当前没有需要立即处理的事项。" />
            ) : (
              <div className="space-y-2">
                {view.todos.map((todo) => (
                  <NoticeItem
                    key={`${todo.title}-${todo.time}`}
                    icon={ClipboardCheck}
                    title={todo.title}
                    desc={todo.desc}
                    time={todo.time}
                    tone={todo.tone}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onNavigate('approvals')}
            className="mt-4 flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 transition hover:bg-slate-50"
          >
            进入审批中心
          </button>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <Card className="p-4">
          <SectionHeader
            icon={PackageCheck}
            title="进行中的项目"
            subtitle="进度按单据状态阶段推导"
            action={<button type="button" className="text-xs font-black text-blue-600" onClick={() => onNavigate('rfqs')}>查看全部</button>}
          />
          <div className="mt-5 space-y-3">
            {view.projects.map((project) => (
              <ProgressRow key={project.title} {...project} />
            ))}
          </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-4">
            <SectionHeader icon={AlertTriangle} title="风险预警" />
            <div className="mt-4 space-y-3">
              {view.risks.length === 0 ? (
                <NoticeItem
                  icon={ShieldCheck}
                  title="暂无高优先级风险"
                  desc="合同、对账与询比状态正常"
                  time="实时"
                  tone="bg-emerald-50 text-emerald-600"
                />
              ) : (
                view.risks.map((risk) => (
                  <NoticeItem
                    key={risk.title}
                    icon={AlertTriangle}
                    title={risk.title}
                    desc={risk.desc}
                    time="预警"
                    tone={
                      risk.tone === 'red'
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }
                  />
                ))
              )}
            </div>
            </Card>

            <Card className="p-4">
            <SectionHeader icon={Clock3} title="支出分布 (本月)" />
            <div className="mt-5 space-y-4">
              {view.spendDistribution.map((item) => (
                <SpendBar
                  key={item.label}
                  {...item}
                  max={Math.max(...view.spendDistribution.map((entry) => entry.value), 1)}
                />
              ))}
            </div>
            </Card>
          </div>
        </div>

        <BuyerNotifications />
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
          <StatusPill label="数据来自采购工作台" />
          <span>遵循统一列表页体验规约，数据实时来自采购工作台。</span>
        </div>
      </div>
    </Panel>
  );
}
