import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const app = readFileSync('App.tsx', 'utf8');

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe('supplier qualification maintenance UI', () => {
  it('adds a real supplier qualification form to the supplier profile maintenance panel', () => {
    const maintenancePanel = sliceBetween(
      app,
      'const SupplierProfileMaintenancePanel',
      'const SupplierActionLoopSummaryPanel',
    );

    expect(maintenancePanel).toContain('SupplierQualificationDraft');
    expect(maintenancePanel).toContain('qualificationDraft');
    expect(maintenancePanel).toContain('qualificationType');
    expect(maintenancePanel).toContain('certificateNo');
    expect(maintenancePanel).toContain('expiresAt');
    expect(maintenancePanel).toContain('fileName');
    expect(maintenancePanel).toContain('storageKey');
    expect(maintenancePanel).toContain('onCreateSupplierQualification');
    expect(maintenancePanel).toContain('提交资质');
    expect(maintenancePanel).toContain('workspace.qualifications');
  });

  it('wires the supplier qualification create action through the Java API client', () => {
    expect(app).toContain('supplierQualificationBusy');
    expect(app).toContain('createSupplierQualification = async');
    expect(app).toContain('javaApiClient.createSupplierQualification');
    expect(app).toContain('供应商资质已提交并刷新');
    expect(app).toContain('onCreateSupplierQualification={createSupplierQualification}');
  });
});
