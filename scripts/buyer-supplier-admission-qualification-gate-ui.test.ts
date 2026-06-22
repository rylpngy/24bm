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

describe('buyer supplier admission qualification gate UI', () => {
  it('blocks supplier admission submission when the relation has no active qualifications', () => {
    const admissionForm = sliceBetween(app, 'const SupplierAdmissionForm', 'const splitCategoryInput');
    const operationPanel = sliceBetween(app, 'const SupplierDetailOperationPanel', 'const MaterialDetailPanelView');

    expect(admissionForm).toContain('hasActiveQualification');
    expect(admissionForm).toContain('supplierQualificationInvalid');
    expect(admissionForm).toContain('请先要求供应商补充至少一条有效资质');
    expect(admissionForm).toContain('disabled={busy || supplierAdmissionInvalid || supplierQualificationInvalid}');
    expect(operationPanel).toContain('hasActiveQualification={Boolean(relation.qualifications?.some');
  });
});
