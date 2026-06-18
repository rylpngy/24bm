import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform tenant actions UI', () => {
  it('adds tenant status, plan, and feature switch operations before the tenant table', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformTenantActionPanel');
    expect(platformWorkspace).toContain('租户操作');
    expect(platformWorkspace).toContain('启用租户');
    expect(platformWorkspace).toContain('停用租户');
    expect(platformWorkspace).toContain('升级专业版');
    expect(platformWorkspace).toContain('切换询价');
    expect(platformWorkspace).toContain('onUpdateTenantStatus');
    expect(platformWorkspace).toContain('onUpdateTenantPlan');
    expect(platformWorkspace).toContain('onToggleTenantFeature');
    expect(platformWorkspace).toContain('setPlatformTenants');
    expect(platformWorkspace).toContain('features: tenant.enabledFeatures');
    expect(platformWorkspace).toContain("feature === 'rfq'");
    expect(platformWorkspace).toContain("tenant.status === '停用'");
    expect(platformWorkspace).toContain('platformTenants.map');
  });
});
