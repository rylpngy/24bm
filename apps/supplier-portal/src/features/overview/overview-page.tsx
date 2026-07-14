import { useMemo, type ElementType } from 'react';
import {
  Banknote,
  Bell,
  ClipboardList,
  LayoutGrid,
  Send,
  Store,
  Timer,
  TrendingUp,
  Truck,
  WalletCards,
} from 'lucide-react';
import { useSupplierWorkspaceLoad } from '@24bid/api-client';
import { FeedbackNotice, MetricCard, MetricGrid, MiniFact, ShellState, StatusPill, cn } from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';

const currency = (v: number, compact = false) =>
  compact
    ? `¥${(v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`
    : `¥${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

const shortDate = (value?: string) => value?.slice(0, 10) ?? '待定';

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50', className)}>
      {children}
    </section>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ElementType;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <Icon size={16} className="shrink-0 text-blue-600" />
        <h2 className="truncate text-base font-black text-slate-950">{title}</h2>
      </div>
      {subtitle && <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>}
    </div>
  );
}

function TodoItem({
  icon: Icon,
  title,
  desc,
  time,
  tone,
  onClick,
}: {
  icon: ElementType;
  title: string;
  desc: string;
  time: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3 text-left transition hover:border-blue-200 hover:bg-white"
    >
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-slate-950">{title}</p>
        <p className="mt-0.5 truncate text-xs font-bold text-slate-500">{desc}</p>
      </div>
      <span className="shrink-0 text-[11px] font-black text-slate-400">{time}</span>
    </button>
  );
}

// 近6月成交趋势:真实订单按月聚合,CSS 条形与采购端 SpendBar 同一模式,不引入图表依赖。
function TrendBars({ data }: { data: { month: string; amount: number; orders: number }[] }) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.month} className="grid grid-cols-[3.5rem_1fr_7rem] items-center gap-3">
          <span className="font-mono text-xs font-bold text-slate-500">{d.month}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600"
              style={{ width: `${Math.max(4, Math.round((d.amount / max) * 100))}%` }}
            />
          </div>
          <span className="text-right font-mono text-xs font-black text-slate-700">
            {currency(d.amount, true)} · {d.orders}单
          </span>
        </div>
      ))}
    </div>
  );
}

// 供应商看板:欢迎横幅 + 经营指标 + 成交趋势/待办 + 通知,全部来自工作区真实聚合。
export function OverviewPage({ onNavigate }: { onNavigate: (moduleId: string) => void }) {
  const session = useAuthStore((s) => s.session);
  const ws = useSupplierWorkspaceLoad();
  const data = ws.data?.data;

  const view = useMemo(() => {
    const opportunities = data?.opportunities ?? [];
    const quotes = data?.quotes ?? [];
    const orders = data?.orders ?? [];
    const invoices = data?.invoices ?? [];
    const todo = data?.todoSummary;

    const quoting = opportunities
      .filter((r) => r.status === '报价中')
      .sort((a, b) => (a.deadlineAt ?? '').localeCompare(b.deadlineAt ?? ''));
    const dealAmount = orders.reduce((sum, o) => sum + (o.amount ?? 0), 0);
    const fulfillingOrders = orders.filter((o) => o.status !== '已收货');
    const receivable = invoices
      .filter((inv) => inv.paymentStatus === '待付款')
      .reduce((sum, inv) => sum + (inv.amount ?? 0), 0);
    const overdueCount = invoices.filter((inv) => inv.overdue).length;
    const awarded = opportunities.filter(
      (r) => r.status === '已定标' && r.awardedSupplierId && r.awardedSupplierId === session?.supplierId,
    ).length;
    const closed = opportunities.filter((r) => ['已定标', '已流标', '已废标'].includes(r.status ?? '')).length;

    // 成交趋势:订单创建月聚合(近6个自然月,含空月),真实数据不足时展示诚实空态。
    const byMonth = new Map<string, { amount: number; orders: number }>();
    orders.forEach((o) => {
      const m = o.createdAt?.slice(0, 7);
      if (!m) return;
      const cur = byMonth.get(m) ?? { amount: 0, orders: 0 };
      byMonth.set(m, { amount: cur.amount + (o.amount ?? 0), orders: cur.orders + 1 });
    });
    const trend = Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month, ...v }));

    const todos = [
      ...quoting.slice(0, 2).map((r) => ({
        icon: Send,
        title: r.title ?? r.id ?? '询价项目',
        desc: `报价中 · 已有 ${(r.quotes ?? []).length} 家报价`,
        time: `截止 ${shortDate(r.deadlineAt)}`,
        tone: 'bg-blue-50 text-blue-600',
        module: 'projects',
      })),
      ...((todo?.pendingOrderConfirmationCount ?? 0) > 0
        ? [{
            icon: ClipboardList,
            title: '销售订单待确认',
            desc: `${todo?.pendingOrderConfirmationCount} 个订单等待接单确认`,
            time: '尽快处理',
            tone: 'bg-violet-50 text-violet-600',
            module: 'orders',
          }]
        : []),
      ...((todo?.pendingShipmentCount ?? 0) > 0
        ? [{
            icon: Truck,
            title: '订单待发货',
            desc: `${todo?.pendingShipmentCount} 个订单已确认待发货`,
            time: '按交期发出',
            tone: 'bg-orange-50 text-orange-600',
            module: 'orders',
          }]
        : []),
      ...(receivable > 0
        ? [{
            icon: Banknote,
            title: '应收待回款',
            desc: `${currency(receivable, true)} 待采购方付款${overdueCount > 0 ? ` · ${overdueCount} 张逾期` : ''}`,
            time: '关注回款',
            tone: 'bg-emerald-50 text-emerald-600',
            module: 'invoices',
          }]
        : []),
    ].slice(0, 4);

    return {
      pendingQuoteCount: todo?.pendingQuoteCount ?? quoting.length,
      pendingOrderCount: todo?.pendingOrderConfirmationCount ?? 0,
      pendingShipmentCount: todo?.pendingShipmentCount ?? 0,
      quotesCount: quotes.length,
      dealAmount,
      ordersCount: orders.length,
      fulfillingCount: fulfillingOrders.length,
      receivable,
      overdueCount,
      awarded,
      winRate: closed > 0 ? Math.round((awarded / closed) * 100) : null,
      nearestDeadline: quoting[0]?.deadlineAt,
      trend,
      todos,
    };
  }, [data, session?.supplierId]);

  const notifications = data?.notifications ?? [];

  if (ws.isLoading) {
    return <ShellState variant="loading" title="正在加载供应商看板" desc="拉取商机、订单与应收数据…" />;
  }
  if (ws.isError) {
    return <ShellState variant="error" title="看板加载失败" desc="登录态可能已过期,请重新登录后重试。" />;
  }

  return (
    <div className="space-y-5">
      {/* 欢迎横幅(左)+ 快捷入口(右):对齐采购人看板布局 */}
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <LayoutGrid size={17} />
              </span>
              <div>
                <h1 className="text-lg font-black text-slate-950">
                  欢迎回来，{data?.profile?.name ?? session?.displayName ?? '供应商伙伴'}
                </h1>
                <p className="mt-0.5 text-xs font-bold text-slate-400">
                  商机 · 报价 · 订单履约 · 发票应收
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              您有 {view.pendingQuoteCount} 个商机待报价、{view.pendingOrderCount + view.pendingShipmentCount} 个订单待处理
              {view.receivable > 0 ? `，应收待回款 ${currency(view.receivable, true)}` : ''}。
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
            >
              <Send size={14} /> 参与报价 ({view.pendingQuoteCount})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
            >
              <Truck size={14} /> 订单发货
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <MiniFact label="待报价商机" value={`${view.pendingQuoteCount} 个`} />
          <MiniFact label="待确认订单" value={`${view.pendingOrderCount} 单`} />
          <MiniFact label="待发货订单" value={`${view.pendingShipmentCount} 单`} />
          <MiniFact label="已提交报价" value={`${view.quotesCount} 次`} />
          <MiniFact label="履约中订单" value={`${view.fulfillingCount} 单`} />
          <MiniFact label="逾期应收" value={`${view.overdueCount} 张`} />
        </div>
        {view.nearestDeadline && (
          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-black text-amber-800">
              <Timer size={13} /> 最近报价截止 {shortDate(view.nearestDeadline)}，请及时提交报价。
            </p>
          </div>
        )}
      </Card>

      {/* 快捷入口:高频业务直达(布局对齐采购人看板右侧动作列) */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {[
          { icon: Send, title: '项目管理', desc: '查看邀请并参与报价', module: 'projects', tone: 'bg-blue-50 text-blue-600' },
          { icon: Truck, title: '销售订单', desc: '确认、发货、开票', module: 'orders', tone: 'bg-orange-50 text-orange-600' },
          { icon: Store, title: '商城货架', desc: '协议价商品管理', module: 'shelf', tone: 'bg-violet-50 text-violet-600' },
          { icon: Banknote, title: '发票应收', desc: '开票与回款跟踪', module: 'invoices', tone: 'bg-emerald-50 text-emerald-600' },
        ].map((a) => (
          <button
            key={a.module}
            type="button"
            onClick={() => onNavigate(a.module)}
            className="group flex min-h-[4.5rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:bg-slate-50"
          >
            <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', a.tone)}>
              <a.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-slate-900">{a.title}</span>
              <span className="mt-1 block text-xs font-bold text-slate-400">{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
      </div>

      {/* 经营指标:全部为真实聚合值,无同比装饰 */}
      <MetricGrid>
        <MetricCard
          icon={WalletCards}
          label="累计成交金额"
          value={currency(view.dealAmount, true)}
          hint={`销售订单 ${view.ordersCount} 单`}
          tone="blue"
        />
        <MetricCard
          icon={Send}
          label="待报价商机"
          value={`${view.pendingQuoteCount}`}
          hint={view.nearestDeadline ? `最近截止 ${shortDate(view.nearestDeadline)}` : '暂无临近截止'}
          tone="violet"
        />
        <MetricCard
          icon={TrendingUp}
          label="近期中标"
          value={view.winRate != null ? `${view.winRate}%` : '—'}
          hint={`已中标 ${view.awarded} 个项目`}
          tone="emerald"
        />
        <MetricCard
          icon={Banknote}
          label="应收待回款"
          value={currency(view.receivable, true)}
          hint={view.overdueCount > 0 ? `${view.overdueCount} 张发票逾期` : '无逾期发票'}
          tone="amber"
        />
      </MetricGrid>

      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        {/* 成交趋势:订单按月聚合 */}
        <Card className="p-5">
          <SectionHeader icon={TrendingUp} title="成交趋势" subtitle="销售订单金额按月聚合(近6个月)" />
          <div className="mt-4">
            {view.trend.length === 0 ? (
              <FeedbackNotice tone="info" message="暂无成交订单。中标并生成订单后,这里展示按月成交趋势。" />
            ) : (
              <TrendBars data={view.trend} />
            )}
          </div>
        </Card>

        {/* 待办事项:真实业务待办,点击直达模块 */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <SectionHeader icon={ClipboardList} title="待办事项" />
            {view.todos.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white">
                {view.todos.length}
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {view.todos.length === 0 ? (
              <FeedbackNotice tone="info" message="当前没有待办事项。" />
            ) : (
              view.todos.map((t, i) => (
                <TodoItem
                  key={`${t.module}-${i}`}
                  icon={t.icon}
                  title={t.title}
                  desc={t.desc}
                  time={t.time}
                  tone={t.tone}
                  onClick={() => onNavigate(t.module)}
                />
              ))
            )}
          </div>
        </Card>
      </div>

      {/* 最新通知 */}
      <Card className="p-5">
          <SectionHeader icon={Bell} title="最新通知" subtitle="采购方协作消息" />
          <div className="mt-4 space-y-2">
            {notifications.length === 0 ? (
              <FeedbackNotice tone="info" message="暂无通知。" />
            ) : (
              notifications.slice(0, 6).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-900">{n.title}</p>
                    <p className="mt-0.5 break-words text-xs font-bold text-slate-500">{n.content}</p>
                  </div>
                  <StatusPill label={n.read ? '已读' : '未读'} />
                </div>
              ))
            )}
          </div>
        </Card>
    </div>
  );
}
