import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync('App.tsx', 'utf8');
const buyerAdminUi = readFileSync('data/buyerAdminUi.ts', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('buyer receipt shipped delivery gate UI', () => {
  it('matches Java receipt rules by requiring shipped order and shipped delivery before registration', () => {
    const orderOperationPanel = sliceBetween(app, 'const OrderDetailOperationPanel', 'const ReceiptInspectionDetailPanelView');
    const receiptOperationPanel = sliceBetween(app, 'const ReceiptInspectionOperationPanel', 'const InvoicePaymentDetailPanelView');

    expect(buyerAdminUi).toContain('hasShippedDeliveryForOrder');
    expect(buyerAdminUi).toContain("delivery.status === '已发货'");
    expect(buyerAdminUi).toContain("order.status === '已发货' && hasShippedDeliveryForOrder(workspace, order.id)");
    expect(orderOperationPanel).toContain("const canRegisterReceipt = order.status === '已发货' && detail.delivery?.status === '已发货'");
    expect(orderOperationPanel).toContain('canRegisterReceipt && receiptDraft');
    expect(orderOperationPanel).not.toContain("order.status === '已发货' || order.status === '待收货'");
    expect(receiptOperationPanel).toContain("!detail.canRegisterReceipt && order.status === '已发货'");
    expect(receiptOperationPanel).toContain('等待供应商提交有效发货记录');
  });
});
