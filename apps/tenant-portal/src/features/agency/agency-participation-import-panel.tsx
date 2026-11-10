import { useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  executionRequest as api,
  type ParticipationImportView,
  type ParticipationImportSummary,
} from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
const btn =
  "rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-40";
const input =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm";
const labels: Record<string, string> = {
  unknown: "待核对",
  acquired: "已获取",
  not_applicable: "不适用",
  submitted: "已提交",
  withdrawn: "已撤回",
  pending: "待复核",
  checked: "已复核",
};
export function AgencyParticipationImportPanel({
  pkg,
  fileOptions,
  editable,
  busy,
  run,
}: {
  pkg: string;
  fileOptions: ReactNode;
  editable: boolean;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [source, setSource] = useState(""),
    [preview, setPreview] = useState<ParticipationImportView | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [duplicates, setDuplicates] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const recent = useQuery({
    queryKey: ["agency-participation-imports", pkg],
    queryFn: () =>
      api<ParticipationImportSummary[]>(
        `/packages/${pkg}/participation-imports`,
      ),
  });
  const reset = (v: ParticipationImportView) => {
    setPreview(v);
    setConfirmed(false);
    setDuplicates(false);
    requestKey.current = crypto.randomUUID();
  };
  const downloadTemplate = () => {
    const text =
      "\uFEFF供应商名称,统一社会信用代码,联系人,联系电话,记录来源,文件获取情况,响应递交情况,待核实事项,风险复核情况,备注\r\n";
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "参与台账导入模板.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <details className="rounded border border-slate-200 bg-white p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        批量导入与来源预览
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          先在项目文件区上传并封存UTF-8
          CSV或单工作表XLSX，再选择版本预览。每批最多200条、文件不超过2MB；信用代码和电话请按文本保存。只追加记录，不覆盖原台账，不生成资格或准入结论。批次须由预览创建人确认，他人可选择同一来源生成自己的预览。
        </p>
        <button className={btn} onClick={downloadTemplate}>
          下载CSV导入模板
        </button>
        {editable && (
          <>
            <label className="grid gap-1 text-xs font-semibold">
              批量台账来源版本
              <select
                className={input}
                aria-label="批量台账来源版本"
                disabled={busy}
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  setPreview(null);
                  setConfirmed(false);
                }}
              >
                {fileOptions}
              </select>
            </label>
            <button
              className={btn}
              disabled={busy || !source}
              onClick={() =>
                void run(async () => {
                  reset(
                    await api<ParticipationImportView>(
                      `/packages/${pkg}/participation-imports`,
                      "POST",
                      {
                        sourceVersionId: source,
                        idempotencyKey: crypto.randomUUID(),
                      },
                    ),
                  );
                  await recent.refetch();
                })
              }
            >
              生成导入预览
            </button>
          </>
        )}
        <label className="grid gap-1 text-xs font-semibold">
          最近可访问的导入批次
          <select
            className={input}
            aria-label="最近可访问的导入批次"
            value={preview?.record.id || ""}
            disabled={busy}
            onChange={(e) => {
              const id = e.target.value;
              if (id)
                void run(async () =>
                  reset(
                    await api<ParticipationImportView>(
                      `/packages/${pkg}/participation-imports/${id}`,
                    ),
                  ),
                );
              else setPreview(null);
            }}
          >
            <option value="">选择批次查看来源和结果</option>
            {recent.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.sourceName} · {r.rowCount}条 ·{" "}
                {r.status === "committed"
                  ? "已导入"
                  : r.status === "invalid"
                    ? "校验有误"
                    : "待确认"}{" "}
                · {new Date(r.createdAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        {recent.isError && (
          <FeedbackNotice
            tone="error"
            message="导入批次读取失败，请刷新重试。"
          />
        )}
        {preview && (
          <div className="space-y-3">
            <FeedbackNotice
              tone={
                preview.errorCount
                  ? "error"
                  : preview.record.status === "committed"
                    ? "success"
                    : "info"
              }
              message={
                preview.record.status === "committed"
                  ? `该批次已导入 ${preview.rows.length} 条；原记录保留。`
                  : `预览 ${preview.rows.length} 条，发现 ${preview.errorCount} 项错误、${preview.warningCount} 项警告。${preview.errorCount ? "请修正来源文件并上传新版本后重新预览。" : "尚未新增任何台账记录。"}`
              }
            />
            <p className="break-all text-xs text-slate-500">
              来源：{preview.record.sourceName} · 文件版本{" "}
              {preview.record.sourceVersionId} · SHA-256{" "}
              {preview.record.sourceHash}
            </p>
            <div className="max-h-96 overflow-auto rounded border">
              <table className="w-full min-w-[850px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <th className="p-2">来源记录</th>
                    <th>供应商 / 信用代码</th>
                    <th>联系人 / 电话</th>
                    <th>记录来源</th>
                    <th>获取 / 递交 / 风险</th>
                    <th>校验</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.rowNumber} className="border-t align-top">
                      <td className="p-2">{r.rowNumber}</td>
                      <td>
                        {r.data.supplierName || "（缺少名称）"}
                        <p>{r.data.creditCode}</p>
                      </td>
                      <td>
                        {r.data.contact}
                        <p>{r.data.phone}</p>
                      </td>
                      <td>{r.data.source}</td>
                      <td>
                        {labels[r.data.acquisitionStatus]} /{" "}
                        {labels[r.data.submissionStatus]} /{" "}
                        {labels[r.data.riskStatus]}
                        <p>{r.data.riskNote}</p>
                        <p>{r.data.notes}</p>
                      </td>
                      <td>
                        {r.errors.map((e, i) => (
                          <p className="text-red-700" key={"e" + i}>
                            {e}
                          </p>
                        ))}
                        {r.warnings.map((w, i) => (
                          <p className="text-amber-800" key={"w" + i}>
                            {w}
                          </p>
                        ))}
                        {!r.errors.length &&
                          !r.warnings.length &&
                          "通过格式校验"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {editable && preview.record.status === "preview" && (
              <>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  已人工核对本批次记录、来源和警告，确认仅用于内部参与台账
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={duplicates}
                    onChange={(e) => setDuplicates(e.target.checked)}
                  />
                  已核实重复提示，允许追加可能重复的供应商记录（不合并、不覆盖）
                </label>
                <button
                  className={btn}
                  disabled={busy || !confirmed || preview.errorCount > 0}
                  onClick={() =>
                    void run(async () => {
                      const result = await api<ParticipationImportView>(
                        `/packages/${pkg}/participation-imports/${preview.record.id}/commit`,
                        "POST",
                        {
                          expectedVersion: preview.record.version,
                          manuallyConfirmed: confirmed,
                          allowDuplicates: duplicates,
                          idempotencyKey: requestKey.current,
                        },
                      );
                      setPreview(result);
                      await recent.refetch();
                    })
                  }
                >
                  确认整批追加台账
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
