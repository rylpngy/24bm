// 三端后台导航——移植自 data/adminNavigation.ts，作为重写的导航事实源。

export type AdminRole = 'platform' | 'buyer' | 'supplier';

export interface AdminNavigationModule {
  id: string;
  label: string;
  desc: string;
  // 可选:进入该模块所需的权限点。缺省=基础模块,所有成员可见。
  // 命中规则同后端 RBAC:授予 "buyer:*" 覆盖一切;授予 "x:y:*" 覆盖 "x:y:z"。
  requiredPermission?: string;
}

// 前端门禁:已授予的权限点集合 granted 是否覆盖 required(精确或前缀通配 "...:*")。
// 与后端 PermissionService.matches 保持一致。
export function hasPermission(granted: string[], required: string): boolean {
  return granted.some((g) => {
    if (g === required) return true;
    if (g.endsWith(':*')) return required.startsWith(g.slice(0, -1));
    return false;
  });
}

export interface AdminRoleNavigation {
  id: AdminRole;
  label: string;
  shortLabel: string;
  desc: string;
  modules: AdminNavigationModule[];
}

export const buyerAdminModules: AdminNavigationModule[] = [
  { id: 'dashboard', label: '首页看板', desc: '采购金额、待办、履约进度' },
  { id: 'analytics', label: '采购分析', desc: '支出趋势、集中度、节支洞察' },
  { id: 'budgets', label: '预算管理', desc: '部门预算池、占用、超预算预警' },
  { id: 'demands', label: '采购需求', desc: '需求列表、审批提交、转询价', requiredPermission: 'buyer:demand:read' },
  { id: 'approvals', label: '审批中心', desc: '待审批与最近审批记录' },
  { id: 'suppliers', label: '供应商库', desc: '私域关系、准入、分级、绩效' },
  { id: 'materials', label: '物料目录', desc: '物料与服务主数据', requiredPermission: 'buyer:material:read' },
  { id: 'rfqs', label: '询价项目', desc: 'RFQ 列表、邀请与状态', requiredPermission: 'buyer:rfq:read' },
  { id: 'quotes', label: '报价对比', desc: '报价比较、定标入口', requiredPermission: 'buyer:rfq:read' },
  { id: 'orders', label: '采购订单', desc: '订单列表与生成订单' },
  { id: 'contracts', label: '合同管理', desc: '合同台账、审批与履约', requiredPermission: 'buyer:contract:read' },
  { id: 'receipts', label: '收货验收', desc: '待收货与验收登记' },
  { id: 'invoices', label: '发票付款', desc: '发票列表与付款状态', requiredPermission: 'buyer:invoice:read' },
  { id: 'payment-batches', label: '付款批次', desc: '批量付款计划与执行', requiredPermission: 'buyer:payment:register' },
  { id: 'team', label: '团队与权限', desc: '角色权限矩阵与成员', requiredPermission: 'buyer:role:manage' },
  { id: 'audit', label: '审计日志', desc: '最近操作留痕' },
];

export const platformAdminModules: AdminNavigationModule[] = [
  { id: 'overview', label: '平台看板', desc: '租户、供应商、审核概览' },
  { id: 'tenants', label: '租户列表', desc: '采购企业与套餐状态' },
  { id: 'reviews', label: '企业审核', desc: '入驻审核与认证状态' },
  { id: 'announcements', label: '平台公告', desc: '平台侧通知与运营信息' },
];

export const supplierAdminModules: AdminNavigationModule[] = [
  { id: 'overview', label: '供应商看板', desc: '合作采购方、商机、订单' },
  { id: 'opportunities', label: '询价邀请', desc: '可报价商机与截止时间' },
  { id: 'quotes', label: '报价记录', desc: '已提交报价与报价状态' },
  { id: 'orders', label: '销售订单', desc: '确认、发货、开票入口' },
  { id: 'invoices', label: '发票应收', desc: '发票与回款状态' },
  { id: 'profile', label: '企业档案', desc: '企业能力与资质信息' },
];

export const buyerNavigation: AdminRoleNavigation = {
  id: 'buyer',
  label: '采购方企业端',
  shortLabel: '采购方',
  desc: '需求到付款闭环',
  modules: buyerAdminModules,
};

export const supplierNavigation: AdminRoleNavigation = {
  id: 'supplier',
  label: '供应商企业端',
  shortLabel: '供应商',
  desc: '报价 / 交付 / 应收',
  modules: supplierAdminModules,
};

export const platformNavigation: AdminRoleNavigation = {
  id: 'platform',
  label: '平台运营端',
  shortLabel: '平台',
  desc: '租户 / 审核 / 公告',
  modules: platformAdminModules,
};
