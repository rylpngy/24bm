import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { agencyRequest as api, type AgencyDetail } from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import {
  LifecycleForm,
  type LifecycleField,
  asTime,
} from "./agency-lifecycle-form";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
type R = {
  id: string;
  ordinal: number;
  kind: string;
  sessionId: string;
  snapshotJson: string;
};
type D = {
  id: string;
  resultId: string;
  kind: string;
  status: string;
  version: number;
  fileVersionId: string;
  createdAt: string;
};
type I = { id: string; version: number; status: string; snapshotJson: string };
type ResultSource = {
  sessionId: string;
  roundOrdinal: number;
  procurementRevisionId: string;
  reports: { id: string; title: string; candidates: candidateType[] }[];
};
type W = {
  sources: ResultSource[];
  controlState: string;
  results: R[];
  documents: D[];
  issues: I[];
};
const labels: Record<string, string> = {
  award: "中标／成交",
  failed: "采购失败",
  terminated: "采购终止",
  announcement: "结果公告",
  notice: "通知书",
  contract: "合同",
  generated: "已生成",
  reviewing: "审核中",
  approved: "已审核",
  rejected: "已退回",
  published: "已外部发布",
  issued: "已签发",
  delivered: "已送达",
  signed: "已签署",
  open: "待办理",
  handling: "办理中",
  closed: "已关闭",
};
export function AgencyPostPanel({
  detail,
  busy,
  run,
}: {
  detail: AgencyDetail;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const [submitError, setSubmitError] = useState<unknown>(null);
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    path = `/packages/${detail.record.id}/post`,
    [dialog, setDialog] = useState<D | null>(null);
  const q = useQuery({
    queryKey: ["agency-post", detail.record.id],
    queryFn: () => api<W>(path),
    enabled: open && can("buyer:agency:post:read"),
    refetchInterval: open ? 5000 : false,
  });
  const [session, setSession] = useState(""),
    [report, setReport] = useState(""),
    [supplier, setSupplier] = useState(""),
    [docKind, setDocKind] = useState("notice"),
    [doc, setDoc] = useState(""),
    [issue, setIssue] = useState("");
  const reports =
      q.data?.sources.find((s) => s.sessionId === session)?.reports || [],
    choices: candidateType[] =
      reports.find((r) => r.id === report)?.candidates || [],
    proofs: [string, string][] = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map(
            (v) => [v.id, f.file.name + " V" + v.ordinal] as [string, string],
          ),
      ),
    proof = (
      key = "evidenceVersionId",
      label = "实际脱敏凭证",
    ): LifecycleField => ({ key, label, type: "select", options: proofs }),
    act = (url: string, method: string, body: unknown) =>
      run(async () => {
        setSubmitError(null);
        try {
          await api(url, method as "POST", body);
        } catch (e) {
          setSubmitError(e);
          throw e;
        }
        await q.refetch();
      }),
    key = () => crypto.randomUUID(),
    w = q.data,
    current = w?.results[0],
    document = w?.documents.find((d) => d.id === doc),
    selectedIssue = w?.issues.find((i) => i.id === issue),
    basis = JSON.stringify(w);
  if (!can("buyer:agency:post:read")) return null;
  return (
    <details
      className="mt-4 rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>标后结果、文书与受控事项</summary>
      {q.error && <p role="alert">{(q.error as Error).message}</p>}
      {open && w && (
        <div className="space-y-3 pt-3">
          <p>
            当前标后控制状态：
            {w.controlState === "active"
              ? "正常办理"
              : w.controlState === "paused"
                ? "按有权决定暂停"
                : "按有权决定终止"}
            。结果确认需真实有权决定。生成、内部审核、签发、外部发布与送达分别登记；费用未收齐不阻断通知书。
          </p>
          {w.results.map((r) => (
            <p key={r.id}>
              结果 V{r.ordinal} · {labels[r.kind]} ·{" "}
              {JSON.parse(r.snapshotJson).supplierName || "无成交供应商"}
            </p>
          ))}
          {can("buyer:agency:post:manage") && (
            <>
              <label>
                实际评审任务
                <select
                  className="w-full rounded border p-2"
                  aria-label="实际评审任务"
                  value={session}
                  onChange={(e) => {
                    setSession(e.target.value);
                    setReport("");
                    setSupplier("");
                  }}
                >
                  <option value="">请选择</option>
                  {w.sources.map((s) => (
                    <option key={s.sessionId} value={s.sessionId}>
                      轮次 {s.roundOrdinal}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                已通过的推荐报告
                <select
                  className="w-full rounded border p-2"
                  aria-label="已通过的推荐报告"
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                >
                  <option value="">失败或终止可不选报告</option>
                  {reports.map((r, i) => (
                    <option key={r.id} value={r.id}>
                      已审核报告 {i + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                确认对象
                <select
                  className="w-full rounded border p-2"
                  aria-label="确认对象"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">请选择</option>
                  {choices.map((c) => (
                    <option key={c.participationId} value={c.participationId}>
                      {c.supplierName} · {c.responseAmount}
                    </option>
                  ))}
                </select>
              </label>
              <LifecycleForm
                title="登记有权结果确认"
                basis={basis + session + report + supplier}
                busy={busy}
                fields={[
                  {
                    key: "kind",
                    label: "结果类型",
                    type: "select",
                    options: [
                      ["award", "中标／成交"],
                      ["failed", "采购失败"],
                      ["terminated", "终止"],
                    ],
                  },
                  {
                    key: "authorityMode",
                    label: "确认途径",
                    type: "select",
                    options: [
                      ["offline_authority", "登记真实有权书面决定"],
                      ["purchaser_account", "冻结采购人代表账号确认"],
                    ],
                  },
                  { key: "authorityName", label: "有权主体名称" },
                  { key: "authorityRole", label: "主体职责" },
                  {
                    key: "authorityScope",
                    label: "确认权限范围",
                    type: "long",
                  },
                  { key: "confirmedAt", label: "实际确认时间", type: "time" },
                  proof(),
                  { key: "reason", label: "决定内容与依据", type: "long" },
                ]}
                submit={(v) =>
                  act(path + "/results", "POST", {
                    ...v,
                    sessionId: session,
                    expectedPreviousId: current?.id || null,
                    reportId: v.kind === "award" ? report : null,
                    participationId: v.kind === "award" ? supplier : null,
                    confirmedAt: asTime(v.confirmedAt),
                    reviewed: true,
                    idempotencyKey: key(),
                  })
                }
              />
              {current && (
                <>
                  <select
                    aria-label="标后文书类型"
                    value={docKind}
                    onChange={(e) => setDocKind(e.target.value)}
                  >
                    <option value="notice">通知书</option>
                    <option value="announcement">结果公告</option>
                    <option value="contract">合同草稿</option>
                  </select>
                  <LifecycleForm
                    key={docKind}
                    title="根据结果与范本生成文书"
                    basis={basis + docKind}
                    busy={busy}
                    fields={[
                      proof("templateVersionId", "已封存实际DOCX范本"),
                      ...(docKind === "contract"
                        ? ([
                            {
                              key: "obligations",
                              label: "采购文件履行要求",
                              type: "long",
                            },
                            {
                              key: "responseCommitments",
                              label: "响应承诺核对",
                              type: "long",
                            },
                          ] as LifecycleField[])
                        : []),
                      { key: "text", label: "拟稿正文", type: "long" },
                      {
                        key: "applicabilityBasis",
                        label: "本方式的公告或文书适用依据",
                        type: "long",
                      },
                      { key: "reason", label: "核对依据", type: "long" },
                    ]}
                    submit={(v) =>
                      act(path + "/documents", "POST", {
                        ...v,
                        resultId: current.id,
                        kind: docKind,
                        procurementRevisionId:
                          docKind === "contract"
                            ? w.sources.find(
                                (s) => s.sessionId === current.sessionId,
                              )?.procurementRevisionId
                            : null,
                        reviewed: true,
                        idempotencyKey: key(),
                      })
                    }
                  />
                </>
              )}
              <label>
                办理文书
                <select
                  className="w-full rounded border p-2"
                  aria-label="办理文书"
                  value={doc}
                  onChange={(e) => setDoc(e.target.value)}
                >
                  <option value="">请选择</option>
                  {w.documents.map((d, i) => (
                    <option key={d.id} value={d.id}>
                      {labels[d.kind]} {w.documents.length - i} ·{" "}
                      {labels[d.status]}
                    </option>
                  ))}
                </select>
              </label>
              {document && (
                <>
                  <p>
                    {labels[document.status]} · V{document.version}
                  </p>
                  {["generated", "rejected"].includes(document.status) && (
                    <button
                      className="rounded border p-2"
                      disabled={busy}
                      onClick={() => setDialog(document)}
                    >
                      提交独立文书审核
                    </button>
                  )}
                  {["approved", "issued"].includes(document.status) && (
                    <LifecycleForm
                      key={document.id + document.version}
                      title="登记实际外部办理"
                      basis={basis}
                      busy={busy}
                      fields={[
                        {
                          key: "action",
                          label: "实际动作",
                          type: "select",
                          options:
                            document.kind === "announcement"
                              ? [["publish", "已人工外部发布"]]
                              : document.kind === "contract"
                                ? [["sign", "已双方签署"]]
                                : document.status === "issued"
                                  ? [["deliver", "已实际送达"]]
                                  : [["issue", "已实际签发"]],
                        },
                        {
                          key: "occurredAt",
                          label: "实际办理时间",
                          type: "time",
                        },
                        proof(),
                        { key: "recipient", label: "发布渠道或实际接收主体" },
                        { key: "channel", label: "办理途径" },
                        { key: "reference", label: "外部编号或定位" },
                        ...(document.kind === "contract"
                          ? ([
                              proof("signedFileVersionId", "双方正式签署件"),
                              {
                                key: "actualAmount",
                                label: "实际签署金额",
                                type: "amount",
                              },
                            ] as LifecycleField[])
                          : []),
                        { key: "reason", label: "办理说明", type: "long" },
                      ]}
                      submit={(v) =>
                        act(
                          path + `/documents/${document.id}/actions`,
                          "POST",
                          {
                            ...v,
                            expectedVersion: document.version,
                            occurredAt: asTime(v.occurredAt),
                            reviewed: true,
                            idempotencyKey: key(),
                          },
                        )
                      }
                    />
                  )}
                  <WorkflowStatusPanel
                    businessType="agency_post_document"
                    businessId={document.id}
                  />
                </>
              )}
              {can("buyer:agency:post:issue") && (
                <>
                  <label>
                    质疑投诉事项
                    <select
                      className="w-full rounded border p-2"
                      aria-label="质疑投诉事项"
                      value={issue}
                      onChange={(e) => setIssue(e.target.value)}
                    >
                      <option value="">新登记事项</option>
                      {w.issues.map((i) => (
                        <option key={i.id} value={i.id}>
                          {JSON.parse(i.snapshotJson).draft.title} ·{" "}
                          {labels[i.status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <LifecycleForm
                    key={issue + (selectedIssue?.version || 0)}
                    title={issue ? "更新受控事项" : "登记质疑投诉事项"}
                    basis={basis}
                    busy={busy || selectedIssue?.status === "closed"}
                    fields={[
                      {
                        key: "kind",
                        label: "事项类型",
                        type: "select",
                        options: [
                          ["question", "质疑"],
                          ["complaint", "投诉"],
                          ["other", "其他"],
                        ],
                      },
                      { key: "title", label: "事项标题" },
                      {
                        key: "ownerId",
                        label: "项目责任人",
                        type: "select",
                        options: detail.members.map((m) => [m.userId, m.name]),
                      },
                      {
                        key: "occurredAt",
                        label: "实际收到时间",
                        type: "time",
                      },
                      { key: "deadline", label: "实际处理期限", type: "time" },
                      proof(),
                      {
                        key: "status",
                        label: "办理状态",
                        type: "select",
                        options: issue
                          ? [
                              ["handling", "办理中"],
                              ["closed", "已处理关闭"],
                            ]
                          : [["open", "待办理"]],
                      },
                      {
                        key: "authorityDecision",
                        label: "有权决定或尚待决定说明",
                        type: "long",
                      },
                      {
                        key: "authorityEffect",
                        label: "实际有权决定的标后控制动作",
                        type: "select",
                        options: [
                          ["no_decision", "无控制决定，保持现状"],
                          ["pause", "依据真实决定暂停"],
                          ["resume", "依据真实决定恢复"],
                          ["terminate", "依据真实决定终止，不可自行恢复"],
                        ],
                      },
                      {
                        key: "handlingNote",
                        label: "实际处理说明",
                        type: "long",
                      },
                    ]}
                    submit={(v) =>
                      act(
                        path + "/issues" + (issue ? "/" + issue : ""),
                        issue ? "PUT" : "POST",
                        {
                          ...v,
                          expectedVersion: selectedIssue?.version,
                          occurredAt: asTime(v.occurredAt),
                          deadline: asTime(v.deadline),
                          reviewed: true,
                          idempotencyKey: key(),
                        },
                      )
                    }
                  />
                </>
              )}
            </>
          )}
        </div>
      )}
      {dialog && (
        <WorkflowSubmitDialog
          submissionError={submitError}
          title="提交标后文书独立审核"
          businessType="agency_post_document"
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={async (formData) => {
            if (
              await act(path + `/documents/${dialog.id}/submit`, "POST", {
                expectedVersion: dialog.version,
                reason: "人工核对实际文书来源与办理范围",
                formData,
                idempotencyKey: key(),
              })
            )
              setDialog(null);
          }}
        />
      )}
    </details>
  );
}
type candidateType = {
  participationId: string;
  supplierName: string;
  responseAmount: string;
};
