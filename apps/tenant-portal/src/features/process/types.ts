// 流程引擎前端 schema(与后端 JSON 文本对应)。

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'select';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface FormSchema {
  fields: FormField[];
}

export type StepType = 'approver' | 'auto' | 'condition';

export type Operator = '<' | '<=' | '>' | '>=' | '==' | '!=';

export type AssignmentType = 'user' | 'role' | 'initiator_department_manager';

// 与后端 WorkflowSchemaValidator 一一对应。禁止再保存自由文本审批人，发布时才能
// 可靠地校验租户用户、候选角色和部门主管。
export interface WorkflowAssignment {
  type: AssignmentType;
  userId?: string;
  roleId?: string;
}

export interface BranchCondition {
  field: string; // 表单字段 id | $amount | $departmentId
  op: Operator;
  value: string;
}

export interface FlowBranch {
  label: string;
  condition?: BranchCondition;
  steps: FlowStep[];
}

export interface FlowStep {
  id: string;
  type: StepType;
  title?: string;
  assignment?: WorkflowAssignment;
  // 只用于显示旧草稿，发布时后端会拒绝，避免旧自由文本成为新运行时配置。
  assignee?: string;
  branches?: FlowBranch[];
}

export interface FlowSchema {
  steps: FlowStep[];
}

const WORKFLOW_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export const isWorkflowIdentifier = (value: string) => WORKFLOW_IDENTIFIER.test(value);

export function parseForm(json?: string): FormSchema {
  return parseFormWithIdentifiers(json).schema;
}

// 旧版设计器曾生成带连字符的临时 id，而 Flowable 变量和流程节点只接受
// 字母开头的字母、数字、下划线。打开旧草稿时在前端无损修复，保存或发布即可回写。
export function parseWorkflowDraft(formJson?: string, flowJson?: string): {
  fields: FormField[];
  steps: FlowStep[];
  repairedIdentifiers: boolean;
} {
  const parsedForm = parseFormWithIdentifiers(formJson);
  const parsedFlow = parseFlowWithIdentifiers(flowJson, parsedForm.fieldIdMap);
  return {
    fields: parsedForm.schema.fields,
    steps: parsedFlow.schema.steps,
    repairedIdentifiers: parsedForm.repairedIdentifiers || parsedFlow.repairedIdentifiers,
  };
}

function parseFormWithIdentifiers(json?: string): {
  schema: FormSchema;
  fieldIdMap: Map<string, string>;
  repairedIdentifiers: boolean;
} {
  try {
    const v = JSON.parse(json || '{"fields":[]}');
    const sourceFields = Array.isArray(v.fields) ? v.fields : [];
    const usedIds = new Set<string>();
    const fieldIdMap = new Map<string, string>();
    let repairedIdentifiers = false;
    const fields = sourceFields.map((raw: unknown, index: number) => {
      const source = raw && typeof raw === 'object' ? raw as Partial<FormField> : {};
      const previousId = typeof source.id === 'string' ? source.id : '';
      const id = normalizeIdentifier(previousId, `field_${index + 1}`, usedIds);
      if (previousId !== id) repairedIdentifiers = true;
      if (previousId && !fieldIdMap.has(previousId)) fieldIdMap.set(previousId, id);
      return { ...source, id } as FormField;
    });
    return { schema: { fields }, fieldIdMap, repairedIdentifiers };
  } catch {
    return { schema: { fields: [] }, fieldIdMap: new Map(), repairedIdentifiers: false };
  }
}

export function parseFlow(json?: string): FlowSchema {
  return parseFlowWithIdentifiers(json, new Map()).schema;
}

function parseFlowWithIdentifiers(json: string | undefined, fieldIdMap: Map<string, string>): {
  schema: FlowSchema;
  repairedIdentifiers: boolean;
} {
  try {
    const v = JSON.parse(json || '{"steps":[]}');
    const usedIds = new Set<string>();
    const state = { repairedIdentifiers: false };
    return {
      schema: {
        steps: Array.isArray(v.steps)
          ? v.steps.map((step: unknown, index: number) => normalizeStep(step, fieldIdMap, usedIds, state, index))
          : [],
      },
      repairedIdentifiers: state.repairedIdentifiers,
    };
  } catch {
    return { schema: { steps: [] }, repairedIdentifiers: false };
  }
}

function normalizeStep(
  raw: unknown,
  fieldIdMap: Map<string, string>,
  usedIds: Set<string>,
  state: { repairedIdentifiers: boolean },
  index: number,
): FlowStep {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const previousId = typeof source.id === 'string' ? source.id : '';
  const id = normalizeIdentifier(previousId, `step_${index + 1}`, usedIds);
  if (previousId !== id) state.repairedIdentifiers = true;
  const assignmentSource = source.assignment;
  const assignment = assignmentSource && typeof assignmentSource === 'object'
    ? assignmentSource as WorkflowAssignment
    : undefined;
  return {
    id,
    type: source.type === 'auto' || source.type === 'condition' ? source.type : 'approver',
    title: typeof source.title === 'string' ? source.title : undefined,
    assignment,
    assignee: typeof source.assignee === 'string' ? source.assignee : undefined,
    branches: Array.isArray(source.branches)
      ? source.branches.map((branch) => {
          const item = branch && typeof branch === 'object' ? branch as Record<string, unknown> : {};
          const rawCondition = item.condition;
          const condition = rawCondition && typeof rawCondition === 'object'
            ? rawCondition as Record<string, unknown>
            : undefined;
          const previousField = typeof condition?.field === 'string' ? condition.field : '';
          const field = fieldIdMap.get(previousField) ?? previousField;
          if (previousField !== field) state.repairedIdentifiers = true;
          return {
            label: typeof item.label === 'string' ? item.label : '条件分支',
            condition: condition
              ? {
                  field,
                  op: (condition.op ?? '>=') as Operator,
                  value: String(condition.value ?? ''),
                }
              : undefined,
            steps: Array.isArray(item.steps)
              ? item.steps.map((step: unknown, branchIndex: number) =>
                normalizeStep(step, fieldIdMap, usedIds, state, branchIndex))
              : [],
          };
        })
      : undefined,
  };
}

