import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type AssessmentSession,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Layer = {
  id: string;
  participationId: string;
  ordinal: number;
  originalAmount: string | number;
  correctedAmount: string | number | null;
  evaluationAmount: string | number | null;
  currency: string;
  kind: string;
  reason: string;
  evidenceHash: string;
};
export function AgencyQuotePanel({
  detail,
  session,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: AssessmentSession;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    path = `/packages/${detail.record.id}/sessions/${session.id}/quotes`;
  const q = useQuery({
    queryKey: ["agency-quotes", session.id],
    queryFn: () => api<Layer[]>(path),
    refetchInterval: 5000,
  });
  const [subject, setSubject] = useState(""),
    [kind, setKind] = useState("original"),
    [value, setValue] = useState(""),
    [currency, setCurrency] = useState("CNY"),
    [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const subjects = JSON.parse(session.subjectsJson) as {
    participationId: string;
    supplierName: string;
  }[];
  const previous = q.data?.find((r) => r.participationId === subject);
  const baseline = previous?.id || "initial";
  const files = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
    );
  const edit = (f: () => void) => {
    f();
    setChecked("");
  };
  return (
    <details className="rounded border p-3">
      <summary className="text-sm font-semibold">人工报价分层记录</summary>
      <p className="my-2 text-xs">
        原始报价保留；修正和政策评审价分别追加。仅记录初次报价及人工核对结果，不替代最后报价、计算规则审批、排名或合同金额。
      </p>
      {q.error && <p className="text-red-700">{(q.error as Error).message}</p>}
      {can("buyer:agency:evaluation:price:manage") && (
        <fieldset
          disabled={busy || q.isLoading || !!q.error}
          className="space-y-2"
        >
          <select
            aria-label="报价对象"
            className={input}
            value={subject}
            onChange={(e) => edit(() => setSubject(e.target.value))}
          >
            <option value="">请选择开启对象</option>
            {subjects.map((s) => (
              <option key={s.participationId} value={s.participationId}>
                {s.supplierName}
              </option>
            ))}
          </select>
          <select
            aria-label="报价层类型"
            className={input}
            value={kind}
            onChange={(e) => edit(() => setKind(e.target.value))}
          >
            <option value="original">原始初次报价</option>
            <option value="correction">经人工确认的修正报价</option>
            <option value="policy">经人工确认的政策评审价格</option>
          </select>
          <input
            aria-label="报价金额"
            className={input}
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => edit(() => setValue(e.target.value))}
            placeholder="金额字符串，最多两位小数，不自动舍入"
          />
          <input
            aria-label="报价币种"
            className={input}
            value={currency}
            onChange={(e) => edit(() => setCurrency(e.target.value))}
          />
          <select
            aria-label="报价脱敏依据版本"
            className={input}
            value={proof}
            onChange={(e) => edit(() => setProof(e.target.value))}
          >
            <option value="">请选择可项目共享的脱敏凭证</option>
            {files.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="报价核对说明"
            className={input}
            value={reason}
            onChange={(e) => edit(() => setReason(e.target.value))}
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === baseline}
              onChange={(e) => setChecked(e.target.checked ? baseline : "")}
            />{" "}
            已核对本次价格层、最新版本及适用依据
          </label>
          <button
            className={btn}
            disabled={
              !subject ||
              !value ||
              !proof ||
              !reason.trim() ||
              checked !== baseline ||
              (kind === "original" ? !!previous : !previous)
            }
            onClick={() =>
              void run(async () => {
                await api(path, "POST", {
                  participationId: subject,
                  expectedPreviousId: previous?.id || null,
                  kind,
                  amount: value,
                  currency,
                  evidenceVersionId: proof,
                  reason,
                  reviewed: true,
                  idempotencyKey: crypto.randomUUID(),
                });
                setValue("");
                setReason("");
                setChecked("");
                await q.refetch();
              })
            }
          >
            追加报价记录并保留历史
          </button>
        </fieldset>
      )}
      <div className="overflow-auto">
        <table className="mt-3 w-full text-left text-xs">
          <thead>
            <tr>
              <th>对象/版本</th>
              <th>原始报价</th>
              <th>修正报价</th>
              <th>政策评审价</th>
              <th>依据</th>
            </tr>
          </thead>
          <tbody>
            {q.data?.map((r) => (
              <tr key={r.id}>
                <td>
                  {
                    subjects.find(
                      (s) => s.participationId === r.participationId,
                    )?.supplierName
                  }{" "}
                  V{r.ordinal} {r.currency}
                </td>
                <td>{r.originalAmount}</td>
                <td>{r.correctedAmount ?? "未记录"}</td>
                <td>{r.evaluationAmount ?? "未记录/待重新核对"}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
