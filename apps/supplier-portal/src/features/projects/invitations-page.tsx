import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useSupplierQuoteListRfqs } from '@24bid/api-client';
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

const PAGE_SIZE = 10;

const methodTone: Record<string, string> = {
  询比: 'bg-blue-50 text-blue-700',
  竞价: 'bg-amber-50 text-amber-700',
  单一来源: 'bg-slate-100 text-slate-600',
};

const shortTime = (v?: string | null) => (v ? `${v.slice(0, 10)} ${v.slice(11, 16)}` : '—');

// 邀请函状态:以邀请记录真实字段推导(已拒绝 > 已读(有 viewedAt) > 待查看)。
function inviteState(inv?: { inviteStatus?: string; viewedAt?: string | null }) {
  if (inv?.inviteStatus === '已拒绝') return '已拒绝';
  if (inv?.viewedAt) return '已读';
  return '待查看';
}

const inviteTone: Record<string, string> = {
  待查看: 'bg-amber-50 text-amber-700',
  已读: 'bg-emerald-50 text-emerald-700',
  已拒绝: 'bg-red-50 text-red-600',
};

// 项目邀请:询比/竞价项目的邀请函台账(邀请状态、项目阶段、截止时间),入口直达项目详情。
export function InvitationsPage({ onOpenProject }: { onOpenProject: (rfqId: string) => void }) {
  const rfqs = useSupplierQuoteListRfqs();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  // 全部受邀项目(供应商可见的 RFQ 即受邀项目;邀请记录仅返回本方一条)。
  const all = useMemo(
    () =>
      (rfqs.data?.data ?? []).map((r) => ({
        rfq: r,
        invitation: (r.invitations ?? [])[0],
      })),
    [rfqs.data],
  );

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter(({ rfq, invitation }) => {
    if (filter !== '全部') {
      if (filter === '待查看' || filter === '已读' || filter === '已拒绝') {
        if (inviteState(invitation) !== filter) return false;
      } else if ((rfq.method ?? '询比') !== filter) {
        return false;
      }
    }
    return !kw || [rfq.title, rfq.id].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const countBy = (state: string) => all.filter(({ invitation }) => inviteState(invitation) === state).length;

  return (
    <Panel title="项目邀请" icon={Inbox} subtitle="询比 / 竞价项目邀请函 · 查看回执与参与状态">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部邀请" value={String(all.length)} />
        <MiniFact label="待查看" value={String(countBy('待查看'))} />
        <MiniFact label="已读" value={String(countBy('已读'))} />
        <MiniFact label="已拒绝" value={String(countBy('已拒绝'))} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '询比', '竞价', '待查看', '已读', '已拒绝'].map((id) => ({
            id,
            label: id,
            count:
              id === '全部'
                ? undefined
                : id === '询比' || id === '竞价'
                  ? all.filter(({ rfq }) => (rfq.method ?? '询比') === id).length
                  : countBy(id),
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
        <FeedbackNotice tone="info" message="正在加载项目邀请…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的邀请。' : '暂无项目邀请。采购方发出询价函 / 竞价邀请后出现在此。'}
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map(({ rfq, invitation }, i) => (
              <div key={rfq.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {rfq.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{rfq.id}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', methodTone[rfq.method ?? '询比'] ?? methodTone['询比'])}>
                      {rfq.method ?? '询比'}
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', inviteTone[inviteState(invitation)])}>
                      {inviteState(invitation)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => rfq.id && onOpenProject(rfq.id)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  查看项目
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">项目</th>
                  <th className="px-5 py-4">采购方式</th>
                  <th className="px-5 py-4">邀请状态</th>
                  <th className="px-5 py-4">项目阶段</th>
                  <th className="px-5 py-4">报价 / 竞价截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map(({ rfq, invitation }, i) => {
                  const state = inviteState(invitation);
                  return (
                    <tr key={rfq.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-56 truncate font-black text-slate-950" title={rfq.title ?? undefined}>{rfq.title}</p>
                        <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400" title={rfq.id ?? undefined}>{rfq.id}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', methodTone[rfq.method ?? '询比'] ?? methodTone['询比'])}>
                          {rfq.method ?? '询比'}
                        </span>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', inviteTone[state])}>{state}</span>
                        {state === '已读' && (
                          <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{shortTime(invitation?.viewedAt)}</p>
                        )}
                        {state === '已拒绝' && invitation?.declineReason && (
                          <p className="mt-1 w-40 truncate text-[11px] font-bold text-slate-400" title={invitation.declineReason}>
                            {invitation.declineReason}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-5">{rfq.status && <StatusPill label={rfq.status} />}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(rfq.deadlineAt)}</td>
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          onClick={() => rfq.id && onOpenProject(rfq.id)}
                          className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                        >
                          查看项目
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
