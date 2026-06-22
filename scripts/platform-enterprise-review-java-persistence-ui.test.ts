import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform enterprise review Java persistence UI', () => {
  it('wires platform enterprise review actions to Java persistence with busy state and status feedback', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementPublishPanel'),
    );
    const platformReviewActionPanel = app.slice(
      app.indexOf('const PlatformEnterpriseReviewActionPanel'),
      app.indexOf('const formatEnterpriseType'),
    );

    expect(app).toContain('platformReviewBusyId');
    expect(app).toContain('reviewPlatformEnterprise');
    expect(app).toContain('javaApiClient.reviewPlatformEnterprise');
    expect(app).toContain("reviewStatus: result === 'approved' ? 'approved' : 'rejected'");
    expect(app).toContain('reviewComment: draft.comment.trim()');
    expect(app).toContain('profileConfirmed: draft.profileConfirmed');
    expect(app).toContain('riskConfirmed: draft.riskConfirmed');
    expect(app).toContain('setWorkflowStatus(`平台企业审核已${result ===');
    expect(platformWorkspace).toContain('platformReviewBusyId');
    expect(platformWorkspace).toContain('reviewBusyId');
    expect(platformReviewActionPanel).toContain("reviewBusyId === `${review.id}:approved`");
    expect(platformReviewActionPanel).toContain("reviewBusyId === `${review.id}:rejected`");
    expect(platformReviewActionPanel).toContain('enterpriseReviewInvalid');
    expect(platformReviewActionPanel).toContain("onReviewEnterprise(review.id, 'approved', draft)");
    expect(platformReviewActionPanel).toContain("onReviewEnterprise(review.id, 'rejected', draft)");
    expect(platformReviewActionPanel).toContain('disabled={approveBusy || rejectBusy || enterpriseReviewInvalid}');
    expect(platformReviewActionPanel).toContain('审核中');
    expect(platformReviewActionPanel).toContain('最近审核结果');
    expect(platformReviewActionPanel).toContain("enterpriseReviews.filter((review) => review.status !== '待审核')");
    expect(platformReviewActionPanel).toContain("review.status === '已驳回'");
    expect(platformReviewActionPanel).toContain('等待重新提交');
  });
});
