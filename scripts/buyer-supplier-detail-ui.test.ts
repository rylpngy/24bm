import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer supplier detail UI', () => {
  it('connects supplier relation selections to a supplier detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const supplierDetailView = app.slice(
      app.indexOf('const SupplierDetailPanelView'),
      app.indexOf('const MaterialDetailPanelView'),
    );

    expect(buyerAdminUi).toContain('buildSupplierDetailPanel');
    expect(buyerAdminUi).toContain('admissionCheckRows');
    expect(buyerAdminUi).toContain('collaborationRows');
    expect(buyerAdminUi).toContain('rfqRows');
    expect(buyerAdminUi).toContain('orderRows');

    expect(app).toContain('buildSupplierDetailPanel');
    expect(app).toContain('selectedSupplierRelationId');
    expect(app).toContain('setSelectedSupplierRelationId');
    expect(app).toContain('SupplierDetailPanelView');
    expect(supplierDetailView).toContain('供应商详情');
    expect(supplierDetailView).toContain('合作关系');
    expect(supplierDetailView).toContain('准入检查');
    expect(supplierDetailView).toContain('admissionCheckRows');
    expect(supplierDetailView).toContain('协作记录');
    expect(app).toContain('查看详情');
  });
});
