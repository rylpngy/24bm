import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type AssessmentSession,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Change = {
  id: string;
  ordinal: number;
  status: string;
  version: number;
  snapshotJson: string;
  frozenHash: string;
  completionHash: string | null;
};
type Receipt = {
  id: string;
  changeId: string;
  participationId: string;
  ordinal: number;
  snapshotJson: string;
  frozenHash: string;
};
export type ChangeWorkspace = {
  fingerprint: string;
  changes: Change[];
  receipts: Receipt[];
  pendingSources: {
    recordId: string;
    participationId: string;
    ordinal: number;
    frozenHash: string;
  }[];
  subjects: { participationId: string; supplierName: string }[];
  blockers: string[];
};
type Proof = { id: string; name: string };
type Run = (fn: () => Promise<unknown>) => Promise<boolean>;
const iso = (s: string) => (s ? new Date(s).toISOString() : null);
function Evidence({
  label,
  value,
  onChange,
  proofs,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  proofs: Proof[];
}) {
  return (
    <label className="block text-sm">
      {label}
      <select
        aria-label={label}
        className={input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">选择已封存脱敏版本</option>
        {proofs.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function AgencyRequirementChangePanel({
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
  const [open, setOpen] = useState(false),
    { can } = useBuyerPermissions(),
    client = useQueryClient(),
    path = `/packages/${detail.record.id}/sessions/${session.id}/requirement-changes`;
  const q = useQuery({
    queryKey: ["agency-requirement-changes", session.id],
    queryFn: () => api<ChangeWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const proofs = detail.files
    .filter((v) => v.file.visibility === "project")
    .flatMap((v) =>
      v.versions
        .filter((r) => r.status === "sealed")
        .map((r) => ({ id: r.id, name: v.file.name + " V" + r.ordinal })),
    );
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
      await client.invalidateQueries({
        queryKey: ["agency-discussions", session.id],
      });
      await client.invalidateQueries({
        queryKey: ["agency-final-quotes", session.id],
      });
    });
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        授权需求变更与同步通知凭证
      </summary>
      <p className="my-2 text-xs">
        登记采购人或其授权代表的外部确认，以及同一共同通知的逐家线下送达凭证。登记人不替代有权主体决定；本系统不自动发送通知。资格条件、评分标准不通过此入口修改。
      </p>
      {q.isError && (
        <>
          <FeedbackNotice tone="error" message="授权变更工作区加载失败" />
          <button className={btn} onClick={() => void q.refetch()}>
            重试授权变更工作区
          </button>
        </>
      )}
      {q.data && (
        <>
          <p className="text-sm text-amber-800">{q.data.blockers.join("；")}</p>
          <p className="my-2 text-sm">
            待处理来源：{q.data.pendingSources.length}
            条。通知范围为全部冻结参与者，不能排除对象绕过。
          </p>
          <ul className="text-sm">
            {q.data.subjects.map((v) => (
              <li key={v.participationId}>{v.supplierName}</li>
            ))}
          </ul>
          {can("buyer:agency:evaluation:change:register") &&
            q.data.pendingSources.length > 0 &&
            !q.data.changes.some((v) => v.status === "authorized") && (
              <CreateForm
                w={q.data}
                proofs={proofs}
                disabled={busy || q.data.blockers.length > 0}
                submit={(d) => act(() => api(path, "POST", d))}
              />
            )}
          {q.data.changes.map((r) => (
            <ChangeCard
              key={r.id}
              row={r}
              w={q.data!}
              proofs={proofs}
              disabled={
                busy ||
                q.data!.blockers.length > 0 ||
                !can("buyer:agency:evaluation:change:register")
              }
              submit={(action, d) =>
                act(() => api(path + "/" + r.id + "/" + action, "POST", d))
              }
            />
          ))}
        </>
      )}
    </details>
  );
}
function CreateForm({
  w,
  proofs,
  disabled,
  submit,
}: {
  w: ChangeWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [d, setD] = useState({
      kind: "technical",
      locator: "",
      beforeText: "",
      afterText: "",
      authorityName: "",
      authorityRole: "",
      authorityScope: "",
      authorizationVersionId: "",
      authorizedAt: "",
      requirementsVersionId: "",
      noticeVersionId: "",
      sentAt: "",
      channel: "",
      responseDeadlineAt: "",
      reason: "",
    }),
    [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(false), [w.fingerprint, d]);
  const field = (key: keyof typeof d, label: string, time = false) => (
    <label className="block text-sm" key={key}>
      {label}
      {key === "beforeText" || key === "afterText" ? (
        <textarea
          aria-label={label}
          rows={3}
          className={input}
          value={d[key]}
          onChange={(e) => setD({ ...d, [key]: e.target.value })}
        />
      ) : (
        <input
          aria-label={label}
          className={input}
          type={time ? "datetime-local" : "text"}
          value={d[key]}
          onChange={(e) => setD({ ...d, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2 rounded border p-3">
      <legend>登记外部授权及统一通知批次</legend>
      <label className="block text-sm">
        允许调整类型
        <select
          aria-label="允许调整类型"
          className={input}
          value={d.kind}
          onChange={(e) => setD({ ...d, kind: e.target.value })}
        >
          <option value="technical">技术要求</option>
          <option value="service">服务要求</option>
          <option value="contract">合同条款</option>
        </select>
      </label>
      {field("locator", "原文条款定位")}
      {field("beforeText", "变更前共同内容")}
      {field("afterText", "变更后共同内容")}
      {field("authorityName", "外部有权确认人")}
      {field("authorityRole", "确认人身份")}
      {field("authorityScope", "授权范围及来源")}
      <Evidence
        label="外部有权确认凭证"
        value={d.authorizationVersionId}
        onChange={(s) => setD({ ...d, authorizationVersionId: s })}
        proofs={proofs}
      />
      {field("authorizedAt", "外部实际确认时间", true)}
      <Evidence
        label="共同最终需求版本"
        value={d.requirementsVersionId}
        onChange={(s) => setD({ ...d, requirementsVersionId: s })}
        proofs={proofs}
      />
      <Evidence
        label="共同变更通知版本"
        value={d.noticeVersionId}
        onChange={(s) => setD({ ...d, noticeVersionId: s })}
        proofs={proofs}
      />
      {field("sentAt", "同一批次实际通知时间", true)}
      {field("channel", "统一线下通知方式")}
      {field("responseDeadlineAt", "核定响应准备截止", true)}
      {field("reason", "授权及通知登记依据")}
      <p className="text-xs">
        共同内容不得带入其他供应商的私有沟通。确认后冻结授权依据、全部对象及同一通知；填错不能直接覆盖，应暂停并按异常程序处理。
      </p>
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
        />
        已核对外部授权及允许范围、共同内容脱敏和响应准备时间，未修改资格条件或评分标准
      </label>
      <button
        className={btn}
        disabled={disabled || !reviewed}
        onClick={() =>
          void submit({
            ...d,
            authorizedAt: iso(d.authorizedAt),
            sentAt: iso(d.sentAt),
            responseDeadlineAt: iso(d.responseDeadlineAt),
            expectedFingerprint: w.fingerprint,
            limitsReviewed: reviewed,
            publicContentReviewed: reviewed,
            adequateTimeReviewed: reviewed,
            idempotencyKey: crypto.randomUUID(),
          })
        }
      >
        确认登记授权变更
      </button>
    </fieldset>
  );
}
function ChangeCard({
  row,
  w,
  proofs,
  disabled,
  submit,
}: {
  row: Change;
  w: ChangeWorkspace;
  proofs: Proof[];
  disabled: boolean;
  submit: (action: string, d: unknown) => Promise<boolean>;
}) {
  const snap = JSON.parse(row.snapshotJson),
    content = snap.content,
    receipts = w.receipts.filter((v) => v.changeId === row.id),
    latest = new Map<string, Receipt>();
  for (const v of receipts)
    if (
      !latest.has(v.participationId) ||
      latest.get(v.participationId)!.ordinal < v.ordinal
    )
      latest.set(v.participationId, v);
  const [selected, setSelected] = useState(""),
    [editing, setEditing] = useState(false),
    [completeProof, setCompleteProof] = useState(""),
    [note, setNote] = useState(""),
    [reviewed, setReviewed] = useState(false);
  useEffect(() => setReviewed(false), [w.fingerprint, completeProof, note]);
  return (
    <article className="my-3 space-y-2 rounded border p-3">
      <h5 className="font-semibold">
        第{row.ordinal}项授权变更 ·{" "}
        {row.status === "notified"
          ? "全部通知已复核锁定"
          : "待逐家核对通知送达"}
      </h5>
      <p className="text-sm">
        条款：{content.locator}；变更前：{content.beforeText}；变更后：
        {content.afterText}
      </p>
      <p className="text-sm">
        外部确认人：{content.authorityName}（{content.authorityRole}
        ）；授权来源：{content.authorityScope}
      </p>
      <p className="break-all text-xs">
        授权SHA256 {snap.evidenceHashes.authorization}；共同需求版本{" "}
        {content.requirementsVersionId}；需求SHA256{" "}
        {snap.evidenceHashes.requirements}；共同通知SHA256{" "}
        {snap.evidenceHashes.notice}
      </p>
      <p className="text-sm">
        线下通知：{content.channel}，{content.sentAt}；核定响应准备截止：
        {content.responseDeadlineAt}
      </p>
      <p className="break-all text-xs">
        冻结SHA256 {row.frozenHash}
        {row.completionHash && <>；通知完成SHA256 {row.completionHash}</>}
      </p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th>冻结通知对象</th>
            <th>送达凭证</th>
          </tr>
        </thead>
        <tbody>
          {snap.subjects.map(
            (s: { participationId: string; supplierName: string }) => (
              <tr key={s.participationId}>
                <td>{s.supplierName}</td>
                <td>
                  {latest.has(s.participationId)
                    ? "已登记，保留" +
                      receipts.filter(
                        (v) => v.participationId === s.participationId,
                      ).length +
                      "版"
                    : "待登记"}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {receipts.map((v) => {
        const s = JSON.parse(v.snapshotJson);
        return (
          <details key={v.id} className="text-sm">
            <summary>
              {s.supplierName}第{v.ordinal}版送达凭证
              {latest.get(v.participationId)?.id === v.id
                ? "（当前）"
                : "（历史保留）"}
            </summary>
            <p>
              接收人：{s.content.recipient}；实际接收：{s.content.receivedAt}
              ；核对：{s.content.note}；更正依据：
              {s.content.replacementReason || "无"}
            </p>
            <p className="break-all text-xs">
              凭证SHA256 {s.evidenceHash}；登记SHA256 {v.frozenHash}
            </p>
          </details>
        );
      })}
      {row.status === "authorized" && (
        <>
          <label className="block text-sm">
            通知送达对象
            <select
              aria-label="通知送达对象"
              className={input}
              disabled={disabled || editing}
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              <option value="">选择对象</option>
              {snap.subjects.map(
                (s: { participationId: string; supplierName: string }) => (
                  <option key={s.participationId} value={s.participationId}>
                    {s.supplierName}
                  </option>
                ),
              )}
            </select>
          </label>
          {editing && (
            <button
              className={btn}
              disabled={disabled}
              onClick={() => {
                setSelected("");
                setEditing(false);
              }}
            >
              放弃本对象未保存的送达凭证
            </button>
          )}
          {selected && (
            <ReceiptForm
              key={row.id + selected}
              participationId={selected}
              onDirty={setEditing}
              previous={latest.get(selected)}
              fingerprint={w.fingerprint}
              proofs={proofs}
              disabled={disabled}
              submit={(d) => submit("receipts", d)}
            />
          )}
          <fieldset
            disabled={disabled}
            className="space-y-2 rounded border p-2"
          >
            <legend>全部通知统一复核</legend>
            <Evidence
              label="通知统一复核凭证"
              value={completeProof}
              onChange={setCompleteProof}
              proofs={proofs}
            />
            <label className="block text-sm">
              通知统一复核说明
              <input
                aria-label="通知统一复核说明"
                className={input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              已核对全部冻结对象均收到同一共同通知及需求版本
            </label>
            <button
              className={btn}
              disabled={
                disabled || !reviewed || latest.size !== snap.subjects.length
              }
              onClick={() =>
                void submit("complete", {
                  expectedFingerprint: w.fingerprint,
                  reviewed,
                  evidenceVersionId: completeProof,
                  note,
                  idempotencyKey: crypto.randomUUID(),
                })
              }
            >
              锁定全部通知复核
            </button>
          </fieldset>
        </>
      )}
    </article>
  );
}
function ReceiptForm({
  participationId,
  onDirty,
  previous,
  fingerprint,
  proofs,
  disabled,
  submit,
}: {
  participationId: string;
  onDirty: (dirty: boolean) => void;
  previous: Receipt | undefined;
  fingerprint: string;
  proofs: Proof[];
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const [d, setD] = useState({
      receivedAt: "",
      recipient: "",
      evidenceVersionId: "",
      note: "",
      replacementReason: "",
    }),
    [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [fingerprint, previous?.id, d]);
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded border p-2">
      <legend>
        {previous ? "追加更正通知凭证（保留旧版）" : "登记本对象通知送达"}
      </legend>
      {(
        [
          ["recipient", "实际接收人及身份来源"],
          ["receivedAt", "实际接收通知时间"],
          ["note", "本对象送达核对说明"],
          ...(previous ? [["replacementReason", "通知凭证更正依据"]] : []),
        ] as [keyof typeof d, string][]
      ).map(([key, label]) => (
        <label key={key} className="block text-sm">
          {label}
          <input
            aria-label={label}
            className={input}
            type={key === "receivedAt" ? "datetime-local" : "text"}
            value={d[key]}
            onChange={(e) => {
              setD({ ...d, [key]: e.target.value });
              onDirty(true);
            }}
          />
        </label>
      ))}
      <Evidence
        label="本对象通知送达凭证"
        value={d.evidenceVersionId}
        onChange={(s) => {
          setD({ ...d, evidenceVersionId: s });
          onDirty(true);
        }}
        proofs={proofs}
      />
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        已核对本对象收到同一冻结通知内容及共同需求
      </label>
      <button
        className={btn}
        disabled={disabled || !checked}
        onClick={() =>
          void submit({
            ...d,
            receivedAt: iso(d.receivedAt),
            participationId,
            expectedPreviousId: previous?.id || null,
            expectedFingerprint: fingerprint,
            contentChecked: checked,
            idempotencyKey: crypto.randomUUID(),
          }).then((ok) => {
            if (ok) {
              onDirty(false);
              setChecked(false);
              setD({
                receivedAt: "",
                recipient: "",
                evidenceVersionId: "",
                note: "",
                replacementReason: "",
              });
            }
          })
        }
      >
        保存本对象送达凭证
      </button>
    </fieldset>
  );
}
