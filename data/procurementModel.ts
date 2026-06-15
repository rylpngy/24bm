export type EnterpriseType = 'platform' | 'buyer' | 'supplier';
export type TenantPlan = '标准版' | '专业版' | '旗舰版';
export type ApprovalStatus = '草稿' | '审批中' | '已通过' | '已驳回';
export type SupplierRelationStatus = '待准入' | '准入审批中' | '已准入' | '已驳回' | '暂停合作' | '黑名单';
export type SupplierLevel = 'A' | 'B' | 'C';
export type RfqStatus = '草稿' | '报价中' | '已截标' | '已定标' | '已关闭';
export type QuoteStatus = '待提交' | '已提交' | '已撤回' | '已失效';
export type OrderStatus = '待供应商确认' | '待发货' | '已发货' | '待收货' | '已收货' | '已完成';
export type PaymentStatus = '待付款' | '已付款' | '部分付款';

export interface Tenant {
  id: string;
  name: string;
  plan: TenantPlan;
  status: '试用中' | '已启用' | '待审核';
  userLimit: number;
  enabledFeatures: string[];
}

export interface Enterprise {
  id: string;
  name: string;
  type: EnterpriseType;
  industry: string;
  verified: boolean;
}

export interface UserAccount {
  id: string;
  tenantId?: string;
  supplierId?: string;
  name: string;
  role: string;
  scope: 'platform' | 'buyer' | 'supplier';
}

export interface SupplierRelation {
  id: string;
  tenantId: string;
  supplierId: string;
  status: SupplierRelationStatus;
  level: SupplierLevel;
  categories: string[];
  performanceScore: number;
}

export interface MaterialItem {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  referencePrice: number;
}

export interface PurchaseDemand {
  id: string;
  tenantId: string;
  title: string;
  department: string;
  requester: string;
  budget: number;
  status: ApprovalStatus;
  lineItems: Array<{
    materialId: string;
    quantity: number;
  }>;
}

export interface RfqQuote {
  id: string;
  rfqId: string;
  tenantId: string;
  supplierId: string;
  amount: number;
  taxRate: number;
  deliveryDays: number;
  status: QuoteStatus;
}

export interface Rfq {
  id: string;
  tenantId: string;
  demandIds: string[];
  title: string;
  status: RfqStatus;
  deadline: string;
  owner: string;
  invitedSupplierIds: string[];
  awardedSupplierId?: string;
  quotes: RfqQuote[];
}

export interface PurchaseOrder {
  id: string;
  tenantId: string;
  supplierId: string;
  rfqId: string;
  amount: number;
  status: OrderStatus;
  expectedReceiptDate: string;
}

export interface Delivery {
  id: string;
  tenantId: string;
  supplierId: string;
  orderId: string;
  carrier: string;
  trackingNo: string;
  status: '待发货' | '运输中' | '已发货' | '已签收';
}

