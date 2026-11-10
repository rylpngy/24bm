import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyRequest as api,
  downloadReport,
  type AgencyDetail,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
import {
  LifecycleForm,
  type LifecycleField,
  asTime,
} from "./agency-lifecycle-form";
type C = {
  key: string;
  title: string;
  applicability: string;
  systemPresent: boolean;
  version: number | null;
  disposition: string;
  visibleFileVersionIds: string[];
  withheldCount: number;
  paperLocation: string;
  signingStatus: string;
  ownerId: string | null;
  deadline: string | null;
  reason: string;
};
type S = {
  id: string;
  ordinal: number;
  frozenHash: string;
  complete: boolean;
  stale: boolean;
  reason: string;
  createdAt: string;
};
type W = {
  state: { version: number; retentionYears: number };
  businessStatus: string;
  archiveCompletion: string;
  financialStatus: string;
  sourceFingerprint: string;
  checklist: C[];
  snapshots: S[];
  blockers: string[];
};
const names: Record<string, string> = {
  required: "必需",
  conditional: "条件适用",
  optional: "可选",
  included: "已收集",
  not_applicable: "明确不适用",
  missing: "待补件",
  complete: "档案完成",
  accumulating: "持续积累／待补",
  not_started: "未开始",
  in_progress: "办理中",
  closed: "业务办结",
  settled: "费用结清",
  unsettled: "费用未结",
  unassessed: "费用尚未核算",
  published: "已发布",
};
export function AgencyArchivePanel({
  detail,
  busy,
  run,
}: {
  detail: AgencyDetail;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    path = `/packages/${detail.record.id}/archive`,
    q = useQuery({
      queryKey: ["agency-archive", detail.record.id],
      queryFn: () => api<W>(path),
      enabled: open && can("buyer:agency:archive:read"),
      refetchInterval: open ? 5000 : false,
    }),
    [item, setItem] = useState(""),
    [refs, setRefs] = useState<string[]>([]),
    [disposition, setDisposition] = useState("included"),
    [dimension, setDimension] = useState("business");
  const w = q.data,
    c = w?.checklist.find((c) => c.key === item),
    proofs: [string, string][] = detail.files
      .filter((f) => f.file.visibility === "project")
      .flatMap((f) =>
        f.versions
          .filter((v) => v.status === "sealed")
          .map(
            (v) => [v.id, f.file.name + " V" + v.ordinal] as [string, string],
          ),
      ),
    allFiles: [string, string][] = detail.files.flatMap((f) =>
      f.versions
        .filter((v) => v.status === "sealed")
        .map((v) => [v.id, f.file.name + " V" + v.ordinal] as [string, string]),
    ),
    proof: LifecycleField = {
      key: "evidenceVersionId",
      label: "已封存脱敏实际依据",
      type: "select",
      options: proofs,
    },
    key = () => crypto.randomUUID(),
    basis = JSON.stringify(w),
    act = (url: string, method: string, body: unknown) =>
      run(async () => {
        await api(url, method, body);
        await q.refetch();
      });
  if (!can("buyer:agency:archive:read")) return null;
  return (
    <details
      className="mt-4 rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>正式档案与三维完成状态</summary>
      {q.error && <p role="alert">{(q.error as Error).message}</p>}
      {open && w && (
        <div className="space-y-3 pt-3">
          <p>
            业务：{names[w.businessStatus] || w.businessStatus} · 档案：
            {names[w.archiveCompletion] || w.archiveCompletion} · 费用：
            {names[w.financialStatus] || w.financialStatus}
          </p>
          <p className="text-sm">
            业务办结后仍可收款和补档。正式档案保留版本与指纹；导出只包含当前授权文件，受限资料不披露名称。保留年限按单位制度配置，系统不自动永久删除。
          </p>
          <ul>
            {w.checklist.map((c) => (
              <li key={c.key}>
                {c.title} · {names[c.applicability]} · {names[c.disposition]}
                {c.withheldCount ? ` · ${c.withheldCount}份受限材料` : ""}
                {c.deadline ? ` · 补件期限 ${c.deadline}` : ""}
              </li>
            ))}
          </ul>
          {can("buyer:agency:archive:manage") && (
            <>
              <label>
                归档清单项
                <select
                  className="w-full rounded border p-2"
                  value={item}
                  onChange={(e) => {
                    setItem(e.target.value);
                    setRefs([]);
                  }}
                >
                  <option value="">请选择</option>
                  {w.checklist.map((c) => (
                    <option value={c.key} key={c.key}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              {c && (
                <>
                  <label>
                    本项处理
                    <select
                      value={disposition}
                      onChange={(e) => setDisposition(e.target.value)}
                    >
                      <option value="included">已实际收集</option>
                      <option value="missing">待补件</option>
                      <option value="not_applicable">有权依据明确不适用</option>
                    </select>
                  </label>
                  <fieldset>
                    <legend>本项实际电子副本</legend>
                    {allFiles.map(([id, name]) => (
                      <label className="block text-sm" key={id}>
                        <input
                          type="checkbox"
                          checked={refs.includes(id)}
                          onChange={(e) =>
                            setRefs(
                              e.target.checked
                                ? [...refs, id]
                                : refs.filter((v) => v !== id),
                            )
                          }
                        />
                        {name}
                      </label>
                    ))}
                  </fieldset>
                  <LifecycleForm
                    key={item + disposition}
                    title="保存归档清单核对"
                    basis={basis + JSON.stringify(refs) + disposition}
                    busy={busy}
                    fields={[
                      {
                        key: "paperLocation",
                        label: "纸质原件位置",
                        optional: true,
                      },
                      {
                        key: "signingStatus",
                        label: "真实签署状态",
                        type: "select",
                        options: [
                          ["signed", "已实际签署"],
                          ["unsigned", "尚未签署"],
                          ["not_required", "按依据无需签署"],
                          ["unknown", "待核对"],
                        ],
                      },
                      {
                        key: "ownerId",
                        label: "补件责任人",
                        type: "select",
                        options: detail.members.map((m) => [m.userId, m.name]),
                        optional: disposition !== "missing",
                      },
                      {
                        key: "deadline",
                        label: "补件期限",
                        type: "time",
                        optional: disposition !== "missing",
                      },
                      ...(disposition === "not_applicable" ? [proof] : []),
                      {
                        key: "reason",
                        label: "适用性、缺件或核对说明",
                        type: "long",
                      },
                    ]}
                    submit={(v) =>
                      act(path + "/checklist/" + item, "PUT", {
                        ...v,
                        expectedVersion: c.version || 0,
                        disposition,
                        fileVersionIds: refs,
                        deadline: asTime(v.deadline),
                        reviewed: true,
                        idempotencyKey: key(),
                      })
                    }
                  />
                </>
              )}
              {w.blockers.length > 0 && (
                <div>
                  <p>标记档案完成前仍需处理：</p>
                  {w.blockers.map((b) => (
                    <p key={b}>{b}</p>
                  ))}
                </div>
              )}
              <LifecycleForm
                title="封存正式档案快照"
                basis={basis}
                busy={busy}
                fields={[
                  {
                    key: "complete",
                    label: "完整性办理",
                    type: "select",
                    options: [
                      ["false", "保留当前正式快照，继续补件"],
                      ["true", "全部适用材料核对完成"],
                    ],
                  },
                  {
                    key: "retentionYears",
                    label: "本单位制度规定保留年限（1至100年）",
                  },
                  {
                    key: "reason",
                    label: "首次归档或追加更正原因",
                    type: "long",
                  },
                ]}
                submit={(v) =>
                  act(path + "/snapshots", "POST", {
                    ...v,
                    complete: v.complete === "true",
                    retentionYears: Number(v.retentionYears),
                    expectedFingerprint: w.sourceFingerprint,
                    expectedPreviousId: w.snapshots[0]?.id || null,
                    reviewed: true,
                    idempotencyKey: key(),
                  })
                }
              />
              <label>
                独立办结维度
                <select
                  value={dimension}
                  onChange={(e) => setDimension(e.target.value)}
                >
                  <option value="business">业务办结</option>
                  <option value="financial">费用结清</option>
                </select>
              </label>
              {can("buyer:agency:completion:" + dimension) && (
                <LifecycleForm
                  key={dimension}
                  title="办理独立完成状态"
                  basis={basis + dimension}
                  busy={busy}
                  fields={[
                    {
                      key: "status",
                      label: "办理状态",
                      type: "select",
                      options:
                        dimension === "business"
                          ? [
                              ["closed", "业务办结"],
                              ["in_progress", "恢复业务办理"],
                            ]
                          : [
                              ["settled", "费用结清"],
                              ["unsettled", "费用未结"],
                            ],
                    },
                    proof,
                    {
                      key: "ownerId",
                      label: "遗留事项责任人",
                      type: "select",
                      options: detail.members.map((m) => [m.userId, m.name]),
                    },
                    {
                      key: "remainingMatters",
                      label: "遗留事项和后续安排（无亦需明确）",
                      type: "long",
                    },
                    { key: "reason", label: "实际办结依据", type: "long" },
                  ]}
                  submit={(v) =>
                    act(path + "/states", "POST", {
                      ...v,
                      dimension,
                      expectedVersion: w.state.version,
                      reviewed: true,
                      idempotencyKey: key(),
                    })
                  }
                />
              )}
            </>
          )}
          <div>
            {w.snapshots.map((s) => (
              <div key={s.id} className="rounded border p-2">
                <p>
                  正式档案 V{s.ordinal} ·{" "}
                  {s.complete ? "本次核对完整" : "保留补件事项"} ·{" "}
                  {s.stale ? "已有后续变化" : "当前来源"}
                </p>
                <p className="break-all text-xs">SHA256 {s.frozenHash}</p>
                <p>{s.reason}</p>
                {can("buyer:agency:archive:export") && (
                  <button
                    className="rounded border p-2"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        downloadReport(
                          `/api/v1/buyer/agency${path}/snapshots/${s.id}/export`,
                          `正式档案-V${s.ordinal}.zip`,
                        ),
                      )
                    }
                  >
                    导出本次授权文件包
                  </button>
                )}
              </div>
            ))}
          </div>
          {detail.record.groupId && can("buyer:agency:archive:export") && (
            <button
              className="rounded border p-2"
              disabled={busy}
              onClick={() =>
                void run(() =>
                  downloadReport(
                    `/api/v1/buyer/agency/groups/${detail.record.groupId}/archive/export`,
                    "所属项目正式档案.zip",
                  ),
                )
              }
            >
              导出所属项目可见采购包集合
            </button>
          )}
        </div>
      )}
    </details>
  );
}
