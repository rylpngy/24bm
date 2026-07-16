import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileBadge, Info } from 'lucide-react';
import { useSupplierTenderAcquire, useSupplierTenderList, type TenderResponse } from '@24bid/api-client';
import {
  FeedbackNotice,
  FilterTabs,
  MiniFact,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  RichTextView,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';
import { currency, shortTime } from './shared';

const PAGE_SIZE = 10;

const typeTone: Record<string, string> = {
  公开招标: 'bg-blue-50 text-blue-700',
  邀请招标: 'bg-violet-50 text-violet-700',
};

function acquisitionState(t: TenderResponse) {
  const mine = (t.acquisitions ?? [])[0];
  if (mine?.acquiredAt) return '已领取';
  if (mine) return '已发放待领取';
  return '未领取';
}

const acqTone: Record<string, string> = {
  已领取: 'bg-emerald-50 text-emerald-700',
  已发放待领取: 'bg-amber-50 text-amber-700',
  未领取: 'bg-slate-100 text-slate-500',
};

// 招标项目(供应商侧,Track C C-1):受邀发放 + 公开发售中的招标;领取文件后可阅读招标文件正文。
export function TenderProjectsPage() {
  const queryClient = useQueryClient();
  const tenders = useSupplierTenderList();
  const acquire = useSupplierTenderAcquire();
  const [filter, setFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const all = tenders.data?.data ?? [];
  const selected = selectedId ? all.find((t) => t.id === selectedId) : undefined;

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/tenders'),
    });

  const doAcquire = (tenderId?: string) => {
    if (!tenderId) return;
    setError(null);
    acquire.mutate(
      { tenderId },
      {
        onSuccess: () => { setFeedback('招标文件已领取,可查阅正文并准备投标。'); refresh(); },
        onError: (e) =>
          setError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '领取失败,请稍后重试'),
      },
    );
  };

  const kw = keyword.trim().toLowerCase();
  const filtered = all.filter((t) => {
    if (filter !== '全部') {
      if (filter === '公开招标' || filter === '邀请招标') {
        if (t.tenderType !== filter) return false;
      } else if (acquisitionState(t) !== filter) {
        return false;
      }
    }
    return !kw || [t.title, t.tenderNo].filter(Boolean).join(' ').toLowerCase().includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const acquiredCount = all.filter((t) => acquisitionState(t) === '已领取').length;

  // ── 详情:要素 + 正文(领取后) ───────────────────────────────
  if (selected) {
    const t = selected;
    const state = acquisitionState(t);
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="返回招标项目"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                  {t.tenderType}
                </span>
                <h1 className="break-words text-lg font-black text-slate-950">{t.title}</h1>
                {t.status && <StatusPill label={t.status} />}
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[state])}>{state}</span>
              </div>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {t.tenderNo} · 递交截止 {shortTime(t.submissionDeadline)} · 开标 {shortTime(t.openingAt)}
              </p>
            </div>
          </div>
        </div>

        {feedback && <FeedbackNotice tone="success" message={feedback} />}
        {error && <FeedbackNotice tone="error" message={error} />}

        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
              <h3 className="text-base font-black text-slate-950">招标文件正文</h3>
              {t.documentHtml ? (
                <RichTextView html={t.documentHtml} className="mt-3" />
              ) : (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                  <p className="text-xs font-black text-amber-800">领取招标文件后方可查阅正文。</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    {state === '已发放待领取'
                      ? '招标人已定向发放,点击下方「确认领取」即可查阅并准备投标。'
                      : '公开招标发售期内可自助领取。'}
                  </p>
                  <PrimaryActionButton size="sm" onClick={() => doAcquire(t.id)} busy={acquire.isPending} pendingLabel="领取中">
                    {state === '已发放待领取' ? '确认领取招标文件' : '领取招标文件'}
                  </PrimaryActionButton>
                </div>
              )}
            </section>
          </div>

          <div className="space-y-4">
            <section className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black"><Info size={15} className="text-blue-400" /> 关键信息</p>
              <dl className="mt-4 space-y-3.5">
                {[
                  ['招标编号', t.tenderNo ?? '—'],
                  ['预算金额', currency(t.budget)],
                  ['评标办法', t.evaluationMethod ?? '—'],
                  ['投标保证金', t.bidBondAmount != null ? currency(t.bidBondAmount) : '不收取'],
                  ['文件获取截止', shortTime(t.acquisitionDeadline)],
                  ['投标递交截止', shortTime(t.submissionDeadline)],
                  ['开标时间', shortTime(t.openingAt)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11px] font-bold text-slate-400">{k}</dt>
                    <dd className="mt-0.5 break-words text-sm font-black">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <FeedbackNotice tone="info" message="投标文件加密递交将在下一版本开放;当前阶段请完成文件领取与投标准备。" />
          </div>
        </div>
      </div>
    );
  }

  // ── 台账 ───────────────────────────────────────────────────
  return (
    <Panel title="招标项目" icon={FileBadge} subtitle="受邀发放 · 公开发售 · 招标文件领取(2.0)">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="全部招标" value={String(all.length)} />
        <MiniFact label="已领取文件" value={String(acquiredCount)} />
        <MiniFact label="公开招标" value={String(all.filter((t) => t.tenderType === '公开招标').length)} />
        <MiniFact label="邀请招标" value={String(all.filter((t) => t.tenderType === '邀请招标').length)} />
      </div>

      {feedback && <div className="mb-3"><FeedbackNotice tone="success" message={feedback} /></div>}
      {error && <div className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '公开招标', '邀请招标', '已领取', '未领取'].map((id) => ({
            id,
            label: id,
            count:
              id === '全部'
                ? undefined
                : id === '公开招标' || id === '邀请招标'
                  ? all.filter((t) => t.tenderType === id).length
                  : all.filter((t) => acquisitionState(t) === id).length,
          }))}
          value={filter}
          onChange={(id) => { setFilter(id); setPage(1); }}
        />
        <SearchInput className="mb-0 ml-auto" placeholder="按项目名称 / 招标编号搜索"
          onSearch={(k) => { setKeyword(k); setPage(1); }} />
      </div>

      {tenders.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载招标项目…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice tone="info"
          message={kw || filter !== '全部' ? '没有符合条件的招标项目。' : '暂无招标项目。收到定向发放或平台出现公开招标后展示在此。'} />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((t, i) => (
              <div key={t.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>{t.title}
                    </p>
                    <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                  </div>
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[acquisitionState(t)])}>
                    {acquisitionState(t)}
                  </span>
                </div>
                <button type="button" onClick={() => setSelectedId(t.id ?? null)}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">
                  查看招标
                </button>
              </div>
            ))}
          >
            <table className="w-full min-w-[1020px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">招标项目</th>
                  <th className="px-5 py-4">招标方式</th>
                  <th className="px-5 py-4">领取状态</th>
                  <th className="px-5 py-4 text-right">预算</th>
                  <th className="px-5 py-4">文件获取截止</th>
                  <th className="px-5 py-4">投标递交截止</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((t, i) => {
                  const state = acquisitionState(t);
                  return (
                    <tr key={t.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="w-56 truncate font-black text-slate-950" title={t.title ?? undefined}>{t.title}</p>
                        <p className="mt-1 w-56 truncate font-mono text-[11px] font-bold text-slate-400">{t.tenderNo}</p>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', typeTone[t.tenderType ?? ''] ?? 'bg-slate-100 text-slate-600')}>
                          {t.tenderType}
                        </span>
                      </td>
                      <td className="px-5 py-5">
                        <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', acqTone[state])}>{state}</span>
                      </td>
                      <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(t.budget)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.acquisitionDeadline)}</td>
                      <td className="px-5 py-5 font-mono text-xs font-bold text-slate-600">{shortTime(t.submissionDeadline)}</td>
                      <td className="px-5 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          {state !== '已领取' && t.status === '发售中' && (
                            <button type="button" onClick={() => doAcquire(t.id)} disabled={acquire.isPending}
                              className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300">
                              {state === '已发放待领取' ? '确认领取' : '领取文件'}
                            </button>
                          )}
                          <button type="button" onClick={() => setSelectedId(t.id ?? null)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">
                            查看招标
                          </button>
                        </div>
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
