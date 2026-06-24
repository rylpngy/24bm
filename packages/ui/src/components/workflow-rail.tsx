import { StatusPill } from './status-pill';

export interface WorkflowStep {
  key: string;
  label: string;
  owner: string;
  status: string;
}

/** 工作流轨道——采购主线 9 节点状态。复刻自旧 WorkflowRail。 */
export function WorkflowRail({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-9">
      {steps.map((step, index) => (
        <div key={step.key} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-black text-blue-700 shadow-sm">
              {index + 1}
            </span>
            <StatusPill label={step.status} />
          </div>
          <p className="mt-3 text-sm font-black text-slate-900">{step.label}</p>
          <p className="mt-1 text-xs font-bold text-slate-400">{step.owner}</p>
        </div>
      ))}
    </div>
  );
}
