import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review gap locator', () => {
  it('links archive review checklist gaps to their evidence sections', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('archiveReviewTargetSection');
    expect(buyerUi).toContain('archiveReviewLocationHint');
    expect(buyerUi).toContain('contract-approval-entry');
    expect(buyerUi).toContain('contract-attachment-evidence');
    expect(buyerUi).toContain('contract-fulfillment-event-ledger');
    expect(buyerUi).toContain('contract-payment-plan-readonly');
    expect(buyerUi).toContain('contract-audit-log-detail');

    expect(app).toContain('focusedArchiveReviewTarget');
    expect(app).toContain('archiveReviewSectionHighlightClass');
    expect(app).toContain('定位证据区块');
    expect(app).toContain('缺口定位');
    expect(app).toContain('data-review-section="contract-approval-entry"');
    expect(app).toContain('data-review-section="contract-attachment-evidence"');
    expect(app).toContain('data-review-section="contract-fulfillment-event-ledger"');
    expect(app).toContain('data-review-section="contract-payment-plan-readonly"');
    expect(app).toContain('data-review-section="contract-audit-log-detail"');

    expect(checklist).toContain('| 31 | 合同归档复核缺口定位联动 |');
    expect(walkthrough).toContain('合同归档复核缺口定位联动');
  });
});
