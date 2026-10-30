import { Fragment, useMemo, useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import type { QuoteResponse } from '@24bid/api-client';
import { StatusPill, cn } from '@24bid/ui';

interface QuoteRow extends QuoteResponse {
  supplierName: string;
  taxedAmount: number;
  recommended: boolean;
}

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 比价矩阵——TanStack Table(headless)。含税总价排序 + 最低价推荐 + 定标。
export function QuoteComparisonTable({
  quotes,
  supplierNames,
  canAward,
  awardingQuoteId,
  onAward,
}: {
  quotes: QuoteResponse[];
  supplierNames: Record<string, string>;
  canAward: boolean;
  awardingQuoteId: string | null;
  onAward: (quoteId: string) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'taxedAmount', desc: false }]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo<QuoteRow[]>(() => {
    const withTax = quotes.map((q) => ({
      ...q,
      supplierName: supplierNames[q.supplierId ?? ''] ?? q.supplierId ?? '—',
      taxedAmount: q.amount ?? 0,
      recommended: false,
    }));
    const min = Math.min(...withTax.map((r) => r.taxedAmount));
    return withTax.map((r) => ({ ...r, recommended: r.taxedAmount === min }));
  }, [quotes, supplierNames]);

  const columns = useMemo<ColumnDef<QuoteRow>[]>(
    () => [
      {
        id: 'expander',
        header: '',
        cell: (c) => {
          const q = c.row.original;
          const lines = q.lineItems ?? [];
          if (!q.id || lines.length === 0) return null;
          const open = expanded[q.id];
          return (
            <button
              type="button"
              onClick={() => setExpanded((s) => ({ ...s, [q.id!]: !s[q.id!] }))}
              className="text-slate-400 hover:text-slate-700"
              aria-label="展开明细"
            >
              {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          );
        },
      },
      {
        accessorKey: 'supplierName',
        header: '供应商',
        cell: (c) => (
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{c.getValue<string>()}</span>
            {c.row.original.recommended && (
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">
                价格最低
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'taxedAmount',
        header: '含税总价',
        cell: (c) => (
          <span className="font-mono font-black text-slate-900">{currency(c.getValue<number>())}</span>
        ),
      },
      { accessorKey: 'taxRate', header: '税率', cell: (c) => `${c.getValue<number>()}%` },
      { accessorKey: 'deliveryDays', header: '交期(天)', cell: (c) => c.getValue<number>() },
      {
        accessorKey: 'status',
        header: '状态',
        cell: (c) => <StatusPill label={c.getValue<string>() ?? '—'} />,
      },
      {
        id: 'action',
        header: '操作',
        cell: (c) => {
          const q = c.row.original;
          if (!canAward || !q.id) return <span className="text-xs font-bold text-slate-400">—</span>;
          const busy = awardingQuoteId === q.id;
          return (
            <button
              type="button"
              onClick={() => onAward(q.id!)}
              disabled={busy}
              className="inline-flex h-8 items-center rounded-md bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:bg-slate-400"
            >
              {busy ? '提交中' : '定标'}
            </button>
          );
        },
      },
    ],
    [canAward, awardingQuoteId, onAward, expanded],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-[680px] w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => {
                const sortable = h.column.getCanSort();
                return (
                  <th key={h.id} className="px-4 py-3">
                    <button
                      type="button"
                      disabled={!sortable}
                      onClick={h.column.getToggleSortingHandler()}
                      className={cn('inline-flex items-center gap-1', sortable && 'cursor-pointer')}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sortable && <ArrowUpDown size={12} className="text-slate-400" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {table.getRowModel().rows.map((row) => {
            const q = row.original;
            const lines = q.lineItems ?? [];
            const open = q.id ? expanded[q.id] : false;
            return (
              <Fragment key={row.id}>
                <tr className={q.recommended ? 'bg-blue-50/40' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-4">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {open && lines.length > 0 && (
                  <tr className="bg-slate-50/70">
                    <td colSpan={row.getVisibleCells().length} className="px-4 py-3">
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        报价行项明细（{lines.length} 项）
                      </p>
                      <table className="w-full text-left text-xs">
                        <thead className="text-[11px] font-black text-slate-400">
                          <tr>
                            <th className="px-2 py-1">品名/规格</th>
                            <th className="px-2 py-1 text-right">数量</th>
                            <th className="px-2 py-1 text-right">单价</th>
                            <th className="px-2 py-1 text-right">行金额</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {lines.map((l) => (
                            <tr key={l.id} className="font-bold text-slate-700">
                              <td className="px-2 py-1">{l.description}</td>
                              <td className="px-2 py-1 text-right">
                                {l.quantity}
                                {l.unit ? ` ${l.unit}` : ''}
                              </td>
                              <td className="px-2 py-1 text-right">{currency(l.unitPrice)}</td>
                              <td className="px-2 py-1 text-right font-black text-slate-900">
                                {currency(l.lineAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
