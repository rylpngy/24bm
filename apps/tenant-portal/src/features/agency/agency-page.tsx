import { AgencyExecutionPanel } from "./agency-execution-panel";
import { AgencyNumberingPanel } from "./agency-numbering-panel";
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
} from "lucide-react";
import { Panel, FeedbackNotice } from "@24bid/ui";
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
  const [draft, setDraft] = useState<AgencyDraft | null>(null),
    [message, setMessage] = useState<{
      tone: "error" | "success";
      message: string;
    } | null>(null),
    [busy, setBusy] = useState(false);
  const [keyword, setKeyword] = useState(""),
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
        pageSize: 10,
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
  const d = detail.data;
  return (
    <Panel
      title="招标代理项目库"
      icon={FolderKanban}
      subtitle="以采购包为执行单元，贯通建档、审批与版本资料"
    >
      <div className="mb-4 flex flex-wrap justify-between gap-2">
        <div className="flex gap-2">
          {(id || draft) && (
            <button className={btn} disabled={busy} onClick={() => open(null)}>
              <ArrowLeft size={15} />
              返回项目库
            </button>
          )}
          <button
            className={btn}
            disabled={busy}
            onClick={() => void refresh()}
          >
            <RefreshCw size={15} />
            刷新
          </button>
        </div>
        {!id && !draft && can("buyer:agency:manage") && (
          <button
            className={btn + " !bg-blue-600 !text-white"}
            onClick={() => {
              setCount(1);
              setDraft({ ...empty(), groupId: groupId || undefined });
              batchKey.current = crypto.randomUUID();
            }}
          >
            <Plus size={15} />
            新建采购包
          </button>
        )}
      </div>
      {message && (
        <div className="mb-4">
          <FeedbackNotice {...message} />
        </div>
      )}
      {options.data && can("buyer:agency:configure") && (
        <AgencyNumberingPanel value={options.data.numbering} />
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
          <div className="mb-4 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field label="项目名称或编号">
              <input
                className={input}
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索采购包"
              />
            </Field>
            <Field label="所属项目">
              <select
                className={input}
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部项目</option>
                {groups.data?.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="采购方式">
              <select
                className={input}
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部方式</option>
                {options.data?.procurementMethods.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="主负责人">
              <select
                className={input}
                value={owner}
                onChange={(e) => {
                  setOwner(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部负责人</option>
                {options.data?.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="建档状态">
              <select
                className={input}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部状态</option>
                {Object.entries(states).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <div className="self-end text-sm text-slate-500">
              共 {list.data?.total ?? 0} 个采购包
            </div>
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
          {list.isLoading ? (
            <p>加载项目中…</p>
          ) : list.isError ? (
            <FeedbackNotice tone="error" message={err(list.error)} />
          ) : !list.data?.items.length ? (
            <p className="rounded-lg border border-dashed p-10 text-center text-sm text-slate-500">
              暂无符合条件的采购包。洽谈阶段即可新建档案，委托协议后补。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    {[
                      "项目编号与采购包",
                      "所属项目",
                      "采购方式",
                      "负责人",
                      "预算",
                      "状态",
                      "",
                    ].map((t, i) => (
                      <th key={i} className="p-3">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3">
                        <div className="font-semibold">
                          {p.title || "未命名草稿"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">
                          {p.number || "首次提交时编号"}
                        </div>
                      </td>
                      <td className="p-3">
                        {groups.data?.find((g) => g.id === p.groupId)?.name ||
                          "—"}
                      </td>
                      <td className="p-3">{p.procurementMethod || "待补"}</td>
                      <td className="p-3">
                        {options.data?.users.find((u) => u.id === p.ownerId)
                          ?.name || "待指定"}
                      </td>
                      <td className="p-3">
                        {p.budget == null
                          ? "待补"
                          : `${p.currency} ${p.budget}`}
                      </td>
                      <td className="p-3">
                        {states[p.status]}
                        {p.workflowId && p.status === "approved"
                          ? " · 变更审核中"
                          : ""}
                      </td>
                      <td className="p-3">
                        <button className={btn} onClick={() => open(p.id)}>
                          查看档案
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <button
              className={btn}
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </button>
            <span className="self-center text-sm">第 {page} 页</span>
            <button
              className={btn}
              disabled={!list.data || page * 10 >= list.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}
      {id && detail.isLoading && <p>加载档案中…</p>}
      {id && detail.isError && (
        <FeedbackNotice tone="error" message={err(detail.error)} />
      )}
      {id && d && !draft && (
        <>
          <div className="mb-5 rounded-xl bg-slate-50 p-5">
            <p className="text-xs text-slate-500">
              {d.record.number || "未编号草稿"} · 版本 {d.record.version}
            </p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {d.record.title || "未命名草稿"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {d.record.procurementMethod || "采购方式待补"} · 半流程 ·{" "}
              {states[d.record.status]}
              {d.record.workflowId && d.record.status === "approved"
                ? " · 重要变更审核中"
                : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <span>
                业务：
                {d.businessStatus === "published"
                  ? "已发布"
                  : d.businessStatus === "not_started"
                    ? "未开始"
                    : d.businessStatus === "closed"
                      ? "已办结"
                      : d.businessStatus === "in_progress"
                        ? "办理中"
                        : d.businessStatus}
              </span>
              <span>
                档案：
                {d.archiveCompletion === "complete"
                  ? "已完成"
                  : "持续累积／待补件"}
              </span>
              <span>
                费用：
                {d.financialStatus === "settled"
                  ? "已结清"
                  : d.financialStatus === "unsettled"
                    ? "未结清"
                    : "未核算"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
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
            </div>
          </div>
          <div className="mb-5 grid gap-4 md:grid-cols-2">
            <Info
              title="基础与分类"
              values={{
                所属项目:
                  groups.data?.find((g) => g.id === d.data.groupId)?.name || "",
                采购对象: d.data.objectCode || "",
                适用制度: d.data.regime || "",
                地区: d.data.region || "",
                预算: d.data.budget ?? "",
                最高限价: d.data.ceiling ?? "",
              }}
            />
            <Info title="采购人与联系人" values={d.data.purchaser} />
            <Info title="委托与服务范围" values={d.data.entrustment} />
            <Info
              title="项目组织"
              values={Object.fromEntries(
                d.members.map((m) => [
                  m.name,
                  m.role === "OWNER"
                    ? "主负责人"
                    : m.role === "EDITOR"
                      ? "协作编辑"
                      : m.role === "DRAFTER"
                        ? "文件编制人"
                        : m.role === "OFFICE"
                          ? "办公室对接"
                          : "只读成员",
                ]),
              )}
            />
            <Info title="服务费约定" values={d.data.feeAgreement} />
            <Info title="补充资料" values={d.data.supplement} />
          </div>
          <FilePanel detail={d} busy={busy} run={action} />
          {d.record.status === "approved" && (
            <AgencyExecutionPanel detail={d} />
          )}
          <section className="mt-5">
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
                {r.workflowId && (
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
          <details className="mt-5 rounded-lg border p-3">
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
              {id ? "维护采购包档案" : "新建采购包档案"}
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
function Info({
  title,
  values,
}: {
  title: string;
  values: Record<string, string>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <dl className="grid gap-2 text-sm">
        {Object.entries(values)
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-3">
              <dt className="text-slate-500">{labels[k] || k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        {!Object.values(values).some(Boolean) && (
          <p className="text-slate-400">待补充</p>
        )}
      </dl>
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
          {select("主负责人（当前限一名）", "ownerId", o?.users || [])}
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
function FilePanel({
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
