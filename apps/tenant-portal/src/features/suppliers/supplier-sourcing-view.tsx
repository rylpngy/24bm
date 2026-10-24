import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Plus, Search } from 'lucide-react';
import {
  type DiscoverableSupplierResponse,
  useBuyerSupplierCreate,
  useBuyerSupplierDiscoveryDiscover,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination, ShellState, cn } from '@24bid/ui';

const PAGE_SIZE = 9;
const VERIFIED_LABEL: Record<string, string> = { approved: '已认证', pending: '待认证', rejected: '已驳回' };
const PROFILE_LABEL: Record<string, string> = {
  complete: '资料完整',
  submitted: '已提交资料',
  draft: '资料草稿',
};

function StatChip({ icon: Icon, label, value, tone }: { icon: typeof Search; label: string; value: string; tone: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black ring-1', tone)}>
      <Icon size={12} /> {label} {value}
    </span>
  );
}

export function SupplierSourcingView() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);

  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);

  const query = useBuyerSupplierDiscoveryDiscover(keyword ? { keyword } : undefined);
  const create = useBuyerSupplierCreate();
  const results = query.isError ? [] : (query.data?.data ?? []).filter(row => !addedIds.includes(row.supplierId ?? ''));
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const approvedCount = results.filter((s) => s.verifiedStatus === 'approved').length;
  const completeCount = results.filter((s) => s.profileStatus === 'complete').length;

  const addToPool = async (supplier: DiscoverableSupplierResponse) => {
    if (!supplier.supplierId || lock.current || query.isError || query.isFetching || addedIds.includes(supplier.supplierId)) return;
    lock.current = true;
    setAddingId(supplier.supplierId);
    setFeedback('');
    setError('');
    try {
      await create.mutateAsync({ data: {
        supplierId: supplier.supplierId,
        status: '待准入',
        level: '普通',
        categories: supplier.industry ? [supplier.industry] : [],
      } });
      setAddedIds(ids => [...ids, supplier.supplierId!]);
      setFeedback(`${supplier.name || '供应商'}已加入待准入，仍需办理准入审批。`);
      // Discovery and the private supplier list share this endpoint prefix.
      await queryClient.invalidateQueries({ predicate: q =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] === '/api/v1/buyer/suppliers' || q.queryKey[0].startsWith('/api/v1/buyer/suppliers/')),
      }, { throwOnError: true }).catch(() => setError('加入已成功，但列表刷新失败，请重试检索。'));
    } catch (cause) {
      setError((cause as { response?: { data?: { message?: string } } })?.response?.data?.message || '加入失败，请重试。');
    } finally {
      lock.current = false;
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 模块头:标题 + 说明 */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <h1 className="text-base font-black text-slate-950">供应商寻源</h1>
        <p className="mt-1 text-xs font-bold text-slate-400">平台目录检索</p>
      </div>

      {/* 寻源发起卡:左介绍 / 右输入 + 主按钮 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Search size={22} />
            </span>
            <h2 className="mt-4 text-xl font-black text-slate-950">平台供应商目录</h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim() === keyword) void query.refetch();
              else setKeyword(input.trim());
              setSearched(true);
              setPage(1);
            }}
            className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
          >
            <label className="block">
              <span className="text-xs font-black text-slate-500">企业名称 / 行业关键词</span>
              <div className="relative mt-2">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="按企业名称 / 行业搜索,如「智能」「办公」"
                  className="h-11 w-full rounded-lg border-2 border-blue-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </label>
            <button
              type="submit"
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-black text-white transition hover:bg-slate-800"
            >
              <Search size={16} /> 检索
            </button>
          </form>
        </div>
      </div>

      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      {error && <FeedbackNotice tone="error" message={error} />}

      {query.isError ? (
        <div className="space-y-3">
          <FeedbackNotice tone="error" message="供应商检索失败，请重试。" />
          <button type="button" disabled={query.isFetching || !!addingId} onClick={() => void query.refetch()}
            className="min-h-9 rounded-md border border-slate-200 px-3 text-sm font-bold disabled:opacity-50">重试</button>
        </div>
      ) : query.isLoading ? (
        <ShellState variant="loading" title="检索供应商" desc="检索平台供应商目录…" />
      ) : results.length === 0 ? (
        searched ? (
          <FeedbackNotice
            tone="info"
            message={keyword ? `没有匹配「${keyword}」的可纳入供应商。` : '暂无可纳入的平台供应商。'}
          />
        ) : (
          <FeedbackNotice tone="info" message="输入关键词或直接点「检索」,检索可纳入的平台供应商。" />
        )
      ) : (
        <>
          {/* 检索结果统计 */}
          <div className="flex flex-wrap items-center gap-2">
            <StatChip icon={Search} label="检索结果" value={String(results.length)} tone="text-blue-700 ring-blue-100" />
            <StatChip icon={BadgeCheck} label="已认证" value={String(approvedCount)} tone="text-emerald-700 ring-emerald-100" />
            <StatChip icon={CheckCircle2} label="资料完整" value={String(completeCount)} tone="text-violet-700 ring-violet-100" />
            {keyword && (
              <button
                type="button"
                onClick={() => {
                  setInput('');
                  setKeyword('');
                  setPage(1);
                }}
                className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-500 hover:bg-slate-50"
              >
                清除「{keyword}」
              </button>
            )}
          </div>

          {/* 候选供应商卡片:三列简洁卡 */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((s, index) => {
              return (
                <div
                  key={s.supplierId ?? index}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                      {(s.name ?? '企').slice(0, 1)}
                    </span>
                  </div>
                  <p className="mt-3 break-words text-[15px] font-black text-slate-950">{s.name}</p>
                  <div className="mt-2 space-y-1 text-xs font-bold text-slate-500">
                    <p>认证状态: {VERIFIED_LABEL[s.verifiedStatus ?? ''] ?? '未知'}</p>
                    <p>资料状态: {PROFILE_LABEL[s.profileStatus ?? ''] ?? '未知'}</p>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-black text-slate-400">所属行业</p>
                    <p className="mt-0.5 text-xs font-bold leading-5 text-slate-700">{s.industry || '未填写行业'}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-[11px] font-black text-slate-400">统一社会信用代码</p>
                    <p className="mt-0.5 break-all text-xs font-bold leading-5 text-slate-700">{s.creditCode || '未提供'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void addToPool(s)}
                    disabled={!!addingId || query.isFetching || !s.supplierId}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-black text-slate-700 transition hover:border-blue-300 hover:bg-blue-600 hover:text-white disabled:opacity-50"
                  >
                    <Plus size={14} /> {addingId === s.supplierId ? '加入中…' : '加入待准入'}
                  </button>
                </div>
              );
            })}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={results.length} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
