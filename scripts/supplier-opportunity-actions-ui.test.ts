import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier opportunity actions UI', () => {
  it('adds quote, decline, and requirement review actions for supplier RFQ invitations', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierOpportunityResponseSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('declinedOpportunityIds');
    expect(supplierWorkspace).toContain('selectedRequirementRfqId');
    expect(supplierWorkspace).toContain('onDeclineOpportunity');
    expect(supplierWorkspace).toContain('onViewRequirement');
    expect(supplierWorkspace).toContain('查看要求');
    expect(supplierWorkspace).toContain('拒绝邀请');
    expect(supplierWorkspace).toContain('已拒绝');
    expect(supplierWorkspace).toContain('采购要求');
    expect(supplierWorkspace).toContain('报价截止');
    expect(supplierWorkspace).toContain('邀请供应商');
    expect(supplierWorkspace).toContain('需求编号');
    expect(supplierWorkspace).toContain("disabled={declinedOpportunityIds.includes(rfq.id) || quoteBusy || !quoteOpen || quoteDraft.amount <= 0 || quoteDraft.deliveryDays <= 0}");
  });
});
