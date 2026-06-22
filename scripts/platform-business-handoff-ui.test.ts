import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  return source.slice(startIndex, endIndex);
};

describe('platform business handoff UI', () => {
  it('adds shared business handoff guidance to platform tenant review and announcement modules', () => {
    const source = app();
    const platformWorkspace = sliceBetween(source, 'const PlatformWorkspace', 'const PlatformAnnouncementLifecyclePanel');
    const tenantModule = sliceBetween(source, "{activeModule === 'tenants'", "{activeModule === 'reviews'");
    const reviewModule = sliceBetween(source, "{activeModule === 'reviews'", "{activeModule === 'announcements'");
    const announcementModule = sliceBetween(source, "{activeModule === 'announcements'", 'const PlatformAnnouncementLifecyclePanel');

    expect(platformWorkspace).toContain('describePlatformTenantNextAction');
    expect(platformWorkspace).toContain('describePlatformReviewNextAction');
    expect(platformWorkspace).toContain('describePlatformAnnouncementNextAction');

    expect(tenantModule).toContain('<SelectedBusinessHandoffPanel');
    expect(tenantModule).toContain('moduleLabel="租户列表"');
    expect(tenantModule).toContain('nextActionTitle={describePlatformTenantNextAction(selectedPlatformTenant)}');

    expect(reviewModule).toContain('<SelectedBusinessHandoffPanel');
    expect(reviewModule).toContain('moduleLabel="企业审核"');
    expect(reviewModule).toContain('nextActionTitle={describePlatformReviewNextAction(selectedPlatformReview)}');

    expect(announcementModule).toContain('<SelectedBusinessHandoffPanel');
    expect(announcementModule).toContain('moduleLabel="平台公告"');
    expect(announcementModule).toContain('nextActionTitle={describePlatformAnnouncementNextAction(selectedPlatformAnnouncement)}');
  });

  it('records platform handoff progress in the stage checklist', () => {
    const checklist = readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

    expect(checklist).toContain('平台端业务接力提示');
    expect(checklist).toContain('租户列表、企业审核和平台公告模块已补');
    expect(checklist).toContain('平台侧下一处理、详情核对和处理边界');
    expect(checklist).toContain('scripts/platform-business-handoff-ui.test.ts');
  });
});
