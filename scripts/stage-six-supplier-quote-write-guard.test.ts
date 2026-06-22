import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six supplier quote write guard', () => {
  it('guards quote submission by RFQ deadline and duplicate write conversion', () => {
    const transition = read('backend-java/src/main/java/com/procurement/sourcing/domain/RfqSourcingStatusTransition.java');
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/QuoteApplicationService.java');
    const quoteTest = read('backend-java/src/test/java/com/procurement/SupplierQuoteListFilterTests.java');
    const transitionTest = read('backend-java/src/test/java/com/procurement/RfqSourcingStatusTransitionTests.java');

    expect(transition).toContain('requireOpenQuoteDeadline');
    expect(transition).toContain('RFQ quote deadline has passed');
    expect(service).toContain('rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfqId)');
    expect(service).toContain('rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfq.id())');
    expect(service).toContain('DuplicateKeyException');
    expect(service).toContain('RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(1, rfqId)');
    expect(quoteTest).toContain('rejectsSubmittingQuoteAfterRfqDeadline');
    expect(quoteTest).toContain('translatesConcurrentDuplicateQuoteInsertIntoBusinessError');
    expect(transitionTest).toContain('requiresOpenDeadlineForQuoteSubmission');
  });

  it('records the eighth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 8 | 供应商报价截止与重复写入保护 |');
    expect(checklist).toContain('RFQ 截止后不能提交或修改报价');
    expect(checklist).toContain('并发重复报价导致的唯一冲突转换成已提交报价的业务错误');
    expect(checklist).toContain('scripts/stage-six-supplier-quote-write-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
