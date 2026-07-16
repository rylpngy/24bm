import { useState } from 'react';
import { Store } from 'lucide-react';
import { useSupplierOrderList } from '@24bid/api-client';
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
import { currency, shortTime } from './shared';

const PAGE_SIZE = 10;

// 商城直采履约流程(订单状态推进):待确认 → 已确认 → 已发货 → 已收货(→ 开票/回款在发票应收)。
const FLOW = ['待确认', '已确认', '已发货', '已收货'];

function flowIndex(status?: string) {
  const i = FLOW.indexOf(status ?? '');
  return i < 0 ? 0 : i;
}

function FlowDots({ status }: { status?: string }) {
  const reached = flowIndex(status);
  return (
    <div className="flex items-center gap-1" title={FLOW.join(' → ')}>
      {FLOW.map((label, i) => (
        <span key={label} className="flex items-center gap-1">
          <span title={label} className={cn('h-2 w-2 rounded-full', i <= reached ? 'bg-violet-600' : 'bg-slate-200')} />
          {i < FLOW.length - 1 && <span className={cn('h-px w-2.5', i < reached ? 'bg-violet-300' : 'bg-slate-200')} />}
        </span>
      ))}
    </div>
  );
}

// 商城项目:协议价直采订单台账——采购方目录直购即成交,流程为订单履约(确认/发货/收货)。
export function MallProjectsPage({ onOpenOrders }: { onOpenOrders: () => void }) {
  const orders = useSupplierOrderList();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const all = (orders.data?.data ?? []).filter((o) => o.sourceMethod === '商城');

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((o) => {
    if (filter !== '全部' && o.status !== filter) return false;
    const title = (o.lineItems ?? []).map((l) => l.description).filter(Boolean).join('、');
    return !kw || [title, o.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const totalAmount = all.reduce((sum, o) => sum + (o.amount ?? 0), 0);
  const pending = all.filter((o) => o.status === '待确认').length;
  const shipped = all.filter((o) => o.status === '已发货').length;

  return (
    <Panel title="商城项目" icon={Store} subtitle="协议价目录直采 · 下单即成交 · 订单履约流程">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="直采订单" value={String(all.length)} />
        <MiniFact label="待确认" value={String(pending)} />
        <MiniFact label="已发货" value={String(shipped)} />
        <MiniFact label="直采总额" value={currency(totalAmount)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', ...FLOW].map((id) => ({
            id,
            label: id,
            count: id === '全部' ? undefined : all.filter((o) => o.status === id).length,
          }))}
          value={filter}
          onChange={(id) => {
            setFilter(id);
            setPage(1);
          }}
        />
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按商品 / 订单号搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {orders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载商城项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的直采订单。' : '暂无商城直采项目。采购方在企业商城对我方货架商品下单后出现在此。'}
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((o, i) => {
              const title = (o.lineItems ?? []).map((l) => l.description).filter(Boolean).join('、') || '商城协议价直购';
              return (
                <div key={o.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">
                        <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                        {title}
                      </p>
                      <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{o.id}</p>
                    </div>
                    {o.status && <StatusPill label={o.status} />}
                  </div>
                  <button
                    type="button"
                    onClick={onOpenOrders}
                    className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    去销售订单履约
                  </button>
                </div>
              );
            })}
          >
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">直采商品</th>
                  <th className="px-5 py-4">履约流程</th>
                  <th className="px-5 py-4">订单状态</th>
                  <th className="px-5 py-4 text-right">订单金额</th>
                  <th className="px-5 py-4">下单时间</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((o, i) => {
                  const title = (o.lineItems ?? []).map((l) => l.description).filter(Boolean).join('、') || '商城协议价直购';
                  return (
                    <tr key={o.id} className="hover:bg-violet-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-56 truncate font-black text-slate-950" title={title}>{title}</p>
                        <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400" title={o.id ?? undefined}>{o.id}</p>
                      </td>
                      <td className="px-5 py-5">
                        <FlowDots status={o.status} />
                        <p className="mt-1 text-[11px] font-bold text-slate-400">{FLOW[flowIndex(o.status)]}</p>
                      </td>
                      <td className="px-5 py-5">{o.status && <StatusPill label={o.status} />}</td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(o.amount)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(o.createdAt)}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={onOpenOrders}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          去销售订单履约
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
