import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier quote actions UI', () => {
  it('wires supplier RFQ quote submission to the Java API client', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('submitSupplierQuote');
    expect(app).toContain('supplierActionBusyId');
    expect(app).toContain('submitSupplierQuote');
    expect(app).toContain('onSubmitQuote');
    expect(app).toContain('提交报价');
    expect(app).toContain('报价已提交');
    expect(app).toContain('hasMyQuote');
    expect(app).toContain('amount: 118000');
    expect(app).toContain('taxRate: 13');
    expect(app).toContain('deliveryDays: 7');
  });
});
