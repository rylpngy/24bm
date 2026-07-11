import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, Plus, Search, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
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

// 资料完备度:认证状态/资料完整度/行业/信用代码的规则打分(非 AI,规则透明)。
function matchScore(s: DiscoverableSupplierResponse) {
  let score = 72;
  if (s.verifiedStatus === 'approved') score += 10;
  if (s.profileStatus === 'complete') score += 8;
  if (s.industry) score += Math.min(8, s.industry.length);
  if (s.creditCode) score += 4;
  return Math.min(score, 98);
}

const gradeOf = (score: number) =>
  score >= 90
    ? { label: 'A 级', cls: 'bg-emerald-50 text-emerald-700' }
    : score >= 82
      ? { label: 'B 级', cls: 'bg-blue-50 text-blue-700' }
      : { label: 'C 级', cls: 'bg-amber-50 text-amber-700' };

function StatChip({ icon: Icon, label, value, tone }: { icon: typeof Search; label: string; value: string; tone: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-black ring-1', tone)}>
      <Icon size={12} /> {label} {value}
    </span>
  );
}

// 智能寻源:搜全平台供应商企业(尚未在私域),规则化纳入建议,一键加入待准入。
export function SupplierSourcingView() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);

  const query = useBuyerSupplierDiscoveryDiscover(keyword ? { keyword } : undefined);
  const create = useBuyerSupplierCreate();
  const results = query.data?.data ?? [];
  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const approvedCount = results.filter((s) => s.verifiedStatus === 'approved').length;
  const completeCount = results.filter((s) => s.profileStatus === 'complete').length;

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

  // 纳入建议:基于真实统计的规则化文案(认证数/资料完整数/候选结构),非生成式内容。
  const advice = (() => {
    if (results.length === 0) return null;
    const parts: string[] = [];
    if (approvedCount > 0) parts.push(`${approvedCount} 家已通过平台认证,可优先发起准入`);
    if (completeCount > 0) parts.push(`${completeCount} 家资料完整,核验成本低`);
    const gap = results.length - approvedCount;
    if (gap > 0) parts.push(`${gap} 家认证待核验,纳入后请在准入审批中补充资质核验`);
    return `当前${keyword ? `「${keyword}」下` : ''}共 ${results.length} 家可纳入候选:${parts.join(';')}。`;
  })();

  return (
    <div className="space-y-4">
      {/* 模块头:标题 + 说明 */}
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <h1 className="text-base font-black text-slate-950">智能寻源助手</h1>
        <p className="mt-1 text-xs font-bold text-slate-400">检索全平台认证供应商资源,按规则匹配后一键纳入私域待准入</p>
      </div>

      {/* 寻源发起卡:左介绍 / 右输入 + 主按钮 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <WandSparkles size={22} />
            </span>
            <h2 className="mt-4 text-xl font-black text-slate-950">开始智能寻源</h2>
            <p className="mt-2 max-w-md text-sm font-semibold leading-6 text-slate-500">
              按企业名称或行业关键词检索平台供应商目录,系统按认证状态、资料完整度与行业匹配规则打分,
              筛出可纳入私域的候选供应商。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                <ShieldCheck size={12} /> 认证优先
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                <CheckCircle2 size={12} /> 资料完整
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                <Sparkles size={12} /> 行业匹配
              </span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setKeyword(input.trim());
              setSearched(true);
              setPage(1);
            }}
            className="rounded-lg border border-slate-100 bg-slate-50/60 p-4"
          >
            <label className="block">
              <span className="text-xs font-black text-slate-500">需求输入(关键词匹配)</span>
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
              <WandSparkles size={16} /> 开始智能寻源
            </button>
            <p className="mt-2 text-[11px] font-bold text-slate-400">
              留空直接寻源 = 列出全部尚未纳入私域的平台供应商。
            </p>
          </form>
        </div>
      </div>

      {create.isError && <FeedbackNotice tone="error" message="加入失败:该供应商可能已在私域库中。" />}

      {query.isLoading ? (
        <ShellState variant="loading" title="检索供应商" desc="检索平台供应商目录…" />
      ) : results.length === 0 ? (
        searched ? (
          <FeedbackNotice
            tone="info"
            message={keyword ? `没有匹配「${keyword}」的可纳入供应商。` : '平台暂无可纳入的新供应商(其余均已在私域库)。'}
          />
        ) : (
          <FeedbackNotice tone="info" message="输入关键词或直接点「开始智能寻源」,检索可纳入的平台供应商。" />
        )
      ) : (
        <>
          {/* 检索结果统计 */}
          <div className="flex flex-wrap items-center gap-2">
            <StatChip icon={Search} label="推荐候选" value={String(results.length)} tone="text-blue-700 ring-blue-100" />
            <StatChip icon={BadgeCheck} label="已认证" value={String(approvedCount)} tone="text-emerald-700 ring-emerald-100" />
            <StatChip icon={Sparkles} label="资料完整" value={String(completeCount)} tone="text-violet-700 ring-violet-100" />
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

          {/* 纳入建议:真实统计的规则化建议 */}
          {advice && (
            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-black text-blue-800">
                <WandSparkles size={13} /> 纳入建议(按认证与资料规则核对生成)
              </p>
              <p className="mt-1.5 text-xs font-bold leading-5 text-slate-600">{advice}</p>
            </div>
          )}

          {/* 候选供应商卡片:三列简洁卡 */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageItems.map((s) => {
              const score = matchScore(s);
              const grade = gradeOf(score);
              return (
                <div
                  key={s.supplierId}
                  className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50 transition hover:border-blue-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-sm font-black text-slate-700">
                      {(s.name ?? '企').slice(0, 1)}
                    </span>
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-black', grade.cls)}>{grade.label}</span>
                  </div>
                  <p className="mt-3 break-words text-[15px] font-black text-slate-950">{s.name}</p>
                  <div className="mt-2 space-y-1 text-xs font-bold text-slate-500">
                    <p>认证状态: {VERIFIED_LABEL[s.verifiedStatus ?? ''] ?? '未认证'} · {PROFILE_LABEL[s.profileStatus ?? ''] ?? '资料待补充'}</p>
                    <p>资料完备度 <span className="font-mono font-black text-slate-900">{score}%</span></p>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-[11px] font-black text-slate-400">所属行业</p>
                    <p className="mt-0.5 text-xs font-bold leading-5 text-slate-700">{s.industry || '未填写行业'}</p>
                  </div>
                  <div className="mt-2">
                    <p className="text-[11px] font-black text-slate-400">纳入建议</p>
                    <p className="mt-0.5 text-xs font-bold leading-5 text-slate-700">
                      {s.verifiedStatus === 'approved'
                        ? '平台已认证,可优先发起准入。'
                        : '认证待核验,建议纳入后在准入审批中完成资质核验。'}
                      {s.profileStatus !== 'complete' && '资料未完整,准入前需补充档案。'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToPool(s)}
                    disabled={create.isPending}
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
