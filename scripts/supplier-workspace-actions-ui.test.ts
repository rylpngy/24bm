import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier workspace Java actions UI', () => {
  it('wires supplier order, delivery, and invoice actions to the Java API client', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('confirmSupplierOrder');
    expect(apiClient).toContain('createSupplierDelivery');
    expect(apiClient).toContain('createSupplierInvoice');
    expect(app).toContain('supplierActionBusyId');
    expect(app).toContain('confirmSupplierOrder');
    expect(app).toContain('createSupplierDelivery');
    expect(app).toContain('createSupplierInvoice');
    expect(app).toContain('确认订单');
    expect(app).toContain('提交发货');
    expect(app).toContain('提交发票');
    expect(app).toContain(`order.status === '待供应商确认'`);
    expect(app).toContain(`order.status === '待发货'`);
    expect(app).toContain(`order.status === '已收货'`);
  });
});
