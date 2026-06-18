import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform enterprise review summary UI', () => {
  it('summarizes enterprise review queue before the review list', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformEnterpriseReviewSummaryPanel');
    expect(platformWorkspace).toContain('企业审核摘要');
    expect(platformWorkspace).toContain('待审核');
    expect(platformWorkspace).toContain('已认证');
    expect(platformWorkspace).toContain('采购方企业');
    expect(platformWorkspace).toContain('供应商企业');
    expect(platformWorkspace).toContain('下一步');
    expect(platformWorkspace).toContain("review.status === '待审核'");
    expect(platformWorkspace).toContain("review.type === 'buyer'");
  });
});
