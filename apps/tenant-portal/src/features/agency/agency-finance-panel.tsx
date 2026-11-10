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
type A = {
  id: string;
  kind: string;
  category: string;
  budget: string | null;
  requested: string;
  approved: string | null;
  status: string;
  version: number;
  detailJson: string;
};
type E = {
  id: string;
  accountId: string;
  kind: string;
  amount: string;
  occurredAt: string;
  status: string;
};
type W = {
  categories: {
    code: string;
    label: string;
    active: boolean;
    version: number;
  }[];
  accounts: A[];
  entries: E[];
  summary: Record<string, string>;
  notices: string[];
};
const summaryNames: Record<string, string> = {
    receivable: "确认应收（含批准增加）",
    received: "实际到账",
    refunded: "已退款",
    invoiced: "净开票",
    waived: "批准减免",
    outstanding: "未收余额",
    overpaid: "超收待处理",
    costBudget: "成本预算",
    costRequested: "成本申请",
    costApproved: "批准成本",
    costActual: "实际发生",
    costPaid: "实际净已付",
    costPayable: "实际待付",
    basisDifference: "应收减免后与实际成本口径差额",
  },
  names: Record<string, string> = {
    receivable: "服务费应收",
    cost: "成本",
    expert: "专家费",
    meal: "餐费",
    tools: "工具材料",
    transport: "交通",
    venue: "场地",
    other: "其他",
    service_fee: "服务费",
    draft: "待核算",
    reviewing: "审核中",
    approved: "已核定",
    rejected: "退回",
    receipt: "实际到账",
    refund: "实际退款",
    invoice: "实际开票",
    invoice_void: "作废／红冲发票",
    waiver: "申请减免",
    increase: "申请增加应收",
    incurred: "实际发生",
    paid: "实际支付",
    payment_refund: "实际收回支付",
  };
