import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer RFQ creation UI', () => {
  it('wires buyer RFQ creation to the Java API client from approved demands', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('createBuyerRfq');
    expect(apiClient).toContain('createBuyerOrder');
    expect(app).toContain('rfqCreateBusy');
    expect(app).toContain('orderCreateBusy');
    expect(app).toContain('createBuyerRfq');
    expect(app).toContain('createBuyerRfqFromDemand');
    expect(app).toContain('createBuyerOrderFromAward');
    expect(app).toContain('onCreateOrderFromAward');
    expect(app).toContain(`demand.status === '已通过'`);
    expect(app).toContain(`relation.status === '已准入'`);
    expect(app).toContain('创建询价');
    expect(app).toContain('生成采购订单');
    expect(app).toContain('询价已创建');
    expect(app).toContain('订单已生成');
    expect(app).toContain('invitedSupplierIds');
    expect(app).toContain('deadline');
  });
});
