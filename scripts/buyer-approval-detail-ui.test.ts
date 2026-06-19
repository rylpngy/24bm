import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval detail UI', () => {
  it('connects approval queue selections to an approval detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const approvalDetailView = app.slice(
      app.indexOf('const ApprovalDetailPanelView'),
      app.indexOf('const AuditLogDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildApprovalDetailPanel');
    expect(buyerAdminUi).toContain('businessFacts');
    expect(buyerAdminUi).toContain('contextRows');
    expect(buyerAdminUi).toContain('reviewCheckRows');
    expect(buyerAdminUi).toContain('timelineRows');

    expect(app).toContain('buildApprovalDetailPanel');
    expect(app).toContain('selectedApprovalId');
    expect(app).toContain('setSelectedApprovalId');
    expect(app).toContain('ApprovalDetailPanelView');
    expect(approvalDetailView).toContain('审批详情');
    expect(approvalDetailView).toContain('业务上下文');
    expect(approvalDetailView).toContain('处理检查');
    expect(approvalDetailView).toContain('reviewCheckRows');
    expect(approvalDetailView).toContain('处理轨迹');
    expect(app).toContain('当前详情');
  });

  it('surfaces approve and reject actions inside the approval detail panel', () => {
    const app = read('App.tsx');
    const approvalDetailView = app.slice(
      app.indexOf('const ApprovalDetailPanelView'),
      app.indexOf('const AuditLogDetailPanelView'),
    );

    expect(approvalDetailView).toContain('ApprovalDetailOperationPanel');
    expect(approvalDetailView).toContain('审批操作');
    expect(approvalDetailView).toContain('approval?: JavaApprovalTaskDto');
    expect(approvalDetailView).toContain('approvalBusyId: string | null');
    expect(approvalDetailView).toContain('javaEnabled: boolean');
    expect(approvalDetailView).toContain('reviewDraft?: BuyerApprovalReviewDraft');
    expect(approvalDetailView).toContain('onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft) => void');
    expect(approvalDetailView).toContain('onReviewApproval(approval, false, reviewDraft)');
    expect(approvalDetailView).toContain('onReviewApproval(approval, true, reviewDraft)');
    expect(approvalDetailView).toContain('该审批已处理');
  });
});
