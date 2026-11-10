import { useState } from "react";
import { agencyFileDownload, type AgencyDraft } from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
export function AgencyApprovalSnapshot({
  snapshot,
}: {
  snapshot?: Record<string, unknown>;
}) {
  const { can } = useBuyerPermissions(),
    [error, setError] = useState<string | null>(null);
  if (!snapshot) return null;
  const data = snapshot.data as AgencyDraft | undefined,
    previous = snapshot.previousData as AgencyDraft | undefined;
  const files = Array.isArray(snapshot.files)
    ? (snapshot.files as {
        versionId: string;
        ordinal: number;
        attachmentId: string;
        sha256: string;
        visibility: string;
        name?: string;
      }[])
    : [];
  const download = async (id: string, name: string) => {
    setError(null);
    try {
      await agencyFileDownload(id, name);
    } catch {
      setError("送审附件下载失败或超出文件授权范围，请核对权限。");
    }
  };
  return (
    <section className="mt-4 rounded-lg border border-blue-100 bg-blue-50/20 p-4">
      <h3 className="mb-3 text-sm font-bold">代理采购包送审快照</h3>
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div>
          <dt className="text-xs text-slate-500">编号与版本</dt>
          <dd>
            {String(snapshot.number || "—")} · V
            {String(snapshot.packageVersion || "—")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">项目包与采购方式</dt>
          <dd>
            {data?.title} · {data?.procurementMethod}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">采购人</dt>
          <dd>{data?.purchaser.name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">送审预算</dt>
          <dd>
            {data?.budget == null ? "待补" : `${data.currency} ${data.budget}`}
            {previous && (
              <span className="ml-2 text-xs text-slate-500">
                变更前：{previous.budget ?? "待补"}
              </span>
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        {String(snapshot.reason || "")}
        。下列文件固定为送审时的有效版本，后续新增版本不会替换此处引用。
      </p>
      {error && <FeedbackNotice tone="error" message={error} />}
      <div className="mt-3 space-y-2">
        {files.map((f, i) => (
          <div
            key={f.versionId}
            className="flex flex-wrap items-center justify-between gap-2 rounded border bg-white p-3 text-xs"
          >
            <span>
              {f.visibility === "restricted"
                ? "受限附件"
                : f.name || `送审附件 ${i + 1}`}{" "}
              · V{f.ordinal}{" "}
              <span className="ml-2 font-mono text-slate-400" title={f.sha256}>
                SHA256 {f.sha256.slice(0, 16)}…
              </span>
            </span>
            {can("buyer:agency:file:download") && (
              <button
                className="text-blue-700"
                onClick={() =>
                  void download(f.attachmentId, f.name || "送审附件")
                }
              >
                下载此送审版本
              </button>
            )}
          </div>
        ))}
        {!files.length && (
          <p className="text-xs text-slate-400">本次审批无适用的已封存附件。</p>
        )}
      </div>
    </section>
  );
}
