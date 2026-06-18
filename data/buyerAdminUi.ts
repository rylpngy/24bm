import type { BuyerAdminModule } from './adminNavigation';
import type { BuyerWorkspace, SupplierRelation } from './procurementModel';

export interface BuyerModuleFact {
  label: string;
  value: string;
}

export interface ApprovalCardSource {
  id?: string;
  bizType?: string;
  bizId?: string;
  summaryTitle?: string;
  businessStatus?: string | null;
  priority?: number | null;
  submittedByName?: string | null;
  amount?: number | null;
  counterpartyName?: string | null;
  status?: string;
  createdAt: string;
}

export interface SupplierRelationAction {
  title: string;
  detail: string;
  tone: 'slate' | 'blue' | 'amber' | 'emerald' | 'red';
  riskLabel: string;
}

export interface MaterialCatalogRow {
  id: string;
  title: string;
  facts: BuyerModuleFact[];
  usageLabel: string;
  status: string;
}

export interface RfqListRow {
  id: string;
  title: string;
  demandLabel: string;
  supplierLabel: string;
  quoteLabel: string;
  deadlineLabel: string;
  status: string;
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

const countBy = <T>(records: T[], predicate: (record: T) => boolean) =>
  records.filter(predicate).length;

const uniqueCount = (values: string[]) => new Set(values).size;

const elapsedLabel = (fromIso: string, nowIso: string) => {
  const elapsedMs = new Date(nowIso).getTime() - new Date(fromIso).getTime();
  const elapsedHours = Math.max(elapsedMs / 1000 / 60 / 60, 0);
  if (elapsedHours < 1) {
    return `${Math.round(elapsedHours * 60)} 分钟`;
  }
  if (elapsedHours < 24) {
    return `${Number(elapsedHours.toFixed(1))} 小时`;
  }
  return `${Math.floor(elapsedHours / 24)} 天`;
};

export const buildApprovalCardFacts = (
  approval: ApprovalCardSource,
  nowIso = new Date().toISOString(),
): BuyerModuleFact[] => [
  approval.businessStatus ? { label: '业务状态', value: approval.businessStatus } : undefined,
  typeof approval.priority === 'number' ? { label: '优先级', value: `P${approval.priority}` } : undefined,
  approval.submittedByName ? { label: '提交人', value: approval.submittedByName } : undefined,
  approval.counterpartyName ? { label: '相关方', value: approval.counterpartyName } : undefined,
  typeof approval.amount === 'number' ? { label: '金额', value: compactCurrency(approval.amount) } : undefined,
  { label: '已等待', value: elapsedLabel(approval.createdAt, nowIso) },
].filter((fact): fact is BuyerModuleFact => Boolean(fact));

export const buildWorkspaceApprovalQueue = (workspace: BuyerWorkspace): ApprovalCardSource[] => {
  const demandApprovals = workspace.demands
    .filter((demand) => demand.status === '审批中')
    .map((demand, index) => ({
      id: `approval-demand-${demand.id}`,
      bizType: 'purchase_demand',
      bizId: demand.id,
      summaryTitle: demand.title,
      businessStatus: demand.status,
      priority: Math.max(8 - index, 1),
      submittedByName: demand.requester,
      amount: demand.budget,
      status: '待审批',
      createdAt: new Date(Date.UTC(2026, 5, 18, 1 + index, 0, 0)).toISOString(),
    }));

  const supplierApprovals = workspace.privateSupplierRelations
    .filter((relation) => relation.status === '待准入' || relation.status === '准入审批中')
    .map((relation, index) => {
      const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
      return {
        id: `approval-supplier-${relation.id}`,
        bizType: 'buyer_supplier_admission',
        bizId: relation.id,
        summaryTitle: supplier?.name ?? relation.supplierId,
        businessStatus: relation.status,
        priority: 5,
        submittedByName: '采购管理员',
        counterpartyName: supplier?.name ?? relation.supplierId,
        status: '待审批',
        createdAt: new Date(Date.UTC(2026, 5, 18, 4 + index, 0, 0)).toISOString(),
      };
    });

  return [...demandApprovals, ...supplierApprovals];
};

const supplierRiskLabel = (performanceScore: number) => {
  if (performanceScore >= 90) return '绩效优秀';
  if (performanceScore >= 80) return '绩效稳定';
  return `绩效 ${performanceScore} 分`;
};

export const describeSupplierRelationAction = (relation: SupplierRelation): SupplierRelationAction => {
  if (relation.status === '待准入') {
    return {
      title: '待提交准入',
      detail: '补齐准入资料后提交审批，通过后才能参与采购协同。',
      tone: 'blue',
      riskLabel: supplierRiskLabel(relation.performanceScore),
    };
  }

  if (relation.status === '准入审批中') {
    return {
      title: '准入审批中',
      detail: '审批通过后供应商会进入可协作状态。',
      tone: 'amber',
      riskLabel: supplierRiskLabel(relation.performanceScore),
    };
  }

  if (relation.status === '已准入') {
    return {
      title: '可参与询价',
      detail: '供应商已准入，可按授权品类邀请参与询价。',
      tone: 'emerald',
      riskLabel: supplierRiskLabel(relation.performanceScore),
    };
  }

  if (relation.status === '黑名单' || relation.status === '暂停合作') {
    return {
      title: '限制合作',
      detail: '当前合作状态受限，需完成关系恢复后再邀请参与采购。',
      tone: 'red',
      riskLabel: supplierRiskLabel(relation.performanceScore),
    };
  }

  return {
    title: '需重新评估',
    detail: '当前关系未通过准入，建议复核资质、品类和绩效后再处理。',
    tone: 'slate',
    riskLabel: supplierRiskLabel(relation.performanceScore),
  };
};

export const buildMaterialCatalogRows = (workspace: BuyerWorkspace): MaterialCatalogRow[] =>
  workspace.materials.map((material) => {
    const usageCount = workspace.demands.filter((demand) =>
      demand.lineItems.some((item) => item.materialId === material.id)).length;
    return {
      id: material.id,
      title: material.name,
      facts: [
        { label: '物料编码', value: material.code },
        { label: '品类', value: material.category },
        { label: '单位', value: material.unit },
        { label: '参考价', value: compactCurrency(material.referencePrice) },
      ],
      usageLabel: usageCount > 0 ? `${usageCount} 个需求引用` : '暂无需求引用',
      status: '启用',
    };
  });

export const buildRfqListRows = (workspace: BuyerWorkspace): RfqListRow[] =>
  workspace.rfqs.map((rfq) => {
    const demands = rfq.demandIds
      .map((demandId) => workspace.demands.find((demand) => demand.id === demandId)?.title ?? demandId);
    return {
      id: rfq.id,
      title: rfq.title,
      demandLabel: demands.join(' / '),
      supplierLabel: `${rfq.invitedSupplierIds.length} 家已邀请`,
      quoteLabel: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length} 已报价`,
      deadlineLabel: rfq.deadline,
      status: rfq.status,
    };
  });

export const buildBuyerModuleFacts = (
  module: BuyerAdminModule,
  workspace: BuyerWorkspace,
  pendingApprovals: Array<{ id: string }>,
): BuyerModuleFact[] => {
  const allQuotes = workspace.rfqs.flatMap((rfq) => rfq.quotes);
  const receiptOrders = workspace.orders.filter((order) => order.status === '已发货' || order.status === '待收货');
  const payableInvoices = workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款');

  switch (module) {
    case 'dashboard':
      return [];
    case 'demands': {
      const linkedDemandIds = new Set(workspace.rfqs.flatMap((rfq) => rfq.demandIds));
      return [
        { label: '需求总数', value: `${workspace.demands.length} 条` },
        { label: '审批中', value: `${countBy(workspace.demands, (demand) => demand.status === '审批中')} 条` },
        { label: '待转询价', value: `${countBy(workspace.demands, (demand) => demand.status === '已通过' && !linkedDemandIds.has(demand.id))} 条` },
      ];
    }
    case 'approvals':
      return [
        { label: '待审批', value: `${pendingApprovals.length} 条` },
        { label: '需求审批中', value: `${countBy(workspace.demands, (demand) => demand.status === '审批中')} 条` },
        { label: '准入待处理', value: `${countBy(workspace.privateSupplierRelations, (relation) => relation.status === '待准入' || relation.status === '准入审批中')} 家` },
      ];
    case 'suppliers':
      return [
        { label: '私域供应商', value: `${workspace.privateSupplierRelations.length} 家` },
        { label: '已准入', value: `${countBy(workspace.privateSupplierRelations, (relation) => relation.status === '已准入')} 家` },
        { label: '平均绩效', value: `${Math.round(workspace.privateSupplierRelations.reduce((sum, relation) => sum + relation.performanceScore, 0) / Math.max(workspace.privateSupplierRelations.length, 1))} 分` },
      ];
    case 'materials':
      return [
        { label: '目录条目', value: `${workspace.materials.length} 项` },
        { label: '覆盖品类', value: `${uniqueCount(workspace.materials.map((material) => material.category))} 类` },
        { label: '参考均价', value: compactCurrency(Math.round(workspace.materials.reduce((sum, material) => sum + material.referencePrice, 0) / Math.max(workspace.materials.length, 1))) },
      ];
    case 'rfqs':
      return [
        { label: '询价项目', value: `${workspace.rfqs.length} 个` },
        { label: '报价中', value: `${countBy(workspace.rfqs, (rfq) => rfq.status === '报价中')} 个` },
        { label: '已邀请供应商', value: `${workspace.rfqs.reduce((sum, rfq) => sum + rfq.invitedSupplierIds.length, 0)} 家次` },
      ];
    case 'quotes':
      return [
        { label: '报价数量', value: `${allQuotes.length} 条` },
        { label: '可定标报价', value: `${countBy(allQuotes, (quote) => quote.status === '已提交')} 条` },
        { label: '已定标项目', value: `${countBy(workspace.rfqs, (rfq) => rfq.status === '已定标')} 个` },
      ];
    case 'orders':
      return [
        { label: '订单数量', value: `${workspace.orders.length} 单` },
        { label: '履约中', value: `${countBy(workspace.orders, (order) => order.status !== '已完成')} 单` },
        { label: '订单金额', value: compactCurrency(workspace.orders.reduce((sum, order) => sum + order.amount, 0)) },
      ];
    case 'receipts':
      return [
        { label: '待收货', value: `${receiptOrders.length} 单` },
        { label: '已有物流', value: `${workspace.deliveries.length} 条` },
        { label: '本期到货金额', value: compactCurrency(receiptOrders.reduce((sum, order) => sum + order.amount, 0)) },
      ];
    case 'invoices':
      return [
        { label: '发票数量', value: `${workspace.invoices.length} 张` },
        { label: '待付款', value: `${payableInvoices.length} 张` },
        { label: '待付金额', value: compactCurrency(payableInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)) },
      ];
    case 'audit':
      return [
        { label: '日志数量', value: `${workspace.auditLogs.length} 条` },
        { label: '操作人', value: `${uniqueCount(workspace.auditLogs.map((log) => log.actorId))} 人` },
        { label: '对象类型', value: `${uniqueCount(workspace.auditLogs.map((log) => log.targetType))} 类` },
      ];
    default:
      return [];
  }
};
