import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier order fulfillment summary UI', () => {
  it('summarizes supplier sales order workload before the order cards', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierOrderFulfillmentSummaryPanel');
    expect(supplierWorkspace).toContain('履约工作摘要');
    expect(supplierWorkspace).toContain('订单总数');
    expect(supplierWorkspace).toContain('待确认');
    expect(supplierWorkspace).toContain('待发货');
    expect(supplierWorkspace).toContain('待开票');
    expect(supplierWorkspace).toContain('应收金额');
    expect(supplierWorkspace).toContain('下一步');
    expect(supplierWorkspace).toContain("order.status === '待供应商确认'");
    expect(supplierWorkspace).toContain("order.status === '待发货'");
    expect(supplierWorkspace).toContain("order.status === '已收货'");
    expect(supplierWorkspace).toContain('!invoices.some((invoice) => invoice.orderId === order.id)');
  });
});
