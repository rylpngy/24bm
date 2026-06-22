import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four payment archive closeout review', () => {
  it('documents the payment execution to archive closeout boundary and evidence', () => {
    const docPath = 'docs/stage-four-payment-archive-closeout-review.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四付款归档收口复盘');
    expect(doc).toContain('验收结论');
    expect(doc).toContain('第73轮到第79轮');
    expect(doc).toContain('专用付款执行登记入口、归档门禁、归档审计摘要、归档后只读冻结、冻结反馈、归档审计面板和 Java 视觉验收');
    expect(doc).toContain('已完成能力');
    expect(doc).toContain('完成度矩阵');
    expect(doc).toContain('真实闭环');
    expect(doc).toContain('只读审计闭环');
    expect(doc).toContain('不接真实支付、银企直连、批量付款执行、税控开票或银行回单');
    expect(doc).toContain('已归档批次除审计查看外，不允许付款申请、差异处理、执行登记或阻断处理继续写入');
    expect(doc).toContain('付款阻断处理状态仍不自动编排付款、三单或差异状态');
    expect(doc).toContain('验收证据');
    expect(doc).toContain('scripts/payment-execution-registration-transition.test.ts');
    expect(doc).toContain('scripts/payment-batch-archive-gate.test.ts');
    expect(doc).toContain('scripts/payment-batch-archive-freeze.test.ts');
    expect(doc).toContain('scripts/payment-batch-archive-audit-panel-ui.test.ts');
    expect(doc).toContain('scripts/stage-four-java-visual-check.test.ts');
    expect(doc).toContain('docs/artifacts/stage-four-java-visual-check-result.json');
    expect(doc).toContain('下一步建议');
  });

  it('records the eightieth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 80 | 付款归档收口复盘 |');
    expect(checklist).toContain('第80轮已完成第73到第79轮付款执行归档能力的阶段性复盘');
    expect(checklist).toContain('docs/stage-four-payment-archive-closeout-review.md');
    expect(checklist).toContain('scripts/stage-four-payment-archive-closeout-review.test.ts');
  });
});
