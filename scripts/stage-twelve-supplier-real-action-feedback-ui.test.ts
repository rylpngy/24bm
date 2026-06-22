import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage twelve supplier real action feedback UI', () => {
  it('adds a supplier real-action feedback panel for demo-critical actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('stage12-supplier-real-action-feedback');
    expect(app).toContain('SupplierRealActionFeedbackPanel');
    expect(app).toContain('buildSupplierRealActionFeedbackItems');
    expect(app).toContain('supplierRealActionFeedbackItems');
    expect(app).toContain('workflowStatus={workflowStatus}');
  });

  it('covers the five supplier collaboration actions with before-after guidance', () => {
    const app = read('App.tsx');

    [
      '报价提交',
      '订单确认',
      '发货提交',
      '发票提交',
      '应收备注',
      '点前检查',
      '点击后反馈',
      '失败兜底',
      '后续流向',
      '协同边界',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('links supplier real-action feedback to visible stage seven action buttons', () => {
    const app = read('App.tsx');

    [
      'stage7-supplier-submit-quote',
      'stage7-supplier-confirm-order',
      'stage7-supplier-create-delivery',
      'stage7-supplier-create-invoice',
      'stage7-supplier-update-receivable',
    ].forEach((copy) => {
      expect(app).toContain(copy);
    });
  });

  it('records the fourth stage-twelve increment in the execution checklist', () => {
    const checklist = read('docs/stage-twelve-execution-checklist.md');

    expect(checklist).toContain('| 4 | 供应商真实协同动作补强 |');
    expect(checklist).toContain('报价提交、订单确认、发货提交、发票提交和应收备注');
    expect(checklist).toContain('scripts/stage-twelve-supplier-real-action-feedback-ui.test.ts');
    expect(checklist).toContain('下一轮建议：供应商真实动作浏览器点击复验');
  });
});
