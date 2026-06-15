import { describe, expect, it } from 'vitest';
import {
  buildProcurementMvpModel,
  getBuyerWorkspace,
  getSupplierWorkspace,
  getTenantKpis,
} from './procurementModel';

describe('multi-tenant procurement MVP model', () => {
  it('keeps buyer workspaces isolated by tenant while sharing platform suppliers', () => {
    const model = buildProcurementMvpModel();
    const acme = getBuyerWorkspace(model, 'tenant-acme');
    const nova = getBuyerWorkspace(model, 'tenant-nova');

    expect(acme.demands.every((demand) => demand.tenantId === 'tenant-acme')).toBe(true);
    expect(nova.demands.every((demand) => demand.tenantId === 'tenant-nova')).toBe(true);
    expect(acme.privateSupplierRelations.map((relation) => relation.supplierId)).toContain('supplier-orbit');
    expect(nova.privateSupplierRelations.map((relation) => relation.supplierId)).toContain('supplier-orbit');
    expect(acme.privateSupplierRelations.find((relation) => relation.supplierId === 'supplier-orbit')?.level).not.toBe(
      nova.privateSupplierRelations.find((relation) => relation.supplierId === 'supplier-orbit')?.level,
    );
  });

  it('represents the inquiry-to-fulfillment MVP flow for a buyer tenant', () => {
    const model = buildProcurementMvpModel();
    const workspace = getBuyerWorkspace(model, 'tenant-acme');

    expect(workspace.workflow.map((step) => step.label)).toEqual([
      '需求申请',
      '需求审批',
      '询价发布',
      '供应商报价',
      '比价定标',
      '采购订单',
      '供应商发货',
      '收货验收',
      '发票付款',
    ]);
    expect(workspace.rfqs[0].quotes).toHaveLength(3);
    expect(workspace.orders[0].status).toBe('待收货');
    expect(workspace.invoices[0].paymentStatus).toBe('待付款');
  });

  it('shows a supplier only its own opportunities, quotes, orders, and invoices across buyers', () => {
    const model = buildProcurementMvpModel();
    const supplier = getSupplierWorkspace(model, 'supplier-orbit');

    expect(supplier.connectedBuyerNames).toEqual(['星河制造集团', '诺瓦科技']);
    expect(supplier.opportunities.every((rfq) => rfq.invitedSupplierIds.includes('supplier-orbit'))).toBe(true);
    expect(supplier.quotes.every((quote) => quote.supplierId === 'supplier-orbit')).toBe(true);
    expect(supplier.orders.every((order) => order.supplierId === 'supplier-orbit')).toBe(true);
    expect(supplier.invoices.every((invoice) => invoice.supplierId === 'supplier-orbit')).toBe(true);
  });

  it('calculates tenant KPIs from the tenant-scoped business records', () => {
    const model = buildProcurementMvpModel();
    const kpis = getTenantKpis(model, 'tenant-acme');

    expect(kpis.totalSpend).toBe(286000);
    expect(kpis.pendingApprovals).toBe(3);
    expect(kpis.activeRfqs).toBe(2);
    expect(kpis.fulfillmentRate).toBe(67);
  });
});
