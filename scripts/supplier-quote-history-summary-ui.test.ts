import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier quote history summary UI', () => {
  it('summarizes quote history and renders quote cards with RFQ context', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const HeroBand'),
    );

    expect(supplierWorkspace).toContain('SupplierQuoteHistorySummaryPanel');
    expect(supplierWorkspace).toContain('SupplierQuoteHistoryCard');
    expect(supplierWorkspace).toContain('报价历史摘要');
    expect(supplierWorkspace).toContain('报价总数');
    expect(supplierWorkspace).toContain('已提交');
    expect(supplierWorkspace).toContain('报价总额');
    expect(supplierWorkspace).toContain('平均交付');
    expect(supplierWorkspace).toContain('等待定标');
    expect(supplierWorkspace).toContain('关联询价');
    expect(supplierWorkspace).toContain('报价金额');
    expect(supplierWorkspace).toContain('税率');
    expect(supplierWorkspace).toContain('交付周期');
    expect(supplierWorkspace).toContain('rfq.status');
    expect(supplierWorkspace).toContain('workspace.opportunities.find((rfq) => rfq.id === quote.rfqId)');
  });
});
