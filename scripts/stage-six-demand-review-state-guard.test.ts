import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six demand review state guard', () => {
  it('records approval review demand-status write guard in Java and checklist', () => {
    const service = read('backend-java/src/main/java/com/procurement/demand/application/PurchaseDemandApplicationService.java');
    const javaTest = read('backend-java/src/test/java/com/procurement/PurchaseDemandApprovalStateTransitionTests.java');
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(service).toContain('int demandUpdated = purchaseDemandMapper.updateStatus');
    expect(service).toContain('Purchase demand status changed before review could be saved');
    expect(javaTest).toContain('approvalFailsWhenDemandStatusChangesBeforeReviewCanBeSaved');
    expect(javaTest).toContain('thenReturn(0)');
    expect(checklist).toContain('| 4 | 采购需求审批回写状态保护 |');
    expect(checklist).toContain('stage-six-demand-review-state-guard.test.ts');
  });
});
