import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform enterprise review actions UI', () => {
  it('adds local approve and reject actions to the platform review page', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformEnterpriseReviewActionPanel');
    expect(platformWorkspace).toContain('审核操作');
    expect(platformWorkspace).toContain('通过审核');
    expect(platformWorkspace).toContain('驳回');
    expect(platformWorkspace).toContain('onReviewEnterprise');
    expect(platformWorkspace).toContain('setPlatformEnterpriseReviews');
    expect(platformWorkspace).toContain("status: result === 'approved' ? '已认证' : '已驳回'");
    expect(platformWorkspace).toContain("enterpriseReviews.filter((review) => review.status === '待审核')");
    expect(platformWorkspace).toContain('PlatformEnterpriseReviewCard');
    expect(platformWorkspace).toContain('enterpriseReviews.map((review) => (');
  });

  it('shows validation feedback before platform enterprise review decisions', () => {
    const app = read('App.tsx');
    const reviewActionPanel = app.slice(
      app.indexOf('const PlatformEnterpriseReviewActionPanel'),
      app.indexOf('const PlatformEnterpriseReviewCard'),
    );

    expect(reviewActionPanel).toContain('reviewDrafts');
    expect(reviewActionPanel).toContain('getReviewDraft');
    expect(reviewActionPanel).toContain('reviewCommentInvalid');
    expect(reviewActionPanel).toContain('reviewProfileInvalid');
    expect(reviewActionPanel).toContain('reviewRiskInvalid');
    expect(reviewActionPanel).toContain('enterpriseReviewInvalid');
    expect(reviewActionPanel).toContain('审核意见');
    expect(reviewActionPanel).toContain('企业入驻资料已核对');
    expect(reviewActionPanel).toContain('风险与重复企业已复核');
    expect(reviewActionPanel).toContain('请填写审核意见后再处理。');
    expect(reviewActionPanel).toContain('请先确认企业入驻资料已核对。');
    expect(reviewActionPanel).toContain('请先确认风险与重复企业已复核。');
    expect(reviewActionPanel).toContain('aria-live="polite"');
    expect(reviewActionPanel).toContain('disabled={approveBusy || rejectBusy || enterpriseReviewInvalid}');
  });
});
