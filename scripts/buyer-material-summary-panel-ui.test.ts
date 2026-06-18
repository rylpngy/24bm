import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer material summary panel UI details', () => {
  it('summarizes catalog readiness inside the material detail panel', () => {
    const app = read('App.tsx');
    const materialDetailView = app.slice(
      app.indexOf('const MaterialDetailPanelView'),
      app.indexOf('const DemandCreateForm'),
    );

    expect(materialDetailView).toContain('MaterialDetailSummaryPanel');
    expect(materialDetailView).toContain('目录摘要');
    expect(materialDetailView).toContain('物料编码');
    expect(materialDetailView).toContain('品类');
    expect(materialDetailView).toContain('参考价');
    expect(materialDetailView).toContain('引用需求');
    expect(materialDetailView).toContain('准入供应商');
    expect(materialDetailView).toContain('下一步');
    expect(materialDetailView).toContain('detail.facts.find');
    expect(materialDetailView).toContain('detail.usageSummary.find');
    expect(materialDetailView).toContain('detail.procurementReadinessRows.find');
  });
});
