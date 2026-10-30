import { useState } from "react";
import { BudgetWorkspace } from "./budget-workspace";
import { SpecialFundingCenter } from "./special-funding";
export function BudgetsPage() {
  const [tab, setTab] = useState(() =>
    new URLSearchParams(location.search).get("recordId")?.startsWith("fund-")
      ? "funding"
      : "budget",
  );
  return (
    <div className="min-w-0 space-y-5">
      <div
        role="tablist"
        aria-label="预算台账类型"
        className="inline-flex max-w-full gap-1 rounded-md border border-slate-200 bg-slate-50 p-1"
      >
        {[
          ["budget", "部门预算"],
          ["funding", "专项资金"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={
              "h-9 whitespace-nowrap rounded px-4 text-sm font-bold " +
              (tab === id
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500")
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "funding" ? <SpecialFundingCenter /> : <BudgetWorkspace />}
    </div>
  );
}
