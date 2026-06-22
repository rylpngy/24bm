import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve platform operations demo loop UI', () => {
  it('adds a platform operations demo loop panel for the three platform storylines', () => {
    const app = read('App.tsx');

    expect(app).toContain('stage12-platform-operations-demo-loop');
    expect(app).toContain('PlatformOperationsDemoLoopPanel');
    expect(app).toContain('buildPlatformOperationsDemoLoopItems');
    expect(app).toContain('platformOperationsDemoLoopItems');
    expect(app).toContain('workflowStatus={workflowStatus}');
  });

  it('explains the platform demo loop with before-after feedback and governance boundaries', () => {
    const app = read('App.tsx');

    [
      '租户治理',
      '企业审核',
      '平台公告',
      '停用租户',
      '升级专业版',
      '通过企业审核',
      '发布平台公告',
      '撤回平台公告',
      '治理对象',
      '点前检查',
      '点击后反馈',
      '后续流向',
      '运营边界',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('links platform demo loop guidance to visible stage seven real-action buttons', () => {
    const app = read('App.tsx');

    [
      'stage7-platform-disable-tenant-tenant-stage7-platform-action',
      'stage7-platform-upgrade-plan-tenant-stage7-platform-action',
      'stage7-platform-approve-review-ent-stage7-platform-review-ready',
      'stage7-platform-publish-announcement',
      'stage7-platform-withdraw-announcement-announcement-stage7-platform-withdraw-ready',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('records the platform operations increment in the stage twelve checklist', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 7 | 平台运营端演示深化第一轮 |');
    expect(checklist).toContain('租户治理、企业审核、平台公告');
    expect(checklist).toContain('scripts/stage-twelve-platform-operations-demo-loop-ui.test.ts');
    expect(checklist).toContain('下一轮建议：平台运营端视觉验收');
  });
});
