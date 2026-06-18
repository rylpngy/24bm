import type { BuyerAdminModule } from './adminNavigation';
import { approvalTypeLabel } from './approvalUi';
import {
  describeInvoiceNextAction,
  describeOrderNextAction,
  describeRfqNextAction,
  selectRecommendedQuote,
  type BuyerNextAction,
} from './buyerWorkflow';
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

export interface ApprovalQueueRow {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  bizId?: string;
  bizType?: string;
  facts: BuyerModuleFact[];
  canReview: boolean;
}

export interface SupplierRelationRow {
  id: string;
  supplierId: string;
  supplierName: string;
  status: string;
  level: string;
  categoryLabel: string;
  facts: BuyerModuleFact[];
  action: SupplierRelationAction;
}

export interface SupplierDetailRfqRow {
  id: string;
  title: string;
  status: string;
  quoteLabel: string;
}

export interface SupplierDetailOrderRow {
  id: string;
  status: string;
  amountLabel: string;
}

export interface SupplierDetailPanel {
  id: string;
  supplierId: string;
  supplierName: string;
  status: string;
  level: string;
  facts: BuyerModuleFact[];
  actionTitle: string;
  riskLabel: string;
  collaborationRows: BuyerModuleFact[];
  rfqRows: SupplierDetailRfqRow[];
  orderRows: SupplierDetailOrderRow[];
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

export interface RfqDetailDemandRow {
  id: string;
  title: string;
  status: string;
  budgetLabel: string;
}

export interface RfqDetailSupplierRow {
  id: string;
  name: string;
  status: string;
}

export interface RfqDetailQuoteRow {
  id: string;
  supplierName: string;
  amountLabel: string;
  deliveryLabel: string;
  taxLabel: string;
  status: string;
  rankLabel: string;
  recommended: boolean;
  awarded: boolean;
}

export interface RfqDetailPanel {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  demandRows: RfqDetailDemandRow[];
  supplierRows: RfqDetailSupplierRow[];
  quoteRows: RfqDetailQuoteRow[];
  recommendedSupplierLabel: string;
  orderLabel: string;
  nextActionTitle: string;
}

export interface DemandListRow {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  materialSummary: string;
  nextAction: BuyerNextAction;
}

export interface DemandDetailLineItemRow {
  id: string;
  name: string;
  category: string;
  quantityLabel: string;
  referenceAmountLabel: string;
}

export interface DemandDetailRfqRow {
  id: string;
  title: string;
  status: string;
  quoteLabel: string;
}

export interface DemandDetailPanel {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  lineItems: DemandDetailLineItemRow[];
  linkedRfqs: DemandDetailRfqRow[];
  approvalLabel: string;
  nextActionTitle: string;
}

export interface AuditLogRow {
  id: string;
  title: string;
  targetLabel: string;
  actorName: string;
  timeLabel: string;
}

export interface OrderFulfillmentRow {
  id: string;
  supplierName: string;
  amountLabel: string;
  status: string;
  facts: BuyerModuleFact[];
  nextAction: BuyerNextAction;
  canRegisterReceipt: boolean;
}

export interface OrderDetailDelivery {
  id: string;
  carrier: string;
  trackingNo: string;
  status: string;
}

export interface OrderDetailInvoice {
  id: string;
  amountLabel: string;
  paymentStatus: string;
}

export interface OrderDetailPanel {
  id: string;
  supplierName: string;
  status: string;
  amountLabel: string;
  facts: BuyerModuleFact[];
  delivery?: OrderDetailDelivery;
  invoice?: OrderDetailInvoice;
  rfqLabel: string;
  nextActionTitle: string;
}

export interface ReceiptInspectionRow {
  id: string;
  supplierName: string;
  status: string;
  logisticsLabel: string;
  nextAction: BuyerNextAction;
  canRegisterReceipt: boolean;
}

export interface InvoicePaymentRow {
  id: string;
  supplierName: string;
  orderLabel: string;
  amountLabel: string;
  status: string;
  nextAction: BuyerNextAction;
  canRegisterPayment: boolean;
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

const auditActionLabels: Record<string, string> = {
  'purchase_demand.created': '需求创建',
  'purchase_demand.approved': '需求通过',
  'purchase_demand.rejected': '需求驳回',
  'buyer_supplier_admission.submitted': '供应商准入提交',
  'buyer_supplier_admission.approved': '供应商准入通过',
  'buyer_supplier_admission.rejected': '供应商准入驳回',
  'rfq_award.submitted': '定标提交',
  'rfq_award.approved': '定标通过',
  'rfq_award.rejected': '定标驳回',
  'purchase_order.created': '订单创建',
  'purchase_order.confirmed': '订单确认',
  'purchase_order.shipped': '供应商发货',
  'purchase_order.received': '采购收货',
  'invoice.created': '发票登记',
  'invoice.paid': '付款完成',
  'invoice.partial_paid': '部分付款',
};

const auditTargetLabels: Record<string, string> = {
  purchase_demand: '需求',
  buyer_supplier_relation: '供应商关系',
  rfq_award: '定标',
  purchase_order: '订单',
  invoice: '发票',
};

const compactDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));

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

