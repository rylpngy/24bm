import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type EvaluationView,
} from "@24bid/api-client";
import { useAuthStore } from "../../lib/auth-store";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
export const incidentKinds: Record<string, string> = {
  member_absent: "成员缺席",
  recusal: "成员回避",
  missing_file: "文件缺失",
  version_conflict: "材料版本冲突",
  invalid_response: "无效响应",
  insufficient_subjects: "对象数量不足",
  abnormal_price: "报价异常",
  incomplete_opinion: "成员意见不完整",
  network_failure: "网络中断",
  evaluation_pause: "评审暂停",
  procurement_failure: "采购失败",
  termination: "终止事项",
  legal_correction: "授权更正事项",
  reorganization: "另行组织事项",
  other: "其他异常",
};
const stateNames: Record<string, string> = {
    active: "本轮进行中",
    paused: "本轮已暂停",
    terminated: "本轮已停止，只读保留",
  },
  outcomes: Record<string, string> = {
    continue_ready: "本异常继续条件已满足（不自动恢复）",
    reorganize: "需另行组织，不恢复本轮",
    end_round: "需停止本轮，不恢复本轮",
  };
const eventNames: Record<string, string> = {
  incident_registered: "登记异常",
  incident_resolved: "记录处理结论",
  pause: "暂停本轮",
  resume: "恢复本轮",
  terminate: "停止本轮",
};
type Incident = {
  id: string;
  kind: string;
  title: string;
  occurredAt: string;
  responsibleName: string;
  impactScope: string;
  description: string;
  effect: string;
  restorationConditions: string;
  status: string;
  version: number;
  evidenceVersionId: string;
  evidenceHash: string;
  createdAt: string;
  resolutionJson: string | null;
};
export type IncidentWorkspace = {
  control: { state: string; version: number };
  casesFingerprint: string;
  incidents: Incident[];
  resumeBlockers: string[];
  events: {
    id: string;
    controlVersion: number;
    action: string;
    actorId: string;
    beforeState: string;
    afterState: string;
    reason: string;
    createdAt: string;
  }[];
};
type Status = {
  state: string;
  version: number;
  openCount: number;
  blockers: string[];
};
type Proof = { id: string; name: string };
type Run = (fn: () => Promise<unknown>) => Promise<boolean>;
const iso = (s: string) => (s ? new Date(s).toISOString() : "");
export function AgencyIncidentPanel({
  detail,
  round,
  busy,
  run,
}: {
  detail: AgencyDetail;
  round: EvaluationView;
  busy: boolean;
  run: Run;
}) {
  const [open, setOpen] = useState(false),
    { can } = useBuyerPermissions(),
    actor = useAuthStore((s) => s.session?.userId),
    member = round.config.members.find((m) => m.userId === actor),
    organize =
      !!member?.roles.some((r) => r === "organizer" || r === "leader") &&
      can("buyer:agency:evaluation:organize"),
    read = organize && can("buyer:agency:evaluation:incident:read"),
    manage = read && can("buyer:agency:evaluation:incident:manage"),
    control = read && can("buyer:agency:evaluation:control:manage"),
    path = `/packages/${detail.record.id}/rounds/${round.round.id}`;
  const status = useQuery({
      queryKey: ["agency-control-status", round.round.id],
      queryFn: () => api<Status>(path + "/control"),
      enabled: open && !!member,
      refetchInterval: open && !!member ? 5000 : false,
    }),
    q = useQuery({
      queryKey: ["agency-incidents", round.round.id],
      queryFn: () => api<IncidentWorkspace>(path + "/incidents"),
      enabled: open && read,
      refetchInterval: open && read ? 5000 : false,
    });
  const proofs = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
      ),
    people = Array.from(
      new Map(
        [
          ...(round.roster || []).map((p) => ({ id: p.userId, name: p.name })),
          ...(detail.members || []).map((p) => ({
            id: p.userId,
            name: p.name,
          })),
        ].map((p) => [p.id, p]),
      ).values(),
    );
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
      await status.refetch();
    });
  if (!member) return null;
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        评审异常与暂停恢复
      </summary>
      <p className="my-2 text-xs">
        控制只作用于本轮；暂停保留历史和异常处理入口，结案不自动恢复。停止本轮后不可恢复，不自动变更采购方式、结果或采购包状态。
      </p>
      {status.isError && (
        <FeedbackNotice tone="error" message="轮次控制状态加载失败，请重试。" />
      )}
      {status.data && (
        <div className="my-2 text-sm">
          <strong>
            {stateNames[status.data.state]} · 控制版本 {status.data.version}
          </strong>
          <p>未处理异常 {status.data.openCount} 项</p>
          <p className="text-amber-800">{status.data.blockers.join("；")}</p>
        </div>
      )}
      {q.isError && (
        <FeedbackNotice tone="error" message="异常明细加载失败，请重试。" />
      )}
      {(status.isError || q.isError) && (
        <button
          className={btn}
          onClick={() => {
            void status.refetch();
            if (read) void q.refetch();
          }}
        >
          重试异常工作区
        </button>
      )}
      {q.data && read && (
        <>
          <p className="text-xs">
            原件可能含敏感信息；本工作区只引用可共享的脱敏凭证，不上传个人意见正文或未授权响应原文。
          </p>
          {manage && q.data.control.state !== "terminated" && (
            <CreateForm
              proofs={proofs}
              people={people}
              canControl={control}
              disabled={busy}
              submit={(d) => act(() => api(path + "/incidents", "POST", d))}
            />
          )}
          <div className="space-y-2">
            {q.data.incidents.map((i) => (
              <IncidentCard
                key={i.id}
                incident={i}
                proofs={proofs}
                canControl={control}
                manage={manage}
                disabled={busy}
                submit={(d) =>
                  act(() =>
                    api(path + "/incidents/" + i.id + "/resolve", "POST", d),
                  )
                }
              />
            ))}
          </div>
          {control && (
            <ControlForm
              w={q.data}
              proofs={proofs}
              disabled={busy}
              submit={(action, d) =>
                act(() => api(path + "/control/" + action, "POST", d))
              }
            />
          )}
          <details className="mt-3 rounded border p-2">
            <summary>异常处理与控制历史（{q.data.events.length}）</summary>
            {q.data.events.map((e) => (
              <p key={e.id} className="my-2 text-xs">
                V{e.controlVersion} · {new Date(e.createdAt).toLocaleString()} ·{" "}
                {eventNames[e.action] || "控制更新"} · 操作人{" "}
                {people.find((p) => p.id === e.actorId)?.name || e.actorId} ·{" "}
                {stateNames[e.beforeState]} → {stateNames[e.afterState]} ·{" "}
                {e.reason}
              </p>
            ))}
          </details>
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
      <option value="">选择已封存的脱敏凭证</option>
      {proofs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
function CreateForm({
  proofs,
  people,
  canControl,
  disabled,
  submit,
}: {
  proofs: Proof[];
  people: { id: string; name: string }[];
  canControl: boolean;
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [d, setD] = useState({
      kind: "other",
      title: "",
      occurredAt: "",
      responsibleId: "",
      impactScope: "",
      description: "",
      evidenceVersionId: "",
      effect: canControl ? "pause" : "observe",
      restorationConditions: "",
    }),
    [checked, setChecked] = useState("");
  const baseline = JSON.stringify(d),
    edit = (key: keyof typeof d, value: string) => setD({ ...d, [key]: value });
  return (
    <details className="my-3 rounded border p-2">
      <summary>登记评审异常</summary>
      <fieldset disabled={disabled} className="mt-2 space-y-2">
        <select
          aria-label="异常类型"
          className={input}
          value={d.kind}
          onChange={(e) => edit("kind", e.target.value)}
        >
          {Object.entries(incidentKinds).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          aria-label="异常标题"
          className={input}
          value={d.title}
          onChange={(e) => edit("title", e.target.value)}
        />
        <label className="block text-sm">
          实际发生时间
          <input
            aria-label="异常实际发生时间"
            type="datetime-local"
            className={input}
            value={d.occurredAt}
            onChange={(e) => edit("occurredAt", e.target.value)}
          />
        </label>
        <select
          aria-label="异常责任人"
          className={input}
          value={d.responsibleId}
          onChange={(e) => edit("responsibleId", e.target.value)}
        >
          <option value="">选择有效的已授权责任人</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <textarea
          aria-label="异常影响范围"
          className={input}
          value={d.impactScope}
          onChange={(e) => edit("impactScope", e.target.value)}
          placeholder="对象、成员、材料或阶段等影响范围；暂停时阻断本轮全部评审写入"
        />
        <textarea
          aria-label="异常事实说明"
          className={input}
          value={d.description}
          onChange={(e) => edit("description", e.target.value)}
        />
        <ProofSelect
          label="异常登记脱敏凭证"
          value={d.evidenceVersionId}
          set={(v) => edit("evidenceVersionId", v)}
          proofs={proofs}
        />
        <select
          aria-label="异常影响决定"
          className={input}
          value={d.effect}
          onChange={(e) => edit("effect", e.target.value)}
        >
          <option value="pause" disabled={!canControl}>
            登记并暂停本轮全部评审写入
          </option>
          <option value="observe">
            仅登记（仍阻断价格计算与汇总，直至处理）
          </option>
        </select>
        <textarea
          aria-label="异常恢复或处理条件"
          className={input}
          value={d.restorationConditions}
          onChange={(e) => edit("restorationConditions", e.target.value)}
        />
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked === baseline}
            onChange={(e) => setChecked(e.target.checked ? baseline : "")}
          />
          已核对异常事实、影响决定、责任人及处理条件
        </label>
        <button
          className={btn}
          disabled={
            checked !== baseline ||
            !d.title.trim() ||
            !d.occurredAt ||
            !d.responsibleId ||
            !d.impactScope.trim() ||
            !d.description.trim() ||
            !d.evidenceVersionId ||
            !d.restorationConditions.trim()
          }
          onClick={() =>
            void (async () => {
              if (
                await submit({
                  ...d,
                  occurredAt: iso(d.occurredAt),
                  reviewed: true,
                  idempotencyKey: crypto.randomUUID(),
                })
              )
                setChecked("");
            })()
          }
        >
          登记异常并保留记录
        </button>
      </fieldset>
    </details>
  );
}
function IncidentCard({
  incident: i,
  proofs,
  canControl,
  manage,
  disabled,
  submit,
}: {
  incident: Incident;
  proofs: Proof[];
  canControl: boolean;
  manage: boolean;
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [d, setD] = useState({
      handledAt: "",
      outcome: "continue_ready",
      evidenceVersionId: "",
      note: "",
    }),
    [checked, setChecked] = useState("");
  const baseline = JSON.stringify([i.version, d]);
  const resolution = i.resolutionJson
    ? (JSON.parse(i.resolutionJson) as {
        handledAt: string;
        outcome: string;
        note: string;
        evidenceHash: string;
      })
    : null;
  return (
    <article
      aria-label={"异常记录 " + i.title}
      className="rounded border p-3 text-sm"
    >
      <strong>
        {i.title} · {incidentKinds[i.kind]} ·{" "}
        {i.status === "open" ? "未处理" : "已记录处理结论"}
      </strong>
      <p>
        发生 {new Date(i.occurredAt).toLocaleString()} · 登记{" "}
        {new Date(i.createdAt).toLocaleString()} · 责任人 {i.responsibleName}
      </p>
      <p>范围：{i.impactScope}</p>
      <p>事实：{i.description}</p>
      <p>
        影响决定：
        {i.effect === "pause"
          ? "暂停本轮全部评审写入"
          : "仅登记，未处理时仍阻断价格计算与汇总"}
      </p>
      <p>处理/恢复条件：{i.restorationConditions}</p>
      <details>
        <summary>依据版本与指纹</summary>
        <p className="break-all text-xs">
          {i.evidenceVersionId} · SHA256 {i.evidenceHash}
        </p>
      </details>
      {resolution && (
        <div className="mt-2 rounded border p-2">
          <p>
            {outcomes[resolution.outcome]} · 实际处理{" "}
            {new Date(resolution.handledAt).toLocaleString()}
          </p>
          <p>{resolution.note}</p>
          <p className="break-all text-xs">
            处理依据 SHA256 {resolution.evidenceHash}
          </p>
        </div>
      )}
      {manage && i.status === "open" && (
        <fieldset disabled={disabled} className="mt-2 space-y-2">
          <label className="block">
            实际处理时间
            <input
              aria-label={"异常实际处理时间 " + i.title}
              type="datetime-local"
              className={input}
              value={d.handledAt}
              onChange={(e) => setD({ ...d, handledAt: e.target.value })}
            />
          </label>
          <select
            aria-label={"异常处理结果 " + i.title}
            className={input}
            value={d.outcome}
            onChange={(e) => setD({ ...d, outcome: e.target.value })}
          >
            {Object.entries(outcomes).map(([k, v]) => (
              <option
                key={k}
                value={k}
                disabled={!canControl && k !== "continue_ready"}
              >
                {v}
              </option>
            ))}
          </select>
          <ProofSelect
            label={"异常处理脱敏凭证 " + i.title}
            value={d.evidenceVersionId}
            set={(v) => setD({ ...d, evidenceVersionId: v })}
            proofs={proofs}
          />
          <textarea
            aria-label={"异常处理说明 " + i.title}
            className={input}
            value={d.note}
            onChange={(e) => setD({ ...d, note: e.target.value })}
          />
          <label className="flex gap-2">
            <input
              type="checkbox"
              checked={checked === baseline}
              onChange={(e) => setChecked(e.target.checked ? baseline : "")}
            />
            已核对本异常处理结果及条件 {i.title}
          </label>
          <button
            className={btn}
            disabled={
              checked !== baseline ||
              !d.handledAt ||
              !d.evidenceVersionId ||
              !d.note.trim()
            }
            onClick={() =>
              void (async () => {
                if (
                  await submit({
                    ...d,
                    handledAt: iso(d.handledAt),
                    expectedVersion: i.version,
                    conditionsChecked: true,
                    idempotencyKey: crypto.randomUUID(),
                  })
                )
                  setChecked("");
              })()
            }
          >
            记录本异常处理结论
          </button>
        </fieldset>
      )}
    </article>
  );
}
function ControlForm({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: IncidentWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (action: string, d: unknown) => Promise<boolean>;
}) {
  const [action, setAction] = useState("resume"),
    [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const baseline = JSON.stringify([
      w.control.state,
      w.control.version,
      w.casesFingerprint,
      action,
      proof,
      reason,
    ]),
    canAct =
      w.control.state !== "terminated" &&
      (action === "resume"
        ? w.control.state === "paused" && !w.resumeBlockers.length
        : action === "pause"
          ? w.control.state === "active" &&
            w.incidents.some((i) => i.status === "open")
          : true);
  return (
    <fieldset
      disabled={disabled || w.control.state === "terminated"}
      className="my-3 space-y-2 rounded border p-2"
    >
      <legend className="font-medium">独立决定暂停、恢复或停止本轮</legend>
      {w.resumeBlockers.length > 0 && (
        <p className="text-sm text-amber-800">
          恢复阻断：{w.resumeBlockers.join("；")}
        </p>
      )}
      <select
        aria-label="轮次控制操作"
        className={input}
        value={action}
        onChange={(e) => setAction(e.target.value)}
      >
        <option value="resume">复核并恢复本轮</option>
        <option value="pause">依据未处理异常暂停本轮</option>
        <option value="terminate">停止本轮并只读保留（不可恢复）</option>
      </select>
      <ProofSelect
        label="轮次控制脱敏凭证"
        value={proof}
        set={setProof}
        proofs={proofs}
      />
      <textarea
        aria-label="轮次控制决定及授权依据"
        className={input}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="有权决定及恢复条件核对依据；恢复不放宽原审查、更正、版本和数量守卫"
      />
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked === baseline}
          onChange={(e) => setChecked(e.target.checked ? baseline : "")}
        />
        已核对本轮状态、全部异常及控制决定
      </label>
      <button
        className={btn}
        disabled={!canAct || !proof || !reason.trim() || checked !== baseline}
        onClick={() =>
          void (async () => {
            if (
              await submit(action, {
                expectedVersion: w.control.version,
                casesFingerprint: w.casesFingerprint,
                evidenceVersionId: proof,
                reviewed: true,
                reason,
                idempotencyKey: crypto.randomUUID(),
              })
            )
              setChecked("");
          })()
        }
      >
        执行已复核的轮次控制
      </button>
    </fieldset>
  );
}
