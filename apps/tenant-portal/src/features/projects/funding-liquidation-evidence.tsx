import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@24bid/api-client/http-client";
import { FeedbackNotice } from "@24bid/ui";
import { projectMoney as money } from "./project-dialog";
type Basis = {
  period: string;
  historicalPaid: number;
  totalPaid: number;
  releasedAmount: number;
  lines: {
    fundId: string;
    code: string;
    name: string;
    allocatedAmount: number;
    paidAmount: number;
    releasedAmount: number;
  }[];
};
function Evidence({ value }: { value: Basis }) {
  return (
    <section
      aria-label="专项资金终止释放依据"
      className="space-y-3 border-t border-slate-200 pt-3"
    >
      <h3 className="font-bold">{value.period} 年度专项责任清算</h3>
      <p className="text-sm">
        历史年度已付 {money(value.historicalPaid)} · 累计净付{" "}
        {money(value.totalPaid)} · 本次释放 {money(value.releasedAmount)}
      </p>
      {value.lines.map((l) => (
        <div
          key={l.fundId}
          className="grid min-w-0 gap-2 border-b border-slate-100 pb-3 sm:grid-cols-2"
        >
          <span className="break-words text-sm font-medium">
            {l.code} · {l.name}
          </span>
          <span className="text-sm">
            责任 {money(l.allocatedAmount)} · 保留已付 {money(l.paidAmount)}
            <span className="block font-medium text-emerald-700">
              释放 {money(l.releasedAmount)}
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}
export function FundingLiquidationEvidence({ snapshot }: { snapshot: string }) {
  try {
    const value = JSON.parse(snapshot).fundingLiquidation as Basis | undefined;
    return value ? <Evidence value={value} /> : null;
  } catch {
    return <FeedbackNotice tone="error" message="专项清算依据读取失败" />;
  }
}
export function FundingLiquidationPreview({
  projectId,
  onReady,
}: {
  projectId: string;
  onReady: (ready: boolean) => void;
}) {
  const q = useQuery({
    queryKey: ["/api/v1/buyer/projects/" + projectId + "/funding"],
    queryFn: async () =>
      (
        await customInstance<{
          data: {
            enabled: boolean;
            effectivePeriod: string;
            priorPaidAmount: number;
            sources: {
              fundId: string;
              code: string;
              name: string;
              allocatedAmount: number;
              paidAmount: number;
              remainingAmount: number;
            }[];
          };
        }>({ url: "/api/v1/buyer/projects/" + projectId + "/funding" })
      ).data,
  });
  useEffect(() => {
    onReady(q.isSuccess && !q.isFetching && !!q.data?.enabled);
    return () => onReady(false);
  }, [q.isSuccess, q.isFetching, q.data?.enabled, onReady]);
  if (q.isError)
    return (
      <FeedbackNotice
        tone="error"
        message="专项清算来源加载失败，请核对预算查看权限后重试。"
      />
    );
  if (!q.data)
    return <p className="text-sm text-slate-500">正在核对专项资金来源…</p>;
  const d = q.data;
  const value: Basis = {
    period: d.effectivePeriod,
    historicalPaid: d.priorPaidAmount,
    totalPaid:
      d.priorPaidAmount + d.sources.reduce((n, s) => n + s.paidAmount, 0),
    releasedAmount: d.sources.reduce((n, s) => n + s.remainingAmount, 0),
    lines: d.sources.map((s) => ({ ...s, releasedAmount: s.remainingAmount })),
  };
  return <Evidence value={value} />;
}
