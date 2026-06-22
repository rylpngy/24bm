import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six quote attachment boundary and award lock guard', () => {
  it('guards quote attachments by tenant quote ownership before writing metadata', () => {
    const service = read('backend-java/src/main/java/com/procurement/attachment/application/AttachmentApplicationService.java');
    const test = read('backend-java/src/test/java/com/procurement/AttachmentMetadataLifecycleTests.java');

    expect(service).toContain('QuoteMapper');
    expect(service).toContain('validateOwnerInTenantScope');
    expect(service).toContain('"quote".equals(ownerType)');
    expect(service).toContain('quoteMapper.findByTenantAndId(tenantId, ownerId)');
    expect(service).toContain('Quote attachment owner not found in tenant scope');
    expect(test).toContain('createQuoteAttachmentRejectsUnknownCurrentTenantQuote');
    expect(test).toContain('verify(attachmentMapper, org.mockito.Mockito.never()).insert');
  });

  it('locks the selected submitted quote before creating award approval records', () => {
    const quoteStatus = read('backend-java/src/main/java/com/procurement/sourcing/domain/QuoteStatus.java');
    const quoteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/QuoteMapper.java');
    const awardService = read('backend-java/src/main/java/com/procurement/sourcing/application/AwardApplicationService.java');
    const awardTest = read('backend-java/src/test/java/com/procurement/SourcingAwardStateTransitionTests.java');

    expect(quoteStatus).toContain('LOCKED = "已锁定"');
    expect(quoteMapper).toContain('lockSubmittedQuoteForAward');
    expect(quoteMapper).toContain('set status = #{lockedStatus');
    expect(awardService).toContain('quoteMapper.lockSubmittedQuoteForAward');
    expect(awardService).toContain('QuoteStatus.LOCKED');
    expect(awardService).toContain('Selected quote changed before award approval could be submitted');
    expect(awardTest).toContain('awardFailsWhenSelectedQuoteCannotBeLocked');
    expect(awardTest).toContain('verify(quoteMapper).lockSubmittedQuoteForAward');
  });

  it('records the tenth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 10 | 报价附件边界与定标前报价锁定 |');
    expect(checklist).toContain('`quote` 附件写入前必须绑定当前租户内真实报价');
    expect(checklist).toContain('中选报价从 `QuoteStatus.SUBMITTED` 锁定为 `QuoteStatus.LOCKED`');
    expect(checklist).toContain('scripts/stage-six-quote-attachment-and-award-lock-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
