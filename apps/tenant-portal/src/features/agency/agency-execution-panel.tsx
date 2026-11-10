import {AgencyRevisionAiPanel} from "./agency-revision-ai-panel";
import { AgencySmsPanel } from "./agency-sms-panel";
import { AgencyDocumentPreviewPanel } from "./agency-document-preview-panel";
import { AgencyOnlineOfficePanel } from "./agency-online-office-panel";
import { AgencyOfficePanel } from "./agency-office-panel";
import { AgencyArchivePanel } from "./agency-archive-panel";
import { AgencyFinancePanel } from "./agency-finance-panel";
import { AgencyPostPanel } from "./agency-post-panel";
import { AgencyEvaluationPanel } from "./agency-evaluation-panel";
import { AgencyPreparationFormsPanel } from "./agency-preparation-forms-panel";
import { AgencyParticipationImportPanel } from "./agency-participation-import-panel";
import {
  AgencyReminderPanel,
  AgencyReminderSettingsForm,
  defaultReminder,
} from "./agency-reminder-panel";
import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FeedbackNotice } from "@24bid/ui";
import {
  agencyFileDownload,
  agencyOptions,
  type AgencyReminderSettings,
  executionRequest as api,
  executionWorkspace,
  executionTemplates,
  type AgencyDetail,
  type ExecutionDocument,
  type ExecutionRevision,
  type ExecutionChapter,
  type ExecutionDemand,
  type ExecutionMilestone,
  type ExecutionParticipation,
  type ExecutionTemplate,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
const button =
  "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40";
const input =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900";
const label: Record<string, string> = {
  draft: "草稿",
  ready: "候选稿已生成",
  reviewing: "审批中",
  processing: "处理中",
  approved: "已通过",
  rejected: "已退回",
  withdrawn: "已撤回",
  candidate: "候选稿",
  published: "已发布",
  pending: "待确认",
  confirmed: "已确认",
  conflict: "存在冲突",
  superseded: "已替代",
  queued: "排队中",
  success: "成功",
  failed: "失败",
  stale: "输入已过期",
  planned: "待开始",
  doing: "进行中",
  not_applicable: "不适用",
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  cancelled: "已取消",
};
const message = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ||
  (e as Error)?.message ||
  "操作失败";
const key = () => crypto.randomUUID();
const date = (s?: string) => (s ? s.slice(0, 16).replace("T", " ") : "未设置");
const local = (s?: string) =>
  s
    ? new Date(new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const iso = (s: string) => (s ? new Date(s).toISOString() : null);
function Field({ name, children }: { name: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="grid gap-1 text-xs font-semibold text-slate-600">
      <label htmlFor={id}>{name}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/40 p-4">
      <h4 className="font-bold text-slate-900">{title}</h4>
      {children}
    </section>
  );
}
type Run = (job: () => Promise<unknown>) => Promise<boolean>;
type Submit = { type: string; id: string; template?: boolean };
export function AgencyExecutionPanel({ detail }: { detail: AgencyDetail }) {
  const { can } = useBuyerPermissions(),
    client = useQueryClient(),
    pkg = detail.record.id;
  const query = useQuery({
    queryKey: ["agency-execution", pkg],
    queryFn: () => executionWorkspace(pkg),
    refetchInterval: 5000,
  });
  const [tab, setTab] = useState("demand"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{
      tone: "error" | "success";
      message: string;
    } | null>(null),
    [submit, setSubmit] = useState<Submit | null>(null),
    [exception, setException] = useState(""),
    [submitError, setSubmitError] = useState<unknown>();
  const submitKey = useRef(key());
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["agency-execution", pkg] });
    await client.invalidateQueries({ queryKey: ["agency-detail", pkg] });
    await client.invalidateQueries({ queryKey: ["agency-templates", pkg] });
  };
  const run: Run = async (job) => {
    setBusy(true);
    setNotice(null);
    try {
      await job();
      await refresh();
      setNotice({ tone: "success", message: "操作已保存。" });
      return true;
    } catch (e) {
      setNotice({ tone: "error", message: message(e) });
      return false;
    } finally {
      setBusy(false);
    }
  };
  const open = (v: Submit) => {
    submitKey.current = key();
    setException("");
    setSubmitError(undefined);
    setSubmit(v);
  };
  const writable = detail.canEdit && !detail.record.workflowId;
  const manage = (point: string) => writable && can("buyer:agency:" + point);
  const files = detail.files.flatMap((f) =>
    f.versions
      .filter((v) => v.status === "sealed")
      .map((v) => ({ id: v.id, name: `${f.file.name} · V${v.ordinal}` })),
  );
  const fileOptions = (
    <>
      <option value="">请选择已封存资料版本</option>
      {files.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </>
  );
  const w = query.data;
  return (
    <section className="mt-6 space-y-4" aria-label="采购执行工作台">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">采购执行工作台</h3>
        <button className={button} onClick={() => void refresh()}>
          刷新执行状态
        </button>
      </div>
      <p className="text-xs text-slate-500">
        公共字段变化后须同步复核并重新生成送审稿。资料提取采用确定性规则，结果须人工确认；Office在线编辑按服务实际配置开放。
        {query.data?.aiEnabled ? "AI模型已配置，可对精确文件版本发起辅助复核；结果不改变审批或业务结论。" : "AI模型未配置，将按规则检查并明确标记回退。"}
      </p>
      {detail.record.workflowId && (
        <FeedbackNotice
          tone="info"
          message="重要变更审核期间，执行资料暂停修改。"
        />
      )}
      {notice && <FeedbackNotice {...notice} />}
      {query.isError && (
        <FeedbackNotice tone="error" message={message(query.error)} />
      )}
      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          ["demand", "需求资料"],
          ["documents", "文件编制与审批"],
          ["templates", "模板库"],
          ["publication", "发布登记"],
          ["participation", "参与台账"],
          ["plan", "项目计划"],
          ["preparation", "会前准备"],
          ["evaluation", "评审准备"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={
              button +
              (tab === id ? " border-blue-500 bg-blue-50 text-blue-700" : "")
            }
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </div>
      {!w ? (
        <p>加载执行资料中…</p>
      ) : (
        <>
          {tab === "demand" && can("buyer:agency:demand:read") && (
            <DemandPanel
              rows={w.requirements}
              pkg={pkg}
              fileOptions={fileOptions}
              run={run}
              busy={busy}
              editable={manage("demand:manage")}
            />
          )}
          {tab === "documents" && can("buyer:agency:document:read") && (
            <div className="space-y-4">
              {!w.documents.length && manage("document:manage") && (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void run(() => api(`/packages/${pkg}/documents`, "POST"))
                  }
                >
                  初始化采购文件与独立公告
                </button>
              )}
              {w.documents.map((d) => (
                <DocumentEditor
                  key={d.document.id}
                  view={d}
                  pkg={pkg}
                  fileOptions={fileOptions}
                  run={run}
                  busy={busy}
                  editable={manage("document:manage")}
                  submitAllowed={manage("document:submit")}
                  open={open}
                />
              ))}
            </div>
          )}
          {tab === "templates" && (
            <TemplatePanel
              pkg={pkg}
              method={detail.data.procurementMethod || ""}
              run={run}
              busy={busy}
              editable={manage("template:manage")}
              open={open}
            />
          )}
          {tab === "publication" && can("buyer:agency:document:read") && (
            <PublicationPanel
              pkg={pkg}
              workspace={w}
              fileOptions={fileOptions}
              run={run}
              busy={busy}
              editable={manage("publication:manage")}
              canRule={
                manage("publication:manage") &&
                can("buyer:agency:document:exception")
              }
            />
          )}
          {tab === "participation" &&
            can("buyer:agency:participation:read") && (
              <ParticipationPanel
                pkg={pkg}
                rows={w.participations}
                fileOptions={fileOptions}
                run={run}
                busy={busy}
                editable={manage("participation:manage")}
              />
            )}
          {tab === "evaluation" &&
            can("buyer:agency:evaluation:read") &&
            can("buyer:agency:evaluation:confidential") && (
              <AgencyEvaluationPanel
                detail={detail}
                editable={manage("evaluation:manage")}
                canFreeze={can("buyer:agency:evaluation:freeze")}
                run={run}
                busy={busy}
              />
            )}
          {tab === "plan" && can("buyer:agency:plan:read") && (
            <PlanPanel
              pkg={pkg}
              rows={w.milestones}
              members={detail.members}
              run={run}
              busy={busy}
              editable={manage("plan:manage")}
              legal={can("buyer:agency:plan:legal")}
              configure={can("buyer:agency:plan:configure")}
              method={detail.data.procurementMethod || ""}
            />
          )}
          {tab === "preparation" && can("buyer:agency:preparation:read") && (
            <>
              <PreparationPanel
                pkg={pkg}
                value={w.preparation}
                fileOptions={fileOptions}
                run={run}
                busy={busy}
                editable={
                  manage("preparation:manage") &&
                  can("buyer:agency:preparation:confidential")
                }
              />
              {can("buyer:agency:preparation:confidential") && (
                <AgencyPreparationFormsPanel
                  detail={detail}
                  run={run}
                  busy={busy}
                  editable={
                    manage("preparation:manage") &&
                    can("buyer:agency:preparation:confidential")
                  }
                />
              )}
            </>
          )}
          {!!w.jobs.length && (
            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-semibold">
                后台任务（{w.jobs.length}）
              </summary>
              {w.jobs.map((j) => (
                <div
                  key={j.id}
                  className="mt-2 flex flex-wrap items-center gap-2 text-xs"
                >
                  <span>
                    {j.kind === "compose"
                      ? "DOCX 合成"
                      : j.kind === "preview"
                        ? "PDF预览"
                        : "资料提取"}{" "}
                    · {label[j.status] || j.status} · 已尝试 {j.attempts} 次
                  </span>
                  {j.errorText && (
                    <span className="text-red-700">{j.errorText}</span>
                  )}
                  {j.status === "failed" && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void run(() => api(`/jobs/${j.id}/retry`, "POST"))
                      }
                    >
                      重试任务
                    </button>
                  )}
                  {j.resultJson && (
                    <details>
                      <summary>处理结果</summary>
                      <pre className="max-w-full whitespace-pre-wrap">
                        {JSON.stringify(JSON.parse(j.resultJson), null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </details>
          )}
        </>
      )}
      <AgencyPostPanel detail={detail} busy={busy} run={run} />
      <AgencyFinancePanel detail={detail} busy={busy} run={run} />
      <AgencyArchivePanel detail={detail} busy={busy} run={run} />
      <AgencyOfficePanel detail={detail} busy={busy} run={run} />
      {submit && (
        <WorkflowSubmitDialog
          businessType={submit.type}
          title={
            submit.template
              ? "公司模板发布"
              : submit.type === "agency_purchase_document"
                ? "完整采购文件审批"
                : "独立公告或邀请审批"
          }
          busy={busy}
          submissionError={submitError}
          onClose={() => {
            if (!busy) setSubmit(null);
          }}
          onSubmit={(form) => {
            setBusy(true);
            void api(
              `/${submit.template ? "template-versions" : "revisions"}/${submit.id}/submit`,
              "POST",
              {
                idempotencyKey: submitKey.current,
                exceptionReason: exception,
                formData: form,
              },
            )
              .then(async () => {
                setSubmit(null);
                await refresh();
                setNotice({ tone: "success", message: "已提交独立审批。" });
              })
              .catch(setSubmitError)
              .finally(() => setBusy(false));
          }}
        >
          <p className="text-sm">
            送审将冻结当前候选稿、来源和公共字段快照，发起人不得自审。
          </p>
          {!submit.template && can("buyer:agency:document:exception") && (
            <Field name="完整性例外说明（有缺项时必填）">
              <textarea
                className={input}
                value={exception}
                onChange={(e) => setException(e.target.value)}
              />
            </Field>
          )}
        </WorkflowSubmitDialog>
      )}
    </section>
  );
}
function DemandPanel({
  rows,
  pkg,
  fileOptions,
  run,
  busy,
  editable,
}: {
  rows: ExecutionDemand[];
  pkg: string;
  fileOptions: ReactNode;
  run: Run;
  busy: boolean;
  editable: boolean;
}) {
  const [source, setSource] = useState(""),
    [field, setField] = useState(""),
    [value, setValue] = useState(""),
    [locator, setLocator] = useState("");
  return (
    <Box title="来源可追溯的结构化需求">
      <p className="text-xs text-slate-500">
        先在项目文件区上传需求资料。提取支持 TXT、DOCX
        的明确“字段：值”文本；扫描件、PDF
        与复杂表格请人工核对录入。受限资料须先形成可在项目内使用的脱敏版本。
      </p>
      {editable && (
        <>
          <Field name="需求资料版本">
            <select
              className={input}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {fileOptions}
            </select>
          </Field>
          <button
            className={button}
            disabled={busy || !source}
            onClick={() =>
              void run(() =>
                api(`/packages/${pkg}/extractions`, "POST", {
                  sourceVersionIds: [source],
                  idempotencyKey: key(),
                }),
              )
            }
          >
            提取待确认候选
          </button>
          <div className="grid gap-2 md:grid-cols-3">
            <Field name="需求字段">
              <input
                className={input}
                value={field}
                onChange={(e) => setField(e.target.value)}
              />
            </Field>
            <Field name="需求值">
              <input
                className={input}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </Field>
            <Field name="来源页码、段落或位置">
              <input
                className={input}
                value={locator}
                onChange={(e) => setLocator(e.target.value)}
              />
            </Field>
          </div>
          <button
            className={button}
            disabled={busy || !source || !field || !value || !locator}
            onClick={() =>
              void run(() =>
                api(`/packages/${pkg}/requirements`, "POST", {
                  fieldKey: field,
                  valueText: value,
                  sourceVersionId: source,
                  locator,
                  status: "pending",
                }),
              )
            }
          >
            新增人工需求项
          </button>
        </>
      )}
      {!rows.length && <p className="text-sm text-slate-500">尚无需求项。</p>}
      {rows.map((r) => (
        <div key={r.id} className="rounded border bg-white p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <strong>
              {r.fieldKey}：{r.valueText}
            </strong>
            <span>
              {label[r.status]} · V{r.version}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-slate-500">
            {r.origin === "manual" ? "人工录入" : "规则提取"} · {r.locator} ·
            来源 {r.sourceVersionId}
          </p>
          {editable && (
            <div className="mt-2 flex gap-2">
              {["confirmed", "superseded", "conflict"]
                .filter((v) => v !== r.status)
                .map((status) => (
                  <button
                    key={status}
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        api(`/packages/${pkg}/requirements/${r.id}`, "PUT", {
                          ...r,
                          expectedVersion: r.version,
                          status,
                        }),
                      )
                    }
                  >
                    {label[status]}
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}
    </Box>
  );
}
function DocumentEditor({
  view,
  pkg,
  fileOptions,
  run,
  busy,
  editable,
  submitAllowed,
  open,
}: {
  view: ExecutionDocument;
  pkg: string;
  fileOptions: ReactNode;
  run: Run;
  busy: boolean;
  editable: boolean;
  submitAllowed: boolean;
  open: (s: Submit) => void;
}) {
  const d = view.document,
    [sections, setSections] = useState(view.sections),
    [settings, setSettings] = useState(view.settings),
    [baseVersion, setBaseVersion] = useState(d.version),
    [dirty, setDirty] = useState(false),
    [source, setSource] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [note, setNote] = useState(""),
    [reason, setReason] = useState(""),
    [historical, setHistorical] = useState<
      { revisionId: string; title: string; sourceKind: string }[]
    >([]),
    [historyId, setHistoryId] = useState("");
  const [template, setTemplate] = useState("");
  const templates = useQuery({
    queryKey: ["agency-templates", pkg],
    queryFn: () => executionTemplates(pkg),
  });
  useEffect(() => {
    if (!dirty) {
      setSections(view.sections);
      setSettings(view.settings);
      setBaseVersion(d.version);
    }
  }, [d.version, dirty]);
  const locked = !editable || d.status === "reviewing" || busy;
  const current = view.revisions.find((r) => r.id === d.currentRevisionId);
  const modify = (i: number, patch: Partial<ExecutionChapter>) => {
    setSections((s) => s.map((c, n) => (i === n ? { ...c, ...patch } : c)));
    setDirty(true);
  };
  const action = (suffix: string, data: unknown) =>
    run(() => api(`/documents/${d.id}/${suffix}`, "POST", data));
  const download = (r: ExecutionRevision) =>
    run(async () => {
      const a = await api<{ attachmentId: string; name: string }>(
        `/revisions/${r.id}/artifact`,
      );
      await agencyFileDownload(a.attachmentId, a.name);
    });
  return (
    <Box
      title={`${d.kind === "purchase" ? "完整采购文件" : "独立公告或邀请"} · ${label[d.status] || d.status} · V${d.version}`}
    >
      {view.basisStale && (
        <FeedbackNotice
          tone="error"
          message="公共字段或已确认需求已变化。请保存本地修改后同步复核，再生成新候选稿。"
        />
      )}
      {dirty && (
        <p className="text-sm text-amber-700">
          有未保存修改
          {baseVersion !== d.version
            ? "；服务器已出现新版本，保存将检查冲突。"
            : ""}
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-semibold">
          公共发布要素与一致性检查
        </summary>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {[
            ["fileGetStart", "文件获取开始"],
            ["fileGetEnd", "文件获取结束"],
            ["submissionDeadline", "提交截止"],
            ["openingAt", "开启时间"],
            ["venue", "地点"],
            ["contact", "联系人"],
            ["phone", "联系电话"],
          ].map(([k, n]) => (
            <Field key={k} name={n}>
              <input
                className={input}
                type={
                  ["venue", "contact", "phone"].includes(k)
                    ? "text"
                    : "datetime-local"
                }
                disabled={locked}
                value={
                  ["venue", "contact", "phone"].includes(k)
                    ? settings[k] || ""
                    : local(settings[k])
                }
                onChange={(e) => {
                  setSettings({
                    ...settings,
                    [k]: ["venue", "contact", "phone"].includes(k)
                      ? e.target.value
                      : iso(e.target.value) || "",
                  });
                  setDirty(true);
                }}
              />
            </Field>
          ))}
        </div>
      </details>
      {view.issues.length > 0 && (
        <ul className="list-inside list-disc text-xs text-amber-800">
          {view.issues.map((v, i) => (
            <li key={i}>{v}</li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {sections.map((c, i) => (
          <details key={c.code} className="rounded border bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold">
              {i + 1}. {c.title}
              {c.required ? " *" : ""}
            </summary>
            <div className="mt-3 space-y-2">
              <Field name="章节标题">
                <input
                  className={input}
                  value={c.title}
                  disabled={locked}
                  onChange={(e) => modify(i, { title: e.target.value })}
                />
              </Field>
              <Field name="正文（支持 {{projectTitle}}、{{projectNumber}}、{{requirement.字段名}} 等公共变量）">
                <textarea
                  className={input + " min-h-40"}
                  value={c.body}
                  disabled={locked}
                  onChange={(e) => modify(i, { body: e.target.value })}
                />
              </Field>
              {editable && (
                <div className="flex gap-2">
                  <button
                    className={button}
                    disabled={locked || i === 0}
                    onClick={() => {
                      setSections((s) => {
                        const a = [...s];
                        [a[i - 1], a[i]] = [a[i], a[i - 1]];
                        return a;
                      });
                      setDirty(true);
                    }}
                  >
                    上移
                  </button>
                  <button
                    className={button}
                    disabled={locked || c.required}
                    onClick={() => {
                      setSections((s) => s.filter((_, n) => n !== i));
                      setDirty(true);
                    }}
                  >
                    删除可选章
                  </button>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
      {editable && (
        <div className="flex flex-wrap gap-2">
          <button
            className={button}
            disabled={locked || sections.length >= 30}
            onClick={() => {
              setSections((s) => [
                ...s,
                {
                  code: "custom_" + key().slice(0, 8),
                  title: "补充章节",
                  body: "",
                  required: false,
                },
              ]);
              setDirty(true);
            }}
          >
            增加章节
          </button>
          <button
            className={button}
            disabled={locked || !dirty}
            onClick={async () => {
              if (
                await run(() =>
                  api(`/documents/${d.id}`, "PUT", {
                    expectedVersion: baseVersion,
                    sections,
                    settings,
                  }),
                )
              )
                setDirty(false);
            }}
          >
            保存章节与要素
          </button>
          {dirty && (
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setDirty(false);
                setSections(view.sections);
                setSettings(view.settings);
                setBaseVersion(d.version);
              }}
            >
              放弃本地修改
            </button>
          )}
          <button
            className={button}
            disabled={locked || dirty}
            onClick={() => void action("sync", { expectedVersion: d.version })}
          >
            同步复核公共字段
          </button>
          {d.kind === "purchase" && (
            <button
              className={button}
              disabled={locked || dirty}
              onClick={() =>
                void action("sync-notice", { expectedVersion: d.version })
              }
            >
              同步独立公告章节
            </button>
          )}
          <button
            className={button}
            disabled={locked || dirty || view.basisStale}
            onClick={() =>
              void action("compose", {
                expectedVersion: d.version,
                idempotencyKey: key(),
              })
            }
          >
            生成 DOCX 候选稿
          </button>
        </div>
      )}
      {editable && (
        <details>
          <summary className="cursor-pointer text-sm">
            引用模板、历史稿或上传整份 Word
          </summary>
          <div className="mt-3 space-y-3">
            <Field name="适用模板版本">
              <select
                className={input}
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">选择公司已发布或本包自有模板</option>
                {templates.data
                  ?.filter((t) => t.template.active)
                  .flatMap((t) =>
                    t.versions
                      .filter(
                        (v) =>
                          t.template.scope === "project" ||
                          v.id === t.template.publishedVersionId,
                      )
                      .map((v) => (
                        <option value={v.id} key={v.id}>
                          {t.template.name} · V{v.ordinal}
                        </option>
                      )),
                  )}
              </select>
            </Field>
            <button
              className={button}
              disabled={locked || dirty || !template}
              onClick={() =>
                void action("template", {
                  expectedVersion: d.version,
                  templateVersionId: template,
                })
              }
            >
              复制模板到当前草稿
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () =>
                  setHistorical(await api("/historical-documents")),
                )
              }
            >
              检索权限范围内历史已审采购稿
            </button>
            {historical.length > 0 && (
              <>
                <select
                  aria-label="历史稿"
                  className={input}
                  value={historyId}
                  onChange={(e) => setHistoryId(e.target.value)}
                >
                  <option value="">请选择历史稿</option>
                  {historical.map((h) => (
                    <option key={h.revisionId} value={h.revisionId}>
                      {h.title} ·{" "}
                      {h.sourceKind === "uploaded" ? "整份 Word" : "结构化章节"}
                    </option>
                  ))}
                </select>
                <Field name="历史条款适用性复核说明">
                  <input
                    className={input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <button
                  className={button}
                  disabled={locked || dirty || !historyId || !reason}
                  onClick={() =>
                    void action("historical", {
                      expectedVersion: d.version,
                      sourceRevisionId: historyId,
                      reason,
                    })
                  }
                >
                  复制历史条款，重新复核送审
                </button>
              </>
            )}
            <Field name="已上传封存的整份 DOCX">
              <select
                className={input}
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {fileOptions}
              </select>
            </Field>
            <Field name="整稿人工复核说明">
              <textarea
                className={input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              已核对正文、章节、公共要素及整稿适用性
            </label>
            <button
              className={button}
              disabled={locked || dirty || !source || !confirmed || !note}
              onClick={() =>
                void action("whole", {
                  expectedVersion: d.version,
                  fileVersionId: source,
                  manuallyConfirmed: confirmed,
                  note,
                  idempotencyKey: key(),
                })
              }
            >
              登记整稿候选（不自动拆章）
            </button>
          </div>
        </details>
      )}
      <AgencyOnlineOfficePanel
        view={view}
        busy={busy}
        run={run}
        dirty={dirty}
      />
      {current && (
        <p className="break-all text-xs text-slate-500">
          当前候选稿 {current.id} · SHA-256 {current.hash}
        </p>
      )}
      {view.revisions.map((r) => (
        <div
          key={r.id}
          className="space-y-2 rounded border bg-white p-3 text-xs"
        >
          <AgencyDocumentPreviewPanel revisionId={r.id} busy={busy} run={run} />
          <AgencyRevisionAiPanel revisionId={r.id}/>
          <div className="flex flex-wrap items-center gap-2">
            <span>
              输入 V{r.inputVersion} ·{" "}
              {r.sourceKind === "uploaded" ? "上传整稿" : "章节合成"} ·{" "}
              {label[r.status]}
            </span>
            <button
              className={button}
              disabled={busy}
              onClick={() => void download(r)}
            >
              下载不可变稿件
            </button>
            {submitAllowed &&
              r.id === d.currentRevisionId &&
              ["candidate", "rejected", "withdrawn"].includes(r.status) && (
                <button
                  className={button}
                  disabled={busy || dirty || view.basisStale}
                  onClick={() =>
                    open({
                      type:
                        d.kind === "purchase"
                          ? "agency_purchase_document"
                          : "agency_announcement",
                      id: r.id,
                    })
                  }
                >
                  提交{d.kind === "purchase" ? "整稿" : "公告"}审批
                </button>
              )}
            {editable && r.status === "processing" && (
              <button
                className={button}
                disabled={busy || !note}
                onClick={() =>
                  void run(() =>
                    api(`/revisions/${r.id}/withdraw`, "POST", {
                      reason: note,
                    }),
                  )
                }
              >
                按复核说明撤回
              </button>
            )}
          </div>
          {r.workflowId && (
            <WorkflowStatusPanel
              businessType={
                d.kind === "purchase"
                  ? "agency_purchase_document"
                  : "agency_announcement"
              }
              businessId={r.id}
            />
          )}
        </div>
      ))}
    </Box>
  );
}
function TemplatePanel({
  pkg,
  method,
  run,
  busy,
  editable,
  open,
}: {
  pkg: string;
  method: string;
  run: Run;
  busy: boolean;
  editable: boolean;
  open: (s: Submit) => void;
}) {
  const { can } = useBuyerPermissions();
  const [sourceDate, setSourceDate] = useState(""),
    [policyVersion, setPolicyVersion] = useState("");
  const [promotion, setPromotion] = useState<{
    id: string;
    name: string;
    sourceNote: string;
    sourceDate: string;
    policyVersion: string;
    key: string;
  } | null>(null);
  const [keyword, setKeyword] = useState(""),
    [name, setName] = useState(""),
    [scope, setScope] = useState("project"),
    [sourceNote, setSourceNote] = useState(""),
    [sections, setSections] = useState<ExecutionChapter[]>([
      {
        code: "notice",
        title: "采购公告或邀请",
        body: "项目：{{projectTitle}}\n编号：{{projectNumber}}",
        required: true,
      },
    ]),
    [editing, setEditing] = useState<ExecutionTemplate | null>(null),
    [reason, setReason] = useState("");
  const query = useQuery({
    queryKey: ["agency-templates", pkg, keyword],
    queryFn: () => executionTemplates(pkg, keyword),
  });
  const create = async () => {
    const t = editing?.template;
    const body = {
      expectedVersion: t?.version,
      packageId: scope === "project" ? pkg : null,
      name,
      scope,
      procurementMethod: method,
      objectCode: t?.objectCode,
      regime: t?.regime,
      region: t?.region,
      description: t?.description,
      sections,
      sourceNote,
      sourceDate: sourceDate || null,
      policyVersion,
    };
    if (
      await run(() =>
        api(t ? `/templates/${t.id}/versions` : "/templates", "POST", body),
      )
    ) {
      setEditing(null);
      setName("");
      await query.refetch();
    }
  };
  return (
    <Box title="版本化模板库">
      <p className="text-xs text-slate-500">
        公司模板通过独立审批后供全公司引用；项目自有模板仅用于本包。引用会复制版本快照，模板更新不会覆盖已编稿件。适用依据须人工复核。
      </p>
      <Field name="按名称、采购方式、标的、制度、地域或说明检索">
        <input
          className={input}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </Field>
      {query.isError && (
        <FeedbackNotice tone="error" message={message(query.error)} />
      )}
      {promotion && (
        <div className="space-y-2 rounded border border-blue-200 bg-blue-50 p-3">
          <h5 className="font-semibold">申请纳入公司模板库</h5>
          <p className="text-xs">
            复制所选项目模板的不可变章节版本，保留来源链。新公司模板先为草稿，另行送审通过后才可供项目引用。
          </p>
          <Field name="申请公司模板名称">
            <input
              className={input}
              value={promotion.name}
              onChange={(e) =>
                setPromotion({ ...promotion, name: e.target.value })
              }
            />
          </Field>
          <Field name="纳入公司库适用性说明">
            <textarea
              className={input}
              value={promotion.sourceNote}
              onChange={(e) =>
                setPromotion({ ...promotion, sourceNote: e.target.value })
              }
            />
          </Field>
          <Field name="申请来源日期">
            <input
              className={input}
              type="date"
              value={promotion.sourceDate}
              onChange={(e) =>
                setPromotion({ ...promotion, sourceDate: e.target.value })
              }
            />
          </Field>
          <Field name="申请政策或制度版本">
            <input
              className={input}
              value={promotion.policyVersion}
              onChange={(e) =>
                setPromotion({ ...promotion, policyVersion: e.target.value })
              }
            />
          </Field>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={busy || !promotion.name || !promotion.sourceNote}
              onClick={async () => {
                if (
                  await run(() =>
                    api(`/template-versions/${promotion.id}/promote`, "POST", {
                      ...promotion,
                      sourceDate: promotion.sourceDate || null,
                      idempotencyKey: promotion.key,
                    }),
                  )
                ) {
                  setPromotion(null);
                  await query.refetch();
                }
              }}
            >
              保存公司模板申请草稿
            </button>
            <button
              className={button}
              disabled={busy}
              onClick={() => setPromotion(null)}
            >
              取消申请
            </button>
          </div>
        </div>
      )}
      {query.data?.map((t) => (
        <details key={t.template.id} className="rounded border bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            {t.template.name} ·{" "}
            {t.template.scope === "company" ? "公司" : "本包"} ·{" "}
            {t.template.active ? "启用" : "停用"} ·{" "}
            {t.template.procurementMethod}
          </summary>
          <div className="mt-2 space-y-2">
            {t.versions.map((v) => (
              <div key={v.id} className="rounded bg-slate-50 p-2 text-xs">
                <p>
                  V{v.ordinal} · {label[v.status]} · {v.sourceNote}
                </p>
                <p className="text-xs text-slate-500">
                  来源日期：{v.sourceDate || "未填写"} · 政策/制度版本：
                  {v.policyVersion || "未填写"}
                  {v.originTemplateVersionId && " · 从项目模板申请纳入"}
                </p>
                {editable && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => {
                        setEditing(t);
                        setName(t.template.name);
                        setScope(t.template.scope);
                        setSections(JSON.parse(v.sectionsJson));
                        setSourceNote("");
                        setSourceDate(v.sourceDate || "");
                        setPolicyVersion(v.policyVersion || "");
                      }}
                    >
                      以此创建下一版本
                    </button>
                    {t.template.scope === "company" &&
                      ["draft", "rejected", "withdrawn"].includes(v.status) && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            open({
                              type: "agency_template_publication",
                              id: v.id,
                              template: true,
                            })
                          }
                        >
                          送审发布模板
                        </button>
                      )}
                    {t.template.scope === "project" &&
                      can("buyer:agency:template:promote") && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            setPromotion({
                              id: v.id,
                              name: t.template.name + "（公司版）",
                              sourceNote: v.sourceNote,
                              sourceDate: v.sourceDate || "",
                              policyVersion: v.policyVersion || "",
                              key: key(),
                            })
                          }
                        >
                          申请纳入公司模板库
                        </button>
                      )}
                    {v.status === "processing" && (
                      <button
                        className={button}
                        disabled={busy || !reason}
                        onClick={() =>
                          void run(() =>
                            api(`/template-versions/${v.id}/withdraw`, "POST", {
                              reason,
                            }),
                          )
                        }
                      >
                        撤回模板审批
                      </button>
                    )}
                  </div>
                )}
                {v.workflowId && (
                  <WorkflowStatusPanel
                    businessType="agency_template_publication"
                    businessId={v.id}
                  />
                )}
              </div>
            ))}
            {editable && (
              <>
                <Field name="启停或撤回原因">
                  <input
                    className={input}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
                <button
                  className={button}
                  disabled={busy || !reason}
                  onClick={() =>
                    void run(() =>
                      api(`/templates/${t.template.id}/active`, "POST", {
                        expectedVersion: t.template.version,
                        active: !t.template.active,
                        reason,
                      }),
                    )
                  }
                >
                  {t.template.active ? "停用模板" : "启用模板"}
                </button>
              </>
            )}
          </div>
        </details>
      ))}
      {editable && (
        <details open={!!editing}>
          <summary className="cursor-pointer text-sm font-semibold">
            {editing ? "创建模板下一版本" : "创建新模板"}
          </summary>
          <div className="mt-3 space-y-3">
            <Field name="模板名称">
              <input
                className={input}
                value={name}
                disabled={!!editing}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field name="模板范围">
              <select
                className={input}
                value={scope}
                disabled={!!editing}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="project">项目自有模板</option>
                <option value="company">公司模板（须审核发布）</option>
              </select>
            </Field>
            <Field name="来源、制度版本及适用依据">
              <textarea
                className={input}
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
              />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field name="模板来源日期">
                <input
                  className={input}
                  type="date"
                  value={sourceDate}
                  onChange={(e) => setSourceDate(e.target.value)}
                />
              </Field>
              <Field name="政策或制度版本">
                <input
                  className={input}
                  value={policyVersion}
                  onChange={(e) => setPolicyVersion(e.target.value)}
                />
              </Field>
            </div>
            {sections.map((c, i) => (
              <div key={c.code} className="space-y-2 rounded border p-3">
                <Field name={`章节 ${i + 1} 标题`}>
                  <input
                    className={input}
                    value={c.title}
                    onChange={(e) =>
                      setSections((s) =>
                        s.map((v, n) =>
                          i === n ? { ...v, title: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <Field name="章节正文">
                  <textarea
                    className={input + " min-h-24"}
                    value={c.body}
                    onChange={(e) =>
                      setSections((s) =>
                        s.map((v, n) =>
                          i === n ? { ...v, body: e.target.value } : v,
                        ),
                      )
                    }
                  />
                </Field>
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.required}
                    onChange={(e) =>
                      setSections((s) =>
                        s.map((v, n) =>
                          i === n ? { ...v, required: e.target.checked } : v,
                        ),
                      )
                    }
                  />
                  必需章节
                </label>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                className={button}
                disabled={busy || sections.length >= 30}
                onClick={() =>
                  setSections((s) => [
                    ...s,
                    {
                      code: "chapter_" + key().slice(0, 8),
                      title: "新章节",
                      body: "",
                      required: true,
                    },
                  ])
                }
              >
                增加模板章节
              </button>
              <button
                className={button}
                disabled={busy || !name || !sourceNote}
                onClick={() => void create()}
              >
                保存不可变模板版本
              </button>
              {editing && (
                <button className={button} onClick={() => setEditing(null)}>
                  取消新增版本
                </button>
              )}
            </div>
          </div>
        </details>
      )}
    </Box>
  );
}
function PublicationPanel({
  pkg,
  workspace: w,
  fileOptions,
  run,
  busy,
  editable,
  canRule,
}: {
  pkg: string;
  workspace: import("@24bid/api-client").ExecutionWorkspace;
  fileOptions: ReactNode;
  run: Run;
  busy: boolean;
  editable: boolean;
  canRule: boolean;
}) {
  const [applicable, setApplicable] = useState(
      w.publicationRule?.announcementApplicable ?? true,
    ),
    [reason, setReason] = useState(w.publicationRule?.reason || ""),
    [evidence, setEvidence] = useState(""),
    [platform, setPlatform] = useState(""),
    [at, setAt] = useState(""),
    [url, setUrl] = useState(""),
    [proof, setProof] = useState("");
  return (
    <Box title="人工发布与凭证登记">
      <FeedbackNotice
        tone={w.readiness?.ready ? "success" : "info"}
        message={
          w.readiness?.ready
            ? "当前版本满足发布登记条件。"
            : w.readiness?.reasons.join("；") ||
              "请先完成采购文件及适用公告审批。"
        }
      />
      {canRule && (
        <details>
          <summary className="cursor-pointer text-sm">公告或邀请适用性</summary>
          <div className="mt-3 space-y-2">
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={applicable}
                onChange={(e) => setApplicable(e.target.checked)}
              />
              本包适用独立公告或邀请
            </label>
            <Field name="适用性依据">
              <textarea
                className={input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field name="依据材料版本">
              <select
                className={input}
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
              >
                {fileOptions}
              </select>
            </Field>
            <button
              className={button}
              disabled={busy || !reason || !evidence}
              onClick={() =>
                void run(() =>
                  api(`/packages/${pkg}/publication-rule`, "POST", {
                    expectedVersion: w.publicationRule?.version ?? 0,
                    applicable,
                    reason,
                    evidenceVersionId: evidence,
                  }),
                )
              }
            >
              保存适用性依据
            </button>
          </div>
        </details>
      )}
      {editable && (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            <Field name="实际发布平台或渠道">
              <input
                className={input}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              />
            </Field>
            <Field name="已发生的发布时间">
              <input
                className={input}
                type="datetime-local"
                value={at}
                onChange={(e) => setAt(e.target.value)}
              />
            </Field>
            <Field name="发布链接（与凭证至少填写一项）">
              <input
                className={input}
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
            <Field name="发布凭证">
              <select
                className={input}
                value={proof}
                onChange={(e) => setProof(e.target.value)}
              >
                {fileOptions}
              </select>
            </Field>
          </div>
          <button
            className={button}
            disabled={
              busy ||
              !w.readiness?.ready ||
              !platform ||
              !at ||
              (!url && !proof)
            }
            onClick={() =>
              void run(() =>
                api(`/packages/${pkg}/publications`, "POST", {
                  idempotencyKey: key(),
                  purchaseRevisionId: w.readiness?.purchaseRevisionId,
                  announcementRevisionId:
                    w.readiness?.announcementRevisionId ?? null,
                  platform,
                  publishedAt: iso(at),
                  url: url || null,
                  evidenceVersionId: proof || null,
                }),
              )
            }
          >
            登记已完成的人工发布
          </button>
        </>
      )}
      {w.publications.map((p) => (
        <div key={p.id} className="rounded border bg-white p-3 text-sm">
          <strong>{p.platform}</strong> · {date(p.publishedAt)}
          {p.url && (
            <a
              className="ml-2 text-blue-700 underline"
              href={p.url}
              target="_blank"
              rel="noreferrer"
            >
              查看发布链接
            </a>
          )}
          <p className="break-all text-xs text-slate-500">
            引用采购稿 {p.purchaseRevisionId}
            {p.announcementRevisionId && `，公告稿 ${p.announcementRevisionId}`}
          </p>
        </div>
      ))}
    </Box>
  );
}
const emptyParticipation = {
  supplierName: "",
  creditCode: "",
  contact: "",
  phone: "",
  source: "",
  acquisitionStatus: "unknown",
  submissionStatus: "unknown",
  riskNote: "",
  riskStatus: "pending",
  evidenceVersionId: "",
  notes: "",
};
function ParticipationPanel({
  pkg,
  rows,
  fileOptions,
  run,
  busy,
  editable,
}: {
  pkg: string;
  rows: ExecutionParticipation[];
  fileOptions: ReactNode;
  run: Run;
  busy: boolean;
  editable: boolean;
}) {
  const [editing, setEditing] = useState<ExecutionParticipation | null>(null),
    [form, setForm] = useState({ ...emptyParticipation });
  return (
    <Box title="供应商参与台账">
      <AgencyParticipationImportPanel
        pkg={pkg}
        fileOptions={fileOptions}
        run={run}
        busy={busy}
        editable={editable}
      />
      <p className="text-xs text-slate-500">
        用于内部记录文件获取、响应提交和风险复核。台账不产生供应商准入、资格审查或成交结论。
      </p>
      {rows.map((r) => (
        <div key={r.id} className="rounded border bg-white p-3 text-sm">
          <strong>{r.supplierName}</strong>
          {r.importId && (
            <span className="ml-2 text-xs text-slate-500">
              批量来源记录 {r.sourceRow}
            </span>
          )}{" "}
          · 文件
          {
            (
              {
                unknown: "待核对",
                acquired: "已获取",
                not_applicable: "不适用",
              } as Record<string, string>
            )[r.acquisitionStatus]
          }{" "}
          · 响应
          {
            (
              {
                unknown: "待核对",
                submitted: "已提交",
                withdrawn: "已撤回",
              } as Record<string, string>
            )[r.submissionStatus]
          }
          <p className="text-xs">
            {r.contact} {r.phone} · {r.source} · {r.notes}
          </p>
          {editable && (
            <button
              className={button}
              disabled={busy}
              onClick={() => {
                setEditing(r);
                setForm({ ...r, evidenceVersionId: r.evidenceVersionId || "" });
              }}
            >
              修订台账
            </button>
          )}
        </div>
      ))}
      {editable && (
        <div className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            {[
              ["supplierName", "供应商名称"],
              ["creditCode", "统一社会信用代码"],
              ["contact", "联系人"],
              ["phone", "电话"],
              ["source", "来源"],
              ["notes", "备注"],
            ].map(([k, n]) => (
              <Field key={k} name={n}>
                <input
                  className={input}
                  value={form[k as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </Field>
            ))}
            <Field name="文件获取">
              <select
                className={input}
                value={form.acquisitionStatus}
                onChange={(e) =>
                  setForm({ ...form, acquisitionStatus: e.target.value })
                }
              >
                <option value="unknown">待核对</option>
                <option value="acquired">已获取</option>
                <option value="not_applicable">不适用</option>
              </select>
            </Field>
            <Field name="响应提交">
              <select
                className={input}
                value={form.submissionStatus}
                onChange={(e) =>
                  setForm({ ...form, submissionStatus: e.target.value })
                }
              >
                <option value="unknown">待核对</option>
                <option value="submitted">已提交</option>
                <option value="withdrawn">已撤回</option>
              </select>
            </Field>
            <Field name="风险复核">
              <select
                className={input}
                value={form.riskStatus}
                onChange={(e) =>
                  setForm({ ...form, riskStatus: e.target.value })
                }
              >
                <option value="pending">待复核</option>
                <option value="checked">已复核</option>
                <option value="not_applicable">不适用</option>
              </select>
            </Field>
          </div>
          <Field name="风险说明">
            <textarea
              className={input}
              value={form.riskNote}
              onChange={(e) => setForm({ ...form, riskNote: e.target.value })}
            />
          </Field>
          <Field name="凭证版本（可选）">
            <select
              className={input}
              value={form.evidenceVersionId}
              onChange={(e) =>
                setForm({ ...form, evidenceVersionId: e.target.value })
              }
            >
              {fileOptions}
            </select>
          </Field>
          <button
            className={button}
            disabled={busy || !form.supplierName}
            onClick={async () => {
              if (
                await run(() =>
                  api(
                    `/packages/${pkg}/participations${editing ? "/" + editing.id : ""}`,
                    editing ? "PUT" : "POST",
                    {
                      ...form,
                      expectedVersion: editing?.version,
                      evidenceVersionId: form.evidenceVersionId || null,
                    },
                  ),
                )
              ) {
                setEditing(null);
                setForm({ ...emptyParticipation });
              }
            }}
          >
            {editing ? "保存修订" : "新增参与记录"}
          </button>
          {editing && (
            <button
              className={button}
              onClick={() => {
                setEditing(null);
                setForm({ ...emptyParticipation });
              }}
            >
              取消修订
            </button>
          )}
        </div>
      )}
    </Box>
  );
}
function PlanPanel({
  pkg,
  rows,
  members,
  run,
  busy,
  editable,
  legal,
  configure,
  method,
}: {
  pkg: string;
  rows: ExecutionMilestone[];
  members: AgencyDetail["members"];
  run: Run;
  busy: boolean;
  editable: boolean;
  legal: boolean;
  configure: boolean;
  method: string;
}) {
  const [editing, setEditing] = useState<ExecutionMilestone | null>(null),
    [creating, setCreating] = useState(false),
    [form, setForm] = useState({
      title: "",
      ownerId: "",
      startsAt: "",
      dueAt: "",
      dependencies: [] as string[],
      materialRequirement: "",
      status: "planned",
      resultNote: "",
      reason: "",
      legalDeadline: "",
      legalBasis: "",
    });
  const [config, setConfig] = useState<{
      version: number;
      nodesJson: string;
    } | null>(null),
    [configNodes, setConfigNodes] = useState<
      {
        key: string;
        title: string;
        dependencies: string[];
        materialRequirement: string;
        reminders?: AgencyReminderSettings;
      }[]
    >([]),
    [configReason, setConfigReason] = useState("");
  const planPeople = useQuery({
    queryKey: ["agency-options"],
    queryFn: agencyOptions,
  });
  const start = (r: ExecutionMilestone | null) => {
    setEditing(r);
    setCreating(!r);
    setForm({
      title: r?.title || "",
      ownerId: r?.ownerId || "",
      startsAt: local(r?.startsAt),
      dueAt: local(r?.dueAt),
      dependencies: r ? JSON.parse(r.dependenciesJson) : [],
      materialRequirement: r?.materialRequirement || "",
      status: r?.status || "planned",
      resultNote: r?.resultNote || "",
      reason: "",
      legalDeadline: local(r?.legalDeadline),
      legalBasis: r?.legalBasis || "",
    });
  };
  return (
    <Box title="项目计划与真实节点回填">
      <AgencySmsPanel pkg={pkg} busy={busy} run={run} />
      <AgencyReminderPanel
        pkg={pkg}
        nodes={rows}
        editable={editable}
        busy={busy}
        run={run}
      />
      <p className="text-xs text-slate-500">
        节点依赖、到期提醒和法定时限分别维护。时间到期只触发提醒；完成节点必须填写实际结果，前置节点未完成时不能完成后续节点。
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr>
              <th className="p-2">节点</th>
              <th>负责人</th>
              <th>计划截止 / 法定截止</th>
              <th>状态</th>
              <th>结果</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">
                  {r.title}
                  <p className="text-slate-400">模板 V{r.templateVersion}</p>
                </td>
                <td>
                  {members.find((m) => m.userId === r.ownerId)?.name ||
                    r.ownerId ||
                    "待分配"}
                </td>
                <td>
                  {date(r.dueAt)}
                  <br />
                  {date(r.legalDeadline)}
                </td>
                <td>
                  {label[r.status] || r.status}
                  {!["completed", "cancelled"].includes(r.status) &&
                    [r.dueAt, r.legalDeadline].some(
                      (v) => v && new Date(v) < new Date(),
                    ) && <span className="block text-red-700">已逾期</span>}
                </td>
                <td>
                  {r.resultNote}
                  {r.completedAt && <p>{date(r.completedAt)}</p>}
                </td>
                <td>
                  {editable && (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() => start(r)}
                    >
                      调整 / 回填
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <button className={button} disabled={busy} onClick={() => start(null)}>
          增加自定义节点
        </button>
      )}
      {(editing || creating) && (
        <div className="space-y-3 rounded border bg-white p-3">
          {editing && (
            <p className="text-xs text-amber-800">
              直接依赖此节点的后续计划：
              {rows
                .filter((n) =>
                  JSON.parse(n.dependenciesJson).includes(editing.id),
                )
                .map((n) => n.title)
                .join("、") || "无"}
              。改期后请核对下游时间，系统不会自动改写。
            </p>
          )}
          <div className="grid gap-2 md:grid-cols-3">
            <Field name="节点标题">
              <input
                className={input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            <Field name="负责人">
              <select
                className={input}
                value={form.ownerId}
                onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
              >
                <option value="">请选择负责人</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="状态">
              <select
                className={input}
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                {[
                  "planned",
                  "doing",
                  "completed",
                  "cancelled",
                  "not_applicable",
                ].map((s) => (
                  <option key={s} value={s}>
                    {label[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="计划开始">
              <input
                className={input}
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
              />
            </Field>
            <Field name="计划截止">
              <input
                className={input}
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </Field>
            <Field name="法定截止（须单独权限）">
              <input
                className={input}
                type="datetime-local"
                disabled={!legal}
                value={form.legalDeadline}
                onChange={(e) =>
                  setForm({ ...form, legalDeadline: e.target.value })
                }
              />
            </Field>
          </div>
          <Field name="法定时限依据">
            <input
              className={input}
              disabled={!legal}
              value={form.legalBasis}
              onChange={(e) => setForm({ ...form, legalBasis: e.target.value })}
            />
          </Field>
          <Field name="前置节点（可多选）">
            <select
              className={input}
              multiple
              value={form.dependencies}
              onChange={(e) =>
                setForm({
                  ...form,
                  dependencies: Array.from(
                    e.target.selectedOptions,
                    (o) => o.value,
                  ),
                })
              }
            >
              {rows
                .filter((r) => r.id !== editing?.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="材料要求">
            <textarea
              className={input}
              value={form.materialRequirement}
              onChange={(e) =>
                setForm({ ...form, materialRequirement: e.target.value })
              }
            />
          </Field>
          <Field name="实际完成结果（完成时必填）">
            <textarea
              className={input}
              value={form.resultNote}
              onChange={(e) => setForm({ ...form, resultNote: e.target.value })}
            />
          </Field>
          <Field name="调整或取消原因">
            <input
              className={input}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <button
              className={button}
              disabled={busy || !form.reason || !form.title}
              onClick={async () => {
                if (
                  await run(() =>
                    api(
                      `/packages/${pkg}/milestones${editing ? "/" + editing.id : ""}`,
                      editing ? "PUT" : "POST",
                      {
                        ...form,
                        expectedVersion: editing?.version ?? 1,
                        startsAt: iso(form.startsAt),
                        dueAt: iso(form.dueAt),
                        legalDeadline: iso(form.legalDeadline),
                      },
                    ),
                  )
                ) {
                  setEditing(null);
                  setCreating(false);
                }
              }}
            >
              保存计划节点
            </button>
            <button
              className={button}
              onClick={() => {
                setEditing(null);
                setCreating(false);
              }}
            >
              取消调整
            </button>
          </div>
        </div>
      )}
      {configure && (
        <details>
          <summary className="cursor-pointer text-sm">
            公司计划模板 · {method} · 半流程
          </summary>
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">
              配置仅用于以后首次初始化的项目，已有计划保留原版本。请为各节点选择前置节点和材料要求。
            </p>
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const c = await api<{
                    version: number;
                    nodesJson: string;
                  } | null>(
                    "/plan-templates?procurementMethod=" +
                      encodeURIComponent(method),
                  );
                  setConfig(c ?? { version: 0, nodesJson: "[]" });
                  setConfigNodes(
                    c
                      ? JSON.parse(c.nodesJson)
                      : [
                          {
                            key: "demand",
                            title: "需求确认",
                            dependencies: [],
                            materialRequirement: "需求确认记录",
                          },
                        ],
                  );
                })
              }
            >
              读取当前配置
            </button>
            {config && (
              <>
                {configNodes.map((node, i) => (
                  <div
                    key={node.key}
                    className="space-y-2 rounded border bg-white p-3"
                  >
                    <AgencyReminderSettingsForm
                      prefix={`模板节点${i + 1}`}
                      value={node.reminders || defaultReminder()}
                      onChange={(v) =>
                        setConfigNodes((ns) =>
                          ns.map((n, j) =>
                            i === j ? { ...n, reminders: v } : n,
                          ),
                        )
                      }
                      disabled={busy}
                      people={planPeople.data?.users || []}
                    />
                    <Field name={`模板节点 ${i + 1} 名称`}>
                      <input
                        className={input}
                        value={node.title}
                        onChange={(e) =>
                          setConfigNodes((ns) =>
                            ns.map((n, j) =>
                              i === j ? { ...n, title: e.target.value } : n,
                            ),
                          )
                        }
                      />
                    </Field>
                    <Field name={`模板节点 ${i + 1} 前置节点`}>
                      <select
                        multiple
                        className={input}
                        value={node.dependencies}
                        onChange={(e) => {
                          const deps = Array.from(
                            e.target.selectedOptions,
                            (o) => o.value,
                          );
                          setConfigNodes((ns) =>
                            ns.map((n, j) =>
                              i === j ? { ...n, dependencies: deps } : n,
                            ),
                          );
                        }}
                      >
                        {configNodes
                          .filter((n) => n.key !== node.key)
                          .map((n) => (
                            <option key={n.key} value={n.key}>
                              {n.title}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field name={`模板节点 ${i + 1} 材料要求`}>
                      <textarea
                        className={input}
                        value={node.materialRequirement}
                        onChange={(e) =>
                          setConfigNodes((ns) =>
                            ns.map((n, j) =>
                              i === j
                                ? { ...n, materialRequirement: e.target.value }
                                : n,
                            ),
                          )
                        }
                      />
                    </Field>
                    <button
                      className={button}
                      disabled={busy || configNodes.length === 1}
                      onClick={() =>
                        setConfigNodes((ns) =>
                          ns
                            .filter((n) => n.key !== node.key)
                            .map((n) => ({
                              ...n,
                              dependencies: n.dependencies.filter(
                                (dep) => dep !== node.key,
                              ),
                            })),
                        )
                      }
                    >
                      移除此模板节点
                    </button>
                  </div>
                ))}
                <button
                  className={button}
                  disabled={busy || configNodes.length >= 30}
                  onClick={() =>
                    setConfigNodes((ns) => [
                      ...ns,
                      {
                        key: "node_" + key().slice(0, 8),
                        title: "新节点",
                        dependencies: [],
                        materialRequirement: "",
                      },
                    ])
                  }
                >
                  增加模板节点
                </button>
                <Field name="配置版本变更原因">
                  <input
                    className={input}
                    value={configReason}
                    onChange={(e) => setConfigReason(e.target.value)}
                  />
                </Field>
                <button
                  className={button}
                  disabled={busy || !configReason}
                  onClick={() =>
                    void run(async () => {
                      const c = await api<{
                        version: number;
                        nodesJson: string;
                      }>(
                        "/plan-templates?procurementMethod=" +
                          encodeURIComponent(method),
                        "PUT",
                        {
                          expectedVersion: config.version,
                          nodes: configNodes,
                          reason: configReason,
                        },
                      );
                      setConfig(c);
                    })
                  }
                >
                  保存公司计划模板下一版本
                </button>
              </>
            )}
          </div>
        </details>
      )}
    </Box>
  );
}
function PreparationPanel({
  pkg,
  value,
  fileOptions,
  run,
  busy,
  editable,
}: {
  pkg: string;
  value?: import("@24bid/api-client").ExecutionPreparation;
  fileOptions: ReactNode;
  run: Run;
  busy: boolean;
  editable: boolean;
}) {
  const [form, setForm] = useState({
      venue: value?.venue || "",
      scheduledAt: local(value?.scheduledAt),
      scheduledEndAt: local(value?.scheduledEndAt),
      purpose: value?.purpose || "",
      materialNotes: value?.materialNotes || "",
      committeeNotes: value?.committeeNotes || "",
      drawNotes: value?.drawNotes || "",
      evidenceVersionId: value?.evidenceVersionId || "",
    }),
    [version, setVersion] = useState(value?.version ?? 0),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) {
      setForm({
        venue: value?.venue || "",
        scheduledAt: local(value?.scheduledAt),
        scheduledEndAt: local(value?.scheduledEndAt),
        purpose: value?.purpose || "",
        materialNotes: value?.materialNotes || "",
        committeeNotes: value?.committeeNotes || "",
        drawNotes: value?.drawNotes || "",
        evidenceVersionId: value?.evidenceVersionId || "",
      });
      setVersion(value?.version ?? 0);
    }
  }, [value?.version, dirty]);
  return (
    <Box title="场地、材料与会前准备">
      <p className="text-xs text-slate-500">
        委员会组建、抽取记录及相关凭证按独立保密权限显示和修改。当前为内部准备记录，实际开评标与成交处理进入下一阶段。
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["venue", "场地"],
          ["purpose", "场地用途"],
          ["materialNotes", "材料准备记录"],
          ...(value?.committeeNotes !== undefined || editable
            ? [
                ["committeeNotes", "委员会组建记录"],
                ["drawNotes", "抽取及复核记录"],
              ]
            : []),
        ].map(([k, n]) => (
          <Field key={k} name={n}>
            <textarea
              className={input}
              disabled={!editable || busy}
              value={form[k as keyof typeof form]}
              onChange={(e) => {
                setForm({ ...form, [k]: e.target.value });
                setDirty(true);
              }}
            />
          </Field>
        ))}
        <Field name="预订开始时间">
          <input
            className={input}
            disabled={!editable || busy}
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => {
              setForm({ ...form, scheduledAt: e.target.value });
              setDirty(true);
            }}
          />
        </Field>
        <Field name="预订结束时间">
          <input
            className={input}
            disabled={!editable || busy}
            type="datetime-local"
            value={form.scheduledEndAt}
            onChange={(e) => {
              setForm({ ...form, scheduledEndAt: e.target.value });
              setDirty(true);
            }}
          />
        </Field>
        {editable && (
          <Field name="保密凭证版本">
            <select
              className={input}
              value={form.evidenceVersionId}
              onChange={(e) => {
                setForm({ ...form, evidenceVersionId: e.target.value });
                setDirty(true);
              }}
            >
              {fileOptions}
            </select>
          </Field>
        )}
      </div>
      {editable && (
        <button
          className={button}
          disabled={busy || !dirty}
          onClick={async () => {
            if (
              await run(() =>
                api(`/packages/${pkg}/preparation`, "PUT", {
                  ...form,
                  expectedVersion: version,
                  scheduledAt: iso(form.scheduledAt),
                  scheduledEndAt: iso(form.scheduledEndAt),
                  evidenceVersionId: form.evidenceVersionId || null,
                }),
              )
            )
              setDirty(false);
          }}
        >
          保存会前准备记录
        </button>
      )}
    </Box>
  );
}