export const buildApprovalQueueRows = (
  approvals: ApprovalCardSource[],
  nowIso = new Date().toISOString(),
): ApprovalQueueRow[] =>
  approvals.map((approval) => ({
    id: approval.id ?? `${approval.bizType}:${approval.bizId}`,
    title: approval.summaryTitle ?? approval.bizId ?? '待审批事项',
    typeLabel: approvalTypeLabel(approval.bizType ?? ''),
    status: approval.status ?? '待审批',
    bizId: approval.bizId,
    bizType: approval.bizType,
    facts: buildApprovalCardFacts(approval, nowIso),
    canReview: approval.status === undefined || approval.status === '待审批',
  }));

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

export const buildSupplierRelationRows = (workspace: BuyerWorkspace): SupplierRelationRow[] =>
  workspace.privateSupplierRelations.map((relation) => {
    const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
    return {
      id: relation.id,
      supplierId: relation.supplierId,
      supplierName: supplier?.name ?? relation.supplierId,
      status: relation.status,
      level: relation.level,
      categoryLabel: relation.categories.join(' / '),
      facts: [
        { label: '授权品类', value: `${relation.categories.length} 类` },
        { label: '绩效评分', value: `${relation.performanceScore} 分` },
        { label: '企业认证', value: supplier?.verified ? '已认证' : '待认证' },
        { label: '所属行业', value: supplier?.industry ?? '未维护' },
      ],
      action: describeSupplierRelationAction(relation),
    };
  });

