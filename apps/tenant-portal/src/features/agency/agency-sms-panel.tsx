import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyRequest as api,
  executionRequest,
  agencyOptions,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
type Settings = { enabled: boolean; dailyLimit: number; version: number };
type Delivery = {
  id: string;
  reminderId: string;
  recipientId: string;
  status: string;
  providerRef: string | null;
  errorText: string;
  attempts: number;
};
type Contact = {
  userId: string;
  maskedPhone: string;
  consented: boolean;
  version: number;
};
type View = {
  configured: boolean;
  settings: Settings | null;
  contacts: Contact[];
  deliveries: Delivery[];
};
type Reminder = {
  delivery: { id: string; recipientId: string; status: string; level: string };
};
const button = "rounded border px-3 py-2 disabled:opacity-40",
  input = "rounded border p-2";
export function AgencySmsPanel({
  pkg,
  busy,
  run,
}: {
  pkg: string;
  busy: boolean;
  run: (f: () => Promise<unknown>) => Promise<boolean>;
}) {
  const { can } = useBuyerPermissions(),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [limit, setLimit] = useState(20),
    [user, setUser] = useState(""),
    [phone, setPhone] = useState(""),
    [verified, setVerified] = useState(false),
    [consented, setConsented] = useState(false),
    [event, setEvent] = useState(""),
    [authorized, setAuthorized] = useState(false),
    path = `/packages/${pkg}/sms`,
    q = useQuery({
      queryKey: ["agency-sms", pkg],
      queryFn: () => api<View>(path),
      enabled: open,
      refetchInterval: open ? 3000 : false,
    }),
    reminders = useQuery({
      queryKey: ["agency-sms-reminders", pkg],
      queryFn: () =>
        executionRequest<{ deliveries: Reminder[] }>(
          `/packages/${pkg}/reminders`,
        ),
      enabled: open,
    }),
    people = useQuery({
      queryKey: ["agency-sms-people"],
      queryFn: agencyOptions,
      enabled: open && can("buyer:agency:sms:manage"),
    });
  const name = (id: string) =>
    people.data?.users.find((x) => x.id === id)?.name || id;
  async function act(f: () => Promise<unknown>) {
    await run(async () => {
      await f();
      await q.refetch();
    });
  }
  return (
    <details
      className="my-3 rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>短信通道与外发授权</summary>
      {open && (
        <div className="space-y-3 pt-3">
          <p>
            短信仅提醒登录系统查看计划，不包含采购文件、专家或报价信息。每条提醒须人工授权；网关受理与实际送达分别记录。列表显示最近200条记录。
          </p>
          {q.error && <p role="alert">{(q.error as Error).message}</p>}
          {q.data && (
            <>
              <p role="status">
                {q.data.configured ? "网关已配置" : "网关未配置，不能外发"} ·
                租户短信{q.data.settings?.enabled ? "已启用" : "未启用"} ·
                日配额 {q.data.settings?.dailyLimit ?? "未设置"}
              </p>
              <label className="block">
                操作依据{" "}
                <input
                  className={input}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {can("buyer:agency:sms:manage") && (
                <fieldset className="space-y-2 rounded border p-2">
                  <legend>通道和联系人</legend>
                  <label>
                    日配额{" "}
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={1000}
                      value={limit}
                      onChange={(e) => setLimit(Number(e.target.value))}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={
                      busy ||
                      !reason ||
                      (!q.data.configured && !q.data.settings?.enabled)
                    }
                    onClick={() =>
                      void act(() =>
                        api(path + "/settings", "PUT", {
                          expectedVersion: q.data?.settings?.version ?? null,
                          enabled: !q.data?.settings?.enabled,
                          dailyLimit: limit,
                          reason,
                        }),
                      )
                    }
                  >
                    {q.data.settings?.enabled ? "停用短信" : "启用短信"}
                  </button>
                  <div>
                    <select
                      aria-label="短信联系人"
                      className={input}
                      value={user}
                      onChange={(e) => {
                        setUser(e.target.value);
                        setPhone("");
                        setVerified(false);
                        setConsented(false);
                      }}
                    >
                      <option value="">选择内部人员</option>
                      {people.data?.users.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label="短信联系电话"
                      className={input}
                      type="tel"
                      placeholder="含国家码，例如+86…"
                      autoComplete="off"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setVerified(false);
                      }}
                    />
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={verified}
                        onChange={(e) => setVerified(e.target.checked)}
                      />{" "}
                      已线下核验号码归属与授权依据
                    </label>
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={consented}
                        onChange={(e) => setConsented(e.target.checked)}
                      />{" "}
                      该人员授权接收业务提醒（取消勾选可撤销）
                    </label>
                    <button
                      className={button}
                      disabled={
                        busy ||
                        !q.data.configured ||
                        !user ||
                        !phone ||
                        !verified ||
                        !reason
                      }
                      onClick={() =>
                        void act(async () => {
                          await api(path + "/contacts/" + user, "PUT", {
                            expectedVersion:
                              q.data?.contacts.find((c) => c.userId === user)
                                ?.version ?? 0,
                            phone,
                            verified,
                            consented,
                            reason,
                          });
                          setPhone("");
                          setVerified(false);
                        })
                      }
                    >
                      保存核验及接收授权
                    </button>
                  </div>
                  {q.data.contacts.map((c) => (
                    <p key={c.userId}>
                      {name(c.userId)} · {c.maskedPhone} ·{" "}
                      {c.consented ? "已授权" : "已撤销"}
                    </p>
                  ))}
                </fieldset>
              )}
              {can("buyer:agency:sms:send") && (
                <fieldset className="space-y-2 rounded border p-2">
                  <legend>逐条授权外发</legend>
                  <select
                    aria-label="选择短信提醒事件"
                    className={input}
                    value={event}
                    onChange={(e) => {
                      setEvent(e.target.value);
                      setAuthorized(false);
                    }}
                  >
                    <option value="">选择已产生的站内提醒</option>
                    {reminders.data?.deliveries
                      .filter((r) => r.delivery.status === "delivered")
                      .map((r) => (
                        <option key={r.delivery.id} value={r.delivery.id}>
                          {name(r.delivery.recipientId)} · {r.delivery.level} ·{" "}
                          {r.delivery.id}
                        </option>
                      ))}
                  </select>
                  <label className="block">
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(e) => setAuthorized(e.target.checked)}
                    />{" "}
                    已核对接收人，授权将此提醒通过短信网关实际外发
                  </label>
                  <button
                    className={button}
                    disabled={
                      busy ||
                      !q.data.configured ||
                      !q.data.settings?.enabled ||
                      !event ||
                      !authorized ||
                      !reason
                    }
                    onClick={() =>
                      void act(async () => {
                        await api(path, "POST", {
                          reminderId: event,
                          authorized,
                          reason,
                        });
                        setAuthorized(false);
                      })
                    }
                  >
                    授权并排队发送
                  </button>
                </fieldset>
              )}
              {q.data.deliveries.map((d) => (
                <div key={d.id} className="rounded border p-2">
                  <p>
                    {name(d.recipientId)} ·{" "}
                    {
                      (
                        {
                          queued: "排队待发",
                          sending: "请求中",
                          accepted: "网关受理，尚未送达",
                          delivered: "收到送达回执",
                          failed: "明确失败",
                          unknown: "结果未知，禁止盲目重发",
                          cancelled: "已取消",
                        } as Record<string, string>
                      )[d.status]
                    }{" "}
                    · 请求次数 {d.attempts}
                  </p>
                  <p>{d.errorText}</p>
                  {can("buyer:agency:sms:manage") && d.status === "queued" && (
                    <button
                      className={button}
                      disabled={busy || !reason}
                      onClick={() =>
                        void act(() =>
                          api(path + `/${d.id}/cancel`, "POST", { reason }),
                        )
                      }
                    >
                      取消待发
                    </button>
                  )}
                  {can("buyer:agency:sms:send") &&
                    d.status === "failed" &&
                    !d.providerRef && (
                      <button
                        className={button}
                        disabled={busy || !reason || !authorized}
                        onClick={() =>
                          void act(() =>
                            api(path + `/${d.id}/retry`, "POST", { reason }),
                          )
                        }
                      >
                        授权重试未受理请求
                      </button>
                    )}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </details>
  );
}
