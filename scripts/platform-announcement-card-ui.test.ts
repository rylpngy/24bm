import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform announcement card UI', () => {
  it('renders platform announcements as structured cards with scope and publish context', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementSummaryPanel'),
    );

    expect(platformWorkspace).toContain('PlatformAnnouncementCard');
    expect(platformWorkspace).toContain('公告明细卡片');
    expect(platformWorkspace).toContain('公告编号');
    expect(platformWorkspace).toContain('发布范围');
    expect(platformWorkspace).toContain('发布时间');
    expect(platformWorkspace).toContain('发布状态');
    expect(platformWorkspace).toContain('formatAnnouncementScope(announcement.targetScope)');
    expect(platformWorkspace).toContain('formatAuditTime(announcement.publishedAt)');
  });
});
