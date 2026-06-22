import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four payment archive exception closeout review', () => {
  it('documents the archive exception request chain from entry to Java smoke readback', () => {
    const docPath = 'docs/stage-four-payment-archive-exception-closeout-review.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    expect(doc).toContain('# 阶段四付款归档异常收口复盘');
    expect(doc).toContain('第82轮');
    expect(doc).toContain('第83轮');
    expect(doc).toContain('第84轮');
    expect(doc).toContain('第85轮');
    expect(doc).toContain('第86轮');
    expect(doc).toContain('第87轮');
    expect(doc).toContain('第88轮');
    expect(doc).toContain('第89轮');
    expect(doc).toContain('归档异常申请入口');
    expect(doc).toContain('付款归档异常申请 Java 台账');
    expect(doc).toContain('付款归档异常申请审批任务化');
    expect(doc).toContain('付款归档异常审批结果回写');
    expect(doc).toContain('付款归档异常受控处理入口');
    expect(doc).toContain('付款归档异常关闭复核');
    expect(doc).toContain('付款归档异常 Java smoke 闭环');
    expect(doc).toContain('已归档付款批次 → 提交归档异常申请 → 审批通过 → 登记受控处理 → 关闭复核 → 台账回查');
    expect(doc).toContain('不直接解冻或改写已归档付款批次');
    expect(doc).toContain('不接真实支付、银企直连或批量付款执行');
  });

  it('records evidence commands and keeps the stage-four checklist aligned', () => {
    const doc = read('docs/stage-four-payment-archive-exception-closeout-review.md');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(doc).toContain(
      'npm test -- scripts/java-payment-archive-exception-scaffold.test.ts scripts/payment-batch-archive-exception-entry-ui.test.ts scripts/java-local-smoke.test.ts scripts/stage-four-payment-archive-exception-closeout-review.test.ts',
    );
    expect(doc).toContain('JAVA_API_BASE_URL=http://localhost:18080 npm run java:smoke');
    expect(doc).toContain('mvn -q -Dtest=FinanceActionPaymentBlockingTests,ApprovalTaskInboxTests test');
    expect(doc).toContain('docs/stage-four-finance-acceptance-matrix.md');

    expect(checklist).toContain('| 90 | 付款归档异常收口复盘 |');
    expect(checklist).toContain('第90轮已完成付款归档异常申请链路收口复盘');
    expect(checklist).toContain('docs/stage-four-payment-archive-exception-closeout-review.md');
    expect(checklist).toContain('scripts/stage-four-payment-archive-exception-closeout-review.test.ts');
  });
});
