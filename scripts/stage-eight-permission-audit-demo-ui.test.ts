import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage eight permission and audit demo UI', () => {
  it('adds a reusable permission and audit trace panel to the stage-eight component module', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('export type DemoGovernanceTraceItem = {');
    expect(component).toContain('export const DemoPermissionAuditPanel');
    expect(component).toContain('阶段八权限与审计');
    expect(component).toContain('谁能做');
    expect(component).toContain('做了什么');
    expect(component).toContain('审计对象');
    expect(component).toContain('追溯入口');
    expect(component).toContain('data-testid="stage8-permission-audit-panel"');
  });

  it('defines buyer, supplier and platform governance trace items for the demo actions', () => {
    const app = read('App.tsx');

    expect(app).toContain('const buyerGovernanceTraceItems: DemoGovernanceTraceItem[]');
    expect(app).toContain("actor: '采购负责人 / 审批人'");
    expect(app).toContain("action: '提交审批、定标、生成订单、登记收货和付款状态'");
    expect(app).toContain("auditTarget: '需求、审批任务、RFQ、订单、收货、发票和付款批次'");
    expect(app).toContain("traceEntry: '采购方审计日志、详情面板和付款归档审计摘要'");

    expect(app).toContain('const supplierGovernanceTraceItems: DemoGovernanceTraceItem[]');
    expect(app).toContain("actor: '供应商销售 / 发货协同人'");
    expect(app).toContain("action: '提交报价、确认订单、提交发货、提交发票和保存对账备注'");
    expect(app).toContain("auditTarget: '询价邀请、报价、销售订单、物流、发票和应收备注'");
    expect(app).toContain("traceEntry: '供应商报价记录、订单履约记录和发票应收记录'");

    expect(app).toContain('const platformGovernanceTraceItems: DemoGovernanceTraceItem[]');
    expect(app).toContain("actor: '平台运营管理员'");
    expect(app).toContain("action: '停用租户、升级套餐、审核企业、发布和撤回公告'");
    expect(app).toContain("auditTarget: '租户、企业档案、平台公告和站内通知'");
    expect(app).toContain("traceEntry: '平台运营详情、企业审核记录和公告生命周期审计'");
  });

  it('mounts the permission and audit panel in buyer, supplier and platform workspaces', () => {
    const app = read('App.tsx');

    expect(app).toContain('items={buyerGovernanceTraceItems}');
    expect(app).toContain('items={supplierGovernanceTraceItems}');
    expect(app).toContain('items={platformGovernanceTraceItems}');
    expect(app).toContain('stage8-buyer-permission-audit');
    expect(app).toContain('stage8-supplier-permission-audit');
    expect(app).toContain('stage8-platform-permission-audit');
  });

  it('records the sixth stage-eight increment in the execution checklist', () => {
    const checklist = read('docs/stage-eight-execution-checklist.md');

    expect(checklist).toContain('| 6 | 权限与审计演示增强第一轮 |');
    expect(checklist).toContain('scripts/stage-eight-permission-audit-demo-ui.test.ts');
    expect(checklist).toContain('谁能做、做了什么、审计对象和追溯入口');
    expect(checklist).toContain('阶段八第一轮演示链路产品化加固收束');
  });
});
