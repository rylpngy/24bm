import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { customInstance } from "@24bid/api-client/http-client";
import { FeedbackNotice } from "@24bid/ui";
import { projectInput, projectMoney } from "./project-dialog";

export type FundingTarget = { sourceFundId: string; targetFundId: string };
type Source = {
  fundId: string;
  code: string;
  name: string;
  remainingAmount: number;
  paidAmount: number;
};
type Options = {
  enabled: boolean;
  sourcePeriod: string;
  priorPaidAmount: number;
  sources: Source[];
  choices: {
    id: string;
    code: string;
    name: string;
    availableAmount: number;
  }[];
};

export function FundingCarryoverFields({
  projectId,
  target,
  value,
  onChange,
  onReady,
}: {
  projectId: string;
  target: string;
  value: FundingTarget[];
  onChange: (value: FundingTarget[]) => void;
  onReady: (value: boolean) => void;
}) {
  const query = useQuery({
    queryKey: [
      "/api/v1/buyer/projects/" + projectId + "/funding/carryover",
      target,
    ],
    queryFn: async () =>
      (
        await customInstance<{ data: Options }>({
          url: "/api/v1/buyer/projects/" + projectId + "/funding/carryover",
          params: { targetPeriod: target },
        })
      ).data,
    enabled: /^20\d{2}$/.test(target),
  });
  const needed = query.data?.sources.filter((s) => s.remainingAmount > 0) || [];
  const ready =
    !!query.data &&
    !query.isError &&
    !query.isFetching &&
    needed.length > 0 &&
    needed.every((s) =>
      value.some(
        (v) =>
          v.sourceFundId === s.fundId &&
          query.data!.choices.some((c) => c.id === v.targetFundId),
      ),
    );
  useEffect(() => {
    onReady(ready);
    return () => onReady(false);
  }, [ready, onReady]);
  return (
    <section
      aria-label="专项资金跨年来源"
      className="space-y-3 border-t border-slate-200 pt-4"
    >
      <h3 className="text-sm font-bold">专项资金跨年来源</h3>
      {query.isError && (
        <FeedbackNotice
          tone="error"
          message="目标资金来源加载失败，请刷新或核对预算查看权限。"
        />
      )}
      {query.data && (
        <p className="text-sm text-slate-600">
          历史已付 {projectMoney(query.data.priorPaidAmount)}{" "}
          保留在原来源；仅承接下列未付余额。
        </p>
      )}
      {needed.map((s) => (
        <div
          key={s.fundId}
          className="grid min-w-0 gap-2 rounded-md border border-slate-200 p-3 sm:grid-cols-2"
        >
          <div className="min-w-0 text-sm">
            <p className="break-words font-medium">
              {s.code} · {s.name}
            </p>
            <p className="mt-1 text-slate-500">
              待承接 {projectMoney(s.remainingAmount)} · 本版本已付{" "}
              {projectMoney(s.paidAmount)}
            </p>
          </div>
          <label className="min-w-0 text-sm">
            {target} 年度目标资金 <span className="text-red-600">*</span>
            <select
              aria-label={"承接资金来源 " + s.code}
              className={projectInput}
              value={
                value.find((v) => v.sourceFundId === s.fundId)?.targetFundId ||
                ""
              }
              onChange={(e) =>
                onChange([
                  ...value.filter((v) => v.sourceFundId !== s.fundId),
                  { sourceFundId: s.fundId, targetFundId: e.target.value },
                ])
              }
            >
              <option value="">请选择已批准来源</option>
              {query.data?.choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.name} · 可分配 {projectMoney(c.availableAmount)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      {query.data && !query.data.choices.length && (
        <FeedbackNotice
          tone="info"
          message="目标年度没有可用资金来源，请先在预算管理中编制并批准额度。"
        />
      )}
      {query.data && !needed.length && (
        <FeedbackNotice
          tone="info"
          message="专项资金已无未付责任，不需要再承接年度。"
        />
      )}
    </section>
  );
}

export function FundingCarryoverEvidence({ snapshot }: { snapshot: string }) {
  let data:
    | {
        sourcePeriod: string;
        targetPeriod: string;
        paidBasis: number;
        lines: {
          sourceCode: string;
          sourceName: string;
          targetCode: string;
          targetName: string;
          retainedPaidAmount: number;
          amount: number;
        }[];
      }
    | undefined;
  try {
    data = JSON.parse(snapshot).fundingCarryover;
  } catch {
    return <FeedbackNotice tone="error" message="资金承接依据读取失败" />;
  }
  if (!data) return null;
  return (
    <section
      aria-label="专项资金承接依据"
      className="space-y-3 border-t border-slate-200 pt-3"
    >
      <h3 className="text-sm font-bold">专项资金承接依据</h3>
      <p className="text-sm">
        {data.sourcePeriod} → {data.targetPeriod} · 历史已付{" "}
        {projectMoney(data.paidBasis)} 留在原来源
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {[
                "原资金来源",
                "原来源本版本已付",
                "目标资金来源",
                "承接未付金额",
              ].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l) => (
              <tr key={l.sourceCode} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {l.sourceCode} · {l.sourceName}
                </td>
                <td className="px-3 py-2">
                  {projectMoney(l.retainedPaidAmount)}
                </td>
                <td className="px-3 py-2">
                  {l.targetCode} · {l.targetName}
                </td>
                <td className="px-3 py-2">{projectMoney(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
