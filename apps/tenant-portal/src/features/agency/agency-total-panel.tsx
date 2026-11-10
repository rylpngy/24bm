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
type Source = { criterionKey: string; source: string };
type Rule = {
  method: string;
  totalScale: number;
  totalRounding: string;
  tieHandling: string;
  sources: Source[];
};
type Config = {
  ruleVersion: string;
  basis: string;
  locator: string;
  documentRule: Rule;
  configuredRule: Rule;
};
type Component = {
  criterionKey: string;
  title: string;
  source: string;
  memberCount: number;
  references: { id: string; hash: string; userId: string | null }[];
  rawSum: string | null;
  maximum: string;
  weight: string;
  numerator: string | null;
  denominator: string | null;
  scale: number;
  rounding: string;
  value: string;
};
type Trace = {
  method: string;
  totalScale: number;
  totalRounding: string;
  roundingOrder: string;
  priceCalculationId: string;
  priceInputFingerprint: string;
  scopeJson: string;
  tieRule: string;
  subjects: {
    participationId: string;
    supplierName: string;
    components: Component[];
    componentSum: string;
    total: string;
  }[];
  ties: { total: string; participationIds: string[] }[];
};
type Preview = {
  fingerprint: string;
  basisFingerprint: string;
  trace: Trace | null;
  blockers: string[];
};
export type TotalWorkspace = {
  rule: {
    id: string;
    version: number;
    status: string;
    frozenHash: string | null;
  } | null;
  config: Config | null;
  differences: string[];
  ruleBlockers: string[];
  basisFingerprint: string;
  prices: { id: string; createdAt: string; stale: boolean }[];
  history: {
    snapshot: {
      id: string;
      createdAt: string;
      reason: string;
      ruleHash: string;
      traceJson: string;
    };
    stale: boolean;
  }[];
  blockers: string[];
};
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
const sourceNames: Record<string, string> = {
  member_mean: "全部冻结职责成员原始分等权汇总",
  objective_price: "仅所选客观价格计算，不计人工价格分",
};
export function AgencyTotalPanel({
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
    { can } = useBuyerPermissions(),
    path = `/packages/${detail.record.id}/sessions/${session.id}/totals`;
  const q = useQuery({
    queryKey: ["agency-totals", session.id],
    queryFn: () => api<TotalWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const act = (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
    });
  const criteria = round.config.rules
    .filter((p) => p.configuredRule.resultType === "score")
    .map((p) => p.configuredRule);
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        综合评分受控汇总
      </summary>
      <p className="my-2 text-xs">
        每项明确唯一来源，成员项使用全部冻结职责成员，价格项不重复计入人工分。仅留存汇总复核，不生成确定排名、候选人推荐或成交结果。
      </p>
      {q.isError && (
        <>
          <FeedbackNotice tone="error" message="汇总工作区加载失败，请重试。" />
          <button className={btn} onClick={() => void q.refetch()}>
            重试汇总工作区
          </button>
        </>
      )}
      {q.data && (
        <>
          <RuleForm
            w={q.data}
            criteria={criteria}
            disabled={busy || !can("buyer:agency:evaluation:total:manage")}
            save={(d) => act(() => api(path + "/rule", "PUT", d))}
            freeze={(d) => act(() => api(path + "/rule/freeze", "POST", d))}
          />
          <p className="text-sm text-amber-800">{q.data.blockers.join("；")}</p>
          {q.data.rule?.status === "frozen" && (
            <SummaryForm
              w={q.data}
              detail={detail}
              disabled={busy || !can("buyer:agency:evaluation:total:manage")}
              preview={(id) =>
                api<Preview>(path + "/preview", "POST", {
                  priceCalculationId: id,
                })
              }
              confirm={(d) => act(() => api(path, "POST", d))}
              run={run}
            />
          )}
          {q.data.history.map((h) => (
            <details key={h.snapshot.id} className="my-2 rounded border p-2">
              <summary>
                历史汇总 · {new Date(h.snapshot.createdAt).toLocaleString()} ·{" "}
                {h.stale
                  ? "输入已变化，须重新复核"
                  : "输入指纹一致，仍为独立汇总记录"}
              </summary>
              <p className="text-xs">{h.snapshot.reason}</p>
              <p className="break-all text-xs">
                汇总规则指纹：{h.snapshot.ruleHash}
              </p>
              <TraceTable trace={JSON.parse(h.snapshot.traceJson) as Trace} />
            </details>
          ))}
        </>
      )}
    </details>
  );
}
type Criterion = EvaluationView["config"]["rules"][number]["configuredRule"];
function blankRule(criteria: Criterion[]): Rule {
  return {
    method: "mean_raw_then_weight",
    totalScale: 2,
    totalRounding: "HALF_UP",
    tieHandling: "manual_pending",
    sources: criteria.map((c) => ({ criterionKey: c.key, source: "" })),
  };
}
function RuleForm({
  w,
  criteria,
  disabled,
  save,
  freeze,
}: {
  w: TotalWorkspace;
  criteria: Criterion[];
  disabled: boolean;
  save: (d: unknown) => Promise<boolean>;
  freeze: (d: unknown) => Promise<boolean>;
}) {
  const [d, setD] = useState<Config>({
      ruleVersion: "",
      basis: "",
      locator: "",
      documentRule: blankRule(criteria),
      configuredRule: blankRule(criteria),
    }),
    [dirty, setDirty] = useState(false),
    [version, setVersion] = useState(0),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  useEffect(() => {
    if (!dirty) {
      if (w.config) setD(w.config);
      setVersion(w.rule?.version || 0);
    }
  }, [w.config, w.rule?.version, dirty]);
  const edit = (n: Config) => {
    setD(n);
    setDirty(true);
    setChecked("");
  };
  if (w.rule?.status === "frozen")
    return (
      <div className="my-3 rounded border p-2 text-sm">
        <strong>汇总规则已冻结 · V{w.rule.version}</strong>
        <p>
          成员原始分精确求和后加权；分项舍入后求和，总分{" "}
          {w.config!.configuredRule.totalScale} 位 /{" "}
          {w.config!.configuredRule.totalRounding}
        </p>
        {w.config!.configuredRule.sources.map((s) => (
          <p key={s.criterionKey}>
            {s.criterionKey}：{sourceNames[s.source]}
          </p>
        ))}
        <p>原文定位：{w.config!.locator}</p>
        <p>依据：{w.config!.basis}</p>
        <p className="break-all text-xs">SHA256 {w.rule.frozenHash}</p>
      </div>
    );
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2">
      <legend className="font-medium">逐项核对汇总规则</legend>
      <p className="text-xs">
        本轮只支持等权原始分合计后加权：分项最后除法按冻结评分项舍入，客观价格分直接引用，再对分项合计作总分舍入。不支持去高低分、成员特殊权重或自动同分排序。
      </p>
      <input
        aria-label="汇总规则版本"
        className={input}
        value={d.ruleVersion}
        onChange={(e) => edit({ ...d, ruleVersion: e.target.value })}
        placeholder="规则版本"
      />
      <textarea
        aria-label="汇总规则适用依据"
        className={input}
        value={d.basis}
        onChange={(e) => edit({ ...d, basis: e.target.value })}
      />
      <input
        aria-label="汇总规则原文定位"
        className={input}
        value={d.locator}
        onChange={(e) => edit({ ...d, locator: e.target.value })}
        placeholder="定稿汇总及舍入章节"
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {(["documentRule", "configuredRule"] as const).map((key) => (
          <RuleEditor
            key={key}
            label={key === "documentRule" ? "原文汇总规则" : "系统汇总规则"}
            r={d[key]}
            criteria={criteria}
            edit={(r) => edit({ ...d, [key]: r })}
          />
        ))}
      </div>
      <textarea
        aria-label="汇总规则维护说明"
        className={input}
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setChecked("");
        }}
      />
      <button
        className={btn}
        disabled={!reason.trim()}
        onClick={() =>
          void (async () => {
            if (
              await save({
                expectedVersion: version,
                config: d,
                reason,
                idempotencyKey: crypto.randomUUID(),
              })
            ) {
              setDirty(false);
              setChecked("");
            }
          })()
        }
      >
        保存汇总规则草稿
      </button>
      {w.rule && (
        <>
          <p className="text-sm text-amber-800">
            {[
              ...w.differences.map((x) => "原文差异：" + x),
              ...w.ruleBlockers,
            ].join("；") || "两侧配置一致，仍须核对定稿及唯一计分来源"}
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === String(w.rule.version)}
              onChange={(e) =>
                setChecked(e.target.checked ? String(w.rule!.version) : "")
              }
            />
            已核对原文汇总、成员范围、唯一计分来源及舍入顺序
          </label>
          <button
            className={btn}
            disabled={
              dirty ||
              !reason.trim() ||
              checked !== String(w.rule.version) ||
              !!w.differences.length ||
              !!w.ruleBlockers.length
            }
            onClick={() =>
              void freeze({
                expectedVersion: w.rule!.version,
                reviewed: true,
                reason,
                idempotencyKey: crypto.randomUUID(),
              })
            }
          >
            冻结本版汇总规则
          </button>
        </>
      )}
    </fieldset>
  );
}
function RuleEditor({
  label,
  r,
  criteria,
  edit,
}: {
  label: string;
  r: Rule;
  criteria: Criterion[];
  edit: (r: Rule) => void;
}) {
  return (
    <fieldset className="space-y-2 rounded border p-2">
      <legend>{label}</legend>
      <p className="text-xs">成员原始分等权汇总后加权；同分仅标记待人工处理</p>
      {criteria.map((c) => (
        <label key={c.key} className="block text-sm">
          {c.key} {c.title} · 权重 {String(c.weight)} · 分项 {c.scale} 位/
          {c.rounding}
          <select
            aria-label={label + "来源 " + c.key}
            className={input}
            value={
              r.sources.find((s) => s.criterionKey === c.key)?.source || ""
            }
            onChange={(e) =>
              edit({
                ...r,
                sources: criteria.map((x) => ({
                  criterionKey: x.key,
                  source:
                    x.key === c.key
                      ? e.target.value
                      : r.sources.find((s) => s.criterionKey === x.key)
                          ?.source || "",
                })),
              })
            }
          >
            <option value="">逐项明确唯一来源</option>
            {Object.entries(sourceNames).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="block text-sm">
        总分保留位数
        <input
          aria-label={label + "总分保留位数"}
          type="number"
          min="0"
          max="6"
          className={input}
          value={r.totalScale}
          onChange={(e) => edit({ ...r, totalScale: Number(e.target.value) })}
        />
      </label>
      <select
        aria-label={label + "总分舍入方式"}
        className={input}
        value={r.totalRounding}
        onChange={(e) => edit({ ...r, totalRounding: e.target.value })}
      >
        <option value="HALF_UP">HALF_UP（四舍五入）</option>
        <option value="HALF_EVEN">HALF_EVEN（中点取偶）</option>
        <option value="DOWN">DOWN（向零截断）</option>
      </select>
    </fieldset>
  );
}
function SummaryForm({
  w,
  detail,
  disabled,
  preview,
  confirm,
  run,
}: {
  w: TotalWorkspace;
  detail: AgencyDetail;
  disabled: boolean;
  preview: (id: string) => Promise<Preview>;
  confirm: (d: unknown) => Promise<boolean>;
  run: Run;
}) {
  const [selected, setSelected] = useState(""),
    [p, setP] = useState<Preview | null>(null),
    [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  const selectedOption = w.prices.find((x) => x.id === selected),
    current =
      !!p &&
      p.trace?.priceCalculationId === selected &&
      p.basisFingerprint === w.basisFingerprint &&
      !!selectedOption &&
      !selectedOption.stale,
    baseline = JSON.stringify([
      selected,
      p?.fingerprint,
      w.basisFingerprint,
      proof,
      reason,
    ]);
  const proofs = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
    );
  return (
    <fieldset disabled={disabled} className="my-3 space-y-2">
      <legend className="font-medium">选择已复核价格版本并预览汇总</legend>
      <select
        aria-label="汇总价格计算版本"
        className={input}
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">明确选择一份价格计算，不自动带入</option>
        {w.prices.map((x) => (
          <option key={x.id} value={x.id} disabled={x.stale}>
            {new Date(x.createdAt).toLocaleString()} · {x.id}{" "}
            {x.stale ? "（已失效，先重新核对价格）" : ""}
          </option>
        ))}
      </select>
      <button
        className={btn}
        disabled={!selectedOption || selectedOption.stale}
        onClick={() =>
          void run(async () => {
            setChecked("");
            setP(await preview(selected));
          })
        }
      >
        生成受控汇总预览
      </button>
      {p && (
        <>
          <p className="text-sm text-amber-800">{p.blockers.join("；")}</p>
          {!current && (
            <p className="text-sm text-amber-800">
              来源或状态已变化，请重新核对价格版本并生成汇总预览。
            </p>
          )}
          {p.trace && <TraceTable trace={p.trace} />}
          <select
            aria-label="汇总复核凭证"
            className={input}
            value={proof}
            onChange={(e) => setProof(e.target.value)}
          >
            <option value="">选择脱敏汇总复核凭证</option>
            {proofs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="汇总复核说明"
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="逐项来源、成员版本、计算明细及同分待处理说明"
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === baseline}
              onChange={(e) => setChecked(e.target.checked ? baseline : "")}
            />
            已逐项复核唯一计分来源、成员版本及汇总明细
          </label>
          <button
            className={btn}
            disabled={
              !current ||
              !!p.blockers.length ||
              !proof ||
              !reason.trim() ||
              checked !== baseline
            }
            onClick={() =>
              void (async () => {
                if (
                  await confirm({
                    priceCalculationId: selected,
                    fingerprint: p.fingerprint,
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
            确认并保存受控汇总
          </button>
        </>
      )}
    </fieldset>
  );
}
function TraceTable({ trace: t }: { trace: Trace }) {
  return (
    <div className="my-2 space-y-2 rounded border p-2">
      <p className="text-xs">
        {t.roundingOrder}；总分 {t.totalScale} 位 / {t.totalRounding}
      </p>
      <p className="break-all text-xs">
        客观价格计算：{t.priceCalculationId}；输入指纹：
        {t.priceInputFingerprint}
      </p>
      <p className="text-xs">
        同分依据：{t.tieRule}。仅标记待处理，不自动排序或推荐。
      </p>
      {t.ties.map((tie, i) => (
        <p key={i} className="text-sm text-amber-800">
          同分 {tie.total}：
          {tie.participationIds
            .map(
              (id) =>
                t.subjects.find((s) => s.participationId === id)
                  ?.supplierName || id,
            )
            .join("、")}
          ；待按冻结依据人工处理
        </p>
      ))}
      <div className="overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>对象</th>
              <th>分项合计</th>
              <th>独立汇总总分</th>
            </tr>
          </thead>
          <tbody>
            {t.subjects.map((s) => (
              <tr key={s.participationId}>
                <td>{s.supplierName}</td>
                <td>{s.componentSum}</td>
                <td>{s.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {t.subjects.map((s) => (
        <details key={s.participationId} className="rounded border p-2 text-xs">
          <summary>{s.supplierName} 分项与提交版本</summary>
          {s.components.map((c) => (
            <div key={c.criterionKey} className="my-2 border-t pt-2">
              <strong>
                {c.criterionKey} {c.title}：{c.value}
              </strong>
              <p>
                {sourceNames[c.source]} · 成员 {c.memberCount} 人 · 权重{" "}
                {c.weight}
              </p>
              <p>
                {c.source === "member_mean"
                  ? `原始分合计 ${c.rawSum}；精确分子 ${c.numerator} ÷ 分母 ${c.denominator}`
                  : "直接使用所选客观价格分，不再加入人工价格分"}{" "}
                · {c.scale} 位/{c.rounding}
              </p>
              {c.references.map((ref) => (
                <p key={ref.id} className="break-all">
                  {ref.userId ? `冻结成员 ${ref.userId}：` : ""}
                  {ref.id} · SHA256 {ref.hash}
                </p>
              ))}
            </div>
          ))}
        </details>
      ))}
      <p className="text-xs">
        本次范围及排除依据：
        {Object.entries(
          (JSON.parse(t.scopeJson) as { exclusions: Record<string, string> })
            .exclusions,
        )
          .map(([id, reason]) => `${id}：${reason}`)
          .join("；") || "未排除对象"}
      </p>
    </div>
  );
}