export const FIELD_PALETTE: { type: FieldType; label: string }[] = [
  { type: 'text', label: '单行文本' },
  { type: 'textarea', label: '多行文本' },
  { type: 'number', label: '数字' },
  { type: 'money', label: '金额' },
  { type: 'date', label: '日期' },
  { type: 'select', label: '下拉选' },
];

let seq = 0;
export const uid = (prefix: string) => {
  const normalizedPrefix = prefix
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^A-Za-z]+/, '') || 'id';
  return `${normalizedPrefix.slice(0, 48)}_${Date.now().toString(36)}_${seq++}`;
};

function normalizeIdentifier(value: string, fallback: string, usedIds: Set<string>): string {
  const compact = value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  let base = compact || fallback;
  if (!/^[A-Za-z]/.test(base)) base = `${fallback}_${base}`;
  base = base.slice(0, 64).replace(/_+$/g, '') || fallback;

  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    const suffixText = `_${suffix++}`;
    candidate = `${base.slice(0, 64 - suffixText.length)}${suffixText}`;
  }
  usedIds.add(candidate);
  return candidate;
}

export const OPERATORS: { op: Operator; label: string }[] = [
  { op: '<', label: '小于' },
  { op: '<=', label: '小于等于' },
  { op: '>', label: '大于' },
  { op: '>=', label: '大于等于' },
  { op: '==', label: '等于' },
  { op: '!=', label: '不等于' },
];

export function assignmentText(
  assignment: WorkflowAssignment | undefined,
  users: Array<{ id?: string; name?: string }> = [],
  roles: Array<{ id?: string; name?: string }> = [],
  legacyAssignee?: string,
): string {
  if (!assignment) return legacyAssignee ? `待迁移: ${legacyAssignee}` : '未配置办理人';
  if (assignment.type === 'initiator_department_manager') return '发起部门主管';
  if (assignment.type === 'user') {
    return users.find((user) => user.id === assignment.userId)?.name ?? assignment.userId ?? '未选择用户';
  }
  return roles.find((role) => role.id === assignment.roleId)?.name ?? assignment.roleId ?? '未选择候选角色';
}

export function conditionFieldLabel(field: string, fields: FormField[]): string {
  if (field === '$amount') return '流程金额';
  if (field === '$departmentId') return '申请部门';
  return fields.find((item) => item.id === field)?.label ?? field;
}

export function conditionText(c: BranchCondition | undefined, fields: FormField[]): string {
  if (!c) return '其他情况';
  const fieldLabel = conditionFieldLabel(c.field, fields);
  const opLabel = OPERATORS.find((o) => o.op === c.op)?.label ?? c.op;
  return `${fieldLabel} ${opLabel} ${c.value}`;
}

function matches(c: BranchCondition, values: Record<string, string>): boolean {
  const raw = values[c.field];
  if (raw == null || raw === '') return false;
  const n = Number(raw);
  const threshold = Number(c.value);
  const numeric = c.field === '$amount' || !Number.isNaN(n) && !Number.isNaN(threshold);
  if (!numeric) {
    switch (c.op) {
      case '==': return raw === c.value;
      case '!=': return raw !== c.value;
      default: return false;
    }
  }
  switch (c.op) {
    case '<': return n < threshold;
    case '<=': return n <= threshold;
    case '>': return n > threshold;
    case '>=': return n >= threshold;
    case '==': return n === threshold;
    case '!=': return n !== threshold;
    default: return false;
  }
}

export interface ResolvedStep {
  type: StepType;
  title: string;
  assignee?: string;
}

// 按表单取值求解审批路径:条件节点取首个命中分支(无命中取首个),递归展开。
export function evaluateFlow(
  steps: FlowStep[],
  values: Record<string, string>,
): { path: ResolvedStep[]; takenBranchKeys: Set<string> } {
  const path: ResolvedStep[] = [];
  const takenBranchKeys = new Set<string>();
  const walk = (list: FlowStep[]) => {
    for (const s of list) {
      if (s.type === 'condition' && s.branches?.length) {
        let idx = s.branches.findIndex((b) => b.condition && matches(b.condition, values));
        if (idx < 0) idx = s.branches.findIndex((b) => !b.condition);
        if (idx < 0) idx = 0;
        takenBranchKeys.add(`${s.id}:${idx}`);
        walk(s.branches[idx].steps);
      } else if (s.type === 'approver') {
        path.push({
          type: 'approver',
          title: s.title ?? '审批人',
          assignee: assignmentText(s.assignment, [], [], s.assignee),
        });
      } else if (s.type === 'auto') {
        path.push({ type: 'auto', title: s.title ?? '系统自动通过' });
      }
    }
  };
  walk(steps);
  return { path, takenBranchKeys };
}
