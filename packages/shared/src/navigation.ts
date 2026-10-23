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
  { id: 'analytics', label: '采购分析', desc: '支出趋势、集中度、节支洞察', requiredPermission: 'buyer:analytics:read' },
  { id: 'budgets', label: '预算管理', desc: '部门预算池、占用、超预算预警', requiredPermission: 'buyer:budget:read' },
  { id: 'demands', label: '采购需求', desc: '需求列表、审批提交、转采购计划', requiredPermission: 'buyer:demand:read' },
  { id: 'procurement-plans', label: '采购计划', desc: '需求合并、方案审批、执行进度', requiredPermission: 'buyer:rfq:read' },
  { id: 'approvals', label: '智能审批', desc: '待审批、AI 风险与流转记录' },
  { id: 'suppliers', label: '供应商库', desc: '私域关系、准入、分级、绩效', requiredPermission: 'buyer:supplier:read' },
  { id: 'materials', label: '物料目录', desc: '物料与服务主数据', requiredPermission: 'buyer:material:read' },
  { id: 'mall', label: '企业商城', desc: '协议价货架、目录直购', requiredPermission: 'buyer:mall:read' },
  { id: 'rfqs', label: '询比项目', desc: '询比列表、邀请与状态', requiredPermission: 'buyer:rfq:read' },
  { id: 'auctions', label: '竞价采购', desc: '在线竞价 · 实时出价与排行', requiredPermission: 'buyer:rfq:read' },
  { id: 'tenders', label: '招标管理', desc: '招标文件编制 · 发售与领取', requiredPermission: 'buyer:tender:read' },
  { id: 'orders', label: '采购订单', desc: '订单列表与生成订单', requiredPermission: 'buyer:order:read' },
  { id: 'contracts', label: '合同管理', desc: '合同台账、审批与履约', requiredPermission: 'buyer:contract:read' },
  { id: 'receipts', label: '收货验收', desc: '待收货与验收登记', requiredPermission: 'buyer:receipt:read' },
  { id: 'invoices', label: '发票付款', desc: '发票列表、批量付款与对账差异', requiredPermission: 'buyer:invoice:read' },
  { id: 'process-engine', label: '流程引擎', desc: '可视化配置审批流与表单', requiredPermission: 'buyer:role:manage' },
  { id: 'org', label: '组织架构', desc: '部门树、负责人、成员', requiredPermission: 'buyer:role:manage' },
  { id: 'team', label: '团队与权限', desc: '角色权限矩阵与成员', requiredPermission: 'buyer:role:manage' },
  { id: 'audit', label: '审计日志', desc: '最近操作留痕', requiredPermission: 'buyer:audit:read' },
];

export const platformAdminModules: AdminNavigationModule[] = [
  { id: 'overview', label: '平台看板', desc: '租户、供应商、审核概览' },
  { id: 'tenants', label: '租户列表', desc: '采购企业与套餐状态' },
  { id: 'reviews', label: '企业审核', desc: '入驻审核与认证状态' },
  { id: 'supplier-credit', label: '供应商信用', desc: '跨租户履约表现与信用分' },
  { id: 'announcements', label: '平台公告', desc: '平台侧通知与运营信息' },
  { id: 'settings', label: '运营配置', desc: '全局字典与业务枚举维护' },
];

export const supplierAdminModules: AdminNavigationModule[] = [
  { id: 'overview', label: '供应商看板', desc: '合作采购方、商机、订单' },
  { id: 'rfq-projects', label: '询价项目', desc: '询比邀请 · 报价 · 开标大厅' },
  { id: 'auction-projects', label: '竞价项目', desc: '实时出价 · 排名 · 竞价大厅' },
  { id: 'mall-projects', label: '商城项目', desc: '协议价直采订单与履约' },
  { id: 'tender-projects', label: '招标项目', desc: '招标文件领取与投标准备' },
  { id: 'orders', label: '销售订单', desc: '确认、发货、开票入口' },
  { id: 'deliveries', label: '发货管理', desc: '发货单与物流跟踪' },
  { id: 'shelf', label: '商城货架', desc: '协议价商品、自主调价与上下架' },
  { id: 'invoices', label: '发票应收', desc: '发票与回款状态' },
  { id: 'reconciliations', label: '对账单', desc: '订单-发票对账与差异' },
  { id: 'profile', label: '企业档案', desc: '企业能力与资质信息' },
  { id: 'qualifications', label: '资质认证', desc: '证照档案与有效期' },
  { id: 'team', label: '员工管理', desc: '成员账号与启停' },
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

// Aggregate pages expose several domains; restricted roles enter their first authorized module.
const portalModulePermissions: Record<string, Record<string, string>> = {
  platform: {
    overview: 'platform:*', tenants: 'platform:tenant:read', reviews: 'platform:enterprise:read',
    'supplier-credit': 'platform:supplier:read', announcements: 'platform:announcement:read',
    settings: 'platform:dictionary:read',
  },
  supplier: {
    overview: 'supplier:*', 'rfq-projects': 'supplier:rfq:read', 'auction-projects': 'supplier:rfq:read',
    'mall-projects': 'supplier:order:read', 'tender-projects': 'supplier:tender:read',
    orders: 'supplier:order:read', deliveries: 'supplier:delivery:read', shelf: 'supplier:mall:read',
    invoices: 'supplier:invoice:read', reconciliations: 'supplier:invoice:read',
    profile: 'supplier:profile:read', qualifications: 'supplier:qualification:read', team: 'supplier:user:read',
  },
};

export function visiblePortalModules(navigation: AdminRoleNavigation, permissions: string[]) {
  return navigation.modules.filter(module =>
    hasPermission(permissions, portalModulePermissions[navigation.id]?.[module.id] ?? `${navigation.id}:*`));
}

export const platformNavigation: AdminRoleNavigation = {
  id: 'platform',
  label: '平台运营端',
  shortLabel: '平台',
  desc: '租户 / 审核 / 公告',
  modules: platformAdminModules,
};
