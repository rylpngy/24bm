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
    expect(localGuide).toContain('GET /api/v1/platform/overview');
  });
});
