import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customInstance } from '@24bid/api-client/http-client';
import { FeedbackNotice } from '@24bid/ui';
import { projectInput, projectMoney } from '../projects/project-dialog';
export type FundingRestoreTarget = {
  sourceFundId: string;
  targetFundId: string;
  amount?: number;
};
type Options = {
  enabled: boolean;
  sources: {
    fundId: string;
    code: string;
    name: string;
    period: string;
    amount: number;
  }[];
  choices: {
    fundId: string;
    code: string;
    name: string;
    availableAmount: number;
  }[];
};
export function FundedCorrectionTargets({
  base,
  entryId,
  value,
  onChange,
  onReady,
  requestedAmount,
}: {
  base: string;
  entryId: string;
  value: FundingRestoreTarget[];
  onChange: (value: FundingRestoreTarget[]) => void;
  onReady: (value: boolean) => void;
  requestedAmount?: number;
}) {
  const q = useQuery({
    queryKey: [base + '/funding-options', entryId],
    queryFn: async () =>
      (
        await customInstance<{ data: Options }>({
          url: base + '/funding-options',
          params: { entryId },
        })
      ).data,
  });
  const ready =
    !!q.data?.enabled &&
    !q.isError &&
    !q.isFetching &&
    (requestedAmount === undefined
      ? q.data.sources.every((s) =>
          value.some(
            (v) =>
              v.sourceFundId === s.fundId &&
              q.data!.choices.some((c) => c.fundId === v.targetFundId),
          ),
        )
      : requestedAmount > 0 &&
        value.filter((v) => (v.amount || 0) > 0).length > 0 &&
        Math.round(value.reduce((sum, v) => sum + (v.amount || 0), 0) * 100) ===
          Math.round(requestedAmount * 100) &&
        value.every(
          (v) =>
            !v.amount ||
            (v.amount > 0 &&
              Math.abs(v.amount * 100 - Math.round(v.amount * 100)) < 0.00001 &&
              q.data!.sources.some(
                (s) => s.fundId === v.sourceFundId && v.amount! <= s.amount,
              ) &&
              q.data!.choices.some((c) => c.fundId === v.targetFundId)),
        ) &&
        q.data.choices.every(
          (c) =>
            value
              .filter((v) => v.targetFundId === c.fundId)
              .reduce((s, v) => s + (v.amount || 0), 0) <= c.availableAmount,
        ));
  useEffect(() => {
    onReady(ready);
    return () => onReady(false);
  }, [ready, onReady]);
  return (
    <section
      className="space-y-3 border-t border-slate-200 pt-3"
      aria-label="专项资金回补来源"
    >
      <h3 className="text-sm font-bold">专项资金回补来源</h3>
      {q.isError && (
        <FeedbackNotice
          tone="error"
          message="资金来源加载失败，请刷新或核对查看权限。"
        />
      )}
      {q.data?.sources.map((s) => (
        <div
          key={s.fundId}
          className="grid min-w-0 gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-2"
        >
          <div className="min-w-0 text-sm">
            <p className="break-words font-medium">
              {s.period} · {s.code} · {s.name}
            </p>
            <p className="mt-1 text-slate-500">
              剩余可更正 {projectMoney(s.amount)}，本次金额等额回补当前年度
            </p>
            {requestedAmount !== undefined && (
              <label className="mt-2 block">
                本次来源更正金额
                <input
                  aria-label={'来源更正金额 ' + s.code}
                  type="number"
                  min="0"
                  max={s.amount}
                  step="0.01"
                  className={projectInput}
                  value={
                    value.find((v) => v.sourceFundId === s.fundId)?.amount ?? ''
                  }
                  onChange={(e) =>
                    onChange([
                      ...value.filter((v) => v.sourceFundId !== s.fundId),
                      {
                        sourceFundId: s.fundId,
                        targetFundId:
                          value.find((v) => v.sourceFundId === s.fundId)
                            ?.targetFundId || '',
                        amount: Number(e.target.value),
                      },
                    ])
                  }
                />
              </label>
            )}
          </div>
          <label className="min-w-0 text-sm">
            当前年度回补来源{' '}
            {(requestedAmount === undefined ||
              (value.find((v) => v.sourceFundId === s.fundId)?.amount || 0) >
                0) && <span className="text-red-600">*</span>}
            <select
              aria-label={'更正回补来源 ' + s.code}
              className={projectInput}
              value={
                value.find((v) => v.sourceFundId === s.fundId)?.targetFundId ||
                ''
              }
              onChange={(e) =>
                onChange([
                  ...value.filter((v) => v.sourceFundId !== s.fundId),
                  {
                    sourceFundId: s.fundId,
                    targetFundId: e.target.value,
                    ...(requestedAmount !== undefined
                      ? {
                          amount:
                            value.find((v) => v.sourceFundId === s.fundId)
                              ?.amount || 0,
                        }
                      : {}),
                  },
                ])
              }
            >
              <option value="">请选择项目当前来源</option>
              {q.data?.choices.map((c) => (
                <option key={c.fundId} value={c.fundId}>
                  {c.code} · {c.name} · 可用 {projectMoney(c.availableAmount)}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </section>
  );
}
export function FundingRestorationEvidence({
  snapshot,
}: {
  snapshot?: string;
}) {
  if (!snapshot) return null;
  let d:
    | {
        period: string;
        lines: {
          sourceFundId: string;
          sourceCode: string;
          sourceName: string;
          sourcePeriod: string;
          targetCode: string;
          targetName: string;
          amount: number;
        }[];
      }
    | undefined;
  try {
    d = JSON.parse(snapshot).fundingCorrection;
  } catch {
    return <FeedbackNotice tone="error" message="资金回补依据读取失败" />;
  }
  if (!d) return null;
  return (
    <section
      className="space-y-3 border-t border-slate-200 pt-3"
      aria-label="专项资金更正依据"
    >
      <h3 className="text-sm font-bold">
        专项资金更正依据 · 回补 {d.period} 年度
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {['原付款来源', '等额冲销 / 回补', '当前年度回补来源'].map(
                (h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {d.lines.map((l) => (
              <tr key={l.sourceFundId} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  {l.sourcePeriod} · {l.sourceCode} · {l.sourceName}
                </td>
                <td className="px-3 py-2">{projectMoney(l.amount)}</td>
                <td className="px-3 py-2">
                  {l.targetCode} · {l.targetName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
