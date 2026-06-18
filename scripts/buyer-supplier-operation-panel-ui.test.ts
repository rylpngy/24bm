import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer supplier operation panel UI details', () => {
  it('summarizes admission and collaboration context beside supplier actions', () => {
    const app = read('App.tsx');
    const supplierOperationPanel = app.slice(
      app.indexOf('const SupplierDetailOperationPanel'),
      app.indexOf('const MaterialDetailPanelView'),
    );

    expect(supplierOperationPanel).toContain('关系摘要');
    expect(supplierOperationPanel).toContain('准入状态');
    expect(supplierOperationPanel).toContain('供应商等级');
    expect(supplierOperationPanel).toContain('绩效评分');
    expect(supplierOperationPanel).toContain('授权品类');
    expect(supplierOperationPanel).toContain('参与询价');
    expect(supplierOperationPanel).toContain('采购订单');
    expect(supplierOperationPanel).toContain('detail.facts.find');
    expect(supplierOperationPanel).toContain('detail.collaborationRows.find');
    expect(supplierOperationPanel).toContain('renderSupplierRelationSummary');
    expect(supplierOperationPanel.indexOf('const renderSupplierRelationSummary')).toBeLessThan(
      supplierOperationPanel.indexOf('if (!javaEnabled)'),
    );
  });
});
