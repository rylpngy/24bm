import { describe, expect, it } from 'vitest';
import { emptyItem, type LudongApplication, type WorkflowTask } from './api';
import {
  createTaskReviewData,
  financeBudgetStatuses,
  procurementBudgetStatuses,
} from './ludong-poc-approval-dialog';

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
  it('initializes a blank bounded opinion form for administrator-added nodes',()=>{
    expect(createTaskReviewData(task('new_special_review'),application)).toEqual({customNodeOpinion:'',customNodeComment:''});
  });
  it('keeps argumentation focused on reviewer conclusion instead of editing applicant data', () => {
    const data = createTaskReviewData(task('argumentation_review'), application);

    expect(data).toEqual({ argumentationOpinion: '', argumentationComment: '' });
    expect(data).not.toHaveProperty('items');
  });

  it('keeps mall participant review as confirmation of the applicant-filled form', () => {
    const data = createTaskReviewData(task('mall_selection_participant_review'), application);

    expect(data).not.toHaveProperty('items');
    expect(data).not.toHaveProperty('configurationStandard');
    expect(data.mallSelectionParticipantOpinion).toBe('');
  });

  it('uses procurement-budget wording only for the procurement budget review', () => {
    expect(financeBudgetStatuses).toContain('本项目已列入本年度学校预算');
    expect(procurementBudgetStatuses).toContain('本项目已列入本年度采购预算');
    expect(procurementBudgetStatuses.join('')).not.toContain('学校预算');
  });
});
