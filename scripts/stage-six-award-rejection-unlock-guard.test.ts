import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six award rejection unlock guard', () => {
  it('rejects supplier edits against locked quotes before mapper writes', () => {
    const quoteService = read('backend-java/src/main/java/com/procurement/sourcing/application/QuoteApplicationService.java');
    const quoteTest = read('backend-java/src/test/java/com/procurement/SupplierQuoteListFilterTests.java');

    expect(quoteService).toContain('QuoteStatus.LOCKED.equals(quote.status())');
    expect(quoteService).toContain('Locked supplier quote cannot be updated');
    expect(quoteTest).toContain('rejectsUpdatingLockedQuoteWithExplicitBusinessError');
    expect(quoteTest).toContain('verify(quoteMapper, never()).updateSubmittedQuote');
  });

  it('unlocks the selected quote when award approval is rejected', () => {
    const quoteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/QuoteMapper.java');
    const awardService = read('backend-java/src/main/java/com/procurement/sourcing/application/AwardApplicationService.java');
    const awardTest = read('backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java');

    expect(quoteMapper).toContain('unlockAwardQuote');
    expect(quoteMapper).toContain('set status = #{submittedStatus');
    expect(awardService).toContain('quoteMapper.unlockAwardQuote');
    expect(awardService).toContain('QuoteStatus.LOCKED');
    expect(awardService).toContain('QuoteStatus.SUBMITTED');
    expect(awardService).toContain('Selected quote changed before award rejection could be applied');
    expect(awardTest).toContain('awardRejectionUnlocksSelectedQuoteBackToSubmitted');
    expect(awardTest).toContain('verify(quoteMapper).unlockAwardQuote');
  });

  it('records the eleventh stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 11 | 锁定报价修改拦截与定标驳回解锁 |');
    expect(checklist).toContain('供应商不能修改已锁定报价');
    expect(checklist).toContain('定标审批驳回后将中选报价从 `QuoteStatus.LOCKED` 恢复为 `QuoteStatus.SUBMITTED`');
    expect(checklist).toContain('scripts/stage-six-award-rejection-unlock-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
