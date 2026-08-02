import { useMemo, useState } from 'react';
import { Award, BadgeCheck, ShieldCheck, Store, TrendingUp, Truck } from 'lucide-react';
import { usePlatformSupplierCreditProfiles, type SupplierCreditProfileResponse } from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MetricCard,
  MetricGrid,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  SearchInput,
  SectionCard,
  cn,
} from '@24bid/ui';

const PAGE_SIZE = 10;

const LEVEL_TONE: Record<string, string> = {
  AAA: 'bg-emerald-50 text-emerald-700',
  AA: 'bg-blue-50 text-blue-700',
  A: 'bg-violet-50 text-violet-700',
  B: 'bg-amber-50 text-amber-700',
  C: 'bg-red-50 text-red-600',
  暂无评级: 'bg-slate-100 text-slate-500',
};

const pct = (v?: number | null) => (v == null ? '—' : `${v}%`);
const wan = (v?: number) => {
  const n = Number(v ?? 0);
  return n <= 0 ? '¥0' : `¥${(n / 10000).toLocaleString('zh-CN', { maximumFractionDigits: 1 })}万`;
};

// 指标条:比率可视化(无样本显示占位,不按 0 呈现)。
function RateBar({ label, value, tone }: { label: string; value?: number | null; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-black">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{pct(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        {value != null && <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.max(2, value)}%` }} />}
      </div>
    </div>
  );
}

