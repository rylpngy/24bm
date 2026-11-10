import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyOptions,
  executionRequest as api,
  type AgencyReminderSettings,
  type AgencyReminders,
  type ExecutionMilestone,
} from "@24bid/api-client";
import { FeedbackNotice } from "@24bid/ui";
const btn =
  "rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold whitespace-nowrap shrink-0 disabled:opacity-40";
const input =
  "w-full min-w-0 rounded border border-slate-200 bg-white px-3 py-2 text-sm";
export const defaultReminder = (): AgencyReminderSettings => ({
  enabled: true,
  leadHours: [24],
  overdueHours: [0],
  escalationUserId: null,
  escalationAfterHours: 24,
});
export function AgencyReminderSettingsForm({
  value,
  onChange,
  disabled,
  people,
  prefix,
}: {
  value: AgencyReminderSettings;
  onChange: (v: AgencyReminderSettings) => void;
  disabled?: boolean;
  people: { id: string; name: string }[];
  prefix: string;
}) {
  return (
    <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
      <label className="flex gap-2 text-sm">
        <input
          type="checkbox"
          aria-label={prefix + "启用提醒"}
          disabled={disabled}
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        启用站内提醒
      </label>
      {value.enabled && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["leadHours", "overdueHours"] as const).map((kind) => (
              <div key={kind} className="space-y-2">
                <p className="text-xs font-semibold">
                  {kind === "leadHours"
                    ? "截止前提醒（小时）"
                    : "逾期后提醒（小时，0表示到期）"}
                </p>
                {value[kind].map((h, i) => (
                  <div className="flex gap-2" key={i}>
                    <input
                      className={input}
                      aria-label={
                        prefix +
                        (kind === "leadHours" ? "临近" : "逾期") +
                        (i + 1) +
                        "小时"
                      }
                      type="number"
                      min={kind === "leadHours" ? 1 : 0}
                      max={720}
                      disabled={disabled}
                      value={h}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          [kind]: value[kind].map((v, j) =>
                            i === j ? Number(e.target.value) : v,
                          ),
                        })
                      }
                    />
                    <button
                      className={btn}
                      disabled={disabled}
                      onClick={() =>
                        onChange({
                          ...value,
                          [kind]: value[kind].filter((_, j) => j !== i),
                        })
                      }
                    >
                      移除
                    </button>
                  </div>
                ))}
                <button
                  className={btn}
                  disabled={disabled || value[kind].length >= 5}
                  onClick={() =>
                    onChange({
                      ...value,
                      [kind]: [...value[kind], kind === "leadHours" ? 24 : 0],
                    })
                  }
                >
                  {kind === "leadHours" ? "增加临近级别" : "增加逾期级别"}
                </button>
              </div>
            ))}
          </div>
          <label className="grid gap-1 text-xs font-semibold">
            {prefix}升级接收人
            <select
              aria-label={prefix + "升级接收人"}
              className={input}
              disabled={disabled}
              value={value.escalationUserId || ""}
              onChange={(e) =>
                onChange({ ...value, escalationUserId: e.target.value || null })
              }
            >
              <option value="">不发送管理者升级通知</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {value.escalationUserId && (
            <label className="grid gap-1 text-xs font-semibold">
              {prefix}逾期升级小时
              <input
                className={input}
                type="number"
                min="0"
                max="720"
                value={value.escalationAfterHours}
                disabled={disabled}
                onChange={(e) =>
                  onChange({
                    ...value,
                    escalationAfterHours: Number(e.target.value),
                  })
                }
              />
            </label>
          )}
        </>
      )}
    </div>
  );
}
export function AgencyReminderPanel({
  pkg,
  nodes,
  editable,
  busy,
  run,
}: {
  pkg: string;
  nodes: ExecutionMilestone[];
  editable: boolean;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const query = useQuery({
    queryKey: ["agency-reminders", pkg],
    queryFn: () => api<AgencyReminders>(`/packages/${pkg}/reminders`),
    refetchInterval: 5000,
  });
  const people = useQuery({
    queryKey: ["agency-options"],
    queryFn: agencyOptions,
  });
  const [selected, setSelected] = useState(nodes[0]?.id || ""),
    [settings, setSettings] = useState(defaultReminder),
    [version, setVersion] = useState(0),
    [loadedId, setLoadedId] = useState(""),
    [reason, setReason] = useState(""),
    [dirty, setDirty] = useState(false);
  const policy = query.data?.policies.find((p) => p.milestoneId === selected);
  useEffect(() => {
    if (!dirty && policy) {
      setSettings(JSON.parse(policy.settingsJson));
      setVersion(policy.version);
      setLoadedId(selected);
    }
  }, [selected, policy?.version, dirty]);
  return (
    <details className="rounded border p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        提醒策略与站内送达记录
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          可配置每类最多5级提醒，单级不超过720小时。延迟扫描只发送当前级别；升级接收人须仍有项目计划查看权限。站内入库与已读分别展示，短信未配置。
        </p>
        {query.isError && (
          <FeedbackNotice tone="error" message="提醒记录读取失败，请重试。" />
        )}
        <label className="grid gap-1 text-xs font-semibold">
          提醒对应节点
          <select
            aria-label="提醒对应节点"
            className={input}
            value={selected}
            disabled={dirty || busy}
            onChange={(e) => {
              const id = e.target.value;
              const p = query.data?.policies.find((p) => p.milestoneId === id);
              setSelected(id);
              setLoadedId(p ? id : "");
              setSettings(p ? JSON.parse(p.settingsJson) : defaultReminder());
              setVersion(p?.version ?? 0);
            }}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </select>
        </label>
        <AgencyReminderSettingsForm
          prefix="项目提醒"
          value={settings}
          onChange={(v) => {
            setSettings(v);
            setDirty(true);
          }}
          disabled={!editable || busy || !policy || loadedId !== selected}
          people={people.data?.users || []}
        />
        {editable && (
          <>
            <label className="grid gap-1 text-xs font-semibold">
              提醒策略调整原因
              <input
                className={input}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <button
                className={btn}
                disabled={
                  busy || !dirty || !reason || !policy || loadedId !== selected
                }
                onClick={async () => {
                  if (
                    await run(() =>
                      api(
                        `/packages/${pkg}/milestones/${selected}/reminders`,
                        "PUT",
                        { expectedVersion: version, settings, reason },
                      ),
                    )
                  ) {
                    await query.refetch();
                    setDirty(false);
                  }
                }}
              >
                保存节点提醒策略
              </button>
              {dirty && (
                <button
                  className={btn}
                  disabled={busy}
                  onClick={() => setDirty(false)}
                >
                  放弃提醒修改
                </button>
              )}
            </div>
          </>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th>节点与级别</th>
                <th>接收人</th>
                <th>站内入库</th>
                <th>已读</th>
                <th>尝试次数 / 状态</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {query.data?.deliveries.map(({ delivery: d, readAt }) => (
                <tr key={d.id} className="border-t">
                  <td className="py-2">
                    {nodes.find((n) => n.id === d.milestoneId)?.title}
                    <p>
                      {d.level
                        .replace("before:", "截止前 ")
                        .replace("overdue:", "逾期 ")
                        .replace("escalation:", "逾期升级 ")}{" "}
                      小时 · 节点V{d.milestoneVersion} / 策略V{d.policyVersion}
                    </p>
                  </td>
                  <td>
                    {people.data?.users.find((u) => u.id === d.recipientId)
                      ?.name || d.recipientId}
                  </td>
                  <td>
                    {d.sentAt ? new Date(d.sentAt).toLocaleString() : "未入库"}
                  </td>
                  <td>
                    {readAt
                      ? new Date(readAt).toLocaleString()
                      : d.sentAt
                        ? "未读"
                        : "—"}
                  </td>
                  <td>
                    {d.attempts} ·{" "}
                    {
                      (
                        {
                          pending: "待发送",
                          failed: "失败待重试",
                          delivered: "已入库",
                          cancelled: "已取消",
                        } as Record<string, string>
                      )[d.status]
                    }
                    {d.errorText && <p>{d.errorText}</p>}
                    {d.nextAttemptAt && d.status === "failed" && (
                      <p>
                        下次尝试：{new Date(d.nextAttemptAt).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td>
                    {editable && d.status === "failed" && (
                      <button
                        className={btn}
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api(
                              `/packages/${pkg}/reminders/${d.id}/retry`,
                              "POST",
                            );
                            await query.refetch();
                          })
                        }
                      >
                        立即重试
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data?.deliveries.length === 0 && (
          <p className="text-xs text-slate-500">
            暂无提醒记录。只读人员仅查看发给自己的记录。
          </p>
        )}
      </div>
    </details>
  );
}
