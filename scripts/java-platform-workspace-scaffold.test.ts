import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java platform workspace scaffold', () => {
  it('uses an application service for real platform overview counts', () => {
    const controller = read('backend-java/src/main/java/com/procurement/platform/api/PlatformOverviewController.java');
    const service = read('backend-java/src/main/java/com/procurement/platform/application/PlatformOverviewApplicationService.java');

    expect(controller).toContain('PlatformOverviewApplicationService');
    expect(controller).toContain('platformOverviewApplicationService.overview()');
    expect(service).toContain('tenantCount');
    expect(service).toContain('publicSupplierCount');
    expect(service).toContain('pendingEnterpriseReviews');
  });

  it('exposes platform announcement publishing as a platform scoped API', () => {
    const controller = read('backend-java/src/main/java/com/procurement/platform/api/PlatformAnnouncementController.java');
    const service = read('backend-java/src/main/java/com/procurement/platform/application/PlatformAnnouncementApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/platform/infrastructure/PlatformAnnouncementMapper.java');
    const migration = read('backend-java/src/main/resources/db/migration/V4__platform_announcements.sql');
    const readme = read('backend-java/README.md');

    expect(controller).toContain('@RequestMapping("/api/v1/platform/announcements")');
    expect(controller).toContain('@GetMapping');
    expect(controller).toContain('@PostMapping');
    expect(service).toContain('TenantAccessGuard.requireUserId');
    expect(service).toContain('platform_announcement.published');
    expect(mapper).toContain('platform_announcements');
    expect(migration).toContain('create table platform_announcements');
    expect(migration).toContain("audience in ('all', 'buyer', 'supplier')");
    expect(readme).toContain('POST /api/v1/platform/announcements');
  });

  it('keeps frontend Java platform overlay wired through the Java API client', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');
    const localGuide = read('docs/local-java-integration.md');

    expect(client).toContain('loginPlatform');
    expect(client).toContain('loadJavaPlatformWorkspaceData');
    expect(client).toContain('applyJavaPlatformWorkspaceData');
    expect(client).toContain('/api/v1/platform/overview');
    expect(client).toContain('/api/v1/platform/tenants');
    expect(client).toContain('/api/v1/platform/enterprise-reviews');
    expect(app).toContain('loadJavaPlatformWorkspaceData(javaApiClient)');
    expect(app).toContain('applyJavaPlatformWorkspaceData');
    expect(localGuide).toContain('GET /api/v1/platform/workspace');
  });
});
