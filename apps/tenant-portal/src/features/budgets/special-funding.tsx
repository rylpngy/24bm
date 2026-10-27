import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customInstance } from "@24bid/api-client/http-client";
import { useBudgetDepartments } from "@24bid/api-client";
import { FeedbackNotice, Pagination } from "@24bid/ui";
import { Plus, Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
import { FundingCarryoverEvidence } from '../projects/funding-carryover-fields';
import { FundingUnpaidReallocation, FundingReallocationEvidence } from './funding-unpaid-reallocation';
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from "../projects/project-dialog";

type Fund = {
  id: string;
  departmentId: string;
  period: string;
  code: string;
  name: string;
  totalAmount: number;
  revision: number;
  status: string;
  reservedAmount: number;
  paidAmount: number;
  availableAmount: number;
};
type Balance = {
  fundId: string;
  code: string;
  name: string;
  allocatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
};
type Change = {
  id: string;
  kind: string;
  fundId?: string;
  projectId?: string;
  amount: number;
  proposal: string;
  snapshot: string;
  reason: string;
  status: string;
  createdAt: string;
  completedBy?: string;
};
type Page<T> = { items: T[]; total: number };
type Proposal = {
  kind: string;
  fundId?: string;
  projectId?: string;
  revision: number;
  amount: number;
  lines?: { fundId: string; amount: number }[];
  reason: string;
};
const status: Record<string, string> = {
  submitted: "审批中",
  approved: "已批准",
  rejected: "已驳回",
  withdrawn: "已撤回",
};
const path = "/api/v1/buyer/funding";
async function get<T>(url: string, params?: object) {
  return (await customInstance<{ data: T }>({ url, method: "GET", params }))
    .data;
}
const errorText = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || (e instanceof Error ? e.message : "操作失败，请重试");
const validMoney = (s: string) =>
  /^\d+(\.\d{1,2})?$/.test(s) &&
  Number.isSafeInteger(Math.round(Number(s) * 100));
export function fundingCents(s: string) {
  return validMoney(s) ? Math.round(Number(s) * 100) : null;
}
function parsed(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
function useRefresh() {
  const client = useQueryClient();
  return () =>
    client.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        (q.queryKey[0].includes("/funding") ||
          /\/buyer\/(invoices|budgets|payment)/.test(q.queryKey[0])),
    });
}

function FundingSubmission({
  proposal,
  onClose,
  onDone,
}: {
  proposal: Proposal;
  onClose: () => void;
  onDone: () => void;
}) {
  const refresh = useRefresh(),
    held = useRef(false),
    keys = useRef(new Map<string, string>()),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <WorkflowSubmitDialog
      title="提交专项资金审批"
      businessType="funding_change"
      busy={busy}
      submissionError={error}
      onClose={() => !busy && onClose()}
      onSubmit={async (formData) => {
        if (held.current) return;
        held.current = true;
        setBusy(true);
        setError("");
        const body = { ...proposal, formData },
          fingerprint = JSON.stringify(body);
        let requestKey = keys.current.get(fingerprint);
        if (!requestKey) {
          requestKey = crypto.randomUUID();
          keys.current.set(fingerprint, requestKey);
        }
        try {
          await customInstance({
            url: path + "/changes",
            method: "POST",
            data: { ...body, requestKey },
          });
          await refresh();
          onDone();
        } catch (e) {
          setError(errorText(e));
        } finally {
          held.current = false;
          setBusy(false);
        }
      }}
    />
  );
}

