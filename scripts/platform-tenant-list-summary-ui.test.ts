import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform tenant list summary UI', () => {
  it('summarizes tenant list status and capacity before the tenant table', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformTenantListSummaryPanel');
    expect(platformWorkspace).toContain('租户运营摘要');
    expect(platformWorkspace).toContain('租户总数');
    expect(platformWorkspace).toContain('启用租户');
    expect(platformWorkspace).toContain('待审核租户');
    expect(platformWorkspace).toContain('用户容量');
    expect(platformWorkspace).toContain('套餐覆盖');
    expect(platformWorkspace).toContain('下一步');
    expect(platformWorkspace).toContain("tenant.status === 'active' || tenant.status === '启用'");
    expect(platformWorkspace).toContain('new Set(tenants.map');
  });
});
