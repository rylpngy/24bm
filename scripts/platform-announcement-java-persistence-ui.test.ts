import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform announcement Java persistence UI', () => {
  it('wires platform announcement publish, edit, withdraw, and list to Java persistence with busy state', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformEnterpriseReviewActionPanel'),
    );
    const publishPanel = app.slice(
      app.indexOf('const PlatformAnnouncementPublishPanel'),
      app.indexOf('const formatAnnouncementScope'),
    );

    expect(app).toContain('announcementPublishBusy');
    expect(app).toContain('announcementLifecycleBusyId');
    expect(app).toContain('publishPlatformAnnouncement');
    expect(app).toContain('updatePlatformAnnouncement');
    expect(app).toContain('withdrawPlatformAnnouncement');
    expect(app).toContain('javaApiClient.listPlatformAnnouncements');
    expect(app).toContain('javaApiClient.publishPlatformAnnouncement');
    expect(app).toContain('javaApiClient.updatePlatformAnnouncement');
    expect(app).toContain('javaApiClient.withdrawPlatformAnnouncement');
    expect(app).toContain('content: payload.content');
    expect(app).toContain('setWorkflowStatus(`平台公告已发布');
    expect(app).toContain('setWorkflowStatus(`平台公告已保存并刷新');
    expect(app).toContain('setWorkflowStatus(`平台公告已撤回');
    expect(app).toContain('buildPlatformAnnouncements');
    expect(app).toContain('content: announcement.content');
    expect(platformWorkspace).toContain('announcementPublishBusy');
    expect(platformWorkspace).toContain('publishBusy');
    expect(publishPanel).toContain('Java 模式下持久化发布公告');
    expect(publishPanel).toContain('公告正文');
    expect(publishPanel).toContain('announcementPublishInvalid');
    expect(publishPanel).toContain('disabled={announcementPublishInvalid || publishBusy}');
    expect(publishPanel).toContain('发布中');
  });
});
