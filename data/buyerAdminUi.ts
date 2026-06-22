import type { BuyerAdminModule } from './adminNavigation';
import { approvalTypeLabel } from './approvalUi';
import {
  canSubmitAwardApproval,
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
  parentBizId?: string | null;
  summaryTitle?: string;
  businessStatus?: string | null;
  priority?: number | null;
  submittedByName?: string | null;
  amount?: number | null;
  counterpartyName?: string | null;
  status?: string;
  reviewComment?: string | null;
  createdAt: string;
  actedAt?: string | null;
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

export interface ApprovalDetailContextRow {
  id: string;
  title: string;
  detail: string;
}

export interface ApprovalDetailTimelineRow {
  label: string;
  value: string;
}

export interface ApprovalDetailCheckRow {
  label: string;
  value: string;
}

export interface ApprovalDetailPanel {
  id: string;
  title: string;
  typeLabel: string;
  status: string;
  canReview: boolean;
  facts: BuyerModuleFact[];
  businessFacts: BuyerModuleFact[];
  contextRows: ApprovalDetailContextRow[];
  reviewCheckRows: ApprovalDetailCheckRow[];
  timelineRows: ApprovalDetailTimelineRow[];
  reviewComment?: string | null;
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
  admissionCheckRows: BuyerModuleFact[];
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

export interface MaterialDetailDemandRow {
  id: string;
  title: string;
  status: string;
  quantityLabel: string;
  referenceAmountLabel: string;
}

export interface MaterialDetailRfqRow {
  id: string;
  title: string;
  status: string;
  quoteLabel: string;
}

export interface MaterialDetailSupplierCoverageRow {
  id: string;
  supplierName: string;
  status: string;
  level: string;
}

export interface MaterialDetailPanel {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  demandRows: MaterialDetailDemandRow[];
  rfqRows: MaterialDetailRfqRow[];
  supplierCoverageRows: MaterialDetailSupplierCoverageRow[];
  procurementReadinessRows: BuyerModuleFact[];
  usageSummary: BuyerModuleFact[];
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

export interface RfqDetailTimelineRow {
  label: string;
  value: string;
}

export interface RfqDetailRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface RfqDetailPanel {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  demandRows: RfqDetailDemandRow[];
  supplierRows: RfqDetailSupplierRow[];
  quoteRows: RfqDetailQuoteRow[];
  fulfillmentTimelineRows: RfqDetailTimelineRow[];
  relatedRows: RfqDetailRelatedRow[];
  recommendedSupplierLabel: string;
  orderLabel: string;
  nextActionTitle: string;
  awardApprovalComment?: string | null;
}

export interface QuoteComparisonRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface QuoteComparisonAwardTimelineRow {
  label: string;
  value: string;
}

export interface QuoteComparisonDetailPanel {
  id: string;
  title: string;
  status: string;
  recommendationLabel: string;
  canSubmitAward: boolean;
  facts: BuyerModuleFact[];
  recommendationFacts: BuyerModuleFact[];
  awardTimelineRows: QuoteComparisonAwardTimelineRow[];
  quoteRows: RfqDetailQuoteRow[];
  relatedRows: QuoteComparisonRelatedRow[];
  nextActionTitle: string;
  awardApprovalComment?: string | null;
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

export interface DemandDetailTimelineRow {
  label: string;
  value: string;
}

export interface DemandDetailRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface DemandDetailPanel {
  id: string;
  title: string;
  status: string;
  facts: BuyerModuleFact[];
  lineItems: DemandDetailLineItemRow[];
  linkedRfqs: DemandDetailRfqRow[];
  workflowTimelineRows: DemandDetailTimelineRow[];
  flowCheckRows: BuyerModuleFact[];
  relatedRows: DemandDetailRelatedRow[];
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

export interface AuditLogRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface AuditLogTimelineRow {
  label: string;
  value: string;
}

export interface AuditLogDetailPanel {
  id: string;
  title: string;
  actionCode: string;
  targetLabel: string;
  actorName: string;
  timeLabel: string;
  traceabilityTitle: string;
  traceabilityDesc: string;
  traceabilityStatus: string;
  facts: BuyerModuleFact[];
  targetFacts: BuyerModuleFact[];
  relatedRows: AuditLogRelatedRow[];
  traceabilityRows: BuyerModuleFact[];
  timelineRows: AuditLogTimelineRow[];
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

export interface OrderDetailTimelineRow {
  label: string;
  value: string;
}

export interface OrderDetailCheckRow {
  label: string;
  value: string;
}

export interface OrderDetailRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface OrderDetailPanel {
  id: string;
  supplierName: string;
  status: string;
  amountLabel: string;
  facts: BuyerModuleFact[];
  delivery?: OrderDetailDelivery;
  invoice?: OrderDetailInvoice;
  fulfillmentTimelineRows: OrderDetailTimelineRow[];
  fulfillmentCheckRows: OrderDetailCheckRow[];
  relatedRows: OrderDetailRelatedRow[];
  rfqLabel: string;
  nextActionTitle: string;
  sourceRfqLabel?: string | null;
  awardApprovalStatus?: string | null;
  awardApprovalComment?: string | null;
}

export interface ContractLedgerRow {
  id: string;
  contractNo: string;
  contractName: string;
  relatedOrderId: string;
  supplierName: string;
  amountLabel: string;
  status: string;
  archiveStatus: string;
  facts: BuyerModuleFact[];
  nextAction: BuyerNextAction;
}

export interface ContractFulfillmentRow {
  label: string;
  value: string;
}

export interface ContractLinkageCheckRow {
  label: string;
  value: string;
  status: string;
}

export interface ContractArchiveReadiness {
  status: string;
  reason: string;
  nextAction: string;
}

export interface ContractFulfillmentLinkageSummary {
  stage: string;
  owner: string;
  riskLevel: string;
  progressPercent: number;
  nextStep: string;
}

export interface ContractFulfillmentFinanceRow {
  label: string;
  value: string;
  status: string;
  hint: string;
}

export interface ContractFinancialSummary {
  contractAmountLabel: string;
  invoiceAmountLabel: string;
  invoiceVarianceLabel: string;
  paymentReadinessLabel: string;
  archiveBlockingLabel: string;
  paymentPlanSummary: string;
}

export interface ContractPaymentPlanRow {
  label: string;
  value: string;
  status: string;
  hint: string;
}

export interface ContractFulfillmentEventStateRow {
  eventStage: string;
  eventEvidenceLabel: string;
  eventNextAction: string;
  status: string;
  hint: string;
}

export interface ContractArchiveReviewChecklistRow {
  item: string;
  evidence: string;
  status: string;
  nextAction: string;
  archiveReviewTargetSection: string;
  archiveReviewLocationHint: string;
}

export interface ContractArchiveReviewGroupSummary {
  totalCount: number;
  gapCount: number;
  coveredCount: number;
  nextReviewFocus: string;
}

export interface ContractArchiveReviewActionSuggestion {
  item: string;
  ownerModule: string;
  targetModuleId: BuyerAdminModule;
  handlingPath: string;
  suggestedAction: string;
  archiveReviewTargetSection: string;
}

export interface ContractFulfillmentEventSource {
  actionType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export interface ContractPaymentRequestSource {
  id: string;
  invoiceId: string;
  amount: number;
  requestStatus: string;
  paymentBatchNo: string;
}

export interface ContractPaymentBatchSource {
  paymentBatchNo: string;
  batchStatus: string;
  plannedPaymentDate?: string | null;
  totalAmount: number;
  approvedAmount: number;
  registeredAmount: number;
  pendingRegistrationAmount: number;
}

export interface ContractDetailPanelOptions {
  paymentRequests?: ContractPaymentRequestSource[];
  paymentBatches?: ContractPaymentBatchSource[];
  fulfillmentEvents?: ContractFulfillmentEventSource[];
  attachmentCount?: number;
  auditLogCount?: number;
}

export interface ContractApprovalReadiness {
  status: string;
  reason: string;
  nextAction: string;
}

export interface ContractRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface ContractContextActionRow {
  label: string;
  moduleId: BuyerAdminModule;
  moduleLabel: string;
  status: string;
  hint: string;
}

export interface ContractDetailPanel {
  id: string;
  contractNo: string;
  contractName: string;
  supplierName: string;
  relatedOrderId: string;
  status: string;
  archiveStatus: string;
  amountLabel: string;
  facts: BuyerModuleFact[];
  fulfillmentRows: ContractFulfillmentRow[];
  linkageCheckRows: ContractLinkageCheckRow[];
  fulfillmentLinkageSummary: ContractFulfillmentLinkageSummary;
  fulfillmentFinanceRows: ContractFulfillmentFinanceRow[];
  contractFinancialSummary: ContractFinancialSummary;
  contractPaymentPlanRows: ContractPaymentPlanRow[];
  contractFulfillmentEventStateRows: ContractFulfillmentEventStateRow[];
  archiveReviewChecklistRows: ContractArchiveReviewChecklistRow[];
  archiveReviewGroupSummary: ContractArchiveReviewGroupSummary;
  archiveReviewActionSuggestions: ContractArchiveReviewActionSuggestion[];
  archiveReviewConclusion: string;
  approvalReadiness: ContractApprovalReadiness;
  archiveReadiness: ContractArchiveReadiness;
  canArchive: boolean;
  contextActionRows: ContractContextActionRow[];
  relatedRows: ContractRelatedRow[];
  archiveBoundary: string;
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

export interface ReceiptInspectionRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface ReceiptInspectionPostReceiptRow {
  label: string;
  value: string;
}

export interface ReceiptInspectionDetailPanel {
  id: string;
  supplierName: string;
  status: string;
  amountLabel: string;
  logisticsLabel: string;
  canRegisterReceipt: boolean;
  nextActionTitle: string;
  sourceOrderLabel?: string;
  sourceRfqLabel?: string;
  awardApprovalStatus?: string;
  awardApprovalComment?: string;
  invoiceStatusLabel?: string;
  facts: BuyerModuleFact[];
  logisticsFacts: BuyerModuleFact[];
  acceptanceChecks: BuyerModuleFact[];
  postReceiptRows: ReceiptInspectionPostReceiptRow[];
  relatedRows: ReceiptInspectionRelatedRow[];
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

export interface InvoicePaymentRelatedRow {
  id: string;
  title: string;
  detail: string;
}

export interface InvoicePaymentTimelineRow {
  label: string;
  value: string;
}

export interface InvoicePaymentCheckRow {
  label: string;
  value: string;
}

export interface InvoicePaymentRequestSource {
  id: string;
  invoiceId: string;
  amount: number;
  requestStatus: string;
  paymentBatchNo: string;
}

export interface InvoiceVarianceHandlingSource {
  id: string;
  invoiceId: string;
  varianceAmount: number;
  result: string;
  status: string;
}

export interface InvoicePaymentDetailPanelOptions {
  paymentRequests?: InvoicePaymentRequestSource[];
  varianceHandlings?: InvoiceVarianceHandlingSource[];
}

export interface InvoicePaymentDetailPanel {
  id: string;
  supplierName: string;
  status: string;
  amountLabel: string;
  canRegisterPayment: boolean;
  nextActionTitle: string;
  sourceOrderLabel?: string;
  sourceRfqLabel?: string;
  receiptStatusLabel?: string;
  awardApprovalStatus?: string;
  awardApprovalComment?: string;
  paymentRequestStatus?: string;
  varianceHandlingStatus?: string;
  facts: BuyerModuleFact[];
  orderFacts: BuyerModuleFact[];
  paymentCheckRows: InvoicePaymentCheckRow[];
  relatedRows: InvoicePaymentRelatedRow[];
  paymentTimelineRows: InvoicePaymentTimelineRow[];
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

const contractNoForOrder = (orderId: string) => `CTR-${orderId.toUpperCase()}`;

const contractStatusForOrder = (status: string) => {
  if (status === '待供应商确认') return '草案';
  if (status === '待发货') return '已生效';
  if (status === '已发货' || status === '待收货' || status === '已收货') return '履约中';
  if (status === '已完成') return '已归档';
  return '待完善';
};

const contractArchiveStatusForOrder = (status: string) => (
  status === '已完成' ? '已归档' : '未归档'
);

const contractProgressForOrder = (status: string) => {
  if (status === '待供应商确认') return '待审批';
  if (status === '待发货') return '已生效';
  if (status === '已发货' || status === '待收货') return '履约中';
  if (status === '已收货') return '待归档';
  if (status === '已完成') return '已归档';
  return '待同步';
};

const describeContractNextAction = (status: string, archiveStatus: string): BuyerNextAction => {
  if (archiveStatus === '已归档') {
    return {
      title: '归档后只读',
      detail: '合同已归档，本轮仅保留台账追溯，不开放编辑和外部签章。',
      tone: 'slate',
    };
  }

  if (status === '草案') {
    return {
      title: '待补充合同草案',
      detail: '可根据订单信息生成合同草案，本轮暂不新增 Java API。',
      tone: 'amber',
    };
  }

  return {
    title: '跟进履约与归档',
    detail: '继续核对订单、收货、发票付款，满足条件后进入合同归档。',
    tone: 'blue',
  };
};

export const buildContractFulfillmentEventStateRows = (
  archiveStatus: string,
  fulfillmentEvents: ContractFulfillmentEventSource[] = [],
): ContractFulfillmentEventStateRow[] => {
  const hasReceiptEvent = fulfillmentEvents.some((event) => event.actionType === 'receipt');
  const hasPaymentEvent = fulfillmentEvents.some((event) => event.actionType === 'payment');
  const archived = archiveStatus === '已归档';
  const latestEvent = fulfillmentEvents[0];

  return [
    {
      eventStage: '待收货',
      eventEvidenceLabel: hasReceiptEvent ? '已有收货事件证据' : '暂无收货事件证据',
      eventNextAction: hasReceiptEvent ? '继续跟进付款事件' : '从合同联动入口进入收货验收',
      status: hasReceiptEvent ? '已完成' : '待处理',
      hint: hasReceiptEvent ? '收货事件已沉淀，可作为后续归档复核证据。' : '需要先完成收货验收并写入履约事件。',
    },
    {
      eventStage: '待付款',
      eventEvidenceLabel: hasPaymentEvent ? '已有付款事件证据' : '暂无付款事件证据',
      eventNextAction: hasPaymentEvent ? '继续跟进归档条件' : '从合同联动入口进入发票付款',
      status: hasPaymentEvent ? '已完成' : hasReceiptEvent ? '待处理' : '等待收货',
      hint: hasPaymentEvent ? '付款事件已沉淀，可与发票付款状态交叉复核。' : '付款事件依赖发票付款模块推进。',
    },
    {
      eventStage: '待归档',
      eventEvidenceLabel: hasReceiptEvent && hasPaymentEvent ? '收货与付款事件证据已覆盖' : '事件证据未完全覆盖',
      eventNextAction: archived ? '查看归档审计' : hasReceiptEvent && hasPaymentEvent ? '核对归档门禁并归档合同' : '补齐收货或付款事件证据',
      status: archived ? '已完成' : hasReceiptEvent && hasPaymentEvent ? '可归档复核' : '等待证据',
      hint: '事件状态机只做履约事件证据提示，最终归档仍以订单收货和发票付款状态为准。',
    },
    {
      eventStage: '已完成',
      eventEvidenceLabel: latestEvent ? `最近事件：${latestEvent.summary}` : '暂无最近事件',
      eventNextAction: archived ? '保持只读审计' : '继续沉淀事件或归档合同',
      status: archived ? '已归档' : '未归档',
      hint: archived ? '合同已进入只读审计态。' : '合同未归档前仍可从联动入口写入收货或付款事件。',
    },
  ];
};

export const buildContractArchiveReviewChecklistRows = ({
  approvalStatus,
  attachmentCount,
  fulfillmentEventCount,
  paymentPlanSummary,
  auditLogCount,
}: {
  approvalStatus: string;
  attachmentCount: number;
  fulfillmentEventCount: number;
  paymentPlanSummary: string;
  auditLogCount: number;
}): ContractArchiveReviewChecklistRow[] => [
  {
    item: '审批追溯',
    evidence: approvalStatus,
    status: approvalStatus === '待提交审批' || approvalStatus === '审批中' ? '待补齐' : '已覆盖',
    nextAction: approvalStatus === '待提交审批' ? '提交合同审批' : approvalStatus === '审批中' ? '等待审批结果' : '保留审批审计记录',
    archiveReviewTargetSection: 'contract-approval-entry',
    archiveReviewLocationHint: '合同审批入口',
  },
  {
    item: '附件凭证',
    evidence: `${attachmentCount} 份附件`,
    status: attachmentCount > 0 ? '已覆盖' : '待补齐',
    nextAction: attachmentCount > 0 ? '复核附件可见范围' : '补充合同正文或补充协议附件',
    archiveReviewTargetSection: 'contract-attachment-evidence',
    archiveReviewLocationHint: '合同附件凭证',
  },
  {
    item: '履约事件',
    evidence: `${fulfillmentEventCount} 条事件`,
    status: fulfillmentEventCount > 0 ? '已覆盖' : '待补齐',
    nextAction: fulfillmentEventCount > 0 ? '复核收货和付款事件覆盖' : '从合同联动入口沉淀事件证据',
    archiveReviewTargetSection: 'contract-fulfillment-event-ledger',
    archiveReviewLocationHint: '合同履约事件台账',
  },
  {
    item: '付款计划',
    evidence: paymentPlanSummary,
    status: paymentPlanSummary.includes('已关闭') || paymentPlanSummary.includes('可安排') || paymentPlanSummary.includes('已付款') ? '已覆盖' : '待跟进',
    nextAction: paymentPlanSummary.includes('待') ? '进入发票付款模块完善付款申请或批次' : '复核付款计划与归档门禁',
    archiveReviewTargetSection: 'contract-payment-plan-readonly',
    archiveReviewLocationHint: '合同付款计划只读视图',
  },
  {
    item: '审计日志',
    evidence: `${auditLogCount} 条目标审计`,
    status: auditLogCount > 0 ? '已覆盖' : '待沉淀',
    nextAction: auditLogCount > 0 ? '复核最近审计动作' : '等待审批、履约事件或归档动作形成审计',
    archiveReviewTargetSection: 'contract-audit-log-detail',
    archiveReviewLocationHint: '合同审计日志明细',
  },
];

export const buildContractArchiveReviewGroupSummary = (
  rows: ContractArchiveReviewChecklistRow[],
): ContractArchiveReviewGroupSummary => {
  const coveredCount = rows.filter((row) => row.status === '已覆盖').length;
  const gapCount = rows.length - coveredCount;
  const nextGap = rows.find((row) => row.status !== '已覆盖');

  return {
    totalCount: rows.length,
    gapCount,
    coveredCount,
    nextReviewFocus: nextGap ? `${nextGap.item} · ${nextGap.nextAction}` : '全部复核证据已覆盖',
  };
};

export const buildContractArchiveReviewActionSuggestions = (
  rows: ContractArchiveReviewChecklistRow[],
): ContractArchiveReviewActionSuggestion[] => rows
  .filter((row) => row.status !== '已覆盖')
  .map((row) => {
    if (row.item === '审批追溯') {
      return {
        item: row.item,
        ownerModule: '合同审批',
        targetModuleId: 'approvals',
        handlingPath: '合同详情 / 合同审批入口',
        suggestedAction: row.nextAction,
        archiveReviewTargetSection: row.archiveReviewTargetSection,
      };
    }

    if (row.item === '附件凭证') {
      return {
        item: row.item,
        ownerModule: '合同附件',
        targetModuleId: 'contracts',
        handlingPath: '合同详情 / 合同附件凭证',
        suggestedAction: row.nextAction,
        archiveReviewTargetSection: row.archiveReviewTargetSection,
      };
    }

    if (row.item === '履约事件') {
      return {
        item: row.item,
        ownerModule: '合同履约',
        targetModuleId: 'receipts',
        handlingPath: '合同详情 / 合同上下文操作入口 / 目标页快捷登记',
        suggestedAction: row.nextAction,
        archiveReviewTargetSection: row.archiveReviewTargetSection,
      };
    }

    if (row.item === '付款计划') {
      return {
        item: row.item,
        ownerModule: '发票付款',
        targetModuleId: 'invoices',
        handlingPath: '合同详情 / 合同付款计划只读视图 / 发票付款模块',
        suggestedAction: row.nextAction,
        archiveReviewTargetSection: row.archiveReviewTargetSection,
      };
    }

    return {
      item: row.item,
      ownerModule: '审计日志',
      targetModuleId: 'audit',
      handlingPath: '合同详情 / 合同审计日志明细',
      suggestedAction: row.nextAction,
      archiveReviewTargetSection: row.archiveReviewTargetSection,
    };
  });

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
  approval.reviewComment ? { label: '审批意见', value: approval.reviewComment } : undefined,
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

const approvalId = (approval: ApprovalCardSource) =>
  approval.id ?? `${approval.bizType}:${approval.bizId}`;

const buildApprovalBusinessContext = (
  workspace: BuyerWorkspace,
  approval: ApprovalCardSource,
): { businessFacts: BuyerModuleFact[]; contextRows: ApprovalDetailContextRow[] } => {
  if (approval.bizType === 'purchase_demand') {
    const demand = workspace.demands.find((item) => item.id === approval.bizId);
    if (demand) {
      return {
        businessFacts: [
          { label: '业务单号', value: demand.id },
          { label: '当前状态', value: demand.status },
          { label: '申请部门', value: demand.department },
          { label: '申请人', value: demand.requester },
          { label: '预算金额', value: compactCurrency(demand.budget) },
        ],
        contextRows: demand.lineItems.map((lineItem, index) => {
          const material = workspace.materials.find((item) => item.id === lineItem.materialId);
          const referenceAmount = (material?.referencePrice ?? 0) * lineItem.quantity;
          return {
            id: `${demand.id}:${lineItem.materialId}:${index}`,
            title: material?.name ?? lineItem.materialId,
            detail: `${lineItem.quantity} ${material?.unit ?? ''}`.trim() + ` · 参考 ${compactCurrency(referenceAmount)}`,
          };
        }),
      };
    }
  }

  if (approval.bizType === 'buyer_supplier_admission') {
    const relation = workspace.privateSupplierRelations.find((item) => item.id === approval.bizId);
    if (relation) {
      const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
      return {
        businessFacts: [
          { label: '业务单号', value: relation.id },
          { label: '当前状态', value: relation.status },
          { label: '供应商', value: supplier?.name ?? relation.supplierId },
          { label: '等级', value: relation.level },
          { label: '绩效', value: `${relation.performanceScore} 分` },
        ],
        contextRows: relation.categories.map((category) => ({
          id: `${relation.id}:${category}`,
          title: category,
          detail: supplier?.verified ? '企业已认证' : '企业待认证',
        })),
      };
    }
  }

  if (approval.bizType === 'rfq_award') {
    const rfq = workspace.rfqs.find((item) => item.id === approval.parentBizId || item.id === approval.bizId);
    if (rfq) {
      const awardedSupplier = workspace.suppliers.find((item) => item.id === rfq.awardedSupplierId);
      return {
        businessFacts: [
          { label: '业务单号', value: rfq.id },
          { label: '当前状态', value: rfq.status },
          { label: '负责人', value: rfq.owner },
          { label: '报价数量', value: `${rfq.quotes.length} 条` },
          { label: '拟定标供应商', value: awardedSupplier?.name ?? rfq.awardedSupplierId ?? '待定标' },
        ],
        contextRows: rfq.quotes.map((quote) => {
          const supplier = workspace.suppliers.find((item) => item.id === quote.supplierId);
          return {
            id: quote.id,
            title: supplier?.name ?? quote.supplierId,
            detail: `${compactCurrency(quote.amount)} · ${quote.deliveryDays} 天`,
          };
        }),
      };
    }
  }

  return {
    businessFacts: [
      { label: '业务单号', value: approval.bizId ?? approvalId(approval) },
      { label: '当前状态', value: approval.businessStatus ?? approval.status ?? '待审批' },
    ],
    contextRows: [],
  };
};

export const buildApprovalDetailPanel = (
  workspace: BuyerWorkspace,
  pendingApprovals: ApprovalCardSource[],
  recentApprovals: ApprovalCardSource[],
  selectedApprovalId: string,
  nowIso = new Date().toISOString(),
): ApprovalDetailPanel | undefined => {
  const approval = [...pendingApprovals, ...recentApprovals]
    .find((item) => approvalId(item) === selectedApprovalId);
  if (!approval) return undefined;

  const context = buildApprovalBusinessContext(workspace, approval);
  const actedAt = approval.actedAt ?? undefined;
  const canReview = approval.status === undefined || approval.status === '待审批';
  const reviewComment = approval.reviewComment?.trim() || undefined;

  return {
    id: approvalId(approval),
    title: approval.summaryTitle ?? approval.bizId ?? '审批事项',
    typeLabel: approvalTypeLabel(approval.bizType ?? ''),
    status: approval.status ?? '待审批',
    canReview,
    facts: buildApprovalCardFacts(approval, nowIso),
    businessFacts: context.businessFacts,
    contextRows: context.contextRows,
    reviewCheckRows: [
      { label: '审批状态', value: approval.status ?? '待审批' },
      { label: '业务状态', value: approval.businessStatus ?? approval.status ?? '待审批' },
      reviewComment ? { label: '审批意见', value: reviewComment } : undefined,
      { label: '关联明细', value: `${context.contextRows.length} 条` },
      { label: '下一步', value: canReview ? '通过或驳回' : '已归档' },
    ].filter((row): row is ApprovalDetailCheckRow => Boolean(row)),
    timelineRows: [
      { label: '提交审批', value: compactDateTime(approval.createdAt) },
      actedAt
        ? { label: '处理完成', value: compactDateTime(actedAt) }
        : { label: '等待处理', value: elapsedLabel(approval.createdAt, nowIso) },
    ],
    reviewComment,
  };
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
    admissionCheckRows: [
      { label: '准入状态', value: relation.status },
      { label: '企业认证', value: supplier?.verified ? '已认证' : '待认证' },
      { label: '绩效风险', value: action.riskLabel },
      { label: '下一步', value: action.title },
    ],
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

export const buildMaterialDetailPanel = (
  workspace: BuyerWorkspace,
  materialId: string,
): MaterialDetailPanel | undefined => {
  const material = workspace.materials.find((item) => item.id === materialId);
  if (!material) return undefined;

  const materialDemandLines = workspace.demands
    .flatMap((demand) => demand.lineItems
      .map((lineItem, lineIndex) => ({
        demand,
        lineItem,
        lineIndex,
      }))
      .filter(({ lineItem }) => lineItem.materialId === material.id));
  const demandRows = materialDemandLines
    .map(({ demand, lineItem, lineIndex }) => ({
        id: `${demand.id}:${lineItem.materialId}:${lineIndex}`,
        title: demand.title,
        status: demand.status,
        quantityLabel: `${lineItem.quantity} ${material.unit}`,
        referenceAmountLabel: compactCurrency(lineItem.quantity * material.referencePrice),
      }));
  const demandIds = new Set(materialDemandLines.map(({ demand }) => demand.id));
  const rfqRows = workspace.rfqs
    .filter((rfq) => rfq.demandIds.some((demandId) => demandIds.has(demandId)))
    .map((rfq) => ({
      id: rfq.id,
      title: rfq.title,
      status: rfq.status,
      quoteLabel: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length} 已报价`,
    }));
  const supplierCoverageRows = workspace.privateSupplierRelations
    .filter((relation) => relation.status === '已准入' && relation.categories.includes(material.category))
    .map((relation) => {
      const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
      return {
        id: relation.id,
        supplierName: supplier?.name ?? relation.supplierId,
        status: relation.status,
        level: relation.level,
      };
    });
  const referenceAmount = materialDemandLines
    .reduce((sum, { lineItem }) => sum + (lineItem.quantity * material.referencePrice), 0);
  const nextActionTitle = rfqRows.length > 0
    ? '已进入询价'
    : supplierCoverageRows.length > 0
      ? '可创建询价'
      : '补充准入供应商';

  return {
    id: material.id,
    title: material.name,
    status: '启用',
    facts: [
      { label: '物料编码', value: material.code },
      { label: '品类', value: material.category },
      { label: '单位', value: material.unit },
      { label: '参考价', value: compactCurrency(material.referencePrice) },
    ],
    demandRows,
    rfqRows,
    supplierCoverageRows,
    procurementReadinessRows: [
      { label: '需求引用', value: `${demandRows.length} 条` },
      { label: '询价项目', value: `${rfqRows.length} 个` },
      { label: '准入供应商', value: `${supplierCoverageRows.length} 家` },
      { label: '下一步', value: nextActionTitle },
    ],
    usageSummary: [
      { label: '引用需求', value: `${demandRows.length} 条` },
      { label: '关联询价', value: `${rfqRows.length} 个` },
      { label: '准入供应商', value: `${supplierCoverageRows.length} 家` },
      { label: '参考金额', value: compactCurrency(referenceAmount) },
    ],
  };
};

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

const listWorkspaceApprovals = (workspace: BuyerWorkspace): ApprovalCardSource[] =>
  'approvals' in workspace && Array.isArray(workspace.approvals)
    ? workspace.approvals as ApprovalCardSource[]
    : [];

const findRfqAwardApproval = (workspace: BuyerWorkspace, rfqId: string) => {
  const awardApprovals = listWorkspaceApprovals(workspace)
    .filter((approval) => approval.bizType === 'rfq_award' && approval.parentBizId === rfqId)
    .sort((left, right) => {
      const leftTime = new Date(left.actedAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.actedAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    });

  return awardApprovals.find((approval) => approval.status === '已通过') ?? awardApprovals[0];
};

export const buildRfqDetailPanel = (
  workspace: BuyerWorkspace,
  rfqId: string,
): RfqDetailPanel | undefined => {
  const rfq = workspace.rfqs.find((item) => item.id === rfqId);
  if (!rfq) return undefined;

  const recommendedQuote = selectRecommendedQuote(rfq);
  const generatedOrder = workspace.orders.find((order) => order.rfqId === rfq.id);
  const generatedInvoice = generatedOrder
    ? workspace.invoices.find((invoice) => invoice.orderId === generatedOrder.id)
    : undefined;
  const awardApproval = findRfqAwardApproval(workspace, rfq.id);
  const awardApprovalComment = awardApproval?.reviewComment?.trim() || undefined;
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
  const awardedSupplierName = rfq.awardedSupplierId ? supplierName(rfq.awardedSupplierId) : '待定标';

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
    fulfillmentTimelineRows: [
      { label: '询价发布', value: rfq.status },
      { label: '供应商响应', value: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length}` },
      { label: '定标结果', value: awardedSupplierName },
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      awardApprovalComment ? { label: '审批意见', value: awardApprovalComment } : undefined,
      { label: '采购订单', value: generatedOrder?.status ?? '暂未生成' },
      { label: '发票付款', value: generatedInvoice?.paymentStatus ?? '待开票' },
    ].filter((row): row is RfqDetailTimelineRow => Boolean(row)),
    relatedRows: [
      ...rfq.demandIds.map((demandId) => {
        const demand = workspace.demands.find((item) => item.id === demandId);
        return {
          id: demandId,
          title: '采购需求',
          detail: `${demand?.title ?? demandId} · ${demand?.status ?? '未找到'}`,
        };
      }),
      generatedOrder
        ? {
            id: generatedOrder.id,
            title: '采购订单',
            detail: `${compactCurrency(generatedOrder.amount)} · ${generatedOrder.status}`,
          }
        : undefined,
      generatedInvoice
        ? {
            id: generatedInvoice.id,
            title: '发票付款',
            detail: `${compactCurrency(generatedInvoice.amount)} · ${generatedInvoice.paymentStatus}`,
          }
        : undefined,
    ].filter((row): row is RfqDetailRelatedRow => Boolean(row)),
    recommendedSupplierLabel: recommendedQuote
      ? `推荐：${supplierName(recommendedQuote.supplierId)} ${compactCurrency(recommendedQuote.amount)}`
      : '暂无可推荐报价',
    orderLabel: generatedOrder ? `已生成订单 ${generatedOrder.id}` : '暂未生成采购订单',
    nextActionTitle: nextAction.title,
    awardApprovalComment,
  };
};

export const buildQuoteComparisonDetailPanel = (
  workspace: BuyerWorkspace,
  rfqId: string,
): QuoteComparisonDetailPanel | undefined => {
  const rfq = workspace.rfqs.find((item) => item.id === rfqId);
  if (!rfq) return undefined;

  const detail = buildRfqDetailPanel(workspace, rfqId);
  if (!detail) return undefined;

  const recommendedQuote = selectRecommendedQuote(rfq);
  const recommendedSupplier = recommendedQuote
    ? workspace.suppliers.find((supplier) => supplier.id === recommendedQuote.supplierId)
    : undefined;
  const generatedOrder = workspace.orders.find((order) => order.rfqId === rfq.id);
  const awardApproval = findRfqAwardApproval(workspace, rfq.id);
  const approvedAward = awardApproval?.status === '已通过' ? awardApproval : undefined;
  const nextAction = generatedOrder
    ? describeOrderNextAction(generatedOrder)
    : describeRfqNextAction(rfq, approvedAward?.bizId, workspace.orders);
  const generatedInvoice = generatedOrder
    ? workspace.invoices.find((invoice) => invoice.orderId === generatedOrder.id)
    : undefined;
  const awardStatusLabel = approvedAward?.status ?? rfq.status;
  const awardApprovalComment = awardApproval?.reviewComment?.trim() || undefined;

  return {
    id: rfq.id,
    title: rfq.title,
    status: rfq.status,
    recommendationLabel: detail.recommendedSupplierLabel,
    canSubmitAward: canSubmitAwardApproval(rfq),
    facts: [
      { label: '报价响应', value: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length}` },
      { label: '最低报价', value: recommendedQuote ? compactCurrency(recommendedQuote.amount) : '暂无报价' },
      { label: '交付周期', value: recommendedQuote ? `${recommendedQuote.deliveryDays} 天` : '暂无报价' },
      { label: '税率', value: recommendedQuote ? `${recommendedQuote.taxRate}%` : '暂无报价' },
    ],
    recommendationFacts: [
      { label: '推荐供应商', value: recommendedSupplier?.name ?? recommendedQuote?.supplierId ?? '暂无推荐' },
      { label: '推荐理由', value: '最低报价优先，价格相同时按交付周期排序' },
      { label: '定标状态', value: rfq.status },
      awardApprovalComment ? { label: '审批意见', value: awardApprovalComment } : undefined,
      { label: '订单状态', value: generatedOrder ? `已生成订单 ${generatedOrder.id}` : '暂未生成采购订单' },
    ].filter((fact): fact is BuyerModuleFact => Boolean(fact)),
    awardTimelineRows: [
      { label: '推荐报价', value: recommendedSupplier?.name ?? recommendedQuote?.supplierId ?? '暂无推荐' },
      { label: '定标审批', value: awardStatusLabel },
      awardApprovalComment ? { label: '审批意见', value: awardApprovalComment } : undefined,
      { label: '订单生成', value: generatedOrder?.id ?? '暂未生成' },
      { label: '付款状态', value: generatedInvoice?.paymentStatus ?? '待开票' },
    ].filter((row): row is QuoteComparisonAwardTimelineRow => Boolean(row)),
    quoteRows: detail.quoteRows,
    relatedRows: [
      ...rfq.demandIds.map((demandId) => {
        const demand = workspace.demands.find((item) => item.id === demandId);
        return {
          id: demandId,
          title: '采购需求',
          detail: `${demand?.title ?? demandId} · ${demand?.status ?? '未找到'}`,
        };
      }),
      generatedOrder
        ? {
            id: generatedOrder.id,
            title: '采购订单',
            detail: `${compactCurrency(generatedOrder.amount)} · ${generatedOrder.status}`,
          }
        : undefined,
      generatedInvoice
        ? {
            id: generatedInvoice.id,
            title: '发票付款',
            detail: `${compactCurrency(generatedInvoice.amount)} · ${generatedInvoice.paymentStatus}`,
          }
        : undefined,
    ].filter((row): row is QuoteComparisonRelatedRow => Boolean(row)),
    nextActionTitle: nextAction.title,
    awardApprovalComment,
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
  const approvalLabel = approval ? `待审批：${approval.typeLabel}` : '暂无待审批';
  const linkedRfqs = workspace.rfqs.filter((rfq) => rfq.demandIds.includes(demand.id));
  const linkedOrders = workspace.orders.filter((order) =>
    linkedRfqs.some((rfq) => rfq.id === order.rfqId));

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
    lineItems: demand.lineItems.map((item, index) => {
      const material = workspace.materials.find((record) => record.id === item.materialId);
      const unit = material?.unit ?? '';
      return {
        id: `${demand.id}:${item.materialId}:${index}`,
        name: material?.name ?? item.materialId,
        category: material?.category ?? '未维护',
        quantityLabel: `${item.quantity} ${unit}`.trim(),
        referenceAmountLabel: compactCurrency((material?.referencePrice ?? 0) * item.quantity),
      };
    }),
    linkedRfqs: linkedRfqs
      .map((rfq) => ({
        id: rfq.id,
        title: rfq.title,
        status: rfq.status,
        quoteLabel: `${rfq.quotes.length}/${rfq.invitedSupplierIds.length} 已报价`,
      })),
    workflowTimelineRows: [
      { label: '需求申请', value: demand.status },
      { label: '审批状态', value: approvalLabel },
      { label: '询价项目', value: `${linkedRfqs.length} 个` },
      { label: '后续订单', value: `${linkedOrders.length} 单` },
    ],
    flowCheckRows: [
      { label: '审批状态', value: approvalLabel },
      { label: '物料明细', value: `${demand.lineItems.length} 行` },
      { label: '询价项目', value: `${linkedRfqs.length} 个` },
      { label: '下一步', value: nextAction.title },
    ],
    relatedRows: [
      ...linkedRfqs.map((rfq) => ({
        id: rfq.id,
        title: '询价项目',
        detail: `${rfq.title} · ${rfq.status}`,
      })),
      ...linkedOrders.map((order) => ({
        id: order.id,
        title: '采购订单',
        detail: `${compactCurrency(order.amount)} · ${order.status}`,
      })),
    ],
    approvalLabel,
    nextActionTitle: nextAction.title,
  };
};

const orderLogisticsLabel = (workspace: BuyerWorkspace, orderId: string) => {
  const delivery = workspace.deliveries.find((item) => item.orderId === orderId);
  return delivery ? `${delivery.carrier} ${delivery.trackingNo}` : '待发货';
};

const hasShippedDeliveryForOrder = (workspace: BuyerWorkspace, orderId: string) =>
  workspace.deliveries.some((delivery) => delivery.orderId === orderId && delivery.status === '已发货');

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
  const awardApproval = rfq ? findRfqAwardApproval(workspace, rfq.id) : undefined;
  const awardApprovalComment = awardApproval?.reviewComment?.trim() || undefined;
  const sourceRfqLabel = rfq?.title ?? order.rfqId;
  const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
  const invoice = workspace.invoices.find((item) => item.orderId === order.id);
  const nextAction = describeOrderNextAction(order);
  const receiptLabel = order.status === '已收货' || order.status === '已完成' ? '已登记' : '待登记';

  return {
    id: order.id,
    supplierName: supplier?.name ?? order.supplierId,
    status: order.status,
    amountLabel: compactCurrency(order.amount),
    facts: [
      { label: '关联询价', value: sourceRfqLabel },
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
    fulfillmentTimelineRows: [
      { label: '来源询价', value: sourceRfqLabel },
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      awardApprovalComment ? { label: '审批意见', value: awardApprovalComment } : undefined,
      { label: '订单创建', value: order.id },
      { label: '供应商确认', value: order.status },
      { label: '物流状态', value: delivery?.status ?? '待发货' },
      { label: '收货验收', value: receiptLabel },
      { label: '发票付款', value: invoice?.paymentStatus ?? '待开票' },
    ].filter((row): row is OrderDetailTimelineRow => Boolean(row)),
    fulfillmentCheckRows: [
      { label: '来源询价', value: sourceRfqLabel },
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      { label: '物流信息', value: delivery?.status ?? '待发货' },
      { label: '收货验收', value: receiptLabel },
      { label: '发票付款', value: invoice?.paymentStatus ?? '待开票' },
      { label: '下一步', value: nextAction.title },
    ].filter((row): row is OrderDetailCheckRow => Boolean(row)),
    relatedRows: [
      rfq
        ? {
            id: rfq.id,
            title: '询价项目',
            detail: `${rfq.title} · ${rfq.status}`,
          }
        : undefined,
      awardApproval
        ? {
            id: awardApproval.id ?? `${rfq?.id ?? order.rfqId}:award-approval`,
            title: '定标审批',
            detail: awardApprovalComment
              ? `${awardApproval.status ?? '待审批'} · ${awardApprovalComment}`
              : awardApproval.status ?? '待审批',
          }
        : undefined,
      delivery
        ? {
            id: delivery.id,
            title: '物流信息',
            detail: `${delivery.carrier} ${delivery.trackingNo} · ${delivery.status}`,
          }
        : undefined,
      invoice
        ? {
            id: invoice.id,
            title: '发票付款',
            detail: `${compactCurrency(invoice.amount)} · ${invoice.paymentStatus}`,
          }
        : undefined,
    ].filter((row): row is OrderDetailRelatedRow => Boolean(row)),
    rfqLabel: sourceRfqLabel,
    nextActionTitle: nextAction.title,
    sourceRfqLabel,
    ...(awardApproval ? { awardApprovalStatus: awardApproval.status ?? '待审批' } : {}),
    ...(awardApprovalComment ? { awardApprovalComment } : {}),
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
      canRegisterReceipt: order.status === '已发货' && hasShippedDeliveryForOrder(workspace, order.id),
    };
  });

export const buildContractLedgerRows = (workspace: BuyerWorkspace): ContractLedgerRow[] =>
  workspace.contracts && workspace.contracts.length > 0
    ? workspace.contracts.map((contract) => {
        const supplier = workspace.suppliers.find((item) => item.id === contract.supplierId);
        return {
          id: contract.id,
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          relatedOrderId: contract.relatedOrderId,
          supplierName: supplier?.name ?? contract.supplierId,
          amountLabel: compactCurrency(contract.amount),
          status: contract.status,
          archiveStatus: contract.archiveStatus,
          facts: [
            { label: '合同金额', value: compactCurrency(contract.amount) },
            { label: '生效日期', value: contract.effectiveDate ?? '待生效' },
            { label: '履约进度', value: contract.fulfillmentProgress },
          ],
          nextAction: describeContractNextAction(contract.status, contract.archiveStatus),
        };
      })
    : workspace.orders.map((order) => {
        const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
        const status = contractStatusForOrder(order.status);
        const archiveStatus = contractArchiveStatusForOrder(order.status);
        return {
          id: `contract-${order.id}`,
          contractNo: contractNoForOrder(order.id),
          contractName: `${supplier?.name ?? order.supplierId}采购合同`,
          relatedOrderId: order.id,
          supplierName: supplier?.name ?? order.supplierId,
          amountLabel: compactCurrency(order.amount),
          status,
          archiveStatus,
          facts: [
            { label: '合同金额', value: compactCurrency(order.amount) },
            { label: '生效日期', value: order.expectedReceiptDate },
            { label: '履约进度', value: contractProgressForOrder(order.status) },
          ],
          nextAction: describeContractNextAction(status, archiveStatus),
        };
      });

export const buildContractDetailPanel = (
  workspace: BuyerWorkspace,
  contractId: string,
  options: ContractDetailPanelOptions = {},
): ContractDetailPanel | undefined => {
  const row = buildContractLedgerRows(workspace).find((item) => item.id === contractId);
  if (!row) return undefined;

  const order = workspace.orders.find((item) => item.id === row.relatedOrderId);
  if (!order) return undefined;

  const rfq = workspace.rfqs.find((item) => item.id === order.rfqId);
  const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
  const invoice = workspace.invoices.find((item) => item.orderId === order.id);
  const paymentRequest = invoice
    ? options.paymentRequests?.find((item) => item.invoiceId === invoice.id)
    : undefined;
  const paymentBatch = paymentRequest
    ? options.paymentBatches?.find((item) => item.paymentBatchNo === paymentRequest.paymentBatchNo)
    : undefined;
  const fulfillmentEvents = options.fulfillmentEvents ?? [];
  const receiptLabel = order.status === '已收货' || order.status === '已完成' ? '已登记' : '待登记';
  const receiptComplete = order.status === '已收货' || order.status === '已完成' || delivery?.status === '已签收';
  const invoicePaid = invoice?.paymentStatus === '已付款';
  const invoiceAmount = invoice?.amount ?? 0;
  const invoiceVarianceAmount = invoice
    ? invoice.amount - order.amount
    : undefined;
  const invoiceVarianceLabel = invoiceVarianceAmount == null
    ? '待开票'
    : invoiceVarianceAmount === 0
      ? '金额一致'
      : `${invoiceVarianceAmount > 0 ? '+' : ''}${compactCurrency(invoiceVarianceAmount)}`;
  const approvalReadiness = row.archiveStatus === '已归档'
    ? {
        status: '已归档',
        reason: '合同已归档，审批入口关闭',
        nextAction: '仅保留审批与归档审计追溯',
      }
    : row.status === '草案'
      ? {
          status: '待提交审批',
          reason: '合同草案已形成，可提交合同审批',
          nextAction: '提交合同审批入口，等待后续 Java 审批流接入',
        }
      : row.status === '审批中'
        ? {
            status: '审批中',
            reason: '合同审批已提交，等待审批结果',
            nextAction: '跟进审批中心任务状态',
          }
        : {
            status: '已审批',
            reason: '合同已进入生效或履约状态',
            nextAction: '继续跟进履约、附件和归档',
        };
  const archiveBlockers = [
    receiptComplete ? undefined : '收货验收未完成',
    invoicePaid ? undefined : '发票付款未完成',
  ].filter((item): item is string => Boolean(item));
  const paymentReadinessLabel = !invoice
    ? '待供应商开票'
    : !receiptComplete
      ? '收货未完成，付款前置未满足'
      : invoicePaid
        ? '付款已完成'
        : invoiceVarianceAmount !== 0
          ? '存在金额差异，先处理对账'
          : '可进入付款申请/登记';
  const paymentPlanSummary = !invoice
    ? '待开票后生成付款计划'
    : invoicePaid
      ? '付款计划已关闭'
      : !paymentRequest
        ? '待创建付款申请'
        : paymentBatch
          ? `${paymentBatch.batchStatus} · ${paymentBatch.plannedPaymentDate ?? '计划付款日待排期'}`
          : `${paymentRequest.requestStatus} · 付款批次待同步`;
  const archiveReadiness = row.archiveStatus === '已归档'
    ? {
        status: '已归档',
        reason: '合同已归档，只保留审计追溯',
        nextAction: '查看归档审计和关联业务',
      }
    : archiveBlockers.length === 0
      ? {
          status: '可归档',
          reason: '收货验收和发票付款均已完成',
          nextAction: '可执行归档合同',
        }
      : {
          status: '暂不可归档',
          reason: archiveBlockers.join('，'),
          nextAction: receiptComplete ? '处理发票付款后再归档' : '先完成收货验收，再处理发票付款',
        };
  const fulfillmentLinkageSummary: ContractFulfillmentLinkageSummary = row.archiveStatus === '已归档'
    ? {
        stage: '履约完成',
        owner: '合同管理员',
        riskLevel: '低',
        progressPercent: 100,
        nextStep: archiveReadiness.nextAction,
      }
    : !receiptComplete && !invoicePaid
      ? {
          stage: '收货与付款阻断',
          owner: '采购执行 / 财务协同',
          riskLevel: '高',
          progressPercent: 50,
          nextStep: archiveReadiness.nextAction,
        }
      : receiptComplete && !invoicePaid
        ? {
            stage: '付款待处理',
            owner: '财务协同',
            riskLevel: '中',
            progressPercent: 75,
            nextStep: archiveReadiness.nextAction,
          }
        : {
            stage: '待归档',
            owner: '合同管理员',
            riskLevel: '低',
            progressPercent: 90,
            nextStep: archiveReadiness.nextAction,
        };
  const contractFinancialSummary: ContractFinancialSummary = {
    contractAmountLabel: row.amountLabel,
    invoiceAmountLabel: invoice ? compactCurrency(invoiceAmount) : '待开票',
    invoiceVarianceLabel,
    paymentReadinessLabel,
    archiveBlockingLabel: archiveBlockers.length > 0 ? archiveBlockers.join('，') : '无归档阻断',
    paymentPlanSummary,
  };
  const fulfillmentFinanceRows: ContractFulfillmentFinanceRow[] = [
    {
      label: '合同金额',
      value: row.amountLabel,
      status: '已关联订单',
      hint: `合同金额来自关联订单 ${order.id}，后续可接合同付款计划。`,
    },
    {
      label: '收货状态',
      value: receiptComplete ? '收货验收已完成' : receiptLabel,
      status: receiptComplete ? '已完成' : '归档阻断',
      hint: receiptComplete ? '收货节点满足归档前置条件。' : '需先进入收货验收页完成登记。',
    },
    {
      label: '发票金额',
      value: contractFinancialSummary.invoiceAmountLabel,
      status: invoice ? invoiceVarianceLabel : '待开票',
      hint: invoice
        ? `与合同/订单金额差异：${invoiceVarianceLabel}。`
        : '供应商尚未登记发票，暂不能进入付款闭环。',
    },
    {
      label: '付款状态',
      value: invoice?.paymentStatus ?? '待开票',
      status: paymentReadinessLabel,
      hint: invoicePaid ? '付款已完成，可作为归档前置证据。' : paymentReadinessLabel,
    },
    {
      label: '归档阻断',
      value: contractFinancialSummary.archiveBlockingLabel,
      status: archiveReadiness.status,
      hint: archiveReadiness.nextAction,
    },
  ];
  const contractPaymentPlanRows: ContractPaymentPlanRow[] = [
    {
      label: '关联发票',
      value: invoice?.id ?? '待开票',
      status: invoice?.paymentStatus ?? '未形成',
      hint: invoice
        ? `发票金额 ${compactCurrency(invoice.amount)}，付款计划从该发票的付款申请派生。`
        : '供应商开票后才会形成付款申请和付款批次。',
    },
    {
      label: '付款申请',
      value: paymentRequest?.id ?? '待创建',
      status: paymentRequest?.requestStatus ?? '未提交',
      hint: paymentRequest
        ? `付款申请金额 ${compactCurrency(paymentRequest.amount)}，批次号 ${paymentRequest.paymentBatchNo}。`
        : '当前合同关联发票尚未创建付款申请。',
    },
    {
      label: '付款批次',
      value: paymentRequest?.paymentBatchNo ?? '待分配',
      status: paymentBatch?.batchStatus ?? (paymentRequest ? '批次待同步' : '未形成'),
      hint: paymentBatch
        ? `批次总额 ${compactCurrency(paymentBatch.totalAmount)}，已登记 ${compactCurrency(paymentBatch.registeredAmount)}。`
        : '付款申请通过后会进入付款批次，本轮只读展示现有批次数据。',
    },
    {
      label: '计划付款日',
      value: paymentBatch?.plannedPaymentDate ?? '待排期',
      status: paymentPlanSummary,
      hint: '计划付款日来自现有付款批次字段，不新增合同付款计划接口。',
    },
    {
      label: '只读边界',
      value: '不新增合同付款计划接口',
      status: '只读展示',
      hint: '合同详情仅聚合既有发票、付款申请和付款批次，实际付款处理仍在发票付款模块完成。',
    },
  ];
  const contractFulfillmentEventStateRows = buildContractFulfillmentEventStateRows(
    row.archiveStatus,
    fulfillmentEvents,
  );
  const archiveReviewChecklistRows = buildContractArchiveReviewChecklistRows({
    approvalStatus: approvalReadiness.status,
    attachmentCount: options.attachmentCount ?? 0,
    fulfillmentEventCount: fulfillmentEvents.length,
    paymentPlanSummary,
    auditLogCount: options.auditLogCount ?? 0,
  });
  const archiveReviewConclusion = archiveReviewChecklistRows.every((item) => item.status === '已覆盖')
    ? '复核证据已覆盖，可结合归档门禁执行归档'
    : `仍有 ${archiveReviewChecklistRows.filter((item) => item.status !== '已覆盖').length} 项复核证据待补齐`;
  const archiveReviewGroupSummary = buildContractArchiveReviewGroupSummary(archiveReviewChecklistRows);
  const archiveReviewActionSuggestions = buildContractArchiveReviewActionSuggestions(archiveReviewChecklistRows);
  const contextActionRows: ContractContextActionRow[] = [
    {
      label: receiptComplete ? '查看收货验收' : '处理收货验收',
      moduleId: 'receipts',
      moduleLabel: '收货验收',
      status: receiptComplete ? '已完成' : '待处理',
      hint: receiptComplete
        ? '收货验收已完成，可进入收货验收页查看验收记录。'
        : '订单仍未完成收货验收，进入收货验收池登记验收结果。',
    },
    {
      label: invoicePaid ? '查看发票付款' : '处理发票付款',
      moduleId: 'invoices',
      moduleLabel: '发票付款',
      status: invoicePaid ? '已完成' : '待处理',
      hint: invoicePaid
        ? '发票付款已完成，可进入发票付款页查看付款记录。'
        : '发票仍未付款，进入发票付款页处理付款状态。',
    },
    row.archiveStatus === '已归档'
      ? {
          label: '查看归档审计',
          moduleId: 'contracts',
          moduleLabel: '合同管理',
          status: '已完成',
          hint: '合同已归档，仅保留审计追溯和关联业务查询。',
        }
      : {
          label: '处理合同归档',
          moduleId: 'contracts',
          moduleLabel: '合同管理',
          status: archiveReadiness.status === '可归档' ? '可处理' : '暂不可用',
          hint: archiveReadiness.status === '可归档'
            ? '收货和付款已完成，可在合同详情页执行归档合同。'
            : `归档前需要先完成：${archiveReadiness.reason}。`,
        },
  ];

  return {
    id: row.id,
    contractNo: row.contractNo,
    contractName: row.contractName,
    supplierName: row.supplierName,
    relatedOrderId: row.relatedOrderId,
    status: row.status,
    archiveStatus: row.archiveStatus,
    amountLabel: row.amountLabel,
    facts: [
      ...row.facts,
      {
        label: '合同来源',
        value: workspace.contracts?.some((contract) => contract.id === row.id) ? 'Java 合同台账' : '采购订单派生',
      },
      {
        label: '接口边界',
        value: workspace.contracts?.some((contract) => contract.id === row.id)
          ? 'Java 读写接口已接入，附件审批待后续迭代'
          : '暂不新增 Java API',
      },
    ],
    fulfillmentRows: [
      { label: '采购订单', value: `${order.id} · ${order.status}` },
      { label: '收货验收', value: receiptLabel },
      { label: '发票付款', value: invoice?.paymentStatus ?? '待开票' },
      { label: '合同归档', value: row.archiveStatus },
    ],
    fulfillmentLinkageSummary,
    fulfillmentFinanceRows,
    contractFinancialSummary,
    contractPaymentPlanRows,
    contractFulfillmentEventStateRows,
    archiveReviewChecklistRows,
    archiveReviewGroupSummary,
    archiveReviewActionSuggestions,
    archiveReviewConclusion,
    linkageCheckRows: [
      { label: '采购订单', value: `${order.id} · ${order.status}`, status: '已关联' },
      {
        label: '收货验收',
        value: delivery?.status ?? receiptLabel,
        status: receiptComplete ? '已完成' : '阻断归档',
      },
      {
        label: '发票付款',
        value: invoice?.paymentStatus ?? '待开票',
        status: invoicePaid ? '已完成' : '阻断归档',
      },
      {
        label: '合同归档',
        value: row.archiveStatus,
        status: row.archiveStatus === '已归档'
          ? '已归档'
          : archiveBlockers.length === 0 ? '可归档' : '等待前置完成',
      },
    ],
    approvalReadiness,
    archiveReadiness,
    canArchive: archiveReadiness.status === '可归档',
    contextActionRows,
    relatedRows: [
      {
        id: order.id,
        title: '关联采购订单',
        detail: `${row.amountLabel} · ${order.status}`,
      },
      rfq
        ? {
            id: rfq.id,
            title: '关联询价项目',
            detail: `${rfq.title} · ${rfq.status}`,
          }
        : undefined,
      delivery
        ? {
            id: delivery.id,
            title: '关联收货物流',
            detail: `${delivery.carrier} ${delivery.trackingNo} · ${delivery.status}`,
          }
        : undefined,
      invoice
        ? {
            id: invoice.id,
            title: '关联发票付款',
            detail: `${compactCurrency(invoice.amount)} · ${invoice.paymentStatus}`,
          }
        : undefined,
    ].filter((item): item is ContractRelatedRow => Boolean(item)),
    archiveBoundary: row.archiveStatus === '已归档'
      ? '已归档合同保持只读，仅支持审计追溯和后续查询。'
      : '未归档合同可继续推进审批和履约；归档后只读。',
    nextActionTitle: row.nextAction.title,
  };
};

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
        canRegisterReceipt: order.status === '已发货' && hasShippedDeliveryForOrder(workspace, order.id),
      };
    });

export const buildReceiptInspectionDetailPanel = (
  workspace: BuyerWorkspace,
  orderId: string,
): ReceiptInspectionDetailPanel | undefined => {
  const order = workspace.orders.find((item) => item.id === orderId);
  if (!order) return undefined;

  const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
  const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
  const invoice = workspace.invoices.find((item) => item.orderId === order.id);
  const rfq = workspace.rfqs.find((item) => item.id === order.rfqId);
  const awardApproval = rfq ? findRfqAwardApproval(workspace, rfq.id) : undefined;
  const awardApprovalComment = awardApproval?.reviewComment?.trim() || undefined;
  const sourceRfqLabel = rfq?.title ?? order.rfqId;
  const invoiceStatusLabel = invoice?.paymentStatus ?? '待开票';
  const nextAction = describeOrderNextAction(order);

  return {
    id: order.id,
    supplierName: supplier?.name ?? order.supplierId,
    status: order.status,
    amountLabel: compactCurrency(order.amount),
    logisticsLabel: orderLogisticsLabel(workspace, order.id),
    canRegisterReceipt: order.status === '已发货' && hasShippedDeliveryForOrder(workspace, order.id),
    nextActionTitle: nextAction.title,
    sourceOrderLabel: order.id,
    sourceRfqLabel,
    invoiceStatusLabel,
    ...(awardApproval ? { awardApprovalStatus: awardApproval.status ?? '待审批' } : {}),
    ...(awardApprovalComment ? { awardApprovalComment } : {}),
    facts: [
      { label: '供应商', value: supplier?.name ?? order.supplierId },
      { label: '订单金额', value: compactCurrency(order.amount) },
      { label: '来源询价', value: sourceRfqLabel },
      { label: '预计到货', value: order.expectedReceiptDate },
      { label: '发票状态', value: invoiceStatusLabel },
    ],
    logisticsFacts: [
      { label: '来源订单', value: order.id },
      { label: '来源询价', value: sourceRfqLabel },
      { label: '承运商', value: delivery?.carrier ?? '待发货' },
      { label: '物流单号', value: delivery?.trackingNo ?? '待维护' },
      { label: '物流状态', value: delivery?.status ?? '待发货' },
    ],
    acceptanceChecks: [
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      awardApprovalComment ? { label: '审批意见', value: awardApprovalComment } : undefined,
      { label: '物流信息', value: delivery?.status ?? '待发货' },
      { label: '订单状态', value: order.status },
      { label: '验收结果', value: order.status === '已收货' || order.status === '已完成' ? '已登记' : '待登记' },
      { label: '发票状态', value: invoiceStatusLabel },
    ].filter((row): row is BuyerModuleFact => Boolean(row)),
    postReceiptRows: [
      { label: '验收登记', value: order.status === '已收货' || order.status === '已完成' ? '已登记' : '待登记' },
      { label: '发票状态', value: invoiceStatusLabel },
      { label: '下一步', value: nextAction.title },
    ],
    relatedRows: [
      rfq
        ? {
            id: rfq.id,
            title: '询价项目',
            detail: `${rfq.title} · ${rfq.status}`,
          }
        : undefined,
      awardApproval
        ? {
            id: awardApproval.id ?? `${rfq?.id ?? order.rfqId}:award-approval`,
            title: '定标审批',
            detail: awardApprovalComment
              ? `${awardApproval.status ?? '待审批'} · ${awardApprovalComment}`
              : awardApproval.status ?? '待审批',
          }
        : undefined,
      invoice
        ? {
            id: invoice.id,
            title: '发票付款',
            detail: `${compactCurrency(invoice.amount)} · ${invoice.paymentStatus}`,
          }
        : undefined,
    ].filter((row): row is ReceiptInspectionRelatedRow => Boolean(row)),
  };
};

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

export const buildInvoicePaymentDetailPanel = (
  workspace: BuyerWorkspace,
  invoiceId: string,
  options: InvoicePaymentDetailPanelOptions = {},
): InvoicePaymentDetailPanel | undefined => {
  const invoice = workspace.invoices.find((item) => item.id === invoiceId);
  if (!invoice) return undefined;

  const supplier = workspace.suppliers.find((item) => item.id === invoice.supplierId);
  const order = workspace.orders.find((item) => item.id === invoice.orderId);
  const rfq = order ? workspace.rfqs.find((item) => item.id === order.rfqId) : undefined;
  const awardApproval = rfq ? findRfqAwardApproval(workspace, rfq.id) : undefined;
  const awardApprovalComment = awardApproval?.reviewComment?.trim() || undefined;
  const delivery = order ? workspace.deliveries.find((item) => item.orderId === order.id) : undefined;
  const paymentRequest = options.paymentRequests?.find((item) => item.invoiceId === invoice.id);
  const varianceHandling = options.varianceHandlings?.find((item) => item.invoiceId === invoice.id);
  const sourceRfqLabel = rfq?.title ?? order?.rfqId ?? '未找到';
  const receiptStatusLabel = order?.status === '已收货' || order?.status === '已完成' ? '已登记' : '待登记';
  const nextAction = describeInvoiceNextAction(invoice);

  return {
    id: invoice.id,
    supplierName: supplier?.name ?? invoice.supplierId,
    status: invoice.paymentStatus,
    amountLabel: compactCurrency(invoice.amount),
    canRegisterPayment: invoice.paymentStatus !== '已付款',
    nextActionTitle: nextAction.title,
    sourceOrderLabel: invoice.orderId,
    sourceRfqLabel,
    receiptStatusLabel,
    ...(awardApproval ? { awardApprovalStatus: awardApproval.status ?? '待审批' } : {}),
    ...(awardApprovalComment ? { awardApprovalComment } : {}),
    ...(paymentRequest ? { paymentRequestStatus: paymentRequest.requestStatus } : {}),
    ...(varianceHandling ? { varianceHandlingStatus: varianceHandling.status } : {}),
    facts: [
      { label: '供应商', value: supplier?.name ?? invoice.supplierId },
      { label: '关联订单', value: invoice.orderId },
      { label: '发票金额', value: compactCurrency(invoice.amount) },
      { label: '付款状态', value: invoice.paymentStatus },
    ],
    orderFacts: [
      { label: '来源询价', value: sourceRfqLabel },
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      { label: '订单状态', value: order?.status ?? '未找到' },
      { label: '订单金额', value: compactCurrency(order?.amount ?? 0) },
      { label: '预计到货', value: order?.expectedReceiptDate ?? '未维护' },
      { label: '收货验收', value: receiptStatusLabel },
    ].filter((row): row is BuyerModuleFact => Boolean(row)),
    paymentCheckRows: [
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      { label: '订单状态', value: order?.status ?? '未找到' },
      { label: '物流状态', value: delivery?.status ?? '待发货' },
      { label: '收货验收', value: receiptStatusLabel },
      { label: '付款状态', value: invoice.paymentStatus },
      paymentRequest ? { label: '付款申请', value: paymentRequest.requestStatus } : undefined,
      varianceHandling ? { label: '差异处理', value: varianceHandling.status } : undefined,
      { label: '下一步', value: nextAction.title },
    ].filter((row): row is InvoicePaymentCheckRow => Boolean(row)),
    relatedRows: [
      delivery
        ? {
            id: delivery.id,
            title: '物流信息',
            detail: `${delivery.carrier} ${delivery.trackingNo} · ${delivery.status}`,
          }
        : undefined,
      rfq
        ? {
            id: rfq.id,
            title: '询价项目',
            detail: `${rfq.title} · ${rfq.status}`,
          }
        : undefined,
      awardApproval
        ? {
            id: awardApproval.id ?? `${rfq?.id ?? order?.rfqId ?? invoice.id}:award-approval`,
            title: '定标审批',
            detail: awardApprovalComment
              ? `${awardApproval.status ?? '待审批'} · ${awardApprovalComment}`
              : awardApproval.status ?? '待审批',
          }
        : undefined,
      paymentRequest
        ? {
            id: paymentRequest.id,
            title: '付款申请',
            detail: `${paymentRequest.requestStatus} · ${paymentRequest.paymentBatchNo}`,
          }
        : undefined,
      varianceHandling
        ? {
            id: varianceHandling.id,
            title: '差异处理',
            detail: `${varianceHandling.status} · ${varianceHandling.result}`,
          }
        : undefined,
    ].filter((row): row is InvoicePaymentRelatedRow => Boolean(row)),
    paymentTimelineRows: [
      { label: '来源询价', value: sourceRfqLabel },
      awardApproval ? { label: '定标审批', value: awardApproval.status ?? '待审批' } : undefined,
      { label: '收货验收', value: receiptStatusLabel },
      { label: '发票登记', value: invoice.id },
      paymentRequest ? { label: '付款申请', value: paymentRequest.requestStatus } : undefined,
      { label: '付款状态', value: invoice.paymentStatus },
      { label: '下一步', value: nextAction.title },
    ].filter((row): row is InvoicePaymentTimelineRow => Boolean(row)),
  };
};

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

const buildAuditTargetContext = (
  workspace: BuyerWorkspace,
  targetType: string,
  targetId: string,
): { targetFacts: BuyerModuleFact[]; relatedRows: AuditLogRelatedRow[] } => {
  if (targetType === 'purchase_order') {
    const order = workspace.orders.find((item) => item.id === targetId);
    if (order) {
      const supplier = workspace.suppliers.find((item) => item.id === order.supplierId);
      const rfq = workspace.rfqs.find((item) => item.id === order.rfqId);
      const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
      const invoice = workspace.invoices.find((item) => item.orderId === order.id);
      return {
        targetFacts: [
          { label: '供应商', value: supplier?.name ?? order.supplierId },
          { label: '订单金额', value: compactCurrency(order.amount) },
          { label: '订单状态', value: order.status },
          { label: '关联询价', value: rfq?.title ?? order.rfqId },
        ],
        relatedRows: [
          delivery
            ? {
                id: delivery.id,
                title: '物流信息',
                detail: `${delivery.carrier} ${delivery.trackingNo} · ${delivery.status}`,
              }
            : undefined,
          invoice
            ? {
                id: invoice.id,
                title: '发票付款',
                detail: `${compactCurrency(invoice.amount)} · ${invoice.paymentStatus}`,
              }
            : undefined,
        ].filter((row): row is AuditLogRelatedRow => Boolean(row)),
      };
    }
  }

  if (targetType === 'purchase_demand') {
    const demand = workspace.demands.find((item) => item.id === targetId);
    if (demand) {
      return {
        targetFacts: [
          { label: '需求标题', value: demand.title },
          { label: '申请部门', value: demand.department },
          { label: '申请人', value: demand.requester },
          { label: '预算金额', value: compactCurrency(demand.budget) },
        ],
        relatedRows: demand.lineItems.map((lineItem, index) => {
          const material = workspace.materials.find((item) => item.id === lineItem.materialId);
          return {
            id: `${demand.id}:${lineItem.materialId}:${index}`,
            title: material?.name ?? lineItem.materialId,
            detail: `${lineItem.quantity} ${material?.unit ?? ''}`.trim(),
          };
        }),
      };
    }
  }

  if (targetType === 'invoice') {
    const invoice = workspace.invoices.find((item) => item.id === targetId);
    if (invoice) {
      const supplier = workspace.suppliers.find((item) => item.id === invoice.supplierId);
      return {
        targetFacts: [
          { label: '供应商', value: supplier?.name ?? invoice.supplierId },
          { label: '发票金额', value: compactCurrency(invoice.amount) },
          { label: '付款状态', value: invoice.paymentStatus },
          { label: '关联订单', value: invoice.orderId },
        ],
        relatedRows: [],
      };
    }
  }

  if (targetType === 'buyer_supplier_relation') {
    const relation = workspace.privateSupplierRelations.find((item) => item.id === targetId);
    if (relation) {
      const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
      return {
        targetFacts: [
          { label: '供应商', value: supplier?.name ?? relation.supplierId },
          { label: '合作状态', value: relation.status },
          { label: '等级', value: relation.level },
          { label: '绩效', value: `${relation.performanceScore} 分` },
        ],
        relatedRows: relation.categories.map((category) => ({
          id: `${relation.id}:${category}`,
          title: category,
          detail: '授权品类',
        })),
      };
    }
  }

  return {
    targetFacts: [
      { label: '对象类型', value: auditTargetLabels[targetType] ?? targetType },
      { label: '对象编号', value: targetId },
    ],
    relatedRows: [],
  };
};

export const buildAuditLogDetailPanel = (
  workspace: BuyerWorkspace,
  logId: string,
): AuditLogDetailPanel | undefined => {
  const log = workspace.auditLogs.find((item) => item.id === logId);
  if (!log) return undefined;

  const actor = workspace.users.find((user) => user.id === log.actorId);
  const targetTypeLabel = auditTargetLabels[log.targetType] ?? log.targetType;
  const title = auditActionLabels[log.action] ?? log.action;
  const targetContext = buildAuditTargetContext(workspace, log.targetType, log.targetId);
  const hasActor = Boolean(actor);
  const hasTargetContext = targetContext.targetFacts.length > 2;
  const traceabilityStatus = hasActor && hasTargetContext ? '完整留痕' : '基础留痕';

  return {
    id: log.id,
    title,
    actionCode: log.action,
    targetLabel: `${targetTypeLabel} · ${log.targetId}`,
    actorName: actor?.name ?? log.actorId,
    timeLabel: compactDateTime(log.createdAt),
    traceabilityTitle: traceabilityStatus === '完整留痕' ? '审计链路完整' : '审计链路待补充',
    traceabilityDesc: traceabilityStatus === '完整留痕'
      ? '已记录操作人、操作对象、业务上下文和关联业务，可支持后续追溯。'
      : '已记录基础操作信息，建议补齐业务对象上下文以增强审计可追溯性。',
    traceabilityStatus,
    facts: [
      { label: '操作人', value: actor?.name ?? log.actorId },
      { label: '操作时间', value: compactDateTime(log.createdAt) },
      { label: '对象类型', value: targetTypeLabel },
      { label: '对象编号', value: log.targetId },
    ],
    targetFacts: targetContext.targetFacts,
    relatedRows: targetContext.relatedRows,
    traceabilityRows: [
      { label: '操作人', value: actor?.name ?? log.actorId },
      { label: '对象类型', value: targetTypeLabel },
      { label: '关联业务', value: `${targetContext.relatedRows.length} 条` },
      { label: '留痕结果', value: '已记录' },
    ],
    timelineRows: [
      { label: '审计记录', value: compactDateTime(log.createdAt) },
      { label: '业务动作', value: title },
    ],
  };
};

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
    case 'contracts': {
      const contracts = buildContractLedgerRows(workspace);
      return [
        { label: '合同数量', value: `${contracts.length} 份` },
        { label: '履约中', value: `${countBy(contracts, (contract) => contract.status === '履约中')} 份` },
        { label: '已归档', value: `${countBy(contracts, (contract) => contract.archiveStatus === '已归档')} 份` },
      ];
    }
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
