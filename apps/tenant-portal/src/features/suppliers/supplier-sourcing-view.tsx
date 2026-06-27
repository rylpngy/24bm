import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import {
  type DiscoverableSupplierResponse,
  useBuyerSupplierCreate,
  useBuyerSupplierDiscoveryDiscover,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, ShellState } from '@24bid/ui';

const PAGE_SIZE = 8;
const VERIFIED_LABEL: Record<string, string> = { approved: '已认证', pending: '待认证', rejected: '已驳回' };
const PROFILE_LABEL: Record<string, string> = {
  complete: '资料完整',
  submitted: '已提交资料',
  draft: '资料草稿',
};

function Badge({ text, tone }: { text: string; tone: 'emerald' | 'amber' | 'slate' }) {
  const cls =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-700 border-amber-100'
        : 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-black leading-4 ${cls}`}>
      {text}
    </span>
  );
}

// 寻源发现:搜全平台供应商企业(尚未在私域),一键加入待准入。
export function SupplierSourcingView() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);

  const query = useBuyerSupplierDiscoveryDiscover(keyword ? { keyword } : undefined);
  const create = useBuyerSupplierCreate();
  const results = query.data?.data ?? [];
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const addingId = create.isPending ? create.variables?.data?.supplierId : null;

  const addToPool = (s: DiscoverableSupplierResponse) =>
    create.mutate(
      {
        data: {
          supplierId: s.supplierId ?? '',
          status: '待准入',
          level: '普通',
          categories: s.industry ? [s.industry] : [],
        },
      },
      { onSuccess: refresh },
    );

  return (
    <Panel title="寻源发现" icon={Search} subtitle="搜索平台供应商 · 一键加入私域待准入">
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <MiniFact label="可纳入供应商" value={String(results.length)} />
        <MiniFact label="当前搜索" value={keyword || '全部'} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(input.trim());
          setPage(1);
        }}
        className="mb-4 flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="按企业名称 / 行业搜索,如「智能」「办公」"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700"
        >
          搜索
        </button>
        {keyword && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              setKeyword('');
            }}
            className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            清除
          </button>
        )}
      </form>

      {create.isError && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message="加入失败:该供应商可能已在私域库中。" />
        </div>
      )}

      {query.isLoading ? (
        <ShellState variant="loading" title="搜索供应商" desc="检索平台供应商目录…" />
      ) : results.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={keyword ? `没有匹配「${keyword}」的可纳入供应商。` : '平台暂无可纳入的新供应商(其余均已在私域库)。'}
        />
      ) : (
        <>
        <div className="space-y-2">
          {pageItems.map((s) => (
            <div
              key={s.supplierId}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words font-black text-slate-950">{s.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  {s.industry || '—'} · 统一社会信用代码 {s.creditCode || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge
                    text={VERIFIED_LABEL[s.verifiedStatus ?? ''] ?? s.verifiedStatus ?? '未认证'}
                    tone={s.verifiedStatus === 'approved' ? 'emerald' : 'amber'}
                  />
                  <Badge
                    text={PROFILE_LABEL[s.profileStatus ?? ''] ?? s.profileStatus ?? '—'}
                    tone={s.profileStatus === 'complete' ? 'emerald' : 'slate'}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => addToPool(s)}
                disabled={create.isPending}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
              >
                <Plus size={14} /> {addingId === s.supplierId ? '加入中' : '加入待准入'}
              </button>
            </div>
          ))}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={results.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
