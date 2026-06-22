import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment block resolution audit UI', () => {
  it('keeps Java audit actions when payment block resolutions are saved or updated', () => {
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');

    expect(service).toContain('payment_block_resolution.saved');
    expect(service).toContain('payment_block_resolution.updated');
    expect(service).toContain('AuditTargetType.PAYMENT_BATCH');
  });

  it('maps persisted handler and update time into the resolution queue card', () => {
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(ledgerPanel).toContain('blockResolutionHandledBy');
    expect(ledgerPanel).toContain('blockResolutionUpdatedAt');
    expect(ledgerPanel).toContain('javaResolution?.handledBy');
    expect(ledgerPanel).toContain('javaResolution?.updatedAt');
    expect(ledgerPanel).toContain('最近处理人');
    expect(ledgerPanel).toContain('处理时间');
    expect(ledgerPanel).toContain('formatAuditTime(row.blockResolutionUpdatedAt)');
  });

  it('records the fifty fourth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第54轮');
    expect(checklist).toContain('付款阻断处理审计信息展示');
    expect(checklist).toContain('scripts/payment-block-resolution-audit-ui.test.ts');
  });
});
