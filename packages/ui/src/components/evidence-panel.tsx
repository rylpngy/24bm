import { Download, RefreshCw } from 'lucide-react';

interface EvidenceFile { id: string; round: number; fileName: string; size: number; sha256: string; uploaderName: string; createdAt: string }
interface Props {
  files: EvidenceFile[]; loading: boolean; busy: boolean; error: string; canUpload?: boolean;
  upload: (file: File) => void; download: (file: EvidenceFile) => void; refresh: () => void;
}
export function EvidencePanel({ files, loading, busy, error, canUpload = false, upload, download, refresh }: Props) {
  return <section aria-label="整改佐证材料" className="my-4 border-y border-slate-200 py-4">
    <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold">整改佐证材料</h3><button type="button" aria-label="刷新材料" title="刷新材料" disabled={busy || loading} onClick={refresh} className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 disabled:opacity-50"><RefreshCw size={15} /></button></div>
    {canUpload && <label className="mt-3 block text-xs text-slate-600">上传材料（单份≤10MB，每轮≤10份）<input type="file" aria-label="上传整改材料" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx" disabled={busy} className="mt-2 block w-full min-w-0 text-sm" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) upload(file); }} /></label>}
    {error && <p role="alert" className="mt-2 break-words text-sm text-red-600">{error}</p>}
    {loading ? <p className="mt-2 text-sm text-slate-500">正在加载材料…</p> : files.length === 0 ? <p className="mt-2 text-sm text-slate-500">暂无可查看材料</p> : <ul className="mt-2 divide-y divide-slate-100">{files.map(file => <li key={file.id} className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0"><p className="break-all text-sm font-semibold">第{file.round}轮 · {file.fileName}</p><p className="mt-1 text-xs text-slate-500">{file.uploaderName} · {file.createdAt.slice(0, 16).replace('T', ' ')} · {(file.size / 1024).toFixed(1)} KB</p><p title={file.sha256} className="mt-1 truncate text-xs text-slate-400">SHA-256：{file.sha256}</p></div>
      <button type="button" aria-label={`下载 ${file.fileName}`} title="下载并核验原件" disabled={busy} onClick={() => download(file)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-200 text-blue-700 disabled:opacity-50"><Download size={16} /></button>
    </li>)}</ul>}
    {busy && <p role="status" className="mt-2 text-xs text-slate-500">正在处理材料…</p>}
  </section>;
}
