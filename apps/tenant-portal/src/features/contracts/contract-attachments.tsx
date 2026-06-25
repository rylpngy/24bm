import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Paperclip, Upload } from 'lucide-react';
import {
  axiosInstance,
  useAttachmentCreate,
  useAttachmentCreateUploadTicket,
  useAttachmentList,
} from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';

// 合同附件：上传(服务端代收落 MinIO)→ 落元数据 → 列表 → 流式下载。
export function ContractAttachments({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useAttachmentList({ ownerType: 'contract', ownerId: contractId });
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
    setError(null);
    setBusy(true);
    try {
      // 1) 申请上传票据 → 拿到租户隔离的 storageKey
      const t = await ticket.mutateAsync({
        data: {
          ownerType: 'contract',
          ownerId: contractId,
          fileName: file.name,
          visibility: 'buyer_internal',
        },
      });
      const storageKey = t.data?.storageKey;
      if (!storageKey) throw new Error('no storage key');
      // 2) 把字节代收到服务端(再落 MinIO)
      const buffer = await file.arrayBuffer();
      await axiosInstance.post('/api/v1/buyer/attachments/upload-sink', buffer, {
        params: { storageKey, contentType: file.type || 'application/octet-stream' },
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      // 3) 落附件元数据
      await create.mutateAsync({
        data: {
          ownerType: 'contract',
          ownerId: contractId,
          fileName: file.name,
          storageKey,
          visibility: 'buyer_internal',
        },
      });
      refreshList();
    } catch {
      setError('上传失败，请重试。');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDownload = async (id: string, fileName: string) => {
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
    } catch {
      setError('下载失败，请重试。');
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1.5 text-xs font-black text-slate-600">
          <Paperclip size={13} /> 合同附件
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:bg-slate-400"
        >
          <Upload size={13} /> {busy ? '上传中…' : '上传附件'}
        </button>
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
        ) : attachments.length === 0 ? (
          <p className="text-xs font-bold text-slate-400">暂无附件，点击右上角上传合同正本、补充协议等。</p>
        ) : (
          attachments.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-2"
            >
              <span className="min-w-0 break-words text-xs font-black text-slate-700">{a.fileName}</span>
              <button
                type="button"
                onClick={() => a.id && onDownload(a.id, a.fileName ?? '附件')}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-black text-blue-700 hover:bg-blue-50"
              >
                下载
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
