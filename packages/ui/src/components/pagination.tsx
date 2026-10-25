import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { useI18n } from '../i18n/i18n';

export interface PaginationProps {
  page: number; // 1-based
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** 列表分页条——计数 + 区间 + 上/下一页。受控,1 基页码。 */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const { t } = useI18n();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pageCount);
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);

  const navBtn =
    'inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs font-bold text-slate-500">
        {t('共')} {total} {t('条')}{total > 0 && ` · ${from}-${to}`}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={navBtn}
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft size={14} /> {t('上一页')}
        </button>
        <span aria-label="当前页码" className="px-1 text-xs font-black text-slate-700">
          {current} <span className="text-slate-400">/ {pageCount}</span>
        </span>
        <button
          type="button"
          className={cn(navBtn, 'flex-row-reverse')}
          disabled={current >= pageCount}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight size={14} /> {t('下一页')}
        </button>
      </div>
    </div>
  );
}
