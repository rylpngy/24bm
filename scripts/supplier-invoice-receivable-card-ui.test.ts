import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier invoice receivable card UI', () => {
  it('renders invoice receivable cards with order, payment, and next-action context', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierInvoiceReceivableCard');
    expect(supplierWorkspace).toContain('SupplierInvoiceReceivableDetailPanel');
    expect(supplierWorkspace).toContain('发票应收卡片');
    expect(supplierWorkspace).toContain('应收对账详情');
    expect(supplierWorkspace).toContain('保存对账备注');
    expect(supplierWorkspace).toContain('receivableUpdateDrafts');
    expect(supplierWorkspace).toContain('onUpdateReceivable(invoice.id');
    expect(supplierWorkspace).toContain('关联订单');
    expect(supplierWorkspace).toContain('应收金额');
    expect(supplierWorkspace).toContain('付款状态');
    expect(supplierWorkspace).toContain('回款进度');
    expect(supplierWorkspace).toContain('下一步');
    expect(supplierWorkspace).toContain("invoice.paymentStatus === '已付款'");
    expect(supplierWorkspace).toContain("invoice.paymentStatus === '部分付款'");
    expect(supplierWorkspace).toContain('workspace.orders.find((order) => order.id === invoice.orderId)');
    expect(supplierWorkspace).toContain('currency(invoice.amount)');
  });
});
