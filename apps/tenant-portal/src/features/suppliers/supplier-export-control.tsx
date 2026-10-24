import { useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { downloadReport } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { currentPerformanceQuarter, isPerformancePeriod } from './performance-period';

const ledgers = [
  ['profiles', '供应商档案'], ['admissions', '准入台账'], ['qualifications', '资质台账'],
  ['evaluations', '同期绩效'], ['remediations', '整改台账'], ['exits', '退出台账'],
] as const;

export function SupplierExportControl() {
  const { can } = useBuyerPermissions();
  const canRead = can('buyer:supplier:read');
  const available = ledgers.filter(([id]) => !['admissions', 'exits'].includes(id) || can('buyer:workflow:read'));
  const [kind, setKind] = useState('profiles');
  const [period, setPeriod] = useState(currentPerformanceQuarter);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const lock = useRef(false);
  if (!canRead) return null;
  const valid = available.some(([id]) => id === kind) && (kind !== 'evaluations' || isPerformancePeriod(period));
  const exportLedger = async () => {
    if (!valid || lock.current) return;
    lock.current = true; setBusy(true); setFeedback(null);
    const params = new URLSearchParams({ kind });
    if (kind === 'evaluations') params.set('period', period.trim());
    try {
      const label = ledgers.find(row => row[0] === kind)![1];
      await downloadReport(`/api/v1/buyer/suppliers/export?${params}`, `${label}.xlsx`);
      setFeedback({ tone: 'success', message: '台账已下载。' });
    } catch (error) {
      const response = (error as { response?: { data?: unknown } })?.response?.data;
      let message = '台账导出失败，请重试。';
      if (response instanceof Blob) {
        try { const data = JSON.parse(await response.text()); if (typeof data.message === 'string') message = data.message; } catch {}
      }
      setFeedback({ tone: 'error', message });
    } finally { lock.current = false; setBusy(false); }
  };
  return <section aria-label="SRM台账导出" className="mb-4 border-b border-slate-200 pb-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-0 text-xs font-bold text-slate-600">台账类型
        <select aria-label="台账类型" value={kind} disabled={busy} onChange={event => { setKind(event.target.value); setFeedback(null); }}
          className="mt-1 block h-9 rounded-md border border-slate-200 bg-white px-3 text-sm">
          {available.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      {kind === 'evaluations' && <label className="min-w-0 text-xs font-bold text-slate-600">导出周期
        <input aria-label="导出周期" value={period} disabled={busy} onChange={event => setPeriod(event.target.value)} placeholder="YYYY / YYYY-Q1 / YYYY-MM"
          className="mt-1 block h-9 w-48 max-w-full rounded-md border border-slate-200 px-3 text-sm" />
      </label>}
      <button type="button" disabled={busy || !valid} onClick={() => void exportLedger()}
        className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 disabled:opacity-50">
        <Download size={16} />{busy ? '导出中…' : '导出SRM台账'}
      </button>
    </div>
    {!valid && <p role="alert" className="mt-2 text-xs text-red-600">请输入有效周期：YYYY、YYYY-Q1 至 Q4 或 YYYY-MM。</p>}
    {feedback && <div className="mt-2"><FeedbackNotice {...feedback} /></div>}
  </section>;
}
