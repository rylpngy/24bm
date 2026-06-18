import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval operation panel UI details', () => {
  it('summarizes approval context beside approve and reject actions', () => {
    const app = read('App.tsx');
    const approvalOperationPanel = app.slice(
      app.indexOf('const ApprovalDetailOperationPanel'),
      app.indexOf('const AuditLogDetailPanelView'),
    );

    expect(approvalOperationPanel).toContain('审批摘要');
    expect(approvalOperationPanel).toContain('审批类型');
    expect(approvalOperationPanel).toContain('审批状态');
    expect(approvalOperationPanel).toContain('业务状态');
    expect(approvalOperationPanel).toContain('关联明细');
    expect(approvalOperationPanel).toContain('等待处理');
    expect(approvalOperationPanel).toContain('下一步');
    expect(approvalOperationPanel).toContain('detail.reviewCheckRows.find');
    expect(approvalOperationPanel).toContain('detail.timelineRows.find');
    expect(approvalOperationPanel).toContain('renderApprovalSummary');
    expect(approvalOperationPanel.indexOf('const renderApprovalSummary')).toBeLessThan(
      approvalOperationPanel.indexOf('return ('),
    );
  });
});
