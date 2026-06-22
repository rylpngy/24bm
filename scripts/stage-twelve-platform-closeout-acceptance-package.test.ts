import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve platform closeout acceptance package', () => {
  it('records a platform operations closeout package with all platform evidence', () => {
    const path = 'docs/stage-twelve-platform-closeout-acceptance-package.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二平台运营端收口验收包');
    expect(doc).toContain('平台运营端演示深化第一轮');
    expect(doc).toContain('平台真实动作浏览器点击复验');
    expect(doc).toContain('docs/stage-twelve-platform-real-action-click-result.md');
    expect(doc).toContain('docs/artifacts/stage-seven-platform-java-real-action-click-result.json');
    expect(doc).toContain('scripts/stage-twelve-platform-operations-demo-loop-ui.test.ts');
    expect(doc).toContain('scripts/stage-twelve-platform-real-action-click-result.test.ts');
  });

  it('states demo readiness, remaining entry-only capabilities, and out-of-scope production items', () => {
    const doc = read('docs/stage-twelve-platform-closeout-acceptance-package.md');

    [
      '已可演示',
      '仍是入口能力',
      '暂不做生产化能力',
      '租户列表、企业审核、平台公告',
      '停用租户、升级专业版、通过企业审核、发布平台公告、撤回平台公告',
      '页面组合：6',
      '失败项：0',
      'Java 数据源',
      '不等同于完整平台运营后台',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('updates the stage twelve checklist with the platform closeout package and next recommendation', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 9 | 平台运营端收口验收包 |');
    expect(checklist).toContain('docs/stage-twelve-platform-closeout-acceptance-package.md');
    expect(checklist).toContain('scripts/stage-twelve-platform-closeout-acceptance-package.test.ts');
    expect(checklist).toContain('下一轮建议：三端演示总收口验收包');
  });
});
