import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform tenant Java persistence UI', () => {
  it('wires tenant status, plan, and feature actions to Java persistence with busy state', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementPublishPanel'),
    );
    const tenantActionPanel = app.slice(
      app.indexOf('const PlatformTenantActionPanel'),
      app.indexOf('const PlatformTenantListSummaryPanel'),
    );

    expect(app).toContain('platformTenantBusyId');
    expect(app).toContain('updatePlatformTenantStatus');
    expect(app).toContain('javaApiClient.enablePlatformTenant');
    expect(app).toContain('javaApiClient.disablePlatformTenant');
    expect(app).toContain('updatePlatformTenantPlan');
    expect(app).toContain('javaApiClient.updatePlatformTenantPlan');
    expect(app).toContain('togglePlatformTenantFeature');
    expect(app).toContain('javaApiClient.updatePlatformTenantFeatures');
    expect(app).toContain('setWorkflowStatus(`平台租户');
    expect(platformWorkspace).toContain('platformTenantBusyId');
    expect(platformWorkspace).toContain('tenantBusyId');
    expect(tenantActionPanel).toContain("tenantBusyId === `${tenant.id}:enable`");
    expect(tenantActionPanel).toContain("tenantBusyId === `${tenant.id}:disable`");
    expect(tenantActionPanel).toContain("tenantBusyId === `${tenant.id}:plan`");
    expect(tenantActionPanel).toContain("tenantBusyId === `${tenant.id}:feature:rfq`");
    expect(tenantActionPanel).toContain('disabled={enableDisabled}');
    expect(tenantActionPanel).toContain('disabled={disableDisabled}');
    expect(tenantActionPanel).toContain('disabled={planBusy || featureBusy}');
    expect(tenantActionPanel).toContain('Java 模式下持久化租户操作');
    expect(tenantActionPanel).toContain('处理中');
  });
});
