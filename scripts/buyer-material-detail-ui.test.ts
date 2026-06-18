import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer material detail UI', () => {
  it('connects material catalog selections to a material detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');
    const materialDetailView = app.slice(
      app.indexOf('const MaterialDetailPanelView'),
      app.indexOf('const DemandCreateForm'),
    );

    expect(buyerAdminUi).toContain('buildMaterialDetailPanel');
    expect(buyerAdminUi).toContain('demandRows');
    expect(buyerAdminUi).toContain('rfqRows');
    expect(buyerAdminUi).toContain('supplierCoverageRows');
    expect(buyerAdminUi).toContain('procurementReadinessRows');

    expect(app).toContain('buildMaterialDetailPanel');
    expect(app).toContain('selectedMaterialId');
    expect(app).toContain('setSelectedMaterialId');
    expect(app).toContain('MaterialDetailPanelView');
    expect(materialDetailView).toContain('物料详情');
    expect(materialDetailView).toContain('使用概览');
    expect(materialDetailView).toContain('采购可用性');
    expect(materialDetailView).toContain('procurementReadinessRows');
    expect(materialDetailView).toContain('引用需求');
    expect(materialDetailView).toContain('关联询价');
    expect(materialDetailView).toContain('供应商覆盖');
    expect(app).toContain('查看详情');
  });
});