export function AgencyFinancePanel({
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
    path = `/packages/${detail.record.id}/finance`,
    q = useQuery({
      queryKey: ["agency-finance", detail.record.id],
      queryFn: () => api<W>(path),
      enabled: open && can("buyer:agency:finance:read"),
      refetchInterval: open ? 5000 : false,
    }),
    [account, setAccount] = useState(""),
    [mode, setMode] = useState("fixed"),
    [category, setCategory] = useState("other"),
    [dialog, setDialog] = useState<{
      account: A;
      entry?: Record<string, string>;
    } | null>(null),
    [entryKind, setEntryKind] = useState("receipt");
  const experts = useQuery({
    queryKey: ["agency-finance-experts", detail.record.id],
    queryFn: () =>
      api<
        {
          sessionId: string;
          userId: string;
          name: string;
          roundTitle: string;
        }[]
      >(path + "/expert-sources"),
    enabled: open && can("buyer:agency:finance:expert"),
  });
  const [configCategory, setConfigCategory] = useState("");
  const proofs: [string, string][] = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map(
            (v) => [v.id, f.file.name + " V" + v.ordinal] as [string, string],
          ),
      ),
    proof: LifecycleField = {
      key: "evidenceVersionId",
      label: "已封存实际脱敏凭证",
      type: "select",
      options: proofs,
    },
    key = () => crypto.randomUUID(),
    act = (url: string, body: unknown, method = "POST") =>
      run(async () => {
        setSubmitError(null);
        try {
          await api(url, method, body);
        } catch (e) {
          setSubmitError(e);
          throw e;
        }
        await q.refetch();
      }),
    w = q.data,
    a = w?.accounts.find((v) => v.id === account),
    basis = JSON.stringify(w),
    kinds =
      a?.kind === "cost"
        ? ["incurred", "paid", "payment_refund"]
        : [
            "receipt",
            "refund",
            "invoice",
            "invoice_void",
            "waiver",
            "increase",
          ];
  if (!can("buyer:agency:finance:read")) return null;
  return (
    <details
      className="mt-4 rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>收入、成本与财务办理</summary>
      {q.error && <p role="alert">{(q.error as Error).message}</p>}
      {open && w && (
        <div className="space-y-3 pt-3">
          {w.notices.map((n) => (
            <p key={n} className="text-sm">
              {n}
            </p>
          ))}
          <dl className="grid grid-cols-2 gap-2">
            {Object.entries(w.summary).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-slate-600">
                  {summaryNames[k] || k}
                </dt>
                <dd>
                  {v} {detail.record.currency}
                </dd>
              </div>
            ))}
          </dl>
          {can("buyer:agency:finance:manage") && (
            <>
              <label>
                约定计费方式
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="fixed">固定金额</option>
                  <option value="rate">计费基数乘比例</option>
                </select>
              </label>
              <LifecycleForm
                key={mode}
                title="生成待核算应收"
                basis={basis + mode}
                busy={busy}
                fields={[
                  ...((mode === "fixed"
                    ? [
                        {
                          key: "fixedAmount",
                          label: "约定固定金额",
                          type: "amount",
                        },
                      ]
                    : [
                        { key: "base", label: "实际计费基数", type: "amount" },
                        {
                          key: "rate",
                          label: "约定费率（小数，例如0.01）",
                          type: "amount",
                        },
                      ]) as LifecycleField[]),
                  {
                    key: "discount",
                    label: "约定折扣（0到1的小数）",
                    type: "amount",
                  },
                  { key: "ruleVersion", label: "计费规则版本" },
                  {
                    key: "ruleBasis",
                    label: "约定条款与计算依据",
                    type: "long",
                  },
                  { key: "taxBasis", label: "含税／不含税及税费口径" },
                  { key: "trigger", label: "实际达到的约定触发节点" },
                  { key: "payer", label: "实际付款方" },
                  { key: "recipient", label: "收款主体" },
                  proof,
                ]}
                submit={(v) =>
                  act(path + "/receivables", {
                    ...v,
                    formula: mode,
                    reviewed: true,
                    idempotencyKey: key(),
                  })
                }
              />
              {can("buyer:agency:finance:configure") && (
                <>
                  <label>
                    自定义成本类别设置
                    <select
                      aria-label="自定义成本类别设置"
                      value={configCategory}
                      onChange={(e) => setConfigCategory(e.target.value)}
                    >
                      <option value="">新增类别</option>
                      {w.categories
                        ?.filter((c) => c.code.startsWith("custom_"))
                        .map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label} · {c.active ? "启用" : "停用"}
                          </option>
                        ))}
                    </select>
                  </label>
                  <LifecycleForm
                    key={configCategory}
                    title="保存自定义成本类别"
                    basis={basis}
                    busy={busy}
                    fields={[
                      { key: "label", label: "成本类别名称" },
                      {
                        key: "active",
                        label: "是否用于新申请",
                        type: "select",
                        options: [
                          ["true", "启用"],
                          ["false", "停用并保留历史"],
                        ],
                      },
                      { key: "reason", label: "配置原因", type: "long" },
                    ]}
                    submit={(v) =>
                      act(
                        path +
                          "/categories/" +
                          (configCategory ||
                            "custom_" +
                              crypto.randomUUID().replaceAll("-", "")),
                        {
                          label: v.label,
                          active: v.active === "true",
                          reason: v.reason,
                          expectedVersion:
                            w.categories?.find((c) => c.code === configCategory)
                              ?.version || 0,
                        },
                        "PUT",
                      )
                    }
                  />
                </>
              )}
              <label>
                成本类别
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {(w.categories || [])
                    .filter((c) => c.active)
                    .map((c) => c.code)
                    .filter(
                      (v) =>
                        v !== "expert" || can("buyer:agency:finance:expert"),
                    )
                    .map((v) => (
                      <option value={v} key={v}>
                        {w.categories.find((c) => c.code === v)?.label ||
                          names[v] ||
                          v}
                      </option>
                    ))}
                </select>
              </label>
              <LifecycleForm
                key={category}
                title="保存成本申请"
                basis={basis + category}
                busy={busy}
                fields={[
                  { key: "reason", label: "费用事由", type: "long" },
                  {
                    key: "occurredAt",
                    label: "实际服务或申请日期",
                    type: "time",
                  },
                  { key: "bearer", label: "承担主体" },
                  {
                    key: "payee",
                    label: "支付对象（仅专家授权可查看专家明细）",
                  },
                  ...(category === "expert"
                    ? ([
                        {
                          key: "expertChoice",
                          label: "实际冻结参与人员及任务",
                          type: "select",
                          options:
                            experts.data?.map((e) => [
                              JSON.stringify([e.userId, e.sessionId]),
                              e.name + " · " + e.roundTitle,
                            ]) || [],
                        },
                      ] as LifecycleField[])
                    : []),
                  { key: "service", label: "实际服务事项" },
                  { key: "billingBasis", label: "计费依据" },
                  {
                    key: "budget",
                    label: "预算金额",
                    type: "amount",
                    optional: true,
                  },
                  { key: "requested", label: "申请金额", type: "amount" },
                  proof,
                ]}
                submit={(v) =>
                  act(path + "/costs", {
                    ...v,
                    category,
                    expertUserId:
                      category === "expert"
                        ? JSON.parse(v.expertChoice || "[]")[0]
                        : null,
                    sessionId:
                      category === "expert"
                        ? JSON.parse(v.expertChoice || "[]")[1]
                        : null,
                    budget: v.budget || null,
                    occurredAt: asTime(v.occurredAt),
                    reviewed: true,
                    idempotencyKey: key(),
                  })
                }
              />
              <label>
                费用账户
                <select
                  className="w-full rounded border p-2"
                  value={account}
                  onChange={(e) => {
                    setAccount(e.target.value);
                    const next = w.accounts.find(
                      (a) => a.id === e.target.value,
                    );
                    setEntryKind(
                      next?.kind === "cost" ? "incurred" : "receipt",
                    );
                  }}
                >
                  <option value="">请选择</option>
                  {w.accounts.map((a, i) => (
                    <option key={a.id} value={a.id}>
                      {names[a.kind]} {w.accounts.length - i} ·{" "}
                      {w.categories?.find((c) => c.code === a.category)
                        ?.label ||
                        names[a.category] ||
                        a.category}{" "}
                      · 申请 {a.requested} · {names[a.status]}
                    </option>
                  ))}
                </select>
              </label>
              {a && (
                <>
                  <p>
                    预算 {a.budget ?? "未填写"} · 申请 {a.requested} · 批准{" "}
                    {a.approved ?? "未核定"} · {names[a.status]}
                  </p>
                  {["draft", "rejected"].includes(a.status) && (
                    <button
                      className="rounded border p-2"
                      disabled={busy}
                      onClick={() => setDialog({ account: a })}
                    >
                      提交独立财务核定
                    </button>
                  )}
                  {a.status === "approved" && (
                    <>
                      <label>
                        实际流水类型
                        <select
                          value={entryKind}
                          onChange={(e) => setEntryKind(e.target.value)}
                        >
                          {kinds.map((k) => (
                            <option value={k} key={k}>
                              {names[k]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <LifecycleForm
                        key={a.id + entryKind}
                        title="登记实际流水或调整申请"
                        basis={basis + entryKind}
                        busy={
                          busy ||
                          (a.category === "expert" &&
                            !can("buyer:agency:finance:expert"))
                        }
                        fields={[
                          { key: "amount", label: "实际金额", type: "amount" },
                          {
                            key: "occurredAt",
                            label: "实际发生日期",
                            type: "time",
                          },
                          proof,
                          { key: "counterparty", label: "实际往来主体" },
                          { key: "reference", label: "银行流水或票据编号" },
                          {
                            key: "reason",
                            label: "实际依据与重复记录核对",
                            type: "long",
                          },
                          {
                            key: "duplicateReviewed",
                            label: "相同日期金额重复提示核对",
                            type: "select",
                            options: [
                              ["false", "未发现同类重复"],
                              ["true", "已核对提示，确属不同实际事项"],
                            ],
                          },
                        ]}
                        submit={async (v) => {
                          if (["waiver", "increase"].includes(entryKind)) {
                            setDialog({
                              account: a,
                              entry: { ...v, kind: entryKind },
                            });
                            return false;
                          }
                          return act(path + `/accounts/${a.id}/entries`, {
                            ...v,
                            kind: entryKind,
                            occurredAt: asTime(v.occurredAt),
                            reviewed: true,
                            duplicateReviewed: v.duplicateReviewed === "true",
                            idempotencyKey: key(),
                          });
                        }}
                      />
                    </>
                  )}
                  <WorkflowStatusPanel
                    businessType="agency_finance_review"
                    businessId={a.id}
                    hideBusinessSnapshot
                  />
                  {w.entries
                    .filter((e) => e.accountId === a.id)
                    .map((e) => (
                      <p key={e.id}>
                        {names[e.kind]} · {e.amount} · {e.occurredAt} ·{" "}
                        {names[e.status]}
                      </p>
                    ))}
                </>
              )}
            </>
          )}
        </div>
      )}
      {dialog && (
        <WorkflowSubmitDialog
          submissionError={submitError}
          title="提交财务独立核定"
          businessType="agency_finance_review"
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={async (formData) => {
            const entry = dialog.entry;
            const ok = entry
              ? await act(path + `/accounts/${dialog.account.id}/entries`, {
                  ...entry,
                  occurredAt: asTime(entry.occurredAt),
                  reviewed: true,
                  duplicateReviewed: entry.duplicateReviewed === "true",
                  formData,
                  idempotencyKey: key(),
                })
              : await act(path + `/accounts/${dialog.account.id}/submit`, {
                  expectedVersion: dialog.account.version,
                  reason: "人工核对计费约定、凭证与本次核算范围",
                  formData,
                  idempotencyKey: key(),
                });
            if (ok) setDialog(null);
          }}
        />
      )}
    </details>
  );
}
