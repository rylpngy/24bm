import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type EvaluationView,
  type AssessmentOverview,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { useAuthStore } from "../../lib/auth-store";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Row = {
  id: string;
  kind: string;
  ordinal: number;
  frozenHash: string;
  snapshotJson: string;
};
type W = {
  method: string;
  history: Row[];
  legacyKinds: string[];
  participants: { id: string; supplierName: string }[];
  subjects: { participationId: string; supplierName: string }[];
  blockers: string[];
};
type F = {
  key: string;
  label: string;
  type?: "time" | "proof" | "amount" | "long" | "select";
  options?: [string, string][];
};
const iso = (s: unknown) => (s ? new Date(String(s)).toISOString() : null);
export function AgencyMethodProcedurePanel({
  detail,
  round,
  busy,
  run,
}: {
  detail: AgencyDetail;
  round: EvaluationView;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false),
    { can } = useBuyerPermissions(),
    actor = useAuthStore((s) => s.session?.userId),
    base = `/packages/${detail.record.id}`,
    path = `${base}/rounds/${round.round.id}/procedures`;
  const q = useQuery({
    queryKey: ["agency-method-procedures", round.round.id],
    queryFn: () => api<W>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const sessions = useQuery({
    queryKey: ["agency-procedure-sessions", round.round.id],
    queryFn: () =>
      api<AssessmentOverview>(base + `/rounds/${round.round.id}/assessment`),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const [feedback, setFeedback] = useState("");
  const proofs = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
    );
  const writable =
    can("buyer:agency:procedure:manage") &&
    round.config.members.some(
      (m) =>
        m.userId === actor &&
        m.roles.some((r) => r === "organizer" || r === "leader"),
    );
  const act = (url: string, body: unknown) =>
    run(async () => {
      await api(url, "POST", body);
      await q.refetch();
      setFeedback("已记录实际程序及凭证，未自动认定资格或成交。");
    });
  const session = sessions.data?.sessions[0],
    history = q.data?.history || [],
    latest = (kind: string) => history.find((r) => r.kind === kind);
  if (
    !can("buyer:agency:procedure:read") ||
    !["邀请招标", "询价", "单一来源"].includes(
      detail.record.procurementMethod || "",
    )
  )
    return null;
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="font-semibold">
        {detail.record.procurementMethod}专有程序与凭证
      </summary>
      <p className="my-2 text-xs">
        记录实际名单形成、核验、送达或专业协商。系统不替代有权主体决定，不自动抽取供应商或发送通知。原始报价、更正与政策评审价分层保留。
      </p>
      {feedback && <FeedbackNotice tone="info" message={feedback} />}{" "}
      {(q.isError || sessions.isError) && (
        <>
          <FeedbackNotice tone="error" message="专有程序加载失败" />
          <button
            className={btn}
            onClick={() => {
              void q.refetch();
              void sessions.refetch();
            }}
          >
            重试专有程序
          </button>
        </>
      )}
      {q.data && (
        <>
          <p className="text-sm text-amber-800">{q.data.blockers.join("；")}</p>
          {q.data.legacyKinds.length > 0 && (
            <p className="text-xs">
              历史线下依据路径：
              {q.data.legacyKinds
                .map(
                  (k) =>
                    (
                      ({
                        invitation: "邀请依据",
                        inquiry: "一次报价有效性",
                        single_basis: "单一来源适用依据",
                      }) as Record<string, string>
                    )[k] || "历史专有程序",
                )
                .join("、")}
              。不补造已完成程序。
            </p>
          )}
          {writable && (
            <>
              {q.data.method === "邀请招标" && (
                <ProcedureForm
                  title="邀请名单形成与逐家送达"
                  fields={[
                    {
                      key: "selectionMode",
                      label: "名单形成方式",
                      type: "select",
                      options: [
                        ["documented_selection", "按有据程序形成"],
                        ["external_lottery", "已完成的外部抽取"],
                      ],
                    },
                    {
                      key: "formedAt",
                      label: "名单实际形成时间",
                      type: "time",
                    },
                    {
                      key: "formationBasis",
                      label: "名单来源、形成与适用选择依据",
                      type: "long",
                    },
                  ]}
                  participants={q.data.participants}
                  rowFields={[
                    { key: "sourceNote", label: "名单来源" },
                    {
                      key: "verificationMode",
                      label: "核验适用类型",
                      type: "select",
                      options: [
                        ["qualification_check", "资格核验"],
                        ["prequalification", "资格预审（须有适用依据）"],
                        ["not_applicable", "不适用（须说明依据）"],
                      ],
                    },
                    {
                      key: "verificationBasis",
                      label: "核验适用依据及实际结果",
                      type: "long",
                    },
                    { key: "selectionBasis", label: "本对象形成及邀请依据" },
                    { key: "sentAt", label: "实际邀请时间", type: "time" },
                    { key: "receivedAt", label: "实际接收时间", type: "time" },
                    {
                      key: "deliveryStatus",
                      label: "送达实际处置",
                      type: "select",
                      options: [
                        ["received", "已送达"],
                        ["declined", "明确拒绝"],
                        ["unreachable", "未能送达"],
                      ],
                    },
                    { key: "recipient", label: "接收人及身份来源" },
                    {
                      key: "evidenceVersionId",
                      label: "本对象送达凭证",
                      type: "proof",
                    },
                  ]}
                  rowKey="participants"
                  proofLabel="名单形成及审批来源凭证"
                  proofs={proofs}
                  previous={latest("invitation")}
                  disabled={busy || q.data.blockers.length > 0 || !!session}
                  submit={(d) => act(path + "/invitation", d)}
                />
              )}
              {q.data.method === "单一来源" && (
                <ProcedureForm
                  title="单一来源适用、论证审批及公示依据"
                  fields={[
                    {
                      key: "grounds",
                      label: "适用理由与实际论证依据",
                      type: "long",
                    },
                    {
                      key: "approvalApplicability",
                      label: "论证审批适用性",
                      type: "select",
                      options: [
                        ["required", "适用，已取得实际凭证"],
                        ["not_applicable", "不适用，须说明依据"],
                      ],
                    },
                    {
                      key: "approvalNote",
                      label: "论证审批适用及办理说明",
                      type: "long",
                    },
                    {
                      key: "approvalVersionId",
                      label: "论证审批凭证",
                      type: "proof",
                    },
                    {
                      key: "publicationApplicability",
                      label: "公示适用性",
                      type: "select",
                      options: [
                        ["required", "适用，已取得实际凭证"],
                        ["not_applicable", "不适用，须说明依据"],
                      ],
                    },
                    {
                      key: "publicationNote",
                      label: "公示适用及办理说明",
                      type: "long",
                    },
                    {
                      key: "publicationVersionId",
                      label: "实际公示凭证",
                      type: "proof",
                    },
                  ]}
                  proofs={proofs}
                  proofLabel="适用理由及论证来源凭证"
                  previous={latest("single_basis")}
                  disabled={busy || q.data.blockers.length > 0 || !!session}
                  submit={(d) => act(path + "/single-basis", d)}
                />
              )}
              {q.data.method === "询价" &&
                (session ? (
                  <InquiryForm
                    detail={detail}
                    sessionId={session.id}
                    base={base}
                    subjects={q.data.subjects}
                    proofs={proofs}
                    previous={latest("inquiry")}
                    disabled={busy || q.data.blockers.length > 0}
                    submit={(d) =>
                      act(
                        base + `/sessions/${session.id}/procedures/inquiry`,
                        d,
                      )
                    }
                  />
                ) : (
                  <p className="text-sm">
                    完成材料正式开启及本轮任务后，逐家核对一次报价有效性。此入口不登记二次竞价。
                  </p>
                ))}
              {q.data.method === "单一来源" &&
                (session ? (
                  <ProcedureForm
                    title="专业人员实际协商结果"
                    fields={[
                      {
                        key: "participationId",
                        label: "唯一协商供应商",
                        type: "select",
                        options: q.data.participants.map((v) => [
                          v.id,
                          v.supplierName,
                        ]),
                      },
                      { key: "beganAt", label: "实际协商开始", type: "time" },
                      { key: "endedAt", label: "实际协商结束", type: "time" },
                      {
                        key: "priceReasonability",
                        label: "价格合理性依据及分析",
                        type: "long",
                      },
                      {
                        key: "qualityAssurance",
                        label: "质量保障及履行承诺",
                        type: "long",
                      },
                      {
                        key: "agreedAmount",
                        label: "实际协商金额",
                        type: "amount",
                      },
                      {
                        key: "supplierConfirmationNote",
                        label: "供应商线下确认来源",
                        type: "long",
                      },
                    ]}
                    people={round.roster
                      .filter(
                        (v) =>
                          v.roles.includes("review_member") ||
                          v.roles.includes("purchaser_rep"),
                      )
                      .map((v) => ({ id: v.userId, name: v.name }))}
                    market
                    proofs={proofs}
                    proofLabel="实际协商及线下确认凭证"
                    previous={latest("single_negotiation")}
                    disabled={busy || q.data.blockers.length > 0}
                    submit={(d) =>
                      act(
                        base + `/sessions/${session.id}/procedures/negotiation`,
                        {
                          ...(d as Record<string, unknown>),
                          currency: detail.record.currency,
                        },
                      )
                    }
                  />
                ) : (
                  <p className="text-sm">
                    先登记适用依据并完成实际材料开启，再记录专业协商；不强制三家或生成竞争排名。
                  </p>
                ))}
            </>
          )}
          <details>
            <summary className="text-sm">
              不可变程序历史（{history.length}版）
            </summary>
            {history.map((r) => {
              const s = JSON.parse(r.snapshotJson);
              return (
                <details key={r.id} className="my-2 rounded border p-2 text-xs">
                  <summary>
                    {
                      (
                        {
                          invitation: "邀请程序",
                          inquiry: "一次报价有效性",
                          single_basis: "单一来源适用依据",
                          single_negotiation: "专业协商结果",
                        } as Record<string, string>
                      )[r.kind]
                    }{" "}
                    · 第{r.ordinal}版 · SHA256 {r.frozenHash}
                  </summary>
                  <BusinessFacts
                    value={s.content}
                    participants={q.data!.participants}
                    people={round.roster}
                    proofs={proofs}
                  />
                  <p className="break-all">
                    材料SHA256：{JSON.stringify(s.evidenceHashes)}
                  </p>
                </details>
              );
            })}
          </details>
        </>
      )}
    </details>
  );
}
type Proof = { id: string; name: string };
function Fields({
  fields,
  data,
  set,
  proofs,
  prefix = "",
}: {
  fields: F[];
  data: Record<string, string>;
  set: (k: string, v: string) => void;
  proofs: Proof[];
  prefix?: string;
}) {
  return (
    <>
      {fields.map((f) => (
        <label key={f.key} className="block text-sm">
          {f.label}
          {f.type === "proof" || f.type === "select" ? (
            <select
              aria-label={prefix + f.label}
              className={input}
              value={data[f.key] || ""}
              onChange={(e) => set(f.key, e.target.value)}
            >
              <option value="">请选择</option>
              {(f.type === "proof"
                ? proofs.map((p) => [p.id, p.name])
                : f.options || []
              ).map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          ) : f.type === "long" ? (
            <textarea
              aria-label={prefix + f.label}
              className={input}
              rows={3}
              value={data[f.key] || ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          ) : (
            <input
              aria-label={prefix + f.label}
              className={input}
              type={f.type === "time" ? "datetime-local" : "text"}
              value={data[f.key] || ""}
              onChange={(e) => set(f.key, e.target.value)}
            />
          )}
        </label>
      ))}
    </>
  );
}
function ProcedureForm({
  title,
  fields,
  participants,
  rowFields = [],
  rowKey,
  proofs,
  proofLabel,
  previous,
  disabled,
  submit,
  people,
  market,
}: {
  title: string;
  fields: F[];
  participants?: { id: string; supplierName: string }[];
  rowFields?: F[];
  rowKey?: string;
  proofs: Proof[];
  proofLabel?: string;
  previous?: Row;
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
  people?: { id: string; name: string }[];
  market?: boolean;
}) {
  const [data, setData] = useState<Record<string, string>>({}),
    [rows, setRows] = useState<Record<string, Record<string, string>>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [staff, setStaff] = useState<string[]>([]),
    [sources, setSources] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [proof, setProof] = useState(""),
    [checked, setChecked] = useState("");
  const basis = JSON.stringify([
    data,
    rows,
    selected,
    staff,
    sources,
    reason,
    proof,
    previous?.frozenHash,
  ]);
  const convert = (d: Record<string, string>, fs: F[]) =>
    Object.fromEntries(
      Object.entries(d).map(([k, v]) => [
        k,
        fs.find((f) => f.key === k)?.type === "time" ? iso(v) : v || null,
      ]),
    );
  return (
    <fieldset disabled={disabled} className="my-3 space-y-3 rounded border p-3">
      <legend className="font-semibold">{title}</legend>
      <Fields
        fields={fields}
        data={data}
        set={(k, v) => setData({ ...data, [k]: v })}
        proofs={proofs}
      />
      {participants?.map((p) => (
        <section key={p.id} className="rounded border p-2">
          <label className="text-sm">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...selected, p.id]
                    : selected.filter((v) => v !== p.id),
                )
              }
            />{" "}
            {p.supplierName}
          </label>
          {selected.includes(p.id) && (
            <Fields
              fields={rowFields}
              data={rows[p.id] || {}}
              set={(k, v) =>
                setRows({ ...rows, [p.id]: { ...rows[p.id], [k]: v } })
              }
              proofs={proofs}
              prefix={p.supplierName + " "}
            />
          )}
        </section>
      ))}
      {people && (
        <div>
          <p className="text-sm">实际承担专业职责的人员</p>
          {people.map((p) => (
            <label key={p.id} className="mr-3 text-sm">
              <input
                type="checkbox"
                checked={staff.includes(p.id)}
                onChange={(e) =>
                  setStaff(
                    e.target.checked
                      ? [...staff, p.id]
                      : staff.filter((v) => v !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
      {market && (
        <div>
          <p className="text-sm">实际价格合理性资料（不预设三家竞争比价）</p>
          {proofs.map((p) => (
            <label key={p.id} className="block text-sm">
              <input
                type="checkbox"
                checked={sources.includes(p.id)}
                onChange={(e) =>
                  setSources(
                    e.target.checked
                      ? [...sources, p.id]
                      : sources.filter((v) => v !== p.id),
                  )
                }
              />
              {p.name}
            </label>
          ))}
        </div>
      )}
      {proofLabel && (
        <Fields
          fields={[
            { key: "evidenceVersionId", label: proofLabel, type: "proof" },
          ]}
          data={{ evidenceVersionId: proof }}
          set={(_, v) => setProof(v)}
          proofs={proofs}
        />
      )}
      <label className="block text-sm">
        本次登记与修订依据
        <textarea
          aria-label={title + "登记依据"}
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
        已核对适用依据、实际程序及精确凭证；此登记不替代有权决定
      </label>
      <button
        className={btn}
        disabled={disabled || checked !== basis || !reason.trim()}
        onClick={() =>
          void submit({
            ...convert(data, fields),
            ...(rowKey
              ? {
                  [rowKey]: selected.map((id) => ({
                    participationId: id,
                    ...convert(rows[id] || {}, rowFields),
                  })),
                }
              : {}),
            ...(people ? { staffUserIds: staff } : {}),
            ...(market ? { marketSourceVersionIds: sources } : {}),
            ...(proofLabel ? { evidenceVersionId: proof } : {}),
            expectedPreviousHash: previous?.frozenHash || null,
            reviewed: true,
            reason,
            idempotencyKey: crypto.randomUUID(),
          }).then((ok) => {
            if (ok) setChecked("");
          })
        }
      >
        确认记录{title}
      </button>
    </fieldset>
  );
}
function InquiryForm({
  sessionId,
  base,
  subjects,
  proofs,
  previous,
  disabled,
  submit,
}: {
  detail: AgencyDetail;
  sessionId: string;
  base: string;
  subjects: { participationId: string; supplierName: string }[];
  proofs: Proof[];
  previous?: Row;
  disabled: boolean;
  submit: (d: unknown) => Promise<boolean>;
}) {
  const q = useQuery({
    queryKey: ["agency-inquiry-quotes", sessionId],
    queryFn: () =>
      api<{ id: string; participationId: string }[]>(
        base + `/sessions/${sessionId}/quotes`,
      ),
    refetchInterval: 5000,
  });
  const [checks, setChecks] = useState<Record<string, Record<string, string>>>(
      {},
    ),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const quotes = q.data || [],
    basis = JSON.stringify([
      checks,
      reason,
      previous?.frozenHash,
      quotes,
      subjects,
    ]);
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2 rounded border p-3">
      <legend>逐家一次报价有效性核对</legend>
      {!subjects.length && (
        <p className="text-sm">尚无完整的正式开启对象范围，不能提交。</p>
      )}
      {q.isError && (
        <button className={btn} onClick={() => void q.refetch()}>
          重试一次报价来源
        </button>
      )}
      {subjects.map((s) => (
        <section key={s.participationId} className="rounded border p-2">
          <p>{s.supplierName}</p>
          <Fields
            fields={[
              {
                key: "status",
                label: "一次报价有效性",
                type: "select",
                options: [
                  ["valid", "有效"],
                  ["invalid", "无效（须有处理依据）"],
                  ["missing", "缺失"],
                  ["pending", "待处置"],
                ],
              },
              { key: "responseLocator", label: "原响应及一次报价位置" },
              {
                key: "handlingBasis",
                label: "有效性与异常处理依据",
                type: "long",
              },
              {
                key: "evidenceVersionId",
                label: "逐家核对凭证",
                type: "proof",
              },
            ]}
            data={checks[s.participationId] || {}}
            set={(k, v) =>
              setChecks({
                ...checks,
                [s.participationId]: { ...checks[s.participationId], [k]: v },
              })
            }
            proofs={proofs}
            prefix={s.supplierName + " "}
          />
        </section>
      ))}
      <textarea
        aria-label="一次报价登记依据"
        className={input}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <label className="block text-sm">
        <input
          type="checkbox"
          checked={checked === basis}
          onChange={(e) => setChecked(e.target.checked ? basis : "")}
        />
        已逐家核对一次报价、原始金额和适用修正依据，未进行普通议价或二次竞价
      </label>
      <button
        className={btn}
        disabled={
          disabled ||
          q.isError ||
          !subjects.length ||
          checked !== basis ||
          !reason.trim()
        }
        onClick={() =>
          void submit({
            expectedPreviousHash: previous?.frozenHash || null,
            offers: subjects.map((s) => ({
              participationId: s.participationId,
              quoteLayerId:
                quotes.find((v) => v.participationId === s.participationId)
                  ?.id || null,
              ...checks[s.participationId],
            })),
            oneOfferChecked: true,
            noNegotiationChecked: true,
            reviewed: true,
            reason,
            idempotencyKey: crypto.randomUUID(),
          }).then((ok) => {
            if (ok) setChecked("");
          })
        }
      >
        确认一次报价有效性记录
      </button>
    </fieldset>
  );
}

function BusinessFacts({
  value,
  participants,
  people,
  proofs,
}: {
  value: unknown;
  participants: { id: string; supplierName: string }[];
  people: { userId: string; name: string }[];
  proofs: Proof[];
}) {
  const labels: Record<string, string> = {
    selectionMode: "名单形成方式",
    formedAt: "实际形成时间",
    formationBasis: "名单来源及形成依据",
    participants: "逐家邀请",
    sourceNote: "名单来源",
    verificationMode: "核验适用类型",
    verificationBasis: "核验依据与结果",
    selectionBasis: "本对象邀请依据",
    sentAt: "实际通知时间",
    receivedAt: "实际接收时间",
    deliveryStatus: "送达处置",
    recipient: "实际接收人",
    evidenceVersionId: "精确凭证版本",
    participationId: "供应商",
    reason: "办理依据",
    grounds: "适用理由",
    approvalApplicability: "审批适用性",
    approvalNote: "审批适用及办理说明",
    approvalVersionId: "审批凭证",
    publicationApplicability: "公示适用性",
    publicationNote: "公示办理说明",
    publicationVersionId: "公示凭证",
    offers: "逐家一次报价",
    quoteLayerId: "精确报价层",
    status: "有效性",
    responseLocator: "原文位置",
    handlingBasis: "异常及有效性依据",
    staffUserIds: "实际专业人员",
    beganAt: "实际开始",
    endedAt: "实际结束",
    marketSourceVersionIds: "价格合理性资料",
    priceReasonability: "价格合理性分析",
    qualityAssurance: "质量保障",
    agreedAmount: "实际协商金额",
    currency: "币种",
    supplierConfirmationNote: "供应商线下确认来源",
  };
  const terms: Record<string, string> = {
    documented_selection: "按有据程序形成",
    external_lottery: "已完成的外部抽取",
    qualification_check: "资格核验",
    prequalification: "有据资格预审",
    not_applicable: "不适用（见依据）",
    required: "适用",
    received: "已送达",
    declined: "明确拒绝",
    unreachable: "未送达",
    valid: "有效",
    invalid: "无效",
    missing: "缺失",
    pending: "待处置",
  };
  if (!value || typeof value !== "object")
    return <span>{String(value ?? "无")}</span>;
  return (
    <div className="space-y-2">
      {Object.entries(value)
        .filter(([k]) => !!labels[k])
        .map(([k, v]) => (
          <div key={k} className="break-all">
            <strong>{labels[k]}：</strong>
            {Array.isArray(v) ? (
              v.map((x, i) => (
                <div key={i} className="ml-3 rounded border p-1">
                  {typeof x === "object" ? (
                    <BusinessFacts
                      value={x}
                      participants={participants}
                      people={people}
                      proofs={proofs}
                    />
                  ) : k === "staffUserIds" ? (
                    people.find((p) => p.userId === x)?.name || "历史专业人员"
                  ) : (
                    proofs.find((p) => p.id === x)?.name || String(x)
                  )}
                </div>
              ))
            ) : typeof v === "object" && v !== null ? (
              <BusinessFacts
                value={v}
                participants={participants}
                people={people}
                proofs={proofs}
              />
            ) : k === "participationId" ? (
              participants.find((p) => p.id === v)?.supplierName || "历史供应商"
            ) : k.endsWith("VersionId") ? (
              proofs.find((p) => p.id === v)?.name || String(v ?? "无")
            ) : (
              terms[String(v)] || String(v ?? "无")
            )}
          </div>
        ))}
    </div>
  );
}
