import { useState } from 'react';
import { FileSearch } from 'lucide-react';
import { useSupplierQuoteListList, useSupplierQuoteListRfqs } from '@24bid/api-client';
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

// 询比流程五阶段(与采购端项目详情步进器同口径):邀请报名 → 报价 → 开标 → 定标 → 结果公示。
const STAGES = ['邀请报名', '报价', '开标', '定标', '结果公示'];

function stageIndex(status?: string, resultAnnounced?: boolean) {
  if (resultAnnounced) return 5;
  if (status === '已定标') return 4;
  if (status === '已开标' || status === '定标审批中') return 3;
  if (status === '报价中') return 2;
  if (status === '已流标' || status === '已废标') return 3;
  return 1;
}

// 行内迷你流程条:与采购端同一套阶段语义,让供应商在列表即可看到项目走到了哪一步。
function StageDots({ status, resultAnnounced }: { status?: string; resultAnnounced?: boolean }) {
  const reached = stageIndex(status, resultAnnounced);
  const dead = status === '已流标' || status === '已废标';
  return (
    <div className="flex items-center gap-1" title={STAGES.join(' → ')}>
      {STAGES.map((label, i) => (
        <span key={label} className="flex items-center gap-1">
          <span
            title={label}
            className={cn(
              'h-2 w-2 rounded-full',
              i < reached ? (dead && i === reached - 1 ? 'bg-red-400' : 'bg-blue-600') : 'bg-slate-200',
            )}
          />
          {i < STAGES.length - 1 && <span className={cn('h-px w-2.5', i < reached - 1 ? 'bg-blue-300' : 'bg-slate-200')} />}
        </span>
      ))}
    </div>
  );
}

// 询价项目:询比 / 单一来源项目台账——邀请回执、流程阶段、我方报价;进入详情报价 / 开标大厅看唱标。
export function RfqProjectsPage({ onOpenProject }: { onOpenProject: (rfqId: string) => void }) {
  const supplierId = useAuthStore((s) => s.session?.supplierId ?? '');
  const rfqs = useSupplierQuoteListRfqs();
  const quotes = useSupplierQuoteListList();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const quoteList = quotes.data?.data ?? [];
  const all = (rfqs.data?.data ?? []).filter((r) => r.method !== '竞价');

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (filter !== '全部') {
      if (filter === '待报价') {
        if (!(r.status === '报价中' && !quoteList.some((q) => q.rfqId === r.id))) return false;
      } else if (filter === '我方中标') {
        if (!(r.status === '已定标' && r.awardedSupplierId === supplierId)) return false;
      } else if (r.status !== filter) {
        return false;
      }
    }
    return !kw || [r.title, r.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pendingQuote = all.filter((r) => r.status === '报价中' && !quoteList.some((q) => q.rfqId === r.id)).length;
  const opened = all.filter((r) => r.openedAt).length;
  const awarded = all.filter((r) => r.status === '已定标' && r.awardedSupplierId === supplierId).length;
  const myAmount = (rfqId?: string) =>
    quoteList
      .filter((q) => q.rfqId === rfqId)
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))[0]?.amount;

  return (
    <Panel title="询价项目" icon={FileSearch} subtitle="询比 / 单一来源 · 邀请报名 → 报价 → 开标 → 定标 → 结果公示">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部项目" value={String(all.length)} />
        <MiniFact label="待报价" value={String(pendingQuote)} />
        <MiniFact label="已开标" value={String(opened)} />
        <MiniFact label="我方中标" value={String(awarded)} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '待报价', '报价中', '已开标', '已定标', '我方中标'].map((id) => ({
            id,
            label: id,
            count:
              id === '全部'
                ? undefined
                : id === '待报价'
                  ? pendingQuote
                  : id === '我方中标'
                    ? awarded
                    : all.filter((r) => r.status === id).length,
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
        <FeedbackNotice tone="info" message="正在加载询价项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的项目。' : '暂无询价项目。收到询价邀请后出现在此。'}
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.status && <StatusPill label={r.status} />}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => r.id && onOpenProject(r.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  查看项目
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">项目</th>
                  <th className="px-5 py-4">邀请状态</th>
                  <th className="px-5 py-4">流程进度</th>
                  <th className="px-5 py-4">项目阶段</th>
                  <th className="px-5 py-4 text-right">我方报价</th>
                  <th className="px-5 py-4">报价截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((r, i) => {
                  const invitation = (r.invitations ?? [])[0];
                  const state = inviteState(invitation);
                  const quoted = quoteList.some((q) => q.rfqId === r.id);
                  const mine = myAmount(r.id);
                  return (
                    <tr key={r.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-52 truncate font-black text-slate-950" title={r.title ?? undefined}>{r.title}</p>
                        <p className="mt-1 w-52 truncate font-mono text-[11px] font-bold text-slate-400" title={r.id ?? undefined}>{r.id}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', inviteTone[state])}>{state}</span>
                        {state === '已读' && invitation?.viewedAt && (
                          <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{shortTime(invitation.viewedAt)}</p>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <StageDots status={r.status} resultAnnounced={!!r.resultAnnouncedAt} />
                        <p className="mt-1 text-[11px] font-bold text-slate-400">
                          {STAGES[Math.min(stageIndex(r.status, !!r.resultAnnouncedAt), STAGES.length) - 1]}
                        </p>
                      </td>
                      <td className="px-5 py-5">
                        <div className="flex flex-col items-start gap-1">
                          {r.status && <StatusPill label={r.status} />}
                          {r.status === '已定标' && (
                            <span
                              className={cn(
                                'rounded-md px-2 py-0.5 text-[11px] font-black',
                                r.awardedSupplierId === supplierId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500',
                              )}
                            >
                              {r.awardedSupplierId === supplierId ? '我方中标' : '未中标'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(mine)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(r.deadlineAt)}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => r.id && onOpenProject(r.id)}
                          className={cn(
                            'inline-flex h-8 items-center rounded-md px-3 text-xs font-black transition',
                            r.status === '报价中' && !quoted
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : r.openedAt
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {r.status === '报价中' && !quoted ? '去报价' : r.openedAt ? '开标大厅' : '查看项目'}
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
