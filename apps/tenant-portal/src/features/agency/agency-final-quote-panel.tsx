import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  agencyFileUpload,
  agencyFileDownload,
  type AgencyDetail,
  type AssessmentSession,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Subject = { participationId: string; supplierName: string };
type Campaign = {
  id: string;
  status: string;
  version: number;
  cutoffAt: string;
  initiatedAt: string;
  reason: string;
  requirementsVersionId: string;
  noticeVersionId: string;
  exclusionsJson: string;
  confirmationNote: string | null;
  discussionManifestJson?: string;
  requirementChangesJson?: string;
  discussionFingerprint?: string;
};
type Receipt = {
  id: string;
  participationId: string;
  amount: string;
  currency: string;
  receivedAt: string;
  originalType: string;
  sourceNote: string;
  lateEntryReason: string;
  status: string;
  withdrawReason: string | null;
};
type Row = { receipt: Receipt; file: AgencyDetail["files"][number] };
type Decision = {
  participationId: string;
  receiptId: string | null;
  status: string;
  reason: string;
};
type Result = Decision & {
  amount: string | null;
  currency: string | null;
  fileVersionId: string | null;
  hash: string | null;
};
export type FinalQuoteWorkspace = {
  campaign: Campaign | null;
  candidates: Subject[];
  subjects: Subject[];
  receipts: Row[];
  results: Result[];
  receiptFingerprint: string;
  blockers: string[];
  discussionMode?: string;
  discussionFingerprint?: string;
  discussionBlockers?: string[];
};
const labels: Record<string, string> = {
  accepted: "确认有效最后报价",
  not_submitted: "未提交最后报价",
  late: "逾期，不作为有效最后报价",
  excluded: "有依据排除，不作为有效最后报价",
};
const iso = (s: string) => (s ? new Date(s).toISOString() : "");
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
export function AgencyFinalQuotePanel({
  detail,
  session,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: AssessmentSession;
  busy: boolean;
  run: Run;
}) {
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    path = `/packages/${detail.record.id}/sessions/${session.id}/final-quotes`;
  const q = useQuery({
    queryKey: ["agency-final-quotes", session.id],
    queryFn: () => api<FinalQuoteWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const w = q.data,
    c = w?.campaign,
    canManage = can("buyer:agency:evaluation:final:manage");
  const proofs = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
    );
  const act = async (f: () => Promise<unknown>) => {
    await run(async () => {
      await f();
      await q.refetch();
    });
  };
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        线下最后报价（谈判/磋商）
      </summary>
      <p className="my-2 text-xs">
        记录真实线下发起、最终响应副本及逐家确认。导入人员不代表供应商身份；未提交不复制首次报价，确认不自动形成排名或成交结果。
      </p>
      {q.isError && (
        <FeedbackNotice tone="error" message="最后报价加载失败，请重试。" />
      )}
      {q.isError && (
        <button className={btn} onClick={() => void q.refetch()}>
          重新加载最后报价
        </button>
      )}
      {w && (
        <>
          {!c && w.discussionMode === "legacy" && (
            <p className="text-xs">
              历史任务保留原人工过程依据；不会自动补造逐家沟通记录。
            </p>
          )}
          {!c && w.discussionMode === "active" && (
            <p className="text-xs">
              所选每个对象须有已确认的逐家沟通；草稿或待有权确认的需求调整会阻断发起。
            </p>
          )}
          <div className="text-sm text-amber-800">
            {[...w.blockers, ...(w.discussionBlockers || [])].join("；")}
          </div>
          {!c && canManage && (
            <StartForm
              w={w}
              proofs={proofs}
              disabled={
                busy || !!w.blockers.length || !!w.discussionBlockers?.length
              }
              submit={(d) => act(() => api(path, "POST", d))}
            />
          )}
          {c && (
            <>
              <p className="my-2 text-sm">
                {c.status === "confirmed" ? "已逐家确认并锁定" : "接收登记中"} ·
                发起 {new Date(c.initiatedAt).toLocaleString()} · 截止{" "}
                {new Date(c.cutoffAt).toLocaleString()} · V{c.version}
              </p>
              <p className="text-xs">{c.reason}</p>
              {c.requirementChangesJson && (
                <details className="text-sm">
                  <summary>已封存的授权需求变更与通知完成引用</summary>
                  {(
                    JSON.parse(c.requirementChangesJson) as {
                      id: string;
                      hash: string;
                    }[]
                  ).map((v) => (
                    <p key={v.id} className="break-all text-xs">
                      {v.id} · SHA256 {v.hash}
                    </p>
                  ))}
                </details>
              )}
              {c.discussionManifestJson && (
                <details className="rounded border p-2 text-xs">
                  <summary>逐家沟通引用版本</summary>
                  {(
                    JSON.parse(c.discussionManifestJson) as {
                      participationId: string;
                      recordId: string;
                      ordinal: number;
                      frozenHash: string;
                    }[]
                  ).length ? (
                    (
                      JSON.parse(c.discussionManifestJson) as {
                        participationId: string;
                        recordId: string;
                        ordinal: number;
                        frozenHash: string;
                      }[]
                    ).map((r) => (
                      <p key={r.participationId} className="break-all">
                        {
                          w.subjects.find(
                            (s) => s.participationId === r.participationId,
                          )?.supplierName
                        }{" "}
                        · 第{r.ordinal}次 · {r.recordId} · SHA256 {r.frozenHash}
                      </p>
                    ))
                  ) : (
                    <p>历史人工过程依据，保留原凭证。</p>
                  )}
                </details>
              )}

              <p className="text-xs">
                参与者：{w.subjects.map((s) => s.supplierName).join("、")}
              </p>
              {Object.entries(
                JSON.parse(c.exclusionsJson) as Record<string, string>,
              ).map(([id, reason]) => (
                <p className="text-xs" key={id}>
                  未进入对象{" "}
                  {w.candidates.find((s) => s.participationId === id)
                    ?.supplierName || id}
                  ：{reason}
                </p>
              ))}
              {c.status === "collecting" && canManage && (
                <ReceiveForm
                  subjects={w.subjects}
                  currency={detail.record.currency}
                  disabled={busy || !!w.blockers.length}
                  submit={(d) => act(() => api(path + "/receipts", "POST", d))}
                />
              )}
              {w.receipts.map((row) => (
                <ReceiptCard
                  key={row.receipt.id}
                  row={row}
                  name={
                    w.subjects.find(
                      (s) => s.participationId === row.receipt.participationId,
                    )?.supplierName || ""
                  }
                  active={
                    c.status === "collecting" && canManage && !w.blockers.length
                  }
                  busy={busy}
                  canDownload={
                    can("buyer:agency:file:download") &&
                    can("buyer:agency:evaluation:response:read") &&
                    w.results.some(
                      (r) =>
                        r.receiptId === row.receipt.id &&
                        r.status === "accepted",
                    )
                  }
                  act={act}
                  withdraw={(reason) =>
                    act(() =>
                      api(
                        path + "/receipts/" + row.receipt.id + "/withdraw",
                        "POST",
                        {
                          expectedVersion: c.version,
                          reason,
                          idempotencyKey: crypto.randomUUID(),
                        },
                      ),
                    )
                  }
                />
              ))}
              {c.status === "collecting" && canManage && (
                <ConfirmForm
                  w={w}
                  proofs={proofs}
                  disabled={busy || !!w.blockers.length}
                  submit={(d) => act(() => api(path + "/confirm", "POST", d))}
                />
              )}
              {c.status === "confirmed" && (
                <div className="mt-3 overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th>对象</th>
                        <th>处理</th>
                        <th>确认的最后报价</th>
                        <th>依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.results.map((r) => (
                        <tr key={r.participationId}>
                          <td>
                            {
                              w.subjects.find(
                                (s) => s.participationId === r.participationId,
                              )?.supplierName
                            }
                          </td>
                          <td>{labels[r.status]}</td>
                          <td>
                            {r.amount === null
                              ? "未形成有效最后报价"
                              : r.amount + " " + r.currency}
                          </td>
                          <td>{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-xs">
                    确认及后续处理：{c.confirmationNote}
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </details>
  );
}
type Proof = { id: string; name: string };
function ProofSelect({
  label,
  value,
  set,
  proofs,
}: {
  label: string;
  value: string;
  set: (s: string) => void;
  proofs: Proof[];
}) {
  return (
    <select
      aria-label={label}
      className={input}
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      <option value="">选择可共享的脱敏凭证</option>
      {proofs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
function StartForm({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: FinalQuoteWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<void>;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [exclusions, setExclusions] = useState<Record<string, string>>({}),
    [initiated, setInitiated] = useState(""),
    [cutoff, setCutoff] = useState(""),
    [requirements, setRequirements] = useState(""),
    [notice, setNotice] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const baseline = JSON.stringify([
    ids,
    exclusions,
    initiated,
    cutoff,
    requirements,
    notice,
    reason,
    w.candidates,
    w.discussionFingerprint,
  ]);
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2">
      <legend className="font-medium">登记线下发起并锁定范围</legend>
      {w.candidates.map((s) => (
        <div key={s.participationId}>
          <label className="text-sm">
            <input
              type="checkbox"
              checked={ids.includes(s.participationId)}
              onChange={(e) =>
                setIds(
                  e.target.checked
                    ? [...ids, s.participationId]
                    : ids.filter((x) => x !== s.participationId),
                )
              }
            />{" "}
            最后报价参与者 {s.supplierName}
          </label>
          {!ids.includes(s.participationId) && (
            <input
              aria-label={"未进入最后报价依据 " + s.supplierName}
              className={input}
              value={exclusions[s.participationId] || ""}
              onChange={(e) =>
                setExclusions({
                  ...exclusions,
                  [s.participationId]: e.target.value,
                })
              }
              placeholder="未进入最后报价的逐家处理依据"
            />
          )}
        </div>
      ))}
      <label className="block text-sm">
        实际发起时间
        <input
          aria-label="最后报价实际发起时间"
          type="datetime-local"
          className={input}
          value={initiated}
          onChange={(e) => setInitiated(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        截止时间
        <input
          aria-label="最后报价截止时间"
          type="datetime-local"
          className={input}
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
        />
      </label>
      <ProofSelect
        label="最后报价最终需求依据"
        value={requirements}
        set={setRequirements}
        proofs={proofs}
      />
      <ProofSelect
        label="最后报价发起及通知凭证"
        value={notice}
        set={setNotice}
        proofs={proofs}
      />
      <textarea
        aria-label="最后报价发起说明"
        className={input}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="最终需求及响应条件、通知和适用规则核对说明"
      />
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked === baseline}
          onChange={(e) => setChecked(e.target.checked ? baseline : "")}
        />
        已核对最终需求、最终响应条件、参与者及发起通知
      </label>
      <button
        className={btn}
        disabled={
          !ids.length ||
          !initiated ||
          !cutoff ||
          !requirements ||
          !notice ||
          !reason.trim() ||
          checked !== baseline ||
          w.candidates.some(
            (s) =>
              !ids.includes(s.participationId) &&
              !exclusions[s.participationId]?.trim(),
          )
        }
        onClick={() =>
          void submit({
            participationIds: ids,
            exclusions: Object.fromEntries(
              w.candidates
                .filter((s) => !ids.includes(s.participationId))
                .map((s) => [s.participationId, exclusions[s.participationId]]),
            ),
            initiatedAt: iso(initiated),
            cutoffAt: iso(cutoff),
            discussionFingerprint: w.discussionFingerprint,
            requirementsVersionId: requirements,
            noticeVersionId: notice,
            reviewed: true,
            reason,
            idempotencyKey: crypto.randomUUID(),
          })
        }
      >
        锁定最后报价发起记录
      </button>
    </fieldset>
  );
}
function ReceiveForm({
  subjects,
  currency,
  disabled,
  submit,
}: {
  subjects: Subject[];
  currency: string;
  disabled: boolean;
  submit: (d: unknown) => Promise<void>;
}) {
  const [d, setD] = useState({
    participationId: "",
    fileName: "",
    amount: "",
    receivedAt: "",
    originalType: "electronic_copy",
    sourceNote: "",
    lateEntryReason: "",
  });
  const edit = (k: keyof typeof d, v: string) => setD({ ...d, [k]: v });
  return (
    <details className="my-3 rounded border p-2">
      <summary>登记最终响应及最后报价</summary>
      <fieldset disabled={disabled} className="space-y-2">
        <select
          aria-label="最后报价接收对象"
          className={input}
          value={d.participationId}
          onChange={(e) => edit("participationId", e.target.value)}
        >
          <option value="">选择对象</option>
          {subjects.map((s) => (
            <option key={s.participationId} value={s.participationId}>
              {s.supplierName}
            </option>
          ))}
        </select>
        <input
          aria-label="最后报价材料文件名"
          className={input}
          value={d.fileName}
          onChange={(e) => edit("fileName", e.target.value)}
          placeholder="最终响应及报价文件名"
        />
        <input
          aria-label="最后报价金额"
          className={input}
          inputMode="decimal"
          value={d.amount}
          onChange={(e) => edit("amount", e.target.value)}
          placeholder={"原始最后报价（" + currency + "），不限制必须降价"}
        />
        <label className="block text-sm">
          实际接收时间
          <input
            aria-label="最后报价实际接收时间"
            type="datetime-local"
            className={input}
            value={d.receivedAt}
            onChange={(e) => edit("receivedAt", e.target.value)}
          />
        </label>
        <select
          aria-label="最后报价原件类型"
          className={input}
          value={d.originalType}
          onChange={(e) => edit("originalType", e.target.value)}
        >
          <option value="electronic_copy">电子副本</option>
          <option value="paper_scan">纸质原件扫描副本</option>
        </select>
        <textarea
          aria-label="最后报价来源及最终响应说明"
          className={input}
          value={d.sourceNote}
          onChange={(e) => edit("sourceNote", e.target.value)}
          placeholder="来源及最终响应说明"
        />
        <textarea
          aria-label="最后报价补录依据"
          className={input}
          value={d.lateEntryReason}
          onChange={(e) => edit("lateEntryReason", e.target.value)}
          placeholder="截止后登记必填真实接收时点及补录依据"
        />
        <button
          className={btn}
          disabled={
            !d.participationId ||
            !d.fileName ||
            !d.amount ||
            !d.receivedAt ||
            !d.sourceNote.trim()
          }
          onClick={() =>
            void submit({
              ...d,
              currency,
              receivedAt: iso(d.receivedAt),
              idempotencyKey: crypto.randomUUID(),
            })
          }
        >
          建立最后报价接收登记
        </button>
      </fieldset>
    </details>
  );
}
function ReceiptCard({
  row,
  name,
  active,
  busy,
  canDownload,
  act,
  withdraw,
}: {
  row: Row;
  name: string;
  active: boolean;
  busy: boolean;
  canDownload: boolean;
  act: (f: () => Promise<unknown>) => Promise<void>;
  withdraw: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    r = row.receipt;
  return (
    <article
      aria-label={"最后报价接收 " + name}
      className="my-2 space-y-2 rounded border p-2 text-sm"
    >
      <strong>
        {name} · {r.status === "withdrawn" ? "已撤回" : "接收登记"} · {r.amount}{" "}
        {r.currency}
      </strong>
      <p>
        实际接收 {new Date(r.receivedAt).toLocaleString()} ·{" "}
        {r.originalType === "paper_scan" ? "纸质原件扫描副本" : "电子副本"}
      </p>
      <p>来源：{r.sourceNote}</p>
      {r.lateEntryReason && <p>补录依据：{r.lateEntryReason}</p>}
      {r.withdrawReason && <p>撤回原因：{r.withdrawReason}</p>}
      {row.file.versions.map((v) => (
        <div key={v.id}>
          <p>
            {v.status === "sealed" ? "已检查封存" : "待上传"}{" "}
            {v.hash && (
              <span className="break-all text-xs">SHA256 {v.hash}</span>
            )}
          </p>
          {active && r.status === "received" && v.status === "uploading" && (
            <input
              aria-label={"上传最后报价材料 " + name}
              type="file"
              disabled={busy}
              accept=".docx,.pdf,.txt,.xlsx,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void act(() => agencyFileUpload(v.id, file));
                e.target.value = "";
              }}
            />
          )}
          {canDownload && v.attachmentId && (
            <button
              className={btn}
              onClick={() =>
                void act(() =>
                  agencyFileDownload(v.attachmentId!, row.file.file.name),
                )
              }
            >
              下载已确认最后报价材料
            </button>
          )}
        </div>
      ))}
      {!canDownload && (
        <p className="text-xs text-amber-800">
          原文在截止后逐家确认前保持关闭；未提交、逾期和排除材料不开放。
        </p>
      )}
      {active && r.status === "received" && (
        <div>
          <input
            aria-label={"撤回最后报价原因 " + name}
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button
            className={btn}
            disabled={busy || !reason.trim()}
            onClick={() => void withdraw(reason)}
          >
            撤回错误最后报价登记并保留历史
          </button>
        </div>
      )}
    </article>
  );
}
function ConfirmForm({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: FinalQuoteWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<void>;
}) {
  const [decisions, setDecisions] = useState<
      Record<string, { status: string; reason: string }>
    >({}),
    [proof, setProof] = useState(""),
    [note, setNote] = useState(""),
    [checked, setChecked] = useState("");
  const baseline = JSON.stringify([
      w.receiptFingerprint,
      decisions,
      proof,
      note,
    ]),
    c = w.campaign!;
  const payload = w.subjects.map((s) => ({
    participationId: s.participationId,
    receiptId:
      w.receipts.find(
        (r) =>
          r.receipt.participationId === s.participationId &&
          r.receipt.status === "received",
      )?.receipt.id || null,
    ...decisions[s.participationId],
  }));
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2">
      <legend className="font-medium">截止后逐家核对与确认</legend>
      {w.subjects.map((s) => (
        <div key={s.participationId}>
          <label>
            {s.supplierName}
            <select
              aria-label={"最后报价处理 " + s.supplierName}
              className={input}
              value={decisions[s.participationId]?.status || ""}
              onChange={(e) =>
                setDecisions({
                  ...decisions,
                  [s.participationId]: {
                    reason: decisions[s.participationId]?.reason || "",
                    status: e.target.value,
                  },
                })
              }
            >
              <option value="">逐家选择处理，不自动代填</option>
              {Object.entries(labels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <input
            aria-label={"最后报价处理依据 " + s.supplierName}
            className={input}
            value={decisions[s.participationId]?.reason || ""}
            onChange={(e) =>
              setDecisions({
                ...decisions,
                [s.participationId]: {
                  status: decisions[s.participationId]?.status || "",
                  reason: e.target.value,
                },
              })
            }
            placeholder="本对象的核对或异常处理依据"
          />
        </div>
      ))}
      <ProofSelect
        label="最后报价确认凭证"
        value={proof}
        set={setProof}
        proofs={proofs}
      />
      <textarea
        aria-label="最后报价确认及后续处理说明"
        className={input}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="含未提交、逾期等异常的处理及后续程序依据"
      />
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked === baseline}
          onChange={(e) => setChecked(e.target.checked ? baseline : "")}
        />
        已逐家核对最终响应、实际接收时点及异常处理
      </label>
      <button
        className={btn}
        disabled={
          !proof ||
          !note.trim() ||
          checked !== baseline ||
          new Date(c.cutoffAt).getTime() > Date.now() ||
          payload.some((d) => !d.status || !d.reason?.trim())
        }
        onClick={() =>
          void submit({
            expectedVersion: c.version,
            receiptFingerprint: w.receiptFingerprint,
            decisions: payload,
            evidenceVersionId: proof,
            reviewed: true,
            note,
            idempotencyKey: crypto.randomUUID(),
          })
        }
      >
        确认最后报价及逐家处理并锁定
      </button>
    </fieldset>
  );
}
