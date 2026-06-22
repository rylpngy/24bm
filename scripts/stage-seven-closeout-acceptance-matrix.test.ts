import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven closeout acceptance matrix', () => {
  it('summarizes demo-ready capabilities, demo-only boundaries, and the stage-eight entry path', () => {
    const doc = read('docs/stage-seven-closeout-acceptance-matrix.md');
    const checklist = read('docs/stage-seven-execution-checklist.md');

    expect(doc).toContain('# 阶段七产品可演示收口验收矩阵');
    expect(doc).toContain('收口结论');
    expect(doc).toContain('三端现场演示总验收包');
    expect(doc).toContain('17 个真实点击动作');
    expect(doc).toContain('failedTotal = 0');

    expect(doc).toContain('已可演示');
    expect(doc).toContain('采购方询价比价闭环');
    expect(doc).toContain('供应商协同履约链路');
    expect(doc).toContain('平台运营轻量治理');

    expect(doc).toContain('仍是演示口径');
    expect(doc).toContain('真实支付');
    expect(doc).toContain('电子签章');
    expect(doc).toContain('ERP 深度集成');
    expect(doc).toContain('生产级权限矩阵');

    expect(doc).toContain('下一阶段生产化入口');
    expect(doc).toContain('阶段八建议');
    expect(doc).toContain('用户看得见的业务体验');
    expect(doc).toContain('组件抽取');
    expect(doc).toContain('权限与审计');

    expect(doc).toContain('node scripts/stage-seven-onsite-demo-acceptance-check.mjs');
    expect(doc).toContain('npm run java:smoke');
    expect(doc).toContain('npm test');
    expect(doc).toContain('npm run build');

    expect(checklist).toContain('| 28 | 阶段七产品可演示收口验收矩阵 |');
    expect(checklist).toContain('docs/stage-seven-closeout-acceptance-matrix.md');
    expect(checklist).toContain('阶段八建议入口');
  });
});
