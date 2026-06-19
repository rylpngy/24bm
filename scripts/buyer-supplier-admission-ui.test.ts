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

  it('collects admission reason and category confirmation before submission', () => {
    const app = read('App.tsx');
    const buyerWorkspace = app.slice(
      app.indexOf('const BuyerWorkspaceView'),
      app.indexOf('const AuditLogList'),
    );
    const supplierDetailView = app.slice(
      app.indexOf('const SupplierDetailPanelView'),
      app.indexOf('const MaterialDetailPanelView'),
    );

    expect(app).toContain('type BuyerSupplierAdmissionDraft');
    expect(app).toContain('submitSupplierAdmission = async (relationId: string, draft: BuyerSupplierAdmissionDraft)');
    expect(app).toContain('准入说明');
    expect(app).toContain('授权品类已确认');
    expect(buyerWorkspace).toContain('supplierAdmissionDrafts');
    expect(buyerWorkspace).toContain('getSupplierAdmissionDraft');
    expect(app).toContain('onSubmitSupplierAdmission(relationRow.id, supplierAdmissionDraft)');
    expect(supplierDetailView).toContain('onSubmitSupplierAdmission(relation.id, admissionDraft)');
    expect(app).toContain('!draft.categoryConfirmed');
  });
});
