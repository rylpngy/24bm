import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier opportunity response summary UI', () => {
  it('summarizes RFQ invitations and quote response state for suppliers', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierOpportunityResponseSummaryPanel');
    expect(supplierWorkspace).toContain('商机响应摘要');
    expect(supplierWorkspace).toContain('邀请总数');
    expect(supplierWorkspace).toContain('待报价');
    expect(supplierWorkspace).toContain('已报价');
    expect(supplierWorkspace).toContain('最近截止');
    expect(supplierWorkspace).toContain('下一步');
    expect(supplierWorkspace).toContain("rfq.status === '报价中'");
    expect(supplierWorkspace).toContain('quote.supplierId === supplierId');
  });
});
