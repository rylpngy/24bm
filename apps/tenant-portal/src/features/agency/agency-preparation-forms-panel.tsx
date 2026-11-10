import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyFileDownload,
  executionRequest as api,
  type AgencyDetail,
  type PreparationFormsWorkspace,
  type PreparationFormView,
} from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
const btn =
  "rounded border border-slate-200 bg-white px-3 py-2 text-sm font-semibold whitespace-nowrap disabled:opacity-40";
const input =
  "w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm";
export const preparationRoles: Record<string, string> = {
  purchaser_rep: "采购人代表",
  review_member: "评审成员",
  leader: "组长",
  qualification_reviewer: "资格审查人员",
  conformity_reviewer: "符合性审查人员",
  organizer: "项目组织人员",
  supervisor: "监督人员",
  other: "其他准备人员",
};
const kinds: Record<string, string> = {
  attendance: "人员签到表",
  disclosure: "回避事项声明表",
  confidentiality: "保密承诺表",
  integrity: "廉洁承诺表",
};
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-600">{label}</p>
      {children}
    </div>
  );
}
type Run = (f: () => Promise<unknown>) => Promise<boolean>;
export function AgencyPreparationFormsPanel({
  detail,
  editable,
  busy,
  run,
}: {
  detail: AgencyDetail;
  editable: boolean;
  busy: boolean;
  run: Run;
}) {
  const pkg = detail.record.id;
  const query = useQuery({
    queryKey: ["agency-preparation-forms", pkg],
    queryFn: () =>
      api<PreparationFormsWorkspace>(`/packages/${pkg}/preparation-forms`),
    refetchInterval: 5000,
  });
  const [personId, setPersonId] = useState<string | null>(null),
    [person, setPerson] = useState({
      name: "",
      organization: "",
      role: "organizer",
      status: "active",
      reason: "",
      expectedVersion: 0,
    });
  const [kind, setKind] = useState("attendance"),
    [title, setTitle] = useState(kinds.attendance),
    [body, setBody] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [versions, setVersions] = useState<Record<string, number>>({}),
    [base, setBase] = useState({ packageVersion: 0, preparationVersion: 0 }),
    [dirty, setDirty] = useState(false),
    [reviewed, setReviewed] = useState(false),
    [newVersionOf, setNewVersionOf] = useState("");
  const generationKey = useRef(crypto.randomUUID());
  const [returnForm, setReturnForm] = useState(""),
    [signedPeople, setSignedPeople] = useState<string[]>([]),
    [proof, setProof] = useState(""),
    [signedOn, setSignedOn] = useState(""),
    [note, setNote] = useState(""),
    [staleReason, setStaleReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [voidReasons, setVoidReasons] = useState<Record<string, string>>({});
  const returnKey = useRef(crypto.randomUUID());
  const generationBox = useRef<HTMLDetailsElement>(null),
    returnBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (returnForm) returnBox.current?.scrollIntoView({ block: "start" });
  }, [returnForm]);
  const w = query.data;
  useEffect(() => {
    if (w && !dirty)
      setBase({
        packageVersion: w.packageVersion,
        preparationVersion: w.preparationVersion,
      });
  }, [w?.packageVersion, w?.preparationVersion, dirty]);
  const refresh = () => query.refetch();
  const act = (f: () => Promise<unknown>) =>
    run(async () => {
      await f();
      await refresh();
    });
  const reset = () => {
    setPersonId(null);
    setPerson({
      name: "",
      organization: "",
      role: "organizer",
      status: "active",
      reason: "",
      expectedVersion: 0,
    });
  };

  const editFrom = (view: PreparationFormView) => {
    if (!w) return;
    const active = view.people.filter((p) =>
      w.people.some((n) => n.id === p.id && n.status === "active"),
    );
    setKind(view.form.kind);
    setTitle(view.form.title);
    setBody(view.form.bodyText);
    setSelected(active.map((p) => p.id));
    setVersions(
      Object.fromEntries(
        active.map((p) => [p.id, w.people.find((n) => n.id === p.id)!.version]),
      ),
    );
    setNewVersionOf(view.form.id);
    setBase({
      packageVersion: w.packageVersion,
      preparationVersion: w.preparationVersion,
    });
    setDirty(true);
    setReviewed(false);
    generationKey.current = crypto.randomUUID();
    if (generationBox.current) {
      generationBox.current.open = true;
      generationBox.current.scrollIntoView({ block: "start" });
    }
  };
  const beginReturn = (id: string) => {
    setReturnForm(id);
    setSignedPeople([]);
    setProof("");
    setSignedOn("");
    setNote("");
    setStaleReason("");
    setConfirmed(false);
    returnKey.current = crypto.randomUUID();
  };
  const downloading = (id: string, signature = false) =>
    act(async () => {
      const data = await api<{ attachmentId: string; name: string }>(
        `/packages/${pkg}/preparation-${signature ? "returns" : "forms"}/${id}/artifact`,
      );
      await agencyFileDownload(data.attachmentId, data.name);
    });
  const selectedForm = w?.forms.find((f) => f.form.id === returnForm);
  const proofFiles = detail.files
    .filter((f) => f.file.category === "preparation_signed")
    .flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => ({ id: v.id, name: f.file.name + " · V" + v.ordinal })),
    );
  const baseChanged =
    !!w &&
    (base.packageVersion !== w.packageVersion ||
      base.preparationVersion !== w.preparationVersion ||
      selected.some(
        (id) => versions[id] !== w.people.find((p) => p.id === id)?.version,
      ));
  return (
    <section
      className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4"
      aria-label="会前人员表单与签署回传"
    >
      <h4 className="font-bold">会前人员表单与签署回传</h4>
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <p className="text-xs text-slate-500">
          准备人员记录不授予评审或评分权限。表单生成时冻结名单和内容，签名与到场栏留空；签署件由工作人员人工核对并关联，不作电子签名验证。名单和文件按人员保密及文件权限控制。
        </p>
        {query.isError && (
          <FeedbackNotice
            tone="error"
            message="人员表单读取失败，请核对保密与文件权限后刷新。"
          />
        )}
        {!w ? (
          <p>加载人员与表单中…</p>
        ) : (
          <>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">
                准备人员名单（
                {w.people.filter((p) => p.status === "active").length}名有效）
              </summary>
              <div className="mt-3 space-y-3">
                {w.people.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-sm"
                  >
                    <span>
                      {p.name} · {p.organization} · {preparationRoles[p.role]} ·{" "}
                      {p.status === "active" ? "有效" : "已移除"} · V{p.version}
                    </span>
                    {editable && (
                      <button
                        className={btn}
                        disabled={busy}
                        onClick={() => {
                          setPersonId(p.id);
                          setPerson({
                            name: p.name,
                            organization: p.organization,
                            role: p.role,
                            status: p.status,
                            reason: "",
                            expectedVersion: p.version,
                          });
                        }}
                      >
                        修订人员
                      </button>
                    )}
                  </div>
                ))}
                {editable && (
                  <div className="space-y-3 rounded bg-slate-50 p-3">
                    <div className="grid gap-2 md:grid-cols-3">
                      <Field label="准备人员姓名">
                        <input
                          aria-label="准备人员姓名"
                          className={input}
                          value={person.name}
                          onChange={(e) =>
                            setPerson({ ...person, name: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="准备人员单位">
                        <input
                          aria-label="准备人员单位"
                          className={input}
                          value={person.organization}
                          onChange={(e) =>
                            setPerson({
                              ...person,
                              organization: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="准备职责">
                        <select
                          aria-label="准备职责"
                          className={input}
                          value={person.role}
                          onChange={(e) =>
                            setPerson({ ...person, role: e.target.value })
                          }
                        >
                          {Object.entries(preparationRoles).map(([v, n]) => (
                            <option key={v} value={v}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="人员状态">
                        <select
                          aria-label="人员状态"
                          className={input}
                          value={person.status}
                          onChange={(e) =>
                            setPerson({ ...person, status: e.target.value })
                          }
                        >
                          <option value="active">有效</option>
                          <option value="removed">移除并保留历史</option>
                        </select>
                      </Field>
                      <Field label="人员维护原因">
                        <input
                          aria-label="人员维护原因"
                          className={input}
                          value={person.reason}
                          onChange={(e) =>
                            setPerson({ ...person, reason: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <button
                      className={btn}
                      disabled={
                        busy || !person.name.trim() || !person.reason.trim()
                      }
                      onClick={async () => {
                        if (
                          await act(() =>
                            api(
                              `/packages/${pkg}/preparation-people${personId ? "/" + personId : ""}`,
                              personId ? "PUT" : "POST",
                              person,
                            ),
                          )
                        )
                          reset();
                      }}
                    >
                      {personId ? "保存人员修订" : "新增准备人员"}
                    </button>
                    {personId && (
                      <button className={btn} disabled={busy} onClick={reset}>
                        取消人员修订
                      </button>
                    )}
                  </div>
                )}
              </div>
            </details>
            {editable && (
              <details ref={generationBox}>
                <summary className="cursor-pointer text-sm font-semibold">
                  生成打印表单
                </summary>
                <div className="mt-3 space-y-3">
                  {baseChanged && (
                    <FeedbackNotice
                      tone="info"
                      message="项目、准备信息或所选人员已变化，请核对后更新生成基线。"
                    />
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="打印表单类型">
                      <select
                        aria-label="打印表单类型"
                        className={input}
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value);
                          setTitle(kinds[e.target.value]);
                          setNewVersionOf("");
                          setReviewed(false);
                          setDirty(true);
                          generationKey.current = crypto.randomUUID();
                        }}
                      >
                        {Object.entries(kinds).map(([v, n]) => (
                          <option key={v} value={v}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="打印表单标题">
                      <input
                        aria-label="打印表单标题"
                        className={input}
                        value={title}
                        onChange={(e) => {
                          setTitle(e.target.value);
                          setDirty(true);
                          setReviewed(false);
                        }}
                      />
                    </Field>
                  </div>
                  <fieldset className="space-y-2">
                    <legend className="mb-2 text-xs font-semibold">
                      选择打印人员（签到表1至30人，个人声明或承诺表1人）
                    </legend>
                    {w.people
                      .filter((p) => p.status === "active")
                      .map((p) => (
                        <label key={p.id} className="flex gap-2 text-sm">
                          <input
                            type="checkbox"
                            aria-label={"打印人员 " + p.name}
                            checked={selected.includes(p.id)}
                            onChange={(e) => {
                              setSelected((ids) =>
                                e.target.checked
                                  ? [...ids, p.id]
                                  : ids.filter((id) => id !== p.id),
                              );
                              setVersions((v) => ({ ...v, [p.id]: p.version }));
                              setDirty(true);
                              setReviewed(false);
                            }}
                          />
                          {p.name} · {p.organization} ·{" "}
                          {preparationRoles[p.role]}
                        </label>
                      ))}
                  </fieldset>
                  <Field label="经人工复核的表单正文">
                    <textarea
                      aria-label="经人工复核的表单正文"
                      className={input + " min-h-28"}
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        setDirty(true);
                        setReviewed(false);
                      }}
                    />
                  </Field>
                  <p className="text-xs text-slate-500">
                    个人声明与承诺表须填写适用正文，由项目人员核对，不自动生成法律或制度条款。复制旧表生成新版本时只带入当前有效人员，已移除人员不会自动带入。
                  </p>
                  {newVersionOf && (
                    <p className="text-xs text-blue-700">
                      正在基于已有表单生成下一版本；旧打印稿和回传件保留，新表不继承旧签署记录。
                    </p>
                  )}
                  <label className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    已核对表单内容、人员和适用性，确认生成未签署打印稿
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={btn}
                      disabled={
                        busy ||
                        !reviewed ||
                        baseChanged ||
                        selected.length === 0 ||
                        selected.length > 30 ||
                        (kind !== "attendance" &&
                          (selected.length !== 1 || !body.trim()))
                      }
                      onClick={async () => {
                        if (
                          await act(async () => {
                            const result = await api<PreparationFormView>(
                              `/packages/${pkg}/preparation-forms`,
                              "POST",
                              {
                                expectedPackageVersion: base.packageVersion,
                                expectedPreparationVersion:
                                  base.preparationVersion,
                                kind,
                                title,
                                peopleIds: selected,
                                peopleVersions: versions,
                                body,
                                newVersionOf: newVersionOf || null,
                                contentReviewed: reviewed,
                                idempotencyKey: generationKey.current,
                              },
                            );
                            setNewVersionOf(result.form.id);
                          })
                        ) {
                          setReviewed(false);
                          setDirty(false);
                          generationKey.current = crypto.randomUUID();
                        }
                      }}
                    >
                      生成未签署打印稿
                    </button>
                    <button
                      className={btn}
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const data = (await refresh()).data;
                          if (data) {
                            setBase({
                              packageVersion: data.packageVersion,
                              preparationVersion: data.preparationVersion,
                            });
                            setVersions(
                              Object.fromEntries(
                                selected.map((id) => [
                                  id,
                                  data.people.find((p) => p.id === id)
                                    ?.version ?? 0,
                                ]),
                              ),
                            );
                            setReviewed(false);
                            generationKey.current = crypto.randomUUID();
                          }
                        })
                      }
                    >
                      复核并更新生成基线
                    </button>
                    <button
                      className={btn}
                      disabled={busy}
                      onClick={() => {
                        setNewVersionOf("");
                        setKind("attendance");
                        setTitle(kinds.attendance);
                        setBody("");
                        setSelected([]);
                        setVersions({});
                        setReviewed(false);
                        setDirty(false);
                        generationKey.current = crypto.randomUUID();
                      }}
                    >
                      开始全新表单
                    </button>
                  </div>
                </div>
              </details>
            )}
            <div className="space-y-3">
              {w.forms.map((v) => (
                <details key={v.form.id} className="rounded border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    {v.form.title} · V{v.form.ordinal} ·{" "}
                    {v.form.status === "voided"
                      ? "已作废"
                      : "已生成未签署打印稿"}{" "}
                    · {v.people.length}人
                  </summary>
                  <div className="mt-3 space-y-2">
                    {v.stale && (
                      <FeedbackNotice
                        tone="info"
                        message="原信息已变化或本表已有新版本，回传旧表须说明适用性。"
                      />
                    )}
                    <p className="text-xs">
                      表单编号 {v.form.code} ·{" "}
                      {v.people.map((p) => p.name).join("、")}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">
                      {v.form.bodyText}
                    </p>
                    <p className="text-xs">
                      本表当前已人工回传 {v.currentReturnedPeople.length}{" "}
                      名人员；不自动认定到场、资格或评审完成。
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className={btn}
                        disabled={busy}
                        onClick={() => void downloading(v.form.id)}
                      >
                        下载此版本打印稿
                      </button>
                      {editable && (
                        <button
                          className={btn}
                          disabled={busy}
                          onClick={() => editFrom(v)}
                        >
                          基于此表生成下一版
                        </button>
                      )}
                      {editable && v.form.status === "generated" && (
                        <button
                          className={btn}
                          disabled={busy}
                          onClick={() => beginReturn(v.form.id)}
                        >
                          登记本表签署回传
                        </button>
                      )}
                    </div>
                    {editable && v.form.status === "generated" && (
                      <div className="flex gap-2">
                        <input
                          aria-label={v.form.code + "表单作废原因"}
                          className={input}
                          placeholder="表单作废原因"
                          value={voidReasons[v.form.id] || ""}
                          onChange={(e) =>
                            setVoidReasons({
                              ...voidReasons,
                              [v.form.id]: e.target.value,
                            })
                          }
                        />
                        <button
                          className={btn}
                          disabled={busy || !voidReasons[v.form.id]?.trim()}
                          onClick={() =>
                            void act(() =>
                              api(
                                `/packages/${pkg}/preparation-forms/${v.form.id}/void`,
                                "POST",
                                {
                                  expectedVersion: v.form.version,
                                  reason: voidReasons[v.form.id],
                                },
                              ),
                            )
                          }
                        >
                          作废表单并保留历史
                        </button>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </div>
            {editable && selectedForm?.form.status === "generated" && (
              <div
                ref={returnBox}
                className="space-y-3 rounded border border-blue-200 bg-blue-50 p-3"
              >
                <h5 className="font-semibold">
                  签署回传 {selectedForm.form.title} V
                  {selectedForm.form.ordinal}
                </h5>
                <p className="text-xs">
                  先在上方附件区选择“人员签署件”类别，上传受限PDF、DOCX或签署图片并封存，再选择精确版本。
                </p>
                <Field label="受限签署件版本">
                  <select
                    aria-label="受限签署件版本"
                    className={input}
                    value={proof}
                    onChange={(e) => setProof(e.target.value)}
                  >
                    <option value="">请选择封存签署件</option>
                    {proofFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="实际签署日期">
                  <input
                    aria-label="实际签署日期"
                    className={input}
                    type="date"
                    value={signedOn}
                    onChange={(e) => setSignedOn(e.target.value)}
                  />
                </Field>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold">
                    按扫描件勾选实际签署人员，不自动勾选整张表
                  </legend>
                  {selectedForm.people.map((p) => (
                    <label key={p.id} className="mb-2 flex gap-2 text-sm">
                      <input
                        aria-label={"实际签署人员 " + p.name}
                        type="checkbox"
                        disabled={
                          selectedForm.currentReturnedPeople.includes(p.id) &&
                          !signedPeople.includes(p.id)
                        }
                        checked={signedPeople.includes(p.id)}
                        onChange={(e) =>
                          setSignedPeople((ids) =>
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id),
                          )
                        }
                      />
                      {p.name}
                      {selectedForm.currentReturnedPeople.includes(p.id) &&
                        "（已有回传，需先作废旧关联才能更正）"}
                    </label>
                  ))}
                </fieldset>
                <Field label="签署件人工核对说明">
                  <textarea
                    aria-label="签署件人工核对说明"
                    className={input}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                {selectedForm.stale && (
                  <Field label="旧表适用性说明">
                    <textarea
                      aria-label="旧表适用性说明"
                      className={input}
                      value={staleReason}
                      onChange={(e) => setStaleReason(e.target.value)}
                    />
                  </Field>
                )}
                <label className="flex gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  已按原表和签署件人工核对姓名、签署日期及关联人员
                </label>
                <div className="flex gap-2">
                  <button
                    className={btn}
                    disabled={
                      busy ||
                      !proof ||
                      !signedOn ||
                      !note.trim() ||
                      !confirmed ||
                      !signedPeople.length ||
                      (selectedForm.stale && !staleReason.trim())
                    }
                    onClick={async () => {
                      if (
                        await act(() =>
                          api(
                            `/packages/${pkg}/preparation-forms/${returnForm}/returns`,
                            "POST",
                            {
                              peopleIds: signedPeople,
                              fileVersionId: proof,
                              signedOn,
                              manuallyConfirmed: confirmed,
                              note,
                              staleReason,
                              idempotencyKey: returnKey.current,
                            },
                          ),
                        )
                      )
                        setReturnForm("");
                    }}
                  >
                    保存人工核对回传记录
                  </button>
                  <button
                    className={btn}
                    disabled={busy}
                    onClick={() => setReturnForm("")}
                  >
                    取消回传登记
                  </button>
                </div>
              </div>
            )}
            {!!w.returns.length && (
              <details>
                <summary className="cursor-pointer text-sm font-semibold">
                  签署件回传历史（{w.returns.length}）
                </summary>
                <div className="mt-3 space-y-3">
                  {w.returns.map((r) => (
                    <div
                      key={r.id}
                      className="space-y-2 rounded border p-3 text-sm"
                    >
                      <p>
                        {
                          w.forms.find((f) => f.form.id === r.formId)?.form
                            .title
                        }{" "}
                        · {r.signedOn} ·{" "}
                        {r.status === "recorded"
                          ? "已人工核对回传"
                          : "已作废关联"}{" "}
                        · {JSON.parse(r.peopleJson).length}人
                      </p>
                      <p>{r.note}</p>
                      {r.staleReason && <p>旧表适用性：{r.staleReason}</p>}
                      {r.voidReason && <p>作废原因：{r.voidReason}</p>}
                      <button
                        className={btn}
                        disabled={busy}
                        onClick={() => void downloading(r.id, true)}
                      >
                        下载固定签署件
                      </button>
                      {editable && r.status === "recorded" && (
                        <div className="flex gap-2">
                          <input
                            aria-label={r.id + "回传作废原因"}
                            className={input}
                            placeholder="关联更正或作废原因"
                            value={voidReasons[r.id] || ""}
                            onChange={(e) =>
                              setVoidReasons({
                                ...voidReasons,
                                [r.id]: e.target.value,
                              })
                            }
                          />
                          <button
                            className={btn}
                            disabled={busy || !voidReasons[r.id]?.trim()}
                            onClick={() =>
                              void act(() =>
                                api(
                                  `/packages/${pkg}/preparation-returns/${r.id}/void`,
                                  "POST",
                                  {
                                    expectedVersion: r.version,
                                    reason: voidReasons[r.id],
                                  },
                                ),
                              )
                            }
                          >
                            作废关联并保留原件
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
      </fieldset>
    </section>
  );
}
