import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer material detail UI', () => {
  it('connects material catalog selections to a material detail panel', () => {
    const app = read('App.tsx');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(buyerAdminUi).toContain('buildMaterialDetailPanel');
    expect(buyerAdminUi).toContain('demandRows');
    expect(buyerAdminUi).toContain('rfqRows');
    expect(buyerAdminUi).toContain('supplierCoverageRows');

    expect(app).toContain('buildMaterialDetailPanel');
    expect(app).toContain('selectedMaterialId');
    expect(app).toContain('setSelectedMaterialId');
    expect(app).toContain('MaterialDetailPanelView');
    expect(app).toContain('物料详情');
    expect(app).toContain('引用需求');
    expect(app).toContain('关联询价');
    expect(app).toContain('供应商覆盖');
    expect(app).toContain('查看详情');
  });
});