// 供应商信用画像:跨租户履约聚合与加权信用分(平台运营视角)。
export function SupplierCreditPage() {
  const profiles = usePlatformSupplierCreditProfiles();
  const [levelFilter, setLevelFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<SupplierCreditProfileResponse | null>(null);

  const all = profiles.data?.data ?? [];
  const scored = all.filter((p) => p.scoreable);
  const avgScore = useMemo(() => {
    const withScore = scored.filter((p) => p.creditScore != null);
    if (withScore.length === 0) return null;
    return (withScore.reduce((s, p) => s + Number(p.creditScore ?? 0), 0) / withScore.length).toFixed(1);
  }, [scored]);

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((p) => {
    if (levelFilter !== '全部' && p.creditLevel !== levelFilter) return false;
    return !kw || (p.supplierName ?? '').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const countBy = (level: string) => all.filter((p) => p.creditLevel === level).length;

  if (selected) {
    const p = selected;
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelected(null)} aria-label="返回信用榜"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              ←
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-xl font-black text-slate-950">{p.supplierName}</h2>
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', LEVEL_TONE[p.creditLevel ?? ''] ?? 'bg-slate-100 text-slate-500')}>
                  {p.creditLevel}
                </span>
                {p.verified && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                    <BadgeCheck size={12} /> 平台认证
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                信用分 {p.creditScore ?? '—'} · 服务 {p.servedTenantCount} 家采购企业 · 累计成交 {wan(p.totalOrderAmount)}
              </p>
            </div>
          </div>
        </div>

        {!p.scoreable && (
          <FeedbackNotice tone="info" message="该供应商尚无参与或履约记录,暂不评分。产生投标/订单后自动纳入信用计算。" />
        )}

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard icon={Award} title="参与与中标">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs font-black text-slate-400">参与项目</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.participatedProjects}</p></div>
              <div><p className="text-xs font-black text-slate-400">中标项目</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.awardedProjects}</p></div>
              <div><p className="text-xs font-black text-slate-400">中标率</p><p className="mt-1 font-mono text-xl font-black text-blue-700">{pct(p.winRate)}</p></div>
            </div>
          </SectionCard>

          <SectionCard icon={Truck} title="履约表现">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs font-black text-slate-400">采购订单</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.orderCount}</p></div>
              <div><p className="text-xs font-black text-slate-400">已完成</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.completedOrderCount}</p></div>
              <div><p className="text-xs font-black text-slate-400">准时交付</p><p className="mt-1 font-mono text-xl font-black text-emerald-700">{pct(p.onTimeRate)}</p></div>
            </div>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="结算合规">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><p className="text-xs font-black text-slate-400">对账单据</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.invoiceCount}</p></div>
              <div><p className="text-xs font-black text-slate-400">三单一致</p><p className="mt-1 font-mono text-xl font-black text-slate-950">{p.cleanReconciliationCount}</p></div>
              <div><p className="text-xs font-black text-slate-400">对账通过率</p><p className="mt-1 font-mono text-xl font-black text-violet-700">{pct(p.reconciliationPassRate)}</p></div>
            </div>
          </SectionCard>

          <SectionCard icon={TrendingUp} title="信用分构成">
            <div className="space-y-3">
              <RateBar label="中标率(权重 20%)" value={p.winRate} tone="bg-blue-500" />
              <RateBar label="订单完成率(权重 35%)" value={p.completionRate} tone="bg-emerald-500" />
              <RateBar label="准时交付率(权重 30%)" value={p.onTimeRate} tone="bg-amber-500" />
              <RateBar label="对账通过率(权重 15%)" value={p.reconciliationPassRate} tone="bg-violet-500" />
              <p className="pt-1 text-[11px] font-bold text-slate-400">
                某项无样本时其权重按剩余项等比重分配;信用分 = 加权均值,等级 AAA≥90 / AA≥80 / A≥70 / B≥60 / C&lt;60。
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  return (
    <Panel title="供应商信用" icon={Store} subtitle="跨租户履约聚合 · 中标率 / 完成率 / 准时率 / 对账通过率加权">
      <MetricGrid>
        <MetricCard icon={Store} label="供应商总数" value={String(all.length)} hint={`${scored.length} 家有履约样本`} tone="blue" />
        <MetricCard icon={Award} label="平均信用分" value={avgScore ?? '—'} hint="仅统计有样本供应商" tone="emerald" />
        <MetricCard icon={BadgeCheck} label="A 级及以上" value={String(countBy('AAA') + countBy('AA') + countBy('A'))} hint="AAA / AA / A" tone="violet" />
        <MetricCard icon={ShieldCheck} label="待观察(C 级)" value={String(countBy('C'))} hint="履约表现偏低" tone="amber" />
      </MetricGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', 'AAA', 'AA', 'A', 'B', 'C', '暂无评级'].map((id) => ({
            id, label: id, count: id === '全部' ? all.length : countBy(id),
          }))}
          value={levelFilter}
          onChange={(id) => { setLevelFilter(id); setPage(1); }}
        />
        <SearchInput className="mb-0 ml-auto" placeholder="按供应商名称搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }} />
      </div>

      {profiles.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商信用画像…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info" message={kw || levelFilter !== '全部' ? '没有符合条件的供应商。' : '暂无供应商数据。'} />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((p) => (
              <div key={p.supplierId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="break-words font-black text-slate-950">{p.supplierName}</p>
                  <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-black', LEVEL_TONE[p.creditLevel ?? ''] ?? 'bg-slate-100 text-slate-500')}>
                    {p.creditLevel}
                  </span>
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">信用分 {p.creditScore ?? '—'} · 成交 {wan(p.totalOrderAmount)}</p>
                <button type="button" onClick={() => setSelected(p)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">
                  查看画像
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">供应商</th>
                  <th className="px-5 py-4">信用等级</th>
                  <th className="px-5 py-4 text-right">信用分</th>
                  <th className="px-5 py-4 text-right">中标率</th>
                  <th className="px-5 py-4 text-right">完成率</th>
                  <th className="px-5 py-4 text-right">准时率</th>
                  <th className="px-5 py-4 text-right">累计成交</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((p, i) => (
                  <tr key={p.supplierId} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-5 py-5">
                      <p className="w-56 truncate font-black text-slate-950" title={p.supplierName ?? undefined}>{p.supplierName}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-400">服务 {p.servedTenantCount} 家 · 参与 {p.participatedProjects} 个项目</p>
                    </td>
                    <td className="px-5 py-5">
                      <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', LEVEL_TONE[p.creditLevel ?? ''] ?? 'bg-slate-100 text-slate-500')}>
                        {p.creditLevel}
                      </span>
                    </td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{p.creditScore ?? '—'}</td>
                    <td className="px-5 py-5 text-right font-mono text-xs font-bold text-slate-600">{pct(p.winRate)}</td>
                    <td className="px-5 py-5 text-right font-mono text-xs font-bold text-slate-600">{pct(p.completionRate)}</td>
                    <td className="px-5 py-5 text-right font-mono text-xs font-bold text-slate-600">{pct(p.onTimeRate)}</td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{wan(p.totalOrderAmount)}</td>
                    <td className="px-5 py-5 text-right">
                      <button type="button" onClick={() => setSelected(p)}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                        画像
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
