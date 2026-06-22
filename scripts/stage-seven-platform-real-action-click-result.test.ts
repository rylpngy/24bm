import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven platform real action click result', () => {
  it('adds stable platform action test ids for tenant review and announcement operations', () => {
    const app = read('App.tsx');

    expect(app).toContain('stage7-platform-disable-tenant-${tenant.id}');
    expect(app).toContain('stage7-platform-upgrade-plan-${tenant.id}');
    expect(app).toContain('stage7-platform-review-profile-${review.id}');
    expect(app).toContain('stage7-platform-review-risk-${review.id}');
    expect(app).toContain('stage7-platform-approve-review-${review.id}');
    expect(app).toContain('stage7-platform-announcement-title');
    expect(app).toContain('stage7-platform-announcement-content');
    expect(app).toContain('stage7-platform-publish-announcement');
    expect(app).toContain('stage7-platform-select-announcement-${announcement.id}');
    expect(app).toContain('stage7-platform-withdraw-announcement-${announcement.id}');
  });

  it('defines a Java platform real action click checker and demo seed records', () => {
    const script = read('scripts/stage-seven-platform-real-action-click-check.mjs');
    const seed = read('backend-java/src/main/resources/db/dev/V120__stage_seven_real_action_demo_seed.sql');

    expect(script).toContain('stage-seven-platform-java-real-action-click-result.json');
    expect(script).toContain('stage7-platform-disable-tenant-tenant-stage7-platform-action');
    expect(script).toContain('stage7-platform-upgrade-plan-tenant-stage7-platform-action');
    expect(script).toContain('stage7-platform-approve-review-ent-stage7-platform-review-ready');
    expect(script).toContain('stage7-platform-publish-announcement');
    expect(script).toContain('selectTestId');
    expect(script).toContain('stage7-platform-select-announcement-announcement-stage7-platform-withdraw-ready');
    expect(script).toContain('selectionReady');
    expect(script).toContain('stage7-platform-withdraw-announcement-');
    expect(seed).toContain('tenant-stage7-platform-action');
    expect(seed).toContain('ent-stage7-platform-review-ready');
  });

  it('writes a platform Java real action click artifact with all actions passing', () => {
    const artifactPath = 'docs/artifacts/stage-seven-platform-java-real-action-click-result.json';
    expect(existsSync(artifactPath)).toBe(true);

    const artifact = JSON.parse(read(artifactPath)) as {
      dataSource: string;
      passed: number;
      failed: number;
      results: Array<{ action: string; passed: boolean; failure?: string }>;
    };

    expect(artifact.dataSource).toBe('Java');
    expect(artifact.failed).toBe(0);
    expect(artifact.passed).toBe(artifact.results.length);
    expect(artifact.results.map((result) => result.action)).toEqual([
      '停用租户',
      '升级专业版',
      '通过企业审核',
      '发布平台公告',
      '撤回平台公告',
    ]);
    expect(artifact.results.every((result) => result.passed)).toBe(true);
  });

  it('records the twenty-sixth stage-seven increment as platform real click acceptance', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(checklist).toContain('| 26 | 平台运营端真实点击复核 |');
    expect(checklist).toContain('scripts/stage-seven-platform-real-action-click-check.mjs');
    expect(checklist).toContain('docs/artifacts/stage-seven-platform-java-real-action-click-result.json');
  });
});
