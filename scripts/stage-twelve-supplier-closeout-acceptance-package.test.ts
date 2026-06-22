import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve supplier closeout acceptance package', () => {
  it('records a supplier collaboration closeout package with all stage-twelve evidence', () => {
    const path = 'docs/stage-twelve-supplier-closeout-acceptance-package.md';

    expect(existsSync(path)).toBe(true);

    const doc = read(path);

    expect(doc).toContain('# 阶段十二供应商协同收口验收包');
    expect(doc).toContain('供应商协同演示 polish 第一轮');
    expect(doc).toContain('供应商协同视觉验收');
    expect(doc).toContain('供应商真实协同动作补强');
    expect(doc).toContain('供应商真实动作浏览器点击复验');
    expect(doc).toContain('docs/stage-twelve-supplier-visual-acceptance-result.md');
    expect(doc).toContain('docs/stage-twelve-supplier-real-action-click-result.md');
    expect(doc).toContain('docs/artifacts/stage-seven-supplier-java-real-action-click-result.json');
  });

  it('states demo readiness, remaining entry-only capabilities, and out-of-scope production items', () => {
    const doc = read('docs/stage-twelve-supplier-closeout-acceptance-package.md');

    [
      '已可演示',
      '仍是入口能力',
      '暂不做生产化能力',
      '询价邀请、报价记录、销售订单、发票应收、企业档案',
      '提交报价、确认订单、提交发货、提交发票、保存对账备注',
      '页面组合：10',
      '失败项：0',
      'Java 数据源',
      '不等同于完整供应商门户',
    ].forEach((copy) => {
      expect(doc).toContain(copy);
    });
  });

  it('updates the stage twelve checklist with the closeout package and next domain recommendation', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 6 | 供应商协同收口验收包 |');
    expect(checklist).toContain('docs/stage-twelve-supplier-closeout-acceptance-package.md');
    expect(checklist).toContain('scripts/stage-twelve-supplier-closeout-acceptance-package.test.ts');
    expect(checklist).toContain('下一轮建议：平台运营端演示深化');
  });
});
