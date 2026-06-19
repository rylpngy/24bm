import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer demand create form UI', () => {
  it('supports multi-line demand entry with budget and attachment guidance', () => {
    const app = read('App.tsx');
    const demandCreateForm = app.slice(
      app.indexOf('const DemandCreateForm'),
      app.indexOf('const RfqCreateForm'),
    );

    expect(demandCreateForm).toContain('demandLineItems');
    expect(demandCreateForm).toContain('addDemandLineItem');
    expect(demandCreateForm).toContain('removeDemandLineItem');
    expect(demandCreateForm).toContain('updateDemandLineItem');
    expect(demandCreateForm).toContain('预估金额');
    expect(demandCreateForm).toContain('预算差额');
    expect(demandCreateForm).toContain('expectedDeliveryDate');
    expect(demandCreateForm).toContain('demandDescription');
    expect(demandCreateForm).toContain('attachmentNames');
    expect(demandCreateForm).toContain('期望到货日期');
    expect(demandCreateForm).toContain('需求说明');
    expect(demandCreateForm).toContain('附件清单');
    expect(demandCreateForm).toContain('需求附件');
    expect(demandCreateForm).toContain('description: demandDescription.trim() || undefined');
    expect(demandCreateForm).toContain('expectedDeliveryDate: expectedDeliveryDate || undefined');
    expect(demandCreateForm).toContain("attachmentNames: attachmentNames");
    expect(demandCreateForm).toContain('lineItems: demandLineItems');
    expect(demandCreateForm).toContain('filter((lineItem) => lineItem.materialId && lineItem.quantity > 0)');
    expect(demandCreateForm).toContain('disabled={materials.length === 0}');
  });

  it('warns and blocks submission when estimated material amount exceeds budget', () => {
    const app = read('App.tsx');
    const demandCreateForm = app.slice(
      app.indexOf('const DemandCreateForm'),
      app.indexOf('const RfqCreateForm'),
    );

    expect(demandCreateForm).toContain('const budgetExceeded = budgetBalance < 0;');
    expect(demandCreateForm).toContain('!budgetExceeded');
    expect(demandCreateForm).toContain('预估金额已超出预算');
    expect(demandCreateForm).toContain('请调整预算或物料数量后再提交审批');
    expect(demandCreateForm).toContain('aria-live="polite"');
  });
});
