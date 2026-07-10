import { useState } from 'react';
import { BadgeCheck, CheckCircle2, ChevronRight, FileCheck2, ShieldCheck } from 'lucide-react';
import {
  type BuyerSupplierResponse,
  useBuyerSupplierList,
  useBuyerSupplierListRelationQualifications,
} from '@24bid/api-client';
import { FeedbackNotice, Pagination, Panel, SearchInput, ShellState } from '@24bid/ui';
import { qualificationAlert } from './supplier-qualifications-tab';
import { SupplierSummaryChip, SupplierSummaryChips } from './supplier-metric-card';

const PAGE_SIZE = 8;

// 单个供应商的资质行:自取该供应商证照,展示到期预警。
function SupplierQualRow({
  supplier,
  onOpen,
}: {
  supplier: BuyerSupplierResponse;
  onOpen: (id: string) => void;
}) {
  const id = supplier.id ?? '';
  const query = useBuyerSupplierListRelationQualifications(id, { query: { enabled: !!id } });
  const quals = query.data?.data ?? [];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div
        onClick={() => id && onOpen(id)}
        className="flex cursor-pointer items-center justify-between gap-2"
      >
        <p className="break-words font-black text-slate-950">{supplier.supplierName}</p>
        <span className="inline-flex items-center gap-1 text-xs font-black text-blue-600">
          资质 {quals.length} · 360 <ChevronRight size={13} />
        </span>
      </div>
      {query.isLoading ? (
        <p className="mt-2 text-xs font-bold text-slate-400">加载证照…</p>
      ) : quals.length === 0 ? (
        <p className="mt-2 text-xs font-bold text-slate-400">暂无资质证照。</p>
      ) : (
        <div className="mt-3 space-y-2">
          {quals.map((q) => {
            const alert = qualificationAlert(q.expiresAt);
            return (
              <div key={q.id} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-800">{q.qualificationType}</p>
                  <p className="mt-0.5 text-xs font-bold text-slate-500">
                    {q.certificateNo} · 到期 {q.expiresAt ?? '—'}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-lg border px-2 py-1 text-xs font-black leading-4 ${alert.tone}`}
                >
                  {alert.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 资质管理:跨供应商的证照台账 + 到期预警(逐供应商自取证照)。
export function SupplierQualificationsBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const kw = keyword.toLowerCase();
  // 只对已准入/审批中的供应商看资质(待准入往往尚未提交证照)。
  const tracked = all
    .filter((s) => s.status === '已准入' || s.status === '准入审批中')
    .filter((s) => !kw || (s.supplierName ?? '').toLowerCase().includes(kw));
  const pageCount = Math.max(1, Math.ceil(tracked.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = tracked.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <Panel title="资质管理" icon={BadgeCheck} subtitle="跨供应商证照台账 · 到期预警">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SupplierSummaryChips>
          <SupplierSummaryChip
            icon={FileCheck2}
            label="需维护"
            value={String(all.filter((s) => s.status === '已准入' || s.status === '准入审批中').length)}
            tone="blue"
          />
          <SupplierSummaryChip icon={CheckCircle2} label="已准入" value={String(all.filter((s) => s.status === '已准入').length)} tone="emerald" />
          <SupplierSummaryChip icon={ShieldCheck} label="审批中" value={String(all.filter((s) => s.status === '准入审批中').length)} tone="violet" />
          <SupplierSummaryChip icon={BadgeCheck} label="当前展示" value={String(tracked.length)} tone="amber" />
        </SupplierSummaryChips>
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按供应商名称搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
      </div>

      {query.isLoading ? (
        <ShellState variant="loading" title="加载供应商" desc="拉取供应商及其证照…" />
      ) : tracked.length === 0 ? (
        <FeedbackNotice tone="info" message={keyword ? '没有符合条件的供应商。' : '暂无可展示资质的供应商。'} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {pageItems.map((s) => (
              <SupplierQualRow key={s.id} supplier={s} onOpen={onOpen} />
            ))}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={tracked.length} onPageChange={setPage} />
        </>
      )}
    </Panel>
  );
}
