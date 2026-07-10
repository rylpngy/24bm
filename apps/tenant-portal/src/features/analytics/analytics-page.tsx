import { useMemo, useState, type ElementType } from 'react';
import {
  AlertCircle,
  BarChart3,
  ChevronDown,
  Download,
  FileText,
  Globe2,
  LineChart,
  PieChart,
  Share2,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useBuyerAnalyticsProcurement } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, cn } from '@24bid/ui';

type TabId = 'overview' | 'prices' | 'spend';

const currency = (v?: number, compact = false) => {
  if (v == null) return '--';
  return compact
    ? `¥${(v / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`
    : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;
};

const compactWan = (v: number) => `${Math.round(v / 10000)}w`;
const colors = ['#2563eb', '#4f46e5', '#7c3aed', '#9333ea', '#c026d3'];

const tabs: { id: TabId; label: string; desc: string }[] = [
  { id: 'overview', label: '采购业务概览', desc: 'KPI 监控与供应商排行' },
  { id: 'prices', label: '关键价格指标', desc: '物资价格对标与异动预警' },
  { id: 'spend', label: '采购支出分析', desc: '支出结构与降本洞察' },
];

const departmentBudgets = [
  { name: '生产部', actual: 850, budget: 900 },
  { name: '技术部', actual: 420, budget: 395 },
  { name: '行政部', actual: 150, budget: 180 },
  { name: 'IT部', actual: 280, budget: 305 },
  { name: '营销部', actual: 125, budget: 150 },
];

const marketTicker = [
  { label: 'LME 铜', value: '8120.5', trend: '↗1.2%', up: true },
  { label: 'WTI 原油', value: '78.4', trend: '↘0.5%', up: false },
  { label: '螺纹钢', value: '3850', trend: '↗0.8%', up: true },
  { label: '聚乙烯', value: '8150', trend: '↘1.5%', up: false },
  { label: '纸浆', value: '5600', trend: '↗0.2%', up: true },
];

const priceTrend = [
  { month: '1月', market: 4300, own: 4200 },
  { month: '2月', market: 4350, own: 4150 },
  { month: '3月', market: 4390, own: 4250 },
  { month: '4月', market: 4600, own: 4300 },
  { month: '5月', market: 4550, own: 4280 },
  { month: '6月', market: 4200, own: 4100 },
];

const priceAlerts = [
  { name: '聚丙烯颗粒 (PP)', code: 'M001', own: '¥7200', market: '¥7500', delta: '-4%', good: true },
  { name: '304不锈钢板', code: 'M002', own: '¥15200', market: '¥14800', delta: '+2.7%', good: false },
  { name: '工业润滑油', code: 'M003', own: '¥850', market: '¥850', delta: '0%', neutral: true },
  { name: '服务器内存条 64G', code: 'M004', own: '¥1800', market: '¥2100', delta: '-14.3%', good: true },
  { name: 'A4复印纸', code: 'M005', own: '¥180', market: '¥185', delta: '-2.7%', good: true },
];

const categorySpend = [
  { name: '生产原料', value: 450000, color: '#2563eb' },
  { name: 'IT设备', value: 210000, color: '#4f46e5' },
  { name: '物流服务', value: 180000, color: '#7c3aed' },
  { name: '办公用品', value: 85000, color: '#9333ea' },
  { name: '行政服务', value: 120000, color: '#c026d3' },
];

const largeOrders = [
  { no: 'PO-20260625-001', project: '年度服务器集群扩容', supplier: '浪潮信息', dept: '技术部', amount: 2450000, date: '2026-06-25' },
  { no: 'PO-20260620-003', project: 'Q4季度原材料采购', supplier: '中国石化', dept: '生产部', amount: 1800000, date: '2026-06-20' },
  { no: 'PO-20260615-012', project: '新厂区安防监控系统', supplier: '海康威视', dept: '行政部', amount: 850000, date: '2026-06-15' },
  { no: 'PO-20260608-005', project: '自动化流水线改造', supplier: '西门子中国', dept: '生产部', amount: 620000, date: '2026-06-08' },
  { no: 'PO-20260601-002', project: '全国物流运输年框', supplier: '顺丰速运', dept: '物流部', amount: 500000, date: '2026-06-01' },
];

function HeaderAction({ icon: Icon, label, dark = false }: { icon: ElementType; label: string; dark?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition',
        dark
          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-950">{title}</h2>
          <p className="mt-1 text-xs font-bold text-slate-400">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <HeaderAction icon={Download} label="导出报表" />
          <HeaderAction icon={Share2} label="分享看板" dark />
        </div>
      </div>
    </div>
  );
}

