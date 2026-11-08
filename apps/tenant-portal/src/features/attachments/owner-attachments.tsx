import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Download, Paperclip, ShieldCheck, Upload } from 'lucide-react';
import {
  axiosInstance,
  checkAttachmentIntegrity,
  type AttachmentIntegrity,
  useAttachmentCreate,
  useAttachmentCreateUploadTicket,
  useAttachmentList,
} from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { AiReviewButton } from '../ai/ai-review-button';

// 通用附件面板:按 ownerType/ownerId 复用(合同附件、供应商资质、报价单影像等)。
// 上传服务端代收落 MinIO → 落元数据 → 列表 → 流式下载。
export function OwnerAttachments({
  ownerType,
  ownerId,
  title = '附件',
  emptyHint = '暂无附件,点击右上角上传。',
  readOnly = false,
  onChanged,
}: {
  ownerType: string;
  ownerId: string;
  title?: string;
  emptyHint?: string;
  readOnly?: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [integrity, setIntegrity] = useState<Record<string, AttachmentIntegrity>>({});

  const list = useAttachmentList({ ownerType, ownerId });
  const ticket = useAttachmentCreateUploadTicket();
  const create = useAttachmentCreate();
  const attachments = list.data?.data ?? [];

  const refreshList = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        (q.queryKey[0] as string).includes('/buyer/attachments'),
    });

  const onPick = async (file: File) => {
    if (readOnly) return;
    setError(null);
    setBusy(true);
    try {
      const t = await ticket.mutateAsync({
        data: { ownerType, ownerId, fileName: file.name, visibility: 'buyer_internal' },
      });
      const storageKey = t.data?.storageKey;
      const uploadUrl = t.data?.uploadUrl;
      if (!storageKey || !uploadUrl) throw new Error('缺少有效上传票据');
      const buffer = await file.arrayBuffer();
      await axiosInstance.post(uploadUrl, buffer, {
        params: { contentType: file.type || 'application/octet-stream' },
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      await create.mutateAsync({
        data: { ownerType, ownerId, fileName: file.name, storageKey, visibility: 'buyer_internal' },
      });
      refreshList();
      onChanged?.();
    } catch (error) {
      setError((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? '上传失败，请重新选择文件重试。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDownload = async (id: string, fileName: string) => {
    setError(null);
    try {
      const res = await axiosInstance.get(`/api/v1/buyer/attachments/${id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      let body = (error as { response?: { data?: unknown } }).response?.data;
      if (body instanceof Blob) {
        try { body = JSON.parse(await body.text()); } catch { body = null; }
      }
      setError((body as { message?: string } | null)?.message || '下载失败，请重试。');
    }
  };

  const onCheck = async (id: string) => {
    setChecking(id); setError(null);
    setIntegrity(current => { const next = { ...current }; delete next[id]; return next; });
    try {
      const result = await checkAttachmentIntegrity(id);
      setIntegrity(current => ({ ...current, [id]: result.data }));
    } catch (error) {
      setError((error as { response?: { data?: { message?: string } } }).response?.data?.message || '附件核验失败，请重试。');
    } finally { setChecking(null); }
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600">
          <Paperclip size={13} /> {title}
        </p>
        {!readOnly && <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy || list.isError || list.isLoading}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
        >
          <Upload size={13} /> {busy ? '上传中…' : '上传附件'}
        </button>}
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
        />
      </div>

      {error && (
        <div className="mt-2">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      <div className="mt-2 space-y-2">
        {list.isLoading ? (
          <p className="text-xs font-bold text-slate-400">加载附件…</p>
        ) : list.isError ? (
          <FeedbackNotice tone="error" message="附件加载失败或无访问权限，请刷新后重试。" />
        ) : attachments.length === 0 ? (
          <p className="text-xs font-bold text-slate-400">{emptyHint}</p>
        ) : (
          attachments.map((a) => (
            <div
              key={a.id}
              className="rounded-md border border-slate-100 bg-white px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="min-w-0 break-words text-xs font-black text-slate-700">{a.fileName}</span>
              <div className="ml-auto flex flex-wrap gap-2">
                <AiReviewButton subjectType="attachment" subjectId={a.id ?? ''} />
                <button type="button" disabled={checking !== null} onClick={() => a.id && onCheck(a.id)} className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 px-2 text-xs font-bold text-slate-700 disabled:opacity-50"><ShieldCheck size={13} />{checking === a.id ? '核验中…' : '核验'}</button>
              <button
                type="button"
                onClick={() => a.id && onDownload(a.id, a.fileName ?? '附件')}
                className="inline-flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 text-xs font-black text-blue-700 hover:bg-blue-50"
              >
                <Download size={13} />下载
              </button>
              </div>
              </div>
              {a.id && integrity[a.id] && <p role="status" className={`mt-2 break-words text-xs ${integrity[a.id].status === 'verified' ? 'text-emerald-700' : 'text-amber-800'}`}>{integrity[a.id].message}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
