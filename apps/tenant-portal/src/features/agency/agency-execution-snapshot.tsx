import { useState } from "react";
import { agencyFileDownload, executionRequest } from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
export function AgencyExecutionSnapshot({
  snapshot,
}: {
  snapshot?: Record<string, unknown>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (!snapshot) return null;
  const revision =
    typeof snapshot.revisionId === "string" ? snapshot.revisionId : null;
  const document = snapshot.documentSnapshot as
    | {
        sections?: { code: string; title: string; body: string }[];
        fields?: Record<string, unknown>;
        manualNote?: string;
        sourceKind?: string;
      }
    | undefined;
  const chapters = (
    Array.isArray(snapshot.sections)
      ? snapshot.sections
      : document?.sections || []
  ) as { code: string; title: string; body: string }[];
  const issues = Array.isArray(snapshot.completenessIssues)
    ? snapshot.completenessIssues
    : [];
  return (
    <section className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
      <h3 className="font-bold">采购编制送审快照</h3>
      <p className="break-all text-xs text-slate-500">
        {revision
          ? `固定版本 ${revision} · SHA-256 ${snapshot.fileHash}`
          : `模板内容 SHA-256 ${snapshot.hash}`}
      </p>
      {typeof snapshot.sourceNote === "string" && (
        <p className="text-sm">来源及适用依据：{String(snapshot.sourceNote)}</p>
      )}
      {document?.sourceKind === "uploaded" && (
        <p className="text-sm">整份 Word 人工复核：{document.manualNote}</p>
      )}
      {document?.fields && (
        <details>
          <summary className="cursor-pointer text-sm">送审公共字段</summary>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            {Object.entries(document.fields).map(([k, v]) => (
              <div key={k}>
                <dt className="text-slate-500">{k}</dt>
                <dd>{String(v ?? "")}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {chapters.map((c) => (
        <details key={c.code}>
          <summary className="cursor-pointer text-sm font-semibold">
            {c.title}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {c.body || "（空白）"}
          </p>
        </details>
      ))}
      {!!issues.length && (
        <div className="text-sm text-amber-800">
          <p>送审完整性缺项：{issues.map(String).join("；")}</p>
          <p>
            有权人员例外说明：{String(snapshot.exceptionReason || "未填写")}
          </p>
        </div>
      )}
      {error && <FeedbackNotice tone="error" message={error} />}
      {revision && (
        <button
          className="rounded border px-3 py-2 text-sm font-semibold disabled:opacity-40"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void executionRequest<{ attachmentId: string; name: string }>(
              `/revisions/${revision}/artifact`,
            )
              .then((a) => agencyFileDownload(a.attachmentId, a.name))
              .catch((e) => setError(e.response?.data?.message || e.message))
              .finally(() => setBusy(false));
          }}
        >
          下载固定送审 DOCX
        </button>
      )}
    </section>
  );
}
