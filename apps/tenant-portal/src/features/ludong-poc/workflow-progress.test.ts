import { describe, expect, it } from 'vitest';
import type { WorkflowHistory } from './api';
import { buildLudongWorkflowProgress, workflowProgressCounts } from './workflow-progress';

function history(overrides: Partial<WorkflowHistory> = {}): WorkflowHistory {
  return {
    workflowInstanceId: 'workflow-1',
    status: 'PROCESSING',
    formData: {
      sameFundingUnit: '是',
      requiresItReview: '否',
      requiresAssetReview: '是',
      requiresLabReview: '否',
      requiresSchoolLeader: '否',
    },
    currentTask: {
      taskId: 'task-2',
      workflowInstanceId: 'workflow-1',
      businessType: 'ludong_project_application',
      businessId: 'application-1',
      taskName: '资产处配置审核',
      taskDefinitionKey: 'task_asset_configuration_review',
    },
    events: [{
      id: 'event-1',
      nodeName: '购置必要性论证',
      nodeId: 'task_argumentation_review',
      action: 'approved',
      actorName: '论证人',
      comment: '同意',
      createdAt: '2026-08-28T08:00:00Z',
    }],
    ...overrides,
  };
}

describe('buildLudongWorkflowProgress', () => {
  it('marks completed, current, pending and conditionally skipped nodes', () => {
    const nodes = buildLudongWorkflowProgress(history());

    expect(nodes.find((node) => node.id === 'argumentation_review')?.status).toBe('completed');
    expect(nodes.find((node) => node.id === 'asset_configuration_review')?.status).toBe('current');
    expect(nodes.find((node) => node.id === 'asset_division_leader_review')?.status).toBe('pending');
    expect(nodes.find((node) => node.id === 'it_review')?.status).toBe('skipped');
    expect(nodes.find((node) => node.id === 'funding_review')?.status).toBe('reused');
    expect(nodes.find((node) => node.id === 'lab_equipment_review')?.status).toBe('skipped');
  });

  it('keeps rejected decisions visible in history and excludes skipped nodes from totals', () => {
    const nodes = buildLudongWorkflowProgress(history({
      currentTask: undefined,
      status: 'REJECTED',
      events: [{
        id: 'event-rejected',
        nodeName: '申报单位负责人审核',
        nodeId: 'task_unit_review',
        action: 'rejected',
        actorName: '单位负责人',
        comment: '材料需补充',
        createdAt: '2026-08-28T09:00:00Z',
      }],
    }));

    expect(nodes.find((node) => node.id === 'unit_review')?.status).toBe('rejected');
    expect(workflowProgressCounts(nodes)).toEqual({ completed: 1, total: 15, skipped: 5 });
  });

  it('shows an approved task completed by decision reuse as auto reused', () => {
    const nodes = buildLudongWorkflowProgress(history({
      events: [{
        id: 'event-reused',
        nodeName: '采购预算办公室审核',
        nodeId: 'task_procurement_budget_review',
        action: 'approved',
        actorName: '预算审核人',
        comment: '同一办理人已在前序节点审批通过，系统自动复用结论',
        createdAt: '2026-08-28T09:00:00Z',
      }],
    }));

    expect(nodes.find((node) => node.id === 'procurement_budget_review')?.status).toBe('reused');
  });
});
