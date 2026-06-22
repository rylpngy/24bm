import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer workflow status filters UI', () => {
  it('adds reusable status filters to buyer demand, RFQ, order, receipt, and invoice workflow lists', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );

    expect(app).toContain('const StatusFilterControl');
    expect(app).toContain('statusOptions: string[]');
    expect(app).toContain('全部状态');

    expect(buyerWorkspace).toContain('demandStatusFilter');
    expect(buyerWorkspace).toContain('rfqStatusFilter');
    expect(buyerWorkspace).toContain('orderStatusFilter');
    expect(buyerWorkspace).toContain('receiptStatusFilter');
    expect(buyerWorkspace).toContain('invoiceStatusFilter');

    expect(buyerWorkspace).toContain('需求状态');
    expect(buyerWorkspace).toContain('询价状态');
    expect(buyerWorkspace).toContain('订单状态');
    expect(buyerWorkspace).toContain('收货状态');
    expect(buyerWorkspace).toContain('付款状态');

    expect(buyerWorkspace).toContain('demandRow.status === demandStatusFilter');
    expect(buyerWorkspace).toContain('rfq.status === rfqStatusFilter');
    expect(buyerWorkspace).toContain('orderRow.status === orderStatusFilter');
    expect(buyerWorkspace).toContain('orderRow.status === receiptStatusFilter');
    expect(buyerWorkspace).toContain('invoiceRow.status === invoiceStatusFilter');
  });

  it('makes the reusable status filter accessible and stable on narrow screens', () => {
    const app = read('App.tsx');
    const statusFilter = app.slice(
      app.indexOf('const StatusFilterControl'),
      app.indexOf('const ResponsiveTableFrame'),
    );

    expect(statusFilter).toContain('aria-label={`${label}筛选器`}');
    expect(statusFilter).toContain('可选 {statusOptions.length} 项');
    expect(statusFilter).toContain('flex-col');
    expect(statusFilter).toContain('sm:flex-row');
    expect(statusFilter).toContain('min-w-[12rem]');
    expect(statusFilter).toContain('w-full');
    expect(statusFilter).toContain('sm:w-auto');
  });

  it('adds status or type filters to buyer approval, supplier, material, and audit lists', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );
    const auditLogList = app.slice(
      app.indexOf('const AuditLogList'),
      app.indexOf('const AuditLogDetailPanelView'),
    );

    expect(buyerWorkspace).toContain('approvalStatusFilter');
    expect(buyerWorkspace).toContain('supplierStatusFilter');
    expect(buyerWorkspace).toContain('materialStatusFilter');
    expect(auditLogList).toContain('auditTargetFilter');

    expect(buyerWorkspace).toContain('审批状态');
    expect(buyerWorkspace).toContain('合作状态');
    expect(buyerWorkspace).toContain('物料状态');
    expect(auditLogList).toContain('对象类型');

    expect(buyerWorkspace).toContain('row.status === approvalStatusFilter');
    expect(buyerWorkspace).toContain('relationRow.status === supplierStatusFilter');
    expect(buyerWorkspace).toContain('material.status === materialStatusFilter');
    expect(auditLogList).toContain('log.targetLabel === auditTargetFilter');
  });
});
