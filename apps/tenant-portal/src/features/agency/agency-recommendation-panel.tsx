import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  evaluationRequest as api,
  type AgencyDetail,
  type AssessmentSession,
  type EvaluationView,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
const field = "w-full rounded border p-2 text-sm",
  button = "rounded border px-3 py-2 text-sm disabled:opacity-40";
type Candidate = {
  participationId: string;
  supplierName: string;
  metric: string | null;
  responseAmount: string;
  currency: string;
};
type Preview = {
  sourceFingerprint: string;
  comparisons: Candidate[];
  ties: string[][];
  blockers: string[];
};
type Report = {
  id: string;
  recommendationId: string;
  status: string;
  version: number;
  narrativeJson: string;
  artifactVersionId: string | null;
  artifactBasisVersion: number | null;
};
type W = {
  sourceFingerprint: string;
  recommendations: {
    recommendation: { id: string; ordinal: number; snapshotJson: string };
    stale: boolean;
  }[];
  reports: Report[];
  submissions: {
    id: string;
    reportId: string;
    status: string;
    workflowId: string;
  }[];
  blockers: string[];
};
export function AgencyRecommendationPanel({
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
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    base = `/packages/${detail.record.id}/sessions/${session.id}`,
    path = base + "/recommendation";
  const q = useQuery({
    queryKey: ["agency-recommendation", session.id],
    queryFn: () => api<W>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const prices = useQuery({
    queryKey: ["agency-recommendation-prices", session.id],
    queryFn: () =>
      api<{
        history: {
          calculation: { id: string; createdAt: string };
          stale: boolean;
        }[];
      }>(base + "/price-calculations"),
    enabled: open && round.config.evaluationMethod !== "consultation",
  });
  const totals = useQuery({
    queryKey: ["agency-recommendation-totals", session.id],
    queryFn: () =>
      api<{
        history: {
          snapshot: { id: string; createdAt: string };
          stale: boolean;
        }[];
      }>(base + "/totals"),
    enabled: open && round.config.evaluationMethod === "comprehensive",
  });
  const [price, setPrice] = useState(""),
    [total, setTotal] = useState(""),
    [locator, setLocator] = useState(""),
    [text, setText] = useState(""),
    [count, setCount] = useState("1"),
    [tie, setTie] = useState("manual_pending"),
    [preview, setPreview] = useState<Preview | null>(null),
    [previewBasis, setPreviewBasis] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [proof, setProof] = useState(""),
    [tieProof, setTieProof] = useState(""),
    [tieReason, setTieReason] = useState(""),
    [reason, setReason] = useState(""),
    [checked, setChecked] = useState(""),
    [reportRec, setReportRec] = useState(""),
    [reportId, setReportId] = useState(""),
    [narrative, setNarrative] = useState({
      reviewProcess: "",
      reasoning: "",
      exceptionHandling: "",
      conclusion: "",
    }),
    [dialog, setDialog] = useState(false),
    [error, setError] = useState("");
  const sole = round.config.evaluationMethod === "consultation",
    comprehensive = round.config.evaluationMethod === "comprehensive",
    rule = {
      ordering: sole
        ? "sole_source"
        : comprehensive
          ? "score_desc"
          : "price_asc",
      candidateCount: sole ? 1 : Number(count),
      tieHandling: tie,
      ruleText: text,
    },
    inputs = {
      priceCalculationId: sole ? null : price || null,
      totalSnapshotId: comprehensive ? total || null : null,
      documentRule: rule,
      configuredRule: rule,
      locator,
    },
    basis = JSON.stringify([inputs, q.data?.sourceFingerprint]),
    ack = JSON.stringify([
      basis,
      preview?.sourceFingerprint,
      selected,
      proof,
      tieProof,
      tieReason,
      reason,
      reportId,
      narrative,
    ]),
    current = preview && previewBasis === basis,
    report = q.data?.reports.find((r) => r.id === reportId),
    proofs = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map((v) => ({ id: v.id, name: f.file.name + " V" + v.ordinal })),
      ),
    statuses: Record<string, string> = {
      draft: "草稿",
      reviewing: "审核中",
      approved: "审核通过",
      rejected: "退回",
      processing: "办理中",
      withdrawn: "已撤回",
    };
  const act = (f: () => Promise<unknown>) =>
    run(async () => {
      setError("");
      try {
        await f();
      } catch (e) {
        setError(e instanceof Error ? e.message : "办理失败");
        throw e;
      }
      await q.refetch();
      setChecked("");
    });
  const command = () => ({
    expectedVersion: report?.version,
    expectedFingerprint: q.data?.sourceFingerprint,
    reviewed: checked === ack,
    reason,
    idempotencyKey: crypto.randomUUID(),
  });
  const selectProof = (
    label: string,
    value: string,
    set: (v: string) => void,
  ) => (
    <label className="block text-sm">
      {label}
      <select
        className={field}
        value={value}
        onChange={(e) => set(e.target.value)}
      >
        <option value="">选择已封存脱敏凭证</option>
        {proofs.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
  if (!can("buyer:agency:recommendation:read")) return null;
  return (
    <details
      className="rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>受控推荐与评审报告</summary>
      {q.error && <p role="alert">{(q.error as Error).message}</p>}
      {error && <p role="alert">{error}</p>}
      {open && q.data && (
        <div className="space-y-3 pt-3">
          <p className="text-sm">
            人工推荐绑定已确认的计算版本。报告内部审核、真实签署与采购人结果确认分别办理。
          </p>
          {q.data.blockers.map((b) => (
            <p key={b} role="alert">
              {b}
            </p>
          ))}
          <fieldset
            disabled={busy || !can("buyer:agency:recommendation:manage")}
            className="space-y-2"
          >
            <legend>核对采购文件中的推荐规则</legend>
            {!sole && (
              <label>
                已确认价格版本
                <select
                  aria-label="已确认价格版本"
                  className={field}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                >
                  <option value="">请选择</option>
                  {prices.data?.history
                    .filter((h) => !h.stale)
                    .map((h) => (
                      <option key={h.calculation.id} value={h.calculation.id}>
                        {h.calculation.createdAt}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {comprehensive && (
              <label>
                已确认综合汇总
                <select
                  className={field}
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                >
                  <option value="">请选择</option>
                  {totals.data?.history
                    .filter((h) => !h.stale)
                    .map((h) => (
                      <option key={h.snapshot.id} value={h.snapshot.id}>
                        {h.snapshot.createdAt}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              推荐规则原文位置
              <input
                className={field}
                value={locator}
                onChange={(e) => setLocator(e.target.value)}
              />
            </label>
            <label>
              核对后的原文规则
              <textarea
                className={field}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            {!sole && (
              <>
                <label>
                  文件规定推荐数量
                  <input
                    type="number"
                    min={1}
                    max={30}
                    className={field}
                    value={count}
                    onChange={(e) => setCount(e.target.value)}
                  />
                </label>
                <label>
                  同分或同价处理
                  <select
                    className={field}
                    value={tie}
                    onChange={(e) => setTie(e.target.value)}
                  >
                    <option value="manual_pending">
                      待有权主体处理，暂不确认推荐
                    </option>
                    <option value="manual_evidenced">
                      已有按适用规则办理的真实凭证
                    </option>
                  </select>
                </label>
              </>
            )}
            <button
              className={button}
              onClick={() =>
                void act(async () => {
                  const p = await api<Preview>(
                    path + "/preview",
                    "POST",
                    inputs,
                  );
                  setPreview(p);
                  setPreviewBasis(basis);
                  setSelected([]);
                })
              }
            >
              核对来源与比较明细
            </button>
            {current && (
              <>
                {preview.blockers.map((b) => (
                  <p role="alert" key={b}>
                    {b}
                  </p>
                ))}
                {preview.comparisons.map((r) => (
                  <label key={r.participationId} className="block">
                    <input
                      type="checkbox"
                      checked={selected.includes(r.participationId)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, r.participationId]
                            : selected.filter((id) => id !== r.participationId),
                        )
                      }
                    />
                    {r.supplierName} ·{" "}
                    {r.metric === null ? "专业协商" : `比较指标 ${r.metric}`} ·
                    响应金额 {r.responseAmount} {r.currency}
                    {selected.includes(r.participationId) &&
                      ` · 推荐次序 ${selected.indexOf(r.participationId) + 1}`}
                  </label>
                ))}
                {preview.ties.length > 0 && (
                  <>
                    <p>存在同分或同价，须先按适用规则有权处理。</p>
                    {selectProof("同分处理凭证", tieProof, setTieProof)}
                    <textarea
                      aria-label="同分处理依据"
                      className={field}
                      value={tieReason}
                      onChange={(e) => setTieReason(e.target.value)}
                    />
                  </>
                )}
              </>
            )}
            {selectProof("人工推荐凭证", proof, setProof)}
            <label>
              办理依据
              <textarea
                className={field}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={checked === ack}
                onChange={(e) => setChecked(e.target.checked ? ack : "")}
              />
              已人工核对当前来源、金额口径及本次办理内容
            </label>
            <button
              className={button}
              disabled={
                !current ||
                !!preview?.blockers.length ||
                checked !== ack ||
                !proof ||
                !reason
              }
              onClick={() =>
                void act(() =>
                  api(path, "POST", {
                    inputs,
                    expectedFingerprint: preview?.sourceFingerprint,
                    participationIds: selected,
                    evidenceVersionId: proof,
                    tieEvidenceVersionId: tieProof || null,
                    tieReason: tieReason || null,
                    reviewed: true,
                    reason,
                    idempotencyKey: crypto.randomUUID(),
                  }),
                )
              }
            >
              确认人工推荐快照
            </button>
          </fieldset>
          <div>
            {q.data.recommendations.map((h) => (
              <p key={h.recommendation.id}>
                推荐 V{h.recommendation.ordinal} ·{" "}
                {h.stale ? "来源已变化，保留历史" : "当前有效"} ·{" "}
                {JSON.parse(h.recommendation.snapshotJson)
                  .candidates.map((c: Candidate) => c.supplierName)
                  .join("、")}
              </p>
            ))}
          </div>
          {can("buyer:agency:report:manage") &&
            can("buyer:agency:report:confidential") && (
              <fieldset disabled={busy} className="space-y-2">
                <legend>编制与审核报告</legend>
                <label>
                  报告
                  <select
                    className={field}
                    value={reportId}
                    onChange={(e) => {
                      setReportId(e.target.value);
                      const r = q.data?.reports.find(
                        (r) => r.id === e.target.value,
                      );
                      if (r) setNarrative(JSON.parse(r.narrativeJson));
                    }}
                  >
                    <option value="">新建报告</option>
                    {q.data.reports.map((r, i) => (
                      <option key={r.id} value={r.id}>
                        报告 {q.data!.reports.length - i} · {statuses[r.status]}{" "}
                        · V{r.version}
                      </option>
                    ))}
                  </select>
                </label>
                {!report && (
                  <select
                    aria-label="报告推荐依据"
                    className={field}
                    value={reportRec}
                    onChange={(e) => setReportRec(e.target.value)}
                  >
                    <option value="">选择有效推荐</option>
                    {q.data.recommendations
                      .filter((h) => !h.stale)
                      .map((h) => (
                        <option
                          key={h.recommendation.id}
                          value={h.recommendation.id}
                        >
                          推荐 V{h.recommendation.ordinal}
                        </option>
                      ))}
                  </select>
                )}
                {(
                  [
                    ["reviewProcess", "实际评审过程"],
                    ["reasoning", "推荐理由"],
                    ["exceptionHandling", "异常处理或无异常核对"],
                    ["conclusion", "报告结论叙述"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="block">
                    {label}
                    <textarea
                      disabled={
                        !!report &&
                        !["draft", "rejected"].includes(report.status)
                      }
                      className={field}
                      value={narrative[key]}
                      onChange={(e) =>
                        setNarrative({ ...narrative, [key]: e.target.value })
                      }
                    />
                  </label>
                ))}
                <button
                  className={button}
                  disabled={
                    !!report && !["draft", "rejected"].includes(report.status)
                  }
                  onClick={() =>
                    void act(async () => {
                      const r = await api<Report>(
                        report
                          ? path + `/reports/${report.id}`
                          : path + "/reports",
                        report ? "PUT" : "POST",
                        {
                          recommendationId:
                            report?.recommendationId || reportRec,
                          expectedVersion: report?.version,
                          narrative,
                          idempotencyKey: crypto.randomUUID(),
                        },
                      );
                      setReportId(r.id);
                    })
                  }
                >
                  保存报告叙述
                </button>
                {report && ["draft", "rejected"].includes(report.status) && (
                  <>
                    <button
                      className={button}
                      disabled={
                        checked !== ack ||
                        Object.entries(narrative).some(
                          ([k, v]) => JSON.parse(report.narrativeJson)[k] !== v,
                        )
                      }
                      onClick={() =>
                        void act(() =>
                          api(
                            path + `/reports/${report.id}/generate`,
                            "POST",
                            command(),
                          ),
                        )
                      }
                    >
                      生成当前版本报告
                    </button>
                    <button
                      className={button}
                      disabled={
                        checked !== ack ||
                        report.artifactBasisVersion !== report.version
                      }
                      onClick={() => setDialog(true)}
                    >
                      提交独立审批
                    </button>
                  </>
                )}
                {q.data.submissions
                  .filter((s) => s.reportId === reportId)
                  .map((s) => (
                    <div key={s.id}>
                      <p>{statuses[s.status]}</p>
                      <WorkflowStatusPanel
                        businessType="agency_evaluation_report"
                        businessId={s.id}
                        hideBusinessSnapshot
                      />
                    </div>
                  ))}
              </fieldset>
            )}
        </div>
      )}
      {dialog && report && (
        <WorkflowSubmitDialog
          submissionError={error ? new Error(error) : undefined}
          title="提交评审报告审核"
          businessType="agency_evaluation_report"
          onClose={() => setDialog(false)}
          onSubmit={async (formData) => {
            const ok = await act(() =>
              api(path + `/reports/${report.id}/submit`, "POST", {
                ...command(),
                formData,
              }),
            );
            if (ok) setDialog(false);
          }}
        />
      )}
    </details>
  );
}
