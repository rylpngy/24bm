import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform enterprise review card UI', () => {
  it('renders enterprise reviews as structured cards with review context', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformTenantActionPanel'),
    );

    expect(platformWorkspace).toContain('PlatformEnterpriseReviewCard');
    expect(platformWorkspace).toContain('企业审核卡片');
    expect(platformWorkspace).toContain('企业类型');
    expect(platformWorkspace).toContain('所属行业');
    expect(platformWorkspace).toContain('审核状态');
    expect(platformWorkspace).toContain('下一步');
    expect(platformWorkspace).toContain('formatEnterpriseType(review.type)');
    expect(platformWorkspace).toContain("review.status === '待审核'");
  });
});
