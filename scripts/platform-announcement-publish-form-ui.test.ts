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
});
