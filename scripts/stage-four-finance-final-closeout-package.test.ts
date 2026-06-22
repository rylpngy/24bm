import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four finance final closeout package', () => {
  it('documents the final finance closeout package with demo paths, boundaries, and evidence', () => {
    const docPath = 'docs/stage-four-finance-final-closeout-package.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四财务最终收口包');
    expect(doc).toContain('最终验收结论');
    expect(doc).toContain('付款前控制');
    expect(doc).toContain('付款批次');
    expect(doc).toContain('执行登记');
    expect(doc).toContain('归档冻结');
    expect(doc).toContain('归档异常');
    expect(doc).toContain('演示路径');
    expect(doc).toContain('发票付款 → 三单匹配 → 差异处理 → 付款申请');
    expect(doc).toContain('付款申请 → 付款批次 → 批次审批 → 执行记录');
    expect(doc).toContain('执行记录登记 → 归档门禁 → 归档审计面板');
    expect(doc).toContain('已归档批次 → 冻结反馈 → 审计查看');
    expect(doc).toContain('已归档批次 → 归档异常申请 → 审批 → 受控处理 → 关闭复核');
    expect(doc).toContain('不得误读为真实支付系统');
    expect(doc).toContain('不接真实支付、银企直连、批量付款执行、税控开票或银行回单');
    expect(doc).toContain('不直接解冻或改写已归档付款批次');
    expect(doc).toContain('docs/stage-four-finance-closeout-review.md');
    expect(doc).toContain('docs/stage-four-payment-archive-closeout-review.md');
    expect(doc).toContain('docs/stage-four-payment-archive-exception-closeout-review.md');
    expect(doc).toContain('docs/stage-four-finance-acceptance-matrix.md');
    expect(doc).toContain('docs/stage-five-entry-decision.md');
  });

  it('records final acceptance commands and aligns the matrix plus checklist', () => {
    const doc = read('docs/stage-four-finance-final-closeout-package.md');
    const matrix = read('docs/stage-four-finance-acceptance-matrix.md');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(doc).toContain(
      'npm test -- scripts/stage-four-finance-final-closeout-package.test.ts scripts/stage-four-finance-acceptance-matrix.test.ts scripts/stage-four-finance-closeout-review.test.ts scripts/stage-four-payment-archive-closeout-review.test.ts scripts/stage-four-payment-archive-exception-closeout-review.test.ts',
    );
    expect(doc).toContain('npm test');
    expect(doc).toContain('npm run build');
    expect(doc).toContain('npm run java:smoke');
    expect(doc).toContain('JAVA_API_BASE_URL=http://localhost:18080 npm run java:smoke');
    expect(doc).toContain('git diff --check');

    expect(matrix).toContain('docs/stage-four-finance-final-closeout-package.md');
    expect(matrix).toContain('阶段四财务最终收口包');
    expect(checklist).toContain('| 91 | 阶段四财务最终收口包 |');
    expect(checklist).toContain('第91轮已把付款前控制、付款批次、执行登记、归档冻结和归档异常统一整理为最终验收包');
    expect(checklist).toContain('docs/stage-four-finance-final-closeout-package.md');
    expect(checklist).toContain('scripts/stage-four-finance-final-closeout-package.test.ts');
  });
});
