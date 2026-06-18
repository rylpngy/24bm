import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer supplier admission UI', () => {
  it('lets buyer users submit pending supplier relations into Java approval', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');
    const model = read('data/procurementModel.ts');

    expect(apiClient).toContain('submitBuyerSupplierAdmission');
    expect(app).toContain('submitSupplierAdmission');
    expect(app).toContain('buildSupplierRelationRows');
    expect(app).toContain('supplierAdmissionBusyId');
    expect(app).toContain(`relationRow.status === '待准入'`);
    expect(app).toContain('准入审批中');
    expect(app).toContain('提交准入');
    expect(app).toContain('供应商准入已提交');
    expect(model).toContain("'准入审批中'");
    expect(model).toContain("'已驳回'");
  });
});
