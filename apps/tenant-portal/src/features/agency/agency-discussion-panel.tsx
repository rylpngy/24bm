import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type AssessmentSession,
  type EvaluationView,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Content = {
  startedAt: string | null;
  endedAt: string | null;
  staffUserIds: string[] | null;
  supplierAttendees: string | null;
  agenda: string | null;
  discussion: string | null;
  supplierResponse: string | null;
  conclusion: string | null;
  changeDisposition: string | null;
  changeNote: string | null;
  evidenceVersionId: string | null;
};
type Row = {
  id: string;
  participationId: string;
  ordinal: number;
  previousId: string | null;
  status: string;
  version: number;
  contentJson: string;
  frozenJson: string | null;
  frozenHash: string | null;
  createdAt: string;
  voidReason: string | null;
};
export type DiscussionWorkspace = {
  plan: { mode: string; version: number; frozenHash: string | null } | null;
  mode: string;
  fingerprint: string;
  candidates: { participationId: string; supplierName: string }[];
  progress: {
    participationId: string;
    supplierName: string;
    confirmedCount: number;
    hasDraft: boolean;
    changePending: boolean;
  }[];
  blockers: string[];
  openedAt: string;
};
type Ledger = {
  subject: { participationId: string; supplierName: string };
  records: Row[];
  blockers: string[];
};
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
type Proof = { id: string; name: string };
const blank = (): Content => ({
  startedAt: "",
  endedAt: "",
  staffUserIds: [],
  supplierAttendees: "",
  agenda: "",
  discussion: "",
  supplierResponse: "",
  conclusion: "",
  changeDisposition: "none",
  changeNote: "",
  evidenceVersionId: "",
});
const local = (s: string | null) =>
  s
    ? new Date(new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const iso = (s: string) => (s ? new Date(s).toISOString() : null);
export function AgencyDiscussionPanel({
  detail,
  session,
  round,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: AssessmentSession;
  round: EvaluationView;
  busy: boolean;
  run: Run;
}) {
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState(""),
    [editing, setEditing] = useState(false),
    { can } = useBuyerPermissions(),
    path = `/packages/${detail.record.id}/sessions/${session.id}/discussions`;
  const q = useQuery({
    queryKey: ["agency-discussions", session.id],
    queryFn: () => api<DiscussionWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const ledger = useQuery({
    queryKey: ["agency-discussion-ledger", session.id, selected],
    queryFn: () => api<Ledger>(path + "/" + selected),
    enabled: open && !!selected && q.data?.mode === "active",
    refetchInterval:
      open && !!selected && q.data?.mode === "active" ? 5000 : false,
  });
  const act = (f: () => Promise<unknown>) =>
    run(async () => {
      await f();
      await ledger.refetch();
      await q.refetch();
    });
  const proofs = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
      ),
    manage = can("buyer:agency:evaluation:discussion:manage");
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        逐家谈判／磋商过程
      </summary>
      <p className="my-2 text-xs">
        一期线下组织及工作人员登记，不代表供应商在线身份或电子签署。按对象分别查看，确认后只追加后续沟通；沟通次数不固定为三次，与最后报价分别管理。
      </p>
      {q.isError && (
        <FeedbackNotice
          tone="error"
          message="逐家沟通工作区加载失败，请重试。"
        />
      )}
      {q.isError && (
        <button className={btn} onClick={() => void q.refetch()}>
          重试逐家沟通工作区
        </button>
      )}
      {q.data && (
        <>
          <p className="text-sm text-amber-800">{q.data.blockers.join("；")}</p>
          {q.data.mode === "legacy" && (
            <p className="text-sm">
              历史任务保留原人工过程核对路径；启用逐家记录后不能退回旧路径。已有最后报价的任务不能倒补或改写依据。
            </p>
          )}
          {q.data.mode !== "active" && manage && (
            <ActivateForm
              w={q.data}
              proofs={proofs}
              disabled={busy}
              submit={(d) =>
                run(async () => {
                  await api(path + "/activate", "POST", d);
                  await q.refetch();
                })
              }
            />
          )}
          <div className="my-2 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>对象</th>
                  <th>已确认次数</th>
                  <th>待处理</th>
                </tr>
              </thead>
              <tbody>
                {q.data.progress.map((p) => (
                  <tr key={p.participationId}>
                    <td>{p.supplierName}</td>
                    <td>{p.confirmedCount}</td>
                    <td>
                      {p.hasDraft ? "有草稿；" : ""}
                      {p.changePending
                        ? "需求调整待有权确认"
                        : "无已确认的需求调整待办"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data.mode === "active" && (
            <>
              <select
                aria-label="沟通对象"
                disabled={editing || busy}
                className={input}
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">明确选择一个对象查看私有过程</option>
                {q.data.candidates.map((s) => (
                  <option key={s.participationId} value={s.participationId}>
                    {s.supplierName}
                  </option>
                ))}
              </select>
              {ledger.isError && (
                <FeedbackNotice
                  tone="error"
                  message="本对象沟通记录加载失败，请重试。"
                />
              )}
              {ledger.data && (
                <div
                  key={selected}
                  className="mt-3 space-y-3"
                  role="region"
                  aria-label={"逐家沟通 " + ledger.data.subject.supplierName}
                >
                  <p className="text-sm text-amber-800">
                    {ledger.data.blockers.join("；")}
                  </p>
                  {manage &&
                    (!ledger.data.blockers.length ||
                      editing ||
                      ledger.data.records.some(
                        (r) => r.status === "draft",
                      )) && (
                      <DraftForm
                        key={selected}
                        ledger={ledger.data}
                        staff={round.roster}
                        proofs={proofs}
                        disabled={busy || !!ledger.data.blockers.length}
                        onDirty={setEditing}
                        save={(d) =>
                          act(() =>
                            api(path + "/" + selected + "/draft", "PUT", d),
                          )
                        }
                      />
                    )}{" "}
                  {ledger.data.records.map((row) => (
                    <RecordCard
                      key={row.id}
                      row={row}
                      subject={ledger.data!.subject.supplierName}
                      proofs={proofs}
                      fingerprint={q.data!.fingerprint}
                      disabled={
                        busy || !manage || !!ledger.data!.blockers.length
                      }
                      confirm={(d) =>
                        act(() =>
                          api(
                            path + "/" + selected + "/" + row.id + "/confirm",
                            "POST",
                            d,
                          ),
                        )
                      }
                      voidDraft={(d) =>
                        act(() =>
                          api(
                            path + "/" + selected + "/" + row.id + "/void",
                            "POST",
                            d,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              )}
            </>
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
      <option value="">选择可共享的封存脱敏凭证</option>
      {proofs.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
function ActivateForm({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: DiscussionWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState(""),
    baseline = JSON.stringify([w.fingerprint, proof, reason]);
  return (
    <fieldset disabled={disabled} className="my-2 space-y-2 rounded border p-2">
      <legend>核对并启用逐家沟通范围</legend>
      <p className="text-xs">
        对象范围来自本轮已开放的评审阶段；不在此更改资格条件、评分标准或人员名单。
      </p>
      <ProofSelect
        label="逐家沟通启用凭证"
        value={proof}
        set={setProof}
        proofs={proofs}
      />
      <textarea
        aria-label="逐家沟通启用依据"
        className={input}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          checked={checked === baseline}
          onChange={(e) => setChecked(e.target.checked ? baseline : "")}
        />
        已核对逐家沟通适用方式、对象及依据
      </label>
      <button
        className={btn}
        disabled={
          !proof ||
          !reason.trim() ||
          !w.candidates.length ||
          checked !== baseline
        }
        onClick={() =>
          void submit({
            expectedVersion: w.plan?.version || 0,
            evidenceVersionId: proof,
            reason,
            reviewed: true,
            idempotencyKey: crypto.randomUUID(),
          })
        }
      >
        启用并锁定逐家沟通范围
      </button>
    </fieldset>
  );
}
function DraftForm({
  ledger,
  staff,
  proofs,
  disabled,
  onDirty,
  save,
}: {
  ledger: Ledger;
  staff: EvaluationView["roster"];
  proofs: Proof[];
  disabled: boolean;
  onDirty: (dirty: boolean) => void;
  save: (d: unknown) => Promise<boolean>;
}) {
  const current = ledger.records.find((r) => r.status === "draft"),
    [d, setD] = useState<Content>(blank),
    [bound, setBound] = useState({ id: null as string | null, version: 0 }),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState("");
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) {
      setD(
        current ? { ...blank(), ...JSON.parse(current.contentJson) } : blank(),
      );
      setBound({ id: current?.id || null, version: current?.version || 0 });
    }
  }, [current?.id, current?.version, dirty]);
  const edit = (key: keyof Content, value: Content[keyof Content]) => {
    setD({ ...d, [key]: value });
    setDirty(true);
    onDirty(true);
  };
  const conflict =
    bound.id !== (current?.id || null) ||
    bound.version !== (current?.version || 0);
  return (
    <details className="rounded border p-2">
      <summary>{current ? "续写本对象沟通草稿" : "追加本对象沟通草稿"}</summary>
      {dirty && (
        <div className="my-2 text-sm">
          <p>当前对象有未保存编辑，请先保存或明确放弃后切换对象。</p>
          <button
            className={btn}
            type="button"
            onClick={() => {
              setDirty(false);
              setReason("");
            }}
          >
            放弃未保存编辑并读取当前草稿
          </button>
        </div>
      )}
      {conflict && current && (
        <button
          className={btn}
          type="button"
          disabled={disabled}
          onClick={() => setBound({ id: current.id, version: current.version })}
        >
          已核对最新草稿，保留当前编辑继续保存
        </button>
      )}
      <fieldset disabled={disabled} className="mt-2 space-y-2">
        {conflict && (
          <p className="text-sm text-amber-800">
            本对象草稿版本已变化，编辑已保留；须重新核对后保存。
          </p>
        )}
        <label className="block text-sm">
          实际沟通开始
          <input
            aria-label="沟通开始时间"
            type="datetime-local"
            className={input}
            value={local(d.startedAt)}
            onChange={(e) => edit("startedAt", iso(e.target.value))}
          />
        </label>
        <label className="block text-sm">
          实际沟通结束
          <input
            aria-label="沟通结束时间"
            type="datetime-local"
            className={input}
            value={local(d.endedAt)}
            onChange={(e) => edit("endedAt", iso(e.target.value))}
          />
        </label>
        <div className="text-sm">
          实际参与的冻结工作人员
          {(staff || []).map((m) => (
            <label key={m.userId} className="block">
              <input
                type="checkbox"
                aria-label={"沟通工作人员 " + m.name}
                checked={!!d.staffUserIds?.includes(m.userId)}
                onChange={(e) =>
                  edit(
                    "staffUserIds",
                    e.target.checked
                      ? [...(d.staffUserIds || []), m.userId]
                      : (d.staffUserIds || []).filter((id) => id !== m.userId),
                  )
                }
              />
              {m.name}
            </label>
          ))}
        </div>
        {(
          [
            ["supplierAttendees", "供应商实际出席人员及身份来源"],
            ["agenda", "沟通议题"],
            ["discussion", "逐家沟通正文"],
            ["supplierResponse", "供应商回应"],
            ["conclusion", "本次沟通结论"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block text-sm">
            {label}
            <textarea
              aria-label={label}
              className={input}
              value={d[key] || ""}
              onChange={(e) => edit(key, e.target.value)}
            />
          </label>
        ))}
        <select
          aria-label="沟通需求调整标记"
          className={input}
          value={d.changeDisposition || ""}
          onChange={(e) => edit("changeDisposition", e.target.value)}
        >
          <option value="none">本次未涉及需求调整</option>
          <option value="requires_authorized_change">
            涉及需求调整，待有权确认及同步通知（阻断最后报价）
          </option>
        </select>
        <textarea
          aria-label="沟通需求调整事项"
          className={input}
          value={d.changeNote || ""}
          onChange={(e) => edit("changeNote", e.target.value)}
          placeholder="不得在沟通记录中直接批准变更"
        />
        <ProofSelect
          label="逐家沟通过程凭证"
          value={d.evidenceVersionId || ""}
          set={(v) => edit("evidenceVersionId", v)}
          proofs={proofs}
        />
        <textarea
          aria-label="沟通草稿维护说明"
          className={input}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setDirty(true);
          }}
        />
        <button
          className={btn}
          disabled={!reason.trim() || conflict}
          onClick={() =>
            void (async () => {
              if (
                await save({
                  recordId: bound.id,
                  expectedVersion: bound.version,
                  content: d,
                  reason,
                  idempotencyKey: crypto.randomUUID(),
                })
              )
                setDirty(false);
            })()
          }
        >
          保存本对象沟通草稿
        </button>
        <p className="text-xs">
          草稿允许未填完，确认时再检查完整性。沟通正文及回应仅在该对象私有过程内查看；凭证须脱敏。
        </p>
      </fieldset>
    </details>
  );
}
function RecordCard({
  row: r,
  subject,
  proofs,
  fingerprint,
  disabled,
  confirm,
  voidDraft,
}: {
  row: Row;
  subject: string;
  proofs: Proof[];
  fingerprint: string;
  disabled: boolean;
  confirm: (d: unknown) => Promise<boolean>;
  voidDraft: (d: unknown) => Promise<boolean>;
}) {
  const d = JSON.parse(r.contentJson) as Content,
    [proof, setProof] = useState(""),
    [note, setNote] = useState(""),
    [checked, setChecked] = useState(""),
    [voidReason, setVoidReason] = useState("");
  const baseline = JSON.stringify([
    r.id,
    r.version,
    r.previousId,
    fingerprint,
    proof,
    note,
  ]);
  const frozen = r.frozenJson
    ? (JSON.parse(r.frozenJson) as {
        staff: { userId: string; name: string }[];
        supplierConfirmationNote: string;
      })
    : null;
  return (
    <article
      aria-label={subject + " 第" + r.ordinal + "次沟通记录"}
      className="rounded border p-2"
    >
      <details>
        <summary className="font-medium">
          第{r.ordinal}次 ·{" "}
          {r.status === "confirmed"
            ? "已确认锁定"
            : r.status === "void"
              ? "草稿已作废"
              : "未确认草稿"}{" "}
          · 版本{r.version}
        </summary>
        <p className="text-xs">
          实际沟通{" "}
          {d.startedAt ? new Date(d.startedAt).toLocaleString() : "待填"} 至{" "}
          {d.endedAt ? new Date(d.endedAt).toLocaleString() : "待填"}；登记{" "}
          {new Date(r.createdAt).toLocaleString()}
        </p>
        <p className="text-sm">
          工作人员：
          {frozen
            ? frozen.staff.map((m) => m.name).join("、")
            : (d.staffUserIds || []).join("、")}
        </p>
        <p className="text-sm">供应商出席：{d.supplierAttendees || "待填"}</p>
        <p className="text-sm">议题：{d.agenda || "待填"}</p>
        <p className="whitespace-pre-wrap text-sm">
          过程：{d.discussion || "待填"}
        </p>
        <p className="whitespace-pre-wrap text-sm">
          回应：{d.supplierResponse || "待填"}
        </p>
        <p className="whitespace-pre-wrap text-sm">
          结论：{d.conclusion || "待填"}
        </p>
        {d.changeDisposition === "requires_authorized_change" && (
          <p className="text-sm text-amber-800">
            需求调整待有权确认：{d.changeNote}
            ；不得通过追加无调整记录或排除对象绕过。
          </p>
        )}
        {frozen && (
          <p className="text-sm">
            线下确认情况：{frozen.supplierConfirmationNote}
          </p>
        )}
        {r.frozenHash && (
          <p className="break-all text-xs">冻结SHA256 {r.frozenHash}</p>
        )}
        {r.voidReason && <p className="text-sm">作废原因：{r.voidReason}</p>}
      </details>
      {r.status === "draft" && (
        <fieldset disabled={disabled} className="mt-2 space-y-2">
          <ProofSelect
            label={"第" + r.ordinal + "次沟通线下确认凭证"}
            value={proof}
            set={setProof}
            proofs={proofs}
          />
          <textarea
            aria-label={"第" + r.ordinal + "次沟通线下确认情况"}
            className={input}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="记录线下确认、签认情况和材料来源，不代表在线身份或电子签署"
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === baseline}
              onChange={(e) => setChecked(e.target.checked ? baseline : "")}
            />
            已核对本对象第{r.ordinal}次实际沟通及线下确认凭证
          </label>
          <button
            className={btn}
            disabled={!proof || !note.trim() || checked !== baseline}
            onClick={() =>
              void confirm({
                expectedVersion: r.version,
                expectedPreviousId: r.previousId,
                supplierConfirmationVersionId: proof,
                supplierConfirmationNote: note,
                reviewed: true,
                expectedFingerprint: fingerprint,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            确认本次沟通并锁定
          </button>
          <input
            aria-label={"第" + r.ordinal + "次沟通草稿作废原因"}
            className={input}
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
          <button
            className={btn}
            disabled={!voidReason.trim()}
            onClick={() =>
              void voidDraft({
                expectedVersion: r.version,
                reason: voidReason,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            作废本次草稿并保留原内容
          </button>
        </fieldset>
      )}
    </article>
  );
}
