import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Gavel } from 'lucide-react';
import {
  useAuctionStream,
  useSupplierQuoteListList,
  useSupplierQuoteListRfqs,
  type RfqResponse,
} from '@24bid/api-client';
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
import { currency, inviteState, inviteTone, shortTime } from './shared';

const PAGE_SIZE = 10;

// 竞价项目:实时竞价台账——LIVE 状态、当前排名、我方最新出价;「进入竞价大厅」实时出价。
export function AuctionProjectsPage({ onOpenProject }: { onOpenProject: (rfqId: string) => void }) {
  const supplierId = useAuthStore((s) => s.session?.supplierId ?? '');
  const queryClient = useQueryClient();
  // G-1 竞价实时推送:SSE 通道畅通时由服务端事件驱动刷新;断流回落 5s 轮询(改造前行为)。
  const token = useAuthStore((s) => s.session?.token);
  const [streamLive, setStreamLive] = useState(false);
  const rfqs = useSupplierQuoteListRfqs(undefined, {
    query: {
      refetchInterval: (query) =>
        !streamLive
        && ((query.state.data?.data ?? []) as RfqResponse[]).some(
          (r) => r.method === '竞价' && r.status === '报价中',
        )
          ? 5_000
          : false,
    },
  });
  const hasLiveAuction = (rfqs.data?.data ?? []).some(
    (r) => r.method === '竞价' && r.status === '报价中',
  );
  const onAuctionEvent = useCallback(() => {
    void queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (q.queryKey[0] as string).includes('/supplier/rfqs'),
    });
  }, [queryClient]);
  const auctionStream = useAuctionStream({
    scope: 'supplier', token, enabled: hasLiveAuction, onEvent: onAuctionEvent,
  });
  useEffect(() => setStreamLive(auctionStream.live), [auctionStream.live]);
  const quotes = useSupplierQuoteListList();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const quoteList = quotes.data?.data ?? [];
  const all = (rfqs.data?.data ?? []).filter((r) => r.method === '竞价');

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (filter !== '全部' && r.status !== filter) return false;
    return !kw || [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const live = all.filter((r) => r.status === '报价中').length;
  const leading = all.filter((r) => r.status === '报价中' && r.auctionMyRank === 1).length;
  const awarded = all.filter((r) => r.status === '已定标' && r.awardedSupplierId === supplierId).length;
  const myLatest = (rfqId?: string) =>
    quoteList
      .filter((q) => q.rfqId === rfqId)
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0]?.amount;

  return (
    <Panel title="竞价项目" icon={Gavel} subtitle="在线竞价 · 实时出价与排名 · 竞价大厅">
      {hasLiveAuction && (
        <div className="mb-3 flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-black',
            streamLive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', streamLive ? 'animate-pulse bg-emerald-500' : 'bg-slate-400')} />
            {streamLive ? '实时推送已连接' : '实时推送重连中 · 每 5 秒刷新'}
          </span>
        </div>
      )}
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部竞价" value={String(all.length)} />
        <MiniFact label="竞价中" value={String(live)} />
        <MiniFact label="当前领先" value={String(leading)} />
        <MiniFact label="我方成交" value={String(awarded)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '报价中', '已开标', '已定标'].map((id) => ({
            id,
            label: id === '报价中' ? '竞价中' : id,
            count: id === '全部' ? undefined : all.filter((r) => r.status === id).length,
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

      {rfqs.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载竞价项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的竞价。' : '暂无竞价项目。收到竞价邀请后出现在此。'}
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((r, i) => (
              <div key={r.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {r.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{r.id}</p>
                  </div>
                  {r.status && <StatusPill label={r.status === '报价中' ? '竞价中' : r.status} />}
                </div>
                <button
                  type="button"
                  onClick={() => r.id && onOpenProject(r.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md bg-amber-600 text-xs font-black text-white hover:bg-amber-700"
                >
                  进入竞价大厅
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">竞价项目</th>
                  <th className="px-5 py-4">邀请状态</th>
                  <th className="px-5 py-4">竞价状态</th>
                  <th className="px-5 py-4 text-center">我的排名</th>
                  <th className="px-5 py-4 text-right">我方最新出价</th>
                  <th className="px-5 py-4 text-right">当前最低</th>
                  <th className="px-5 py-4">竞价截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((r, i) => {
                  const invitation = (r.invitations ?? [])[0];
                  const state = inviteState(invitation);
                  const liveNow = r.status === '报价中';
                  return (
                    <tr key={r.id} className="hover:bg-amber-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-52 truncate font-black text-slate-950" title={r.title ?? undefined}>{r.title}</p>
                        <p className="mt-1 w-52 truncate font-mono text-[11px] font-bold text-slate-400" title={r.id ?? undefined}>{r.id}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', inviteTone[state])}>{state}</span>
                      </td>
                      <td className="px-5 py-5">
                        {liveNow ? (
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-600">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> LIVE 竞价中
                          </span>
                        ) : (
                          r.status && <StatusPill label={r.status} />
                        )}
                        {r.status === '已定标' && (
                          <p className={cn('mt-1 text-[11px] font-black', r.awardedSupplierId === supplierId ? 'text-emerald-600' : 'text-slate-400')}>
                            {r.awardedSupplierId === supplierId ? '我方成交' : '未成交'}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5 text-center">
                        {r.auctionMyRank != null ? (
                          <span
                            className={cn(
                              'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-mono text-xs font-black',
                              r.auctionMyRank === 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {r.auctionMyRank === 1 ? '领先' : `第${r.auctionMyRank}名`}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(myLatest(r.id))}</td>
                      <td className="px-5 py-5 text-right font-mono text-xs font-black text-slate-600">
                        {r.auctionShowLowest === false ? '未公开' : currency(r.auctionLowestAmount)}
                      </td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(r.deadlineAt)}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => r.id && onOpenProject(r.id)}
                          className={cn(
                            'inline-flex h-8 items-center rounded-md px-3 text-xs font-black transition',
                            liveNow
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {liveNow ? '进入竞价大厅' : '查看竞价'}
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