export const buildSupplierDetailPanel = (
  workspace: BuyerWorkspace,
  relationId: string,
): SupplierDetailPanel | undefined => {
  const relation = workspace.privateSupplierRelations.find((item) => item.id === relationId);
  if (!relation) return undefined;

  const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
  const action = describeSupplierRelationAction(relation);
  const rfqs = workspace.rfqs.filter((rfq) => rfq.invitedSupplierIds.includes(relation.supplierId));
  const quotes = rfqs.flatMap((rfq) => rfq.quotes.filter((quote) => quote.supplierId === relation.supplierId));
  const orders = workspace.orders.filter((order) => order.supplierId === relation.supplierId);
  const invoices = workspace.invoices.filter((invoice) => invoice.supplierId === relation.supplierId);
  const invoiceAmount = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  return {
    id: relation.id,
    supplierId: relation.supplierId,
    supplierName: supplier?.name ?? relation.supplierId,
    status: relation.status,
    level: relation.level,
    facts: [
      { label: '所属行业', value: supplier?.industry ?? '未维护' },
      { label: '企业认证', value: supplier?.verified ? '已认证' : '待认证' },
      { label: '授权品类', value: relation.categories.join(' / ') },
      { label: '绩效评分', value: `${relation.performanceScore} 分` },
    ],
    actionTitle: action.title,
    riskLabel: action.riskLabel,
    collaborationRows: [
      { label: '参与询价', value: `${rfqs.length} 个` },
      { label: '已提交报价', value: `${quotes.length} 条` },
      { label: '采购订单', value: `${orders.length} 单` },
      { label: '发票金额', value: compactCurrency(invoiceAmount) },
    ],
    rfqRows: rfqs.map((rfq) => ({
      id: rfq.id,
      title: rfq.title,
      status: rfq.status,
      quoteLabel: rfq.quotes.some((quote) => quote.supplierId === relation.supplierId) ? '已报价' : '待报价',
    })),
    orderRows: orders.map((order) => ({
      id: order.id,
      status: order.status,
      amountLabel: compactCurrency(order.amount),
    })),
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

export const buildRfqDetailPanel = (
  workspace: BuyerWorkspace,
  rfqId: string,
): RfqDetailPanel | undefined => {
  const rfq = workspace.rfqs.find((item) => item.id === rfqId);
  if (!rfq) return undefined;

  const recommendedQuote = selectRecommendedQuote(rfq);
  const generatedOrder = workspace.orders.find((order) => order.rfqId === rfq.id);
  const nextAction = generatedOrder
    ? describeOrderNextAction(generatedOrder)
    : describeRfqNextAction(rfq, undefined, workspace.orders);
  const rankedQuotes = [...rfq.quotes]
    .sort((left, right) => {
      const amountDelta = left.amount - right.amount;
      if (amountDelta !== 0) return amountDelta;
      return left.deliveryDays - right.deliveryDays;
    });

  const supplierName = (supplierId: string) =>
    workspace.suppliers.find((supplier) => supplier.id === supplierId)?.name ?? supplierId;

  return {
    id: rfq.id,
    title: rfq.title,
    status: rfq.status,
    facts: [
      { label: '负责人', value: rfq.owner },
      { label: '截止时间', value: rfq.deadline },
      { label: '关联需求', value: `${rfq.demandIds.length} 条` },
      { label: '报价响应', value: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length}` },
    ],
    demandRows: rfq.demandIds.map((demandId) => {
      const demand = workspace.demands.find((item) => item.id === demandId);
      return {
        id: demandId,
        title: demand?.title ?? demandId,
        status: demand?.status ?? '未找到',
        budgetLabel: compactCurrency(demand?.budget ?? 0),
      };
    }),
    supplierRows: rfq.invitedSupplierIds.map((supplierId) => ({
      id: supplierId,
      name: supplierName(supplierId),
      status: rfq.quotes.some((quote) => quote.supplierId === supplierId) ? '已报价' : '待报价',
    })),
    quoteRows: rankedQuotes.map((quote, index) => ({
      id: quote.id,
      supplierName: supplierName(quote.supplierId),
      amountLabel: compactCurrency(quote.amount),
      deliveryLabel: `${quote.deliveryDays} 天`,
      taxLabel: `${quote.taxRate}%`,
      status: quote.status,
      rankLabel: `第 ${index + 1} 名`,
      recommended: recommendedQuote?.id === quote.id,
      awarded: rfq.awardedSupplierId === quote.supplierId,
    })),
    recommendedSupplierLabel: recommendedQuote
      ? `推荐：${supplierName(recommendedQuote.supplierId)} ${compactCurrency(recommendedQuote.amount)}`
      : '暂无可推荐报价',
    orderLabel: generatedOrder ? `已生成订单 ${generatedOrder.id}` : '暂未生成采购订单',
    nextActionTitle: nextAction.title,
  };
};

const describeDemandNextAction = (
  demand: BuyerWorkspace['demands'][number],
  linkedDemandIds: Set<string>,
): BuyerNextAction => {
  if (demand.status === '草稿') {
    return {
      title: '待提交审批',
      detail: '需求提交审批通过后，才能创建询价项目。',
      tone: 'blue',
    };
  }

  if (demand.status === '审批中') {
    return {
      title: '等待需求审批',
      detail: '审批通过后可邀请已准入供应商创建询价。',
      tone: 'amber',
    };
  }

  if (demand.status === '已通过' && linkedDemandIds.has(demand.id)) {
    return {
      title: '已关联询价项目',
      detail: '需求已经进入询价流程，可在询价项目或报价对比页继续跟进。',
      tone: 'emerald',
    };
  }

  if (demand.status === '已通过') {
    return {
      title: '可创建询价',
      detail: '选择已准入供应商后，可将需求转为询价项目。',
      tone: 'blue',
    };
  }

  return {
    title: '需求未通过',
    detail: '需求审批未通过，需调整后重新提交。',
    tone: 'slate',
  };
};

export const buildDemandListRows = (workspace: BuyerWorkspace): DemandListRow[] => {
  const linkedDemandIds = new Set(workspace.rfqs.flatMap((rfq) => rfq.demandIds));
  return workspace.demands.map((demand) => {
    const materialSummary = demand.lineItems.map((item) => {
      const material = workspace.materials.find((record) => record.id === item.materialId);
      return `${material?.name ?? item.materialId} x ${item.quantity} ${material?.unit ?? ''}`.trim();
    }).join(' / ');
    return {
      id: demand.id,
      title: demand.title,
      status: demand.status,
      facts: [
        { label: '申请部门', value: demand.department },
        { label: '申请人', value: demand.requester },
        { label: '预算', value: compactCurrency(demand.budget) },
        { label: '物料行', value: `${demand.lineItems.length} 行` },
      ],
      materialSummary,
      nextAction: describeDemandNextAction(demand, linkedDemandIds),
    };
  });
};

export const buildDemandDetailPanel = (
  workspace: BuyerWorkspace,
  demandId: string,
): DemandDetailPanel | undefined => {
  const demand = workspace.demands.find((item) => item.id === demandId);
  if (!demand) return undefined;

  const linkedDemandIds = new Set(workspace.rfqs.flatMap((rfq) => rfq.demandIds));
  const nextAction = describeDemandNextAction(demand, linkedDemandIds);
  const approval = buildApprovalQueueRows(buildWorkspaceApprovalQueue(workspace))
    .find((item) => item.bizType === 'purchase_demand' && item.bizId === demand.id);

  return {
    id: demand.id,
    title: demand.title,
    status: demand.status,
    facts: [
      { label: '申请部门', value: demand.department },
      { label: '申请人', value: demand.requester },
      { label: '预算', value: compactCurrency(demand.budget) },
      { label: '物料行', value: `${demand.lineItems.length} 行` },
    ],
    lineItems: demand.lineItems.map((item) => {
      const material = workspace.materials.find((record) => record.id === item.materialId);
      const unit = material?.unit ?? '';
      return {
        id: `${demand.id}:${item.materialId}`,
        name: material?.name ?? item.materialId,
        category: material?.category ?? '未维护',
        quantityLabel: `${item.quantity} ${unit}`.trim(),
        referenceAmountLabel: compactCurrency((material?.referencePrice ?? 0) * item.quantity),
      };
    }),
    linkedRfqs: workspace.rfqs
      .filter((rfq) => rfq.demandIds.includes(demand.id))
      .map((rfq) => ({
        id: rfq.id,
        title: rfq.title,
        status: rfq.status,
        quoteLabel: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length} 已报价`,
      })),
    approvalLabel: approval ? `待审批：${approval.typeLabel}` : '暂无待审批',
    nextActionTitle: nextAction.title,
  };
};

