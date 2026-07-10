import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, ShieldCheck } from 'lucide-react';
import {
  useBuyerSupplierList,
  useBuyerSupplierReviewAdmission,
  useBuyerSupplierSubmitAdmission,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination, Panel, SearchInput, StatusPill, cn } from '@24bid/ui';
import { SupplierSummaryChip, SupplierSummaryChips } from './supplier-metric-card';

const ADMISSION_STATUSES = ['待准入', '准入审批中', '已驳回'];
const PAGE_SIZE = 8;

// 准入审批台:把准入流程中的供应商聚成工作队列,行内直接提交/过/驳。
export function SupplierAdmissionQueue({ onOpen }: { onOpen: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const query = useBuyerSupplierList();
  const submit = useBuyerSupplierSubmitAdmission();
  const review = useBuyerSupplierReviewAdmission();
  const all = query.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const queue = all
    .filter((s) => ADMISSION_STATUSES.includes(s.status ?? ''))
    .filter(
      (s) =>
        !kw ||
        [s.supplierName, s.level, ...(s.categories ?? [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(kw),
    );
  const pageCount = Math.max(1, Math.ceil(queue.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = queue.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const busy = submit.isPending || review.isPending;
  const count = (st: string) => all.filter((s) => s.status === st).length;

  const btn = (label: string, onClick: () => void, tone: 'blue' | 'emerald' | 'red') => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex h-8 items-center rounded-md px-3 text-xs font-black text-white transition disabled:bg-slate-400',
        tone === 'emerald' && 'bg-emerald-600 hover:bg-emerald-700',
        tone === 'blue' && 'bg-blue-600 hover:bg-blue-700',
        tone === 'red' && 'bg-red-600 hover:bg-red-700',
      )}
    >
      {busy ? '处理中' : label}
    </button>
  );

  const actionsFor = (id: string, status?: string) => {
    switch (status) {
      case '待准入':
      case '已驳回':
        return btn('提交准入', () => submit.mutate({ relationId: id }, { onSuccess: refresh }), 'blue');
      case '准入审批中':
        return (
          <div className="flex gap-2">
            {btn('通过', () => review.mutate({ relationId: id, data: { approved: true } }, { onSuccess: refresh }), 'emerald')}
            {btn('驳回', () => review.mutate({ relationId: id, data: { approved: false } }, { onSuccess: refresh }), 'red')}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Panel title="准入审批台" icon={ShieldCheck} subtitle="准入流程中的供应商工作队列 · 提交 / 审核">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SupplierSummaryChips>
          <SupplierSummaryChip icon={Clock3} label="待提交" value={String(count('待准入'))} tone="amber" />
          <SupplierSummaryChip icon={ShieldCheck} label="审批中" value={String(count('准入审批中'))} tone="blue" />
          <SupplierSummaryChip icon={AlertCircle} label="已驳回" value={String(count('已驳回'))} tone="rose" />
          <SupplierSummaryChip icon={CheckCircle2} label="队列总量" value={String(queue.length)} tone="emerald" />
        </SupplierSummaryChips>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按供应商名称 / 等级 / 品类搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载准入队列…" />
      ) : queue.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={keyword ? '没有符合条件的供应商。' : '当前没有处于准入流程中的供应商。'}
        />
      ) : (
        <>
        <div className="space-y-2">
          {pageItems.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words font-black text-slate-950">{s.supplierName}</p>
                  {s.status && <StatusPill label={s.status} />}
                </div>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  等级 {s.level ?? '—'} · 授权品类 {(s.categories ?? []).join('、') || '—'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {s.id && actionsFor(s.id, s.status)}
                {s.id && (
                  <button
                    type="button"
                    onClick={() => onOpen(s.id!)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    360 <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Pagination page={safePage} pageSize={PAGE_SIZE} total={queue.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
