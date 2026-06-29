import { useState } from 'react';
import { GitBranch, Plus, Trash2, UserCheck, Zap } from 'lucide-react';
import { cn } from '@24bid/ui';
import { type FlowStep, uid } from './types';

// 流程设计:从 steps 渲染审批流(发起人 → 审批节点 / 条件分支),支持插入/编辑/删除节点。
export function FlowDesigner({
  steps,
  onChange,
}: {
  steps: FlowStep[];
  onChange: (steps: FlowStep[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const insertAt = (index: number, step: FlowStep) => {
    const next = [...steps];
    next.splice(index, 0, step);
    onChange(next);
    setSelectedId(step.id);
  };
  const updateStep = (id: string, patch: Partial<FlowStep>) =>
    onChange(updateInTree(steps, id, patch));
  const removeStep = (id: string) => onChange(removeFromTree(steps, id));
  const addBranchStep = (conditionId: string, branchIndex: number, step: FlowStep) =>
    onChange(
      steps.map((s) =>
        s.id === conditionId && s.branches
          ? {
              ...s,
              branches: s.branches.map((b, i) =>
                i === branchIndex ? { ...b, steps: [...b.steps, step] } : b,
              ),
            }
          : s,
      ),
    );

  return (
    <div className="min-h-[460px] rounded-xl border border-slate-200 bg-slate-50/60 p-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        {/* 发起人 */}
        <div className="rounded-full bg-blue-600 px-7 py-2.5 text-sm font-black text-white shadow-sm shadow-blue-950/20">
          发起人
        </div>
        <span className="mt-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-400 shadow-sm">
          所有人
        </span>

        <AddButton onApprover={() => insertAt(0, approver())} onCondition={() => insertAt(0, condition())} />

        {steps.map((step, i) => (
          <div key={step.id} className="flex w-full flex-col items-center">
            <StepNode
              step={step}
              selected={selectedId === step.id}
              onSelect={() => setSelectedId(selectedId === step.id ? null : step.id)}
              onUpdate={(p) => updateStep(step.id, p)}
              onRemove={() => removeStep(step.id)}
              renderBranchStep={(bs) => (
                <div className="flex flex-col items-center">
                  <StepNode
                    step={bs}
                    selected={selectedId === bs.id}
                    onSelect={() => setSelectedId(selectedId === bs.id ? null : bs.id)}
                    onUpdate={(p) => updateStep(bs.id, p)}
                    onRemove={() => removeStep(bs.id)}
                  />
                </div>
              )}
              onAddBranchStep={(bi) => addBranchStep(step.id, bi, approver())}
            />
            <AddButton
              onApprover={() => insertAt(i + 1, approver())}
              onCondition={() => insertAt(i + 1, condition())}
            />
          </div>
        ))}

        <div className="rounded-full bg-slate-200 px-6 py-2 text-xs font-black text-slate-500">流程结束</div>
      </div>
    </div>
  );
}

function approver(): FlowStep {
  return { id: uid('s'), type: 'approver', title: '审批人', assignee: '直接主管' };
}
function condition(): FlowStep {
  return {
    id: uid('s'),
    type: 'condition',
    branches: [
      { label: '条件一', steps: [{ id: uid('b'), type: 'auto', title: '系统自动通过' }] },
      { label: '条件二', steps: [{ id: uid('b'), type: 'approver', title: '审批人', assignee: '指定审批人' }] },
    ],
  };
}

function StepNode({
  step,
  selected,
  onSelect,
  onUpdate,
  onRemove,
  renderBranchStep,
  onAddBranchStep,
}: {
  step: FlowStep;
  selected: boolean;
  onSelect: () => void;
  onUpdate: (p: Partial<FlowStep>) => void;
  onRemove: () => void;
  renderBranchStep?: (bs: FlowStep, bi: number) => React.ReactNode;
  onAddBranchStep?: (bi: number) => void;
}) {
  const inputCls =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300';

  if (step.type === 'condition') {
    return (
      <div className="w-full rounded-2xl border border-dashed border-slate-300 bg-white/40 p-4">
        <div className="flex flex-wrap justify-center gap-4">
          {(step.branches ?? []).map((b, bi) => (
            <div key={bi} className="flex min-w-[220px] flex-1 flex-col items-center">
              <div className="w-full overflow-hidden rounded-lg border border-emerald-200 bg-white">
                <div className="flex items-center gap-1.5 border-l-4 border-emerald-500 bg-emerald-50/60 px-3 py-2">
                  <GitBranch size={13} className="text-emerald-600" />
                  <input
                    className="flex-1 bg-transparent text-xs font-black text-slate-700 outline-none"
                    value={b.label}
                    onChange={(e) =>
                      onUpdate({
                        branches: (step.branches ?? []).map((x, i) =>
                          i === bi ? { ...x, label: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-2 flex flex-col items-center gap-2">
                {b.steps.map((bs, si) => (
                  <div key={bs.id}>{renderBranchStep ? renderBranchStep(bs, si) : null}</div>
                ))}
                <button
                  type="button"
                  onClick={() => onAddBranchStep?.(bi)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center">
          <button type="button" onClick={onRemove} className="text-[11px] font-bold text-slate-400 hover:text-red-500">
            删除分支
          </button>
        </div>
      </div>
    );
  }

  const isAuto = step.type === 'auto';
  return (
    <div
      className={cn(
        'w-full max-w-md overflow-hidden rounded-lg border bg-white shadow-sm transition',
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-1.5 border-l-4 px-3 py-2',
          isAuto ? 'border-emerald-500 bg-emerald-50/50' : 'border-amber-500 bg-amber-50/50',
        )}
      >
        {isAuto ? <Zap size={13} className="text-emerald-600" /> : <UserCheck size={13} className="text-amber-600" />}
        <span className="flex-1 text-xs font-black text-slate-700">{step.title}</span>
        <button type="button" onClick={onRemove} className="text-slate-300 hover:text-red-500">
          <Trash2 size={13} />
        </button>
      </div>
      <button type="button" onClick={onSelect} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
        <span className="text-sm font-bold text-slate-600">{isAuto ? '无需审批,自动流转' : step.assignee || '未指定'}</span>
        <span className="text-slate-300">{selected ? '收起' : '编辑 ›'}</span>
      </button>
      {selected && !isAuto && (
        <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
          <div>
            <p className="mb-1 text-[11px] font-black text-slate-400">节点名称</p>
            <input className={inputCls} value={step.title ?? ''} onChange={(e) => onUpdate({ title: e.target.value })} />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-black text-slate-400">审批人</p>
            <input className={inputCls} value={step.assignee ?? ''} onChange={(e) => onUpdate({ assignee: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}

function AddButton({ onApprover, onCondition }: { onApprover: () => void; onCondition: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative my-1.5 flex flex-col items-center">
      <span className="h-3 w-px bg-slate-300" />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-700"
      >
        <Plus size={15} />
      </button>
      <span className="h-3 w-px bg-slate-300" />
      {open && (
        <div className="absolute top-8 z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={() => { onApprover(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            <UserCheck size={13} className="text-amber-500" /> 审批人
          </button>
          <button
            type="button"
            onClick={() => { onCondition(); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            <GitBranch size={13} className="text-emerald-500" /> 条件分支
          </button>
        </div>
      )}
    </div>
  );
}

// 递归更新/删除(支持分支内步骤)。
function updateInTree(steps: FlowStep[], id: string, patch: Partial<FlowStep>): FlowStep[] {
  return steps.map((s) => {
    if (s.id === id) return { ...s, ...patch };
    if (s.branches) {
      return { ...s, branches: s.branches.map((b) => ({ ...b, steps: updateInTree(b.steps, id, patch) })) };
    }
    return s;
  });
}
function removeFromTree(steps: FlowStep[], id: string): FlowStep[] {
  return steps
    .filter((s) => s.id !== id)
    .map((s) => (s.branches ? { ...s, branches: s.branches.map((b) => ({ ...b, steps: removeFromTree(b.steps, id) })) } : s));
}
