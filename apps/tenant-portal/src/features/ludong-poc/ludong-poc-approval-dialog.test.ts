import { describe, expect, it } from 'vitest';
import { emptyItem, type LudongApplication, type WorkflowTask } from './api';
import { createTaskReviewData } from './ludong-poc-approval-dialog';

const task = (nodeId: string): WorkflowTask => ({
  taskId: `task-${nodeId}`,
  workflowInstanceId: 'workflow-1',
  businessType: 'ludong_project_application',
  businessId: 'application-1',
  taskName: nodeId,
  taskDefinitionKey: `task_${nodeId}`,
});

const application: LudongApplication = {
  id: 'application-1',
  applicationNo: 'LDUG-001',
  projectName: '教学设备采购',
  applicantUnit: '教务处',
  budgetAmount: 100000,
  status: 'in_approval',
  formData: {},
  items: [{
    ...emptyItem(),
    materialId: 'material-1',
    name: '教学终端',
    quantity: '2',
    purpose: '课堂教学',
    technicalParameters: '标准配置',
  }],
  createdBy: 'user-1',
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
};

describe('createTaskReviewData', () => {
  it('carries the same material lines into argumentation', () => {
    const data = createTaskReviewData(task('argumentation_review'), application);

    expect(data.items).toEqual(application.items);
    expect(data.configurationStandard).toBe('附件3（办公设备及家具配置标准）');
  });

  it('keeps mall participant review as confirmation of the applicant-filled form', () => {
    const data = createTaskReviewData(task('mall_selection_participant_review'), application);

    expect(data).not.toHaveProperty('items');
    expect(data).not.toHaveProperty('configurationStandard');
    expect(data.mallSelectionParticipantOpinion).toBe('同意');
  });
});
