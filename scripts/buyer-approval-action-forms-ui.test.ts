import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval action forms UI', () => {
  it('collects review comment and confirmation before approval actions', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );
    const approvalDetailView = app.slice(
      app.indexOf('const ApprovalDetailPanelView'),
      app.indexOf('const AuditLogDetailPanelView'),
    );

    expect(app).toContain('type BuyerApprovalReviewDraft');
    expect(app).toContain('reviewApprovalTask = async (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft)');
    expect(app).toContain('审批意见');
    expect(app).toContain('已核对业务上下文和审批影响');
    expect(buyerWorkspace).toContain('approvalReviewDrafts');
    expect(buyerWorkspace).toContain('getApprovalReviewDraft');
    expect(app).toContain('onReviewApproval(approval as JavaApprovalTaskDto, false, approvalDraft)');
    expect(app).toContain('onReviewApproval(approval as JavaApprovalTaskDto, true, approvalDraft)');
    expect(approvalDetailView).toContain('onReviewApproval(approval, false, reviewDraft)');
    expect(approvalDetailView).toContain('onReviewApproval(approval, true, reviewDraft)');
    expect(app).toContain('!draft.confirmed');
  });
});
