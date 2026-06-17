import { describe, expect, it } from 'vitest';
import type { Rfq } from './procurementModel';
import {
  canCreateOrderFromAward,
  canSubmitAwardApproval,
  selectRecommendedQuote,
} from './buyerWorkflow';

const baseRfq: Rfq = {
  id: 'rfq-001',
  tenantId: 'tenant-acme',
  demandIds: ['dem-001'],
  title: '办公设备询价',
  status: '报价中',
  deadline: '2026-07-01T18:00:00+08:00',
  owner: 'user-buyer-owner',
  invitedSupplierIds: ['supplier-a', 'supplier-b', 'supplier-c'],
  quotes: [],
};

describe('buyer workflow helpers', () => {
  it('recommends the lowest quote and uses delivery days as the tie breaker', () => {
    const recommended = selectRecommendedQuote({
      ...baseRfq,
      quotes: [
        {
          id: 'quote-a',
          rfqId: baseRfq.id,
          tenantId: baseRfq.tenantId,
          supplierId: 'supplier-a',
          amount: 118000,
          taxRate: 13,
          deliveryDays: 5,
          status: '已提交',
        },
        {
          id: 'quote-b',
          rfqId: baseRfq.id,
          tenantId: baseRfq.tenantId,
          supplierId: 'supplier-b',
          amount: 98000,
          taxRate: 13,
          deliveryDays: 9,
          status: '已提交',
        },
        {
          id: 'quote-c',
          rfqId: baseRfq.id,
          tenantId: baseRfq.tenantId,
          supplierId: 'supplier-c',
          amount: 98000,
          taxRate: 13,
          deliveryDays: 6,
          status: '已提交',
        },
      ],
    });

    expect(recommended?.id).toBe('quote-c');
  });

  it('allows award approval only before an RFQ has been awarded', () => {
    expect(canSubmitAwardApproval({ ...baseRfq, quotes: [] })).toBe(false);
    expect(canSubmitAwardApproval({ ...baseRfq, quotes: [{
      id: 'quote-a',
      rfqId: baseRfq.id,
      tenantId: baseRfq.tenantId,
      supplierId: 'supplier-a',
      amount: 118000,
      taxRate: 13,
      deliveryDays: 5,
      status: '已提交',
    }]})).toBe(true);
    expect(canSubmitAwardApproval({
      ...baseRfq,
      status: '已定标',
      awardedSupplierId: 'supplier-a',
      quotes: [{
        id: 'quote-a',
        rfqId: baseRfq.id,
        tenantId: baseRfq.tenantId,
        supplierId: 'supplier-a',
        amount: 118000,
        taxRate: 13,
        deliveryDays: 5,
        status: '已提交',
      }],
    })).toBe(false);
  });

  it('allows order creation only after award approval and before an order exists', () => {
    const awardedRfq: Rfq = {
      ...baseRfq,
      status: '已定标',
      awardedSupplierId: 'supplier-a',
    };

    expect(canCreateOrderFromAward(awardedRfq, 'award-001', [])).toBe(true);
    expect(canCreateOrderFromAward(awardedRfq, undefined, [])).toBe(false);
    expect(canCreateOrderFromAward(awardedRfq, 'award-001', [{
      id: 'po-001',
      tenantId: baseRfq.tenantId,
      supplierId: 'supplier-a',
      rfqId: baseRfq.id,
      amount: 118000,
      status: '待供应商确认',
      expectedReceiptDate: '2026-07-10',
    }])).toBe(false);
  });
});
