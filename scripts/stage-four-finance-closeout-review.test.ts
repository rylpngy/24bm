import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four finance closeout review', () => {
  it('documents the stage-four finance closeout boundary and evidence', () => {
    const docPath = 'docs/stage-four-finance-closeout-review.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四财务深化收口复核');
    expect(doc).toContain('验收结论');
    expect(doc).toContain('第1轮到第71轮');
    expect(doc).toContain('三单匹配、差异处理、付款申请、付款批次、执行记录、阻断处理和登记后复核');
    expect(doc).toContain('已完成能力');
    expect(doc).toContain('完成度矩阵');
    expect(doc).toContain('真实闭环');
    expect(doc).toContain('入口/只读/提示');
    expect(doc).toContain('尚未接真实支付、批量付款执行和银企直连');
    expect(doc).toContain('付款阻断处理状态只影响复核提示，不自动编排付款、三单或差异状态');
    expect(doc).toContain('下一轮建议');
    expect(doc).toContain('优先继续做财务动作闭环');
    expect(doc).toContain('scripts/payment-batch-resolution-context-link-ui.test.ts');
    expect(doc).toContain('scripts/payment-batch-registration-review-summary-ui.test.ts');
    expect(doc).toContain('scripts/stage-four-java-visual-check.test.ts');
    expect(doc).toContain('npm test');
  });

  it('records the fiftieth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第50轮');
    expect(checklist).toContain('阶段四财务深化小验收');
    expect(checklist).toContain('docs/stage-four-finance-closeout-review.md');
    expect(checklist).toContain('scripts/stage-four-finance-closeout-review.test.ts');
  });
});
