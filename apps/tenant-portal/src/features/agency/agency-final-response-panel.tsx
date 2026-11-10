import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  agencyFileDownload,
  type AgencyDetail,
  type AssessmentSession,
  type AssessmentEntry,
  type EvaluationCriterion,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Snapshot = {
  subjects: {
    participationId: string;
    supplierName: string;
    fileVersionId: string;
    attachmentId: string;
    responseHash: string;
  }[];
  clauses: {
    key: string;
    title: string;
    locator: string;
    requirementText: string;
    sourceVersionId: string;
    sourceHash: string;
  }[];
  criteria: EvaluationCriterion[];
  members: { userId: string; name: string }[];
  requirementsVersionId: string;
  requirementsHash: string;
};
export type FinalResponseWorkspace = {
  mode: string;
  branch: {
    procurementMethod: string;
    evaluationMethod: string;
    priceSource: string;
    finalResponseRequired: boolean;
    scoringAllowed: boolean;
    competitive: boolean;
    remainingProcesses: string[];
  };
  fingerprint: string;
  plan: { version: number; frozenHash: string } | null;
  snapshot: Snapshot | null;
  progress: { userId: string; name: string; status: string }[];
  blockers: string[];
};
export type FinalResponseMine = {
  fingerprint: string;
  plan: { frozenHash: string };
  snapshot: Snapshot;
  sheet: {
    id: string;
    status: string;
    version: number;
    entriesJson: string;
    frozenHash: string | null;
    ordinal?: number;
    previousId?: string | null;
    correctionId?: string | null;
  };
  blockers: string[];
  history?: FinalResponseMine["sheet"][];
  corrections?: {
    id: string;
    status: string;
    sheetId: string;
    sheetHash: string;
    cellsJson: string;
    reason: string;
    workflowId: string | null;
    resultNote: string;
  }[];
};
type Proof = { id: string; name: string };
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
export function AgencyFinalResponsePanel({
  detail,
  session,
  actor,
  organize,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: AssessmentSession;
  actor: string | undefined;
  organize: boolean;
  busy: boolean;
  run: Run;
}) {
  const [open, setOpen] = useState(false),
    { can } = useBuyerPermissions(),
    client = useQueryClient(),
    path = `/packages/${detail.record.id}/sessions/${session.id}/final-response-review`;
  const q = useQuery({
    queryKey: ["agency-final-response", session.id],
    queryFn: () => api<FinalResponseWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const mine = useQuery({
    queryKey: ["agency-final-response-mine", session.id, actor],
    queryFn: () => api<FinalResponseMine>(path + "/mine"),
    enabled:
      open &&
      q.data?.mode === "active" &&
      !!q.data.snapshot?.members.some((m) => m.userId === actor),
    refetchInterval: open && q.data?.mode === "active" ? 5000 : false,
  });
  const proofs = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
    );
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
      if (mine.data) await mine.refetch();
      await client.invalidateQueries({
        queryKey: ["agency-price", session.id],
      });
      await client.invalidateQueries({
        queryKey: ["agency-total", session.id],
      });
    });
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        最终响应复核与方式分支
      </summary>
      <p className="my-2 text-xs">
        最后报价接收确认不等于实质响应通过。谈判／磋商成员对最终需求与实际响应独立复核；磋商按原冻结规则重新提交最终响应分值，汇总使用本次意见。组织者只查看进度，不代填成员意见。
      </p>
      {(q.isError || mine.isError) && (
        <FeedbackNotice tone="error" message="最终响应复核加载失败，请重试" />
      )}
      {q.isError && (
        <button className={btn} onClick={() => void q.refetch()}>
          重试最终响应工作区
        </button>
      )}
      {mine.isError && (
        <button className={btn} onClick={() => void mine.refetch()}>
          重试本人最终响应任务
        </button>
      )}
      {q.data && (
        <>
          <p className="text-sm">
            采购方式：{q.data.branch.procurementMethod}；
            {q.data.branch.scoringAllowed
              ? "综合评分分支"
              : "不采用技术商务综合评分"}
            ；
            {q.data.branch.finalResponseRequired
              ? "使用已确认最后报价与最终响应"
              : "按本方式原始报价或专业协商程序处理，不提供再次议价"}
          </p>
          <p className="text-sm text-amber-800">{q.data.blockers.join("；")}</p>
          <p className="text-xs">
            后续专有程序：{q.data.branch.remainingProcesses.join("；")}
          </p>
          {q.data.mode === "legacy" && (
            <p className="text-sm">
              历史已确认任务保留原线下复核路径，不补造成员意见；已有价格计算不能倒改依据。
            </p>
          )}
          {q.data.branch.finalResponseRequired &&
            q.data.mode !== "active" &&
            organize &&
            can("buyer:agency:evaluation:final-response:organize") && (
              <Activate
                w={q.data}
                proofs={proofs}
                disabled={busy || q.data.blockers.length > 0}
                submit={(d) => act(() => api(path + "/activate", "POST", d))}
              />
            )}
          {q.data.snapshot && (
            <>
              <p className="break-all text-xs">
                共同最终需求 {q.data.snapshot.requirementsVersionId} · SHA256{" "}
                {q.data.snapshot.requirementsHash}；复核依据SHA256{" "}
                {q.data.plan?.frozenHash}
              </p>
              <ul className="text-sm">
                {q.data.progress.map((v) => (
                  <li key={v.userId}>
                    {v.name}：
                    {v.status === "submitted" ? "已独立提交" : "本人草稿待完成"}
                  </li>
                ))}
              </ul>
              <details>
                <summary className="text-sm">冻结最终响应与条款对照</summary>
                {q.data.snapshot.subjects.map((v) => (
                  <p key={v.participationId} className="break-all text-xs">
                    {v.supplierName} · SHA256 {v.responseHash}{" "}
                    <button
                      className={btn}
                      onClick={() =>
                        void run(() =>
                          agencyFileDownload(
                            v.attachmentId,
                            v.supplierName + "最终响应",
                          ),
                        )
                      }
                    >
                      下载{v.supplierName}最终响应
                    </button>
                  </p>
                ))}
                {q.data.snapshot.clauses.map((v) => (
                  <p key={v.key} className="my-2 break-all text-xs">
                    {v.title} · {v.locator}：{v.requirementText}；来源{" "}
                    {v.sourceVersionId} · SHA256 {v.sourceHash}
                  </p>
                ))}
              </details>
            </>
          )}
          {mine.data && (
            <MineForm
              key={mine.data.sheet.id}
              w={mine.data}
              proofs={proofs}
              disabled={
                busy ||
                mine.data.blockers.length > 0 ||
                !can("buyer:agency:evaluation:final-response:review")
              }
              save={(d) => act(() => api(path + "/mine", "PUT", d))}
              submit={(d) => act(() => api(path + "/mine/submit", "POST", d))}
              correction={(d) =>
                act(() => api(path + "/corrections", "POST", d))
              }
              withdraw={(id, reason) =>
                act(() =>
                  api(path + "/corrections/" + id + "/withdraw", "POST", {
                    reason,
                  }),
                )
              }
            />
          )}
        </>
      )}
    </details>
  );
}
function ProofSelect({
  label,
  value,
  set,
  proofs,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  proofs: Proof[];
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        aria-label={label}
        className={input}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">选择已封存脱敏凭证</option>
        {proofs.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function Activate({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: FinalResponseWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const basis = JSON.stringify([w.fingerprint, proof, reason]);
  return (
    <fieldset disabled={disabled} className="my-2 space-y-2">
      <legend>冻结最终响应复核依据</legend>
      <ProofSelect
        label="最终响应复核组织凭证"
        value={proof}
        set={setProof}
        proofs={proofs}
      />
      <label className="block text-sm">
        最终响应复核组织说明
        <textarea
          aria-label="最终响应复核组织说明"
          className={input}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={checked === basis}
          onChange={(e) => setChecked(e.target.checked ? basis : "")}
        />
        已核对最终需求、精确响应副本、全部冻结评审职责及原评分规则，未修改资格条件或评分标准
      </label>
      <button
        className={btn}
        disabled={disabled || !proof || !reason.trim() || checked !== basis}
        onClick={() =>
          void submit({
            expectedVersion: w.plan?.version || 0,
            expectedFingerprint: w.fingerprint,
            evidenceVersionId: proof,
            reviewed: true,
            reason,
            idempotencyKey: crypto.randomUUID(),
          })
        }
      >
        冻结最终响应复核
      </button>
    </fieldset>
  );
}
function MineForm({
  w,
  proofs,
  disabled,
  save,
  submit,
  correction,
  withdraw,
}: {
  correction: (d: unknown) => Promise<boolean>;
  withdraw: (id: string, reason: string) => Promise<boolean>;
  w: FinalResponseMine;
  proofs: Proof[];
  disabled: boolean;
  save: (d: unknown) => Promise<boolean>;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [entries, setEntries] = useState<AssessmentEntry[]>(() =>
      JSON.parse(w.sheet.entriesJson),
    ),
    [version, setVersion] = useState(w.sheet.version),
    [dirty, setDirty] = useState(false),
    [checked, setChecked] = useState(""),
    [proof, setProof] = useState("");
  const auth = w.corrections?.find((r) => r.id === w.sheet.correctionId);
  const allowed = auth
    ? (JSON.parse(auth.cellsJson) as {
        participationId: string;
        criterionKey: string;
      }[])
    : null;
  const locked = w.sheet.status === "submitted",
    conflict = version !== w.sheet.version,
    basis = JSON.stringify([w.fingerprint, w.sheet.version, entries, proof]);
  useEffect(() => setChecked(""), [w.fingerprint, w.sheet.version]);
  const change = (
    participant: string,
    key: string,
    patch: Partial<AssessmentEntry>,
  ) => {
    const old = entries.find(
      (v) => v.participationId === participant && v.criterionKey === key,
    ) || {
      participationId: participant,
      criterionKey: key,
      score: null,
      conclusion: null,
      evidence: "",
      opinion: "",
    };
    setEntries([
      ...entries.filter(
        (v) => !(v.participationId === participant && v.criterionKey === key),
      ),
      { ...old, ...patch },
    ]);
    setDirty(true);
  };
  return (
    <div className="my-3 space-y-2 rounded border p-3">
      <h5 className="font-semibold">
        本人最终响应独立意见 · {locked ? "已锁定" : "草稿"}
      </h5>
      <p className="text-sm text-amber-800">{w.blockers.join("；")}</p>
      {locked && (
        <p className="break-all text-xs">
          本人提交SHA256 {w.sheet.frozenHash}
          ；更正须申请限定范围的独立授权，保留原提交并由本人重新提交。
        </p>
      )}
      {conflict && !locked && (
        <p className="text-sm text-amber-800">
          服务端草稿版本已变化，本地内容保留。
          <button
            className={btn}
            disabled={disabled}
            onClick={() => {
              setVersion(w.sheet.version);
              setChecked("");
            }}
          >
            保留本地内容并绑定最新草稿
          </button>
          <button
            className={btn}
            disabled={disabled}
            onClick={() => {
              setEntries(JSON.parse(w.sheet.entriesJson));
              setVersion(w.sheet.version);
              setDirty(false);
              setChecked("");
            }}
          >
            放弃本地修改并读取最新草稿
          </button>
        </p>
      )}
      <fieldset disabled={disabled || locked} className="space-y-3">
        {w.snapshot.subjects.map((s) => (
          <section key={s.participationId}>
            <h6 className="font-semibold">{s.supplierName}</h6>
            {w.snapshot.criteria.map((c) => {
              const e = (
                  locked
                    ? (JSON.parse(w.sheet.entriesJson) as AssessmentEntry[])
                    : entries
                ).find(
                  (v) =>
                    v.participationId === s.participationId &&
                    v.criterionKey === c.key,
                ),
                label = s.supplierName + " " + c.title;
              return (
                <fieldset
                  key={c.key}
                  disabled={
                    !!allowed &&
                    !allowed.some(
                      (v) =>
                        v.participationId === s.participationId &&
                        v.criterionKey === c.key,
                    )
                  }
                  className="my-2 space-y-1 rounded border p-2"
                >
                  <p className="text-sm">
                    {c.title}
                    {c.resultType === "score"
                      ? `（原冻结范围${c.minimum}～${c.maximum}，权重${c.weight}）`
                      : "（实质响应对照）"}
                  </p>
                  {c.resultType === "score" ? (
                    <label className="block text-sm">
                      分值
                      <input
                        aria-label={"最终响应分值 " + label}
                        className={input}
                        value={e?.score ?? ""}
                        onChange={(v) =>
                          change(s.participationId, c.key, {
                            score:
                              v.target.value === "" ? null : v.target.value,
                          })
                        }
                      />
                    </label>
                  ) : (
                    <label className="block text-sm">
                      本人结论
                      <select
                        aria-label={"最终响应结论 " + label}
                        className={input}
                        value={e?.conclusion || ""}
                        onChange={(v) =>
                          change(s.participationId, c.key, {
                            conclusion: v.target.value || null,
                          })
                        }
                      >
                        <option value="">本人明确填写</option>
                        <option value="pass">通过</option>
                        <option value="fail">未通过</option>
                      </select>
                    </label>
                  )}
                  <textarea
                    aria-label={"最终响应依据 " + label}
                    className={input}
                    placeholder="定位实际最终响应原文及适用条款"
                    value={e?.evidence || ""}
                    onChange={(v) =>
                      change(s.participationId, c.key, {
                        evidence: v.target.value,
                      })
                    }
                  />
                  <textarea
                    aria-label={"最终响应意见 " + label}
                    className={input}
                    placeholder="本人独立意见，不从他人或初次响应推填"
                    value={e?.opinion || ""}
                    onChange={(v) =>
                      change(s.participationId, c.key, {
                        opinion: v.target.value,
                      })
                    }
                  />
                </fieldset>
              );
            })}
          </section>
        ))}
        {!locked && (
          <>
            <button
              className={btn}
              disabled={disabled || conflict}
              onClick={() =>
                void save({
                  expectedVersion: version,
                  expectedFingerprint: w.fingerprint,
                  entries,
                  idempotencyKey: crypto.randomUUID(),
                }).then((ok) => {
                  if (ok) {
                    setVersion(version + 1);
                    setDirty(false);
                    setChecked("");
                  }
                })
              }
            >
              保存本人最终响应草稿
            </button>
            <ProofSelect
              label="本人最终响应复核凭证"
              value={proof}
              set={setProof}
              proofs={proofs}
            />
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={checked === basis}
                onChange={(e) => setChecked(e.target.checked ? basis : "")}
              />
              已本人核对最终需求与实际响应，并完成全部职责项
            </label>
            <button
              className={btn}
              disabled={
                disabled || conflict || dirty || !proof || checked !== basis
              }
              onClick={() =>
                void submit({
                  expectedVersion: w.sheet.version,
                  expectedFingerprint: w.fingerprint,
                  evidenceVersionId: proof,
                  personallyConfirmed: true,
                  idempotencyKey: crypto.randomUUID(),
                })
              }
            >
              独立提交本人最终响应意见
            </button>
          </>
        )}
      </fieldset>
      <FinalCorrections
        w={w}
        proofs={proofs}
        disabled={disabled}
        request={correction}
        withdraw={withdraw}
      />
    </div>
  );
}

function FinalCorrections({
  w,
  proofs,
  disabled,
  request,
  withdraw,
}: {
  w: FinalResponseMine;
  proofs: Proof[];
  disabled: boolean;
  request: (d: unknown) => Promise<boolean>;
  withdraw: (id: string, reason: string) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    [cells, setCells] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [proof, setProof] = useState(""),
    [dialog, setDialog] = useState(false),
    [error, setError] = useState<unknown>(null),
    [withdrawReasons, setWithdrawReasons] = useState<Record<string, string>>(
      {},
    );
  const pending = w.corrections?.some((r) => r.status === "processing"),
    key = (p: string, c: string) => p + "::" + c;
  return (
    <section className="space-y-2 border-t pt-3">
      <h6 className="font-semibold">本人最终响应更正与历史</h6>
      {w.sheet.status === "submitted" &&
        can("buyer:agency:evaluation:correction:request") &&
        !pending && (
          <fieldset disabled={disabled} className="space-y-2">
            <legend>申请独立授权的限定更正</legend>
            {w.snapshot.subjects.map((s) => (
              <div key={s.participationId}>
                {w.snapshot.criteria.map((c) => (
                  <label key={c.key} className="mr-3 inline-flex gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={cells.includes(key(s.participationId, c.key))}
                      onChange={(e) =>
                        setCells(
                          e.target.checked
                            ? [...cells, key(s.participationId, c.key)]
                            : cells.filter(
                                (k) => k !== key(s.participationId, c.key),
                              ),
                        )
                      }
                    />
                    {s.supplierName} · {c.title}
                  </label>
                ))}
              </div>
            ))}
            <textarea
              aria-label="最终响应更正原因"
              className={input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <ProofSelect
              label="最终响应更正依据"
              value={proof}
              set={setProof}
              proofs={proofs}
            />
            <button
              className={btn}
              disabled={disabled || !cells.length || !reason.trim() || !proof}
              onClick={() => {
                setError(null);
                setDialog(true);
              }}
            >
              提交最终响应更正审批
            </button>
          </fieldset>
        )}
      {w.sheet.correctionId && (
        <p className="text-xs text-amber-800">
          当前为获批更正草稿；仅授权条目可编辑，其他原提交内容锁定保留。授权：
          {w.sheet.correctionId}
        </p>
      )}
      {w.corrections?.map((r) => (
        <div key={r.id} className="space-y-1 rounded border p-2 text-sm">
          <p>
            更正申请：
            {
              (
                {
                  processing: "审批中",
                  approved: "已批准",
                  rejected: "已驳回",
                  withdrawn: "已撤回",
                } as Record<string, string>
              )[r.status]
            }{" "}
            · {r.reason}
          </p>
          {r.resultNote && <p>{r.resultNote}</p>}
          {r.workflowId && (
            <WorkflowStatusPanel
              businessType="agency_assessment_correction"
              businessId={r.id}
              compact
            />
          )}
          {r.status === "processing" && (
            <>
              <input
                aria-label={"最终响应撤回原因 " + r.id}
                className={input}
                value={withdrawReasons[r.id] || ""}
                onChange={(e) =>
                  setWithdrawReasons({
                    ...withdrawReasons,
                    [r.id]: e.target.value,
                  })
                }
              />
              <button
                className={btn}
                disabled={!withdrawReasons[r.id]?.trim()}
                onClick={() => void withdraw(r.id, withdrawReasons[r.id])}
              >
                撤回本人最终响应更正
              </button>
            </>
          )}
        </div>
      ))}
      <details>
        <summary className="text-sm">
          本人最终响应历史（{w.history?.length || 1}版）
        </summary>
        {(w.history || [w.sheet]).map((s) => (
          <details key={s.id} className="my-2 rounded border p-2 text-xs">
            <summary>
              第{s.ordinal || 1}版 · {s.status} · {s.frozenHash || "草稿"}
            </summary>
            {(JSON.parse(s.entriesJson) as AssessmentEntry[]).map((e) => (
              <p
                key={key(e.participationId, e.criterionKey)}
                className="my-2 break-all"
              >
                {
                  w.snapshot.subjects.find(
                    (v) => v.participationId === e.participationId,
                  )?.supplierName
                }{" "}
                · {e.criterionKey} · {e.score ?? e.conclusion} · {e.evidence} ·{" "}
                {e.opinion}
              </p>
            ))}
          </details>
        ))}
      </details>
      {dialog && (
        <WorkflowSubmitDialog
          businessType="agency_assessment_correction"
          title="本人最终响应更正申请"
          busy={disabled}
          submissionError={error}
          onClose={() => setDialog(false)}
          onSubmit={(formData) => {
            setError(null);
            void request({
              expectedVersion: w.sheet.version,
              expectedFingerprint: w.fingerprint,
              cells: cells.map((k) => {
                const [participationId, criterionKey] = k.split("::");
                return { participationId, criterionKey };
              }),
              reason,
              evidenceVersionId: proof,
              formData,
              idempotencyKey: crypto.randomUUID(),
            })
              .then((ok) => {
                if (ok) {
                  setDialog(false);
                  setCells([]);
                  setReason("");
                  setProof("");
                } else setError(new Error("提交未成功，请查看业务提示并重试"));
              })
              .catch(setError);
          }}
        />
      )}
    </section>
  );
}
