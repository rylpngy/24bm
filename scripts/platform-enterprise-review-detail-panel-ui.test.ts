import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('platform enterprise review detail panel UI', () => {
  it('adds a selected enterprise review detail panel with profile risk and audit context', () => {
    const app = read('App.tsx');
    const platformWorkspace = app.slice(
      app.indexOf('const PlatformWorkspace'),
      app.indexOf('const PlatformAnnouncementLifecyclePanel'),
    );
    const reviewDetailPanel = app.slice(
      app.indexOf('const PlatformEnterpriseReviewDetailPanel'),
      app.indexOf('const PlatformEnterpriseReviewCard'),
    );

    expect(platformWorkspace).toContain('selectedPlatformReview');
    expect(platformWorkspace).toContain('PlatformEnterpriseReviewDetailPanel');
    expect(platformWorkspace).toContain('lg:grid-cols-[minmax(0,1fr)_420px]');

    expect(reviewDetailPanel).toContain('审核详情');
    expect(reviewDetailPanel).toContain('入驻资料');
    expect(reviewDetailPanel).toContain('风险检查');
    expect(reviewDetailPanel).toContain('审核轨迹');
    expect(reviewDetailPanel).toContain('处理建议');
    expect(reviewDetailPanel).toContain('review.name');
    expect(reviewDetailPanel).toContain('formatEnterpriseType(review.type)');
    expect(reviewDetailPanel).toContain('review.industry');
    expect(reviewDetailPanel).toContain('enterprise.reviewed');
    expect(reviewDetailPanel).toContain('review.status');
  });
});
