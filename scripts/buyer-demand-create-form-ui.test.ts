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
    expect(demandCreateForm).toContain('需求附件');
    expect(demandCreateForm).toContain('lineItems: demandLineItems');
    expect(demandCreateForm).toContain('filter((lineItem) => lineItem.materialId && lineItem.quantity > 0)');
    expect(demandCreateForm).toContain('disabled={materials.length === 0}');
  });
});
