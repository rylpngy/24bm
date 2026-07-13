import { useMemo, useState } from 'react';
import { FolderKanban } from 'lucide-react';
import { useSupplierOrderList, useSupplierQuoteListList, useSupplierQuoteListRfqs } from '@24bid/api-client';
import {
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
import { useAuthStore } from '../../lib/auth-store';

const PAGE_SIZE = 10;

const methodTone: Record<string, string> = {
  询比: 'bg-blue-50 text-blue-700',
  竞价: 'bg-amber-50 text-amber-700',
  商城直采: 'bg-violet-50 text-violet-700',
  单一来源: 'bg-slate-100 text-slate-600',
};

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;
const shortTime = (v?: string | null) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—');

// 统一项目行:询比/竞价来自受邀 RFQ;商城直采来自协议价直购销售订单(供应商侧无独立项目单据)。
interface ProjectRow {
  key: string;
  kind: 'rfq' | 'mall';
  title: string;
  refId: string;
  method: string;
  stage: string;
  stageResult?: '我方中标' | '未中标';
  amount?: number;
  timeText: string;
  orderCount: number;
  rfqId?: string;
}

// 项目管理:询比 / 竞价 / 商城直采项目总览——阶段、我方结果、关联订单,一览到底。
export function ProjectsPage({
  onOpenProject,
  onOpenOrders,
}: {
  onOpenProject: (rfqId: string) => void;
  onOpenOrders: () => void;
}) {
  const supplierId = useAuthStore((s) => s.session?.supplierId ?? '');
  const rfqs = useSupplierQuoteListRfqs();
  const quotes = useSupplierQuoteListList();
  const orders = useSupplierOrderList();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const rows = useMemo<ProjectRow[]>(() => {
    const orderList = orders.data?.data ?? [];
    const quoteList = quotes.data?.data ?? [];
    const ordersByRfq = new Map<string, number>();
    orderList.forEach((o) => {
      if (o.rfqId) ordersByRfq.set(o.rfqId, (ordersByRfq.get(o.rfqId) ?? 0) + 1);
    });

    const rfqRows: ProjectRow[] = (rfqs.data?.data ?? []).map((r) => {
      const awarded = r.status === '已定标';
      const myQuote = quoteList.find((q) => q.rfqId === r.id);
      return {
        key: `rfq-${r.id}`,
        kind: 'rfq',
        title: r.title ?? '—',
        refId: r.id ?? '—',
        method: r.method ?? '询比',
        stage: r.status ?? '—',
        stageResult: awarded ? (r.awardedSupplierId === supplierId ? '我方中标' : '未中标') : undefined,
        amount: myQuote?.amount,
        timeText: shortTime(r.deadlineAt),
        orderCount: r.id ? (ordersByRfq.get(r.id) ?? 0) : 0,
        rfqId: r.id,
      };
    });

    // 商城直采:sourceMethod=商城 的销售订单即一次直采项目(锚点 RFQ 为采购方内部单据)。
    const mallRows: ProjectRow[] = orderList
      .filter((o) => o.sourceMethod === '商城')
      .map((o) => ({
        key: `mall-${o.id}`,
        kind: 'mall',
        title: (o.lineItems ?? [])
          .map((l) => l.description)
          .filter(Boolean)
          .join('、') || '商城协议价直购',
        refId: o.id ?? '—',
        method: '商城直采',
        stage: o.status ?? '—',
        amount: o.amount,
        timeText: shortTime(o.createdAt),
        orderCount: 1,
      }));

    return [...rfqRows, ...mallRows];
  }, [rfqs.data, quotes.data, orders.data, supplierId]);

  const kw = keyword.trim().toLowerCase();
  const filtered = rows.filter((row) => {
    if (filter !== '全部' && row.method !== filter) return false;
    return !kw || [row.title, row.refId].join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const countBy = (m: string) => rows.filter((r) => r.method === m).length;
  const awardedCount = rows.filter((r) => r.stageResult === '我方中标').length;

  const loading = rfqs.isLoading || orders.isLoading;

  return (
    <Panel title="项目管理" icon={FolderKanban} subtitle="询比 · 竞价 · 商城直采项目总览">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部项目" value={String(rows.length)} />
        <MiniFact label="询比 / 竞价" value={`${countBy('询比') + countBy('单一来源')} / ${countBy('竞价')}`} />
        <MiniFact label="商城直采" value={String(countBy('商城直采'))} />
        <MiniFact label="我方中标" value={String(awardedCount)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '询比', '竞价', '商城直采', '单一来源'].map((id) => ({
            id,
            label: id,
            count: id === '全部' ? undefined : countBy(id),
          }))}
          value={filter}
          onChange={(id) => {
            setFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按项目名称 / 编号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <FeedbackNotice tone="info" message="正在加载项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的项目。' : '暂无参与项目。受邀参与询比 / 竞价或产生商城直采订单后出现在此。'}
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((row, i) => (
              <div key={row.key} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {row.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{row.refId}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', methodTone[row.method] ?? methodTone['询比'])}>
                      {row.method}
                    </span>
                    <StatusPill label={row.stageResult ?? row.stage} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => (row.kind === 'rfq' && row.rfqId ? onOpenProject(row.rfqId) : onOpenOrders())}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  {row.kind === 'rfq' ? '查看项目' : '查看销售订单'}
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">项目</th>
                  <th className="px-5 py-4">采购方式</th>
                  <th className="px-5 py-4">项目阶段</th>
                  <th className="px-5 py-4 text-right">我方金额</th>
                  <th className="px-5 py-4">截止 / 下单时间</th>
                  <th className="px-5 py-4 text-center">关联订单</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((row, i) => (
                  <tr key={row.key} className="hover:bg-blue-50/30">
                    <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                      {(safePage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-5 py-5">
                      <p className="w-56 truncate font-black text-slate-950" title={row.title}>{row.title}</p>
                      <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400" title={row.refId}>{row.refId}</p>
                    </td>
                    <td className="px-5 py-5">
                      <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', methodTone[row.method] ?? methodTone['询比'])}>
                        {row.method}
                      </span>
                    </td>
                    <td className="px-5 py-5">
                      <div className="flex flex-col items-start gap-1">
                        <StatusPill label={row.stage} />
                        {row.stageResult && (
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-[11px] font-black',
                              row.stageResult === '我方中标' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                            )}
                          >
                            {row.stageResult}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(row.amount)}</td>
                    <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{row.timeText}</td>
                    <td className="px-5 py-5 text-center font-mono text-xs font-black text-slate-600">
                      {row.orderCount > 0 ? `${row.orderCount} 单` : '—'}
                    </td>
                    <td className="px-5 py-5 text-right">
                      <button
                        type="button"
                        onClick={() => (row.kind === 'rfq' && row.rfqId ? onOpenProject(row.rfqId) : onOpenOrders())}
                        className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                      >
                        {row.kind === 'rfq' ? '查看项目' : '销售订单'}
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
