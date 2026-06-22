import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve supplier collaboration polish UI', () => {
  it('adds stage-twelve supplier demo guidance panels mirroring buyer main-flow polish', () => {
    const app = read('App.tsx');

    expect(app).toContain('stage12-supplier-collaboration-operation-strip');
    expect(app).toContain('stage12-supplier-first-screen-focus');
    expect(app).toContain('stage12-supplier-action-visibility');
    expect(app).toContain('stage12-supplier-demo-data-slimming');
    expect(app).toContain('SupplierCollaborationOperationStrip');
    expect(app).toContain('SupplierDemoPresenterCue');
    expect(app).toContain('SupplierKeyActionReadinessPanel');
    expect(app).toContain('SupplierDemoDataSlimmingCue');
  });

  it('defines supplier collaboration polish configs for the five supplier demo pages', () => {
    const app = read('App.tsx');

    [
      'opportunities: {',
      'quotes: {',
      'orders: {',
      'invoices: {',
      'profile: {',
      '询价邀请 · 演示操作收束',
      '报价记录 · 演示操作收束',
      '销售订单 · 演示操作收束',
      '发票应收 · 演示操作收束',
      '企业档案 · 演示操作收束',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('limits supplier demo lists while preserving recommended samples', () => {
    const app = read('App.tsx');

    expect(app).toContain('const SUPPLIER_COLLABORATION_DEMO_LIST_LIMIT = 6');
    expect(app).toContain('limitSupplierDemoRows');
    expect(app).toContain('const displayedSupplierOpportunities = limitSupplierDemoRows(');
    expect(app).toContain('const displayedSupplierQuotes = limitSupplierDemoRows(');
    expect(app).toContain('const displayedSupplierOrders = limitSupplierDemoRows(');
    expect(app).toContain('const displayedSupplierInvoices = limitSupplierDemoRows(');
    expect(app).toContain('rfq-stage7-supplier-quote-ready');
    expect(app).toContain('po-stage7-supplier-confirm-ready');
    expect(app).toContain('inv-stage7-supplier-receivable-ready');
  });

  it('records the second stage-twelve increment as supplier collaboration polish', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 2 | 供应商协同演示 polish 第一轮 |');
    expect(checklist).toContain('询价邀请、报价记录、销售订单、发票应收和企业档案');
    expect(checklist).toContain('scripts/stage-twelve-supplier-collaboration-polish-ui.test.ts');
    expect(checklist).toContain('下一轮建议：继续供应商协同视觉验收');
  });
});
