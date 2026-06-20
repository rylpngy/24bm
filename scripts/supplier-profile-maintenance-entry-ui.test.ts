import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('supplier profile maintenance entry UI', () => {
  it('adds editable supplier profile and qualification upload entries to the profile workspace', () => {
    const app = read('App.tsx');
    const supplierWorkspace = app.slice(
      app.indexOf('const SupplierWorkspaceView'),
      app.indexOf('const SupplierOpportunityResponseSummaryPanel'),
    );
    const maintenancePanel = app.slice(
      app.indexOf('const SupplierProfileMaintenancePanel'),
      app.indexOf('const SupplierActionLoopSummaryPanel'),
    );

    expect(supplierWorkspace).toContain('SupplierProfileMaintenancePanel');
    expect(maintenancePanel).toContain('档案维护入口');
    expect(maintenancePanel).toContain('企业档案草稿');
    expect(maintenancePanel).toContain('联系人维护');
    expect(maintenancePanel).toContain('授权品类');
    expect(maintenancePanel).toContain('资质上传入口');
    expect(maintenancePanel).toContain('附件元数据');
    expect(maintenancePanel).toContain('营业执照');
    expect(maintenancePanel).toContain('授权代理证书');
    expect(maintenancePanel).toContain('Java 模式下可调用 POST /api/v1/supplier/profile');
    expect(maintenancePanel).toContain('Mock 模式先保留页面草稿和上传入口');
    expect(maintenancePanel).toContain('profileDraft');
    expect(maintenancePanel).toContain('setProfileDraft');
    expect(maintenancePanel).toContain('onUpdateSupplierProfile');
    expect(maintenancePanel).toContain('supplierProfileBusy');
    expect(maintenancePanel).toContain('保存企业档案');
    expect(maintenancePanel).toContain('creditCode');
    expect(maintenancePanel).toContain('legalPerson');
    expect(maintenancePanel).toContain('disabled={!javaEnabled || supplierProfileBusy');
  });
});
