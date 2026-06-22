import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform announcement publish form UI', () => {
  it('adds a local publish operation to the platform announcement page', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformAnnouncementPublishPanel');
    expect(platformWorkspace).toContain('发布平台公告');
    expect(platformWorkspace).toContain('公告标题');
    expect(platformWorkspace).toContain('公告正文');
    expect(platformWorkspace).toContain('发布范围');
    expect(platformWorkspace).toContain('onPublishAnnouncement');
    expect(platformWorkspace).toContain('setPlatformAnnouncements');
    expect(platformWorkspace).toContain("targetScope: 'all'");
    expect(platformWorkspace).toContain('event.preventDefault()');
    expect(platformWorkspace).toContain('nextContent');
    expect(platformWorkspace).toContain('content: nextContent');
    expect(platformWorkspace).toContain('platformAnnouncements.map');
  });

  it('shows validation feedback before publishing platform announcements', () => {
    const app = read('App.tsx');
    const publishPanel = app.slice(
      app.indexOf('const PlatformAnnouncementPublishPanel'),
      app.indexOf('const formatAnnouncementScope'),
    );

    expect(publishPanel).toContain('announcementTitleInvalid');
    expect(publishPanel).toContain('announcementContentInvalid');
    expect(publishPanel).toContain('announcementScopeInvalid');
    expect(publishPanel).toContain('announcementPublishInvalid');
    expect(publishPanel).toContain('请填写公告标题后再发布。');
    expect(publishPanel).toContain('请填写公告正文后再发布。');
    expect(publishPanel).toContain('请选择有效发布范围。');
    expect(publishPanel).toContain('aria-live="polite"');
    expect(publishPanel).toContain('disabled={announcementPublishInvalid || publishBusy}');
  });
});
