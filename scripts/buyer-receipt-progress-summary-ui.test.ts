import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer receipt progress summary UI', () => {
  it('surfaces receipt inspection progress summary before receipt cards', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const receiptModule = source.slice(
      source.indexOf('<Panel title="收货验收"'),
      source.indexOf('<ReceiptInspectionDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('receiptPendingShipmentCount');
    expect(buyerWorkspace).toContain('receiptPendingArrivalCount');
    expect(buyerWorkspace).toContain('receiptReadyForInspectionCount');
    expect(buyerWorkspace).toContain('receiptExceptionPendingCount');
    expect(buyerWorkspace).toContain('receiptCompletedCount');
    expect(receiptModule).toContain('收货验收推进摘要');
    expect(receiptModule).toContain('待发货');
    expect(receiptModule).toContain('待收货');
    expect(receiptModule).toContain('可登记验收');
    expect(receiptModule).toContain('异常待处理');
    expect(receiptModule).toContain('已验收');
    expect(receiptModule).toContain('先跟进供应商发货，再登记收货验收并处理异常。');
  });

  it('records the sixty fifth stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 65 | 收货验收推进摘要 |');
    expect(docs).toContain('scripts/buyer-receipt-progress-summary-ui.test.ts');
    expect(docs).toContain('收货验收推进摘要');
  });
});
