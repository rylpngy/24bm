import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('permission boundary hints UI', () => {
  it('defines a shared permission boundary panel for role capability differences', () => {
    const app = read('App.tsx');
    const permissionPanel = sliceBetween(app, 'const PermissionBoundaryPanel', 'const MessageCenterPanel');

    expect(permissionPanel).toContain('权限差异提示');
    expect(permissionPanel).toContain('roleLabel');
    expect(permissionPanel).toContain('allowedActions');
    expect(permissionPanel).toContain('blockedActions');
    expect(permissionPanel).toContain('dataBoundary');
    expect(permissionPanel).toContain('Java 模式');
    expect(permissionPanel).toContain('Mock 模式');
  });

  it('adds platform buyer and supplier role boundary hints to their workspaces', () => {
    const app = read('App.tsx');
    const platformWorkspace = sliceBetween(app, 'const PlatformWorkspace', 'const PlatformAnnouncementPublishPanel');
    const buyerWorkspace = sliceBetween(app, 'const BuyerWorkspaceView', 'const DemandDetailPanelView');
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileSummaryPanel');

    expect(platformWorkspace).toContain('roleLabel="平台运营方"');
    expect(platformWorkspace).toContain('管理租户、企业审核、平台公告和功能开关');
    expect(platformWorkspace).toContain('不直接参与采购方定标、收货和付款决策');
    expect(platformWorkspace).toContain('平台公共企业档案与租户运营数据');

    expect(buyerWorkspace).toContain('roleLabel="采购方企业"');
    expect(buyerWorkspace).toContain('提交需求、审批、询价比价、生成订单、登记收货和付款状态');
    expect(buyerWorkspace).toContain('不能维护平台套餐，也不能查看其他采购企业的采购数据');
    expect(buyerWorkspace).toContain('当前采购租户内的需求、供应商关系、订单和财务记录');

    expect(supplierWorkspace).toContain('roleLabel="供应商企业"');
    expect(supplierWorkspace).toContain('响应询价、提交报价、确认订单、发货和登记发票');
    expect(supplierWorkspace).toContain('不能查看采购方内部审批、预算和其他供应商报价明细');
    expect(supplierWorkspace).toContain('当前供应商主体下的商机、报价、销售订单和应收记录');
  });
});
