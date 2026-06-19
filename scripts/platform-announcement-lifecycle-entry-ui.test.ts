import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform announcement lifecycle entry UI', () => {
  it('adds edit and withdraw lifecycle entries to platform announcements', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementPublishPanel'),
    );
    const lifecyclePanel = app.slice(
      app.indexOf('const PlatformAnnouncementLifecyclePanel'),
      app.indexOf('const PlatformAnnouncementPublishPanel'),
    );

    expect(platformWorkspace).toContain('selectedPlatformAnnouncement');
    expect(platformWorkspace).toContain('PlatformAnnouncementLifecyclePanel');
    expect(lifecyclePanel).toContain('公告生命周期');
    expect(lifecyclePanel).toContain('编辑草稿');
    expect(lifecyclePanel).toContain('撤回公告');
    expect(lifecyclePanel).toContain('影响范围');
    expect(lifecyclePanel).toContain('站内通知');
    expect(lifecyclePanel).toContain('审计留痕');
    expect(lifecyclePanel).toContain('Java API 待扩展');
    expect(lifecyclePanel).toContain('Mock 模式仅更新页面草稿');
    expect(lifecyclePanel).toContain('announcement.title');
    expect(lifecyclePanel).toContain('announcement.content');
    expect(lifecyclePanel).toContain('formatAnnouncementScope(announcement.targetScope)');
  });
});
