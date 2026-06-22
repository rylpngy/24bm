import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve supplier visual acceptance result', () => {
  it('records supplier collaboration visual acceptance across desktop and mobile', () => {
    const path = 'docs/stage-twelve-supplier-visual-acceptance-result.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二供应商协同视觉验收结果');
    expect(doc).toContain('Java 数据源');
    expect(doc).toContain('覆盖视口：desktop-1280x720、mobile-390x844');
    expect(doc).toContain('页面组合：10');
    expect(doc).toContain('失败项：0');
    expect(doc).toContain('console error 为 0');
    expect(doc).toContain('无整页横向溢出');
  });

  it('covers the five supplier collaboration modules and stage twelve panels', () => {
    const doc = read('docs/stage-twelve-supplier-visual-acceptance-result.md');

    [
      '询价邀请',
      '报价记录',
      '销售订单',
      '发票应收',
      '企业档案',
      'stage12-supplier-collaboration-operation-strip',
      'stage12-supplier-first-screen-focus',
      'stage12-supplier-action-visibility',
      'stage12-supplier-demo-data-slimming',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('updates the stage twelve checklist with the visual acceptance increment', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 3 | 供应商协同视觉验收 |');
    expect(checklist).toContain('docs/stage-twelve-supplier-visual-acceptance-result.md');
    expect(checklist).toContain('scripts/stage-twelve-supplier-visual-acceptance-result.test.ts');
    expect(checklist).toContain('下一轮建议：进入供应商真实协同动作补强');
  });
});
