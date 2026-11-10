import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  agencyRequest as api,
  downloadReport,
  type AgencyDetail,
} from "@24bid/api-client";
import { useBuyerPermissions } from "../../lib/use-buyer-permissions";
type W = {
  todos: {
    kind: string;
    title: string;
    ownerId: string | null;
    dueAt: string | null;
    state: string;
  }[];
  summaries: { currency: string; summary: Record<string, string> }[];
  packageCount: number;
  scope: string;
};
export function AgencyOfficePanel({
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
    [group, setGroup] = useState(false),
    path =
      group && detail.record.groupId
        ? `/groups/${detail.record.groupId}/office`
        : `/packages/${detail.record.id}/office`,
    q = useQuery({
      queryKey: ["agency-office", path],
      queryFn: () => api<W>(path),
      enabled: open && can("buyer:agency:office:read"),
      refetchInterval: open ? 5000 : false,
    });
  if (!can("buyer:agency:office:read")) return null;
  return (
    <details
      className="mt-4 rounded border p-3"
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>办公室协同与所属项目汇总</summary>
      {q.error && <p role="alert">{(q.error as Error).message}</p>}
      {open && (
        <div className="space-y-2 pt-3">
          {detail.record.groupId && (
            <label>
              <input
                type="checkbox"
                checked={group}
                onChange={(e) => setGroup(e.target.checked)}
              />
              按所属项目汇总当前授权采购包
            </label>
          )}
          {q.data && (
            <>
              <p>
                {q.data.scope} · {q.data.packageCount} 包
              </p>
              {q.data.summaries.map((s) => (
                <p key={s.currency}>
                  {s.currency} · 确认应收 {s.summary.receivable} · 实际到账{" "}
                  {s.summary.received} · 实际成本 {s.summary.costActual} ·
                  实际净已付 {s.summary.costPaid} · 口径差额{" "}
                  {s.summary.basisDifference}
                </p>
              ))}
              {!q.data.todos.length && <p>当前授权范围无待办。</p>}
              {q.data.todos.map((t, i) => (
                <p
                  key={i}
                  className={
                    t.dueAt && new Date(t.dueAt).getTime() < Date.now()
                      ? "text-amber-800"
                      : ""
                  }
                >
                  {t.title} ·{" "}
                  {t.ownerId
                    ? detail.members.find((m) => m.userId === t.ownerId)
                        ?.name || "责任人已记录"
                    : "待分配"}
                  {t.dueAt ? ` · 期限 ${t.dueAt}` : ""}
                </p>
              ))}
            </>
          )}
          {detail.record.groupId && can("buyer:agency:finance:export") && (
            <button
              disabled={busy}
              className="rounded border p-2"
              onClick={() =>
                void run(() =>
                  downloadReport(
                    `/api/v1/buyer/agency/groups/${detail.record.groupId}/finance/export`,
                    "授权财务与绩效基础.xlsx",
                  ),
                )
              }
            >
              导出授权财务与绩效基础
            </button>
          )}
        </div>
      )}
    </details>
  );
}
