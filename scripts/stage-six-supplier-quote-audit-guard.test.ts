import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six supplier quote audit guard', () => {
  it('records supplier quote submit and update actions through tenant audit logs', () => {
    const targetType = read('backend-java/src/main/java/com/procurement/audit/domain/AuditTargetType.java');
    const auditAction = read('backend-java/src/main/java/com/procurement/sourcing/domain/QuoteAuditAction.java');
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/QuoteApplicationService.java');
    const quoteTest = read('backend-java/src/test/java/com/procurement/SupplierQuoteAuditLogTests.java');

    expect(targetType).toContain('QUOTE = "quote"');
    expect(auditAction).toContain('SUBMITTED = "quote.submitted"');
    expect(auditAction).toContain('UPDATED = "quote.updated"');
    expect(service).toContain('AuditLogApplicationService');
    expect(service).toContain('QuoteAuditAction.SUBMITTED');
    expect(service).toContain('QuoteAuditAction.UPDATED');
    expect(service).toContain('AuditTargetType.QUOTE');
    expect(service).toContain('auditLogApplicationService.recordTenantAction');
    expect(quoteTest).toContain('submittingSupplierQuoteRecordsAuditLogForCreatedQuote');
    expect(quoteTest).toContain('updatingSupplierQuoteRecordsAuditLogForExistingQuote');
  });

  it('records the ninth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 9 | 供应商报价提交/修改审计 |');
    expect(checklist).toContain('供应商提交报价和修改报价成功后写入租户审计日志');
    expect(checklist).toContain('QuoteAuditAction.SUBMITTED');
    expect(checklist).toContain('QuoteAuditAction.UPDATED');
    expect(checklist).toContain('scripts/stage-six-supplier-quote-audit-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