const orderLogisticsLabel = (workspace: BuyerWorkspace, orderId: string) => {
  const delivery = workspace.deliveries.find((item) => item.orderId === orderId);
  return delivery ? `${delivery.carrier} ${delivery.trackingNo}` : '待发货';
};

const orderInvoiceStatus = (workspace: BuyerWorkspace, orderId: string) =>
  workspace.invoices.find((item) => item.orderId === orderId)?.paymentStatus ?? '待开票';

export const buildOrderDetailPanel = (
  workspace: BuyerWorkspace,
  orderId: string,
): OrderDetailPanel | undefined => {
  const order = workspace.orders.find((item) => item.id === orderId);
  if (!order) return undefined;

  const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
  const rfq = workspace.rfqs.find((item) => item.id === order.rfqId);
  const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
  const invoice = workspace.invoices.find((item) => item.orderId === order.id);
  const nextAction = describeOrderNextAction(order);

  return {
    id: order.id,
    supplierName: supplier?.name ?? order.supplierId,
    status: order.status,
    amountLabel: compactCurrency(order.amount),
    facts: [
      { label: '关联询价', value: rfq?.title ?? order.rfqId },
      { label: '预计到货', value: order.expectedReceiptDate },
      { label: '物流状态', value: delivery?.status ?? '待发货' },
      { label: '发票状态', value: invoice?.paymentStatus ?? '待开票' },
    ],
    delivery: delivery
      ? {
          id: delivery.id,
          carrier: delivery.carrier,
          trackingNo: delivery.trackingNo,
          status: delivery.status,
        }
      : undefined,
    invoice: invoice
      ? {
          id: invoice.id,
          amountLabel: compactCurrency(invoice.amount),
          paymentStatus: invoice.paymentStatus,
        }
      : undefined,
    rfqLabel: rfq?.title ?? order.rfqId,
    nextActionTitle: nextAction.title,
  };
};

