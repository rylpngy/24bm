import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { FileDown, FileUp } from 'lucide-react';
import { downloadReport, uploadImportFile, type ImportResult } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';

interface ExcelImportControlProps {
  /** 导入端点,如 /api/v1/buyer/materials/import;模板端点为同前缀 /import-template。 */
  endpoint: string;
  templateName: string;
  /** 导入成功后需要失效的查询前缀(TanStack Query key)。 */
  invalidatePrefix: string;
  label?: string;
}

// Excel 批量导入控件:下载模板 + 选文件上传 + 部分成功结果报告(失败行逐条原因)。
export function ExcelImportControl({
  endpoint,
  templateName,
  invalidatePrefix,
  label = '批量导入',
}: ExcelImportControlProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function template() {
    setError(null);
    try { await downloadReport(`${endpoint}-template`, `${templateName}.xlsx`); }
    catch { setError('模板下载失败，请确认权限后重试。'); }
  }

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const imported = await uploadImportFile(endpoint, file);
      setResult(imported);
      await queryClient.invalidateQueries({
        predicate: (query) => String(query.queryKey[0] ?? '').startsWith(invalidatePrefix),
      });
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; error?: { message?: string } } } }).response?.data;
      const message = data?.message ?? data?.error?.message ?? '导入失败,请确认文件为模板格式的 .xlsx';
      setError(message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void template()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
        >
          <FileDown size={14} className="text-emerald-600" /> 下载模板
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          <FileUp size={14} /> {busy ? '导入中…' : label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>
      {error && <FeedbackNotice tone="error" message={error} />}
      {result && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <FeedbackNotice
            tone={result.failures.length === 0 ? 'success' : 'info'}
            message={`导入完成:共 ${result.totalRows} 行,成功 ${result.successCount} 行,失败 ${result.failures.length} 行。`}
          />
          {result.failures.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs font-bold text-red-600">
              {result.failures.map((f) => (
                <li key={`${f.rowNumber}-${f.message}`}>
                  第 {f.rowNumber} 行:{f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
