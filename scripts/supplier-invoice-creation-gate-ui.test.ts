import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier invoice creation gate UI', () => {
  it('blocks invoice creation before receipt and prevents duplicate invoices in the app action handler', () => {
    const app = read('App.tsx');
    const handler = app.slice(
      app.indexOf('const createSupplierInvoice = async'),
      app.indexOf('const updateSupplierReceivable = async'),
    );

    expect(handler).toContain("order.status !== '已收货'");
    expect(handler).toContain('订单未完成收货验收，不能提交发票');
    expect(handler).toContain('supplierData.workspace.invoices.find((item) => item.orderId === orderId)');
    expect(handler).toContain('该订单已提交发票，不能重复开票');
    expect(handler.indexOf("setSupplierActionBusyId(`invoice:${orderId}`)"))
      .toBeGreaterThan(handler.indexOf('该订单已提交发票，不能重复开票'));
  });

  it('supports blocked process notices for business rule feedback', () => {
    const app = read('App.tsx');
    const notice = app.slice(
      app.indexOf('const processStateToneClasses'),
      app.indexOf('const describeSupplierOpportunityNextAction'),
    );

    expect(notice).toContain("blocked: 'border-amber-100 bg-amber-50 text-amber-800'");
    expect(notice).toContain("variant: 'handled' | 'waiting' | 'blocked'");
    expect(notice).toContain("variant === 'blocked' ? AlertCircle : Activity");
  });
});
