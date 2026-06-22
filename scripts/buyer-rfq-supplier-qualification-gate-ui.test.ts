import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('buyer RFQ supplier qualification gate UI', () => {
  it('uses only admitted suppliers with active qualifications for RFQ creation and editing', () => {
    const createHandler = sliceBetween(app, 'const createBuyerRfqFromDemand', 'const updateBuyerRfqDetail');
    const rfqDetail = sliceBetween(app, 'const RfqDetailPanelView', 'const RfqDetailOperationPanel');
    const rfqCreateForm = sliceBetween(app, 'const RfqCreateForm', 'const Field');

    expect(app).toContain('isRfqEligibleSupplierRelation');
    expect(createHandler).toContain('isRfqEligibleSupplierRelation');
    expect(createHandler).toContain('创建询价需要已通过需求和具备有效资质的已准入供应商');
    expect(rfqDetail).toContain('rfqEligibleRelations');
    expect(rfqDetail).toContain('relation.qualifications?.some');
    expect(rfqDetail).toContain('无有效资质，不可邀请');
    expect(rfqCreateForm).toContain('rfqEligibleRelations');
    expect(rfqCreateForm).toContain('请至少选择一家具备有效资质的已准入供应商');
  });
});
