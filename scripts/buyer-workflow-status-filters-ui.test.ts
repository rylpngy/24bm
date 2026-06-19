import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer workflow status filters UI', () => {
  it('adds reusable status filters to buyer demand, RFQ, order, and invoice workflow lists', () => {
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
    expect(buyerWorkspace).toContain('invoiceStatusFilter');

    expect(buyerWorkspace).toContain('需求状态');
    expect(buyerWorkspace).toContain('询价状态');
    expect(buyerWorkspace).toContain('订单状态');
    expect(buyerWorkspace).toContain('付款状态');

    expect(buyerWorkspace).toContain('demandRow.status === demandStatusFilter');
    expect(buyerWorkspace).toContain('rfq.status === rfqStatusFilter');
    expect(buyerWorkspace).toContain('orderRow.status === orderStatusFilter');
    expect(buyerWorkspace).toContain('invoiceRow.status === invoiceStatusFilter');
  });
});
