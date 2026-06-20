import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier profile Java persistence UI wiring', () => {
  it('wires supplier profile drafts to the Java update API and refreshes supplier workspace data', () => {
    const app = read('App.tsx');

    expect(app).toContain('supplierProfileBusy');
    expect(app).toContain('updateSupplierProfile = async');
    expect(app).toContain('javaApiClient.updateSupplierProfile');
    expect(app).toContain('refreshJavaSupplierData');
    expect(app).toContain('供应商企业档案已保存并刷新');
    expect(app).toContain('onUpdateSupplierProfile={updateSupplierProfile}');
  });
});
