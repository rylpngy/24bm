import { describe, expect, it } from 'vitest';
import type { BuyerAdminModule } from './adminNavigation';
import { buildProcurementMvpModel, getBuyerWorkspace } from './procurementModel';
import { buildBuyerModuleFacts } from './buyerAdminUi';

describe('buyer admin UI helpers', () => {
  const workspace = getBuyerWorkspace(buildProcurementMvpModel(), 'tenant-acme');
  const pendingApprovals = [
    { id: 'approval-1' },
    { id: 'approval-2' },
  ];

  it('provides compact summary facts for every buyer admin module except the dashboard', () => {
    const modules: BuyerAdminModule[] = [
      'demands',
      'approvals',
      'suppliers',
      'materials',
      'rfqs',
      'quotes',
      'orders',
      'receipts',
      'invoices',
      'audit',
    ];

    modules.forEach((module) => {
      const facts = buildBuyerModuleFacts(module, workspace, pendingApprovals);
      expect(facts.length, module).toBeGreaterThanOrEqual(3);
      expect(facts.every((fact) => fact.label.trim() && fact.value.trim()), module).toBe(true);
    });
  });

  it('highlights actionable fulfillment and finance counts for buyer operations', () => {
    expect(buildBuyerModuleFacts('receipts', workspace, pendingApprovals)).toEqual([
      { label: '待收货', value: '1 单' },
      { label: '已有物流', value: '2 条' },
      { label: '本期到货金额', value: '¥216,000' },
    ]);

    expect(buildBuyerModuleFacts('invoices', workspace, pendingApprovals)).toEqual([
      { label: '发票数量', value: '2 张' },
      { label: '待付款', value: '1 张' },
      { label: '待付金额', value: '¥216,000' },
    ]);
  });
});
