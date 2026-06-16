export type AdminRole = 'platform' | 'buyer' | 'supplier';

export type BuyerAdminModule =
  | 'dashboard'
  | 'demands'
  | 'approvals'
  | 'suppliers'
  | 'materials'
  | 'rfqs'
  | 'quotes'
  | 'orders'
  | 'receipts'
  | 'invoices'
  | 'audit';

export type PlatformAdminModule = 'overview' | 'tenants' | 'reviews' | 'announcements';
export type SupplierAdminModule = 'overview' | 'opportunities' | 'quotes' | 'orders' | 'invoices' | 'profile';
export type AdminModule = BuyerAdminModule | PlatformAdminModule | SupplierAdminModule;

export interface AdminNavigationModule<TModule extends string = string> {
  id: TModule;
  label: string;
  desc: string;
}

export interface AdminRoleNavigation<TRole extends AdminRole = AdminRole, TModule extends string = string> {
  id: TRole;
  label: string;
  shortLabel: string;
  desc: string;
  modules: AdminNavigationModule<TModule>[];
}

export const defaultAdminRole: AdminRole = 'buyer';

export const buyerAdminModules: AdminNavigationModule<BuyerAdminModule>[] = [
  { id: 'dashboard', label: '首页看板', desc: '采购金额、待办、履约进度' },
  { id: 'demands', label: '采购需求', desc: '需求列表、审批提交、转询价' },
  { id: 'approvals', label: '审批中心', desc: '待审批与最近审批记录' },
  { id: 'suppliers', label: '供应商库', desc: '私域关系、准入、分级' },
  { id: 'materials', label: '物料目录', desc: '物料与服务主数据' },
  { id: 'rfqs', label: '询价项目', desc: 'RFQ 列表、邀请与状态' },
  { id: 'quotes', label: '报价对比', desc: '报价比较、定标入口' },
  { id: 'orders', label: '采购订单', desc: '订单列表与生成订单' },
  { id: 'receipts', label: '收货验收', desc: '待收货与验收登记' },
  { id: 'invoices', label: '发票付款', desc: '发票列表与付款状态' },
  { id: 'audit', label: '审计日志', desc: '最近操作留痕' },
];

export const platformAdminModules: AdminNavigationModule<PlatformAdminModule>[] = [
  { id: 'overview', label: '平台看板', desc: '租户、供应商、审核概览' },
  { id: 'tenants', label: '租户列表', desc: '采购企业与套餐状态' },
  { id: 'reviews', label: '企业审核', desc: '入驻审核与认证状态' },
  { id: 'announcements', label: '平台公告', desc: '平台侧通知与运营信息' },
];

export const supplierAdminModules: AdminNavigationModule<SupplierAdminModule>[] = [
  { id: 'overview', label: '供应商看板', desc: '合作采购方、商机、订单' },
  { id: 'opportunities', label: '询价邀请', desc: '可报价商机与截止时间' },
  { id: 'quotes', label: '报价记录', desc: '已提交报价与报价状态' },
  { id: 'orders', label: '销售订单', desc: '确认、发货、开票入口' },
  { id: 'invoices', label: '发票应收', desc: '发票与回款状态' },
  { id: 'profile', label: '企业档案', desc: '企业能力与资质信息' },
];

export const adminRoleNavigation: AdminRoleNavigation[] = [
  {
    id: 'platform',
    label: '平台运营端',
    shortLabel: '平台',
    desc: '租户 / 审核 / 公告',
    modules: platformAdminModules,
  },
  {
    id: 'buyer',
    label: '采购方企业端',
    shortLabel: '采购方',
    desc: '需求到付款闭环',
    modules: buyerAdminModules,
  },
  {
    id: 'supplier',
    label: '供应商企业端',
    shortLabel: '供应商',
    desc: '报价 / 交付 / 应收',
    modules: supplierAdminModules,
  },
];

export const defaultAdminModulesByRole: Record<AdminRole, string> = {
  platform: platformAdminModules[0].id,
  buyer: buyerAdminModules[0].id,
  supplier: supplierAdminModules[0].id,
};
