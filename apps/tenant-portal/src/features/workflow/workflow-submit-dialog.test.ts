import { describe, expect, it } from 'vitest';
import { workflowSubmissionErrorMessage } from './workflow-submit-dialog';

describe('workflow submission errors', () => {
  it('explains when a department-manager approval cannot be started', () => {
    expect(workflowSubmissionErrorMessage({
      response: { data: { message: 'Initiator department has no active manager configured: dept-it' } },
    })).toContain('设置部门主管');
  });

  it('keeps a readable backend message when no specialized recovery guidance applies', () => {
    expect(workflowSubmissionErrorMessage({ response: { data: { message: '业务状态已更新' } } }))
      .toBe('业务状态已更新');
  });
});
