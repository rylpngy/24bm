import { useState } from 'react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { Activity, Boxes, CheckCircle2, ChevronRight, Clock3, Plus, Search, ShieldCheck } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import {
  FeedbackNotice,
  MiniFact,
  Pagination,
  Panel,
  ResponsiveTableFrame,
  StatusPill,
  cn,
} from '@24bid/ui';
import { SupplierMetricCard, SupplierMetricGrid } from './supplier-metric-card';

const PAGE_SIZE = 8;

const STATUS_FILTERS = ['全部', '待准入', '准入审批中', '已准入', '已驳回', '黑名单', '退出审批中', '已退出'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];



// 供应商列表子页:KPI + 状态筛选 + 登记 + 钻取 360(onOpen)。
export function SupplierListView({ onOpen, onRegister }: { onOpen: (id: string) => void; onRegister: () => void }) {
  const { can } = useBuyerPermissions();
  const [status, setStatus] = useState<StatusFilter>('全部');
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [level, setLevel] = useState('全部');
  const [page, setPage] = useState(1);

  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];

  const levels = ['全部', ...Array.from(new Set(all.map((s) => s.level).filter(Boolean) as string[]))];
  const kw = keyword.trim().toLowerCase();
  const suppliers = all.filter((s) => {
    if (status !== '全部' && s.status !== status) return false;
    if (level !== '全部' && s.level !== level) return false;
    if (!kw) return true;
    const haystack = [s.supplierName, s.creditCode, ...(s.categories ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = suppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const selectStatus = (s: StatusFilter) => {
    setStatus(s);
    setPage(1);
  };




  const count = (s: StatusFilter) => (s === '全部' ? all.length : all.filter((x) => x.status === s).length);
  const scored = all.filter((s) => s.performanceScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, s) => sum + (s.performanceScore ?? 0), 0) / scored.length) * 10) / 10
      : null;

  return (
    <Panel title="供应商列表" icon={Boxes} subtitle="私域关系 · 准入 · 分级 · 绩效">
      <SupplierMetricGrid columns={5}>
        <SupplierMetricCard icon={Boxes} label="供应商总数" value={String(all.length)} hint="私域关系池" tone="blue" />
        <SupplierMetricCard icon={Clock3} label="待准入" value={String(count('待准入'))} hint="待提交资料" tone="amber" />
        <SupplierMetricCard icon={ShieldCheck} label="准入审批中" value={String(count('准入审批中'))} hint="流程处理中" tone="violet" />
        <SupplierMetricCard icon={CheckCircle2} label="已准入" value={String(count('已准入'))} hint="可参与采购" tone="emerald" />
        <SupplierMetricCard icon={Activity} label="平均绩效" value={avgScore == null ? '—' : String(avgScore)} hint="综合评分" tone="slate" />
      </SupplierMetricGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => selectStatus(s)}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === status
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {count(s) > 0 && <span className="ml-1 text-slate-400">{count(s)}</span>}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setKeyword(input.trim());
            setPage(1);
          }}
          className="ml-auto flex items-center gap-1.5"
        >
          <div className="relative w-40 sm:w-48">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="按名称 / 信用代码搜索"
              className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
            className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          >
            {levels.map((lv) => (
              <option key={lv} value={lv}>
                {lv === '全部' ? '全部等级' : `等级 ${lv}`}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-black text-white transition hover:bg-blue-700"
          >
            <Search size={13} /> 搜索
          </button>
          {(keyword || input || level !== '全部') && (
            <button
              type="button"
              onClick={() => {
                setInput('');
                setKeyword('');
                setLevel('全部');
                setPage(1);
              }}
              className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              清除
            </button>
          )}
        </form>
        {can('buyer:supplier:manage') && <button
          type="button"
          onClick={onRegister}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> 登记供应商
        </button>}
      </div>


      {query.isError ? <FeedbackNotice tone="error" message="供应商库加载失败，请刷新或确认当前账号权限。" /> : query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商库…" />
      ) : suppliers.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无供应商。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={pageItems.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => s.id && onOpen(s.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:bg-blue-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">
                    <span className="mr-1.5 font-mono text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}.
                    </span>
                    {s.supplierName}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    等级 {s.level} · 最近评分 {s.lastEvaluationScore ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.status && <StatusPill label={s.status} />}
                  {s.cooperationTier && <StatusPill label={s.cooperationTier} />}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="授权品类" value={(s.categories ?? []).join('、') || '—'} />
                <MiniFact label="绩效评分" value={String(s.performanceScore ?? '—')} />
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-600">
                查看供应商 360 <ChevronRight size={13} />
              </p>
            </button>
          ))}
        >
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="w-14 px-5 py-4">序号</th>
                <th className="px-5 py-4">供应商</th>
                <th className="px-5 py-4">状态</th>
                <th className="px-5 py-4">合作等级</th>
                <th className="px-5 py-4">授权品类</th>
                <th className="px-5 py-4 text-right">绩效</th>
                <th className="px-5 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {pageItems.map((s, i) => (
                <tr
                  key={s.id}
                  onClick={() => s.id && onOpen(s.id)}
                  className="cursor-pointer transition hover:bg-blue-50/30"
                >
                  <td className="px-5 py-5 font-mono font-black text-slate-400">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </td>
                  <td className="px-5 py-5">
                    <p className="font-black text-slate-950">{s.supplierName}</p>
                    {/* 编号定宽截断,悬浮显示完整值,避免长信用代码挤压其他列 */}
                    <p
                      title={s.creditCode || s.supplierId || undefined}
                      className="mt-1 w-40 truncate font-mono text-xs font-bold text-slate-400"
                    >
                      {s.creditCode || s.supplierId || '待补充统一信用代码'}
                    </p>
                  </td>
                  <td className="px-5 py-5">
                    {/* 状态主标签 + 生命周期以点号辅注,避免双标签并列的杂乱 */}
                    <div className="flex flex-col gap-1">
                      {s.status && <StatusPill label={s.status} />}
                      {s.cooperationTier && s.cooperationTier !== s.status && (
                        <span className="text-[11px] font-bold text-slate-400">· {s.cooperationTier}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-5">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-black text-blue-700">{s.level ?? '—'}</span>
                  </td>
                  <td className="px-5 py-5">
                    <p className="max-w-sm truncate text-sm font-bold text-slate-600">{(s.categories ?? []).join('、') || '—'}</p>
                  </td>
                  <td className="px-5 py-5 text-right font-mono font-black text-slate-900">
                    {s.performanceScore ?? '—'}
                  </td>
                  <td className="px-5 py-5 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-blue-600">
                      查看 <ChevronRight size={13} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}

      {!query.isLoading && suppliers.length > 0 && (
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={suppliers.length} onPageChange={setPage} />
      )}
    </Panel>
  );
}
