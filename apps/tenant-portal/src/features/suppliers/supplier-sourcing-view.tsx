import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Building2, CheckCircle2, Plus, Search, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import {
  type DiscoverableSupplierResponse,
  useBuyerSupplierCreate,
  useBuyerSupplierDiscoveryDiscover,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination, Panel, ShellState } from '@24bid/ui';
import { SupplierSummaryChip, SupplierSummaryChips } from './supplier-metric-card';

const PAGE_SIZE = 8;
const VERIFIED_LABEL: Record<string, string> = { approved: '已认证', pending: '待认证', rejected: '已驳回' };
const PROFILE_LABEL: Record<string, string> = {
  complete: '资料完整',
  submitted: '已提交资料',
  draft: '资料草稿',
};

const MATCH_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500'];

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

function matchScore(s: DiscoverableSupplierResponse) {
  let score = 72;
  if (s.verifiedStatus === 'approved') score += 10;
  if (s.profileStatus === 'complete') score += 8;
  if (s.industry) score += Math.min(8, s.industry.length);
  if (s.creditCode) score += 4;
  return Math.min(score, 98);
}

// 智能寻源:搜全平台供应商企业(尚未在私域),一键加入待准入。
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
  const approvedCount = results.filter((s) => s.verifiedStatus === 'approved').length;
  const completeCount = results.filter((s) => s.profileStatus === 'complete').length;
  const avgMatch =
    results.length > 0 ? Math.round(results.reduce((sum, s) => sum + matchScore(s), 0) / results.length) : 0;

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
    <Panel title="智能寻源" icon={Search} subtitle="AI 匹配平台供应商 · 一键加入私域待准入">
      <div className="mb-4 overflow-hidden rounded-lg border border-blue-100 bg-blue-50/70 p-3 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
              <WandSparkles size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-950">AI 智能寻源助手</p>
              <p className="mt-1 max-w-3xl text-xs font-bold leading-5 text-slate-500">
                基于认证状态、资料完整度、行业匹配与信用代码完整性，为采购人筛选可纳入私域供应商。
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
                  <ShieldCheck size={12} /> 认证优先
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
                  <CheckCircle2 size={12} /> 资料完整
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-black text-violet-700 ring-1 ring-violet-100">
                  <Sparkles size={12} /> 智能推荐
                </span>
              </div>
            </div>
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
            <div>
              <p className="text-[11px] font-black text-slate-400">平均匹配度</p>
              <p className="mt-1 font-mono text-xl font-black text-slate-950">{avgMatch ? `${avgMatch}%` : '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-slate-400">推荐候选</p>
              <p className="mt-1 font-mono text-xl font-black text-slate-950">{results.length}</p>
            </div>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(input.trim());
          setPage(1);
        }}
        className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
      >
        <SupplierSummaryChips>
          <SupplierSummaryChip icon={Building2} label="可纳入" value={String(results.length)} tone="blue" />
          <SupplierSummaryChip icon={BadgeCheck} label="已认证" value={String(approvedCount)} tone="emerald" />
          <SupplierSummaryChip icon={Sparkles} label="资料完整" value={String(completeCount)} tone="violet" />
          <SupplierSummaryChip icon={Search} label="当前页" value={String(pageItems.length)} tone="amber" />
        </SupplierSummaryChips>
        <div className="relative ml-auto w-64 sm:w-80">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="按企业名称 / 行业搜索,如「智能」「办公」"
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Search size={13} /> 搜索
        </button>
        {keyword && (
          <button
            type="button"
            onClick={() => {
              setInput('');
              setKeyword('');
            }}
            className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
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
        <div className="grid gap-3 lg:grid-cols-2">
          {pageItems.map((s) => (
            <div
              key={s.supplierId}
              className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50 transition hover:bg-slate-50"
            >
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-black text-white">
                  {(s.name ?? '企').slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-950">{s.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {s.industry || '未填写行业'} · 统一社会信用代码 {s.creditCode || '—'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-base font-black text-blue-700">{matchScore(s)}%</p>
                      <p className="text-[10px] font-black text-slate-400">匹配度</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge
                      text={VERIFIED_LABEL[s.verifiedStatus ?? ''] ?? s.verifiedStatus ?? '未认证'}
                      tone={s.verifiedStatus === 'approved' ? 'emerald' : 'amber'}
                    />
                    <Badge
                      text={PROFILE_LABEL[s.profileStatus ?? ''] ?? s.profileStatus ?? '—'}
                      tone={s.profileStatus === 'complete' ? 'emerald' : 'slate'}
                    />
                    <Badge text={s.industry || '待补充行业'} tone="slate" />
                  </div>
                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-black text-slate-400">
                      <span>AI 推荐强度</span>
                      <span>{s.verifiedStatus === 'approved' ? '优先纳入' : '建议核验后纳入'}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${MATCH_COLORS[pageItems.indexOf(s) % MATCH_COLORS.length]}`}
                        style={{ width: `${matchScore(s)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-3">
                <p className="text-[11px] font-bold text-slate-500">
                  推荐原因: {s.profileStatus === 'complete' ? '资料完整' : '待补充资料'} · {s.verifiedStatus === 'approved' ? '平台已认证' : '认证待核验'}
                </p>
                <button
                  type="button"
                  onClick={() => addToPool(s)}
                  disabled={create.isPending}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
                >
                  <Plus size={14} /> {addingId === s.supplierId ? '加入中' : '加入待准入'}
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={results.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
