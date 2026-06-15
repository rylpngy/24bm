import { describe, expect, it } from 'vitest';
import { createBackendContext, ForbiddenError, NotFoundError, ValidationError } from './procurementBackend';

describe('procurement backend skeleton', () => {
  it('creates tenant-scoped demands and submits them for approval', () => {
    const backend = createBackendContext();
    const buyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');

    const demand = backend.demands.create(buyer, {
      title: '研发中心显示器采购',
      department: '研发中心',
      requester: '赵研发',
      budget: 96000,
      lineItems: [{ materialId: 'mat-acme-1', quantity: 4 }],
    });
    const approval = backend.demands.submit(buyer, demand.id);

    expect(demand.tenantId).toBe('tenant-acme');
    expect(demand.status).toBe('草稿');
    expect(approval.status).toBe('待审批');
    expect(backend.demands.list(buyer).map((item) => item.id)).toContain(demand.id);
  });

  it('prevents buyer users from reading another tenant workspace', () => {
    const backend = createBackendContext();
    const acmeBuyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');

    expect(() => backend.demands.get(acmeBuyer, 'dem-nova-1')).toThrow(NotFoundError);
    expect(() => backend.auth.asBuyer('tenant-nova', 'u-acme-admin')).toThrow(ForbiddenError);
  });

  it('creates RFQs only from approved tenant demands and approved supplier relations', () => {
    const backend = createBackendContext();
    const buyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');

    const rfq = backend.rfqs.create(buyer, {
      title: '会议设备补充询价',
      demandIds: ['dem-acme-1'],
      invitedSupplierIds: ['supplier-orbit', 'supplier-lumen'],
      deadline: '2026-07-15',
    });

    expect(rfq.tenantId).toBe('tenant-acme');
    expect(rfq.status).toBe('报价中');
    expect(rfq.invitedSupplierIds).toEqual(['supplier-orbit', 'supplier-lumen']);
    expect(() =>
      backend.rfqs.create(buyer, {
        title: '跨租户需求不允许',
        demandIds: ['dem-nova-1'],
        invitedSupplierIds: ['supplier-orbit'],
        deadline: '2026-07-15',
      }),
    ).toThrow(ValidationError);
  });

  it('allows invited suppliers to quote and hides other suppliers from that action', () => {
    const backend = createBackendContext();
    const buyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');
    const supplier = backend.auth.asSupplier('supplier-orbit', 'u-orbit-sales');
    const uninvitedSupplier = backend.auth.asSupplier('supplier-lumen', 'u-lumen-sales');
    const rfq = backend.rfqs.create(buyer, {
      title: '定向设备询价',
      demandIds: ['dem-acme-1'],
      invitedSupplierIds: ['supplier-orbit'],
      deadline: '2026-07-18',
    });

    const quote = backend.quotes.submit(supplier, rfq.id, {
      amount: 188000,
      taxRate: 13,
      deliveryDays: 9,
    });

    expect(quote.supplierId).toBe('supplier-orbit');
    expect(quote.tenantId).toBe('tenant-acme');
    expect(() =>
      backend.quotes.submit(uninvitedSupplier, rfq.id, {
        amount: 180000,
        taxRate: 13,
        deliveryDays: 10,
      }),
    ).toThrow(ForbiddenError);
  });

  it('awards a valid quote and generates a purchase order', () => {
    const backend = createBackendContext();
    const buyer = backend.auth.asBuyer('tenant-acme', 'u-acme-admin');
    const supplier = backend.auth.asSupplier('supplier-orbit', 'u-orbit-sales');
    const rfq = backend.rfqs.create(buyer, {
      title: '订单生成询价',
      demandIds: ['dem-acme-1'],
      invitedSupplierIds: ['supplier-orbit'],
      deadline: '2026-07-20',
    });
    const quote = backend.quotes.submit(supplier, rfq.id, {
      amount: 199000,
      taxRate: 13,
      deliveryDays: 12,
    });

    const award = backend.rfqs.award(buyer, rfq.id, {
      quoteId: quote.id,
      reason: '价格最低且交期满足要求',
    });
    const order = backend.orders.createFromAward(buyer, award.id, {
      expectedReceiptDate: '2026-08-01',
    });

    expect(award.supplierId).toBe('supplier-orbit');
    expect(order.amount).toBe(199000);
    expect(order.status).toBe('待供应商确认');
  });
});