export function FundingHistory({
  fundId,
  projectId,
}: {
  fundId?: string;
  projectId?: string;
}) {
  const { can } = useBuyerPermissions(),
    refresh = useRefresh(),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<Change | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const history = useQuery({
    queryKey: [path + "/changes", { fundId, projectId, page }],
    queryFn: () =>
      get<Page<Change>>(path + "/changes", {
        fundId,
        projectId,
        page,
        pageSize: 10,
      }),
  });
  const proposal = selected ? parsed(selected.proposal) : null,
    snapshot = selected ? parsed(selected.snapshot) : null;
  return (
    <div className="min-w-0 space-y-3">
      <h3 className="text-sm font-bold">资金审批记录</h3>
      {history.isError && (
        <FeedbackNotice
          tone="error"
          message="资金审批记录加载失败，请刷新或核对权限。"
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {["申请时间", "业务类型", "金额", "状态", "操作"].map((h) => (
                <th className="whitespace-nowrap px-3 py-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.data?.items.map((r) => (
              <tr className="border-t border-slate-100" key={r.id}>
                <td className="px-3 py-3 text-xs">
                  {r.createdAt?.slice(0, 19).replace("T", " ")}
                </td>
                <td className="px-3 py-3">
                  {r.kind === "fund_limit" ? "年度额度" : r.kind==='project_carryover'?'专项资金跨年承接':r.kind==='project_reallocation'?'未付额度调整':"项目资金分摊"}
                </td>
                <td className="px-3 py-3">{money(r.amount)}</td>
                <td className="px-3 py-3">{status[r.status] || r.status}</td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className={btn}
                    onClick={() => {
                      setSelected(r);
                      setReason("");
                      setError("");
                    }}
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.isError &&
          !history.isLoading &&
          !history.data?.items.length && (
            <p className="py-6 text-center text-sm text-slate-500">
              暂无资金审批记录
            </p>
          )}
      </div>
      <Pagination
        page={page}
        pageSize={10}
        total={history.data?.total || 0}
        onPageChange={setPage}
      />
      {selected && (
        <ProjectDialog
          title="资金审批详情"
          onClose={() => !busy && setSelected(null)}
        >
          <div className="space-y-4 text-sm">
            <p className="font-bold">
              {status[selected.status]} · {money(selected.amount)}
            </p>
            <p className="whitespace-pre-wrap break-words">{selected.reason}</p>
            {snapshot?.code && (
              <p>
                {snapshot.code} · {snapshot.name} · {snapshot.period}
              </p>
            )}
            {selected.kind==='project_carryover'&&<FundingCarryoverEvidence snapshot={JSON.stringify({fundingCarryover:snapshot})}/>}
            {selected.kind==='project_reallocation'&&<FundingReallocationEvidence snapshot={selected.snapshot}/>}
            {selected.kind!=='project_carryover'&&selected.kind!=='project_reallocation'&&proposal?.lines?.map((l: { fundId: string; amount: number }) => (
              <p key={l.fundId} className="break-words">
                {snapshot?.sources?.find(
                  (s: { fundId: string }) => s.fundId === l.fundId,
                )?.name || l.fundId}
                ：{money(l.amount)}
              </p>
            ))}
            {can("buyer:workflow:read") && (
              <WorkflowStatusPanel
                businessType={selected.kind==='project_carryover'?'project_carryover':'funding_change'}
                businessId={selected.id}
              />
            )}
            {selected.status === "submitted" && can("buyer:budget:manage") && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (busy) return;
                  setBusy(true);
                  setError("");
                  try {
                    await customInstance({
                      url: path + "/changes/" + selected.id + "/withdraw",
                      method: "POST",
                      data: { reason: reason.trim() },
                    });
                    await refresh();
                    setSelected(null);
                  } catch (err) {
                    setError(errorText(err));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label className="block">
                  撤回原因 <span className="text-red-600">*</span>
                  <textarea
                    aria-label="资金撤回原因"
                    className={input + " h-24"}
                    maxLength={1000}
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <button className={btn} disabled={busy || !reason.trim()}>
                  撤回本人申请
                </button>
              </form>
            )}
            {error && <FeedbackNotice tone="error" message={error} />}
          </div>
        </ProjectDialog>
      )}
    </div>
  );
}

export function SpecialFundingCenter() {
  const { can } = useBuyerPermissions(),
    refresh = useRefresh(),
    [page, setPage] = useState(1),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<Fund | null>(null),
    [selected, setSelected] = useState<string | undefined>(() => {
      const id = new URLSearchParams(location.search).get("recordId");
      return id?.startsWith("fund-") ? id : undefined;
    }),
    [proposal, setProposal] = useState<Proposal | null>(null),
    [draft, setDraft] = useState({
      departmentId: "",
      period: String(new Date().getFullYear()),
      code: "",
      name: "",
    }),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const funds = useQuery({
      queryKey: [path, { page }],
      queryFn: () => get<Page<Fund>>(path, { page, pageSize: 20 }),
    }),
    departments = useBudgetDepartments();
  return (
    <main className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold">专项资金台账</h2>
        <div className="flex gap-2">
          <button
            type="button"
            className={btn}
            title="刷新专项资金"
            aria-label="刷新专项资金"
            onClick={() => void funds.refetch()}
          >
            <RefreshCw size={15} />
          </button>
          {can("buyer:budget:manage") && (
            <button
              type="button"
              className={btn}
              onClick={() => {
                setCreating(true);
                setError("");
                setDraft({
                  departmentId: "",
                  period: String(new Date().getFullYear()),
                  code: "",
                  name: "",
                });
              }}
            >
              <Plus size={15} />
              新增资金来源
            </button>
          )}
        </div>
      </header>
      {funds.isError && (
        <FeedbackNotice
          tone="error"
          message="专项资金加载失败，请刷新或核对预算查看权限。"
        />
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                "年度 / 编码",
                "资金来源",
                "已批额度",
                "责任占用",
                "实际净付",
                "可分配额度",
                "操作",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {funds.data?.items.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="px-3 py-3">
                  {f.period}
                  <span className="block text-xs text-slate-500">{f.code}</span>
                </td>
                <td className="max-w-56 break-words px-3 py-3">
                  {f.name}
                  <span className="block text-xs text-slate-500">
                    {f.status === "approved" ? "已批准" : "待编制额度"}
                  </span>
                </td>
                {[
                  f.totalAmount,
                  f.reservedAmount,
                  f.paidAmount,
                  f.availableAmount,
                ].map((n, i) => (
                  <td
                    key={i}
                    className="whitespace-nowrap px-3 py-3 tabular-nums"
                  >
                    {money(n)}
                  </td>
                ))}
                <td className="px-3 py-3">
                  <div className="flex flex-nowrap justify-end gap-2">
                    <button
                      type="button"
                      className={btn}
                      onClick={() => setSelected(f.id)}
                    >
                      记录
                    </button>
                    {can("buyer:budget:manage") && (
                      <button
                        type="button"
                        className={btn}
                        onClick={() => {
                          setEditing(f);
                          setAmount("");
                          setReason("");
                          setError("");
                        }}
                      >
                        额度申请
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!funds.isError && !funds.isLoading && !funds.data?.items.length && (
          <p className="py-8 text-center text-sm text-slate-500">
            暂无专项资金来源
          </p>
        )}
      </div>
      <Pagination
        page={page}
        pageSize={20}
        total={funds.data?.total || 0}
        onPageChange={setPage}
      />
      <div className="flex items-center gap-3 text-sm">
        <span>{selected ? "当前资金来源审批记录" : "全部资金审批记录"}</span>
        {selected && (
          <button
            type="button"
            className={btn}
            onClick={() => setSelected(undefined)}
          >
            全部记录
          </button>
        )}
      </div>
      <FundingHistory key={selected || "all"} fundId={selected} />
      {creating && (
        <ProjectDialog
          title="新增资金来源"
          onClose={() => !busy && setCreating(false)}
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              setError("");
              try {
                await customInstance({
                  url: path,
                  method: "POST",
                  data: draft,
                });
                await refresh();
                setCreating(false);
              } catch (err) {
                setError(errorText(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              管理部门 <span className="text-red-600">*</span>
              <select
                aria-label="资金管理部门"
                required
                className={input}
                value={draft.departmentId}
                onChange={(e) =>
                  setDraft({ ...draft, departmentId: e.target.value })
                }
              >
                <option value="">请选择</option>
                {departments.data?.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            {(["period", "code", "name"] as const).map((k, i) => (
              <label className="block text-sm" key={k}>
                {["资金年度", "资金编码", "资金名称"][i]}{" "}
                <span className="text-red-600">*</span>
                <input
                  aria-label={["资金年度", "资金编码", "资金名称"][i]}
                  className={input}
                  required
                  pattern={k === "period" ? "20[0-9]{2}" : undefined}
                  maxLength={k === "period" ? 4 : k === "code" ? 50 : 200}
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                />
              </label>
            ))}
            {error && <FeedbackNotice tone="error" message={error} />}
            <div className="flex justify-end">
              <button className={btn} disabled={busy}>
                保存资金来源
              </button>
            </div>
          </form>
        </ProjectDialog>
      )}
      {editing && !proposal && (
        <ProjectDialog
          title={"年度额度申请 · " + editing.name}
          onClose={() => setEditing(null)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (validMoney(amount) && reason.trim())
                setProposal({
                  kind: "fund_limit",
                  fundId: editing.id,
                  revision: editing.revision,
                  amount: Number(amount),
                  reason: reason.trim(),
                });
            }}
          >
            <p className="text-sm">
              已批额度 {money(editing.totalAmount)} · 已占用{" "}
              {money(editing.reservedAmount)}
            </p>
            <label className="block text-sm">
              申请总额度 <span className="text-red-600">*</span>
              <input
                aria-label="申请总额度"
                className={input}
                type="number"
                min={editing.reservedAmount}
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              额度申请原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="额度申请原因"
                className={input + " h-24"}
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button
                className={btn}
                disabled={!validMoney(amount) || !reason.trim()}
              >
                下一步
              </button>
            </div>
          </form>
        </ProjectDialog>
      )}
      {proposal && (
        <FundingSubmission
          proposal={proposal}
          onClose={() => setProposal(null)}
          onDone={() => {
            setProposal(null);
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

export function ProjectFundingPanel({
  project,
}: {
  project: {
    id: string;
    revision: number;
    plannedAmount: number;
    status: string;
  };
}) {
  const { can } = useBuyerPermissions(),
    [expanded, setExpanded] = useState(false),
    [editing, setEditing] = useState(false),
    [rows, setRows] = useState<{ fundId: string; amount: string }[]>([]),
    [reason, setReason] = useState(""),
    [proposal, setProposal] = useState<Proposal | null>(null);
  const url = "/api/v1/buyer/projects/" + project.id + "/funding",
    q = useQuery({
      queryKey: [url, project.revision],
      queryFn: () =>
        get<{
          enabled: boolean;
          choices: Fund[];
          sources: Balance[];
          blocker?: string;
          effectivePeriod?: string;
          priorPaidAmount?: number;
          reallocationBlocker?: string;
        }>(url),
      enabled: expanded,
    });
  const sum = rows.reduce((n, r) => n + (fundingCents(r.amount) || 0), 0),
    valid =
      rows.length > 0 &&
      rows.every(
        (r) =>
          r.fundId && fundingCents(r.amount) !== null && Number(r.amount) > 0,
      ) &&
      new Set(rows.map((r) => r.fundId)).size === rows.length &&
      sum === Math.round(project.plannedAmount * 100);
  return (
    <section
      aria-label="项目专项资金分摊"
      className="min-w-0 space-y-4 border-t border-slate-200 pt-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">项目专项资金分摊</h2>
        <button
          type="button"
          className={btn}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          资金分摊
        </button>
      </header>
      {expanded && (
        <>
          {q.isError && (
            <FeedbackNotice
              tone="error"
              message="项目资金分摊加载失败，请刷新或核对权限。"
            />
          )}
          {q.data?.blocker && (
            <FeedbackNotice tone="info" message={q.data.blocker} />
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>
              项目批准金额 {money(project.plannedAmount)} ·{" "}
              {q.data?.enabled ? "已启用专项分账" : "未启用专项分账"}
              {q.data?.effectivePeriod&&<> · 当前资金年度 {q.data.effectivePeriod} · 历史已付 {money(q.data.priorPaidAmount||0)}</>}
            </span>
            {project.status === "approved" &&
              can("buyer:budget:manage") &&
              can("buyer:project:manage") && (
                <div className="flex gap-2">
                  {q.data?.enabled&&<FundingUnpaidReallocation project={project} sources={q.data.sources} priorPaidAmount={q.data.priorPaidAmount||0} blocker={q.data.reallocationBlocker??'请刷新资金数据后重试'} onPropose={setProposal}/>}
                  <button
                    type="button"
                    className={btn}
                    disabled={!q.data || !!q.data.blocker}
                    onClick={() => {
                      setRows(
                        q.data!.sources.length
                          ? q.data!.sources.map((s) => ({
                              fundId: s.fundId,
                              amount: String(s.allocatedAmount),
                            }))
                          : [{ fundId: "", amount: "" }],
                      );
                      setReason("");
                      setEditing(true);
                    }}
                  >
                    编制分摊
                  </button>
                  {q.data?.enabled && (
                    <button
                      type="button"
                      className={btn}
                      disabled={!!q.data.blocker}
                      onClick={() => {
                        setRows([]);
                        setReason("");
                        setEditing(true);
                      }}
                    >
                      撤销分摊
                    </button>
                  )}
                </div>
              )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["资金来源", "已批分摊", "已付归属", "剩余可付"].map((h) => (
                    <th key={h} className="px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {q.data?.sources.map((s) => (
                  <tr key={s.fundId} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      {s.code} · {s.name}
                    </td>
                    {[s.allocatedAmount, s.paidAmount, s.remainingAmount].map(
                      (a, i) => (
                        <td key={i} className="px-3 py-3">
                          {money(a)}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {can("buyer:budget:read") && (
            <FundingHistory projectId={project.id} />
          )}
        </>
      )}
      {editing && !proposal && (
        <ProjectDialog
          title={rows.length ? "编制项目资金分摊" : "撤销项目资金分摊"}
          onClose={() => setEditing(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (reason.trim() && (rows.length === 0 || valid))
                setProposal({
                  kind: "project_plan",
                  projectId: project.id,
                  revision: project.revision,
                  amount: rows.length ? project.plannedAmount : 0,
                  lines: rows.map((r) => ({
                    fundId: r.fundId,
                    amount: Number(r.amount),
                  })),
                  reason: reason.trim(),
                });
            }}
          >
            {rows.length > 0 && (
              <>
                <p className="text-sm">
                  分摊合计 {money(sum / 100)} / 项目金额{" "}
                  {money(project.plannedAmount)}
                </p>
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_120px_36px] items-end gap-2"
                  >
                    <label className="min-w-0 text-sm">
                      资金来源
                      <select
                        aria-label={"分摊资金来源 " + (i + 1)}
                        className={input}
                        required
                        value={r.fundId}
                        onChange={(e) =>
                          setRows(
                            rows.map((old, n) =>
                              n === i
                                ? { ...old, fundId: e.target.value }
                                : old,
                            ),
                          )
                        }
                      >
                        <option value="">请选择已批准资金</option>
                        {q.data?.choices.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.code} · {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      分摊金额
                      <input
                        aria-label={"分摊金额 " + (i + 1)}
                        type="number"
                        min="0.01"
                        step="0.01"
                        className={input}
                        required
                        value={r.amount}
                        onChange={(e) =>
                          setRows(
                            rows.map((old, n) =>
                              n === i
                                ? { ...old, amount: e.target.value }
                                : old,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className={btn + " h-10 w-9 px-0"}
                      title="移除资金来源"
                      aria-label={"移除资金来源 " + (i + 1)}
                      disabled={rows.length === 1}
                      onClick={() => setRows(rows.filter((_, n) => n !== i))}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className={btn}
                  disabled={rows.length >= 30}
                  onClick={() => setRows([...rows, { fundId: "", amount: "" }])}
                >
                  <Plus size={15} />
                  增加来源
                </button>
                {!valid && (
                  <FeedbackNotice
                    tone="info"
                    message="请选择不重复的资金来源，分摊合计须等于项目批准金额。"
                  />
                )}
              </>
            )}
            <label className="block text-sm">
              申请原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="分摊申请原因"
                required
                className={input + " h-24"}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button
                className={btn}
                disabled={!reason.trim() || (rows.length > 0 && !valid)}
              >
                下一步
              </button>
            </div>
          </form>
        </ProjectDialog>
      )}
      {proposal && (
        <FundingSubmission
          proposal={proposal}
          onClose={() => setProposal(null)}
          onDone={() => {
            setProposal(null);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}
