import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform module header and toolbar UI', () => {
  it('adds a shared platform module header to platform workspace pages', () => {
    const app = read('App.tsx');

    expect(app).toContain('const PlatformModuleHeader');
    expect(app).toContain('const platformModuleHeaders: Record<PlatformAdminModule');
    expect(app).toContain('const platformModuleFacts = buildPlatformModuleFacts');
    expect(app).toContain('const platformModuleHeader = platformModuleHeaders[activeModule]');
    expect(app).toContain('<PlatformModuleHeader');
    expect(app).toContain('header={platformModuleHeader}');
    expect(app).toContain('平台当前动作');
    expect(app).toContain('当前筛选');
  });

  it('surfaces module-specific platform copy for overview, tenants, reviews, and announcements', () => {
    const app = read('App.tsx');

    expect(app).toContain("overview: {");
    expect(app).toContain("title: '平台看板'");
    expect(app).toContain("primaryAction: '查看运营概览'");
    expect(app).toContain("tenants: {");
    expect(app).toContain("primaryAction: '启停租户 / 调整套餐'");
    expect(app).toContain("reviews: {");
    expect(app).toContain("primaryAction: '通过 / 驳回企业审核'");
    expect(app).toContain("announcements: {");
    expect(app).toContain("primaryAction: '发布平台公告'");
  });

  it('adds list toolbar context to platform review and announcement lists', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementPublishPanel'),
    );

    expect(platformWorkspace).toContain('title="企业审核池"');
    expect(platformWorkspace).toContain('recordCount={enterpriseReviews.length}');
    expect(platformWorkspace).toContain('filterLabel="待审核优先"');
    expect(platformWorkspace).toContain('actionLabel="批量审核"');

    expect(platformWorkspace).toContain('title="公告发布池"');
    expect(platformWorkspace).toContain('recordCount={announcements.length}');
    expect(platformWorkspace).toContain('filterLabel="已发布公告"');
    expect(platformWorkspace).toContain('actionLabel="发布公告"');
  });
});
