import { AgencyMethodProcedurePanel } from "./agency-method-procedure-panel";
import { AgencyIncidentPanel } from "./agency-incident-panel";
import { AgencyOpeningPanel } from "./agency-opening-panel";
import { AgencyAssessmentPanel } from "./agency-assessment-panel";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyOptions,
  evaluationRequest as api,
  type AgencyDetail,
  type EvaluationConfig,
  type EvaluationCriterion,
  type EvaluationView,
  type EvaluationWorkspace,
} from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
const btn =
  "rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40";
const input =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm";
const roles: Record<string, string> = {
  organizer: "项目组织人员",
  purchaser_rep: "采购人代表",
  review_member: "评审成员",
  leader: "组长",
  qualification_reviewer: "资格审查人员",
  conformity_reviewer: "符合性审查人员",
  supervisor: "监督人员",
};
const methods: Record<string, string> = {
  comprehensive: "综合评分",
  lowest_price: "最低评标价",
  negotiation_price: "谈判价格规则",
  price_comparison: "询价价格比较",
  consultation: "单一来源协商",
};
const stages: Record<string, string> = {
  qualification: "资格审查",
  conformity: "符合性审查",
  technical: "技术评分",
  commercial: "商务评分",
};
const resultTypes: Record<string, string> = {
  pass_fail: "通过/不通过",
  score: "评分",
};
const formulas: Record<string, string> = {
  none: "无计算",
  weighted_normalized: "原始分/满分×权重",
};
const roundings: Record<string, string> = {
  HALF_UP: "四舍五入",
  HALF_EVEN: "半偶舍入",
  DOWN: "向零截断",
};
const diffFields: Record<string, string> = {
  title: "事项",
  stage: "阶段",
  applicableTo: "适用对象",
  resultType: "结果类型",
  minimum: "最低分",
  maximum: "满分",
  weight: "权重",
  formula: "计算规则",
  evidenceRequired: "依据要求",
  scale: "保留位数",
  rounding: "舍入方式",
};
const diffValue = (field: string, value: string) =>
  field === "evidenceRequired"
    ? value === "true"
      ? "要求依据"
      : "依据选填"
    : (
        {
          stage: stages,
          resultType: resultTypes,
          formula: formulas,
          rounding: roundings,
        } as Record<string, Record<string, string>>
      )[field]?.[value] || value;
