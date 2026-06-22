import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage nine current action guide UI', () => {
  it('extends the stage-nine command center with a current-page action guide', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoCurrentActionGuide = {');
    expect(component).toContain('currentGuide?: DemoCurrentActionGuide');
    expect(component).toContain('当前页动作提示');
    expect(component).toContain('目标按钮');
    expect(component).toContain('演示口径');
    expect(component).toContain('跳转建议');
    expect(component).toContain('data-testid="stage9-current-action-guide"');
  });

  it('defines buyer current action guides for the seven real demo actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerDemoCurrentActionGuides: Partial<Record<BuyerAdminModule, DemoCurrentActionGuide>>');
    expect(app).toContain("demands: {");
    expect(app).toContain("actionLabel: '提交审批 / 创建询价'");
    expect(app).toContain("targetButton: '提交审批、创建询价'");
    expect(app).toContain("approvals: {");
    expect(app).toContain("actionLabel: '通过需求审批'");
    expect(app).toContain("quotes: {");
    expect(app).toContain("actionLabel: '提交定标审批 / 生成采购订单'");
    expect(app).toContain("receipts: {");
    expect(app).toContain("actionLabel: '登记收货'");
    expect(app).toContain("invoices: {");
    expect(app).toContain("actionLabel: '登记付款'");
  });

  it('defines supplier and platform current action guides for real-click modules', () => {
    const app = read('App.tsx');

    expect(app).toContain('const supplierDemoCurrentActionGuides: Partial<Record<SupplierAdminModule, DemoCurrentActionGuide>>');
    expect(app).toContain("opportunities: {");
    expect(app).toContain("actionLabel: '提交报价'");
    expect(app).toContain("orders: {");
    expect(app).toContain("actionLabel: '确认订单 / 提交发货 / 提交发票'");
    expect(app).toContain("invoices: {");
    expect(app).toContain("actionLabel: '保存对账备注'");

    expect(app).toContain('const platformDemoCurrentActionGuides: Partial<Record<PlatformAdminModule, DemoCurrentActionGuide>>');
    expect(app).toContain("tenants: {");
    expect(app).toContain("actionLabel: '停用租户 / 升级专业版'");
    expect(app).toContain("reviews: {");
    expect(app).toContain("actionLabel: '通过企业审核'");
    expect(app).toContain("announcements: {");
    expect(app).toContain("actionLabel: '发布平台公告 / 撤回平台公告'");
  });

  it('passes the active-module guide into each role command center', () => {
    const app = read('App.tsx');

    expect(app).toContain('currentGuide={platformDemoCurrentActionGuides[activeModule]}');
    expect(app).toContain('currentGuide={buyerDemoCurrentActionGuides[activeModule as BuyerAdminModule]}');
    expect(app).toContain('currentGuide={supplierDemoCurrentActionGuides[activeModule]}');
  });

  it('records the second stage-nine increment in the checklist', () => {
    const checklist = read('docs/stage-nine-execution-checklist.md');

    expect(checklist).toContain('| 2 | 当前页动作提示第一轮 |');
    expect(checklist).toContain('当前 activeModule');
    expect(checklist).toContain('目标按钮、演示口径和跳转建议');
    expect(checklist).toContain('scripts/stage-nine-current-action-guide-ui.test.ts');
  });
});
