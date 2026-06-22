import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier order summary UI', () => {
  it('summarizes sales order fulfillment context beside supplier actions', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierOrderActionSummaryPanel');
    expect(supplierWorkspace).toContain('销售订单摘要');
    expect(supplierWorkspace).toContain('采购方租户');
    expect(supplierWorkspace).toContain('订单金额');
    expect(supplierWorkspace).toContain('预计收货');
    expect(supplierWorkspace).toContain('物流单号');
    expect(supplierWorkspace).toContain('发票状态');
    expect(supplierWorkspace).toContain('下一步');
    expect(supplierWorkspace).toContain("order.status === '待供应商确认'");
    expect(supplierWorkspace).toContain("delivery ? `${delivery.carrier} ${delivery.trackingNo}` : '待发货'");
  });
});
