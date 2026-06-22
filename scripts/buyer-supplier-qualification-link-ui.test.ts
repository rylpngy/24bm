import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('App.tsx', 'utf8');
const apiClient = readFileSync('services/procurementApiClient.ts', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('buyer supplier qualification linkage', () => {
  it('loads supplier qualification ledger through the buyer scoped supplier relation API', () => {
    expect(apiClient).toContain('listBuyerSupplierQualifications');
    expect(apiClient).toContain('/api/v1/buyer/suppliers/${relationId}/qualifications');
    expect(apiClient).toContain('buyerSupplierQualifications');
    expect(apiClient).toContain('qualifications: masterData.buyerSupplierQualifications?.[supplier.id]');
  });

  it('shows supplier qualifications as admission evidence in buyer supplier detail', () => {
    const supplierDetail = sliceBetween(
      app,
      'const SupplierDetailPanelView',
      'const SupplierDetailOperationPanel',
    );

    expect(supplierDetail).toContain('relation?.qualifications');
    expect(supplierDetail).toContain('资质台账');
    expect(supplierDetail).toContain('准入依据');
    expect(supplierDetail).toContain('qualification.qualificationType');
    expect(supplierDetail).toContain('qualification.fileName');
    expect(supplierDetail).toContain('qualification.expiresAt');
  });
});
