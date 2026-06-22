import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve platform real action click result', () => {
  it('records the platform real-action browser click recheck', () => {
    const path = 'docs/stage-twelve-platform-real-action-click-result.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二平台运营真实动作浏览器点击复验结果');
    expect(doc).toContain('Java 数据源');
    expect(doc).toContain('停用租户、升级专业版、通过企业审核、发布平台公告、撤回平台公告');
    expect(doc).toContain('docs/artifacts/stage-seven-platform-java-real-action-click-result.json');
    expect(doc).toContain('stage7-platform-disable-tenant-tenant-stage7-platform-action');
    expect(doc).toContain('stage7-platform-approve-review-ent-stage7-platform-review-ready');
    expect(doc).toContain('stage7-platform-withdraw-announcement-announcement-stage7-platform-withdraw-ready');
    expect(doc).toContain('失败项：0');
  });

  it('keeps the referenced browser click artifact green for five platform actions', () => {
    const artifact = JSON.parse(read('docs/artifacts/stage-seven-platform-java-real-action-click-result.json')) as {
      dataSource: string;
      passed: number;
      failed: number;
      results: Array<{
        action: string;
        module: string;
        testId: string;
        passed: boolean;
      }>;
    };

    expect(artifact.dataSource).toBe('Java');
    expect(artifact.failed).toBe(0);
    expect(artifact.passed).toBe(5);
    expect(artifact.results).toHaveLength(5);
    expect(artifact.results.map((result) => result.action)).toEqual([
      '停用租户',
      '升级专业版',
      '通过企业审核',
      '发布平台公告',
      '撤回平台公告',
    ]);
    expect(artifact.results.every((result) => result.passed)).toBe(true);
  });

  it('records the eighth stage-twelve increment in the execution checklist', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 8 | 平台真实动作浏览器点击复验 |');
    expect(checklist).toContain('停用租户、升级专业版、通过企业审核、发布平台公告、撤回平台公告');
    expect(checklist).toContain('scripts/stage-twelve-platform-real-action-click-result.test.ts');
    expect(checklist).toContain('下一轮建议：平台运营端收口验收包');
  });
});
