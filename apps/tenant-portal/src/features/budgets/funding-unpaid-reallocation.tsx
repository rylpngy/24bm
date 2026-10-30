import { useState } from "react";
import { FeedbackNotice } from "@24bid/ui";
import { ArrowLeftRight } from "lucide-react";
import {
  ProjectDialog,
  projectButton as btn,
  projectInput as input,
  projectMoney as money,
} from "../projects/project-dialog";

type Source = {
  fundId: string;
  code: string;
  name: string;
  allocatedAmount: number;
  paidAmount: number;
};
type Proposal = {
  kind: string;
  projectId: string;
  revision: number;
  amount: number;
  lines: { fundId: string; amount: number }[];
  reason: string;
};
const cents = (value: string) =>
  /^\d+(\.\d{1,2})?$/.test(value) &&
  Number.isSafeInteger(Math.round(Number(value) * 100))
    ? Math.round(Number(value) * 100)
    : null;
export function FundingUnpaidReallocation({
  project,
  sources,
  priorPaidAmount,
  blocker,
  onPropose,
}: {
  project: { id: string; revision: number };
  sources: Source[];
  priorPaidAmount: number;
  blocker: string;
  onPropose: (value: Proposal) => void;
}) {
  const [editing, setEditing] = useState(false),
    [amounts, setAmounts] = useState<string[]>([]),
    [reason, setReason] = useState("");
  const total = sources.reduce(
    (n, s) => n + Math.round(s.allocatedAmount * 100),
    0,
  );
  const valid =
    amounts.length === sources.length &&
    amounts.every(
      (v, i) =>
        cents(v) !== null &&
        cents(v)! >= Math.round(sources[i].paidAmount * 100),
    ) &&
    amounts.reduce((n, v) => n + (cents(v) || 0), 0) === total &&
    amounts.some(
      (v, i) => cents(v) !== Math.round(sources[i].allocatedAmount * 100),
    );
  return (
    <>
      <button
        type="button"
        className={btn}
        disabled={!!blocker}
        title={blocker || "调整当前来源的未付额度"}
        onClick={() => {
          setAmounts(sources.map((s) => String(s.allocatedAmount)));
          setReason("");
          setEditing(true);
        }}
      >
        <ArrowLeftRight size={15} />
        调整未付额度
      </button>
      {editing && (
        <ProjectDialog
          title="调整项目未付资金责任"
          onClose={() => setEditing(false)}
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!valid || !reason.trim()) return;
              onPropose({
                kind: "project_reallocation",
                projectId: project.id,
                revision: project.revision,
                amount: total / 100,
                lines: sources
                  .map((s, i) => ({
                    fundId: s.fundId,
                    amount: Number(amounts[i]),
                  }))
                  .filter((s) => s.amount > 0),
                reason: reason.trim(),
              });
              setEditing(false);
            }}
          >
            <p className="text-sm">
              当年责任 {money(total / 100)} · 历史年度已付{" "}
              {money(priorPaidAmount)}
            </p>
            <div className="space-y-3">
              {sources.map((s, i) => (
                <label
                  key={s.fundId}
                  className="grid min-w-0 gap-2 border-b border-slate-100 pb-3 sm:grid-cols-2"
                >
                  <span className="min-w-0 break-words text-sm">
                    <span className="block font-medium">
                      {s.code} · {s.name}
                    </span>
                    <span className="text-slate-500">
                      当前 {money(s.allocatedAmount)} · 已付{" "}
                      {money(s.paidAmount)}
                    </span>
                  </span>
                  <span className="text-sm">
                    调整后责任 <span className="text-red-600">*</span>
                    <input
                      aria-label={"调整后责任 " + s.code}
                      className={input}
                      type="number"
                      min={s.paidAmount}
                      step="0.01"
                      required
                      value={amounts[i] || ""}
                      onChange={(e) =>
                        setAmounts(
                          amounts.map((a, n) => (n === i ? e.target.value : a)),
                        )
                      }
                    />
                  </span>
                </label>
              ))}
            </div>
            {!valid && (
              <FeedbackNotice
                tone="info"
                message="调整前后合计必须相等，每项不得低于该来源已付金额，且至少一项发生变化。"
              />
            )}
            <label className="block text-sm">
              调整原因 <span className="text-red-600">*</span>
              <textarea
                aria-label="未付额度调整原因"
                className={input + " h-24"}
                required
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="flex justify-end">
              <button className={btn} disabled={!valid || !reason.trim()}>
                下一步
              </button>
            </div>
          </form>
        </ProjectDialog>
      )}
    </>
  );
}
export function FundingReallocationEvidence({
  snapshot,
}: {
  snapshot: string;
}) {
  let basis:
    | {
        period: string;
        lines: {
          fundId: string;
          name: string;
          beforeAmount: number;
          paidAmount: number;
          afterAmount: number;
        }[];
      }
    | undefined;
  try {
    basis = JSON.parse(snapshot).reallocation;
  } catch {
    return <FeedbackNotice tone="error" message="资金调整依据读取失败" />;
  }
  if (!basis) return null;
  return (
    <section aria-label="未付资金调整依据" className="space-y-3">
      <h3 className="font-bold">{basis.period} 年度资金责任调整</h3>
      {basis.lines.map((l) => (
        <div
          className="grid min-w-0 gap-2 border-b border-slate-100 pb-3 sm:grid-cols-2"
          key={l.fundId}
        >
          <span className="break-words font-medium">{l.name}</span>
          <span className="text-sm">
            {money(l.beforeAmount)} → {money(l.afterAmount)}
            <span className="block text-slate-500">
              原已付归属 {money(l.paidAmount)} 不变
            </span>
          </span>
        </div>
      ))}
    </section>
  );
}
