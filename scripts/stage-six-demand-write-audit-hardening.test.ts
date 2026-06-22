import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six demand write audit hardening', () => {
  it('records submitted audit coverage in Java and stage-six checklist', () => {
    const auditAction = read('backend-java/src/main/java/com/procurement/demand/domain/PurchaseDemandAuditAction.java');
    const service = read('backend-java/src/main/java/com/procurement/demand/application/PurchaseDemandApplicationService.java');
    const javaTest = read('backend-java/src/test/java/com/procurement/PurchaseDemandAuditLogTests.java');
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(auditAction).toContain('SUBMITTED = "purchase_demand.submitted"');
    expect(service).toContain('PurchaseDemandAuditAction.SUBMITTED');
    expect(javaTest).toContain('submittingPurchaseDemandRecordsTenantScopedAuditLog');
    expect(javaTest).toContain('purchase_demand.submitted');
    expect(checklist).toContain('| 3 | 采购需求提交审批审计补强 |');
    expect(checklist).toContain('PurchaseDemandAuditLogTests');
  });
});
