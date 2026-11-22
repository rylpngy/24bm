import { workbenchHref, workbenchModules } from "../workbench/workbench-model";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Plus,
  ArrowLeft,
  Save,
  Send,
  RefreshCw,
  Download,
  Upload,
  Paperclip,
} from "lucide-react";
import { Panel, FeedbackNotice, Pagination, ResponsiveTableFrame, SearchInput, StatusPill, cn } from "@24bid/ui";
import {
  agencyOptions,
  agencyGroups,
  agencyCreateGroup,
  agencyList,
  agencyDetail,
  agencySave,
  agencySubmit,
  agencyWithdraw,
  agencyChange,
  agencyBatch,
  agencyRequest,
  agencyFileNew,
  agencyFileNext,
  agencyFileUpload,
  agencyFileCancel,
  agencyFileDownload,
  type AgencyDraft,
  type AgencyDetail,
  type AgencyOptions,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { WorkflowSubmitDialog } from "../workflow/workflow-submit-dialog";
import { WorkflowStatusPanel } from "../workflow/workflow-instance-panel";
const PROJECT_PAGE_SIZE = 10;
const listFilter = "h-8 min-w-0 max-w-full rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-blue-400";
const projectMoney = (value: string | undefined, currency: string) => {
  if (value == null || !value.trim()) return "待填写";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  try {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${value}`;
  }
};
const btn =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40";
const input =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-900";
const states: Record<string, string> = {
  draft: "草稿",
  reviewing: "建档审核中",
  approved: "建档已通过",
  rejected: "已退回",
  withdrawn: "已撤回",
};
const empty = (): AgencyDraft => ({
  title: "",
  operatingMode: "half",
  currency: "CNY",
  purchaser: {},
  entrustment: { status: "洽谈中" },
  feeAgreement: {},
  supplement: {},
  members: [],
});
const err = (e: unknown) =>
  (e as { response?: { data?: { message?: string } } })?.response?.data
    ?.message ||
  (e as Error)?.message ||
  "操作失败，请重试。";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid content-start gap-1.5 text-xs font-semibold text-slate-600">
      {label}
      {children}
    </label>
  );
}
export function AgencyPage() {
  const { can, query } = useBuyerPermissions();
  if (query.isLoading) return <p>加载权限中…</p>;
  if (!can("buyer:agency:read"))
    return <FeedbackNotice tone="error" message="无招标代理查看权限。" />;
  return <AgencyWorkspace />;
}
function AgencyWorkspace() {
  const { can } = useBuyerPermissions(),
    client = useQueryClient();
  const [id, setId] = useState<string | null>(() =>
    new URLSearchParams(location.search).get("recordId"),
  );
  const [draft, setDraft] = useState<AgencyDraft | null>(() => new URLSearchParams(location.search).get("action") === "create" ? empty() : null),
    [message, setMessage] = useState<{
      tone: "error" | "success";
      message: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState(""),
    [searchKey, resetSearch] = useState(0),
    [status, setStatus] = useState(""),
    [groupId, setGroupId] = useState(""),
    [method, setMethod] = useState(""),
    [owner, setOwner] = useState(""),
    [page, setPage] = useState(1);
  const [groupName, setGroupName] = useState(""),
    [count, setCount] = useState(1),
    [reason, setReason] = useState(""),
    [submitMode, setSubmitMode] = useState<"archive" | "change" | null>(null),
    [submitError, setSubmitError] = useState<unknown>();
  const requestKey = useRef(crypto.randomUUID()),
    batchKey = useRef(crypto.randomUUID());
  const options = useQuery({
    queryKey: ["agency-options"],
    queryFn: agencyOptions,
  });
  const groups = useQuery({
    queryKey: ["agency-groups"],
    queryFn: () => agencyGroups(),
  });
  const groupSearch = useQuery({
    queryKey: ["agency-group-search", groupName],
    queryFn: () => agencyGroups(groupName),
    enabled: !!draft && !!groupName.trim(),
  });
  const list = useQuery({
    queryKey: ["agency-list", keyword, status, groupId, method, owner, page],
    queryFn: () =>
      agencyList({
        keyword,
        status,
        groupId,
        procurementMethod: method,
        ownerId: owner,
        page,
        pageSize: PROJECT_PAGE_SIZE,
      }),
  });
  const detail = useQuery({
    queryKey: ["agency-detail", id],
    queryFn: () => agencyDetail(id!),
    enabled: !!id,
  });
  const summary = useQuery({
    queryKey: ["agency-group-summary", groupId],
    queryFn: () =>
      agencyRequest<{
        packageCount: number;
        budgetsByCurrency: Record<string, string>;
        unknownBudgetCount: number;
      }>(`/groups/${groupId}/summary`),
    enabled: !!groupId && !id && !draft,
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["agency-detail"] });
    await client.invalidateQueries({ queryKey: ["agency-list"] });
    await client.invalidateQueries({ queryKey: ["agency-group-summary"] });
  };
  const open = (value: string | null) => {
    setId(value);
    setDraft(null);
    setMessage(null);
    const url = new URL(location.href);
    if (value) url.searchParams.set("recordId", value);
    else url.searchParams.delete("recordId");
    history.replaceState(null, "", url);
  };
  const action = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await refresh();
      setMessage({ tone: "success", message: success });
    } catch (e) {
      setMessage({ tone: "error", message: err(e) });
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    action(
      async () => {
        if (!draft) return;
        if (!id && count > 1) {
          const packs = Array.from({ length: count }, (_, n) => ({
            ...draft,
            title: `${draft.title}（第${n + 1}包）`,
          }));
          const made = await agencyBatch(packs, batchKey.current);
          open(made[0].record.id);
          batchKey.current = crypto.randomUUID();
        } else {
          const result = await agencySave(id, draft);
          open(result.record.id);
        }
      },
      count > 1 && !id ? `已建立${count}条独立采购包档案` : "档案已保存",
    );
  const submit = async (formData: Record<string, unknown>) => {
    setBusy(true);
    setSubmitError(undefined);
    try {
      if (submitMode === "change") {
        if (!draft) throw Error("请先填写变更内容");
        await agencyChange(id!, draft, requestKey.current, reason, formData);
        setDraft(null);
      } else
        await agencySubmit(
          id!,
          detail.data!.record.version,
          requestKey.current,
          formData,
        );
      setSubmitMode(null);
      requestKey.current = crypto.randomUUID();
      await refresh();
      setMessage({
        tone: "success",
        message: "已提交审批，审核期间档案及附件冻结。",
      });
    } catch (e) {
      setSubmitError(e);
    } finally {
      setBusy(false);
    }
  };
  const rows = (list.data?.items ?? []).map((project, index) => ({
    id: project.id,
    sequence: (page - 1) * PROJECT_PAGE_SIZE + index + 1,
    title: project.title || "未命名草稿",
    number: project.number || "首次提交时编号",
    department: options.data?.departments.find(department => department.id === project.departmentId)?.name || "部门待指定",
    owner: options.data?.users.find(user => user.id === project.ownerId)?.name || "负责人待指定",
    group: groups.data?.find(group => group.id === project.groupId)?.name || "未关联",
    method: project.procurementMethod || "待填写",
    budget: projectMoney(project.budget, project.currency),
    stage: project.workflowId && project.status === "approved" ? "变更审核中" : states[project.status] || project.status,
  }));
  const d = detail.data;
  const currentReview = d?.reviews.find(review => review.workflowId === d.record.workflowId && review.workflowId)
    ?? d?.reviews.find(review => review.workflowId);
  const relatedModules = [
    { id: "project-materials", title: "项目资料", description: "分类附件与版本" },
    { id: "documents", title: "招标文件", description: "编制、版本与审核" },
    { id: "announcements", title: "公告管理", description: "公告编制与发布" },
    { id: "execution", title: "项目执行", description: "专家抽取、签到、评分与文件核对" },
    { id: "fees", title: "费用管理", description: "服务费与成本收支" },
    { id: "project-archive", title: "项目归档", description: "核对通过的评标文件及归档版本" },
  ].filter(({ id }) => {
    if (id !== "project-materials" && d?.record.status !== "approved") return false;
    const permission = workbenchModules.find(module => module.id === id)?.requiredPermission;
    return !permission || can(permission);
  });
  const detailView = Boolean(id && !draft);
  const content = (
    <>
      {(id || draft) && !(detailView && d) && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button className={btn} disabled={busy} onClick={() => open(null)}>
            <ArrowLeft size={15} /> 返回项目库
          </button>
          <button className={btn} disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={15} /> 刷新
          </button>
        </div>
      )}
      {message && (
        <div className="mb-4">
          <FeedbackNotice {...message} />
        </div>
      )}

      {options.isError && (
        <FeedbackNotice
          tone="error"
          message={"基础选项加载失败：" + err(options.error)}
        />
      )}
      {groups.isError && (
        <FeedbackNotice tone="error" message="所属项目加载失败，请刷新。" />
      )}
      {!id && !draft && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2" role="group" aria-label="建档状态">
              {Object.entries({ "": "全部", ...states }).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value}
                  onClick={() => { setStatus(value); setPage(1); }}
                  className={cn("h-8 rounded-md border px-3 text-xs font-black transition",
                    status === value ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>
                  {label}
                </button>
              ))}
            </div>
            <SearchInput key={searchKey} className="mb-0 ml-auto max-w-full flex-wrap" placeholder="按编号 / 标题搜索"
              onSearch={value => { setKeyword(value.slice(0, 200)); setPage(1); }} />
            {can("buyer:agency:manage") && (
              <button type="button" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800"
                onClick={() => {
                  setCount(1);
                  setDraft({ ...empty(), groupId: groupId || undefined });
                  batchKey.current = crypto.randomUUID();
                }}>
                <Plus size={14} /> 新建项目
              </button>
            )}
          </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <select aria-label="所属项目" className={listFilter} value={groupId} onChange={(event) => { setGroupId(event.target.value); setPage(1); }}>
              <option value="">全部所属项目</option>
              {groups.data?.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <select aria-label="采购方式" className={listFilter} value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }}>
              <option value="">全部采购方式</option>
              {options.data?.procurementMethods.map(value => <option key={value}>{value}</option>)}
            </select>
            <select aria-label="主负责人" className={listFilter} value={owner} onChange={(event) => { setOwner(event.target.value); setPage(1); }}>
              <option value="">全部负责人</option>
              {options.data?.users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            {(keyword || groupId || method || owner || status) && (
              <button type="button" className="rounded-md px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50" onClick={() => {
                resetSearch(key => key + 1); setKeyword(""); setGroupId(""); setMethod(""); setOwner(""); setStatus(""); setPage(1);
              }}>清空筛选</button>
            )}
            <button type="button" className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              disabled={list.isFetching} onClick={() => void refresh()}><RefreshCw size={14} /> 刷新</button>
          </div>
          {summary.data && (
            <div className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              所属项目授权范围内共 {summary.data.packageCount} 包 · 预算{" "}
              {Object.entries(summary.data.budgetsByCurrency)
                .map(([c, a]) => `${c} ${a}`)
                .join(" / ") || "未填写"}{" "}
              · {summary.data.unknownBudgetCount} 包预算待补
            </div>
          )}
          {list.isError ? (
            <FeedbackNotice tone="error" message={err(list.error)} />
          ) : !rows.length ? (
            <FeedbackNotice tone="info" message={list.isLoading ? "正在加载项目…" : "当前筛选下暂无项目。"} />
          ) : (
            <ResponsiveTableFrame mobileCards={rows.map(row => (
              <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-950">{row.sequence}. {row.title}</p>
                    <p className="mt-1 break-all font-mono text-xs font-black text-slate-500">{row.number}</p>
                  </div>
                  <StatusPill label={row.stage} className="shrink-0 whitespace-nowrap" />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                  <div><dt className="font-bold text-slate-500">部门 / 负责人</dt><dd className="mt-1 break-words font-bold text-slate-600">{row.department} · {row.owner}</dd></div>
                  <div><dt className="font-bold text-slate-500">预算金额</dt><dd className="mt-1 break-all font-mono font-black text-slate-900">{row.budget}</dd></div>
                  <div className="col-span-2"><dt className="font-bold text-slate-500">所属项目 / 采购方式</dt><dd className="mt-1 break-words font-bold text-slate-600">{row.group} · {row.method}</dd></div>
                </dl>
                <button type="button" onClick={() => open(row.id)} aria-label={`详情：${row.title}`}
                  className="mt-4 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50">详情</button>
              </article>
            ))}>
              <table aria-label="项目档案列表" className="w-full min-w-[1000px] table-fixed text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th scope="col" className="w-12 px-2 py-4 text-center">序号</th>
                    <th scope="col" className="w-[28%] px-5 py-4">项目</th>
                    <th scope="col" className="px-5 py-4">部门 / 负责人</th>
                    <th scope="col" className="px-5 py-4">所属项目 / 采购方式</th>
                    <th scope="col" className="w-40 px-5 py-4 text-right">预算金额</th>
                    <th scope="col" className="w-28 px-5 py-4">状态</th>
                    <th scope="col" className="w-24 px-5 py-4 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">{row.sequence}</td>
                      <td className="px-5 py-5">
                        <p className="truncate font-black text-slate-950" title={row.title}>{row.title}</p>
                        <p className="mt-1 truncate font-mono text-xs font-black text-slate-500">{row.number}</p>
                      </td>
                      <td className="px-5 py-5">
                        <p className="truncate font-bold text-slate-600" title={row.department}>{row.department}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500" title={row.owner}>{row.owner}</p>
                      </td>
                      <td className="px-5 py-5">
                        <p className="truncate font-bold text-slate-600" title={row.group}>{row.group}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">{row.method}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-5 text-right font-mono font-black text-slate-900">{row.budget}</td>
                      <td className="px-5 py-5"><StatusPill label={row.stage} className="whitespace-nowrap" /></td>
                      <td className="px-5 py-5 text-right">
                        <button type="button" aria-label={`详情：${row.title}`} onClick={() => open(row.id)}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50">详情</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTableFrame>
          )}
          <Pagination page={page} pageSize={PROJECT_PAGE_SIZE} total={list.data?.total ?? 0} onPageChange={setPage} />
        </>
      )}
      {id && detail.isLoading && <p>加载档案中…</p>}
      {id && detail.isError && (
        <FeedbackNotice tone="error" message={err(detail.error)} />
      )}
      {id && d && !draft && (
        <>
          <header className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex min-w-0 items-start gap-3">
              <button type="button" className={btn + " shrink-0"} title="返回项目库"
                aria-label="返回项目库" disabled={busy} onClick={() => open(null)}>
                <ArrowLeft size={15} />
              </button>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-black text-slate-950">{d.record.title || "未命名草稿"}</h2>
                <p className="mt-1 break-words text-xs text-slate-600">
                  {d.record.number || "未编号草稿"} · {states[d.record.status] || d.record.status} · 版本 {d.record.version}
                  {d.record.workflowId && d.record.status === "approved" ? " · 重要变更审核中" : ""}
                </p>
              </div>
            </div>
            <div className="flex max-w-full flex-wrap items-center gap-2">
              {d.canEdit && (
                <button
                  className={btn}
                  onClick={() =>
                    setDraft({ ...d.data, expectedVersion: d.record.version })
                  }
                >
                  维护档案
                </button>
              )}
              {d.canSubmit && (
                <button
                  className={btn}
                  disabled={busy}
                  onClick={() => {
                    requestKey.current = crypto.randomUUID();
                    setSubmitError(undefined);
                    setSubmitMode("archive");
                  }}
                >
                  <Send size={15} />
                  提交建档审批
                </button>
              )}
              {d.canWithdraw && (
                <div className="flex flex-wrap gap-2">
                  <input
                    aria-label="撤回原因"
                    className={input + " !w-60"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="撤回原因"
                  />
                  <button
                    className={btn}
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      void action(
                        () => agencyWithdraw(id, d.record.version, reason),
                        "审批已撤回，原编号保留",
                      )
                    }
                  >
                    撤回审批
                  </button>
                </div>
              )}
              <button type="button" className={btn} title="刷新" aria-label="刷新"
                disabled={busy} onClick={() => void refresh()}>
                <RefreshCw size={15} />
              </button>
            </div>
          </header>
          <div className="mb-5 grid items-start gap-4 xl:grid-cols-3">
            <section className={detailCard + " xl:col-span-2"}>
              <Info title="基础信息" values={{
                所属部门: options.data?.departments.find(dept => dept.id === d.data.departmentId)?.name || "—",
                项目负责人: d.members.find(member => member.userId === d.data.ownerId)?.name
                  || options.data?.users.find(user => user.id === d.data.ownerId)?.name || "—",
                所属项目: groups.data?.find(group => group.id === d.data.groupId)?.name || "—",
                采购方式: d.data.procurementMethod || "—",
                预算金额: projectMoney(d.data.budget ?? undefined, d.data.currency),
                最高限价: projectMoney(d.data.ceiling ?? undefined, d.data.currency),
                当前状态: states[d.record.status] || d.record.status,
                运行模式: "半流程",
                采购对象: d.data.objectCode || "—",
                适用制度: d.data.regime || "—",
                地区: d.data.region || "—",
              }} />
              <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 md:grid-cols-2">
                <Info title="采购人与联系人" values={d.data.purchaser} />
                <Info title="委托与服务范围" values={d.data.entrustment} />
              </div>
            </section>
            <aside className="grid min-w-0 gap-4" aria-label="项目概况与附件">
              <section className={detailCard}>
                <Info title="项目概况" values={{
                  业务状态: {published: "已发布", not_started: "未开始", closed: "已办结", in_progress: "办理中"}[d.businessStatus] || d.businessStatus,
                  档案状态: d.archiveCompletion === "complete" ? "已完成" : "持续累积／待补件",
                  费用状态: d.financialStatus === "settled" ? "已结清" : d.financialStatus === "unsettled" ? "未结清" : "未核算",
                }} />
              </section>
              <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Paperclip size={14} /> 项目附件</h3>
                  {(d.canManageFiles || d.files.length > 0) && (
                    <button type="button" className="text-xs font-bold text-blue-700 hover:underline"
                      onClick={() => {
                        const attachments = document.getElementById("agency-project-attachments");
                        attachments?.focus();
                        attachments?.scrollIntoView({block: "start"});
                      }}>
                      {d.canManageFiles ? "管理附件" : "查看附件"}
                    </button>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-500">{d.files.length ? `共 ${d.files.length} 项可见附件` : "暂无可见附件。"}</p>
              </section>
            </aside>
          </div>
          <div className="mb-5">
            {currentReview ? (
              <WorkflowStatusPanel
                businessType={currentReview.kind === "archive" ? "agency_package_archive" : "agency_package_change"}
                businessId={currentReview.id}
                hideBusinessSnapshot
              />
            ) : (
              <section className={detailCard}>
                <h3 className="mb-2 font-bold">审批流程</h3>
                <p className="text-sm text-slate-500">尚未发起审批流程。</p>
              </section>
            )}
          </div>
          {relatedModules.length > 0 && (
            <section className={detailCard + " mb-5"} aria-label="项目关联业务">
              <h3 className="mb-3 font-bold">项目关联业务</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {relatedModules.map(({ id: module, title, description }) => (
                  <a key={module} href={workbenchHref(module, d.record.id)}
                    className="rounded-md border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50">
                    <h4 className="text-sm font-bold text-blue-700">{title} →</h4>
                    <p className="mt-1 text-xs text-slate-500">{description}</p>
                  </a>
                ))}
              </div>
            </section>
          )}
          <div className={detailCard + " mb-5 grid gap-5 lg:grid-cols-3"}>
            <Info title="项目组织" values={Object.fromEntries(d.members.map(member => [
              member.name,
              {OWNER: "主负责人", EDITOR: "协作编辑", DRAFTER: "文件编制人", OFFICE: "办公室对接"}[member.role] || "只读成员",
            ]))} />
            <Info title="服务费约定" values={d.data.feeAgreement} />
            <Info title="补充资料" values={d.data.supplement} />
          </div>
          <div id="agency-project-attachments" tabIndex={-1} className="scroll-mt-4 rounded-lg bg-white">
            <FilePanel detail={d} busy={busy} run={action} />
          </div>
          <section className={detailCard + " mt-5"}>
            <h3 className="mb-3 text-sm font-bold">审批记录与快照</h3>
            {!d.reviews.length && (
              <p className="text-sm text-slate-500">尚未提交审批。</p>
            )}
            {d.reviews.map((r) => (
              <details key={r.id} className="mb-3 rounded-lg border p-3">
                <summary className="cursor-pointer text-sm">
                  {r.kind === "archive" ? "建档审批" : "重要变更"} · {r.status}{" "}
                  · {r.createdAt.slice(0, 16).replace("T", " ")}
                </summary>
                {r.workflowId && r.id !== currentReview?.id && (
                  <div className="mt-3">
                    <WorkflowStatusPanel
                      businessType={
                        r.kind === "archive"
                          ? "agency_package_archive"
                          : "agency_package_change"
                      }
                      businessId={r.id}
                    />
                  </div>
                )}
                <details className="mt-3 text-xs">
                  <summary>送审快照</summary>
                  <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3">
                    {JSON.stringify(JSON.parse(r.snapshotJson), null, 2)}
                  </pre>
                </details>
              </details>
            ))}
          </section>
          <details className={detailCard + " mt-5"}>
            <summary className="cursor-pointer text-sm font-semibold">
              档案修订历史（{d.history.length}）
            </summary>
            {d.history.map((h) => (
              <details key={h.version} className="mt-2 text-xs">
                <summary>
                  版本 {h.version} · {h.reason} · {h.createdAt.slice(0, 16)}
                </summary>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap bg-slate-50 p-3">
                  {JSON.stringify(JSON.parse(h.dataJson), null, 2)}
                </pre>
              </details>
            ))}
          </details>
        </>
      )}
      {draft && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">
              {id ? "维护采购包档案" : "创建项目档案"}
            </h2>
            <span className="text-xs text-slate-500">
              草稿可缺项保存，首次提交生成编号
            </span>
          </div>
          <AgencyForm
            draft={draft}
            setDraft={setDraft}
            options={options.data}
            groups={groups.data || []}
            busy={busy}
          />
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <Field label="新建所属项目标签">
              <div className="flex gap-2">
                <input
                  className={input}
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="先查找近似名称，确认后创建新标签"
                />
                <button
                  className={btn + " shrink-0"}
                  disabled={busy || !groupName.trim()}
                  onClick={() =>
                    void action(async () => {
                      const g = await agencyCreateGroup(groupName);
                      await client.invalidateQueries({
                        queryKey: ["agency-groups"],
                      });
                      setDraft((x) => (x ? { ...x, groupId: g.id } : x));
                      setGroupName("");
                    }, "所属项目标签已创建")
                  }
                >
                  创建标签
                </button>
              </div>
            </Field>
            {groupName && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                {groupSearch.isLoading
                  ? "搜索中…"
                  : groupSearch.isError
                    ? "搜索失败，请重试"
                    : "近似标签："}
                {groupSearch.data?.map((g) => (
                  <button
                    key={g.id}
                    className="rounded border bg-white px-2 py-1 text-blue-700"
                    onClick={() => {
                      client.setQueryData(
                        ["agency-groups"],
                        (old: typeof groups.data) => [
                          g,
                          ...(old || []).filter((x) => x.id !== g.id),
                        ],
                      );
                      setDraft((x) => (x ? { ...x, groupId: g.id } : x));
                      setGroupName("");
                    }}
                  >
                    复用 {g.name}
                  </button>
                ))}
                {!groupSearch.isLoading &&
                  !groupSearch.isError &&
                  !groupSearch.data?.length &&
                  "未发现近似名称"}
              </div>
            )}
          </div>
          {!id && (
            <div className="mt-4 max-w-xs">
              <Field label="本次采购包数量（共同字段批量带入）">
                <input
                  type="number"
                  min="1"
                  max="20"
                  className={input}
                  value={count}
                  onChange={(e) =>
                    setCount(
                      Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                    )
                  }
                />
              </Field>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className={btn + " !bg-blue-600 !text-white"}
              disabled={busy || !options.data}
              onClick={() => void save()}
            >
              <Save size={15} />
              {busy ? "处理中…" : "保存档案"}
            </button>
            <button
              className={btn}
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              取消编辑
            </button>
            {id && d?.record.status === "approved" && (
              <>
                <input
                  aria-label="重要变更原因"
                  className={input + " !w-72"}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="重要字段变更原因"
                />
                <button
                  className={btn}
                  disabled={busy || !reason.trim()}
                  onClick={() => {
                    requestKey.current = crypto.randomUUID();
                    setSubmitError(undefined);
                    setSubmitMode("change");
                  }}
                >
                  提交重要变更
                </button>
              </>
            )}
          </div>
        </>
      )}
      {submitMode && (
        <WorkflowSubmitDialog
          businessType={
            submitMode === "archive"
              ? "agency_package_archive"
              : "agency_package_change"
          }
          title={submitMode === "archive" ? "提交建档审批" : "提交重要变更审批"}
          busy={busy}
          submissionError={submitError}
          onClose={() => {
            if (!busy) setSubmitMode(null);
          }}
          onSubmit={(form) => void submit(form)}
        >
          <p className="text-sm text-slate-500">
            当前档案、成员和已封存附件将形成送审快照。委托协议尚未签署不阻止建档。
          </p>
        </WorkflowSubmitDialog>
      )}
    </>
  );
  if (detailView) return <div className="min-w-0">{content}</div>;
  return (
    <Panel
      title="项目库"
      icon={FolderKanban}
      subtitle="项目经理创建项目、办理立项审核，关联项目成员与资料"
    >
      {content}
    </Panel>
  );
}
const labels: Record<string, string> = {
  name: "名称",
  creditCode: "统一社会信用代码",
  contact: "联系人",
  contactRole: "职务或角色",
  phone: "电话",
  email: "邮箱",
  address: "地址",
  demandContact: "需求对接人",
  notes: "备注",
  status: "委托状态",
  agreementNo: "协议编号",
  signedOn: "签署日期",
  serviceScope: "服务范围",
  period: "约定周期",
  specialTerms: "特殊约定",
  mode: "收费模式",
  basis: "计费依据",
  rate: "费率",
  discount: "折扣",
  fixedAmount: "固定金额",
  payer: "付款方",
  payee: "收款主体",
  trigger: "触发节点",
  taxNotes: "税费说明",
  projectName: "项目名称",
  externalNumber: "外部采购编号",
  source: "项目来源",
  tags: "标签",
};
const detailCard = "min-w-0 rounded-lg border border-slate-200 bg-white p-5";

function Info({
  title,
  values,
}: {
  title: string;
  values: Record<string, string>;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-4 font-bold text-slate-900">{title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {Object.entries(values)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-slate-500">{labels[k] || k}</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{v}</dd>
            </div>
          ))}
      </dl>
      {!Object.values(values).some(Boolean) && <p className="text-sm text-slate-500">待补充</p>}
    </section>
  );
}
function AgencyForm({
  draft: d,
  setDraft,
  options: o,
  groups,
  busy,
}: {
  draft: AgencyDraft;
  setDraft: (d: AgencyDraft) => void;
  options?: AgencyOptions;
  groups: { id: string; name: string }[];
  busy: boolean;
}) {
  const set = (key: keyof AgencyDraft, v: unknown) =>
    setDraft({ ...d, [key]: v });
  const select = (
    label: string,
    key: keyof AgencyDraft,
    values: { id: string; name: string }[],
  ) => (
    <Field label={label}>
      <select
        className={input}
        value={String(d[key] || "")}
        onChange={(e) => set(key, e.target.value || undefined)}
      >
        <option value="">待补充</option>
        {values.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const mapFields = (
    section: "purchaser" | "entrustment" | "feeAgreement" | "supplement",
    keys: string[],
  ) =>
    keys.map((key) => (
      <Field key={key} label={labels[key] || key}>
        <input
          className={input}
          value={d[section][key] || ""}
          onChange={(e) =>
            set(section, { ...d[section], [key]: e.target.value })
          }
        />
      </Field>
    ));
  return (
    <fieldset disabled={busy} className="space-y-5">
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">一 基础与分类</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="采购包或标段名称">
            <input
              className={input}
              value={d.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </Field>
          {select("所属项目", "groupId", groups)}
          {select(
            "业务类别",
            "businessCategory",
            Object.entries(
              JSON.parse(o?.numbering.categories || "{}") as Record<
                string,
                string
              >,
            ).map(([id, name]) => ({ id, name })),
          )}
          {select(
            "采购对象",
            "objectCode",
            Object.entries(
              JSON.parse(o?.numbering.objects || "{}") as Record<
                string,
                string
              >,
            ).map(([id, name]) => ({ id, name })),
          )}
          {select(
            "采购方式",
            "procurementMethod",
            (o?.procurementMethods || []).map((v) => ({ id: v, name: v })),
          )}
          <Field label="运行模式">
            <select className={input} value="half" disabled>
              <option value="half">半流程 · 现场线上评审</option>
              <option disabled>全流程 · 规划中</option>
            </select>
          </Field>
          {["regime", "region"].map((k) => (
            <Field key={k} label={k === "regime" ? "适用制度" : "项目地区"}>
              <input
                className={input}
                value={String(d[k as keyof AgencyDraft] || "")}
                onChange={(e) => set(k as keyof AgencyDraft, e.target.value)}
              />
            </Field>
          ))}
          {(["budget", "ceiling"] as const).map((k) => (
            <Field
              key={k}
              label={
                k === "budget" ? "预算金额（可留空）" : "最高限价（可留空）"
              }
            >
              <input
                inputMode="decimal"
                className={input}
                value={d[k] ?? ""}
                onChange={(e) => set(k, e.target.value || null)}
              />
            </Field>
          ))}
          <Field label="币种">
            <input
              className={input}
              value={d.currency}
              maxLength={3}
              onChange={(e) => set("currency", e.target.value.toUpperCase())}
            />
          </Field>
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">二 采购人与联系人</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mapFields("purchaser", [
            "name",
            "creditCode",
            "contact",
            "contactRole",
            "phone",
            "email",
            "address",
            "demandContact",
            "notes",
          ])}
        </div>
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">三 委托与服务范围</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mapFields("entrustment", [
            "status",
            "agreementNo",
            "signedOn",
            "serviceScope",
            "period",
            "specialTerms",
          ])}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          委托协议可后补；签署状态与建档审批状态分别管理。
        </p>
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">四 项目组织</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {select("所属部门", "departmentId", o?.departments || [])}
          {select("项目经理（主负责人）", "ownerId", o?.users || [])}
        </div>
        <div className="mt-4 space-y-2">
          {d.members.map((m, index) => (
            <div key={index} className="flex gap-2">
              <select
                aria-label={`协作人员${index + 1}`}
                className={input}
                value={m.userId}
                onChange={(e) =>
                  set(
                    "members",
                    d.members.map((v, i) =>
                      i === index ? { ...v, userId: e.target.value } : v,
                    ),
                  )
                }
              >
                <option value="">选择协作人员</option>
                {o?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={`成员职责${index + 1}`}
                className={input}
                value={m.role}
                onChange={(e) =>
                  set(
                    "members",
                    d.members.map((v, i) =>
                      i === index ? { ...v, role: e.target.value } : v,
                    ),
                  )
                }
              >
                <option value="EDITOR">协作编辑</option>
                <option value="VIEWER">只读成员</option>
                <option value="DRAFTER">文件编制人</option>
                <option value="OFFICE">办公室对接</option>
              </select>
              <button
                className={btn + " shrink-0"}
                onClick={() =>
                  set(
                    "members",
                    d.members.filter((_, i) => i !== index),
                  )
                }
              >
                移除
              </button>
            </div>
          ))}
        </div>
        <button
          className={btn + " mt-3"}
          onClick={() =>
            set("members", [...d.members, { userId: "", role: "EDITOR" }])
          }
        >
          添加协作人员
        </button>
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">五 服务费约定</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mapFields("feeAgreement", [
            "mode",
            "basis",
            "rate",
            "discount",
            "fixedAmount",
            "payer",
            "payee",
            "trigger",
            "taxNotes",
            "notes",
          ])}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          此处保存收费约定，不生成应收；未知金额留空，不按零元处理。
        </p>
      </section>
      <section className="rounded-lg border p-4">
        <h3 className="mb-4 text-sm font-bold">六 补充资料</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {mapFields("supplement", [
            "projectName",
            "externalNumber",
            "source",
            "tags",
            "notes",
          ])}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          保存采购包后可上传分类附件；原文件以版本保留。
        </p>
      </section>
    </fieldset>
  );
}
export function FilePanel({
  detail: d,
  busy,
  run,
}: {
  detail: AgencyDetail;
  busy: boolean;
  run: (fn: () => Promise<unknown>, success: string) => Promise<void>;
}) {
  const { can } = useBuyerPermissions();
  const [name, setName] = useState(""),
    [category, setCategory] = useState("entrustment"),
    [visibility, setVisibility] = useState("project"),
    [versionReasons, setVersionReasons] = useState<Record<string, string>>({});
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-bold">分类附件与不可变版本</h3>
      <p className="mb-4 text-xs text-slate-500">
        支持DOCX、XLSX、PDF、PNG、JPEG、UTF-8文本及CSV，最大10MB。上传后校验并封存；旧版本保留。审核期间禁止新增或替换。
        响应材料请通过“评审准备 →
        材料接收与正式开启”登记，普通附件按原项目范围共享。
      </p>
      {d.canManageFiles && (
        <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
          <input
            aria-label="附件名称"
            className={input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="附件名称"
          />
          <select
            aria-label="附件类别"
            className={input}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (e.target.value === "preparation_signed")
                setVisibility("restricted");
            }}
          >
            <option value="entrustment">委托材料</option>
            <option value="initiation">立项材料</option>
            <option value="demand_source">需求来源</option>
            <option value="other">其他资料</option>
            {can("buyer:agency:preparation:confidential") && (
              <option value="preparation_signed">人员签署件</option>
            )}
          </select>
          <select
            aria-label="附件可见范围"
            disabled={category === "preparation_signed"}
            className={input}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="project">项目授权人员</option>
            <option value="restricted">受限材料</option>
          </select>
          <button
            className={btn}
            disabled={busy || !name.trim()}
            onClick={() =>
              void run(async () => {
                await agencyFileNew(d.record.id, name, category, visibility);
                setName("");
              }, "已建立附件，请选择文件上传")
            }
          >
            新增附件
          </button>
        </div>
      )}
      {!d.files.length && (
        <p className="text-sm text-slate-400">暂无可见附件。</p>
      )}
      {d.files.map((f) => (
        <article key={f.file.id} className="mb-3 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold">
              {f.file.name}{" "}
              <span className="text-xs font-normal text-slate-400">
                {f.file.visibility === "restricted" ? "受限材料" : "项目资料"}
              </span>
            </h4>
            {d.canManageFiles &&
              f.file.category !== "generated_document" &&
              f.file.category !== "preparation_form" &&
              !["response_material", "final_quote_material"].includes(
                f.file.category || "",
              ) &&
              !f.versions.some((v) => v.status === "uploading") && (
                <div className="flex gap-2">
                  <input
                    aria-label={`${f.file.name}版本原因`}
                    className={input + " !w-48"}
                    placeholder="新增版本原因"
                    value={versionReasons[f.file.id] || ""}
                    onChange={(e) =>
                      setVersionReasons((x) => ({
                        ...x,
                        [f.file.id]: e.target.value,
                      }))
                    }
                  />
                  <button
                    className={btn}
                    disabled={busy || !versionReasons[f.file.id]?.trim()}
                    onClick={() =>
                      void run(
                        () =>
                          agencyFileNext(
                            f.file.id,
                            f.versions[0].ordinal,
                            versionReasons[f.file.id],
                          ),
                        "新版本已建立，旧文件保留",
                      )
                    }
                  >
                    新增版本
                  </button>
                </div>
              )}
          </div>
          {f.versions.map((v) => (
            <div
              key={v.id}
              className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 text-xs"
            >
              <span>
                V{v.ordinal} ·{" "}
                {v.status === "sealed"
                  ? "已封存"
                  : v.status === "uploading"
                    ? "待上传或封存"
                    : "已取消"}
              </span>
              {v.hash && (
                <span className="max-w-64 truncate font-mono" title={v.hash}>
                  SHA256 {v.hash}
                </span>
              )}
              {v.status === "sealed" &&
                !["response_material", "final_quote_material"].includes(
                  f.file.category || "",
                ) &&
                v.attachmentId &&
                can("buyer:agency:file:download") && (
                  <button
                    className={btn}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => agencyFileDownload(v.attachmentId!, f.file.name),
                        "附件已下载",
                      )
                    }
                  >
                    <Download size={13} />
                    下载
                  </button>
                )}
              {v.status === "uploading" &&
                d.canManageFiles &&
                !["response_material", "final_quote_material"].includes(
                  f.file.category || "",
                ) && (
                  <>
                    <label className={btn + " cursor-pointer"}>
                      <Upload size={13} />
                      选择文件
                      <input
                        className="hidden"
                        type="file"
                        accept=".docx,.xlsx,.pdf,.png,.jpg,.jpeg,.txt,.csv"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void run(
                              () => agencyFileUpload(v.id, file),
                              "文件已上传并封存",
                            );
                          e.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className={btn}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            agencyRequest(
                              `/file-versions/${v.id}/seal`,
                              "POST",
                              {},
                            ),
                          "文件已重新核验并封存",
                        )
                      }
                    >
                      重试封存
                    </button>
                    <button
                      className={btn}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => agencyFileCancel(v.id, "经办人取消未完成上传"),
                          "待上传版本已取消",
                        )
                      }
                    >
                      取消此版本
                    </button>
                  </>
                )}
              {v.reason && <span className="text-slate-400">{v.reason}</span>}
            </div>
          ))}
        </article>
      ))}
    </section>
  );
}
