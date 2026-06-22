import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four finance acceptance matrix', () => {
  it('documents a product-level acceptance matrix for the whole finance domain', () => {
    const docPath = 'docs/stage-four-finance-acceptance-matrix.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四财务域总体验收矩阵');
    expect(doc).toContain('验收结论');
    expect(doc).toContain('可作为阶段四财务协同域的阶段性封版基线');
    expect(doc).toContain('验收矩阵');
    expect(doc).toContain('| 三单匹配 |');
    expect(doc).toContain('| 差异处理 |');
    expect(doc).toContain('| 付款申请 |');
    expect(doc).toContain('| 付款批次 |');
    expect(doc).toContain('| 执行记录 |');
    expect(doc).toContain('| 阻断处理 |');
    expect(doc).toContain('| 归档冻结 |');
    expect(doc).toContain('| 归档异常 |');
    expect(doc).toContain('已归档付款批次可提交归档异常申请、生成审批任务、回写审批结果、登记受控处理并关闭复核');
    expect(doc).toContain('封版判断');
    expect(doc).toContain('可以封版');
    expect(doc).toContain('必须保留边界');
    expect(doc).toContain('不接真实支付、银企直连、税控开票、银行回单、批量付款执行');
    expect(doc).toContain('付款阻断处理状态不自动编排付款、三单或差异状态');
    expect(doc).toContain('下阶段入口');
    expect(doc).toContain('付款归档异常设计');
    expect(doc).toContain('真实支付前置设计');
    expect(doc).toContain('批次审批增强');
    expect(doc).toContain('验收命令');
    expect(doc).toContain('npm test -- scripts/stage-four-finance-acceptance-matrix.test.ts');
    expect(doc).toContain('npm test');
    expect(doc).toContain('npm run java:smoke');
    expect(doc).toContain('JAVA_API_BASE_URL=http://localhost:18080 npm run java:smoke');
    expect(doc).toContain('node scripts/stage-four-java-visual-check.mjs');
    expect(doc).toContain('git diff --check');
  });

  it('links the matrix to the existing closeout documents and checklist', () => {
    const doc = read('docs/stage-four-finance-acceptance-matrix.md');

    expect(doc).toContain('docs/stage-four-finance-closeout-review.md');
    expect(doc).toContain('docs/stage-four-payment-archive-closeout-review.md');
    expect(doc).toContain('docs/stage-four-payment-archive-exception-closeout-review.md');
    expect(doc).toContain('docs/stage-four-finance-final-closeout-package.md');
    expect(doc).toContain('docs/stage-four-finance-deepening-checklist.md');
    expect(doc).toContain('docs/stage-four-java-visual-walkthrough-result.md');
    expect(doc).toContain('docs/artifacts/stage-four-java-visual-check-result.json');

    const checklist = read('docs/stage-four-finance-deepening-checklist.md');
    expect(checklist).toContain('| 81 | 阶段四财务域总体验收矩阵 |');
    expect(checklist).toContain('第81轮已把三单匹配、差异处理、付款申请、付款批次、执行记录、阻断处理和归档冻结统一整理为产品级验收矩阵');
    expect(checklist).toContain('docs/stage-four-finance-acceptance-matrix.md');
    expect(checklist).toContain('scripts/stage-four-finance-acceptance-matrix.test.ts');
    expect(checklist).toContain('| 90 | 付款归档异常收口复盘 |');
    expect(checklist).toContain('| 91 | 阶段四财务最终收口包 |');
  });
});