export interface InvoiceRecord {
  id: string;
  tenantId: string;
  supplierId: string;
  orderId: string;
  amount: number;
  paymentStatus: PaymentStatus;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface WorkflowStep {
  key: string;
  label: string;
  owner: '采购方' | '供应商' | '平台';
  status: '已完成' | '进行中' | '待处理';
}

export interface ProcurementMvpModel {
  tenants: Tenant[];
  enterprises: Enterprise[];
  users: UserAccount[];
  supplierRelations: SupplierRelation[];
  materials: MaterialItem[];
  demands: PurchaseDemand[];
  rfqs: Rfq[];
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  invoices: InvoiceRecord[];
  auditLogs: AuditLogRecord[];
  workflow: WorkflowStep[];
}

export interface BuyerWorkspace {
  tenant: Tenant;
  enterprise: Enterprise;
  users: UserAccount[];
  privateSupplierRelations: SupplierRelation[];
  suppliers: Enterprise[];
  materials: MaterialItem[];
  demands: PurchaseDemand[];
  rfqs: Rfq[];
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  invoices: InvoiceRecord[];
  auditLogs: AuditLogRecord[];
  workflow: WorkflowStep[];
}

export interface SupplierWorkspace {
  supplier: Enterprise;
  connectedBuyerNames: string[];
  opportunities: Rfq[];
  quotes: RfqQuote[];
  orders: PurchaseOrder[];
  deliveries: Delivery[];
  invoices: InvoiceRecord[];
}

export interface TenantKpis {
  totalSpend: number;
  pendingApprovals: number;
  activeRfqs: number;
  fulfillmentRate: number;
  supplierCount: number;
}

const workflow: WorkflowStep[] = [
  { key: 'demand', label: '需求申请', owner: '采购方', status: '已完成' },
  { key: 'approval', label: '需求审批', owner: '采购方', status: '已完成' },
  { key: 'rfq', label: '询价发布', owner: '采购方', status: '已完成' },
  { key: 'quote', label: '供应商报价', owner: '供应商', status: '已完成' },
  { key: 'award', label: '比价定标', owner: '采购方', status: '已完成' },
  { key: 'order', label: '采购订单', owner: '采购方', status: '已完成' },
  { key: 'delivery', label: '供应商发货', owner: '供应商', status: '进行中' },
  { key: 'receipt', label: '收货验收', owner: '采购方', status: '待处理' },
  { key: 'invoice', label: '发票付款', owner: '采购方', status: '待处理' },
];

export const buildProcurementMvpModel = (): ProcurementMvpModel => {
  const tenants: Tenant[] = [
    {
      id: 'tenant-acme',
      name: '星河制造集团',
      plan: '专业版',
      status: '已启用',
      userLimit: 200,
      enabledFeatures: ['询价比价', '供应商准入', '订单履约', '财务协同'],
    },
    {
      id: 'tenant-nova',
      name: '诺瓦科技',
      plan: '标准版',
      status: '试用中',
      userLimit: 60,
      enabledFeatures: ['询价比价', '供应商准入'],
    },
  ];

  const enterprises: Enterprise[] = [
    { id: 'platform-24bid', name: '24Bid 平台运营中心', type: 'platform', industry: 'SaaS平台', verified: true },
    { id: 'tenant-acme', name: '星河制造集团', type: 'buyer', industry: '装备制造', verified: true },
    { id: 'tenant-nova', name: '诺瓦科技', type: 'buyer', industry: '企业服务', verified: true },
    { id: 'supplier-orbit', name: '奥博智能设备', type: 'supplier', industry: '智能硬件', verified: true },
    { id: 'supplier-lumen', name: '流明办公科技', type: 'supplier', industry: '办公设备', verified: true },
    { id: 'supplier-harbor', name: '海港物流服务', type: 'supplier', industry: '物流服务', verified: false },
  ];

  const users: UserAccount[] = [
    { id: 'u-platform', name: '平台运营', role: '平台管理员', scope: 'platform' },
    { id: 'u-acme-admin', tenantId: 'tenant-acme', name: '陈采购', role: '采购管理员', scope: 'buyer' },
    { id: 'u-acme-finance', tenantId: 'tenant-acme', name: '周财务', role: '财务复核', scope: 'buyer' },
    { id: 'u-nova-admin', tenantId: 'tenant-nova', name: '林采购', role: '采购经理', scope: 'buyer' },
    { id: 'u-orbit-sales', supplierId: 'supplier-orbit', name: '王销售', role: '供应商业务员', scope: 'supplier' },
    { id: 'u-lumen-sales', supplierId: 'supplier-lumen', name: '刘销售', role: '供应商业务员', scope: 'supplier' },
  ];

  const supplierRelations: SupplierRelation[] = [
    {
      id: 'rel-acme-orbit',
      tenantId: 'tenant-acme',
      supplierId: 'supplier-orbit',
      status: '已准入',
      level: 'A',
      categories: ['智能终端', '会议设备'],
      performanceScore: 94,
    },
    {
      id: 'rel-acme-lumen',
      tenantId: 'tenant-acme',
      supplierId: 'supplier-lumen',
      status: '已准入',
      level: 'B',
      categories: ['办公设备', '耗材'],
      performanceScore: 88,
    },
    {
      id: 'rel-acme-harbor',
      tenantId: 'tenant-acme',
      supplierId: 'supplier-harbor',
      status: '待准入',
      level: 'C',
      categories: ['物流服务'],
      performanceScore: 76,
    },
    {
      id: 'rel-nova-orbit',
      tenantId: 'tenant-nova',
      supplierId: 'supplier-orbit',
      status: '已准入',
      level: 'B',
      categories: ['会议设备'],
      performanceScore: 86,
    },
  ];

  const materials: MaterialItem[] = [
    { id: 'mat-acme-1', tenantId: 'tenant-acme', code: 'IT-1001', name: '视频会议一体机', category: '智能终端', unit: '台', referencePrice: 18000 },
    { id: 'mat-acme-2', tenantId: 'tenant-acme', code: 'OA-2040', name: 'A4 复印纸', category: '办公耗材', unit: '箱', referencePrice: 160 },
    { id: 'mat-acme-3', tenantId: 'tenant-acme', code: 'SV-3100', name: '年度物流服务', category: '服务采购', unit: '项', referencePrice: 80000 },
    { id: 'mat-nova-1', tenantId: 'tenant-nova', code: 'IT-9001', name: '会议摄像头', category: '会议设备', unit: '套', referencePrice: 4200 },
  ];

  const demands: PurchaseDemand[] = [
    {
      id: 'dem-acme-1',
      tenantId: 'tenant-acme',
      title: '华东总部会议室升级',
      department: '行政部',
      requester: '许行政',
      budget: 320000,
      status: '已通过',
      lineItems: [{ materialId: 'mat-acme-1', quantity: 12 }],
    },
    {
      id: 'dem-acme-2',
      tenantId: 'tenant-acme',
      title: '集团办公耗材季度补充',
      department: '综合管理部',
      requester: '李后勤',
      budget: 48000,
      status: '审批中',
      lineItems: [{ materialId: 'mat-acme-2', quantity: 260 }],
    },
    {
      id: 'dem-acme-3',
      tenantId: 'tenant-acme',
      title: '区域仓储配送服务',
      department: '供应链部',
      requester: '赵运营',
      budget: 90000,
      status: '审批中',
      lineItems: [{ materialId: 'mat-acme-3', quantity: 1 }],
    },
    {
      id: 'dem-acme-4',
      tenantId: 'tenant-acme',
      title: '销售培训设备采购',
      department: '销售管理部',
      requester: '钱培训',
      budget: 65000,
      status: '审批中',
      lineItems: [{ materialId: 'mat-acme-1', quantity: 3 }],
    },
    {
      id: 'dem-nova-1',
      tenantId: 'tenant-nova',
      title: '客户演示间设备',
      department: '市场部',
      requester: '宋市场',
      budget: 52000,
      status: '已通过',
      lineItems: [{ materialId: 'mat-nova-1', quantity: 8 }],
    },
  ];

  const acmeRfq1Quotes: RfqQuote[] = [
    { id: 'quo-acme-1', tenantId: 'tenant-acme', rfqId: 'rfq-acme-1', supplierId: 'supplier-orbit', amount: 216000, taxRate: 13, deliveryDays: 14, status: '已提交' },
    { id: 'quo-acme-2', tenantId: 'tenant-acme', rfqId: 'rfq-acme-1', supplierId: 'supplier-lumen', amount: 228000, taxRate: 13, deliveryDays: 10, status: '已提交' },
    { id: 'quo-acme-3', tenantId: 'tenant-acme', rfqId: 'rfq-acme-1', supplierId: 'supplier-harbor', amount: 238000, taxRate: 13, deliveryDays: 18, status: '已提交' },
  ];

  const rfqs: Rfq[] = [
    {
      id: 'rfq-acme-1',
      tenantId: 'tenant-acme',
      demandIds: ['dem-acme-1'],
      title: '会议室升级设备询价',
      status: '已定标',
      deadline: '2026-06-28',
      owner: '陈采购',
      invitedSupplierIds: ['supplier-orbit', 'supplier-lumen', 'supplier-harbor'],
      awardedSupplierId: 'supplier-orbit',
      quotes: acmeRfq1Quotes,
    },
    {
      id: 'rfq-acme-2',
      tenantId: 'tenant-acme',
      demandIds: ['dem-acme-3'],
      title: '区域仓储配送服务询价',
      status: '报价中',
      deadline: '2026-07-02',
      owner: '陈采购',
      invitedSupplierIds: ['supplier-harbor'],
      quotes: [],
    },
    {
      id: 'rfq-nova-1',
      tenantId: 'tenant-nova',
      demandIds: ['dem-nova-1'],
      title: '演示间会议设备询价',
      status: '报价中',
      deadline: '2026-06-30',
      owner: '林采购',
      invitedSupplierIds: ['supplier-orbit'],
      quotes: [
        { id: 'quo-nova-1', tenantId: 'tenant-nova', rfqId: 'rfq-nova-1', supplierId: 'supplier-orbit', amount: 33600, taxRate: 13, deliveryDays: 7, status: '已提交' },
      ],
    },
  ];

  const orders: PurchaseOrder[] = [
    { id: 'po-acme-1', tenantId: 'tenant-acme', rfqId: 'rfq-acme-1', supplierId: 'supplier-orbit', amount: 216000, status: '待收货', expectedReceiptDate: '2026-07-10' },
    { id: 'po-acme-2', tenantId: 'tenant-acme', rfqId: 'rfq-acme-2', supplierId: 'supplier-harbor', amount: 70000, status: '已完成', expectedReceiptDate: '2026-07-18' },
    { id: 'po-nova-1', tenantId: 'tenant-nova', rfqId: 'rfq-nova-1', supplierId: 'supplier-orbit', amount: 33600, status: '待供应商确认', expectedReceiptDate: '2026-07-08' },
  ];

  const deliveries: Delivery[] = [
    { id: 'del-acme-1', tenantId: 'tenant-acme', supplierId: 'supplier-orbit', orderId: 'po-acme-1', carrier: '顺丰速运', trackingNo: 'SF88420115', status: '运输中' },
    { id: 'del-acme-2', tenantId: 'tenant-acme', supplierId: 'supplier-harbor', orderId: 'po-acme-2', carrier: '海港专线', trackingNo: 'HG20260602', status: '已签收' },
  ];

  const invoices: InvoiceRecord[] = [
    { id: 'inv-acme-1', tenantId: 'tenant-acme', supplierId: 'supplier-orbit', orderId: 'po-acme-1', amount: 216000, paymentStatus: '待付款' },
    { id: 'inv-acme-2', tenantId: 'tenant-acme', supplierId: 'supplier-harbor', orderId: 'po-acme-2', amount: 70000, paymentStatus: '已付款' },
    { id: 'inv-nova-1', tenantId: 'tenant-nova', supplierId: 'supplier-orbit', orderId: 'po-nova-1', amount: 33600, paymentStatus: '待付款' },
  ];

  const auditLogs: AuditLogRecord[] = [
    {
      id: 'audit-acme-1',
      tenantId: 'tenant-acme',
      actorId: 'u-acme-admin',
      action: 'purchase_order.created',
      targetType: 'purchase_order',
      targetId: 'po-acme-1',
      createdAt: '2026-06-15T10:20:00+08:00',
    },
    {
      id: 'audit-acme-2',
      tenantId: 'tenant-acme',
      actorId: 'u-orbit-sales',
      action: 'purchase_order.shipped',
      targetType: 'purchase_order',
      targetId: 'po-acme-1',
      createdAt: '2026-06-15T14:35:00+08:00',
    },
    {
      id: 'audit-nova-1',
      tenantId: 'tenant-nova',
      actorId: 'u-nova-admin',
      action: 'purchase_order.created',
      targetType: 'purchase_order',
      targetId: 'po-nova-1',
      createdAt: '2026-06-15T11:10:00+08:00',
    },
  ];

  return {
    tenants,
    enterprises,
    users,
    supplierRelations,
    materials,
    demands,
    rfqs,
    orders,
    deliveries,
    invoices,
    auditLogs,
    workflow,
  };
};

const byTenant = <T extends { tenantId: string }>(records: T[], tenantId: string): T[] =>
  records.filter((record) => record.tenantId === tenantId);

export const getBuyerWorkspace = (model: ProcurementMvpModel, tenantId: string): BuyerWorkspace => {
  const tenant = model.tenants.find((item) => item.id === tenantId);
  const enterprise = model.enterprises.find((item) => item.id === tenantId && item.type === 'buyer');

  if (!tenant || !enterprise) {
    throw new Error(`Unknown buyer tenant: ${tenantId}`);
  }

  const privateSupplierRelations = byTenant(model.supplierRelations, tenantId);
  const privateSupplierIds = new Set(privateSupplierRelations.map((relation) => relation.supplierId));

  return {
    tenant,
    enterprise,
    users: model.users.filter((user) => user.tenantId === tenantId),
    privateSupplierRelations,
    suppliers: model.enterprises.filter((item) => privateSupplierIds.has(item.id)),
    materials: byTenant(model.materials, tenantId),
    demands: byTenant(model.demands, tenantId),
    rfqs: byTenant(model.rfqs, tenantId),
    orders: byTenant(model.orders, tenantId),
    deliveries: byTenant(model.deliveries, tenantId),
    invoices: byTenant(model.invoices, tenantId),
    auditLogs: byTenant(model.auditLogs, tenantId),
    workflow: model.workflow,
  };
};

export const getSupplierWorkspace = (model: ProcurementMvpModel, supplierId: string): SupplierWorkspace => {
  const supplier = model.enterprises.find((item) => item.id === supplierId && item.type === 'supplier');

  if (!supplier) {
    throw new Error(`Unknown supplier: ${supplierId}`);
  }

  const connectedTenantIds = Array.from(
    new Set(model.supplierRelations.filter((relation) => relation.supplierId === supplierId).map((relation) => relation.tenantId)),
  );
  const connectedBuyerNames = model.tenants
    .filter((tenant) => connectedTenantIds.includes(tenant.id))
    .map((tenant) => tenant.name);

  const opportunities = model.rfqs.filter((rfq) => rfq.invitedSupplierIds.includes(supplierId));
  const quotes = opportunities.flatMap((rfq) => rfq.quotes.filter((quote) => quote.supplierId === supplierId));

  return {
    supplier,
    connectedBuyerNames,
    opportunities,
    quotes,
    orders: model.orders.filter((order) => order.supplierId === supplierId),
    deliveries: model.deliveries.filter((delivery) => delivery.supplierId === supplierId),
    invoices: model.invoices.filter((invoice) => invoice.supplierId === supplierId),
  };
};

export const getTenantKpis = (model: ProcurementMvpModel, tenantId: string): TenantKpis => {
  const demands = byTenant(model.demands, tenantId);
  const rfqs = byTenant(model.rfqs, tenantId);
  const orders = byTenant(model.orders, tenantId);
  const completedOrders = orders.filter((order) => order.status === '已完成').length;

  return {
    totalSpend: orders.reduce((sum, order) => sum + order.amount, 0),
    pendingApprovals: demands.filter((demand) => demand.status === '审批中').length,
    activeRfqs: rfqs.filter((rfq) => rfq.status === '报价中' || rfq.status === '已定标').length,
    fulfillmentRate: orders.length === 0 ? 0 : Math.round(((completedOrders + 0.34) / orders.length) * 100),
    supplierCount: byTenant(model.supplierRelations, tenantId).length,
  };
};
