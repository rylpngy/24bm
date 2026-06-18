import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform operation summary UI', () => {
  it('summarizes tenant, review, and announcement operations in the platform workspace', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformOperationSummaryPanel');
    expect(platformWorkspace).toContain('平台运营摘要');
    expect(platformWorkspace).toContain('采购租户');
    expect(platformWorkspace).toContain('待审核企业');
    expect(platformWorkspace).toContain('公共供应商');
    expect(platformWorkspace).toContain('公告数量');
    expect(platformWorkspace).toContain('启用套餐');
    expect(platformWorkspace).toContain('下一步');
    expect(platformWorkspace).toContain('platformOverview?.operationSummary');
    expect(platformWorkspace).toContain('enterpriseReviews.filter');
    expect(platformWorkspace).toContain('announcements.length');
  });
});
