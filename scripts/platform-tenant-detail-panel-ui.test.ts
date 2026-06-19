import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform tenant detail panel UI', () => {
  it('adds a selected tenant detail panel with plan feature and audit context', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformEnterpriseReviewCard'),
    );
    const tenantDetailPanel = app.slice(
      app.indexOf('const PlatformTenantDetailPanel'),
      app.indexOf('const PlatformTenantListSummaryPanel'),
    );

    expect(platformWorkspace).toContain('selectedPlatformTenant');
    expect(platformWorkspace).toContain('PlatformTenantDetailPanel');
    expect(platformWorkspace).toContain('lg:grid-cols-[minmax(0,1fr)_420px]');

    expect(tenantDetailPanel).toContain('租户详情');
    expect(tenantDetailPanel).toContain('套餐容量');
    expect(tenantDetailPanel).toContain('功能开关详情');
    expect(tenantDetailPanel).toContain('多租户数据隔离');
    expect(tenantDetailPanel).toContain('审计动作');
    expect(tenantDetailPanel).toContain('tenant.plan');
    expect(tenantDetailPanel).toContain('tenant.userLimit');
    expect(tenantDetailPanel).toContain('tenant.features');
    expect(tenantDetailPanel).toContain('tenant.enabledFeatures');
    expect(tenantDetailPanel).toContain('tenant.features.includes');
    expect(tenantDetailPanel).toContain('tenant.id');
  });
});
