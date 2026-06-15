import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer fulfillment actions UI', () => {
  it('wires buyer receipt and payment actions to the Java API client', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('createBuyerReceipt');
    expect(apiClient).toContain('registerBuyerPayment');
    expect(app).toContain('buyerFulfillmentBusyId');
    expect(app).toContain('createBuyerReceiptFromOrder');
    expect(app).toContain('registerBuyerInvoicePayment');
    expect(app).toContain('onCreateReceipt');
    expect(app).toContain('onRegisterPayment');
    expect(app).toContain('登记收货');
    expect(app).toContain('登记付款');
    expect(app).toContain(`order.status === '已发货'`);
    expect(app).toContain(`invoice.paymentStatus !== '已付款'`);
  });
});
