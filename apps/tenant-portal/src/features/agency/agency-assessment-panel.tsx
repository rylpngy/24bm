import { AgencyRecommendationPanel } from "./agency-recommendation-panel";
import { AgencyFinalResponsePanel } from "./agency-final-response-panel";
import { AgencyRequirementChangePanel } from "./agency-requirement-change-panel";
import { AgencyDiscussionPanel } from "./agency-discussion-panel";
import { AgencyTotalPanel } from "./agency-total-panel";
import { AgencyPricePanel } from "./agency-price-panel";
import { AgencyFinalQuotePanel } from "./agency-final-quote-panel";
import { AgencyQuotePanel } from "./agency-quote-panel";
import { AgencyStagePanel, stageNames } from "./agency-opening-panel";
import { useAuthStore } from "../../lib/auth-store";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type EvaluationView,
  type AssessmentOverview,
  type AssessmentMine,
  type AssessmentEntry,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
const btn =
    "rounded border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40",
  input = "w-full rounded border bg-white px-3 py-2 text-sm";
const stamp = (s: string) => (s ? new Date(s).toLocaleString() : "");
export function AgencyAssessmentPanel({
  detail,
  round,
  busy,
  run,
}: {
  detail: AgencyDetail;
  round: EvaluationView;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    base = `/packages/${detail.record.id}`,
    path = `${base}/rounds/${round.round.id}/assessment`;
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["agency-assessment", round.round.id],
    queryFn: () => api<AssessmentOverview>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const actor = useAuthStore((s) => s.session?.userId);
  const member = round.config.members.find((m) => m.userId === actor);
  const organize =
    can("buyer:agency:evaluation:organize") &&
    !!member?.roles.some((r) => r === "organizer" || r === "leader");
  const assigned = round.config.rules.some((r) =>
    member?.roles.includes(
      r.configuredRule.stage === "qualification"
        ? "qualification_reviewer"
        : r.configuredRule.stage === "conformity"
          ? "conformity_reviewer"
          : "review_member",
    ),
  );
  return (
    <details
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="rounded border p-3"
    >
      <summary className="cursor-pointer text-sm font-semibold">
        独立评审任务
      </summary>
      {q.error && (
        <FeedbackNotice tone="error" message={(q.error as Error).message} />
      )}
      {open && q.data && (
        <div className="mt-3 space-y-4">
          <p className="text-xs text-slate-600">
            本轮记录工作人员确认的线下开启及独立意见；不导入未开启响应材料，不自动确定资格、排名或成交。每人只编辑本人职责项，组织人员仅查看完成进度。
          </p>
          {!q.data.sessions.length && (
            <p className="text-sm">
              请先在“材料接收与正式开启”中核对材料及开启快照，再建立本轮独立任务。
            </p>
          )}
          {q.data.sessions.map((session) => (
            <div key={session.id} className="space-y-3">
              <p className="text-xs">
                线下开启：{stamp(session.openedAt)} · {session.note}
              </p>
              {assigned && can("buyer:agency:evaluation:review") && (
                <MyAssessment
                  detail={detail}
                  session={session.id}
                  busy={busy}
                  run={run}
                />
              )}
              {organize && <Progress base={base} session={session.id} />}
              {can("buyer:agency:evaluation:final-response:read") && (
                <AgencyFinalResponsePanel
                  detail={detail}
                  session={session}
                  actor={actor}
                  organize={organize}
                  busy={busy}
                  run={run}
                />
              )}
              {organize && can("buyer:agency:evaluation:price:read") && (
                <AgencyQuotePanel
                  detail={detail}
                  session={session}
                  busy={busy}
                  run={run}
                />
              )}
              {organize &&
                can("buyer:agency:evaluation:discussion:read") &&
                ["竞争性谈判", "竞争性磋商"].includes(
                  detail.record.procurementMethod || "",
                ) && (
                  <AgencyDiscussionPanel
                    detail={detail}
                    session={session}
                    round={round}
                    busy={busy}
                    run={run}
                  />
                )}
              {organize &&
                can("buyer:agency:evaluation:change:read") &&
                ["竞争性谈判", "竞争性磋商"].includes(
                  detail.record.procurementMethod || "",
                ) && (
                  <AgencyRequirementChangePanel
                    detail={detail}
                    session={session}
                    busy={busy}
                    run={run}
                  />
                )}
              {organize &&
                can("buyer:agency:evaluation:final:read") &&
                ["竞争性谈判", "竞争性磋商"].includes(
                  detail.record.procurementMethod || "",
                ) && (
                  <AgencyFinalQuotePanel
                    detail={detail}
                    session={session}
                    busy={busy}
                    run={run}
                  />
                )}
              {organize &&
                can("buyer:agency:evaluation:calculation:read") &&
                detail.record.procurementMethod !== "单一来源" && (
                  <AgencyPricePanel
                    detail={detail}
                    session={session}
                    busy={busy}
                    run={run}
                  />
                )}
              {organize &&
                can("buyer:agency:evaluation:total:read") &&
                can("buyer:agency:evaluation:calculation:read") &&
                round.config.evaluationMethod === "comprehensive" && (
                  <AgencyTotalPanel
                    detail={detail}
                    session={session}
                    round={round}
                    busy={busy}
                    run={run}
                  />
                )}
              {organize && <AgencyRecommendationPanel detail={detail} session={session} round={round} busy={busy} run={run} />}
              {organize && can("buyer:agency:evaluation:stage:manage") && (
                <AgencyStagePanel
                  detail={detail}
                  session={session.id}
                  busy={busy}
                  run={run}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </details>
  );
}
function Progress({ base, session }: { base: string; session: string }) {
  const q = useQuery({
    queryKey: ["agency-assessment-progress", session],
    queryFn: () =>
      api<
        {
          userId: string;
          name: string;
          status: string;
          ordinal: number;
          stageKey: string;
        }[]
      >(`${base}/sessions/${session}/progress`),
    refetchInterval: 5000,
  });
  return (
    <details>
      <summary className="text-sm font-semibold">
        查看完成进度（不含个人意见）
      </summary>
      {q.error && (
        <FeedbackNotice tone="error" message={(q.error as Error).message} />
      )}
      <ul className="text-sm">
        {q.data?.map((r) => (
          <li key={r.userId + r.stageKey}>
            {r.name} · {stageNames[r.stageKey]} · 第{r.ordinal}版 ·{" "}
            {r.status === "submitted" ? "已独立提交" : "个人草稿"}
          </li>
        ))}
      </ul>
    </details>
  );
}
function MyAssessment({
  detail,
  session,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    base = `/packages/${detail.record.id}/sessions/${session}`;
  const [stage, setStage] = useState("");
  const suffix = stage ? "?stage=" + encodeURIComponent(stage) : "";
  const q = useQuery({
    queryKey: ["agency-assessment-mine", session, stage],
    queryFn: () => api<AssessmentMine>(base + "/mine" + suffix),
    refetchInterval: 5000,
  });
  const [editing, setEditing] = useState<{
      sheetId: string;
      version: number;
      entries: AssessmentEntry[];
    } | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [saveKey, setSaveKey] = useState(crypto.randomUUID()),
    [submitKey, setSubmitKey] = useState(crypto.randomUUID()),
    [cells, setCells] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [proof, setProof] = useState(""),
    [dialog, setDialog] = useState(false),
    [requestKey, setRequestKey] = useState(crypto.randomUUID()),
    [error, setError] = useState<unknown>(),
    [withdrawReasons, setWithdrawReasons] = useState<Record<string, string>>(
      {},
    );
  const w = q.data,
    sheet = w?.sheets[0];
  const conflict =
    !!sheet &&
    !!editing &&
    (editing.sheetId !== sheet.id || editing.version !== sheet.version);
  const values =
    editing?.entries ||
    (sheet ? (JSON.parse(sheet.entriesJson) as AssessmentEntry[]) : []);
  const editable = sheet?.status === "draft" && w?.writable && !conflict;
  const allowed = sheet?.correctionId
    ? w?.corrections.find((r) => r.id === sheet.correctionId)
    : null;
  const allowedCells = allowed
    ? (JSON.parse(allowed.cellsJson) as {
        participationId: string;
        criterionKey: string;
      }[])
    : null;
  const fieldKey = (subject: string, criterion: string) =>
    subject + "::" + criterion;
  const change = (
    subject: string,
    criterion: string,
    patch: Partial<AssessmentEntry>,
  ) => {
    if (!sheet) return;
    const old = values.find(
      (v) => v.participationId === subject && v.criterionKey === criterion,
    ) || {
      participationId: subject,
      criterionKey: criterion,
      score: null,
      conclusion: null,
      evidence: "",
      opinion: "",
    };
    setEditing({
      sheetId: sheet.id,
      version: editing?.version ?? sheet.version,
      entries: [
        ...values.filter(
          (v) => v.participationId !== subject || v.criterionKey !== criterion,
        ),
        { ...old, ...patch },
      ],
    });
    setConfirmed(false);
    setSaveKey(crypto.randomUUID());
  };
  const files = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " · V" + v.ordinal })),
    );
  const clear = () => {
    setEditing(null);
    setConfirmed(false);
    setSubmitKey(crypto.randomUUID());
  };
  if (q.error)
    return <FeedbackNotice tone="info" message={(q.error as Error).message} />;
  if (!w || !sheet) return <p>加载本人评审任务…</p>;
  return (
    <section
      className="space-y-3 rounded border bg-slate-50 p-3"
      aria-label="本人独立评审"
    >
      <h5 className="font-bold">
        本人独立意见 · 第{sheet.ordinal}版 ·{" "}
        {sheet.status === "submitted" ? "已提交锁定" : "个人草稿"}
      </h5>
      <label className="block text-xs">
        本人评审阶段
        <select
          aria-label="本人评审阶段"
          className={input}
          disabled={!!editing || busy}
          value={stage || w.selectedStage || ""}
          onChange={(e) => {
            setStage(e.target.value);
            clear();
          }}
        >
          {(w.stageKeys || [w.selectedStage || ""]).map((key) => (
            <option key={key} value={key}>
              {stageNames[key] || "本人意见"}
            </option>
          ))}
        </select>
      </label>
      {w.blockers.length > 0 && (
        <FeedbackNotice tone="error" message={w.blockers.join("；")} />
      )}
      {conflict && (
        <FeedbackNotice
          tone="error"
          message="意见版本已变化。当前编辑已保留，请核对后清空编辑器，重新读取最新版本。"
        />
      )}
      {allowed && (
        <p className="text-sm text-blue-800">
          已获批更正：{allowed.reason}
          。仅开放获批对象和项目，其余内容锁定，原提交记录保留。
        </p>
      )}
      <fieldset disabled={busy || !editable} className="space-y-3">
        {w.subjects.map((s) => (
          <div key={s.participationId} className="space-y-2">
            <h6 className="font-semibold">{s.supplierName}</h6>
            {w.criteria.map((r) => {
              const value = values.find(
                (v) =>
                  v.participationId === s.participationId &&
                  v.criterionKey === r.key,
              );
              const prefix = s.supplierName + " " + r.key;
              const locked =
                !!allowedCells &&
                !allowedCells.some(
                  (a) =>
                    a.participationId === s.participationId &&
                    a.criterionKey === r.key,
                );
              return (
                <fieldset
                  key={r.key}
                  disabled={locked}
                  className="space-y-2 rounded border bg-white p-3"
                >
                  <legend className="text-sm font-semibold">
                    {r.key} · {r.title} ·{" "}
                    {r.resultType === "score"
                      ? `分值${r.minimum}～${r.maximum}`
                      : "通过/不通过"}
                  </legend>
                  <p className="text-xs">
                    适用对象：{r.applicableTo} ·{" "}
                    {r.evidenceRequired ? "依据必填" : "依据选填"}
                  </p>
                  {r.resultType === "score" ? (
                    <input
                      aria-label={prefix + "分值"}
                      className={input}
                      type="number"
                      min={r.minimum}
                      max={r.maximum}
                      step="0.000001"
                      value={value?.score ?? ""}
                      onChange={(e) =>
                        change(s.participationId, r.key, {
                          score: e.target.value === "" ? null : e.target.value,
                        })
                      }
                    />
                  ) : (
                    <select
                      aria-label={prefix + "结论"}
                      className={input}
                      value={value?.conclusion || ""}
                      onChange={(e) =>
                        change(s.participationId, r.key, {
                          conclusion: e.target.value || null,
                        })
                      }
                    >
                      <option value="">请选择本人结论</option>
                      <option value="pass">通过</option>
                      <option value="fail">不通过</option>
                    </select>
                  )}
                  <textarea
                    aria-label={prefix + "依据"}
                    className={input}
                    value={value?.evidence || ""}
                    placeholder="记录本人核对的资料页码或事实依据"
                    onChange={(e) =>
                      change(s.participationId, r.key, {
                        evidence: e.target.value,
                      })
                    }
                  />
                  <textarea
                    aria-label={prefix + "意见"}
                    className={input}
                    value={value?.opinion || ""}
                    placeholder="填写本人独立意见（提交必填）"
                    onChange={(e) =>
                      change(s.participationId, r.key, {
                        opinion: e.target.value,
                      })
                    }
                  />
                </fieldset>
              );
            })}
          </div>
        ))}
        <button
          className={btn}
          disabled={!editing}
          onClick={() =>
            void run(async () => {
              await api(base + "/mine" + suffix, "PUT", {
                expectedVersion: editing?.version,
                entries: values,
                idempotencyKey: saveKey,
              });
              clear();
              await q.refetch();
            })
          }
        >
          保存本人草稿
        </button>
      </fieldset>
      {editing && (
        <button className={btn} disabled={busy} onClick={clear}>
          清空未保存编辑并读取最新意见
        </button>
      )}
      {sheet.status === "draft" && (
        <>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              disabled={!!editing || busy || !w.writable}
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            已本人逐项复核全部对象及意见，确认独立提交并锁定本版
          </label>
          <button
            className={btn}
            disabled={!!editing || busy || !w.writable || !confirmed}
            onClick={() =>
              void run(async () => {
                await api(base + "/mine/submit" + suffix, "POST", {
                  expectedVersion: sheet.version,
                  personallyConfirmed: confirmed,
                  idempotencyKey: submitKey,
                });
                clear();
                await q.refetch();
              })
            }
          >
            本人独立提交并锁定
          </button>
        </>
      )}
      {sheet.status === "submitted" && (
        <p className="break-all text-xs">
          提交时间：{stamp(sheet.submittedAt || "")} · 意见指纹：
          {sheet.contentHash}
        </p>
      )}
      {sheet.status === "submitted" &&
        can("buyer:agency:evaluation:correction:request") &&
        w.writable && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              申请受控更正
            </summary>
            <fieldset disabled={busy} className="mt-3 space-y-2">
              <p className="text-xs">
                选择需要更正的对象及项目，填写依据。独立审批通过后，由本人修改获批项目并再次确认提交。
              </p>
              {w.subjects.flatMap((s) =>
                w.criteria.map((r) => {
                  const key = fieldKey(s.participationId, r.key);
                  return (
                    <label key={key} className="mr-4 inline-flex gap-2 text-sm">
                      <input
                        aria-label={"更正 " + s.supplierName + " " + r.key}
                        type="checkbox"
                        checked={cells.includes(key)}
                        onChange={(e) => {
                          setCells((v) =>
                            e.target.checked
                              ? [...v, key]
                              : v.filter((x) => x !== key),
                          );
                          setRequestKey(crypto.randomUUID());
                        }}
                      />
                      {s.supplierName} · {r.title}
                    </label>
                  );
                }),
              )}
              <textarea
                aria-label="本人更正原因"
                className={input}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setRequestKey(crypto.randomUUID());
                }}
              />
              <select
                aria-label="本人更正依据版本"
                className={input}
                value={proof}
                onChange={(e) => {
                  setProof(e.target.value);
                  setRequestKey(crypto.randomUUID());
                }}
              >
                <option value="">请选择项目可见封存依据</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                className={btn}
                disabled={
                  !cells.length ||
                  !proof ||
                  !reason.trim() ||
                  w.corrections.some((c) => c.status === "processing")
                }
                onClick={() => {
                  setError(undefined);
                  setDialog(true);
                }}
              >
                提交本人更正审批
              </button>
            </fieldset>
          </details>
        )}
      {w.corrections.map((c) => (
        <div
          key={c.id}
          className="space-y-2 rounded border bg-white p-2 text-sm"
        >
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
              )[c.status]
            }{" "}
            · {c.reason}
          </p>
          {c.resultNote && <p>办理说明：{c.resultNote}</p>}
          {c.workflowId && (
            <WorkflowStatusPanel
              businessType="agency_assessment_correction"
              businessId={c.id}
              compact
            />
          )}
          {c.status === "processing" && (
            <>
              <input
                aria-label={"撤回原因 " + c.id}
                className={input}
                value={withdrawReasons[c.id] || ""}
                onChange={(e) =>
                  setWithdrawReasons((v) => ({ ...v, [c.id]: e.target.value }))
                }
              />
              <button
                className={btn}
                disabled={busy || !withdrawReasons[c.id]?.trim()}
                onClick={() =>
                  void run(async () => {
                    await api(`${base}/corrections/${c.id}/withdraw`, "POST", {
                      reason: withdrawReasons[c.id],
                    });
                    await q.refetch();
                  })
                }
              >
                撤回本人的更正申请
              </button>
            </>
          )}
        </div>
      ))}
      <details>
        <summary className="text-sm font-semibold">
          本人历史提交与版本（{w.sheets.length}）
        </summary>
        {w.sheets.map((s) => (
          <details key={s.id} className="my-2 rounded border p-2 text-xs">
            <summary>
              第{s.ordinal}版 · {s.status === "submitted" ? "已提交" : "草稿"} ·{" "}
              {s.contentHash || "尚未提交"}
            </summary>
            {(JSON.parse(s.entriesJson) as AssessmentEntry[]).map((e) => (
              <p
                className="my-2"
                key={fieldKey(e.participationId, e.criterionKey)}
              >
                {
                  w.subjects.find(
                    (s) => s.participationId === e.participationId,
                  )?.supplierName
                }{" "}
                · {e.criterionKey} ·{" "}
                {e.score ??
                  (e.conclusion === "pass"
                    ? "通过"
                    : e.conclusion === "fail"
                      ? "不通过"
                      : "未填")}{" "}
                · 依据：{e.evidence} · 意见：{e.opinion}
              </p>
            ))}
          </details>
        ))}
      </details>
      {dialog && (
        <WorkflowSubmitDialog
          businessType="agency_assessment_correction"
          title="本人评审意见更正申请"
          busy={busy}
          submissionError={error}
          onClose={() => setDialog(false)}
          onSubmit={(formData) =>
            void run(async () => {
              try {
                await api(base + "/corrections" + suffix, "POST", {
                  expectedVersion: sheet.version,
                  cells: cells.map((key) => {
                    const [participationId, criterionKey] = key.split("::");
                    return { participationId, criterionKey };
                  }),
                  reason,
                  evidenceVersionId: proof,
                  formData,
                  idempotencyKey: requestKey,
                });
                setDialog(false);
                setCells([]);
                setReason("");
                setProof("");
                setRequestKey(crypto.randomUUID());
                await q.refetch();
              } catch (e) {
                setError(e);
                throw e;
              }
            })
          }
        />
      )}
    </section>
  );
}
