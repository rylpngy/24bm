import { describe, expect, it } from 'vitest';
import type { Rfq } from './procurementModel';
import {
  canCreateOrderFromAward,
  canSubmitAwardApproval,
  describeInvoiceNextAction,
  describeOrderNextAction,
  describeRfqNextAction,
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

  it('keeps the awarded quote as the recommendation after quote closeout', () => {
    const recommended = selectRecommendedQuote({
      ...baseRfq,
      status: '已定标',
      awardedSupplierId: 'supplier-a',
      quotes: [
        {
          id: 'quote-a',
          rfqId: baseRfq.id,
          tenantId: baseRfq.tenantId,
          supplierId: 'supplier-a',
          amount: 118000,
          taxRate: 13,
          deliveryDays: 5,
          status: '已中选',
        },
        {
          id: 'quote-b',
          rfqId: baseRfq.id,
          tenantId: baseRfq.tenantId,
          supplierId: 'supplier-b',
          amount: 98000,
          taxRate: 13,
          deliveryDays: 6,
          status: '未中选',
        },
      ],
    });

    expect(recommended?.id).toBe('quote-a');
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
      quotes: [{
        id: 'quote-a',
        rfqId: baseRfq.id,
        tenantId: baseRfq.tenantId,
        supplierId: 'supplier-a',
        amount: 118000,
        taxRate: 13,
        deliveryDays: 5,
        status: '已中选',
      }],
    };

    expect(canCreateOrderFromAward(awardedRfq, 'award-001', [])).toBe(true);
    expect(canCreateOrderFromAward(awardedRfq, undefined, [])).toBe(false);
    expect(canCreateOrderFromAward({ ...awardedRfq, quotes: [{ ...awardedRfq.quotes[0], status: '已锁定' }] }, 'award-001', [])).toBe(false);
    expect(canCreateOrderFromAward({ ...awardedRfq, status: '定标审批中' }, 'award-001', [])).toBe(false);
    expect(canCreateOrderFromAward({ ...awardedRfq, awardedSupplierId: 'supplier-b' }, 'award-001', [])).toBe(false);
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

  it('describes the next RFQ action for buyer comparison cards', () => {
    expect(describeRfqNextAction({ ...baseRfq, quotes: [] }, undefined, [])).toEqual({
      title: '等待供应商报价',
      detail: '收到有效报价后，可按推荐报价提交定标审批。',
      tone: 'slate',
    });

    expect(describeRfqNextAction({
      ...baseRfq,
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
    }, undefined, [])).toEqual({
      title: '可提交定标审批',
      detail: '系统已按价格和交期推荐报价，提交后进入定标审批。',
      tone: 'blue',
    });

    expect(describeRfqNextAction({ ...baseRfq, status: '定标审批中' }, undefined, [])).toEqual({
      title: '定标审批中',
      detail: '审批通过后可生成采购订单。',
      tone: 'amber',
    });
  });

  it('describes fulfillment and payment next actions', () => {
    expect(describeOrderNextAction({
      id: 'po-001',
      tenantId: baseRfq.tenantId,
      supplierId: 'supplier-a',
      rfqId: baseRfq.id,
      amount: 118000,
      status: '已发货',
      expectedReceiptDate: '2026-07-10',
    })).toEqual({
      title: '待采购方收货',
      detail: '供应商已发货，可登记收货验收。',
      tone: 'emerald',
    });

    expect(describeInvoiceNextAction({
      id: 'inv-001',
      tenantId: baseRfq.tenantId,
      supplierId: 'supplier-a',
      orderId: 'po-001',
      amount: 118000,
      paymentStatus: '待付款',
    })).toEqual({
      title: '待登记付款',
      detail: '确认付款信息后，可登记付款状态。',
      tone: 'blue',
    });
  });
});
