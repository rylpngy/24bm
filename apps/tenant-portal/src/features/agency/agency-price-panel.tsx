import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type AssessmentSession,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const input = "w-full rounded border p-2 text-sm",
  btn = "rounded border bg-white px-3 py-2 text-sm disabled:opacity-40";
type Rule = {
  priceSource: string;
  formula: string;
  criterionKey: string;
  fullScore: string;
  scale: number;
  rounding: string;
  tieRule: string;
};
type Config = {
  ruleVersion: string;
  basis: string;
  locator: string;
  documentRule: Rule;
  configuredRule: Rule;
};
type Scope = { participationIds: string[]; exclusions: Record<string, string> };
type Trace = {
  formula: string;
  minimum: string;
  fullScore: string;
  scale: number;
  rounding: string;
  roundingOrder: string;
  lines: {
    participationId: string;
    supplierName: string;
    sourceId: string;
    sourceHash: string;
    sourceKind: string;
    price: string;
    currency: string;
    numerator: string | null;
    score: string | null;
  }[];
};
type Preview = {
  fingerprint: string;
  basisFingerprint: string;
  scope: Scope;
  trace: Trace | null;
  blockers: string[];
};
export type PriceWorkspace = {
  rule: {
    id: string;
    status: string;
    version: number;
    frozenHash: string | null;
  } | null;
  config: Config | null;
  differences: string[];
  ruleBlockers: string[];
  candidates: { participationId: string; supplierName: string }[];
  basisFingerprint: string;
  blockers: string[];
  history: {
    stale: boolean;
    calculation: {
      id: string;
      traceJson: string;
      scopeJson: string;
      ruleHash: string;
      reason: string;
      createdAt: string;
    };
  }[];
};
const sourceNames: Record<string, string> = {
  original: "原始初次报价",
  corrected: "已确认修正报价",
  policy: "已确认政策评审价格",
  final_original: "已确认原始最后报价",
};
const formulaNames: Record<string, string> = {
  minimum_ratio: "最低价 × 价格满分 ÷ 当前价格",
  price_comparison: "仅比较十进制价格，不计分或排序",
};
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
export function AgencyPricePanel({
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
    path = `/packages/${detail.record.id}/sessions/${session.id}/price-calculations`;
  const q = useQuery({
    queryKey: ["agency-price-calculations", session.id],
    queryFn: () => api<PriceWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const act = (f: () => Promise<unknown>) =>
    run(async () => {
      await f();
      await q.refetch();
    });
  return (
    <details
      className="rounded border bg-white p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold">
        价格规则与计算明细
      </summary>
      <p className="my-2 text-xs">
        先核对并冻结原文价格规则，再按明确来源计算。仅保存独立价格明细，不回填个人意见或形成综合排名、推荐和成交金额。
      </p>
      {q.isError && (
        <>
          <FeedbackNotice tone="error" message="价格工作区加载失败，请重试。" />
          <button className={btn} onClick={() => void q.refetch()}>
            重试价格工作区
          </button>
        </>
      )}
      {q.data && (
        <>
          <RuleForm
            w={q.data}
            disabled={busy}
            manage={can("buyer:agency:evaluation:calculation:manage")}
            save={(d) => act(() => api(path + "/rule", "PUT", d))}
            freeze={(d) => act(() => api(path + "/rule/freeze", "POST", d))}
          />
          <p className="my-2 text-sm text-amber-800">
            {q.data.blockers.join("；")}
          </p>
          {q.data.rule?.status === "frozen" && (
            <CalculationForm
              w={q.data}
              detail={detail}
              disabled={busy}
              manage={can("buyer:agency:evaluation:calculation:manage")}
              preview={(d) => api<Preview>(path + "/preview", "POST", d)}
              confirm={(d) => act(() => api(path, "POST", d))}
              run={run}
            />
          )}
          {q.data.history.map((h) => (
            <details key={h.calculation.id} className="my-2 rounded border p-2">
              <summary>
                历史价格计算 ·{" "}
                {new Date(h.calculation.createdAt).toLocaleString()} ·{" "}
                {h.stale
                  ? "输入已变化，须重新复核"
                  : "输入指纹一致，仍为独立计算记录"}
              </summary>
              <p className="text-xs">{h.calculation.reason}</p>
              <p className="break-all text-xs">
                冻结规则指纹：{h.calculation.ruleHash}
              </p>
              <TraceTable
                trace={JSON.parse(h.calculation.traceJson) as Trace}
              />
              <p className="text-xs">
                排除依据：
                {Object.entries(
                  (JSON.parse(h.calculation.scopeJson) as Scope).exclusions,
                )
                  .map(
                    ([id, reason]) =>
                      `${q.data!.candidates.find((s) => s.participationId === id)?.supplierName || id}：${reason}`,
                  )
                  .join("；") || "无"}
              </p>
            </details>
          ))}
        </>
      )}
    </details>
  );
}
const blankRule = (): Rule => ({
  priceSource: "",
  formula: "",
  criterionKey: "",
  fullScore: "",
  scale: 2,
  rounding: "HALF_UP",
  tieRule: "",
});
function RuleForm({
  w,
  disabled,
  manage,
  save,
  freeze,
}: {
  w: PriceWorkspace;
  disabled: boolean;
  manage: boolean;
  save: (d: unknown) => Promise<boolean>;
  freeze: (d: unknown) => Promise<boolean>;
}) {
  const [config, setConfig] = useState<Config>({
      ruleVersion: "",
      basis: "",
      locator: "",
      documentRule: blankRule(),
      configuredRule: blankRule(),
    }),
    [version, setVersion] = useState(0),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState("");
  useEffect(() => {
    if (!dirty) {
      if (w.config) setConfig(w.config);
      setVersion(w.rule?.version || 0);
    }
  }, [w.config, w.rule?.version, dirty]);
  const edit = (next: Config) => {
    setConfig(next);
    setDirty(true);
    setChecked("");
  };
  if (w.rule?.status === "frozen")
    return (
      <div className="my-3 space-y-1 rounded border p-2 text-sm">
        <strong>价格规则已冻结 · V{w.rule.version}</strong>
        <p>
          来源：{sourceNames[w.config!.configuredRule.priceSource]}；公式：
          {formulaNames[w.config!.configuredRule.formula]}
        </p>
        <p>
          价格项 {w.config!.configuredRule.criterionKey || "不计分"} · 满分{" "}
          {w.config!.configuredRule.fullScore} · 保留{" "}
          {w.config!.configuredRule.scale} 位 ·{" "}
          {w.config!.configuredRule.rounding}
        </p>
        <p>原文定位：{w.config!.locator}</p>
        <p>依据：{w.config!.basis}</p>
        <p>同价/同分：{w.config!.configuredRule.tieRule}</p>
        <p className="break-all text-xs">SHA256 {w.rule.frozenHash}</p>
      </div>
    );
  return (
    <fieldset disabled={disabled || !manage} className="my-3 space-y-2">
      <legend className="font-medium">逐项对照原文价格规则</legend>
      <p className="text-xs">
        原文来自本轮已冻结定稿。两侧须分别核对，不自动复制；仅支持最终除法舍入，其他公式或舍入顺序暂不能冻结。
      </p>
      <input
        className={input}
        aria-label="价格规则版本"
        value={config.ruleVersion}
        onChange={(e) => edit({ ...config, ruleVersion: e.target.value })}
        placeholder="规则版本"
      />
      <textarea
        className={input}
        aria-label="价格规则适用依据"
        value={config.basis}
        onChange={(e) => edit({ ...config, basis: e.target.value })}
      />
      <input
        className={input}
        aria-label="价格规则原文定位"
        value={config.locator}
        onChange={(e) => edit({ ...config, locator: e.target.value })}
        placeholder="定稿章节及页码"
      />
      <div className="grid gap-3 lg:grid-cols-2">
        {(["documentRule", "configuredRule"] as const).map((key) => (
          <RuleEditor
            key={key}
            label={key === "documentRule" ? "原文价格规则" : "系统价格规则"}
            rule={config[key]}
            edit={(r) => edit({ ...config, [key]: r })}
          />
        ))}
      </div>
      <textarea
        className={input}
        aria-label="价格规则维护说明"
        value={reason}
        onChange={(e) => {
          setReason(e.target.value);
          setChecked("");
        }}
        placeholder="维护或冻结核对说明"
      />
      <button
        className={btn}
        disabled={!reason.trim()}
        onClick={() =>
          void (async () => {
            if (
              await save({
                expectedVersion: version,
                config,
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
        保存价格规则草稿
      </button>
      {w.rule && (
        <>
          <p className="text-sm text-amber-800">
            {[
              ...w.differences.map((d) => "原文差异：" + d),
              ...w.ruleBlockers,
            ].join("；") || "两侧规则一致，仍须人工核对原文及舍入顺序"}
          </p>
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === String(w.rule.version)}
              onChange={(e) =>
                setChecked(e.target.checked ? String(w.rule!.version) : "")
              }
            />
            已逐项核对原文、价格来源、权重及仅最终除法舍入
          </label>
          <button
            className={btn}
            disabled={
              dirty ||
              checked !== String(w.rule.version) ||
              !reason.trim() ||
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
            冻结本版价格规则
          </button>
        </>
      )}
    </fieldset>
  );
}
function RuleEditor({
  label,
  rule: r,
  edit,
}: {
  label: string;
  rule: Rule;
  edit: (r: Rule) => void;
}) {
  return (
    <fieldset className="space-y-2 rounded border p-2">
      <legend>{label}</legend>
      <select
        aria-label={label + "来源"}
        className={input}
        value={r.priceSource}
        onChange={(e) => edit({ ...r, priceSource: e.target.value })}
      >
        <option value="">明确价格来源，不自动回退</option>
        {Object.entries(sourceNames).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <select
        aria-label={label + "公式"}
        className={input}
        value={r.formula}
        onChange={(e) => edit({ ...r, formula: e.target.value })}
      >
        <option value="">选择与定稿一致的公式</option>
        {Object.entries(formulaNames).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input
        aria-label={label + "价格项编号"}
        className={input}
        value={r.criterionKey}
        onChange={(e) => edit({ ...r, criterionKey: e.target.value })}
        placeholder="冻结商务价格项编号；不计分时留空"
      />
      <input
        aria-label={label + "满分"}
        className={input}
        inputMode="decimal"
        value={r.fullScore}
        onChange={(e) => edit({ ...r, fullScore: e.target.value })}
        placeholder="满分匹配冻结价格项权重；不计分为0"
      />
      <label className="block text-sm">
        结果保留位数
        <input
          aria-label={label + "保留位数"}
          className={input}
          type="number"
          min="0"
          max="6"
          value={r.scale}
          onChange={(e) => edit({ ...r, scale: Number(e.target.value) })}
        />
      </label>
      <select
        aria-label={label + "舍入方式"}
        className={input}
        value={r.rounding}
        onChange={(e) => edit({ ...r, rounding: e.target.value })}
      >
        <option value="HALF_UP">HALF_UP（四舍五入）</option>
        <option value="HALF_EVEN">HALF_EVEN（中点取偶）</option>
        <option value="DOWN">DOWN（向零截断）</option>
      </select>
      <textarea
        aria-label={label + "同价同分依据"}
        className={input}
        value={r.tieRule}
        onChange={(e) => edit({ ...r, tieRule: e.target.value })}
        placeholder="同价/同分后续处理依据，当前不自动排序"
      />
    </fieldset>
  );
}
function CalculationForm({
  w,
  detail,
  disabled,
  manage,
  preview,
  confirm,
  run,
}: {
  w: PriceWorkspace;
  detail: AgencyDetail;
  disabled: boolean;
  manage: boolean;
  preview: (d: Scope) => Promise<Preview>;
  confirm: (d: unknown) => Promise<boolean>;
  run: Run;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [exclusions, setExclusions] = useState<Record<string, string>>({}),
    [proof, setProof] = useState(""),
    [reason, setReason] = useState(""),
    [p, setP] = useState<Preview | null>(null),
    [checked, setChecked] = useState("");
  const scope = {
      participationIds: ids,
      exclusions: Object.fromEntries(
        w.candidates
          .filter((s) => !ids.includes(s.participationId))
          .map((s) => [s.participationId, exclusions[s.participationId] || ""]),
      ),
    },
    scopeHash = JSON.stringify([
      scope.participationIds,
      Object.entries(scope.exclusions).sort(([a], [b]) => a.localeCompare(b)),
    ]),
    previewScopeHash = p
      ? JSON.stringify([
          p.scope.participationIds,
          Object.entries(p.scope.exclusions).sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        ])
      : "",
    current =
      !!p &&
      w.basisFingerprint === p.basisFingerprint &&
      scopeHash === previewScopeHash,
    baseline = JSON.stringify([
      p?.fingerprint,
      scopeHash,
      proof,
      reason,
      w.basisFingerprint,
    ]);
  const ready =
      !!ids.length && Object.values(scope.exclusions).every((x) => x.trim()),
    proofs = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
      );
  return (
    <fieldset disabled={disabled || !manage} className="my-3 space-y-2">
      <legend className="font-medium">价格计算范围与预览</legend>
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
                    : ids.filter((id) => id !== s.participationId),
                )
              }
            />
            纳入价格计算 {s.supplierName}
          </label>
          {!ids.includes(s.participationId) && (
            <input
              aria-label={"不纳入计算依据 " + s.supplierName}
              className={input}
              value={exclusions[s.participationId] || ""}
              onChange={(e) =>
                setExclusions({
                  ...exclusions,
                  [s.participationId]: e.target.value,
                })
              }
              placeholder="逐家填写有权处理依据；不自动跳过缺失报价"
            />
          )}
        </div>
      ))}
      <button
        className={btn}
        disabled={!ready}
        onClick={() =>
          void run(async () => {
            setChecked("");
            setP(await preview(scope));
          })
        }
      >
        生成价格计算预览
      </button>
      {p && (
        <>
          <p className="text-sm text-amber-800">{p.blockers.join("；")}</p>
          {!current && (
            <p className="text-sm text-amber-800">
              输入或范围已变化，请重新生成价格计算预览。
            </p>
          )}
          {p.trace && <TraceTable trace={p.trace} />}
          <select
            aria-label="价格计算复核凭证"
            className={input}
            value={proof}
            onChange={(e) => setProof(e.target.value)}
          >
            <option value="">选择脱敏范围及计算复核凭证</option>
            {proofs.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <textarea
            aria-label="价格计算复核说明"
            className={input}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="包括范围、排除依据及计算明细的复核说明"
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={checked === baseline}
              onChange={(e) => setChecked(e.target.checked ? baseline : "")}
            />
            已复核指定价格来源、逐家处理及全部计算明细
          </label>
          <button
            className={btn}
            disabled={
              !current ||
              !!p.blockers.length ||
              !p.trace ||
              !proof ||
              !reason.trim() ||
              checked !== baseline
            }
            onClick={() =>
              void (async () => {
                if (
                  await confirm({
                    scope,
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
            确认并保存独立价格计算
          </button>
        </>
      )}
    </fieldset>
  );
}
function TraceTable({ trace: t }: { trace: Trace }) {
  return (
    <div className="my-2 space-y-1 overflow-auto rounded border p-2">
      <p className="text-xs">
        公式：{formulaNames[t.formula]}；基准最低价 {t.minimum}；价格满分{" "}
        {t.fullScore}；结果 {t.scale} 位 / {t.rounding}
      </p>
      <p className="text-xs">{t.roundingOrder}</p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr>
            <th>对象</th>
            <th>来源/版本</th>
            <th>评审输入价格</th>
            <th>精确分子</th>
            <th>独立价格分</th>
          </tr>
        </thead>
        <tbody>
          {t.lines.map((l) => (
            <tr key={l.participationId}>
              <td>{l.supplierName}</td>
              <td>
                <span>{sourceNames[l.sourceKind]}</span>
                <details>
                  <summary>查看版本与指纹</summary>
                  <p>{l.sourceId}</p>
                  <p className="max-w-64 break-all">{l.sourceHash}</p>
                </details>
              </td>
              <td>
                {l.price} {l.currency}
              </td>
              <td>{l.numerator ?? "不计分"}</td>
              <td>{l.score ?? "不计分"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
