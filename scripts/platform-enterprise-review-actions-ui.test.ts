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
    expect(platformWorkspace).toContain('rows={enterpriseReviews.map');
  });
});
