import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  agencyFileUpload,
  agencyFileDownload,
  evaluationRequest as api,
  type AgencyDetail,
  type EvaluationView,
  type OpeningConfig,
  type OpeningWorkspace,
  type OpeningPreview,
  type AssessmentOverview,
  type AssessmentStageBoard,
} from "@24bid/api-client";
import { useAuthStore } from "../../lib/auth-store";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import { FeedbackNotice } from "@24bid/ui";
const btn =
    "rounded border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40",
  input = "w-full rounded border bg-white px-3 py-2 text-sm";
export const stageNames: Record<string, string> = {
  qualification: "资格审查",
  conformity: "符合性审查",
  evaluation: "评审或专业协商意见",
  legacy: "历史意见（未分阶段）",
};
const roles: Record<string, string> = {
  organizer: "项目组织人员",
  leader: "组长",
  qualification_reviewer: "资格审查人员",
  conformity_reviewer: "符合性审查人员",
  review_member: "评审成员",
  purchaser_rep: "采购人代表",
  supervisor: "监督人员",
};
const local = (s: string) =>
  s
    ? new Date(new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
const iso = (s: string) => (s ? new Date(s).toISOString() : "");
type Run = (fn: () => Promise<unknown>) => Promise<boolean>;
export function AgencyOpeningPanel({
  detail,
  round,
  busy,
  run,
}: {
  detail: AgencyDetail;
  round: EvaluationView;
  busy: boolean;
  run: Run;
}) {
  const { can } = useBuyerPermissions(),
    actor = useAuthStore((s) => s.session?.userId),
    member = round.config.members.find((m) => m.userId === actor);
  const custodian =
    !!member?.roles.some((r) => r === "organizer" || r === "leader") &&
    can("buyer:agency:evaluation:receipt:manage");
  const base = `/packages/${detail.record.id}/rounds/${round.round.id}`,
    path = base + "/materials",
    client = useQueryClient();
  const [open, setOpen] = useState(false);
  const q = useQuery({
    queryKey: ["agency-materials", round.round.id],
    queryFn: () => api<OpeningWorkspace>(path),
    enabled: open,
    refetchInterval: open ? 5000 : false,
  });
  const overview = useQuery({
    queryKey: ["agency-assessment", round.round.id],
    queryFn: () => api<AssessmentOverview>(base + "/assessment"),
    enabled: open && custodian,
    refetchInterval: open && custodian ? 5000 : false,
  });
  const [config, setConfig] = useState<OpeningConfig>({
      cutoffAt: "",
      notBefore: "",
      minimumSubjects: 1,
      ruleBasis: "",
      items: [],
    }),
    [version, setVersion] = useState(0),
    [dirty, setDirty] = useState(false),
    [reason, setReason] = useState(""),
    [reviewed, setReviewed] = useState(0);
  const [receipt, setReceipt] = useState({
      participationId: "",
      itemKey: "",
      fileName: "",
      receivedAt: "",
      originalType: "paper_scan",
      sourceNote: "",
      note: "",
      lateEntryReason: "",
    }),
    [withdraw, setWithdraw] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]),
    [preview, setPreview] = useState<OpeningPreview | null>(null),
    [proof, setProof] = useState(""),
    [actual, setActual] = useState(""),
    [note, setNote] = useState(""),
    [openingReviewed, setOpeningReviewed] = useState(false);
  const files = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " · V" + v.ordinal })),
    );
  const act = async (fn: () => Promise<unknown>) =>
    run(async () => {
      await fn();
      await q.refetch();
      await client.invalidateQueries({ queryKey: ["agency-detail"] });
    });
  const change = (patch: Partial<OpeningConfig>) => {
    setConfig((v) => ({ ...v, ...patch }));
    setDirty(true);
    setReviewed(0);
  };
  const w = q.data,
    plan = w?.plan;
  const conflict = dirty && version !== (plan?.version || 0);
  return (
    <details
      className="rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer font-semibold text-sm">
        材料接收与正式开启
      </summary>
      {q.error && (
        <FeedbackNotice tone="error" message={(q.error as Error).message} />
      )}
      {open && w && (
        <div
          className="mt-3 space-y-4"
          role="region"
          aria-label="受控材料工作区"
        >
          {!!w.issues?.length && (
            <FeedbackNotice tone="error" message={w.issues.join("；")} />
          )}
          <p className="text-xs text-slate-600">
            内部工作人员导入纸质扫描件或电子副本，不代表供应商身份。响应内容只有在正式开启确认后，才按清单中的职责开放；接收登记不等同资格或有效响应结论。
          </p>
          {custodian && (!plan || plan.status === "draft") && (
            <fieldset disabled={busy} className="space-y-3 rounded border p-3">
              <h5 className="font-semibold">接收计划与材料清单</h5>
              {plan && (
                <button
                  className={btn}
                  disabled={dirty}
                  onClick={() => {
                    if (w.config) {
                      setConfig(structuredClone(w.config));
                      setVersion(plan.version);
                      setDirty(true);
                      setReviewed(0);
                    }
                  }}
                >
                  编辑当前接收计划
                </button>
              )}
              {conflict && (
                <FeedbackNotice
                  tone="error"
                  message="计划版本已变化，编辑已保留。请清空编辑器后重新读取最新计划。"
                />
              )}
              <div className="grid gap-2 md:grid-cols-3">
                <label className="text-xs">
                  接收截止
                  <input
                    aria-label="材料接收截止"
                    className={input}
                    type="datetime-local"
                    value={local(config.cutoffAt)}
                    onChange={(e) => change({ cutoffAt: iso(e.target.value) })}
                  />
                </label>
                <label className="text-xs">
                  允许开启时间
                  <input
                    aria-label="材料允许开启时间"
                    className={input}
                    type="datetime-local"
                    value={local(config.notBefore)}
                    onChange={(e) => change({ notBefore: iso(e.target.value) })}
                  />
                </label>
                <label className="text-xs">
                  有依据的对象门槛
                  <input
                    aria-label="材料对象门槛"
                    type="number"
                    min={1}
                    max={30}
                    className={input}
                    value={config.minimumSubjects}
                    onChange={(e) =>
                      change({ minimumSubjects: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
              <textarea
                aria-label="接收清单及门槛依据"
                className={input}
                value={config.ruleBasis}
                onChange={(e) => change({ ruleBasis: e.target.value })}
                placeholder="记录定稿文件中的材料清单、数量门槛与时间依据"
              />
              {config.items.map((item, i) => (
                <div className="space-y-2 rounded border p-2" key={i}>
                  <div className="flex flex-wrap gap-2">
                    <input
                      aria-label={"材料项" + (i + 1) + "编号"}
                      className={input}
                      value={item.key}
                      onChange={(e) =>
                        change({
                          items: config.items.map((x, j) =>
                            i === j ? { ...x, key: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <input
                      aria-label={"材料项" + (i + 1) + "名称"}
                      className={input}
                      value={item.title}
                      onChange={(e) =>
                        change({
                          items: config.items.map((x, j) =>
                            i === j ? { ...x, title: e.target.value } : x,
                          ),
                        })
                      }
                    />
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        checked={item.required}
                        onChange={(e) =>
                          change({
                            items: config.items.map((x, j) =>
                              i === j
                                ? { ...x, required: e.target.checked }
                                : x,
                            ),
                          })
                        }
                      />{" "}
                      必需材料
                    </label>
                  </div>
                  <p className="text-xs">开启后可读职责（不自动全选）</p>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(roles).map(([role, title]) => (
                      <label className="text-xs" key={role}>
                        <input
                          aria-label={"材料项" + (i + 1) + "可读 " + title}
                          type="checkbox"
                          checked={item.readerRoles.includes(role)}
                          onChange={(e) =>
                            change({
                              items: config.items.map((x, j) =>
                                i === j
                                  ? {
                                      ...x,
                                      readerRoles: e.target.checked
                                        ? [...x.readerRoles, role]
                                        : x.readerRoles.filter(
                                            (r) => r !== role,
                                          ),
                                    }
                                  : x,
                              ),
                            })
                          }
                        />{" "}
                        {title}
                      </label>
                    ))}
                  </div>
                  <button
                    className={btn}
                    onClick={() =>
                      change({ items: config.items.filter((_, j) => i !== j) })
                    }
                  >
                    移除此材料项
                  </button>
                </div>
              ))}
              <button
                className={btn}
                disabled={config.items.length >= 20}
                onClick={() =>
                  change({
                    items: [
                      ...config.items,
                      { key: "", title: "", required: true, readerRoles: [] },
                    ],
                  })
                }
              >
                新增材料清单项
              </button>
              <textarea
                aria-label="接收计划维护原因"
                className={input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <button
                className={btn}
                disabled={
                  conflict ||
                  !dirty ||
                  !reason.trim() ||
                  !config.cutoffAt ||
                  !config.notBefore ||
                  !config.items.length
                }
                onClick={async () => {
                  if (
                    await act(() =>
                      api(path + "/plan", "PUT", {
                        expectedVersion: version,
                        config,
                        reason,
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    )
                  ) {
                    setDirty(false);
                    setReason("");
                  }
                }}
              >
                保存接收计划草稿
              </button>
              <button
                className={btn}
                onClick={() => {
                  setDirty(false);
                  setVersion(0);
                  setConfig({
                    cutoffAt: "",
                    notBefore: "",
                    minimumSubjects: 1,
                    ruleBasis: "",
                    items: [],
                  });
                  setReviewed(0);
                }}
              >
                清空计划编辑器
              </button>
              {plan && !dirty && (
                <>
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={reviewed === plan.version}
                      onChange={(e) =>
                        setReviewed(e.target.checked ? plan.version : 0)
                      }
                    />{" "}
                    已按定稿核对材料清单、截止、开启时间及对象门槛，确认锁定
                  </label>
                  <button
                    className={btn}
                    disabled={reviewed !== plan.version || !reason.trim()}
                    onClick={() =>
                      void act(() =>
                        api(path + "/plan/confirm", "POST", {
                          expectedVersion: plan.version,
                          reviewed: reviewed === plan.version,
                          reason,
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      )
                    }
                  >
                    确认并锁定接收计划
                  </button>
                </>
              )}
            </fieldset>
          )}
          {plan && w.config && (
            <div className="space-y-1 text-sm">
              <p>
                接收计划：
                {
                  (
                    {
                      draft: "草稿",
                      intake: "接收中，配置已锁定",
                      opened: "已正式开启",
                    } as Record<string, string>
                  )[plan.status]
                }{" "}
                · V{plan.version}
              </p>
              <p>
                截止：{new Date(w.config.cutoffAt).toLocaleString()} ·
                允许开启：{new Date(w.config.notBefore).toLocaleString()} ·
                对象门槛 {w.config.minimumSubjects}
              </p>
              <p>依据：{w.config.ruleBasis}</p>
              {w.config.items.map((i) => (
                <p key={i.key}>
                  {i.title} · {i.required ? "必需" : "选填"} · 开启后可读：
                  {i.readerRoles.map((r) => roles[r]).join("、")}
                </p>
              ))}
            </div>
          )}
          {custodian && plan?.status === "intake" && (
            <details>
              <summary className="font-semibold text-sm">
                登记接收响应材料
              </summary>
              <fieldset disabled={busy} className="mt-3 space-y-2">
                <select
                  aria-label="接收材料所属对象"
                  className={input}
                  value={receipt.participationId}
                  onChange={(e) =>
                    setReceipt((r) => ({
                      ...r,
                      participationId: e.target.value,
                    }))
                  }
                >
                  <option value="">请选择内部台账对象</option>
                  {overview.data?.availableSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplierName}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="接收材料清单项"
                  className={input}
                  value={receipt.itemKey}
                  onChange={(e) =>
                    setReceipt((r) => ({ ...r, itemKey: e.target.value }))
                  }
                >
                  <option value="">请选择已锁定材料项</option>
                  {w.config?.items.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.title}
                    </option>
                  ))}
                </select>
                <input
                  aria-label="接收材料文件名称"
                  className={input}
                  value={receipt.fileName}
                  onChange={(e) =>
                    setReceipt((r) => ({ ...r, fileName: e.target.value }))
                  }
                  placeholder="保留扩展名的文件名称"
                />
                <label className="text-xs">
                  实际接收时间
                  <input
                    aria-label="响应实际接收时间"
                    type="datetime-local"
                    className={input}
                    value={receipt.receivedAt}
                    onChange={(e) =>
                      setReceipt((r) => ({ ...r, receivedAt: e.target.value }))
                    }
                  />
                </label>
                <select
                  aria-label="响应原件类型"
                  className={input}
                  value={receipt.originalType}
                  onChange={(e) =>
                    setReceipt((r) => ({ ...r, originalType: e.target.value }))
                  }
                >
                  <option value="paper_scan">纸质原件扫描副本</option>
                  <option value="electronic_copy">电子副本</option>
                </select>
                <textarea
                  aria-label="响应材料来源"
                  className={input}
                  value={receipt.sourceNote}
                  onChange={(e) =>
                    setReceipt((r) => ({ ...r, sourceNote: e.target.value }))
                  }
                  placeholder="实际来源及原件保管说明"
                />
                <textarea
                  aria-label="响应接收补录依据"
                  className={input}
                  value={receipt.lateEntryReason}
                  onChange={(e) =>
                    setReceipt((r) => ({
                      ...r,
                      lateEntryReason: e.target.value,
                    }))
                  }
                  placeholder="截止后补录时，说明实际接收时间的核对依据"
                />
                <textarea
                  aria-label="响应接收备注"
                  className={input}
                  value={receipt.note}
                  onChange={(e) =>
                    setReceipt((r) => ({ ...r, note: e.target.value }))
                  }
                />
                <button
                  className={btn}
                  disabled={
                    !receipt.participationId ||
                    !receipt.itemKey ||
                    !receipt.fileName.trim() ||
                    !receipt.receivedAt ||
                    !receipt.sourceNote.trim()
                  }
                  onClick={async () => {
                    if (
                      await act(() =>
                        api(path + "/receipts", "POST", {
                          ...receipt,
                          receivedAt: iso(receipt.receivedAt),
                          idempotencyKey: crypto.randomUUID(),
                        }),
                      )
                    )
                      setReceipt({
                        participationId: "",
                        itemKey: "",
                        fileName: "",
                        receivedAt: "",
                        originalType: "paper_scan",
                        sourceNote: "",
                        note: "",
                        lateEntryReason: "",
                      });
                  }}
                >
                  建立接收登记并上传
                </button>
              </fieldset>
            </details>
          )}
          {w.receipts.map((r) => (
            <article
              aria-label={"响应接收 " + r.file.file.name}
              key={r.receipt.id}
              className="space-y-2 rounded border p-3 text-sm"
            >
              <strong>
                {r.file.file.name} ·{" "}
                {r.receipt.status === "withdrawn" ? "接收已撤回" : "接收登记"}
              </strong>
              <p>
                材料项：
                {
                  w.config?.items.find((i) => i.key === r.receipt.itemKey)
                    ?.title
                }{" "}
                · 实际接收：{new Date(r.receipt.receivedAt).toLocaleString()} ·{" "}
                {r.receipt.originalType === "paper_scan"
                  ? "纸质原件扫描副本"
                  : "电子副本"}
              </p>
              <p>来源：{r.receipt.sourceNote}</p>
              {r.receipt.lateEntryReason && (
                <p>补录依据：{r.receipt.lateEntryReason}</p>
              )}
              {r.receipt.withdrawReason && (
                <p>撤回原因：{r.receipt.withdrawReason}</p>
              )}
              {r.file.versions.map((v) => (
                <div key={v.id} className="space-y-2">
                  <p>
                    V{v.ordinal} ·{" "}
                    {v.status === "sealed"
                      ? "已检查封存"
                      : v.status === "uploading"
                        ? "待上传"
                        : "已取消"}{" "}
                    {v.hash && (
                      <span className="break-all text-xs">
                        {" "}
                        · SHA256 {v.hash}
                      </span>
                    )}
                  </p>
                  {custodian &&
                    plan?.status === "intake" &&
                    r.receipt.status === "received" &&
                    v.status === "uploading" && (
                      <input
                        aria-label={"上传受控材料 " + r.file.file.name}
                        type="file"
                        accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt"
                        disabled={busy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file)
                            void act(() => agencyFileUpload(v.id, file));
                          e.target.value = "";
                        }}
                      />
                    )}
                  {r.readable && can("buyer:agency:file:download") && (
                    <button
                      className={btn}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const d = await api<{
                            attachmentId: string;
                            name: string;
                          }>(path + "/receipts/" + r.receipt.id + "/artifact");
                          await agencyFileDownload(d.attachmentId, d.name);
                        })
                      }
                    >
                      下载已开启响应材料
                    </button>
                  )}
                </div>
              ))}
              {!r.readable && (
                <p className="text-xs text-amber-800">
                  内容未开放。创建人及普通文件权限不能绕过正式开启和职责范围。
                </p>
              )}
              {custodian &&
                plan?.status === "intake" &&
                r.receipt.status === "received" && (
                  <>
                    <input
                      aria-label={"接收撤回原因 " + r.file.file.name}
                      className={input}
                      value={withdraw[r.receipt.id] || ""}
                      onChange={(e) =>
                        setWithdraw((v) => ({
                          ...v,
                          [r.receipt.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      className={btn}
                      disabled={busy || !withdraw[r.receipt.id]?.trim()}
                      onClick={() =>
                        void act(() =>
                          api(
                            path + "/receipts/" + r.receipt.id + "/withdraw",
                            "POST",
                            {
                              expectedVersion: r.receipt.version,
                              reason: withdraw[r.receipt.id],
                            },
                          ),
                        )
                      }
                    >
                      撤回错误接收登记并保留原件
                    </button>
                  </>
                )}
            </article>
          ))}
          {custodian &&
            can("buyer:agency:evaluation:opening") &&
            plan?.status === "intake" && (
              <fieldset
                disabled={busy}
                className="space-y-3 rounded border p-3"
              >
                <h5 className="font-semibold">正式开启核对</h5>
                {overview.data?.availableSubjects.map((s) => (
                  <label className="mr-4 inline-flex gap-2 text-sm" key={s.id}>
                    <input
                      aria-label={"开启对象 " + s.supplierName}
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={(e) => {
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, s.id]
                            : v.filter((x) => x !== s.id),
                        );
                        setPreview(null);
                        setOpeningReviewed(false);
                      }}
                    />
                    {s.supplierName}
                  </label>
                ))}
                <button
                  className={btn}
                  disabled={!selected.length}
                  onClick={() =>
                    void run(async () => {
                      setPreview(
                        await api<OpeningPreview>(path + "/preview", "POST", {
                          participationIds: selected,
                        }),
                      );
                      setOpeningReviewed(false);
                    })
                  }
                >
                  生成开启预览
                </button>
                {preview && (
                  <>
                    <p className="text-sm">
                      核对对象 {preview.subjects.length} 个，封存材料{" "}
                      {preview.manifest.length} 份。
                    </p>
                    {preview.blockers.map((t) => (
                      <p key={t} className="text-sm text-red-700">
                        {t}
                      </p>
                    ))}
                    <select
                      aria-label="正式开启凭证版本"
                      className={input}
                      value={proof}
                      onChange={(e) => {
                        setProof(e.target.value);
                        setOpeningReviewed(false);
                      }}
                    >
                      <option value="">请选择封存的开启记录凭证</option>
                      {files.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <label className="text-xs">
                      实际线下开启时间
                      <input
                        aria-label="正式实际开启时间"
                        type="datetime-local"
                        className={input}
                        value={actual}
                        onChange={(e) => {
                          setActual(e.target.value);
                          setOpeningReviewed(false);
                        }}
                      />
                    </label>
                    <textarea
                      aria-label="正式开启人工核对说明"
                      className={input}
                      value={note}
                      onChange={(e) => {
                        setNote(e.target.value);
                        setOpeningReviewed(false);
                      }}
                    />
                    <label className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={openingReviewed}
                        onChange={(e) => setOpeningReviewed(e.target.checked)}
                      />{" "}
                      已人工核对真实开启记录、材料版本、对象及职责范围，确认正式开放本批内容
                    </label>
                    <button
                      className={btn}
                      disabled={
                        !openingReviewed ||
                        !proof ||
                        !actual ||
                        !note.trim() ||
                        preview.blockers.length > 0 ||
                        preview.planVersion !== plan.version
                      }
                      onClick={() =>
                        void act(() =>
                          api(path + "/open", "POST", {
                            expectedVersion: preview.planVersion,
                            participationIds: selected,
                            previewFingerprint: preview.fingerprint,
                            openedAt: iso(actual),
                            evidenceVersionId: proof,
                            reviewed: openingReviewed,
                            note,
                            idempotencyKey: crypto.randomUUID(),
                          }),
                        )
                      }
                    >
                      确认正式开启并按职责开放
                    </button>
                  </>
                )}
              </fieldset>
            )}
          {w.opening && (
            <div className="space-y-2 rounded border bg-blue-50 p-3 text-sm">
              <p>
                已正式开启：{new Date(w.opening.openedAt).toLocaleString()} ·{" "}
                {w.opening.subjects.map((s) => s.supplierName).join("、")}
              </p>
              <p>{w.opening.note}</p>
              <p className="break-all text-xs">
                开启清单SHA256：{w.opening.manifestHash}
              </p>
              {custodian &&
                can("buyer:agency:evaluation:organize") &&
                overview.data?.sessions.length === 0 && (
                  <button
                    className={btn}
                    disabled={
                      busy ||
                      round.frozenBasisStale ||
                      round.round.status !== "frozen"
                    }
                    onClick={() =>
                      void run(async () => {
                        const o = w.opening!;
                        await api(base + "/assessment", "POST", {
                          expectedRoundVersion: round.round.version,
                          participationIds: o.subjects.map(
                            (s) => s.participationId,
                          ),
                          openingEvidenceVersionId: o.evidenceVersionId,
                          openedAt: o.openedAt,
                          openingReviewed: true,
                          note: "依据已核对的正式开启快照建立分阶段独立任务",
                          idempotencyKey: crypto.randomUUID(),
                        });
                        await client.invalidateQueries({
                          queryKey: ["agency-assessment", round.round.id],
                        });
                      })
                    }
                  >
                    按开启快照建立独立任务
                  </button>
                )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
export function AgencyStagePanel({
  detail,
  session,
  busy,
  run,
}: {
  detail: AgencyDetail;
  session: string;
  busy: boolean;
  run: Run;
}) {
  const path = `/packages/${detail.record.id}/sessions/${session}/stages`;
  const q = useQuery({
    queryKey: ["agency-stages", session],
    queryFn: () => api<AssessmentStageBoard>(path),
    refetchInterval: 5000,
  });
  return (
    <details>
      <summary className="text-sm font-semibold">阶段条件与后续开放</summary>
      {q.error && (
        <FeedbackNotice tone="error" message={(q.error as Error).message} />
      )}
      <p className="text-xs">
        前阶段全部独立提交且无待审更正后才提供进入对象核对；不返回个人分值和评语，不自动给出总体资格结论。
      </p>
      {q.data?.stages.map((s) => (
        <div key={s.stageKey} className="my-3 rounded border p-3">
          <p className="text-sm font-semibold">
            {stageNames[s.stageKey]} ·{" "}
            {s.released
              ? s.complete
                ? "已开放，意见已全部提交"
                : "已开放，等待独立提交"
              : "尚未开放"}
          </p>
          {!s.released && (
            <StageForm
              detail={detail}
              state={s}
              path={path}
              busy={busy}
              run={async (fn) =>
                run(async () => {
                  await fn();
                  await q.refetch();
                })
              }
            />
          )}
        </div>
      ))}
    </details>
  );
}
function StageForm({
  detail,
  state: s,
  path,
  busy,
  run,
}: {
  detail: AgencyDetail;
  state: AssessmentStageBoard["stages"][number];
  path: string;
  busy: boolean;
  run: Run;
}) {
  const [ids, setIds] = useState<string[]>([]),
    [exclusions, setExclusions] = useState<Record<string, string>>({}),
    [proof, setProof] = useState(""),
    [note, setNote] = useState(""),
    [confirmationHash, setConfirmationHash] = useState("");
  const files = detail.files
    .filter((f) => f.file.visibility === "project")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " · V" + v.ordinal })),
    );
  return (
    <fieldset disabled={busy} className="mt-2 space-y-2">
      {!s.candidates.length && (
        <p className="text-sm text-amber-800">前阶段尚未满足开放条件。</p>
      )}
      {s.candidates.map((c) => (
        <div key={c.participationId}>
          <label className="flex gap-2 text-sm">
            <input
              aria-label={"下一阶段对象 " + c.supplierName}
              type="checkbox"
              disabled={!c.priorPassed}
              checked={ids.includes(c.participationId)}
              onChange={(e) => {
                setIds((v) =>
                  e.target.checked
                    ? [...v, c.participationId]
                    : v.filter((x) => x !== c.participationId),
                );
                setConfirmationHash("");
              }}
            />
            {c.supplierName} ·{" "}
            {c.priorPassed
              ? "前阶段未见不通过结论，仍须人工确认"
              : "存在不通过意见，不开放直接进入"}
          </label>
          {!ids.includes(c.participationId) && (
            <input
              aria-label={"未进入后阶段依据 " + c.supplierName}
              className={input}
              value={exclusions[c.participationId] || ""}
              onChange={(e) => {
                setExclusions((v) => ({
                  ...v,
                  [c.participationId]: e.target.value,
                }));
                setConfirmationHash("");
              }}
              placeholder="未进入本阶段的处理依据"
            />
          )}
        </div>
      ))}
      <select
        aria-label={"阶段依据版本 " + s.stageKey}
        className={input}
        value={proof}
        onChange={(e) => {
          setProof(e.target.value);
          setConfirmationHash("");
        }}
      >
        <option value="">请选择已封存处理依据</option>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
      <textarea
        aria-label={"阶段核对说明 " + s.stageKey}
        className={input}
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
          setConfirmationHash("");
        }}
      />
      <label className="flex gap-2 text-sm">
        <input
          aria-label={"已核对阶段 " + s.stageKey}
          type="checkbox"
          checked={
            !!s.prerequisiteHash && confirmationHash === s.prerequisiteHash
          }
          onChange={(e) =>
            setConfirmationHash(e.target.checked ? s.prerequisiteHash : "")
          }
        />{" "}
        已核对前阶段提交、进入对象及未进入原因，确认开放本阶段
      </label>
      <button
        className={btn}
        disabled={
          !ids.length ||
          !proof ||
          !note.trim() ||
          !s.candidates.length ||
          confirmationHash !== s.prerequisiteHash ||
          s.candidates.some(
            (c) =>
              !ids.includes(c.participationId) &&
              !exclusions[c.participationId]?.trim(),
          ) ||
          ids.some(
            (id) =>
              !s.candidates.some(
                (c) => c.participationId === id && c.priorPassed,
              ),
          )
        }
        onClick={() =>
          void run(() =>
            api(path + "/" + s.stageKey + "/release", "POST", {
              participationIds: ids,
              exclusions: Object.fromEntries(
                s.candidates
                  .filter((c) => !ids.includes(c.participationId))
                  .map((c) => [
                    c.participationId,
                    exclusions[c.participationId],
                  ]),
              ),
              prerequisiteHash: s.prerequisiteHash,
              evidenceVersionId: proof,
              reviewed: true,
              note,
              idempotencyKey: crypto.randomUUID(),
            }),
          )
        }
      >
        确认开放{stageNames[s.stageKey]}
      </button>
    </fieldset>
  );
}
