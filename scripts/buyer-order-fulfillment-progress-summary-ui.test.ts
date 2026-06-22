import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = () => readFileSync('App.tsx', 'utf8');
const checklist = () => readFileSync('docs/stage-three-round-two-execution-checklist.md', 'utf8');

describe('buyer order fulfillment progress summary UI', () => {
  it('surfaces order fulfillment progress summary before order cards', () => {
    const source = app();
    const buyerWorkspace = source.slice(
      source.indexOf('const BuyerWorkspaceView'),
      source.indexOf('const DemandDetailPanelView'),
    );
    const orderModule = source.slice(
      source.indexOf('<Panel title="订单履约"'),
      source.indexOf('<OrderDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('orderPendingGenerationCount');
    expect(buyerWorkspace).toContain('orderPendingSupplierConfirmCount');
    expect(buyerWorkspace).toContain('orderPendingShipmentCount');
    expect(buyerWorkspace).toContain('orderPendingReceiptCount');
    expect(buyerWorkspace).toContain('orderFulfillmentCompletedCount');
    expect(orderModule).toContain('订单履约推进摘要');
    expect(orderModule).toContain('待生成订单');
    expect(orderModule).toContain('待供应商确认');
    expect(orderModule).toContain('待发货');
    expect(orderModule).toContain('待收货');
    expect(orderModule).toContain('已完成');
    expect(orderModule).toContain('先生成采购订单，再跟进供应商确认、发货和收货验收。');
  });

  it('records the sixty fourth stage-three buyer flow increment in the checklist', () => {
    const docs = checklist();

    expect(docs).toContain('| 64 | 采购订单履约推进摘要 |');
    expect(docs).toContain('scripts/buyer-order-fulfillment-progress-summary-ui.test.ts');
    expect(docs).toContain('订单履约推进摘要');
  });
});
