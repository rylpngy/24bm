import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { downloadReport } from '@24bid/api-client';
import { Panel } from '@24bid/ui';

interface ReportDef {
  label: string;
  path: string;
  base: string;
  formats: ('xlsx' | 'pdf')[];
}

const REPORTS: ReportDef[] = [
  { label: '发票清单', path: '/api/v1/buyer/reports/invoices', base: 'invoices', formats: ['xlsx', 'pdf'] },
  { label: '三单匹配对账单', path: '/api/v1/buyer/reports/reconciliation', base: 'reconciliation', formats: ['xlsx', 'pdf'] },
  { label: '采购分析汇总', path: '/api/v1/buyer/reports/procurement-analytics', base: 'procurement-analytics', formats: ['xlsx'] },
];

// 报表导出:发票/对账/采购分析 → Excel(.xlsx)/ PDF。复用注入 JWT 的下载通道。
export function ReportExportBar() {
  const [busy, setBusy] = useState<string | null>(null);

  const onDownload = async (r: ReportDef, format: 'xlsx' | 'pdf') => {
    const key = `${r.base}-${format}`;
    setBusy(key);
    try {
      await downloadReport(`${r.path}?format=${format}`, `${r.base}.${format}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel title="报表导出" icon={Download} subtitle="发票 / 对账 / 采购分析 · Excel / PDF">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {REPORTS.map((r) => (
          <div key={r.base} className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-xs font-black text-slate-700">{r.label}</p>
            <div className="mt-2 flex gap-2">
              {r.formats.map((format) => {
                const key = `${r.base}-${format}`;
                const Icon = format === 'pdf' ? FileText : FileSpreadsheet;
                return (
                  <button
                    key={format}
                    type="button"
                    onClick={() => onDownload(r, format)}
                    disabled={busy === key}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Icon size={14} className={format === 'pdf' ? 'text-red-600' : 'text-emerald-600'} />
                    {busy === key ? '导出中…' : format === 'pdf' ? 'PDF' : 'Excel'}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