export const buildOrderFulfillmentRows = (workspace: BuyerWorkspace): OrderFulfillmentRow[] =>
  workspace.orders.map((order) => {
    const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
    return {
      id: order.id,
      supplierName: supplier?.name ?? order.supplierId,
      amountLabel: compactCurrency(order.amount),
      status: order.status,
      facts: [
        { label: '预计到货', value: order.expectedReceiptDate },
        { label: '物流单号', value: orderLogisticsLabel(workspace, order.id) },
        { label: '发票状态', value: orderInvoiceStatus(workspace, order.id) },
      ],
      nextAction: describeOrderNextAction(order),
      canRegisterReceipt: order.status === '已发货',
    };
  });

export const buildReceiptInspectionRows = (workspace: BuyerWorkspace): ReceiptInspectionRow[] =>
  workspace.orders
    .filter((order) => order.status === '已发货' || order.status === '待收货')
    .map((order) => {
      const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
      return {
        id: order.id,
        supplierName: supplier?.name ?? order.supplierId,
        status: order.status,
        logisticsLabel: orderLogisticsLabel(workspace, order.id),
        nextAction: describeOrderNextAction(order),
        canRegisterReceipt: order.status === '已发货',
      };
    });

export const buildInvoicePaymentRows = (workspace: BuyerWorkspace): InvoicePaymentRow[] =>
  workspace.invoices.map((invoice) => {
    const supplier = workspace.suppliers.find((item) => item.id === invoice.supplierId);
    return {
      id: invoice.id,
      supplierName: supplier?.name ?? invoice.supplierId,
      orderLabel: `订单 ${invoice.orderId}`,
      amountLabel: compactCurrency(invoice.amount),
      status: invoice.paymentStatus,
      nextAction: describeInvoiceNextAction(invoice),
      canRegisterPayment: invoice.paymentStatus !== '已付款',
    };
  });

export const buildAuditLogRows = (workspace: BuyerWorkspace): AuditLogRow[] =>
  [...workspace.auditLogs]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6)
    .map((log) => {
      const actor = workspace.users.find((user) => user.id === log.actorId);
      const targetLabel = auditTargetLabels[log.targetType] ?? log.targetType;
      return {
        id: log.id,
        title: auditActionLabels[log.action] ?? log.action,
        targetLabel: `${targetLabel} · ${log.targetId}`,
        actorName: actor?.name ?? log.actorId,
        timeLabel: compactDateTime(log.createdAt),
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