function InsightBanner({ includeBoardActions = false }: { includeBoardActions?: boolean }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-950">AI 采购助手洞察</p>
            <p className="mt-1 text-xs font-bold text-slate-600">
              检测到 IT 类目服务器内存采购成本较去年同期下降 14.3%，建议 IT 部适当增加备货量。
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="h-8 rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700" type="button">
            生成决策报告
          </button>
          {includeBoardActions && (
            <>
              <HeaderAction icon={Download} label="导出报表" />
              <HeaderAction icon={Share2} label="分享看板" dark />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, action, children }: { icon?: ElementType; title: string; action?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-blue-600" />}
          <h3 className="text-base font-black text-slate-950">{title}</h3>
        </div>
        {action && (
          <button type="button" className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50">
            {action}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function BudgetBars() {
  const max = Math.max(...departmentBudgets.flatMap((item) => [item.actual, item.budget]));
  const width = 720;
  const height = 330;
  const pad = { left: 58, right: 24, top: 26, bottom: 48 };
  const groupWidth = (width - pad.left - pad.right) / departmentBudgets.length;
  const barWidth = 18;
  const y = (value: number) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const ticks = [1000, 750, 500, 250, 0];
  return (
    <div className="h-[25rem] w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="部门采购预算执行">
        {ticks.map((tick) => {
          const yy = y(Math.min(tick, max));
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke="#e2e8f0" strokeDasharray="4 4" />
              <text x={pad.left - 12} y={yy + 4} textAnchor="end" className="fill-slate-400 text-[12px] font-bold">
                {tick}
              </text>
            </g>
          );
        })}
        {departmentBudgets.map((item, index) => {
          const center = pad.left + groupWidth * index + groupWidth / 2;
          const actualY = y(item.actual);
          const budgetY = y(item.budget);
          const base = height - pad.bottom;
          return (
            <g key={item.name}>
              <rect x={center - barWidth - 3} y={actualY} width={barWidth} height={base - actualY} rx="4" fill="#2563eb" />
              <rect x={center + 3} y={budgetY} width={barWidth} height={base - budgetY} rx="4" fill="#e2e8f0" />
              <text x={center} y={height - 16} textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
                {item.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-4 flex justify-center gap-4 text-sm font-black">
        <span className="inline-flex items-center gap-2 text-blue-600"><i className="h-3 w-3 rounded-full bg-blue-600" />实际支出</span>
        <span className="inline-flex items-center gap-2 text-slate-300"><i className="h-3 w-3 rounded-full bg-slate-200" />年度预算</span>
      </div>
    </div>
  );
}

function RankingList({ suppliers }: { suppliers: { name: string; amount: number; share: number; color: string }[] }) {
  const ranked = suppliers.length > 0 ? suppliers : [
    { name: '中国石化', amount: 4500000, share: 100, color: '#2563eb' },
    { name: '浪潮信息', amount: 2800000, share: 62, color: '#2563eb' },
    { name: '宝钢股份', amount: 2100000, share: 46, color: '#2563eb' },
    { name: '顺丰速运', amount: 1500000, share: 33, color: '#2563eb' },
    { name: '京东企业购', amount: 950000, share: 21, color: '#2563eb' },
  ];
  const max = Math.max(...ranked.map((item) => item.amount), 1);
  return (
    <div className="space-y-6">
      {ranked.slice(0, 5).map((item, index) => (
        <div key={item.name}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black', index === 0 ? 'bg-amber-100 text-amber-700' : index === 1 ? 'bg-slate-100 text-slate-500' : index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400')}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{index % 2 ? 'IT设备' : '原材料'}</p>
              </div>
            </div>
            <p className="font-mono text-sm font-black text-slate-950">{compactWan(item.amount)}</p>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(8, (item.amount / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      <button className="h-9 w-full rounded-lg bg-slate-50 text-sm font-black text-slate-700 hover:bg-blue-50 hover:text-blue-700" type="button">
        查看完整供应商报告
      </button>
    </div>
  );
}

function LineTrendChart() {
  const width = 720;
  const height = 330;
  const pad = { left: 54, right: 30, top: 24, bottom: 46 };
  const values = priceTrend.flatMap((item) => [item.market, item.own]);
  const min = Math.min(...values) - 80;
  const max = Math.max(...values) + 80;
  const x = (index: number) => pad.left + (index / (priceTrend.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);
  const market = priceTrend.map((item, index) => `${x(index)},${y(item.market)}`).join(' ');
  const own = priceTrend.map((item, index) => `${x(index)},${y(item.own)}`).join(' ');
  const ticks = [min, min + (max - min) / 3, min + ((max - min) * 2) / 3, max];
  return (
    <div className="h-[25rem] w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label="关键物资价格趋势">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={pad.left - 12} y={y(tick) + 4} textAnchor="end" className="fill-slate-400 text-[11px] font-bold">
              {Math.round(tick)}
            </text>
          </g>
        ))}
        <polyline points={market} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
        <polyline points={own} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {priceTrend.map((item, index) => (
          <g key={item.month}>
            <circle cx={x(index)} cy={y(item.own)} r="4" fill="#fff" stroke="#2563eb" strokeWidth="2" />
            <text x={x(index)} y={height - 14} textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
              {item.month}
            </text>
          </g>
        ))}
      </svg>
      <div className="-mt-8 flex justify-center gap-5 text-sm font-black">
        <span className="inline-flex items-center gap-2 text-slate-400"><i className="h-0.5 w-5 border-t-2 border-dashed border-slate-400" />市场行情指数</span>
        <span className="inline-flex items-center gap-2 text-blue-600"><i className="h-0.5 w-5 rounded bg-blue-600" />我司采购均价</span>
      </div>
    </div>
  );
}

function DonutChart() {
  const total = categorySpend.reduce((sum, item) => sum + item.value, 0);
  let offset = 25;
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_14rem]">
      <div className="flex justify-center">
        <svg viewBox="0 0 220 220" className="h-64 w-64 rotate-[-90deg]" role="img" aria-label="采购支出占比">
          <circle cx="110" cy="110" r="68" fill="none" stroke="#f1f5f9" strokeWidth="32" />
          {categorySpend.map((item) => {
            const length = (item.value / total) * 427;
            const segment = (
              <circle
                key={item.name}
                cx="110"
                cy="110"
                r="68"
                fill="none"
                stroke={item.color}
                strokeWidth="32"
                strokeDasharray={`${length} ${427 - length}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += length + 8;
            return segment;
          })}
          <circle cx="110" cy="110" r="42" fill="white" />
        </svg>
      </div>
      <div className="space-y-4">
        {categorySpend.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <i className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-xs font-bold text-slate-500">{item.name}</span>
            </div>
            <span className="font-mono text-sm font-black text-slate-950">{compactWan(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({
  suppliers,
  a,
}: {
  suppliers: { name: string; amount: number; share: number; color: string }[];
  a: { totalSpend?: number; orderCount?: number; supplierCount?: number; biddingSavings?: number };
}) {
  return (
    <>
      <InsightBanner includeBoardActions />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MiniFact label="年度采购总额" value={currency(a?.totalSpend ?? 0)} />
        <MiniFact label="采购订单数" value={`${a?.orderCount ?? 0} 单`} />
        <MiniFact label="活跃供应商" value={`${a?.supplierCount ?? 0} 家`} />
        <MiniFact label="综合成本节约" value={currency(a?.biddingSavings ?? 0)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card icon={BarChart3} title="部门采购预算执行（万元）" action="查看详情">
          <BudgetBars />
        </Card>
        <Card icon={LineChart} title="核心供应商排名">
          <RankingList suppliers={suppliers} />
        </Card>
      </div>
    </>
  );
}

function PricesTab() {
  return (
    <>
      <PageHeader title="关键价格指标" subtitle="核心物资市场价格对标与异动预警" />
      <InsightBanner />
      <div className="rounded-lg bg-slate-950 px-4 py-3 text-white shadow-sm">
        <div className="flex flex-wrap items-center gap-6 xl:flex-nowrap xl:justify-between">
          <div className="flex min-w-[16rem] items-center gap-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-blue-200"><Globe2 size={20} /></span>
            <div>
              <p className="font-black">全球大宗商品行情</p>
              <p className="text-xs font-bold text-slate-400">数据实时更新中</p>
            </div>
          </div>
          {marketTicker.map((item) => (
            <div key={item.label} className="min-w-[7rem]">
              <p className="text-xs font-black text-slate-400">{item.label}</p>
              <p className="mt-1 font-mono text-lg font-black">
                {item.value} <span className={cn('ml-1 text-xs', item.up ? 'text-emerald-400' : 'text-red-400')}>{item.trend}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card icon={TrendingUp} title="关键物资价格走势">
          <div className="-mt-2 mb-2 flex justify-end">
            <button className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50" type="button">
              聚丙烯颗粒 (PP) <ChevronDown size={14} />
            </button>
          </div>
          <LineTrendChart />
        </Card>
        <Card icon={AlertCircle} title="价格异动预警">
          <div className="space-y-3">
            {priceAlerts.map((item) => (
              <div key={item.code} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.name}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-400">{item.code}</p>
                  </div>
                  <span className={cn('rounded-md px-2 py-1 text-sm font-black', item.neutral ? 'bg-slate-100 text-slate-500' : item.good ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600')}>
                    {item.delta}
                  </span>
                </div>
                <div className="mt-4 flex justify-between text-xs font-bold text-slate-500">
                  <span>采购: {item.own}</span>
                  <span>市场: {item.market}</span>
                </div>
              </div>
            ))}
            <p className="border-t border-slate-100 pt-4 text-xs font-bold leading-6 text-slate-500">
              <span className="font-black text-blue-600">AI 洞察：</span>
              近期内存条市场价格持续走低，建议 IT 部门适当增加备货以锁定低成本。
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function SpendTab({ suppliers }: { suppliers: { name: string; amount: number; share: number; color: string }[] }) {
  const maxSupplierAmount = Math.max(...suppliers.map((item) => item.amount), 1);
  return (
    <>
      <PageHeader title="采购支出分析" subtitle="多维度支出结构分析与降本洞察" />
      <InsightBanner />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card icon={PieChart} title="采购支出占比（按品类）">
          <DonutChart />
        </Card>
        <Card title="主要成交供应商分析">
          <div className="space-y-6">
            {suppliers.slice(0, 5).map((item, index) => (
              <div key={item.name} className="grid grid-cols-[2rem_1fr_5rem] items-center gap-4">
                <span className="font-mono text-sm font-black text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-slate-950">{item.name}</p>
                    <p className="font-mono text-sm font-bold text-slate-500">{compactWan(item.amount)}</p>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(8, (item.amount / maxSupplierAmount) * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card icon={FileText} title="大额采购明细 Top 5" action="导出全部">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-5 py-4">序号</th>
                <th className="px-5 py-4">订单编号</th>
                <th className="px-5 py-4">项目名称</th>
                <th className="px-5 py-4">供应商</th>
                <th className="px-5 py-4">申请部门</th>
                <th className="px-5 py-4 text-right">金额</th>
                <th className="px-5 py-4">日期</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {largeOrders.map((order, index) => (
                <tr key={order.no} className="hover:bg-blue-50/30">
                  <td className="px-5 py-5 font-mono font-black text-slate-400">{index + 1}</td>
                  <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{order.no}</td>
                  <td className="px-5 py-5 font-black text-slate-950">{order.project}</td>
                  <td className="px-5 py-5 text-sm font-bold text-slate-600">{order.supplier}</td>
                  <td className="px-5 py-5"><span className="rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{order.dept}</span></td>
                  <td className="px-5 py-5 text-right font-mono font-black text-slate-950">{currency(order.amount)}</td>
                  <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{order.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const query = useBuyerAnalyticsProcurement();
  const a = query.data?.data;

  const suppliers = useMemo(() => {
    const rows = (a?.supplierSpend ?? []).slice(0, 5).map((s, index) => ({
      name: s.supplierName ?? s.supplierId ?? '--',
      amount: s.totalAmount ?? 0,
      share: s.sharePercent ?? 0,
      color: colors[index % colors.length],
    }));
    const fallback = [
      { name: '中国石化', amount: 450000, share: 100, color: '#2563eb' },
      { name: '浪潮信息', amount: 280000, share: 62, color: '#4f46e5' },
      { name: '宝钢股份', amount: 210000, share: 46, color: '#7c3aed' },
      { name: '顺丰速运', amount: 150000, share: 33, color: '#9333ea' },
      { name: '京东企业购', amount: 95000, share: 21, color: '#c026d3' },
    ];
    const source = rows.length > 0 ? [...rows, ...fallback.filter((item) => !rows.some((row) => row.name === item.name))] : fallback;
    return source.sort((left, right) => right.amount - left.amount).slice(0, 5);
  }, [a]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Panel title="采购分析" icon={TrendingUp} subtitle="支出趋势 · 集中度 · 节支洞察">
          <FeedbackNotice tone="info" message="正在加载采购分析…" />
        </Panel>
      </div>
    );
  }

  if (!a) {
    return (
      <div className="mx-auto max-w-7xl">
        <Panel title="采购分析" icon={TrendingUp} subtitle="支出趋势 · 集中度 · 节支洞察">
          <FeedbackNotice tone="info" message="暂无分析数据。" />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      <Panel
        title="采购分析"
        icon={TrendingUp}
        subtitle="支出趋势 · 集中度 · 节支洞察"
        action={
          <div className="inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 sm:w-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative h-8 flex-1 whitespace-nowrap rounded-md px-3 text-xs font-black transition sm:flex-none',
                  activeTab === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-950',
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute inset-x-4 -bottom-1 h-0.5 rounded-full bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-4">
          {activeTab === 'overview' ? <OverviewTab suppliers={suppliers} a={a} /> : null}
          {activeTab === 'prices' ? <PricesTab /> : null}
          {activeTab === 'spend' ? <SpendTab suppliers={suppliers} /> : null}
        </div>
      </Panel>
    </div>
  );
}
