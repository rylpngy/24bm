import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  executionRequest as api,
  axiosInstance,
  agencyFileDownload,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
type Preview = {
  preview: {
    id: string;
    revisionId: string;
    sourceHash: string;
    fileHash: string;
    createdAt: string;
  };
  attachmentId: string;
};
type Job = { id: string; status: string; errorText: string | null };
export function AgencyDocumentPreviewPanel({
  revisionId,
  busy,
  run,
}: {
  revisionId: string;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    [job, setJob] = useState<string | null>(null),
    [url, setUrl] = useState<string | null>(null),
    path = `/revisions/${revisionId}/previews`,
    q = useQuery({
      queryKey: ["agency-document-preview", revisionId],
      queryFn: () => api<Preview[]>(path),
      enabled: open,
      refetchInterval: open ? 3000 : false,
    }),
    state = useQuery({
      queryKey: ["agency-document-preview-job", job],
      queryFn: () => api<Job>(`/jobs/${job}`),
      enabled: !!job,
      refetchInterval: job ? 2000 : false,
    });
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (state.data?.status === "success") void q.refetch();
  }, [state.data?.status]);
  if (!can("buyer:agency:document:read")) return null;
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border p-2"
    >
      <summary>此版本PDF预览</summary>
      {open && (
        <div className="space-y-2 pt-2">
          <p>PDF仅为此精确DOCX版本的派生预览，不改变审批稿或签署状态。</p>
          {q.error && <p role="alert">{(q.error as Error).message}</p>}
          {state.error && <p role="alert">{(state.error as Error).message}</p>}
          {state.data && (
            <p role="status">
              {(
                {
                  queued: "预览排队中",
                  processing: "正在生成PDF",
                  success: "PDF已封存",
                  failed: "预览生成失败",
                  stale: "输入已变化",
                } as Record<string, string>
              )[state.data.status] || state.data.status}{" "}
              · {state.data.errorText}
            </p>
          )}
          {can("buyer:agency:document:preview") && (
            <button
              className="rounded border p-2"
              disabled={
                busy ||
                state.data?.status === "queued" ||
                state.data?.status === "processing"
              }
              onClick={() =>
                void run(async () => {
                  const j = await api<Job>(path, "POST", {
                    idempotencyKey: crypto.randomUUID(),
                  });
                  setJob(j.id);
                  await q.refetch();
                })
              }
            >
              请求生成此版本PDF预览
            </button>
          )}
          {q.data?.length === 0 && (
            <p>尚无已完成PDF。未收到任务成功前，不表示预览已生成。</p>
          )}
          {q.data?.map((v) => (
            <div key={v.preview.id}>
              <p className="break-all text-xs">
                生成于 {v.preview.createdAt} · 源SHA256 {v.preview.sourceHash}
              </p>
              {can("buyer:agency:file:download") && (
                <>
                  <button
                    className="rounded border p-2"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const r = await axiosInstance.get(
                          `/api/v1/buyer/attachments/${v.attachmentId}/download`,
                          { responseType: "blob" },
                        );
                        setUrl(
                          URL.createObjectURL(
                            new Blob([r.data], { type: "application/pdf" }),
                          ),
                        );
                      })
                    }
                  >
                    打开PDF预览
                  </button>
                  <button
                    className="rounded border p-2"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        agencyFileDownload(v.attachmentId, "采购文书预览.pdf"),
                      )
                    }
                  >
                    下载PDF预览
                  </button>
                </>
              )}
            </div>
          ))}
          {url && (
            <>
              <button
                className="rounded border p-2"
                onClick={() => setUrl(null)}
              >
                关闭预览
              </button>
              <iframe
                title="采购文书PDF预览"
                src={url}
                className="h-[720px] w-full"
              />
            </>
          )}
        </div>
      )}
    </details>
  );
}
