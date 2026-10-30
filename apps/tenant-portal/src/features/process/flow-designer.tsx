import { useState } from 'react';
import { GitBranch, Plus, Trash2, UserCheck, Zap } from 'lucide-react';
import { cn } from '@24bid/ui';
import {
  OPERATORS,
  assignmentText,
  conditionText,
  type FlowStep,
  type FormField,
  type Operator,
  type WorkflowAssignment,
  uid,
} from './types';

type ActorOption = { id?: string; name?: string };

// 流程设计:从 steps 渲染审批流(发起人 → 审批节点 / 条件分支),支持插入/编辑/删除节点。
export function FlowDesigner({
  steps,
  fields,
  users = [],
  roles = [],
  onChange,
}: {
  steps: FlowStep[];
  fields: FormField[];
  users?: ActorOption[];
  roles?: ActorOption[];
  onChange: (steps: FlowStep[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const defaultRoleId = roles[0]?.id;

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

        <AddButton
          onApprover={() => insertAt(0, approver(defaultRoleId))}
          onCondition={() => insertAt(0, condition(defaultRoleId))}
        />

        {steps.map((step, i) => (
          <div key={step.id} className="flex w-full flex-col items-center">
            <StepNode
              step={step}
              fields={fields}
              users={users}
              roles={roles}
              selected={selectedId === step.id}
              onSelect={() => setSelectedId(selectedId === step.id ? null : step.id)}
              onUpdate={(p) => updateStep(step.id, p)}
              onRemove={() => removeStep(step.id)}
              renderBranchStep={(bs) => (
                <div className="flex flex-col items-center">
                  <StepNode
                    step={bs}
                    fields={fields}
                    users={users}
                    roles={roles}
                    selected={selectedId === bs.id}
                    onSelect={() => setSelectedId(selectedId === bs.id ? null : bs.id)}
                    onUpdate={(p) => updateStep(bs.id, p)}
                    onRemove={() => removeStep(bs.id)}
                  />
                </div>
              )}
              onAddBranchStep={(bi) => addBranchStep(step.id, bi, approver(defaultRoleId))}
            />
            <AddButton
              onApprover={() => insertAt(i + 1, approver(defaultRoleId))}
              onCondition={() => insertAt(i + 1, condition(defaultRoleId))}
            />
          </div>
        ))}

        <div className="rounded-full bg-slate-200 px-6 py-2 text-xs font-black text-slate-500">流程结束</div>
      </div>
    </div>
  );
}

function approver(defaultRoleId?: string): FlowStep {
  return {
    id: uid('s'),
    type: 'approver',
    title: '审批人',
    assignment: defaultRoleId
      ? { type: 'role', roleId: defaultRoleId }
      : { type: 'initiator_department_manager' },
  };
}
function condition(defaultRoleId?: string): FlowStep {
  return {
    id: uid('s'),
    type: 'condition',
    branches: [
      {
        label: '金额达到阈值',
        condition: { field: '$amount', op: '>=', value: '100000' },
        steps: [{ ...approver(defaultRoleId), id: uid('b'), title: '金额复核' }],
      },
      {
        label: '其他情况',
        steps: [{ ...approver(defaultRoleId), id: uid('b'), title: '常规审批' }],
      },
    ],
  };
}

function StepNode({
  step,
  fields = [],
  users = [],
  roles = [],
  selected,
  onSelect,
  onUpdate,
  onRemove,
  renderBranchStep,
  onAddBranchStep,
}: {
  step: FlowStep;
  fields?: FormField[];
  users?: ActorOption[];
  roles?: ActorOption[];
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
                  <span className="flex-1 text-xs font-black text-slate-700">
                    {conditionText(b.condition, fields)}
                  </span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <select
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-1 py-1 text-[11px] font-bold text-slate-600 outline-none"
                    value={b.condition?.field ?? ''}
                    onChange={(e) => {
                      const field = e.target.value;
                      const formField = fields.find((item) => item.id === field);
                      const equalityOnly = field === '$departmentId'
                        || (formField != null && !['number', 'money'].includes(formField.type));
                      patchBranch(step, bi, onUpdate, {
                        field,
                        ...(equalityOnly ? { op: '==' as Operator } : {}),
                      });
                    }}
                  >
                    <option value="">其他情况</option>
                    <option value="$amount">流程金额</option>
                    <option value="$departmentId">申请部门</option>
                    {fields.map((f) => (
                      <option key={f.id} value={f.id}>{f.label}</option>
                    ))}
                  </select>
                  <select
                    className="rounded border border-slate-200 bg-white px-1 py-1 text-[11px] font-bold text-slate-600 outline-none disabled:opacity-40"
                    value={b.condition?.op ?? '>='}
                    disabled={!b.condition?.field}
                    onChange={(e) => patchBranch(step, bi, onUpdate, { op: e.target.value as Operator })}
                  >
                    {OPERATORS.filter((operator) => {
                      const formField = fields.find((item) => item.id === b.condition?.field);
                      const equalityOnly = b.condition?.field === '$departmentId'
                        || (formField != null && !['number', 'money'].includes(formField.type));
                      return !equalityOnly || operator.op === '==' || operator.op === '!=';
                    }).map((o) => (
                      <option key={o.op} value={o.op}>{o.label}</option>
                    ))}
                  </select>
                  <input
                    type={(() => {
                      const formField = fields.find((item) => item.id === b.condition?.field);
                      return b.condition?.field === '$amount'
                        || (formField != null && ['number', 'money'].includes(formField.type))
                        ? 'number'
                        : 'text';
                    })()}
                    className="w-16 rounded border border-slate-200 bg-white px-1 py-1 text-[11px] font-bold text-slate-600 outline-none disabled:opacity-40"
                    value={b.condition?.value ?? ''}
                    disabled={!b.condition?.field}
                    onChange={(e) => patchBranch(step, bi, onUpdate, { value: e.target.value })}
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
        <span className="text-sm font-bold text-slate-600">
          {isAuto ? '无需审批,自动流转' : assignmentText(step.assignment, users, roles, step.assignee)}
        </span>
        <span className="text-slate-300">{selected ? '收起' : '编辑 ›'}</span>
      </button>
      {selected && !isAuto && (
        <div className="space-y-2 border-t border-slate-100 px-3 py-2.5">
          <div>
            <p className="mb-1 text-[11px] font-black text-slate-400">节点名称</p>
            <input className={inputCls} value={step.title ?? ''} onChange={(e) => onUpdate({ title: e.target.value })} />
          </div>
          <AssignmentEditor
            assignment={step.assignment}
            users={users}
            roles={roles}
            onChange={(assignment) => onUpdate({ assignment, assignee: undefined })}
          />
          <label className="block text-[11px] font-black text-slate-500">办理时限（自然小时）
            <input aria-label="办理时限（自然小时）" type="number" min={1} max={8760} step={1}
              placeholder="不限制" className={inputCls} value={step.deadlineHours ?? ''}
              onChange={(event) => onUpdate({deadlineHours: event.target.value ? Number(event.target.value) : undefined})} />
          </label>
        </div>
      )}
    </div>
  );
}

function AssignmentEditor({
  assignment,
  users,
  roles,
  onChange,
}: {
  assignment?: WorkflowAssignment;
  users: ActorOption[];
  roles: ActorOption[];
  onChange: (assignment: WorkflowAssignment) => void;
}) {
  const inputCls =
    'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300';
  const type = assignment?.type ?? '';
  return (
    <>
      <div>
        <p className="mb-1 text-[11px] font-black text-slate-400">办理规则</p>
        <select
          className={inputCls}
          value={type}
          onChange={(event) => {
            const next = event.target.value as WorkflowAssignment['type'];
            if (next === 'user') onChange({ type: next, userId: users[0]?.id });
            else if (next === 'role') onChange({ type: next, roleId: roles[0]?.id });
            else onChange({ type: 'initiator_department_manager' });
          }}
        >
          <option value="">请选择规则</option>
          <option value="user">指定用户</option>
          <option value="role">候选角色</option>
          <option value="initiator_department_manager">发起部门主管</option>
        </select>
      </div>
      {type === 'user' && (
        <div>
          <p className="mb-1 text-[11px] font-black text-slate-400">指定办理人</p>
          <select
            className={inputCls}
            value={assignment?.userId ?? ''}
            onChange={(event) => onChange({ type: 'user', userId: event.target.value || undefined })}
          >
            <option value="">请选择用户</option>
            {users.filter((user) => user.id).map((user) => (
              <option key={user.id} value={user.id}>{user.name ?? user.id}</option>
            ))}
          </select>
        </div>
      )}
      {type === 'role' && (
        <div>
          <p className="mb-1 text-[11px] font-black text-slate-400">候选角色</p>
          <select
            className={inputCls}
            value={assignment?.roleId ?? ''}
            onChange={(event) => onChange({ type: 'role', roleId: event.target.value || undefined })}
          >
            <option value="">请选择角色</option>
            {roles.filter((role) => role.id).map((role) => (
              <option key={role.id} value={role.id}>{role.name ?? role.id}</option>
            ))}
          </select>
        </div>
      )}
      {type === 'initiator_department_manager' && (
        <p className="rounded-md bg-blue-50 px-2 py-1.5 text-[11px] font-bold leading-5 text-blue-700">
          流程发起时将校验申请部门已配置启用状态的主管，并把任务直接分配给该主管。
        </p>
      )}
    </>
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

// 更新某条件分支的条件(字段置空=删除条件,变为「其他情况」默认分支)。
function patchBranch(
  step: FlowStep,
  bi: number,
  onUpdate: (p: Partial<FlowStep>) => void,
  patch: { field?: string; op?: Operator; value?: string },
) {
  const branches = (step.branches ?? []).map((x, i) => {
    if (i !== bi) return x;
    if (patch.field === '') {
      const { condition: _omit, ...rest } = x;
      return { ...rest, label: '其他情况' };
    }
    const base = x.condition ?? { field: '', op: '>=' as Operator, value: '' };
    return { ...x, condition: { ...base, ...patch } };
  });
  onUpdate({ branches });
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
