import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier profile card UI', () => {
  it('renders supplier profile as structured cards with qualification and collaboration context', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierOpportunityResponseSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('SupplierProfileSummaryPanel');
    expect(supplierWorkspace).toContain('SupplierProfileCapabilityCard');
    expect(supplierWorkspace).toContain('供应商档案摘要');
    expect(supplierWorkspace).toContain('企业档案卡片');
    expect(supplierWorkspace).toContain('认证状态');
    expect(supplierWorkspace).toContain('合作采购方');
    expect(supplierWorkspace).toContain('资质维护');
    expect(supplierWorkspace).toContain('联系人与子账号');
    expect(supplierWorkspace).toContain('workspace.connectedBuyerNames.length');
    expect(supplierWorkspace).toContain('workspace.supplier.verified');
  });
});
