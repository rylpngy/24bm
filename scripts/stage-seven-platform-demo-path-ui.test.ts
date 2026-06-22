import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven platform demo path UI', () => {
  it('adds a four-step platform operation demo path across overview tenants reviews and announcements', () => {
    const app = read('App.tsx');
    const component = read('components/stageEightDemoPanels.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementLifecyclePanel'),
    );

    expect(app).toContain('platformDemoWalkthroughModules');
    expect(app).toContain('platformDemoWalkthroughSteps');
    expect(app).toContain('DemoWalkthroughRail');
    expect(app).toContain("'overview'");
    expect(app).toContain("'tenants'");
    expect(app).toContain("'reviews'");
    expect(app).toContain("'announcements'");

    expect(platformWorkspace).toContain('onNavigatePlatformModule');
    expect(platformWorkspace).toContain('<DemoWalkthroughRail');
    expect(platformWorkspace).toContain('activeModule={activeModule}');
    expect(platformWorkspace).toContain('steps={platformDemoWalkthroughSteps}');
    expect(platformWorkspace).toContain('onNavigate={(moduleId) => onNavigatePlatformModule(moduleId)}');
    expect(app).toContain('平台运营演示路径');
    expect(app).toContain('按 4 页顺序完成平台运营轻量演示');
    expect(component).toContain('当前演示页');
    expect(component).toContain('下一演示页');
    expect(app).toContain('平台看板');
    expect(app).toContain('租户列表');
    expect(app).toContain('企业审核');
    expect(app).toContain('平台公告');
  });

  it('records the twenty-third stage-seven increment as platform operation demo path', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 23 | 平台运营端轻量演示路径 |');
    expect(checklist).toContain('平台看板、租户列表、企业审核和平台公告');
    expect(checklist).toContain('scripts/stage-seven-platform-demo-path-ui.test.ts');
  });
});
