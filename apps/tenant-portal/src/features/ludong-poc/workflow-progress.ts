import type { WorkflowEvent, WorkflowHistory } from './api';

export type WorkflowProgressStatus = 'completed' | 'current' | 'pending' | 'skipped' | 'reused' | 'rejected';

export interface WorkflowProgressNode {
  id: string;
  title: string;
  status: WorkflowProgressStatus;
  event?: WorkflowEvent;
}

interface WorkflowStepDefinition {
  id: string;
  title: string;
  applies?: (formData: Record<string, unknown>) => boolean;
}

const LUDONG_WORKFLOW_STEPS: WorkflowStepDefinition[] = [
  { id: 'argumentation_review', title: '购置必要性论证' },
  { id: 'technical_leader_review', title: '技术负责人确认' },
  { id: 'compilation_participant_review', title: '参与编制人员确认' },
  { id: 'mall_selection_participant_review', title: '网上商城选型参与人确认' },
  { id: 'it_review', title: '教育信息技术部审核', applies: flag('requiresItReview', '是') },
  { id: 'unit_review', title: '申报单位负责人审核' },
  { id: 'funding_review', title: '经费主管单位负责人审核', applies: flag('sameFundingUnit', '否') },
  { id: 'asset_configuration_review', title: '资产处配置审核', applies: flag('requiresAssetReview', '是') },
  { id: 'asset_division_leader_review', title: '资产处分管领导审核', applies: flag('requiresAssetReview', '是') },
  { id: 'asset_unit_leader_review', title: '资产处单位负责人审核', applies: flag('requiresAssetReview', '是') },
  { id: 'lab_equipment_review', title: '实验室管理处论证审核', applies: flag('requiresLabReview', '是') },
  { id: 'lab_division_leader_review', title: '实验室管理处分管领导审核', applies: flag('requiresLabReview', '是') },
  { id: 'lab_unit_leader_review', title: '实验室管理处单位负责人审核', applies: flag('requiresLabReview', '是') },
  { id: 'school_leader_review', title: '分管校领导审核', applies: flag('requiresSchoolLeader', '是') },
  { id: 'finance_budget_review', title: '财务预算办公室审核' },
  { id: 'procurement_budget_review', title: '采购预算办公室审核' },
  { id: 'handover_submit', title: '申请材料提交确认' },
  { id: 'handover_accept', title: '申请材料受理确认' },
  { id: 'procurement_method_review', title: '财经处采购方式审核' },
  { id: 'finance_responsible_review', title: '财经处负责人终审' },
];

export function buildLudongWorkflowProgress(history?: WorkflowHistory | null): WorkflowProgressNode[] {
  if (!history) return [];
  const formData = history.formData ?? {};
  const currentNodeId = normalizeNodeId(history.currentTask?.taskDefinitionKey);
  const decisions = new Map<string, WorkflowEvent>();
  const arrivals = new Map<string, WorkflowEvent>();

  history.events.forEach((event) => {
    if (event.action === 'approved' || event.action === 'rejected') {
      decisions.set(normalizeNodeId(event.nodeId), event);
    }
    if (event.action === 'created') {
      arrivals.set(normalizeNodeId(event.nodeId), event);
    }
  });

  return LUDONG_WORKFLOW_STEPS.map((step) => {
    const event = decisions.get(step.id);
    if (event?.action === 'rejected') return { ...step, status: 'rejected', event };
    if (event?.action === 'approved') {
      return { ...step, status: event.comment?.includes('自动复用结论') ? 'reused' : 'completed', event };
    }
    if (step.id === 'funding_review' && formData.sameFundingUnit === '是') {
      return { ...step, status: 'reused' };
    }
    if (step.applies && !step.applies(formData)) return { ...step, status: 'skipped' };
    if (step.id === currentNodeId) return { ...step, status: 'current', event: arrivals.get(step.id) };
    return { ...step, status: 'pending' };
  });
}

export function workflowProgressCounts(nodes: WorkflowProgressNode[]) {
  const applicable = nodes.filter((node) => node.status !== 'skipped');
  return {
    completed: applicable.filter((node) => node.status === 'completed' || node.status === 'reused').length,
    total: applicable.length,
    skipped: nodes.length - applicable.length,
  };
}

function flag(field: string, expected: string) {
  return (formData: Record<string, unknown>) => String(formData[field] ?? '') === expected;
}

function normalizeNodeId(value?: string) {
  if (!value) return '';
  return value.startsWith('task_') ? value.slice(5) : value;
}
