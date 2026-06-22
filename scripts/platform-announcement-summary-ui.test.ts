import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform announcement summary UI', () => {
  it('summarizes platform announcement publishing state before the announcement list', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const BuyerWorkspaceView'),
    );

    expect(platformWorkspace).toContain('PlatformAnnouncementSummaryPanel');
    expect(platformWorkspace).toContain('公告发布摘要');
    expect(platformWorkspace).toContain('公告数量');
    expect(platformWorkspace).toContain('发布范围');
    expect(platformWorkspace).toContain('最近发布');
    expect(platformWorkspace).toContain('已发布');
    expect(platformWorkspace).toContain('下一步');
    expect(platformWorkspace).toContain('formatAuditTime(latestAnnouncement.publishedAt)');
    expect(platformWorkspace).toContain('new Set(announcements.map');
  });
});
