import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six RFQ invitation state guard', () => {
  it('guards RFQ invite supplier list before create or update writes supplier invitations', () => {
    const policy = read('backend-java/src/main/java/com/procurement/sourcing/domain/RfqSupplierInvitationPolicy.java');
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/RfqApplicationService.java');
    const policyTest = read('backend-java/src/test/java/com/procurement/RfqSupplierInvitationPolicyTests.java');
    const updateTest = read('backend-java/src/test/java/com/procurement/RfqUpdateQuotingTests.java');

    expect(policy).toContain('requireValidInviteList');
    expect(policy).toContain('RFQ requires at least one invited supplier');
    expect(policy).toContain('RFQ cannot invite the same supplier more than once');
    expect(service).toContain('RfqSupplierInvitationPolicy.requireValidInviteList(supplierIds)');
    expect(service.indexOf('RfqSupplierInvitationPolicy.requireValidInviteList(supplierIds)')).toBeLessThan(
      service.indexOf('RfqSupplierInvitationPolicy.requireAdmittedSupplier'),
    );
    expect(policyTest).toContain('rejectsEmptyOrDuplicatedRfqInviteSupplierList');
    expect(updateTest).toContain('rejectsDuplicatedInvitedSuppliersBeforeReplacingExistingInvites');
    expect(updateTest).toContain('verify(rfqInviteMapper, never()).deleteByRfq');
  });

  it('records the sixth stage-six increment without claiming the full RFQ state machine is complete', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 6 | RFQ 供应商邀请列表状态保护 |');
    expect(checklist).toContain('至少一家供应商');
    expect(checklist).toContain('不能重复邀请同一家供应商');
    expect(checklist).toContain('scripts/stage-six-rfq-invitation-state-guard.test.ts');
    expect(checklist).toContain('阶段七建议入口：优先做 Java 模式真实演示闭环、页面细节修复和主流程演示路径固化');
  });
});
