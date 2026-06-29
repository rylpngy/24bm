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

export interface FlowBranch {
  label: string;
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
