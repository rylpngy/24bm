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

export interface BranchCondition {
  field: string; // 表单字段 id
  op: Operator;
  value: number;
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
  assignee?: string;
  branches?: FlowBranch[];
}

export interface FlowSchema {
  steps: FlowStep[];
}

export function parseForm(json?: string): FormSchema {
  try {
    const v = JSON.parse(json || '{"fields":[]}');
    return { fields: Array.isArray(v.fields) ? v.fields : [] };
  } catch {
    return { fields: [] };
  }
}

export function parseFlow(json?: string): FlowSchema {
  try {
    const v = JSON.parse(json || '{"steps":[]}');
    return { steps: Array.isArray(v.steps) ? v.steps : [] };
  } catch {
    return { steps: [] };
  }
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
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${seq++}`;

export const OPERATORS: { op: Operator; label: string }[] = [
  { op: '<', label: '小于' },
  { op: '<=', label: '小于等于' },
  { op: '>', label: '大于' },
  { op: '>=', label: '大于等于' },
  { op: '==', label: '等于' },
  { op: '!=', label: '不等于' },
];

export function conditionText(c: BranchCondition | undefined, fields: FormField[]): string {
  if (!c) return '其他情况';
  const fieldLabel = fields.find((f) => f.id === c.field)?.label ?? c.field;
  const opLabel = OPERATORS.find((o) => o.op === c.op)?.label ?? c.op;
  return `${fieldLabel} ${opLabel} ${c.value}`;
}

function matches(c: BranchCondition, values: Record<string, string>): boolean {
  const raw = values[c.field];
  const n = Number(raw);
  if (raw == null || raw === '' || Number.isNaN(n)) return false;
  switch (c.op) {
    case '<': return n < c.value;
    case '<=': return n <= c.value;
    case '>': return n > c.value;
    case '>=': return n >= c.value;
    case '==': return n === c.value;
    case '!=': return n !== c.value;
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
        path.push({ type: 'approver', title: s.title ?? '审批人', assignee: s.assignee });
      } else if (s.type === 'auto') {
        path.push({ type: 'auto', title: s.title ?? '系统自动通过' });
      }
    }
  };
  walk(steps);
  return { path, takenBranchKeys };
}
