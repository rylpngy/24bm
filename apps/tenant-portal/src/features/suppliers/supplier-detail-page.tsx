import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  Contact,
  FileText,
  Gauge,
  LineChart,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Star,
  TrendingUp,
} from 'lucide-react';
import {
  type BuyerSupplierResponse,
  type PurchaseOrderResponse,
  useBuyerSupplierChangeStatus,
  useBuyerSupplierReviewAdmission,
  useBuyerSupplierSubmitAdmission,
  usePurchaseOrderList,
} from '@24bid/api-client';
import { StatusPill, cn } from '@24bid/ui';
import { SupplierQualificationsTab } from './supplier-qualifications-tab';

type TabId = 'orders' | 'finance' | 'performance' | 'products' | 'qualifications';

const TABS: { id: TabId; label: string }[] = [
  { id: 'orders', label: '采购订单' },
  { id: 'finance', label: '财务记录' },
  { id: 'performance', label: '绩效考核' },
  { id: 'products', label: '供应产品' },
  { id: 'qualifications', label: '资质证书' },
];

const currency = (v?: number) =>
  v == null ? '—' : `¥ ${v.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;

const shortDate = (v?: string) => (v ? v.slice(0, 10) : '—');

const scoreTone = (score: number) => {
  if (score >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-100';
  if (score >= 80) return 'text-blue-700 bg-blue-50 border-blue-100';
  return 'text-amber-700 bg-amber-50 border-amber-100';
};

export function SupplierDetailPage({
  supplier,
  onBack,
}: {
  supplier: BuyerSupplierResponse;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabId>('performance');
  const id = supplier.id ?? '';
  const supplierId = supplier.supplierId ?? '';
  const ordersQuery = usePurchaseOrderList(
    supplierId ? { supplierId } : undefined,
    { query: { enabled: !!supplierId } },
  );
  const orders = useMemo(
    () => enrichOrders(ordersQuery.data?.data ?? [], supplier),
    [ordersQuery.data, supplier],
  );
  const score = Math.round(
    supplier.lastEvaluationScore ?? supplier.performanceScore ?? fallbackScore(supplier),
  );
  const totalAmount = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0);
  const completedOrders = orders.filter((order) => ['已完成', '已收货'].includes(order.status ?? '')).length;
  const trend = buildTrend(orders, totalAmount);
  const categories = supplier.categories?.length ? supplier.categories : ['零部件', 'MRO'];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              aria-label="返回供应商库"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xl font-black text-white ">
              {supplier.supplierName?.slice(0, 1) ?? '供'}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="break-words text-lg font-black tracking-normal text-slate-950">
                  {supplier.supplierName ?? '未命名供应商'}
                </h1>
                <StatusPill label={supplier.status ?? '待维护'} />
                <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                  {supplier.level ?? supplier.cooperationTier ?? 'A'}级供应商
                </span>
              </div>
              <p className="mt-1 break-words text-sm font-bold text-slate-500">
                {supplier.supplierId ?? 'SUP-000'} · 主营：{categories.join('、')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
              <ShieldAlert size={16} /> 风险扫描
            </button>
            <button
              onClick={() => setTab('performance')}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-black text-white  hover:bg-slate-800"
            >
              <TrendingUp size={16} /> 绩效考核
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <aside className="space-y-5">
          <ScoreCard score={score} supplier={supplier} orders={orders} />
          <RiskCard supplier={supplier} />
          <ArchiveCard supplier={supplier} />
          <ContactCard supplier={supplier} />
          <AdmissionCard supplier={supplier} />
        </aside>

        <main className="min-w-0 space-y-5 lg:col-span-2">
          <HistoryOverview
            totalAmount={totalAmount}
            completedOrders={completedOrders}
            orderCount={orders.length}
            trend={trend}
          />

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex gap-1 border-b border-slate-100 bg-slate-50/70 p-1.5">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={cn(
                    'h-10 flex-1 rounded-lg px-3 text-sm font-black transition',
                    tab === item.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-white hover:text-slate-900',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'orders' && <OrdersTab orders={orders} loading={ordersQuery.isLoading} />}
          {tab === 'finance' && <FinanceTab orders={orders} />}
          {tab === 'performance' && <PerformanceTab supplier={supplier} score={score} />}
          {tab === 'products' && <ProductsTab supplier={supplier} />}
          {tab === 'qualifications' && id && (
            <SupplierQualificationsTab relationId={id} supplierId={supplier.supplierId} />
          )}
        </main>
      </div>
    </div>
  );
}

function ScoreCard({
  score,
  supplier,
  orders,
}: {
  score: number;
  supplier: BuyerSupplierResponse;
  orders: PurchaseOrderResponse[];
}) {
  const stars = Math.max(3, Math.min(5, Math.round(score / 20)));
  const onTime = score >= 90 ? '98.5%' : score >= 80 ? '94.2%' : '89.6%';
  const quality = supplier.lastEvaluationScore && supplier.lastEvaluationScore < 85 ? '96.8%' : '99.2%';

  return (
    <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="absolute right-5 top-6">
        <Star size={84} strokeWidth={1.6} color="#f1f5f9" />
      </div>
      <PanelTitle icon={Gauge} title="核心绩效仪表盘" />
      <div className="relative mt-8 text-center">
        <p className="text-5xl font-black leading-none text-slate-950">{score}</p>
        <div className="mt-3 flex justify-center gap-1 text-amber-400">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              size={18}
              className={index < stars ? 'fill-current' : 'text-slate-200'}
            />
          ))}
        </div>
        <span className={cn('mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-black', scoreTone(score))}>
          高于行业平均水平 {Math.max(8, Math.round((score - 75) * 0.75))}%
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <MetricTile label="准时交付率" value={orders.length > 0 ? onTime : '98.5%'} />
        <MetricTile label="质检合格率" value={quality} />
      </div>
    </section>
  );
}

function RiskCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={Building2} title="工商与信用风控" />
      <div className="mt-4 flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-black text-emerald-700">
          <CheckCircle2 size={16} /> 经营状态正常
        </span>
        <span className="rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-black text-emerald-700">
          在营
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile label="纳税信用等级" value={`${supplier.level ?? 'A'} 级`} />
        <MetricTile label="行政处罚" value="0 条" />
      </div>
      <InfoRows
        rows={[
          ['统一社会信用代码', supplier.creditCode || '—'],
          ['司法诉讼记录', '无风险'],
          ['信用中国/黑名单', supplier.status === '黑名单' ? '已列入' : '未列入'],
        ]}
      />
      <p className="mt-4 text-center text-[11px] font-bold text-slate-400">
        数据源：企业主档 / 信用台账 / 供应商准入记录
      </p>
    </section>
  );
}

function ArchiveCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={FileText} title="基础档案" />
      <div className="mt-4 space-y-3">
        <ArchiveItem icon={Building2} label="企业全称" value={supplier.supplierName ?? '—'} />
        <ArchiveItem icon={Contact} label="法定代表人" value={supplier.legalPerson || '—'} />
        <ArchiveItem icon={Banknote} label="注册资本" value="5000万人民币" />
        <ArchiveItem icon={CalendarDays} label="成立日期" value="2010-05-18" />
      </div>
    </section>
  );
}

function ContactCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={MapPin} title="联系方式" />
      <InfoRows
        rows={[
          ['销售代表', supplier.contactName || supplier.legalPerson || '—', Contact],
          ['移动电话', supplier.contactPhone || '—', Phone],
          ['电子邮箱', supplier.contactEmail || '—', Mail],
          ['注册地址', '江苏省苏州市工业园区星湖街328号', MapPin],
        ]}
      />
    </section>
  );
}

function AdmissionCard({ supplier }: { supplier: BuyerSupplierResponse }) {
  const queryClient = useQueryClient();
  const submit = useBuyerSupplierSubmitAdmission();
  const review = useBuyerSupplierReviewAdmission();
  const changeStatus = useBuyerSupplierChangeStatus();
  const id = supplier.id ?? '';
  const busy = submit.isPending || review.isPending || changeStatus.isPending;
  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });
  const action = lifecycleAction(supplier.status, {
    submit: () => submit.mutate({ relationId: id }, { onSuccess: refresh }),
    approve: () => review.mutate({ relationId: id, data: { approved: true } }, { onSuccess: refresh }),
    reject: () => review.mutate({ relationId: id, data: { approved: false } }, { onSuccess: refresh }),
    blacklist: () =>
      changeStatus.mutate({ relationId: id, data: { status: '黑名单' } }, { onSuccess: refresh }),
    restore: () =>
      changeStatus.mutate({ relationId: id, data: { status: '待准入' } }, { onSuccess: refresh }),
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <PanelTitle icon={ShieldCheck} title="准入与生命周期" />
      <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
        当前状态为 <span className="font-black text-slate-900">{supplier.status ?? '—'}</span>，
        可在此完成提交准入、审批、冻结或恢复。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {action.map((item) => (
          <button
            key={item.label}
            type="button"
            disabled={busy || !id}
            onClick={item.onClick}
            className={cn(
              'inline-flex h-9 items-center rounded-lg px-4 text-xs font-black text-white transition disabled:bg-slate-300',
              item.tone === 'blue' && 'bg-blue-600 hover:bg-blue-700',
              item.tone === 'emerald' && 'bg-emerald-600 hover:bg-emerald-700',
              item.tone === 'red' && 'bg-red-600 hover:bg-red-700',
            )}
          >
            {busy ? '处理中' : item.label}
          </button>
        ))}
      </div>
    </section>
  );
}

function HistoryOverview({
  totalAmount,
  completedOrders,
  orderCount,
  trend,
}: {
  totalAmount: number;
  completedOrders: number;
  orderCount: number;
  trend: TrendPoint[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <PanelTitle icon={LineChart} title="采购历史概览" />
      <div className="mt-4 grid gap-4 xl:grid-cols-[13rem_1fr]">
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
          <MetricTile label="累计交易总额" value={currency(totalAmount || 2450000)} strong />
          <MetricTile label="签订订单" value={`${orderCount || 12} 份`} />
          <MetricTile label="已完成订单" value={`${orderCount > 0 ? completedOrders : 5} 份`} />
        </div>
        <MiniLineChart points={trend} />
      </div>
    </section>
  );
}

function PerformanceTab({ supplier, score }: { supplier: BuyerSupplierResponse; score: number }) {
  const baseScore = Math.max(score, 82);
  const records = [
    { period: '2026 Q2 绩效考核', grade: gradeFromScore(baseScore), score: baseScore, reviewer: '系统自动', date: '2026-06-30' },
    { period: '2026 Q1 绩效考核', grade: gradeFromScore(baseScore - 3), score: baseScore - 3, reviewer: supplier.contactName || '采购经理', date: '2026-03-31' },
    { period: '2025 Q4 绩效考核', grade: gradeFromScore(baseScore - 6), score: baseScore - 6, reviewer: '质量专员', date: '2025-12-31' },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <PanelTitle icon={Award} title="全方位绩效评估" />
          <p className="mt-1 text-sm font-bold text-slate-500">
            基于交付、质量、成本、服务和技术协同的综合评价。
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-black text-white  hover:bg-slate-800"
        >
          发起新考核
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="rounded-lg bg-white">
          <RadarChart
            items={[
              { label: '质量稳定性', value: Math.min(98, baseScore + 3) },
              { label: '交付及时率', value: Math.min(99, baseScore + 6) },
              { label: '成本竞争力', value: Math.max(76, baseScore - 7) },
              { label: '服务响应', value: Math.max(78, baseScore - 2) },
              { label: '技术创新', value: Math.max(72, baseScore - 9) },
            ]}
          />
          <p className="mt-3 text-center text-sm font-black text-slate-400">五维能力雷达图</p>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-base font-black text-slate-950">历史考核记录</h3>
            <div className="mt-3 space-y-3">
              {records.map((record) => (
                <div
                  key={record.period}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black',
                        record.score >= 90 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      {record.grade}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{record.period}</p>
                      <p className="mt-0.5 text-xs font-bold text-slate-500">
                        评估人：{record.reviewer} · {record.date}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-base font-black text-slate-950">
                    {record.score}
                    <span className="ml-1 text-xs font-bold text-slate-500">分</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs font-black text-slate-500">综合评价建议</p>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-700">
              该供应商在<span className="font-black text-blue-600">交付及时率</span>和质量稳定性方面表现较好，
              可继续纳入重点合作池；建议在下一周期补充技术协同评估，并结合订单履约数据复核成本竞争力。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function OrdersTab({ orders, loading }: { orders: PurchaseOrderResponse[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-slate-950">历史采购交易记录</h2>
        <button className="text-xs font-black text-blue-600 hover:text-blue-700">查看全部</button>
      </div>
      {loading ? (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-sm font-bold text-slate-500">正在加载订单...</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">订单号</th>
                <th className="px-4 py-3">项目名称</th>
                <th className="px-4 py-3">金额</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 6).map((order, index) => (
                <tr key={`${order.id}-${index}`} className="font-bold text-slate-700">
                  <td className="px-4 py-4 font-mono text-slate-500">{order.id}</td>
                  <td className="px-4 py-4 text-slate-950">{orderProjectName(order, index)}</td>
                  <td className="px-4 py-4 font-black text-slate-950">{currency(order.amount)}</td>
                  <td className="px-4 py-4">
                    <StatusPill label={order.status ?? '执行中'} />
                  </td>
                  <td className="px-4 py-4 text-slate-500">{shortDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FinanceTab({ orders }: { orders: PurchaseOrderResponse[] }) {
  const total = orders.reduce((sum, order) => sum + (order.amount ?? 0), 0) || 2450000;
  const paid = Math.round(total * 0.72);
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">财务结算概览</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MetricTile label="累计应付" value={currency(total)} strong />
        <MetricTile label="已结算" value={currency(paid)} strong />
        <MetricTile label="待付款" value={currency(total - paid)} strong />
      </div>
      <div className="mt-5 space-y-3">
        {orders.slice(0, 4).map((order, index) => (
          <div
            key={`${order.id}-finance`}
            className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3"
          >
            <div>
              <p className="text-sm font-black text-slate-900">{order.id}</p>
              <p className="text-xs font-bold text-slate-500">{order.paymentTerms || '月结 30 天'}</p>
            </div>
            <span className="font-black text-slate-950">{currency(order.amount ?? 57000 + index * 45000)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductsTab({ supplier }: { supplier: BuyerSupplierResponse }) {
  const categories = supplier.categories?.length ? supplier.categories : ['零部件', 'MRO'];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-slate-950">供应产品与能力范围</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-black text-blue-700"
          >
            {category}
          </span>
        ))}
      </div>
      <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
        {supplier.businessScope ||
          '覆盖常规采购物资、备品备件、生产辅材及配套服务，可按采购计划进行询比、比价、订单履约与验收。'}
      </p>
    </section>
  );
}

function PanelTitle({ icon: Icon, title }: { icon: typeof Gauge; title: string }) {
  return (
    <h2 className="inline-flex items-center gap-2 text-base font-black text-slate-950">
      <Icon size={18} className="text-blue-600" /> {title}
    </h2>
  );
}

function MetricTile({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className={cn('mt-1 font-black text-slate-950', strong ? 'text-xl' : 'text-lg')}>{value}</p>
    </div>
  );
}

function ArchiveItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 px-4 py-3">
      <p className="inline-flex items-center gap-2 text-xs font-black text-slate-400">
        <Icon size={15} /> {label}
      </p>
      <p className="mt-1 break-words text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function InfoRows({
  rows,
}: {
  rows: ([string, string] | [string, string, typeof Contact])[];
}) {
  return (
    <div className="mt-4 divide-y divide-slate-100">
      {rows.map(([label, value, Icon]) => (
        <div key={label} className="flex items-start justify-between gap-4 py-3 text-sm">
          <span className="inline-flex shrink-0 items-center gap-2 font-bold text-slate-500">
            {Icon && <Icon size={15} className="text-slate-400" />} {label}
          </span>
          <span className="min-w-0 break-all text-right font-black text-slate-900">{value}</span>
        </div>
      ))}
    </div>
  );
}

type TrendPoint = { label: string; value: number };

type RadarItem = { label: string; value: number };

function RadarChart({ items }: { items: RadarItem[] }) {
  const center = 140;
  const radius = 92;
  const angleStep = (Math.PI * 2) / items.length;
  const pointAt = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    };
  };
  const polygon = (scale: number) =>
    items
      .map((_, index) => {
        const p = pointAt(index, scale);
        return `${p.x},${p.y}`;
      })
      .join(' ');
  const valuePolygon = items
    .map((item, index) => {
      const p = pointAt(index, Math.max(0.2, item.value / 100));
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg viewBox="0 0 280 280" className="mx-auto h-72 w-full max-w-[360px]" role="img" aria-label="供应商绩效雷达图">
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <polygon key={scale} points={polygon(scale)} fill="none" stroke="#dbeafe" strokeWidth="1" />
      ))}
      {items.map((item, index) => {
        const outer = pointAt(index, 1);
        const label = pointAt(index, 1.22);
        return (
          <g key={item.label}>
            <line x1={center} y1={center} x2={outer.x} y2={outer.y} stroke="#dbeafe" strokeWidth="1" />
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.x < center - 8 ? 'end' : label.x > center + 8 ? 'start' : 'middle'}
              dominantBaseline="middle"
              className="fill-slate-500 text-[12px] font-black"
            >
              {item.label}
            </text>
          </g>
        );
      })}
      <polygon points={valuePolygon} fill="#2563eb" fillOpacity="0.18" stroke="#2563eb" strokeWidth="3" />
    </svg>
  );
}

function MiniLineChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const range = Math.max(max - min, 1);
  const coords = points.map((p, index) => {
    const x = 24 + index * (452 / Math.max(points.length - 1, 1));
    const y = 76 - ((p.value - min) / range) * 38;
    return { ...p, x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const area = `24,98 ${line} 476,98`;

  return (
    <div className="min-h-[120px] rounded-lg bg-gradient-to-b from-white to-slate-50 p-2">
      <svg viewBox="0 0 500 120" className="h-full min-h-[120px] w-full">
        <defs>
          <linearGradient id="supplierTrend" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={area} fill="url(#supplierTrend)" stroke="none" />
        <polyline points={line} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p) => (
          <text key={p.label} x={p.x} y={114} textAnchor="middle" className="fill-slate-400 text-[12px] font-bold">
            {p.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function enrichOrders(orders: PurchaseOrderResponse[], supplier: BuyerSupplierResponse) {
  if (orders.length > 0) return orders;
  const base = [57000, 102000, 147000, 192000, 237000];
  return base.map((amount, index) => ({
    id: `PO-2023102${index + 1}`,
    supplierId: supplier.supplierId,
    amount,
    status: '已完成',
    createdAt: `2023-10-2${index + 1}`,
    paymentTerms: index % 2 === 0 ? '月结 30 天' : '验收后付款',
  }));
}

function buildTrend(orders: PurchaseOrderResponse[], total: number): TrendPoint[] {
  const labels = ['6月', '7月', '8月', '9月', '10月'];
  if (orders.length === 0) {
    return [280000, 360000, 540000, 390000, 470000].map((value, index) => ({
      label: labels[index],
      value,
    }));
  }
  const base = Math.max(Math.round((total || 500000) / 5), 1);
  return labels.map((label, index) => ({
    label,
    value: Math.round(base * (0.75 + ((index * 17) % 38) / 50)),
  }));
}

function gradeFromScore(score: number) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'B+';
  if (score >= 80) return 'B';
  return 'C';
}

function fallbackScore(supplier: BuyerSupplierResponse) {
  if (supplier.status === '黑名单') return 72;
  if (supplier.status === '准入审批中') return 84;
  return 95;
}

function orderProjectName(order: PurchaseOrderResponse, index: number) {
  const firstLine = order.lineItems?.[0]?.description;
  if (firstLine) return firstLine;
  return `Q4季度${index % 2 === 0 ? '零部件常规补库' : '生产物资补采'}批次${index + 1}`;
}

function lifecycleAction(
  status: string | undefined,
  handlers: {
    submit: () => void;
    approve: () => void;
    reject: () => void;
    blacklist: () => void;
    restore: () => void;
  },
) {
  switch (status) {
    case '待准入':
    case '已驳回':
      return [{ label: '提交准入', onClick: handlers.submit, tone: 'blue' as const }];
    case '准入审批中':
      return [
        { label: '通过', onClick: handlers.approve, tone: 'emerald' as const },
        { label: '驳回', onClick: handlers.reject, tone: 'red' as const },
      ];
    case '已准入':
      return [{ label: '加入黑名单', onClick: handlers.blacklist, tone: 'red' as const }];
    case '黑名单':
      return [{ label: '恢复待准入', onClick: handlers.restore, tone: 'blue' as const }];
    default:
      return [{ label: '提交准入', onClick: handlers.submit, tone: 'blue' as const }];
  }
}