const blank = (): EvaluationConfig => ({
  title: "",
  documentRevisionId: "",
  evaluationMethod: "comprehensive",
  ruleVersion: "",
  ruleBasis: "",
  venue: "",
  scheduledAt: null,
  members: [],
  rules: [],
  tieRule: "",
});
const criterion = (): EvaluationCriterion => ({
  key: "",
  title: "",
  stage: "qualification",
  applicableTo: "",
  resultType: "pass_fail",
  minimum: "0",
  maximum: "0",
  weight: "0",
  formula: "none",
  evidenceRequired: true,
  scale: 2,
  rounding: "HALF_UP",
});
const local = (v: string | null) =>
  v
    ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export function AgencyEvaluationPanel({
  detail,
  editable,
  canFreeze,
  busy,
  run,
}: {
  detail: AgencyDetail;
  editable: boolean;
  canFreeze: boolean;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<boolean>;
}) {
  const pkg = detail.record.id,
    base = `/packages/${pkg}/rounds`;
  const q = useQuery({
    queryKey: ["agency-evaluation", pkg],
    queryFn: () => api<EvaluationWorkspace>(base),
    refetchInterval: 5000,
  });
  const people = useQuery({
    queryKey: ["agency-options"],
    queryFn: agencyOptions,
    enabled: editable,
  });
  const [draft, setDraft] = useState<EvaluationConfig>(blank),
    [editing, setEditing] = useState<{ id: string; version: number } | null>(
      null,
    ),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState(""),
    [key, setKey] = useState(crypto.randomUUID()),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [reviewed, setReviewed] = useState<Record<string, number>>({});
  const change = (patch: Partial<EvaluationConfig>) => {
    setDraft((d) => ({
      ...d,
      ...patch,
      ...(["evaluationMethod", "ruleVersion", "ruleBasis"].some(
        (k) => k in patch,
      )
        ? {
            rules: (patch.rules || d.rules).map((r) => ({
              ...r,
              manuallyChecked: false,
            })),
          }
        : {}),
    }));
    setDirty(true);
    setKey(crypto.randomUUID());
  };
  const eligible = new Set([
    detail.data.ownerId,
    detail.record.createdBy,
    ...detail.members.map((m) => m.userId),
  ]);
  const options = (people.data?.users || []).filter((u) => eligible.has(u.id));
  const active = q.data?.rounds.find((v) => v.round.id === editing?.id);
  const conflict =
    !!editing &&
    !!active &&
    (active.round.version !== editing.version ||
      active.round.status !== "draft");
  const reset = () => {
    setDraft(blank());
    setEditing(null);
    setDirty(false);
    setReason("");
    setKey(crypto.randomUUID());
  };
  const action = async (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
    });
  const updateRule = (
    i: number,
    side: "documentRule" | "configuredRule",
    c: EvaluationCriterion,
  ) =>
    change({
      rules: draft.rules.map((r, j) =>
        i === j ? { ...r, [side]: c, manuallyChecked: false } : r,
      ),
    });
  const state = async (v: EvaluationView, freeze: boolean) => {
    if (
      await action(() =>
        api(`${base}/${v.round.id}/${freeze ? "freeze" : "void"}`, "POST", {
          expectedVersion: v.round.version,
          businessRulesReviewed: reviewed[v.round.id] === v.round.version,
          reason: notes[v.round.id],
          idempotencyKey: crypto.randomUUID(),
        }),
      )
    ) {
      setNotes((n) => ({ ...n, [v.round.id]: "" }));
      setReviewed((n) => ({ ...n, [v.round.id]: 0 }));
    }
  };
  return (
    <section className="space-y-4" aria-label="评审轮次与规则冻结">
      <h4 className="font-bold">评审轮次与规则冻结</h4>
      <p className="text-sm text-slate-600">
        本阶段冻结评审准备配置。独立审查和评分意见在冻结后的任务中记录；报价、材料在线开启和排名尚未开放。原文规则由项目人员按定稿逐项录入、核对，系统对照已录入数据展示差异，不自动认定采购文件的全部规则。
      </p>
      {q.error && (
        <FeedbackNotice tone="error" message={(q.error as Error).message} />
      )}
      {editable && (
        <details open={dirty || undefined}>
          <summary className="cursor-pointer font-semibold">
            {editing ? "修订准备配置" : "新建评审轮次"}
          </summary>
          <fieldset
            disabled={busy}
            className="mt-3 space-y-4 rounded border p-4"
          >
            {conflict && (
              <FeedbackNotice
                tone="info"
                message="当前轮次已被修改或冻结。未保存内容已保留，请核对后重新打开最新版本。"
              />
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Label title="轮次名称">
                <input
                  aria-label="评审轮次名称"
                  className={input}
                  value={draft.title}
                  onChange={(e) => change({ title: e.target.value })}
                />
              </Label>
              <Label title="已审批采购文件定稿">
                <select
                  aria-label="评审来源定稿"
                  className={input}
                  value={draft.documentRevisionId}
                  onChange={(e) =>
                    change({
                      documentRevisionId: e.target.value,
                      rules: draft.rules.map((r) => ({
                        ...r,
                        manuallyChecked: false,
                      })),
                    })
                  }
                >
                  <option value="">请选择原始定稿版本</option>
                  {q.data?.sources.map((s) => (
                    <option key={s.revisionId} value={s.revisionId}>
                      采购文件编制V{s.inputVersion} · {s.hash.slice(0, 12)} ·{" "}
                      {s.current ? "当前" : "历史"}
                      {s.basisStale ? " · 基础变化" : ""}
                    </option>
                  ))}
                </select>
              </Label>
              <Label title="评审方法">
                <select
                  aria-label="评审方法"
                  className={input}
                  value={draft.evaluationMethod}
                  onChange={(e) => change({ evaluationMethod: e.target.value })}
                >
                  {Object.entries(methods).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </Label>
              <Label title="规则版本标识">
                <input
                  aria-label="规则版本标识"
                  className={input}
                  value={draft.ruleVersion}
                  onChange={(e) => change({ ruleVersion: e.target.value })}
                />
              </Label>
              <Label title="计划地点">
                <input
                  aria-label="评审计划地点"
                  className={input}
                  value={draft.venue}
                  onChange={(e) => change({ venue: e.target.value })}
                />
              </Label>
              <Label title="计划时间">
                <input
                  aria-label="评审计划时间"
                  type="datetime-local"
                  className={input}
                  value={local(draft.scheduledAt)}
                  onChange={(e) =>
                    change({
                      scheduledAt: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
              </Label>
            </div>
            <Label title="适用规则依据及文件位置">
              <textarea
                aria-label="评审规则依据"
                className={input}
                value={draft.ruleBasis}
                onChange={(e) => change({ ruleBasis: e.target.value })}
              />
            </Label>
            <Label title="同分处理依据（综合评分必填）">
              <textarea
                aria-label="同分处理依据"
                className={input}
                value={draft.tieRule}
                onChange={(e) => change({ tieRule: e.target.value })}
              />
            </Label>
            <h5 className="font-semibold">承担职责的账号</h5>
            <p className="text-xs text-slate-600">
              先在采购包成员中授权有效账号，再明确各项职责。准备配置不会自动授予评分权限。
            </p>
            {options.map((u) => {
              const m = draft.members.find((m) => m.userId === u.id);
              return (
                <div key={u.id} className="rounded border p-2 text-sm">
                  <strong>{u.name}</strong>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(roles).map(([role, title]) => (
                      <label key={role}>
                        <input
                          type="checkbox"
                          aria-label={u.name + " " + title}
                          checked={!!m?.roles.includes(role)}
                          onChange={(e) => {
                            const rs = e.target.checked
                              ? [...(m?.roles || []), role]
                              : (m?.roles || []).filter((r) => r !== role);
                            change({
                              members: [
                                ...draft.members.filter(
                                  (v) => v.userId !== u.id,
                                ),
                                ...(rs.length
                                  ? [{ userId: u.id, roles: rs }]
                                  : []),
                              ],
                            });
                          }}
                        />{" "}
                        {title}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {draft.members
              .filter((m) => !options.some((u) => u.id === m.userId))
              .map((m) => (
                <p key={m.userId} className="text-sm text-amber-800">
                  账号 {m.userId} 已不可选，请核对授权。
                  <button
                    className={btn}
                    onClick={() =>
                      change({
                        members: draft.members.filter(
                          (v) => v.userId !== m.userId,
                        ),
                      })
                    }
                  >
                    移除该配置人员
                  </button>
                </p>
              ))}
            <h5 className="font-semibold">逐项原文与配置</h5>
            {draft.rules.map((r, i) => (
              <article className="space-y-3 rounded border p-3" key={i}>
                <Label title="原文位置">
                  <input
                    aria-label={"规则" + (i + 1) + "原文位置"}
                    className={input}
                    value={r.locator}
                    onChange={(e) =>
                      change({
                        rules: draft.rules.map((r, j) =>
                          j === i
                            ? {
                                ...r,
                                locator: e.target.value,
                                manuallyChecked: false,
                              }
                            : r,
                        ),
                      })
                    }
                  />
                </Label>
                <div className="grid gap-4 lg:grid-cols-2">
                  <RuleEditor
                    title={"规则" + (i + 1) + "文件原文"}
                    value={r.documentRule}
                    onChange={(c) => updateRule(i, "documentRule", c)}
                  />
                  <RuleEditor
                    title={"规则" + (i + 1) + "系统配置"}
                    value={r.configuredRule}
                    onChange={(c) => updateRule(i, "configuredRule", c)}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className={btn}
                    onClick={() =>
                      updateRule(i, "configuredRule", { ...r.documentRule })
                    }
                  >
                    以本项原文填入配置
                  </button>
                  <button
                    className={btn}
                    onClick={() =>
                      change({ rules: draft.rules.filter((_, j) => i !== j) })
                    }
                  >
                    移除此规则草稿项
                  </button>
                  <label className="text-sm">
                    <input
                      type="checkbox"
                      aria-label={"已核对规则" + (i + 1)}
                      checked={r.manuallyChecked}
                      onChange={(e) =>
                        change({
                          rules: draft.rules.map((r, j) =>
                            i === j
                              ? { ...r, manuallyChecked: e.target.checked }
                              : r,
                          ),
                        })
                      }
                    />{" "}
                    已核对原文、配置及适用性
                  </label>
                </div>
              </article>
            ))}
            <button
              className={btn}
              disabled={draft.rules.length >= 100}
              onClick={() =>
                change({
                  rules: [
                    ...draft.rules,
                    {
                      documentRule: criterion(),
                      configuredRule: criterion(),
                      locator: "",
                      manuallyChecked: false,
                    },
                  ],
                })
              }
            >
              新增待核对规则
            </button>
            <Label title="维护原因">
              <textarea
                aria-label="轮次配置维护原因"
                className={input}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </Label>
            <div className="flex gap-3">
              <button
                className={btn}
                disabled={
                  conflict ||
                  !reason.trim() ||
                  !draft.title.trim() ||
                  !draft.documentRevisionId
                }
                onClick={async () => {
                  if (
                    await action(() =>
                      api<EvaluationView>(
                        base + (editing ? "/" + editing.id : ""),
                        editing ? "PUT" : "POST",
                        {
                          expectedVersion: editing?.version || 0,
                          config: draft,
                          reason,
                          idempotencyKey: key,
                        },
                      ),
                    )
                  )
                    reset();
                }}
              >
                保存评审准备草稿
              </button>
              <button className={btn} onClick={reset}>
                清空编辑器
              </button>
            </div>
          </fieldset>
        </details>
      )}
      {q.data && !q.data.rounds.length && (
        <p className="text-sm text-slate-500">尚无评审轮次。</p>
      )}
      {q.data?.rounds.map((v) => (
        <article
          key={v.round.id}
          className="space-y-3 rounded border p-4"
          aria-label={v.config.title + " 第" + v.round.ordinal + "轮"}
        >
          <h5 className="font-bold">
            第{v.round.ordinal}轮 · {v.config.title} ·{" "}
            {v.round.status === "draft"
              ? "准备草稿"
              : v.round.status === "frozen"
                ? "配置已冻结"
                : "已作废"}{" "}
            · V{v.round.version}
          </h5>
          <p className="text-sm">
            {methods[v.config.evaluationMethod]} · 规则版本{" "}
            {v.config.ruleVersion} · {v.config.members.length}名职责人员 ·{" "}
            {v.config.rules.length}条规则
          </p>
          <p className="break-all text-xs">
            来源定稿：采购文件编制V
            {q.data?.sources.find(
              (s) => s.revisionId === v.config.documentRevisionId,
            )?.inputVersion ?? "待复核"}{" "}
            · 内容校验{" "}
            {q.data?.sources
              .find((s) => s.revisionId === v.config.documentRevisionId)
              ?.hash.slice(0, 12) || "请核对来源状态"}
          </p>
          {v.round.status === "draft" && v.blockers.length > 0 && (
            <ul className="list-inside list-disc text-sm text-amber-800">
              {v.blockers.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              查看人员职责与规则内容
            </summary>
            <div className="mt-3 space-y-3 text-sm">
              <p>依据：{v.config.ruleBasis}</p>
              <p>
                计划：
                {v.config.scheduledAt
                  ? new Date(v.config.scheduledAt).toLocaleString()
                  : "未填"}{" "}
                · {v.config.venue}
              </p>
              <p>同分处理：{v.config.tieRule || "未填"}</p>
              {v.roster.map((m) => (
                <p key={m.userId}>
                  {m.name} · {m.roles.map((r) => roles[r] || r).join("、")}
                </p>
              ))}
              {v.config.rules.map((r) => (
                <div className="rounded border p-2" key={r.configuredRule.key}>
                  <p>
                    {r.configuredRule.key} · {r.configuredRule.title} ·
                    原文位置：{r.locator} ·{" "}
                    {r.manuallyChecked ? "已逐项核对" : "待核对"}
                  </p>
                  <p>
                    适用对象：{r.configuredRule.applicableTo} · 阶段：
                    {stages[r.configuredRule.stage]} · 结果：
                    {resultTypes[r.configuredRule.resultType]}
                  </p>
                  <p>
                    分值 {r.configuredRule.minimum}～{r.configuredRule.maximum}{" "}
                    · 权重 {r.configuredRule.weight} ·{" "}
                    {formulas[r.configuredRule.formula]} · 保留
                    {r.configuredRule.scale}位 ·{" "}
                    {roundings[r.configuredRule.rounding]} ·{" "}
                    {r.configuredRule.evidenceRequired
                      ? "要求依据"
                      : "依据选填"}
                  </p>
                </div>
              ))}
            </div>
          </details>
          {v.differences.length > 0 && (
            <div className="overflow-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th>规则</th>
                    <th>字段</th>
                    <th>文件录入值</th>
                    <th>配置值</th>
                  </tr>
                </thead>
                <tbody>
                  {v.differences.map((d) => (
                    <tr key={d.key + d.field}>
                      <td>{d.key}</td>
                      <td>{diffFields[d.field] || d.field}</td>
                      <td>{diffValue(d.field, d.documentValue)}</td>
                      <td>{diffValue(d.field, d.configuredValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {v.frozenBasisStale && (
            <FeedbackNotice
              tone="info"
              message="冻结后项目、文件或人员基础已变化。原快照保留，后续现场执行须先复核，不自动沿用。"
            />
          )}
          {v.round.frozenHash && (
            <>
              <p className="break-all text-xs">
                冻结SHA256：{v.round.frozenHash}
              </p>
              <button
                className={btn}
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const result = await api(`${base}/${v.round.id}/snapshot`);
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(result, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "评审配置-第" + v.round.ordinal + "轮.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                }
              >
                导出冻结快照与哈希
              </button>
            </>
          )}
          {v.round.frozenHash && (
            <AgencyIncidentPanel
              detail={detail}
              round={v}
              busy={busy}
              run={run}
            />
          )}
          {v.round.frozenHash && (
            <AgencyMethodProcedurePanel
              detail={detail}
              round={v}
              busy={busy}
              run={run}
            />
          )}
          {v.round.frozenHash && (
            <AgencyOpeningPanel
              detail={detail}
              round={v}
              busy={busy}
              run={run}
            />
          )}
          {v.round.frozenHash && (
            <AgencyAssessmentPanel
              detail={detail}
              round={v}
              busy={busy}
              run={run}
            />
          )}
          {v.round.voidReason && (
            <p className="text-sm">作废原因：{v.round.voidReason}</p>
          )}
          {editable && v.round.status === "draft" && (
            <button
              className={btn}
              disabled={busy || dirty}
              onClick={() => {
                setEditing({ id: v.round.id, version: v.round.version });
                setDraft(structuredClone(v.config));
                setReason("");
                setDirty(true);
                setKey(crypto.randomUUID());
              }}
            >
              打开此轮草稿
            </button>
          )}
          {editable && v.round.status !== "voided" && (
            <div className="space-y-2">
              <Label title="本次核对依据或作废原因">
                <textarea
                  aria-label={"第" + v.round.ordinal + "轮确认依据"}
                  className={input}
                  value={notes[v.round.id] || ""}
                  onChange={(e) =>
                    setNotes((n) => ({ ...n, [v.round.id]: e.target.value }))
                  }
                />
              </Label>
              {canFreeze && v.round.status === "draft" && (
                <>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={"第" + v.round.ordinal + "轮业务规则已复核"}
                      checked={reviewed[v.round.id] === v.round.version}
                      onChange={(e) =>
                        setReviewed((n) => ({
                          ...n,
                          [v.round.id]: e.target.checked ? v.round.version : 0,
                        }))
                      }
                    />{" "}
                    已核对定稿全部适用规则、人员职责及本轮配置，确认冻结准备版本
                  </label>
                  <button
                    className={btn}
                    disabled={
                      busy ||
                      v.blockers.length > 0 ||
                      !notes[v.round.id]?.trim() ||
                      reviewed[v.round.id] !== v.round.version ||
                      (editing?.id === v.round.id && dirty)
                    }
                    onClick={() => void state(v, true)}
                  >
                    冻结第{v.round.ordinal}轮准备配置
                  </button>
                </>
              )}
              <button
                className={btn}
                disabled={busy || !notes[v.round.id]?.trim()}
                onClick={() => void state(v, false)}
              >
                作废第{v.round.ordinal}轮并保留历史
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}
function Label({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600">{title}</p>
      {children}
    </div>
  );
}
function RuleEditor({
  title,
  value: c,
  onChange,
}: {
  title: string;
  value: EvaluationCriterion;
  onChange: (c: EvaluationCriterion) => void;
}) {
  const field = (key: keyof EvaluationCriterion, label: string) => (
    <Label key={key} title={label}>
      <input
        aria-label={title + label}
        className={input}
        value={String(c[key])}
        onChange={(e) => onChange({ ...c, [key]: e.target.value })}
      />
    </Label>
  );
  const select = (
    key: keyof EvaluationCriterion,
    label: string,
    opts: Record<string, string>,
  ) => (
    <Label title={label}>
      <select
        aria-label={title + label}
        className={input}
        value={String(c[key])}
        onChange={(e) => onChange({ ...c, [key]: e.target.value })}
      >
        {Object.entries(opts).map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </Label>
  );
  return (
    <fieldset className="space-y-2 rounded bg-slate-50 p-3">
      <legend className="font-semibold text-sm">{title}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("key", "编号")}
        {field("title", "事项")}
        {field("applicableTo", "适用对象")}
        {select("stage", "阶段", {
          qualification: "资格审查",
          conformity: "符合性审查",
          technical: "技术评分",
          commercial: "商务评分",
        })}
        {select("resultType", "结果类型", {
          pass_fail: "通过/不通过",
          score: "评分",
        })}
        {field("minimum", "最低分")}
        {field("maximum", "满分")}
        {field("weight", "权重")}
        {select("formula", "计算规则", {
          none: "无计算",
          weighted_normalized: "原始分/满分×权重",
        })}
        <Label title="保留位数">
          <input
            aria-label={title + "保留位数"}
            type="number"
            min={0}
            max={6}
            className={input}
            value={c.scale}
            onChange={(e) => onChange({ ...c, scale: Number(e.target.value) })}
          />
        </Label>
        {select("rounding", "舍入方式", {
          HALF_UP: "四舍五入",
          HALF_EVEN: "半偶舍入",
          DOWN: "向零截断",
        })}
      </div>
      <label className="text-sm">
        <input
          aria-label={title + "要求依据"}
          type="checkbox"
          checked={c.evidenceRequired}
          onChange={(e) =>
            onChange({ ...c, evidenceRequired: e.target.checked })
          }
        />{" "}
        要求填写依据
      </label>
    </fieldset>
  );
}
