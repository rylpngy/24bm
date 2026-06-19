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
    expect(app).toContain('qualificationSummary');
    expect(app).toContain('contactName');
    expect(app).toContain('contactPhone');
    expect(app).toContain('riskConfirmed');
    expect(app).toContain('资质摘要');
    expect(app).toContain('联系人');
    expect(app).toContain('联系电话');
    expect(app).toContain('黑名单与风险已复核');
    expect(buyerWorkspace).toContain('supplierAdmissionDrafts');
    expect(buyerWorkspace).toContain('getSupplierAdmissionDraft');
    expect(app).toContain('onSubmitSupplierAdmission(relationRow.id, supplierAdmissionDraft)');
    expect(supplierDetailView).toContain('onSubmitSupplierAdmission(relation.id, admissionDraft)');
    expect(app).toContain('!draft.categoryConfirmed');
    expect(app).toContain('!draft.riskConfirmed');
  });

  it('shows validation feedback before supplier admission submission', () => {
    const app = read('App.tsx');
    const supplierAdmissionForm = app.slice(
      app.indexOf('const SupplierAdmissionForm'),
      app.indexOf('const SupplierDetailPanelView'),
    );

    expect(supplierAdmissionForm).toContain('admissionReasonInvalid');
    expect(supplierAdmissionForm).toContain('admissionQualificationInvalid');
    expect(supplierAdmissionForm).toContain('admissionContactInvalid');
    expect(supplierAdmissionForm).toContain('admissionPhoneInvalid');
    expect(supplierAdmissionForm).toContain('admissionCategoryInvalid');
    expect(supplierAdmissionForm).toContain('admissionRiskInvalid');
    expect(supplierAdmissionForm).toContain('supplierAdmissionInvalid');
    expect(supplierAdmissionForm).toContain('supplier-admission-qualification');
    expect(supplierAdmissionForm).toContain('min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2');
    expect(supplierAdmissionForm).toContain('请填写准入说明后再提交。');
    expect(supplierAdmissionForm).toContain('请填写资质摘要后再提交。');
    expect(supplierAdmissionForm).toContain('请填写联系人和联系电话后再提交。');
    expect(supplierAdmissionForm).toContain('请先确认授权品类。');
    expect(supplierAdmissionForm).toContain('请先复核黑名单与风险状态。');
    expect(supplierAdmissionForm).toContain('aria-live="polite"');
    expect(supplierAdmissionForm).toContain('disabled={busy || supplierAdmissionInvalid}');
  });
});
