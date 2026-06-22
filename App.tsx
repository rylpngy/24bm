import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Database,
  Eye,
  FileText,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  PackageCheck,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react';
import { approvalResultMessage, approvalTypeLabel } from './data/approvalUi';
import {
  buildAuditLogDetailPanel,
  buildAuditLogRows,
  buildApprovalCardFacts,
  buildApprovalDetailPanel,
  buildApprovalQueueRows,
  buildBuyerModuleFacts,
  buildContractDetailPanel,
  buildContractLedgerRows,
  buildDemandDetailPanel,
  buildDemandListRows,
  buildInvoicePaymentDetailPanel,
  buildInvoicePaymentRows,
  buildOrderDetailPanel,
  buildMaterialCatalogRows,
  buildMaterialDetailPanel,
  buildOrderFulfillmentRows,
  buildQuoteComparisonDetailPanel,
  buildReceiptInspectionDetailPanel,
  buildReceiptInspectionRows,
  buildRfqDetailPanel,
  buildRfqListRows,
  buildSupplierDetailPanel,
  buildSupplierRelationRows,
  buildWorkspaceApprovalQueue,
  type ApprovalDetailPanel,
  type AuditLogDetailPanel,
  type BuyerModuleFact,
  type ContractArchiveReviewActionSuggestion,
  type ContractDetailPanel,
  type DemandDetailPanel,
  type InvoicePaymentDetailPanel,
  type MaterialDetailPanel,
  type OrderDetailPanel,
  type QuoteComparisonDetailPanel,
  type ReceiptInspectionDetailPanel,
  type RfqDetailPanel,
  type SupplierDetailPanel,
  type SupplierRelationAction,
} from './data/buyerAdminUi';
import {
  adminRoleNavigation,
  defaultAdminModulesByRole,
  defaultAdminRole,
  type AdminRole,
  type BuyerAdminModule,
  type PlatformAdminModule,
  type SupplierAdminModule,
} from './data/adminNavigation';
import {
  canCreateOrderFromAward,
  canSubmitAwardApproval,
  describeRfqNextAction,
  selectRecommendedQuote,
  type BuyerNextAction,
} from './data/buyerWorkflow';
import {
  type AuditLogRecord,
  type BuyerWorkspace,
  type ContractLedgerItem,
  type MaterialItem,
  type ProcurementMvpModel,
  type Rfq,
  type SupplierWorkspace,
  type TenantKpis,
} from './data/procurementModel';
import {
  applyJavaPlatformWorkspaceData,
  applyJavaBuyerMasterData,
  applyJavaSupplierWorkspaceData,
  createJavaProcurementApiClient,
  loadJavaPlatformWorkspaceData,
  loadJavaBuyerMasterData,
  loadJavaSupplierWorkspaceData,
  mockApiClient,
  resolveAppRuntimeDataSource,
   runJavaMvpWorkflow,
   type CreateSupplierQualificationPayload,
   type CreateContractPayload,
   type CreateContractFulfillmentEventPayload,
   type CreateBuyerSupplierRelationPayload,
   type CreateDemandPayload,
   type SaveMaterialPayload,
   type UpdateContractPayload,
   type UpdateBuyerSupplierProfilePayload,
   type UpdateDemandPayload,
   type UpdateRfqPayload,
   type UpdateOrderPayload,
   type UpdateInvoicePayload,
   type UpdateSupplierProfilePayload,
   type PlatformWorkspaceData,
  type JavaPlatformAnnouncementDto,
  type JavaApprovalTaskDto,
  type JavaApprovalTemplateDto,
  type JavaNotificationDto,
  type BuyerRoleDto,
  type AttachmentRecord,
  type AttachmentDownloadLinkRecord,
  type AttachmentUploadTicketRecord,
  type ContractFulfillmentEventRecord,
  type CreateAttachmentPayload,
  type CreateAttachmentUploadTicketPayload,
  type PaymentBatchRecord,
    type PaymentBlockResolutionRecord,
    type PaymentExecutionRecord,
    type PaymentArchiveExceptionRequestRecord,
    type PaymentRequestRecord,
    type VarianceHandlingRecord,
} from './services/procurementApiClient';
import {
  DemoActionFeedbackPanel,
  DemoCommandCenterPanel,
  DemoPermissionAuditPanel,
  DemoReadinessPanel,
  DemoReadonlyBoundaryPanel,
  DemoWalkthroughRail,
  type DemoActionFeedbackItem,
  type DemoCommandCenterItem,
  type DemoCurrentActionGuide,
  type DemoGovernanceTraceItem,
  type DemoReadinessItem,
  type DemoReadonlyBoundaryItem,
  type DemoSequenceNavigation,
  type DemoWalkthroughStep,
} from './components/stageEightDemoPanels';

const buildDemoReadinessItems = (
  javaEnabled: boolean,
  roleActionCount: string,
  evidenceFile: string,
  sampleSummary: string,
): DemoReadinessItem[] => [
  {
    label: '前端页面已加载',
    status: '已加载',
    evidence: 'http://localhost:3000/',
    detail: '当前后台壳、三端菜单、演示总线和角色工作区已进入可展示状态。',
    tone: 'ready',
  },
  {
    label: 'Java 数据源',
    status: javaEnabled ? '已连接' : '待连接',
    evidence: 'http://localhost:8080/api/v1/health',
    detail: javaEnabled ? '当前页面使用 Java 数据源，可作为现场主验收路径。' : '当前页面未连接 Java 数据源，演示前需要切回 Java 模式。',
    tone: javaEnabled ? 'ready' : 'warning',
  },
  {
    label: '17 个真实动作',
    status: roleActionCount,
    evidence: evidenceFile,
    detail: `本角色证据文件：${evidenceFile}；三端合计保持 17 个已验收真实动作。`,
    tone: 'ready',
  },
  {
    label: '推荐样本',
    status: '推荐样本已标记',
    evidence: '阶段七稳定 seed 与阶段九卡片高亮',
    detail: sampleSummary,
    tone: 'ready',
  },
];

const moduleIcon = (moduleId: string): React.ElementType => {
  const icons: Record<string, React.ElementType> = {
    overview: LayoutDashboard,
    dashboard: LayoutDashboard,
    tenants: Building2,
    reviews: ClipboardCheck,
    announcements: Bell,
    demands: FileText,
    approvals: ShieldCheck,
    suppliers: Users,
    materials: Database,
    rfqs: Send,
    quotes: BarChart3,
    orders: ShoppingCart,
    contracts: FileText,
    receipts: PackageCheck,
    invoices: Receipt,
    audit: Activity,
    opportunities: Send,
    profile: BadgeCheck,
  };
  return icons[moduleId] ?? FileText;
};

const ALL_STATUS_FILTER = '全部状态';
const DEMO_LIST_DISPLAY_LIMIT = 20;
const limitDemoRows = <T,>(rows: T[]) => rows.slice(0, DEMO_LIST_DISPLAY_LIMIT);
const BUYER_MAIN_FLOW_DEMO_LIST_LIMIT = 6;
const limitBuyerDemoRows = <T,>(rows: T[], isRecommendedSample?: (row: T) => boolean) => {
  if (rows.length <= BUYER_MAIN_FLOW_DEMO_LIST_LIMIT) return rows;
  if (!isRecommendedSample) return rows.slice(0, BUYER_MAIN_FLOW_DEMO_LIST_LIMIT);

  const recommendedRows = rows.filter(isRecommendedSample);
  const recommendedSet = new Set(recommendedRows);
  return [
    ...recommendedRows,
    ...rows.filter((row) => !recommendedSet.has(row)),
  ].slice(0, BUYER_MAIN_FLOW_DEMO_LIST_LIMIT);
};
const SUPPLIER_COLLABORATION_DEMO_LIST_LIMIT = 6;
const limitSupplierDemoRows = <T,>(rows: T[], isRecommendedSample?: (row: T) => boolean) => {
  if (rows.length <= SUPPLIER_COLLABORATION_DEMO_LIST_LIMIT) return rows;
  if (!isRecommendedSample) return rows.slice(0, SUPPLIER_COLLABORATION_DEMO_LIST_LIMIT);

  const recommendedRows = rows.filter(isRecommendedSample);
  const recommendedSet = new Set(recommendedRows);
  return [
    ...recommendedRows,
    ...rows.filter((row) => !recommendedSet.has(row)),
  ].slice(0, SUPPLIER_COLLABORATION_DEMO_LIST_LIMIT);
};

const isRfqEligibleSupplierRelation = (relation: BuyerWorkspace['privateSupplierRelations'][number]) =>
  relation.status === '已准入'
    && Boolean(relation.qualifications?.some((qualification) => qualification.status === 'active'));

const scrollToStageNineDemoSample = (testIdPrefix: string) => {
  window.setTimeout(() => {
    document
      .querySelector(`[data-testid^="${testIdPrefix}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 0);
};

const buildDemoSequenceNavigation = <ModuleId extends string>(
  steps: Array<DemoWalkthroughStep<ModuleId>>,
  activeModule: ModuleId,
  closedLabel: string,
  onNavigate: (moduleId: ModuleId) => void,
  onLocateSample?: () => void,
): DemoSequenceNavigation<ModuleId> | undefined => {
  const activeIndex = steps.findIndex((step) => step.moduleId === activeModule);
  if (activeIndex < 0) return undefined;
  const currentStep = steps[activeIndex];
  const previousStep = activeIndex > 0 ? steps[activeIndex - 1] : undefined;
  const nextStep = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : undefined;

  return {
    currentLabel: currentStep.label,
    previousLabel: previousStep?.label ?? '演示起点',
    nextLabel: nextStep?.label ?? closedLabel,
    previousModuleId: previousStep?.moduleId,
    nextModuleId: nextStep?.moduleId,
    onPrevious: onNavigate,
    onNext: onNavigate,
    onLocateSample,
  };
};

const buyerDemoCommandCenterItems: DemoCommandCenterItem[] = [
  {
    storyline: '需求到付款闭环',
    actionCount: '7 个真实动作',
    evidence: 'stage-seven-java-real-action-click-result.json',
    nextPage: '采购需求 -> 审批中心 -> 询价项目 -> 报价对比 -> 采购订单 -> 收货验收 -> 发票付款',
  },
];

const contractDemoCommandCenterItems: DemoCommandCenterItem[] = [
  {
    storyline: '订单生成合同',
    actionCount: '订单来源 / 合同台账',
    evidence: 'stage-ten-contract-demo-path-result.json',
    nextPage: '采购订单 -> 合同管理',
  },
  {
    storyline: '合同审批',
    actionCount: '提交合同审批 / 审批中心回看',
    evidence: 'ContractApprovalFlowTests.java',
    nextPage: '合同管理 -> 审批中心',
  },
  {
    storyline: '合同履约事件',
    actionCount: '收货事件 / 付款事件',
    evidence: 'ContractFulfillmentEventTests.java',
    nextPage: '合同管理 -> 收货验收',
  },
  {
    storyline: '合同与订单/发票/付款关系',
    actionCount: '关联订单 / 发票付款 / 归档门禁',
    evidence: 'stage-ten-contract-demo-path-review.md',
    nextPage: '合同管理 -> 发票付款',
  },
];

const supplierDemoCommandCenterItems: DemoCommandCenterItem[] = [
  {
    storyline: '报价到应收协同',
    actionCount: '5 个真实动作',
    evidence: 'stage-seven-supplier-java-real-action-click-result.json',
    nextPage: '询价邀请 -> 报价记录 -> 销售订单 -> 发票应收',
  },
];

const platformDemoCommandCenterItems: DemoCommandCenterItem[] = [
  {
    storyline: 'SaaS 治理和运营动作',
    actionCount: '5 个真实动作',
    evidence: 'stage-seven-platform-java-real-action-click-result.json',
    nextPage: '平台看板 -> 租户列表 -> 企业审核 -> 平台公告',
  },
];

const buyerDemoCurrentActionGuides: Partial<Record<BuyerAdminModule, DemoCurrentActionGuide>> = {
  demands: {
    actionLabel: '提交审批 / 创建询价',
    targetButton: '提交审批、创建询价',
    prioritySample: 'dem-stage7-submit-ready / dem-stage7-rfq-ready',
    sampleLocator: '采购需求列表中优先找阶段七演示需求卡片',
    talkTrack: '需求页负责把业务申请推进到审批和询价准备，是采购方闭环的入口。',
    nextHop: '审批中心或询价项目',
  },
  approvals: {
    actionLabel: '通过需求审批',
    targetButton: '通过',
    prioritySample: 'approval-stage7-demand-pending',
    sampleLocator: '审批中心待办里优先找阶段七需求审批',
    talkTrack: '审批中心说明内控节点，审批通过后需求才能进入询价。',
    nextHop: '采购需求',
  },
  quotes: {
    actionLabel: '提交定标审批 / 生成采购订单',
    targetButton: '按推荐报价提交定标审批、生成采购订单',
    prioritySample: 'rfq-stage7-award-ready / award-stage7-order-ready',
    sampleLocator: '报价对比页优先打开阶段七定标和生成订单样本',
    talkTrack: '报价对比页把供应商报价、推荐理由、定标审批和订单生成连成一段。',
    nextHop: '采购订单',
  },
  receipts: {
    actionLabel: '登记收货',
    targetButton: '登记收货',
    prioritySample: 'po-stage7-receipt-ready',
    sampleLocator: '收货验收页优先找阶段七待收货订单',
    talkTrack: '收货验收把供应商发货转为采购方确认，是进入发票付款的前置条件。',
    nextHop: '发票付款',
  },
  invoices: {
    actionLabel: '登记付款',
    targetButton: '登记付款',
    prioritySample: 'inv-stage7-payment-ready',
    sampleLocator: '发票付款页优先找阶段七待付款发票',
    talkTrack: '付款页只登记付款状态和审计留痕，不触发真实资金流。',
    nextHop: '审计日志',
  },
};

type BuyerMainFlowOperationStripConfig = {
  pageLabel: string;
  focus: string;
  recommendedAction: string;
  boundary: string;
  listPolish: string;
  detailPolish: string;
  emptyStatePolish: string;
  buttonBoundaryPolish: string;
  nextModuleLabel: string;
  nextModuleId: BuyerAdminModule;
};

const buyerMainFlowOperationStrips: Partial<Record<BuyerAdminModule, BuyerMainFlowOperationStripConfig>> = {
  demands: {
    pageLabel: '采购需求',
    focus: '先说明需求来源、预算、附件和物料明细，再推进审批或创建询价。',
    recommendedAction: '提交审批或创建询价',
    boundary: '草稿才能提交审批；已通过且未关联询价的需求才允许创建 RFQ。',
    listPolish: '需求状态、预算、物料和下一步动作优先展示。',
    detailPolish: '详情先看主流程判断，再看写入边界、物料明细和编辑区。',
    emptyStatePolish: '暂无需求时说明先创建需求，再提交审批并转询价。',
    buttonBoundaryPolish: '提交审批和创建询价分开解释，避免误以为审批中也能建 RFQ。',
    nextModuleLabel: '审批中心',
    nextModuleId: 'approvals',
  },
  approvals: {
    pageLabel: '审批中心',
    focus: '把内控节点讲清楚：谁审批、审批什么、通过后流向哪里。',
    recommendedAction: '通过或驳回待办',
    boundary: '无待办时只讲最近审批记录；已处理审批不能重复通过。',
    listPolish: '审批类型、业务对象、处理意见和处理按钮保持同屏。',
    detailPolish: '详情先讲业务上下文，再讲审批意见、通过和驳回结果。',
    emptyStatePolish: '无待办时解释当前审批队列已处理，可看最近审批记录。',
    buttonBoundaryPolish: '只有待审批任务显示处理按钮，最近审批记录保持只读。',
    nextModuleLabel: '采购需求',
    nextModuleId: 'demands',
  },
  rfqs: {
    pageLabel: '询价项目',
    focus: '强调 RFQ 从已审批需求生成，供应商邀请、报价要求和截止时间是核心。',
    recommendedAction: '邀请供应商并进入报价对比',
    boundary: '报价不足时不进入定标；已定标项目只做状态回看。',
    listPolish: '询价状态、供应商邀请、报价数量和截止时间按同一顺序展示。',
    detailPolish: '详情先看状态流转，再看报价排行、关联业务和编辑区。',
    emptyStatePolish: '暂无询价时解释需要先从已审批需求创建 RFQ。',
    buttonBoundaryPolish: '报价中可跟进邀请，已定标后不再重复编辑定标动作。',
    nextModuleLabel: '报价对比',
    nextModuleId: 'quotes',
  },
  quotes: {
    pageLabel: '报价对比',
    focus: '先讲比较矩阵和推荐理由，再讲定标审批和订单生成条件。',
    recommendedAction: '提交定标审批或生成采购订单',
    boundary: '没有报价不能定标；定标审批未通过不能生成采购订单。',
    listPolish: '推荐理由、报价矩阵、定标审批和生成订单入口保持同屏。',
    detailPolish: '详情先讲推荐结论，再进入报价比较矩阵和关联业务。',
    emptyStatePolish: '暂无比价项目时解释等待供应商报价后再进入定标。',
    buttonBoundaryPolish: '定标审批和生成订单分两个动作，审批通过前不显示订单生成。',
    nextModuleLabel: '采购订单',
    nextModuleId: 'orders',
  },
  orders: {
    pageLabel: '采购订单',
    focus: '把定标结果承接成订单履约，说明供应商确认、发货和预计到货。',
    recommendedAction: '跟进供应商确认和发货',
    boundary: '供应商未发货前不能登记收货；已收货订单只做履约回看。',
    listPolish: '供应商、金额、物流、收货和发票状态固定为订单扫读顺序。',
    detailPolish: '详情先看订单履约时间线，再看物流、履约轨迹和预计到货编辑。',
    emptyStatePolish: '暂无订单时解释定标审批通过后才会生成采购订单。',
    buttonBoundaryPolish: '未发货订单不开放收货；已收货订单只保留状态回看。',
    nextModuleLabel: '收货验收',
    nextModuleId: 'receipts',
  },
  receipts: {
    pageLabel: '收货验收',
    focus: '把物流到货转成验收结果，异常先记录原因再进入后续处理。',
    recommendedAction: '登记收货或说明异常',
    boundary: '未发货不能收货；已收货记录不重复登记。',
    listPolish: '物流状态、验收结果、异常原因和登记入口保持同屏。',
    detailPolish: '详情先核对物流和验收检查，再填写验收备注与异常原因。',
    emptyStatePolish: '暂无待收货时解释供应商发货后才进入验收池。',
    buttonBoundaryPolish: '异常待处理必须填写原因，已收货记录不重复登记。',
    nextModuleLabel: '发票付款',
    nextModuleId: 'invoices',
  },
  invoices: {
    pageLabel: '发票付款',
    focus: '把发票、对账、差异处理和付款状态作为主流程收束点。',
    recommendedAction: '处理对账差异并登记付款',
    boundary: '存在差异先处理对账；已付款发票不再修改付款状态。',
    listPolish: '对账状态、差异处理、付款计划和付款登记保持同屏。',
    detailPolish: '详情先看三单匹配，再看付款计划、对账单摘要和付款轨迹。',
    emptyStatePolish: '暂无发票时解释供应商提交发票后才进入付款台账。',
    buttonBoundaryPolish: '存在差异先处理对账，已付款发票只做审计回看。',
    nextModuleLabel: '首页看板',
    nextModuleId: 'dashboard',
  },
};

const contractDemoCurrentActionGuide: DemoCurrentActionGuide = {
  actionLabel: '推荐合同样本讲解',
  targetButton: '定位推荐样本、提交合同审批、进入收货验收、进入发票付款',
  prioritySample: 'stage10-demo-sample-contract',
  sampleLocator: '合同台账里优先定位第一条 Java 合同或订单派生合同',
  talkTrack: '合同页负责把采购订单承接为合同台账，再串联审批、履约事件、收货、发票付款和归档边界。',
  nextHop: '审批中心 / 收货验收 / 发票付款',
};

type ContractDeepeningReadinessItem = {
  label: string;
  status: string;
  evidence: string;
  detail: string;
};

const buildContractDeepeningReadinessItems = (
  javaEnabled: boolean,
  contractCount: number,
  selectedDetail?: ContractDetailPanel,
  recommendedSample?: ContractLedgerItem,
): ContractDeepeningReadinessItem[] => [
  {
    label: '合同总览',
    status: `${contractCount} 份合同`,
    evidence: '合同管理页首屏',
    detail: '用合同数量、草案、生效/履约和已归档统计说明合同台账的当前业务状态。',
  },
  {
    label: '合同审批',
    status: selectedDetail?.approvalReadiness.status ?? '待选择合同',
    evidence: '提交合同审批 / 审批中心',
    detail: '复用现有合同审批按钮和审批中心承接，不新增合同工作流接口。',
  },
  {
    label: '履约事件',
    status: selectedDetail?.fulfillmentLinkageSummary.stage ?? '待选择合同',
    evidence: '收货事件 / 付款事件',
    detail: '从合同详情跳转收货验收和发票付款，形成履约事件回看与归档复核证据。',
  },
  {
    label: '订单/收货/发票/付款关系',
    status: selectedDetail?.relatedOrderId ? '已关联订单' : '待关联',
    evidence: selectedDetail?.relatedOrderId ?? '暂无关联订单',
    detail: '合同聚合订单、收货、发票和付款关系，但不替代这些业务模块的真实动作。',
  },
  {
    label: '归档门禁',
    status: selectedDetail?.archiveReadiness.status ?? '待选择合同',
    evidence: selectedDetail?.archiveReadiness.reason ?? '暂无归档判断',
    detail: '归档仍走 Java 服务端门禁；未满足条件时先说明阻断原因和解除路径。',
  },
  {
    label: '演示操作条',
    status: javaEnabled ? 'Java 数据源真实动作复验' : '等待 Java 数据源',
    evidence: 'stage10-contract-demo-action-loop',
    detail: '继续使用提交合同审批、推进履约、处理收货验收、处理发票付款和归档合同这组真按钮。',
  },
  {
    label: '推荐合同样本',
    status: recommendedSample ? '已准备' : '待生成',
    evidence: recommendedSample?.contractNo ?? '暂无推荐合同样本',
    detail: '演示时优先定位推荐合同样本，避免现场临时查找合同数据。',
  },
];

const supplierDemoCurrentActionGuides: Partial<Record<SupplierAdminModule, DemoCurrentActionGuide>> = {
  opportunities: {
    actionLabel: '提交报价',
    targetButton: '提交报价',
    prioritySample: 'rfq-stage7-supplier-quote-ready',
    sampleLocator: '询价邀请列表中优先找阶段七供应商报价样本',
    talkTrack: '商机页说明供应商只处理本企业收到的询价邀请。',
    nextHop: '报价记录',
  },
  orders: {
    actionLabel: '确认订单 / 提交发货 / 提交发票',
    targetButton: '确认订单、提交发货、提交发票',
    prioritySample: 'po-stage7-supplier-confirm-ready / po-stage7-supplier-delivery-ready / po-stage7-supplier-invoice-ready',
    sampleLocator: '销售订单页优先找阶段七确认、发货和开票样本',
    talkTrack: '销售订单页把采购方订单确认、物流提交和发票提交串成供应商履约主线。',
    nextHop: '发票应收',
  },
  invoices: {
    actionLabel: '保存对账备注',
    targetButton: '保存对账备注',
    prioritySample: 'inv-stage7-supplier-receivable-ready',
    sampleLocator: '发票应收页优先找阶段七待备注应收发票',
    talkTrack: '发票应收页强调供应商只能跟进应收和备注，付款结果由采购方登记。',
    nextHop: '企业档案或采购方发票付款页',
  },
};

type SupplierRealActionFeedbackItem = {
  action: string;
  enabled: boolean;
  targetTestId: string;
  beforeCheck: string;
  afterFeedback: string;
  failureFallback: string;
  nextFlow: string;
  collaborationBoundary: string;
};

const buildSupplierRealActionFeedbackItems = ({
  pendingQuoteCount,
  pendingConfirmCount,
  pendingDeliveryCount,
  invoiceReadyCount,
  pendingReceivableCount,
}: {
  pendingQuoteCount: number;
  pendingConfirmCount: number;
  pendingDeliveryCount: number;
  invoiceReadyCount: number;
  pendingReceivableCount: number;
}): SupplierRealActionFeedbackItem[] => [
  {
    action: '报价提交',
    enabled: pendingQuoteCount > 0,
    targetTestId: 'stage7-supplier-submit-quote-rfq-stage7-supplier-quote-ready',
    beforeCheck: '点前检查：RFQ 处于报价中、本企业尚未报价，报价金额和交付天数大于 0。',
    afterFeedback: '点击后反馈：顶部显示“报价已提交”，报价记录页可回看金额、税率和交付周期。',
    failureFallback: '失败兜底：提示报价已提交、询价已截止或当前供应商无权处理该邀请。',
    nextFlow: '后续流向：进入报价记录，等待采购方比价、定标和生成采购订单。',
    collaborationBoundary: '协同边界：供应商不能查看采购方预算和其他供应商报价。',
  },
  {
    action: '订单确认',
    enabled: pendingConfirmCount > 0,
    targetTestId: 'stage7-supplier-confirm-order-po-stage7-supplier-confirm-ready',
    beforeCheck: '点前检查：销售订单状态为待供应商确认，当前供应商是订单承接主体。',
    afterFeedback: '点击后反馈：顶部显示“供应商订单已确认”，订单进入待发货状态。',
    failureFallback: '失败兜底：提示订单已确认、订单不存在或供应商无权确认该订单。',
    nextFlow: '后续流向：进入销售订单发货区，填写承运商和物流单号。',
    collaborationBoundary: '协同边界：供应商确认订单，但不能替采购方登记收货验收。',
  },
  {
    action: '发货提交',
    enabled: pendingDeliveryCount > 0,
    targetTestId: 'stage7-supplier-create-delivery-po-stage7-supplier-delivery-ready',
    beforeCheck: '点前检查：订单已确认待发货，承运商和物流单号已填写。',
    afterFeedback: '点击后反馈：顶部显示“发货信息已提交”，采购方收货验收可读取物流信息。',
    failureFallback: '失败兜底：提示物流单号缺失、订单状态不允许发货或发货记录已存在。',
    nextFlow: '后续流向：等待采购方收货，收货后供应商提交发票。',
    collaborationBoundary: '协同边界：供应商维护物流信息，收货结论由采购方登记。',
  },
  {
    action: '发票提交',
    enabled: invoiceReadyCount > 0,
    targetTestId: 'stage7-supplier-create-invoice-po-stage7-supplier-invoice-ready',
    beforeCheck: '点前检查：采购方已收货、订单尚未开票，发票号和发票金额已填写。',
    afterFeedback: '点击后反馈：顶部显示“发票信息已提交”，发票进入供应商应收和采购方付款台账。',
    failureFallback: '失败兜底：提示订单未收货、重复开票或发票金额无效。',
    nextFlow: '后续流向：进入发票应收，保存对账备注并跟进回款。',
    collaborationBoundary: '协同边界：供应商提交发票，付款登记仍由采购方侧驱动。',
  },
  {
    action: '应收备注',
    enabled: pendingReceivableCount > 0,
    targetTestId: 'stage7-supplier-update-receivable-inv-stage7-supplier-receivable-ready',
    beforeCheck: '点前检查：发票未完成付款，应收备注已填写具体对账或回款跟进说明。',
    afterFeedback: '点击后反馈：顶部显示“应收对账备注已保存并刷新”，详情区回显最新备注。',
    failureFallback: '失败兜底：提示发票已付款、备注为空或当前供应商无权维护该应收。',
    nextFlow: '后续流向：继续等待采购方付款登记，必要时回到销售订单核对来源。',
    collaborationBoundary: '协同边界：供应商只能维护应收备注，不能修改采购方付款状态。',
  },
];

const platformDemoCurrentActionGuides: Partial<Record<PlatformAdminModule, DemoCurrentActionGuide>> = {
  tenants: {
    actionLabel: '停用租户 / 升级专业版',
    targetButton: '停用租户、升级专业版',
    prioritySample: 'tenant-stage7-platform-action',
    sampleLocator: '租户列表优先找阶段七平台演示租户',
    talkTrack: '租户列表讲 SaaS 运营治理，不修改采购方业务单据。',
    nextHop: '企业审核',
  },
  reviews: {
    actionLabel: '通过企业审核',
    targetButton: '通过企业审核',
    prioritySample: 'ent-stage7-platform-review-ready',
    sampleLocator: '企业审核页优先找阶段七待审核企业',
    talkTrack: '企业审核页讲公共企业档案准入，平台只处理入驻合规。',
    nextHop: '平台公告',
  },
  announcements: {
    actionLabel: '发布平台公告 / 撤回平台公告',
    targetButton: '发布平台公告、撤回平台公告',
    prioritySample: 'announcement-stage7-platform-withdraw-ready',
    sampleLocator: '平台公告页优先发布新公告，再选择可撤回公告',
    talkTrack: '平台公告页讲运营通知生命周期，公告不改变采购流程状态。',
    nextHop: '平台看板',
  },
};

const buyerDemoActionFeedbackItems: DemoActionFeedbackItem[] = [
  {
    action: '提交审批',
    prerequisite: '存在草稿采购需求，并已补齐预算、物料明细和附件说明。',
    success: '页面显示需求已提交审批，需求进入审批中心待处理。',
    fallback: '如果按钮不可用，先确认当前需求是否已经提交或不是草稿状态。',
    nextStep: '进入审批中心，演示通过或驳回需求审批。',
  },
  {
    action: '通过审批',
    prerequisite: '审批中心存在待审批任务，且当前账号具备审批处理权限。',
    success: '审批任务完成，需求状态变为已通过，可进入询价准备。',
    fallback: '如果没有待办，说明演示样本已被处理，需要重新执行 stage7 seed 或三端验收脚本。',
    nextStep: '回到采购需求，为已通过需求创建询价。',
  },
  {
    action: '创建询价',
    prerequisite: '需求已审批通过，且尚未关联 RFQ。',
    success: '系统生成询价项目，并把需求明细带入询价协同流程。',
    fallback: '如果创建入口不可用，检查需求是否仍在审批中或已经创建过询价。',
    nextStep: '进入询价项目，讲解供应商邀请和报价要求。',
  },
  {
    action: '提交定标审批',
    prerequisite: '询价项目已有供应商报价，且尚未完成定标。',
    success: '推荐报价被提交为定标审批，系统保留比价和推荐理由。',
    fallback: '如果不能提交，先确认项目是否已经定标或报价数量不足。',
    nextStep: '定标审批通过后，在报价对比页生成采购订单。',
  },
  {
    action: '生成采购订单',
    prerequisite: '定标审批已通过，且当前定标结果还未生成订单。',
    success: '系统生成采购订单，订单进入供应商确认和履约阶段。',
    fallback: '如果按钮不可见，说明订单已生成或定标仍未审批通过。',
    nextStep: '进入采购订单，跟进供应商确认、发货和预计到货。',
  },
  {
    action: '登记收货',
    prerequisite: '供应商已提交发货信息，采购方可进行到货验收。',
    success: '收货验收完成，订单可进入发票和付款协同。',
    fallback: '如果不能登记，先确认供应商是否已发货或订单是否已经收货。',
    nextStep: '进入发票付款，核对发票、三单匹配和付款状态。',
  },
  {
    action: '登记付款',
    prerequisite: '存在未付款发票，并已完成必要的收货和对账核对。',
    success: '付款状态被登记，当前阶段不触发真实资金流。',
    fallback: '如果不可登记，说明发票已付款、缺少发票或仍有对账差异。',
    nextStep: '用审计日志回看付款登记和主流程闭环。',
  },
];

const supplierDemoActionFeedbackItems: DemoActionFeedbackItem[] = [
  {
    action: '提交报价',
    prerequisite: '供应商收到报价中 RFQ，且本企业还没有提交报价。',
    success: '报价记录保存到供应商侧，并同步给采购方用于比价。',
    fallback: '如果不能提交，检查是否已报价、询价已截止或不是当前供应商的邀请。',
    nextStep: '切到采购方报价对比页，演示推荐定标和审批。',
  },
  {
    action: '确认订单',
    prerequisite: '采购方已生成采购订单，订单状态为待供应商确认。',
    success: '销售订单进入待发货，供应商可以登记物流信息。',
    fallback: '如果按钮不可见，说明订单已确认或采购方尚未生成订单。',
    nextStep: '填写承运商和物流单号，提交发货。',
  },
  {
    action: '提交发货',
    prerequisite: '订单已确认，且承运商和物流单号已填写。',
    success: '发货信息同步到采购方收货验收页面。',
    fallback: '如果提交失败，先核对物流单号是否为空或订单是否已经发货。',
    nextStep: '采购方登记收货后，供应商提交发票。',
  },
  {
    action: '提交发票',
    prerequisite: '采购方已收货，供应商填写发票号和发票金额。',
    success: '发票进入供应商应收和采购方发票付款台账。',
    fallback: '如果不能提交，检查订单是否已收货或发票是否已经存在。',
    nextStep: '进入发票应收，维护对账备注并跟进付款状态。',
  },
  {
    action: '保存对账备注',
    prerequisite: '供应商存在应收发票，需要补充对账口径或回款跟进说明。',
    success: '对账备注保存，便于采购方和供应商在同一发票上协同。',
    fallback: '如果保存失败，检查是否选中发票或当前发票是否仍可维护备注。',
    nextStep: '等待采购方登记付款，供应商侧只跟进应收状态。',
  },
];

const platformDemoActionFeedbackItems: DemoActionFeedbackItem[] = [
  {
    action: '停用租户',
    prerequisite: '平台端选中可维护的 SaaS 租户。',
    success: '租户状态更新为停用，平台侧保留运营治理口径。',
    fallback: '如果不可停用，检查租户是否已停用或当前样本状态是否已被验收脚本处理。',
    nextStep: '继续演示套餐升级和功能开关。',
  },
  {
    action: '升级专业版',
    prerequisite: '租户存在可维护套餐和用户容量。',
    success: '套餐升级为专业版，页面展示新的套餐和容量配置。',
    fallback: '如果更新失败，检查平台账号权限和租户状态。',
    nextStep: '进入企业审核，演示平台企业准入。',
  },
  {
    action: '通过企业审核',
    prerequisite: '企业审核池中存在待审核企业，并完成资料和风险确认。',
    success: '企业审核通过，公共企业档案进入已认证状态。',
    fallback: '如果按钮不可用，确认资料确认和风险确认是否都已勾选。',
    nextStep: '进入平台公告，演示运营通知生命周期。',
  },
  {
    action: '发布平台公告',
    prerequisite: '公告标题、正文和发布范围已填写。',
    success: '公告发布到平台公告池，并产生站内通知演示口径。',
    fallback: '如果发布失败，检查标题或正文是否为空。',
    nextStep: '选择公告后演示撤回生命周期。',
  },
  {
    action: '撤回平台公告',
    prerequisite: '存在 active 公告，且已在公告生命周期面板选中。',
    success: '公告从 active 列表撤回，页面显示撤回反馈。',
    fallback: '如果按钮找不到，先选择目标公告卡片或重置 stage7 平台演示样本。',
    nextStep: '用平台边界说明强调公告不修改采购业务单据。',
  },
];

type PlatformOperationsDemoLoopItem = {
  storyline: string;
  enabled: boolean;
  primaryActions: string;
  targetTestIds: string[];
  governanceTarget: string;
  beforeCheck: string;
  afterFeedback: string;
  nextFlow: string;
  operationsBoundary: string;
};

const buildPlatformOperationsDemoLoopItems = ({
  tenantActionCount,
  enterpriseReviewCount,
  announcementCount,
  javaEnabled,
}: {
  tenantActionCount: number;
  enterpriseReviewCount: number;
  announcementCount: number;
  javaEnabled: boolean;
}): PlatformOperationsDemoLoopItem[] => [
  {
    storyline: '租户治理',
    enabled: javaEnabled && tenantActionCount > 0,
    primaryActions: '停用租户 / 升级专业版',
    targetTestIds: [
      'stage7-platform-disable-tenant-tenant-stage7-platform-action',
      'stage7-platform-upgrade-plan-tenant-stage7-platform-action',
    ],
    governanceTarget: '采购方企业租户、套餐版本、用户容量和询价比价功能开关。',
    beforeCheck: '点前检查：优先定位 tenant-stage7-platform-action，确认租户未停用且套餐可维护。',
    afterFeedback: '点击后反馈：页面显示租户状态或套餐已更新，顶部反馈用于说明 Java 写入结果。',
    nextFlow: '后续流向：进入企业审核，说明平台治理完租户后继续处理企业入驻合规。',
    operationsBoundary: '运营边界：平台只维护租户配置，不参与采购方需求审批、定标、收货和付款。',
  },
  {
    storyline: '企业审核',
    enabled: javaEnabled && enterpriseReviewCount > 0,
    primaryActions: '通过企业审核',
    targetTestIds: [
      'stage7-platform-approve-review-ent-stage7-platform-review-ready',
    ],
    governanceTarget: '采购方或供应商企业的公共入驻档案、资料确认和风险复核。',
    beforeCheck: '点前检查：勾选企业入驻资料已核对、风险与重复企业已复核，再处理审核。',
    afterFeedback: '点击后反馈：页面显示企业审核已通过，公共企业身份进入已认证状态。',
    nextFlow: '后续流向：进入平台公告，向已入驻企业发布运营通知。',
    operationsBoundary: '运营边界：平台审核公共企业身份，不替采购方建立私域供应商准入关系。',
  },
  {
    storyline: '平台公告',
    enabled: javaEnabled && announcementCount > 0,
    primaryActions: '发布平台公告 / 撤回平台公告',
    targetTestIds: [
      'stage7-platform-publish-announcement',
      'stage7-platform-withdraw-announcement-announcement-stage7-platform-withdraw-ready',
    ],
    governanceTarget: '平台公告标题、正文、发布范围、站内通知和撤回审计。',
    beforeCheck: '点前检查：发布前填写标题和正文；撤回前选择 announcement-stage7-platform-withdraw-ready。',
    afterFeedback: '点击后反馈：页面显示公告已发布或已撤回，公告池同步刷新。',
    nextFlow: '后续流向：回到平台看板，说明公告是运营触达，不改变采购业务状态。',
    operationsBoundary: '运营边界：公告只做运营通知，不变更供应商报价、采购订单、发票或付款状态。',
  },
];

const buyerReadonlyBoundaryItems: DemoReadonlyBoundaryItem[] = [
  {
    state: '采购需求已提交或已审批',
    businessMeaning: '需求进入审批链后不再允许随意改预算、附件和物料明细，避免审批依据被改动。',
    userGuidance: '如需调整，先说明撤回或补充需求的业务原因，再重新走审批。',
    fallback: '不可操作时提示已完成审批状态，并引导查看审批中心和审计日志。',
  },
  {
    state: 'RFQ 已定标或已生成订单',
    businessMeaning: '询价项目进入定标或订单阶段后，报价对比结果成为后续履约依据。',
    userGuidance: '演示时说明报价只读、推荐理由留痕，新增供应商邀请需重新发起询价。',
    fallback: '按钮不可操作时展示流程已完成，继续讲解订单、收货和发票付款。',
  },
  {
    state: '订单已收货',
    businessMeaning: '订单验收完成后，履约主责从物流跟进转为发票、对账和付款状态协同。',
    userGuidance: '继续进入发票付款页，查看三单匹配、付款计划和付款登记。',
    fallback: '重复登记收货时提示已完成，不再产生新的收货记录。',
  },
  {
    state: '发票已付款或批次已归档',
    businessMeaning: '付款登记或批次归档后进入财务留痕阶段，页面以查询和审计为主。',
    userGuidance: '如需解释资金流，强调当前阶段只登记付款状态，不触发真实支付。',
    fallback: '不可操作时提示已归档或已付款，并引导查看付款批次、对账差异和审计日志。',
  },
  {
    state: '当前筛选无数据',
    businessMeaning: '无数据代表当前筛选条件下暂无待办，不代表系统异常或页面故障。',
    userGuidance: '演示者可切换状态筛选、刷新 Java 数据源，或回到主流程入口产生样本数据。',
    fallback: '空状态显示无数据说明和下一步入口，避免出现空白页面。',
  },
];

const supplierReadonlyBoundaryItems: DemoReadonlyBoundaryItem[] = [
  {
    state: '已提交报价',
    businessMeaning: '报价提交后进入采购方比价视角，供应商不能查看其他供应商明细。',
    userGuidance: '继续切到采购方报价对比页讲解推荐定标和审批。',
    fallback: '再次提交时提示已报价或询价截止，并保留报价历史可查。',
  },
  {
    state: '订单已发货或已收货',
    businessMeaning: '发货后物流信息成为采购方收货依据，收货后进入发票应收协同。',
    userGuidance: '已发货时等待采购方验收；已收货时提交发票并维护应收备注。',
    fallback: '不可操作时提示订单已发货或已收货，避免重复确认和重复发货。',
  },
  {
    state: '发票已提交',
    businessMeaning: '发票提交后由采购方完成对账、付款计划和付款登记。',
    userGuidance: '供应商侧继续查看发票应收和保存对账备注。',
    fallback: '再次提交时提示发票已存在，避免同一订单重复开票。',
  },
  {
    state: '采购方已登记付款',
    businessMeaning: '采购方登记付款后，供应商侧应收进入已回款或待确认状态。',
    userGuidance: '演示时强调供应商只能查看付款状态，不能替采购方改付款结论。',
    fallback: '付款后操作转为只读跟踪，保留备注和审计记录。',
  },
  {
    state: '当前筛选无数据',
    businessMeaning: '没有邀请、订单或应收记录时，代表当前供应商暂无待处理商机。',
    userGuidance: '可切回采购方创建询价或生成订单，触发供应商侧待办。',
    fallback: '空状态显示无数据说明，不出现空白工作区。',
  },
];

const platformReadonlyBoundaryItems: DemoReadonlyBoundaryItem[] = [
  {
    state: '租户已停用',
    businessMeaning: '停用租户属于 SaaS 治理动作，保留租户运营状态而不删除业务数据。',
    userGuidance: '演示时强调平台端只管租户状态和套餐能力，不改采购单据。',
    fallback: '已停用租户再次操作时提示不可操作，避免误解为系统无响应。',
  },
  {
    state: '企业已通过或已驳回',
    businessMeaning: '企业审核处理完成后，审核结论成为公共企业档案的准入依据。',
    userGuidance: '如需重新审核，后续应走资料变更或重新提交流程。',
    fallback: '按钮不可用时提示已完成审核，并展示审核结论。',
  },
  {
    state: '公告已撤回',
    businessMeaning: '公告撤回后不再作为 active 通知展示，但仍保留运营留痕。',
    userGuidance: '继续讲解公告生命周期和站内通知口径。',
    fallback: '再次撤回时提示已撤回，不删除历史公告记录。',
  },
  {
    state: '平台公告为空',
    businessMeaning: '公告为空表示当前没有可展示运营通知，不影响采购业务主流程。',
    userGuidance: '演示者可发布一条平台公告，再讲解撤回生命周期。',
    fallback: '空状态显示无数据说明和发布入口，不用解释为接口错误。',
  },
  {
    state: '平台只读治理边界',
    businessMeaning: '平台运营方能看租户、企业准入和公共运营信息，不能干预采购方定标付款。',
    userGuidance: '演示三端隔离时用它解释为什么平台看不到采购方私域财务细节。',
    fallback: '不可操作时提示权限边界，而不是给出技术错误。',
  },
];

const buyerGovernanceTraceItems: DemoGovernanceTraceItem[] = [
  {
    actor: '采购负责人 / 审批人',
    action: '提交审批、定标、生成订单、登记收货和付款状态',
    auditTarget: '需求、审批任务、RFQ、订单、收货、发票和付款批次',
    traceEntry: '采购方审计日志、详情面板和付款归档审计摘要',
  },
  {
    actor: '采购财务 / 履约协同人',
    action: '核对三单匹配、处理差异、登记付款和归档批次',
    auditTarget: '发票、对账单、付款申请、付款批次和阻断处理',
    traceEntry: '发票付款页、付款批次详情和归档后只读审计面板',
  },
];

const supplierGovernanceTraceItems: DemoGovernanceTraceItem[] = [
  {
    actor: '供应商销售 / 发货协同人',
    action: '提交报价、确认订单、提交发货、提交发票和保存对账备注',
    auditTarget: '询价邀请、报价、销售订单、物流、发票和应收备注',
    traceEntry: '供应商报价记录、订单履约记录和发票应收记录',
  },
  {
    actor: '供应商企业管理员',
    action: '维护企业档案、资质附件、联系人和子账号协作信息',
    auditTarget: '供应商企业档案、资质、联系人和账号协同状态',
    traceEntry: '供应商企业档案页和平台公共企业档案联动口径',
  },
];

const platformGovernanceTraceItems: DemoGovernanceTraceItem[] = [
  {
    actor: '平台运营管理员',
    action: '停用租户、升级套餐、审核企业、发布和撤回公告',
    auditTarget: '租户、企业档案、平台公告和站内通知',
    traceEntry: '平台运营详情、企业审核记录和公告生命周期审计',
  },
  {
    actor: '平台合规 / 客服运营',
    action: '解释多租户隔离、功能开关、公告触达和公共供应商档案边界',
    auditTarget: 'SaaS 租户、功能开关、公共企业档案和平台通知',
    traceEntry: '平台看板、租户详情、企业审核详情和操作日志口径',
  },
];

const currency = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

const formatAuditTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const appDataSource = resolveAppRuntimeDataSource(runtimeEnv);

const javaApiClient = appDataSource.mode === 'java'
  ? createJavaProcurementApiClient({
      baseUrl: appDataSource.javaApiBaseUrl,
      platformLogin: {
        account: runtimeEnv.VITE_JAVA_PLATFORM_ACCOUNT ?? 'platform.admin@example.com',
        password: runtimeEnv.VITE_JAVA_PLATFORM_PASSWORD ?? 'demo123456',
        scope: 'PLATFORM',
      },
      buyerLogin: {
        account: runtimeEnv.VITE_JAVA_BUYER_ACCOUNT ?? 'buyer.owner@example.com',
        password: runtimeEnv.VITE_JAVA_BUYER_PASSWORD ?? 'demo123456',
        scope: 'BUYER',
        tenantId: runtimeEnv.VITE_JAVA_BUYER_TENANT_ID ?? 'tenant-acme',
      },
      supplierLogin: {
        account: runtimeEnv.VITE_JAVA_SUPPLIER_ACCOUNT ?? 'supplier.sales@example.com',
        password: runtimeEnv.VITE_JAVA_SUPPLIER_PASSWORD ?? 'demo123456',
        scope: 'SUPPLIER',
        supplierId: runtimeEnv.VITE_JAVA_SUPPLIER_ID ?? 'ent-supplier-sunrise',
      },
    })
  : null;

const formatWorkflowError = (error: unknown, fallback: string) => {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes('Payment batch is archived and can only be audited')) {
    return '付款批次已归档，当前操作已按只读冻结规则拒绝；请查看归档审计摘要和审计追踪。';
  }
  return message || fallback;
};

const resolveInitialAdminShellState = () => {
  const fallbackModules = { ...defaultAdminModulesByRole };
  if (typeof window === 'undefined') {
    return {
      role: defaultAdminRole,
      modules: fallbackModules,
    };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const roleParam = searchParams.get('role');
  const moduleParam = searchParams.get('module');
  const roleNavigation = adminRoleNavigation.find((role) => role.id === roleParam);
  if (!roleNavigation) {
    return {
      role: defaultAdminRole,
      modules: fallbackModules,
    };
  }

  const moduleNavigation = roleNavigation.modules.find((module) => module.id === moduleParam);
  if (!moduleNavigation) {
    return {
      role: roleNavigation.id,
      modules: fallbackModules,
    };
  }

  return {
    role: roleNavigation.id,
    modules: {
      ...fallbackModules,
      [roleNavigation.id]: moduleNavigation.id,
    },
  };
};

type SupplierQuoteDraft = {
  amount: number;
  taxRate: number;
  deliveryDays: number;
};

type SupplierDeliveryDraft = {
  carrier: string;
  trackingNo: string;
};

type SupplierInvoiceDraft = {
  amount: number;
  invoiceNo: string;
};

type SupplierReceivableDraft = {
  reconciliationNote: string;
};

type SupplierProfileDraft = UpdateSupplierProfilePayload;
type SupplierQualificationDraft = CreateSupplierQualificationPayload;

type BuyerReceiptDraft = {
  result: string;
  receiptRemark: string;
  exceptionReason: string;
  attachmentNames: string;
};

type BuyerPaymentDraft = {
  paymentStatus: string;
  paymentRemark: string;
  paymentRequestStatus: string;
  reconciliationNote: string;
};

type BuyerPaymentBlockResolutionDraft = {
  paymentBatchNo: string;
  paymentRequestId: string;
  invoiceId: string;
  supplierId?: string | null;
  blockReason: string;
  resolutionStatus: string;
  resolutionAction: string;
  nextStep: string;
  existingResolutionId?: string | null;
};

type BuyerAwardDraft = {
  reason: string;
};

type BuyerOrderDraft = {
  expectedReceiptDate: string;
};

type BuyerContractDraft = {
  relatedOrderId: string;
  contractNo: string;
  contractName: string;
  amount: number;
  status: string;
  fulfillmentProgress: string;
  effectiveDate: string;
};

type BuyerContractAttachmentDraft = {
  fileName: string;
  visibility: 'tenant' | 'buyer_internal' | 'supplier_shared';
};

type BuyerContractTargetFocus = {
  moduleId: BuyerAdminModule;
  contractNo: string;
  orderId: string;
  invoiceId?: string;
  sourceLabel: string;
  archiveReviewGapItem?: string;
  archiveReviewSuggestedAction?: string;
  archiveReviewHandlingPath?: string;
};

type BuyerContractLinkedActionResult = {
  contractNo: string;
  actionType: 'receipt' | 'payment';
  targetId: string;
  sourceLabel: string;
  summary: string;
  archiveReviewResultGapItem?: string;
  archiveReviewResultEvidenceStatus?: string;
  archiveReviewResultNextStep?: string;
};

type BuyerSupplierAdmissionDraft = {
  reason: string;
  qualificationSummary: string;
  contactName: string;
  contactPhone: string;
  categoryConfirmed: boolean;
  riskConfirmed: boolean;
};

type BuyerApprovalReviewDraft = {
  comment: string;
  confirmed: boolean;
};

const App: React.FC = () => {
  const [initialAdminShellState] = useState(resolveInitialAdminShellState);
  const [activeRole, setActiveRole] = useState<AdminRole>(initialAdminShellState.role);
  const [activeModules, setActiveModules] = useState<Record<AdminRole, string>>(initialAdminShellState.modules);
  const [tenantId, setTenantId] = useState('tenant-acme');
  const [supplierId, setSupplierId] = useState('supplier-orbit');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformData, setPlatformData] = useState<PlatformWorkspaceData | null>(null);
  const [buyerData, setBuyerData] = useState<{
    workspace: BuyerWorkspace;
    kpis: TenantKpis;
    pendingApprovals: JavaApprovalTaskDto[];
    recentApprovals: JavaApprovalTaskDto[];
    buyerNotifications: JavaNotificationDto[];
    approvalTemplates: JavaApprovalTemplateDto[];
    roles: BuyerRoleDto[];
    paymentBatches: PaymentBatchRecord[];
    paymentExecutionRecords: PaymentExecutionRecord[];
    paymentBlockResolutions: PaymentBlockResolutionRecord[];
    paymentArchiveExceptionRequests: PaymentArchiveExceptionRequestRecord[];
    paymentRequests: PaymentRequestRecord[];
    varianceHandlings: VarianceHandlingRecord[];
  } | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierWorkspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [contractAttachmentsById, setContractAttachmentsById] = useState<Record<string, AttachmentRecord[]>>({});
  const [contractAttachmentUploadTicketsById, setContractAttachmentUploadTicketsById] = useState<Record<string, AttachmentUploadTicketRecord>>({});
  const [contractAttachmentDownloadLinksById, setContractAttachmentDownloadLinksById] = useState<Record<string, AttachmentDownloadLinkRecord>>({});
  const [contractFulfillmentEventsById, setContractFulfillmentEventsById] = useState<Record<string, ContractFulfillmentEventRecord[]>>({});
  const [contractTargetAuditLogsById, setContractTargetAuditLogsById] = useState<Record<string, AuditLogRecord[]>>({});
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [demandCreateBusy, setDemandCreateBusy] = useState(false);
  const [materialSaveBusyId, setMaterialSaveBusyId] = useState<string | null>(null);
  const [demandSubmitBusyId, setDemandSubmitBusyId] = useState<string | null>(null);
  const [demandUpdateBusyId, setDemandUpdateBusyId] = useState<string | null>(null);
  const [supplierAdmissionBusyId, setSupplierAdmissionBusyId] = useState<string | null>(null);
  const [supplierRelationBusyId, setSupplierRelationBusyId] = useState<string | null>(null);
  const [supplierActionBusyId, setSupplierActionBusyId] = useState<string | null>(null);
  const [rfqCreateBusy, setRfqCreateBusy] = useState<string | null>(null);
  const [rfqUpdateBusyId, setRfqUpdateBusyId] = useState<string | null>(null);
  const [awardSubmitBusyId, setAwardSubmitBusyId] = useState<string | null>(null);
  const [orderCreateBusy, setOrderCreateBusy] = useState<string | null>(null);
  const [orderUpdateBusyId, setOrderUpdateBusyId] = useState<string | null>(null);
  const [invoiceUpdateBusyId, setInvoiceUpdateBusyId] = useState<string | null>(null);
  const [buyerFulfillmentBusyId, setBuyerFulfillmentBusyId] = useState<string | null>(null);
  const [platformReviewBusyId, setPlatformReviewBusyId] = useState<string | null>(null);
  const [platformTenantBusyId, setPlatformTenantBusyId] = useState<string | null>(null);
  const [announcementPublishBusy, setAnnouncementPublishBusy] = useState(false);
  const [announcementLifecycleBusyId, setAnnouncementLifecycleBusyId] = useState<string | null>(null);
  const [supplierProfileBusy, setSupplierProfileBusy] = useState(false);
  const [supplierQualificationBusy, setSupplierQualificationBusy] = useState(false);
  const [notificationReadBusyId, setNotificationReadBusyId] = useState<string | null>(null);

  const configurationError = appDataSource.mode === 'misconfigured' ? appDataSource.message : null;

  const refreshJavaBuyerData = async (currentBuyerData: NonNullable<typeof buyerData>) => {
    if (!javaApiClient) return currentBuyerData;
    const javaBuyerMasterData = await loadJavaBuyerMasterData(javaApiClient);
    return {
      ...currentBuyerData,
      workspace: applyJavaBuyerMasterData(currentBuyerData.workspace, javaBuyerMasterData),
      pendingApprovals: javaBuyerMasterData.pendingApprovals,
      recentApprovals: javaBuyerMasterData.recentApprovals,
      buyerNotifications: javaBuyerMasterData.notifications,
      approvalTemplates: javaBuyerMasterData.approvalTemplates,
      roles: javaBuyerMasterData.roles,
      paymentBatches: javaBuyerMasterData.paymentBatches ?? [],
      paymentExecutionRecords: javaBuyerMasterData.paymentExecutionRecords ?? [],
      paymentBlockResolutions: javaBuyerMasterData.paymentBlockResolutions ?? [],
      paymentArchiveExceptionRequests: javaBuyerMasterData.paymentArchiveExceptionRequests ?? [],
      paymentRequests: javaBuyerMasterData.paymentRequests ?? [],
      varianceHandlings: javaBuyerMasterData.varianceHandlings ?? [],
      kpis: {
        ...currentBuyerData.kpis,
        pendingApprovals: javaBuyerMasterData.pendingApprovals.length,
      },
    };
  };

  const refreshJavaSupplierData = async (currentSupplierData: SupplierWorkspace) => {
    if (!javaApiClient) return currentSupplierData;
    const javaSupplierWorkspaceData = await loadJavaSupplierWorkspaceData(javaApiClient);
    return applyJavaSupplierWorkspaceData(currentSupplierData, javaSupplierWorkspaceData);
  };

  const refreshJavaPlatformData = async (currentPlatformData: PlatformWorkspaceData) => {
    if (!javaApiClient) return currentPlatformData;
    const javaPlatformWorkspaceData = await loadJavaPlatformWorkspaceData(javaApiClient);
    return applyJavaPlatformWorkspaceData(currentPlatformData, javaPlatformWorkspaceData);
  };

  useEffect(() => {
    if (configurationError) return;
    let active = true;
    setRefreshBusy(true);
    setLoadError(null);
    Promise.all([
      mockApiClient.getPlatformWorkspace(),
      mockApiClient.getBuyerWorkspace(tenantId),
      mockApiClient.getSupplierWorkspace(supplierId),
      javaApiClient ? loadJavaPlatformWorkspaceData(javaApiClient) : Promise.resolve(null),
      javaApiClient ? loadJavaBuyerMasterData(javaApiClient) : Promise.resolve(null),
      javaApiClient ? loadJavaSupplierWorkspaceData(javaApiClient) : Promise.resolve(null),
    ])
      .then(([nextPlatform, nextBuyer, nextSupplier, javaPlatformWorkspaceData, javaBuyerMasterData, javaSupplierWorkspaceData]) => {
        if (!active) return;
        setPlatformData(javaPlatformWorkspaceData
          ? applyJavaPlatformWorkspaceData(nextPlatform, javaPlatformWorkspaceData)
          : nextPlatform);
        const buyerWorkspace = javaBuyerMasterData
          ? applyJavaBuyerMasterData(nextBuyer.workspace, javaBuyerMasterData)
          : nextBuyer.workspace;
        const pendingApprovals = javaBuyerMasterData?.pendingApprovals ?? [];
        const recentApprovals = javaBuyerMasterData?.recentApprovals ?? [];
        const buyerNotifications = javaBuyerMasterData?.notifications ?? [];
        const approvalTemplates = javaBuyerMasterData?.approvalTemplates ?? [];
        const roles = javaBuyerMasterData?.roles ?? [];
        const paymentBatches = javaBuyerMasterData?.paymentBatches ?? [];
        const paymentExecutionRecords = javaBuyerMasterData?.paymentExecutionRecords ?? [];
        const paymentBlockResolutions = javaBuyerMasterData?.paymentBlockResolutions ?? [];
        const paymentArchiveExceptionRequests = javaBuyerMasterData?.paymentArchiveExceptionRequests ?? [];
        const paymentRequests = javaBuyerMasterData?.paymentRequests ?? [];
        const varianceHandlings = javaBuyerMasterData?.varianceHandlings ?? [];
        setBuyerData({
          ...nextBuyer,
          workspace: buyerWorkspace,
          pendingApprovals,
          recentApprovals,
          buyerNotifications,
          approvalTemplates,
          roles,
          paymentBatches,
          paymentExecutionRecords,
          paymentBlockResolutions,
          paymentArchiveExceptionRequests,
          paymentRequests,
          varianceHandlings,
          kpis: {
            ...nextBuyer.kpis,
            pendingApprovals: javaBuyerMasterData ? pendingApprovals.length : nextBuyer.kpis.pendingApprovals,
          },
        });
        setSupplierData(javaSupplierWorkspaceData
          ? applyJavaSupplierWorkspaceData(nextSupplier, javaSupplierWorkspaceData)
          : nextSupplier);
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : '工作台数据加载失败');
      })
      .finally(() => {
        if (active) setRefreshBusy(false);
      });

    return () => {
      active = false;
    };
  }, [configurationError, tenantId, supplierId, refreshKey]);

  const triggerRefresh = () => {
    if (refreshBusy) return;
    setRefreshBusy(true);
    setRefreshKey((value) => value + 1);
  };

  const runJavaWorkflow = async () => {
    if (!javaApiClient || !buyerData) return;
    setWorkflowBusy(true);
    setWorkflowStatus(null);
    try {
      const result = await runJavaMvpWorkflow(javaApiClient);
      const [nextBuyerData, javaSupplierWorkspaceData] = await Promise.all([
        refreshJavaBuyerData(buyerData),
        loadJavaSupplierWorkspaceData(javaApiClient),
      ]);
      setBuyerData(nextBuyerData);
      if (supplierData) {
        setSupplierData(applyJavaSupplierWorkspaceData(supplierData, javaSupplierWorkspaceData));
      }
      setWorkflowStatus(`已完成订单 ${result.order.id}，付款状态 ${result.paidInvoice.paymentStatus}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : 'Java 主流程执行失败');
    } finally {
      setWorkflowBusy(false);
    }
  };

  const markBuyerNotificationRead = async (notificationId: string) => {
    if (!javaApiClient || !buyerData) return;
    setNotificationReadBusyId(`buyer-notice:${notificationId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.markBuyerNotificationRead(notificationId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`采购方通知已标记已读：${notificationId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购方通知标记已读失败');
    } finally {
      setNotificationReadBusyId(null);
    }
  };

  const markSupplierNotificationRead = async (notificationId: string) => {
    if (!javaApiClient || !supplierData) return;
    setNotificationReadBusyId(`supplier-notice:${notificationId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.markSupplierNotificationRead(notificationId);
      setSupplierData(await refreshJavaSupplierData(supplierData));
      setWorkflowStatus(`供应商通知已标记已读：${notificationId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商通知标记已读失败');
    } finally {
      setNotificationReadBusyId(null);
    }
  };

  const reviewPlatformEnterprise = async (
    reviewId: string,
    result: 'approved' | 'rejected',
    draft: PlatformEnterpriseReviewDraft,
  ) => {
    if (!javaApiClient || !platformData) return;
    setPlatformReviewBusyId(`${reviewId}:${result}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.reviewPlatformEnterprise(reviewId, {
        verified: result === 'approved',
        reviewStatus: result === 'approved' ? 'approved' : 'rejected',
        reviewComment: draft.comment.trim(),
        profileConfirmed: draft.profileConfirmed,
        riskConfirmed: draft.riskConfirmed,
      });
      setPlatformData(await refreshJavaPlatformData(platformData));
      setWorkflowStatus(`平台企业审核已${result === 'approved' ? '通过' : '驳回'}：${reviewId}，审核意见：${draft.comment.trim()}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台企业审核失败');
    } finally {
      setPlatformReviewBusyId(null);
    }
  };

  const updatePlatformTenantStatus = async (tenantId: string, status: '已启用' | '停用') => {
    if (!javaApiClient || !platformData) return;
    const action = status === '已启用' ? 'enable' : 'disable';
    setPlatformTenantBusyId(`${tenantId}:${action}`);
    setWorkflowStatus(null);
    try {
      if (status === '已启用') {
        await javaApiClient.enablePlatformTenant(tenantId);
      } else {
        await javaApiClient.disablePlatformTenant(tenantId);
      }
      setPlatformData(await refreshJavaPlatformData(platformData));
      setWorkflowStatus(`平台租户${status === '已启用' ? '已启用' : '已停用'}：${tenantId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台租户状态更新失败');
    } finally {
      setPlatformTenantBusyId(null);
    }
  };

  const updatePlatformTenantPlan = async (tenantId: string, plan: PlatformWorkspaceData['tenants'][number]['plan']) => {
    if (!javaApiClient || !platformData) return;
    setPlatformTenantBusyId(`${tenantId}:plan`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updatePlatformTenantPlan(tenantId, {
        plan: plan === '专业版' ? 'pro' : plan,
        userLimit: 120,
      });
      setPlatformData(await refreshJavaPlatformData(platformData));
      setWorkflowStatus(`平台租户套餐已更新：${tenantId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台租户套餐更新失败');
    } finally {
      setPlatformTenantBusyId(null);
    }
  };

  const togglePlatformTenantFeature = async (tenantId: string, enabledFeatures: string[], feature: 'rfq') => {
    if (!javaApiClient || !platformData) return;
    const featureLabel = feature === 'rfq' ? '询价比价' : feature;
    const featureCode = feature === 'rfq' ? 'rfq' : feature;
    const featureEnabled = enabledFeatures.includes(featureLabel) || enabledFeatures.includes(featureCode);
    const nextFeatures = featureEnabled
      ? enabledFeatures.filter((enabledFeature) => enabledFeature !== featureLabel && enabledFeature !== featureCode)
      : [...enabledFeatures, featureCode];
    setPlatformTenantBusyId(`${tenantId}:feature:${feature}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updatePlatformTenantFeatures(tenantId, { enabledFeatures: nextFeatures });
      setPlatformData(await refreshJavaPlatformData(platformData));
      setWorkflowStatus(`平台租户功能开关已更新：${tenantId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台租户功能开关更新失败');
    } finally {
      setPlatformTenantBusyId(null);
    }
  };

  const publishPlatformAnnouncement = async (payload: { title: string; content: string; targetScope: string }) => {
    if (!javaApiClient || !platformData) return;
    setAnnouncementPublishBusy(true);
    setWorkflowStatus(null);
    try {
      await javaApiClient.publishPlatformAnnouncement({
        title: payload.title,
        content: payload.content,
        audience: payload.targetScope,
      });
      const [nextPlatformData, announcements] = await Promise.all([
        refreshJavaPlatformData(platformData),
        javaApiClient.listPlatformAnnouncements(),
      ]);
      setPlatformData(nextPlatformData);
      setWorkflowStatus(`平台公告已发布：${payload.title}`);
      return announcements;
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台公告发布失败');
      return null;
    } finally {
      setAnnouncementPublishBusy(false);
    }
  };

  const updatePlatformAnnouncement = async (
    announcementId: string,
    payload: { title: string; content: string; targetScope: string },
  ) => {
    if (!javaApiClient || !platformData) return null;
    setAnnouncementLifecycleBusyId(`update:${announcementId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updatePlatformAnnouncement(announcementId, {
        title: payload.title,
        content: payload.content,
        audience: payload.targetScope,
      });
      const [nextPlatformData, announcements] = await Promise.all([
        refreshJavaPlatformData(platformData),
        javaApiClient.listPlatformAnnouncements(),
      ]);
      setPlatformData(nextPlatformData);
      setWorkflowStatus(`平台公告已保存并刷新：${payload.title}`);
      return announcements;
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台公告保存失败');
      return null;
    } finally {
      setAnnouncementLifecycleBusyId(null);
    }
  };

  const withdrawPlatformAnnouncement = async (announcementId: string) => {
    if (!javaApiClient || !platformData) return null;
    setAnnouncementLifecycleBusyId(`withdraw:${announcementId}`);
    setWorkflowStatus(null);
    try {
      const announcement = await javaApiClient.withdrawPlatformAnnouncement(announcementId);
      const [nextPlatformData, announcements] = await Promise.all([
        refreshJavaPlatformData(platformData),
        javaApiClient.listPlatformAnnouncements(),
      ]);
      setPlatformData(nextPlatformData);
      setWorkflowStatus(`平台公告已撤回：${announcement.title}`);
      return announcements;
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '平台公告撤回失败');
      return null;
    } finally {
      setAnnouncementLifecycleBusyId(null);
    }
  };

  const reviewApprovalTask = async (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft) => {
    if (!javaApiClient || !buyerData) return;
    setApprovalBusyId(approval.id);
    setWorkflowStatus(null);
    try {
      if (approval.bizType === 'purchase_demand') {
        await javaApiClient.reviewBuyerDemandApproval(approval.bizId, approved, draft.comment.trim());
      } else if (approval.bizType === 'buyer_supplier_admission') {
        await javaApiClient.reviewBuyerSupplierAdmission(approval.bizId, approved, draft.comment.trim());
      } else if (approval.bizType === 'rfq_award') {
        if (!approval.parentBizId) {
          throw new Error('定标审批缺少询价项目 ID');
        }
        await javaApiClient.reviewBuyerAwardApproval(approval.parentBizId, approval.bizId, approved, draft.comment.trim());
      } else if (approval.bizType === 'contract_approval') {
        await javaApiClient.reviewBuyerContractApproval(approval.bizId, approved, draft.comment.trim());
      } else if (approval.bizType === 'payment_archive_exception') {
        await javaApiClient.reviewBuyerPaymentArchiveExceptionRequest(approval.bizId, approved, draft.comment.trim());
      } else {
        throw new Error(`暂不支持审批类型：${approval.bizType}`);
      }
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`${approvalResultMessage(approval.bizType, approved, approval.summaryTitle || approval.bizId)}，审批意见：${draft.comment}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '审批操作失败');
    } finally {
      setApprovalBusyId(null);
    }
  };

  const submitSupplierAdmission = async (relationId: string, draft: BuyerSupplierAdmissionDraft) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierAdmissionBusyId(relationId);
    setWorkflowStatus(null);
    try {
      const approval = await javaApiClient.submitBuyerSupplierAdmission(relationId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`供应商准入已提交：${approval.summaryTitle || approval.bizId}，准入说明：${draft.reason}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商准入提交失败');
    } finally {
      setSupplierAdmissionBusyId(null);
    }
  };

  const createBuyerSupplierRelation = async (payload: CreateBuyerSupplierRelationPayload) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierRelationBusyId('new');
    setWorkflowStatus(null);
    try {
      const relation = await javaApiClient.createBuyerSupplierRelation(payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`私域供应商关系已创建：${relation.supplierName}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '私域供应商关系创建失败');
    } finally {
      setSupplierRelationBusyId(null);
    }
  };

  const saveBuyerSupplierRelationProfile = async (
    relationId: string,
    payload: UpdateBuyerSupplierProfilePayload,
  ) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierRelationBusyId(`profile:${relationId}`);
    setWorkflowStatus(null);
    try {
      const relation = await javaApiClient.updateBuyerSupplierProfile(relationId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`供应商等级和品类已保存：${relation.supplierName}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商等级和品类保存失败');
    } finally {
      setSupplierRelationBusyId(null);
    }
  };

  const saveBuyerSupplierRelationStatus = async (relationId: string, status: string) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierRelationBusyId(`status:${relationId}`);
    setWorkflowStatus(null);
    try {
      const relation = await javaApiClient.updateBuyerSupplierStatus(relationId, status);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`供应商合作状态已保存：${relation.supplierName} · ${relation.status}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商合作状态保存失败');
    } finally {
      setSupplierRelationBusyId(null);
    }
  };

  const saveBuyerSupplierRelationPerformance = async (relationId: string, performanceScore: number) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierRelationBusyId(`performance:${relationId}`);
    setWorkflowStatus(null);
    try {
      const relation = await javaApiClient.updateBuyerSupplierPerformance(relationId, performanceScore);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`供应商绩效评分已保存：${relation.supplierName} · ${relation.performanceScore} 分`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商绩效评分保存失败');
    } finally {
      setSupplierRelationBusyId(null);
    }
  };

  const updateApprovalTemplate = async (
    templateCode: string,
    defaultApproverRoleId: string,
    status: 'active' | 'inactive',
  ) => {
    if (!javaApiClient || !buyerData) return;
    setWorkflowStatus(null);
    try {
      const updatedTemplate = await javaApiClient.updateBuyerApprovalTemplate(templateCode, {
        defaultApproverRoleId,
        status,
      });
      setBuyerData({
        ...buyerData,
        approvalTemplates: buyerData.approvalTemplates.map((template) =>
          template.templateCode === updatedTemplate.templateCode ? updatedTemplate : template,
        ),
      });
      setWorkflowStatus(`审批模板配置已保存：${updatedTemplate.name}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '审批模板配置保存失败');
    }
  };

  const createBuyerDemand = async (payload: CreateDemandPayload, submitForApproval: boolean) => {
    if (!javaApiClient || !buyerData) return;
    setDemandCreateBusy(true);
    setWorkflowStatus(null);
    try {
      const demand = await javaApiClient.createBuyerDemand(payload);
      if (submitForApproval) {
        await javaApiClient.submitBuyerDemand(demand.id);
      }
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(submitForApproval
        ? `采购需求已创建并提交审批：${demand.title}`
        : `采购需求已创建：${demand.title}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购需求创建失败');
    } finally {
      setDemandCreateBusy(false);
    }
  };

  const submitBuyerDemandApproval = async (demandId: string) => {
    if (!javaApiClient || !buyerData) return;
    setDemandSubmitBusyId(demandId);
    setWorkflowStatus(null);
    try {
      const approval = await javaApiClient.submitBuyerDemand(demandId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`采购需求已提交审批：${approval.summaryTitle || approval.bizId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购需求提交审批失败');
    } finally {
      setDemandSubmitBusyId(null);
    }
  };

  const updateBuyerDemandDetail = async (demandId: string, payload: UpdateDemandPayload) => {
    if (!javaApiClient || !buyerData) return;
    setDemandUpdateBusyId(demandId);
    setWorkflowStatus(null);
    try {
      const demand = await javaApiClient.updateBuyerDemand(demandId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`采购需求已保存并刷新后回显：${demand.title}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购需求保存失败');
    } finally {
      setDemandUpdateBusyId(null);
    }
  };

  const saveBuyerMaterial = async (materialId: string | null, payload: SaveMaterialPayload) => {
    if (!javaApiClient || !buyerData) return;
    setMaterialSaveBusyId(materialId ?? 'new');
    setWorkflowStatus(null);
    try {
      const material = materialId
        ? await javaApiClient.updateBuyerMaterial(materialId, payload)
        : await javaApiClient.createBuyerMaterial(payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(materialId
        ? `物料目录已保存并刷新，可用于采购需求：${material.name}`
        : `物料目录已新增并刷新，可用于采购需求：${material.name}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '物料目录保存失败');
    } finally {
      setMaterialSaveBusyId(null);
    }
  };

  const refreshAfterSupplierAction = async () => {
    if (!supplierData) return;
    const [nextSupplierData, nextBuyerData] = await Promise.all([
      refreshJavaSupplierData(supplierData),
      buyerData ? refreshJavaBuyerData(buyerData) : Promise.resolve(null),
    ]);
    setSupplierData(nextSupplierData);
    if (nextBuyerData) {
      setBuyerData(nextBuyerData);
    }
  };

  const createBuyerRfqFromDemand = async (demandId: string, supplierIds?: string[], deadline?: string) => {
    if (!javaApiClient || !buyerData) return;
    const demand = buyerData.workspace.demands.find((item) => item.id === demandId);
    const relation = buyerData.workspace.privateSupplierRelations.find(isRfqEligibleSupplierRelation);
    const eligibleSupplierIds = new Set(
      buyerData.workspace.privateSupplierRelations
        .filter(isRfqEligibleSupplierRelation)
        .map((item) => item.supplierId),
    );
    const invitedSupplierIds = supplierIds && supplierIds.length > 0
      ? supplierIds.filter((supplierId) => eligibleSupplierIds.has(supplierId))
      : relation ? [relation.supplierId] : [];
    if (!demand || invitedSupplierIds.length === 0) {
      setWorkflowStatus('创建询价需要已通过需求和具备有效资质的已准入供应商');
      return;
    }

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + 14);
    setRfqCreateBusy(demandId);
    setWorkflowStatus(null);
    try {
      const rfq = await javaApiClient.createBuyerRfq({
        title: `${demand.title} 询价`,
        demandIds: [demand.id],
        invitedSupplierIds,
        deadline: deadline ?? deadlineDate.toISOString(),
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`询价已创建并已通知受邀供应商：${rfq.title}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '询价创建失败');
    } finally {
      setRfqCreateBusy(null);
    }
  };

  const updateBuyerRfqDetail = async (rfqId: string, payload: UpdateRfqPayload) => {
    if (!javaApiClient || !buyerData) return;
    setRfqUpdateBusyId(rfqId);
    setWorkflowStatus(null);
    try {
      const rfq = await javaApiClient.updateBuyerRfq(rfqId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`询价项目已保存、已通知供应商并刷新后回显：${rfq.title}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '询价项目保存失败');
    } finally {
      setRfqUpdateBusyId(null);
    }
  };

  const createBuyerOrderFromAward = async (awardId: string, draft: BuyerOrderDraft) => {
    if (!javaApiClient || !buyerData) return;
    setOrderCreateBusy(awardId);
    setWorkflowStatus(null);
    try {
      const order = await javaApiClient.createBuyerOrder({
        awardId,
        expectedReceiptDate: draft.expectedReceiptDate,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`订单已生成并已通知供应商确认订单：${order.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购订单生成失败');
    } finally {
      setOrderCreateBusy(null);
    }
  };

  const updateBuyerOrderDetail = async (orderId: string, payload: UpdateOrderPayload) => {
    if (!javaApiClient || !buyerData) return;
    setOrderUpdateBusyId(orderId);
    setWorkflowStatus(null);
    try {
      const order = await javaApiClient.updateBuyerOrder(orderId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`采购订单已保存、已通知供应商交期变更并刷新后回显：${order.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购订单保存失败');
    } finally {
      setOrderUpdateBusyId(null);
    }
  };

  const submitBuyerAwardApproval = async (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => {
    if (!javaApiClient || !buyerData) return;
    setAwardSubmitBusyId(rfqId);
    setWorkflowStatus(null);
    try {
      const award = await javaApiClient.awardBuyerRfq(rfqId, {
        quoteId,
        reason: draft.reason,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`定标审批已提交：${award.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '定标审批提交失败');
    } finally {
      setAwardSubmitBusyId(null);
    }
  };

  const createBuyerReceiptFromOrder = async (orderId: string, draft: BuyerReceiptDraft) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`receipt:${orderId}`);
    setWorkflowStatus(null);
    try {
      const receipt = await javaApiClient.createBuyerReceipt(orderId, { result: draft.result });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`收货验收已登记并已通知供应商提交发票：${receipt.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '收货验收登记失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const registerBuyerInvoicePayment = async (invoiceId: string, draft: BuyerPaymentDraft) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment:${invoiceId}`);
    setWorkflowStatus(null);
    try {
      const invoice = await javaApiClient.registerBuyerPayment(invoiceId, { paymentStatus: draft.paymentStatus });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款状态已登记，${invoice.paymentStatus}，已同步供应商应收：${invoice.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '付款登记失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updateBuyerContractStatus = async (
    contractId: string,
    status: string,
    fulfillmentProgress: string,
  ) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`contract-status:${contractId}`);
    setWorkflowStatus(null);
    try {
      const contract = await javaApiClient.updateBuyerContractStatus(contractId, {
        status,
        fulfillmentProgress,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`合同状态已更新：${contract.contractNo} / ${contract.status}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同状态更新失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const archiveBuyerContract = async (contractId: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`contract-archive:${contractId}`);
    setWorkflowStatus(null);
    try {
      const contract = await javaApiClient.updateBuyerContractArchiveStatus(contractId, {
        archiveStatus: '已归档',
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`合同已归档：${contract.contractNo}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同归档失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerContractLedger = async (payload: CreateContractPayload) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId('contract-save:create');
    setWorkflowStatus(null);
    try {
      const contract = await javaApiClient.createBuyerContract(payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`合同已创建：${contract.contractNo}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同创建失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updateBuyerContractLedger = async (contractId: string, payload: UpdateContractPayload) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId('contract-save:update');
    setWorkflowStatus(null);
    try {
      const contract = await javaApiClient.updateBuyerContract(contractId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`合同已保存：${contract.contractNo}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同保存失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const saveBuyerContractLedger = (
    mode: 'create' | 'update',
    contractId: string | null,
    draft: BuyerContractDraft,
  ) => {
    if (mode === 'create') {
      createBuyerContractLedger({
        contractNo: draft.contractNo,
        contractName: draft.contractName,
        relatedOrderId: draft.relatedOrderId,
        amount: draft.amount,
        status: draft.status,
        fulfillmentProgress: draft.fulfillmentProgress,
        effectiveDate: draft.effectiveDate,
      });
      return;
    }

    if (!contractId) return;
    updateBuyerContractLedger(contractId, {
      contractNo: draft.contractNo,
      contractName: draft.contractName,
      amount: draft.amount,
      status: draft.status,
      fulfillmentProgress: draft.fulfillmentProgress,
      effectiveDate: draft.effectiveDate,
    });
  };

  const loadBuyerContractAttachments = async (contractId: string) => {
    if (!javaApiClient) return;
    setBuyerFulfillmentBusyId(`contract-attachment:${contractId}:load`);
    setWorkflowStatus(null);
    try {
      const attachments = await javaApiClient.listBuyerAttachments('contract', contractId);
      setContractAttachmentsById((current) => ({
        ...current,
        [contractId]: attachments,
      }));
      setWorkflowStatus(`合同附件已加载：${attachments.length} 个`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同附件加载失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerContractAttachment = async (
    contractId: string,
    payload: Omit<CreateAttachmentPayload, 'ownerType' | 'ownerId'>,
  ) => {
    if (!javaApiClient) return;
    setBuyerFulfillmentBusyId(`contract-attachment:${contractId}:create`);
    setWorkflowStatus(null);
    try {
      const attachment = await javaApiClient.createBuyerAttachment({
        ownerType: 'contract',
        ownerId: contractId,
        ...payload,
      });
      const attachments = await javaApiClient.listBuyerAttachments('contract', contractId);
      setContractAttachmentsById((current) => ({
        ...current,
        [contractId]: attachments,
      }));
      setWorkflowStatus(`登记合同附件：${attachment.fileName}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '登记合同附件失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerContractAttachmentUploadTicket = async (
    contractId: string,
    payload: Omit<CreateAttachmentUploadTicketPayload, 'ownerType' | 'ownerId'>,
  ) => {
    if (!javaApiClient) return;
    setBuyerFulfillmentBusyId(`contract-attachment:${contractId}:upload-ticket`);
    setWorkflowStatus(null);
    try {
      const ticket = await javaApiClient.createBuyerAttachmentUploadTicket({
        ownerType: 'contract',
        ownerId: contractId,
        ...payload,
      });
      setContractAttachmentUploadTicketsById((current) => ({
        ...current,
        [contractId]: ticket,
      }));
      setWorkflowStatus(`合同附件上传凭证已生成：${ticket.fileName}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同附件上传凭证生成失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerContractAttachmentDownloadLink = async (attachmentId: string) => {
    if (!javaApiClient) return;
    setBuyerFulfillmentBusyId(`contract-attachment-download:${attachmentId}`);
    setWorkflowStatus(null);
    try {
      const link = await javaApiClient.createBuyerAttachmentDownloadLink(attachmentId);
      setContractAttachmentDownloadLinksById((current) => ({
        ...current,
        [attachmentId]: link,
      }));
      setWorkflowStatus(`合同附件下载签名已生成：${link.fileName}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同附件下载签名生成失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const loadBuyerContractFulfillmentEvents = async (contractId: string) => {
    if (!javaApiClient) return;
    try {
      const events = await javaApiClient.listBuyerContractFulfillmentEvents(contractId);
      setContractFulfillmentEventsById((current) => ({
        ...current,
        [contractId]: events,
      }));
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同履约事件加载失败'));
    }
  };

  const loadBuyerContractTargetAuditLogs = async (contractId: string) => {
    if (!javaApiClient) return;
    try {
      const auditLogs = await javaApiClient.listBuyerTargetAuditLogs(
        'contract',
        contractId,
        [
          'contract_approval.submitted',
          'contract_approval.approved',
          'contract_approval.rejected',
          'contract_fulfillment_event.created',
        ],
      );
      setContractTargetAuditLogsById((current) => ({
        ...current,
        [contractId]: auditLogs,
      }));
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同目标审计日志加载失败'));
    }
  };

  const createBuyerContractFulfillmentEvent = async (
    contractId: string,
    payload: CreateContractFulfillmentEventPayload,
  ) => {
    if (!javaApiClient) return;
    try {
      const event = await javaApiClient.createBuyerContractFulfillmentEvent(contractId, payload);
      setContractFulfillmentEventsById((current) => ({
        ...current,
        [contractId]: [event, ...(current[contractId] ?? []).filter((item) => item.id !== event.id)],
      }));
      setWorkflowStatus(`合同履约事件已持久化：${event.summary}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同履约事件写入失败'));
    }
  };

  const submitBuyerContractApproval = async (contractId: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`contract-approval:${contractId}`);
    setWorkflowStatus(null);
    try {
      const contract = await javaApiClient.submitBuyerContractApproval(contractId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`合同审批已提交：${contract.contractNo}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '合同审批提交失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const registerBuyerPaymentExecutionRecord = async (executionRecordId: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-execution:${executionRecordId}`);
    setWorkflowStatus(null);
    try {
      const record = await javaApiClient.registerBuyerPaymentExecutionRecord(executionRecordId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款执行记录已登记：${record.invoiceId}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '付款执行记录登记失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerPaymentRequestRecord = async (invoiceId: string, draft: BuyerPaymentDraft) => {
    if (!javaApiClient || !buyerData) return;
    const batchDate = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    setBuyerFulfillmentBusyId(`payment-request:${invoiceId}`);
    setWorkflowStatus(null);
    try {
      const paymentRequest = await javaApiClient.createBuyerPaymentRequest({
        invoiceId,
        requestStatus: draft.paymentRequestStatus,
        paymentBatchNo: `PAY-${batchDate}-${invoiceId.slice(-6)}`,
        remark: draft.paymentRemark,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款申请已创建/更新：${paymentRequest.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '付款申请创建失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerVarianceHandlingRecord = async (invoiceId: string, draft: BuyerPaymentDraft) => {
    if (!javaApiClient || !buyerData) return;
    const ownerId = buyerData.workspace.users[0]?.id ?? 'user-buyer-owner';
    setBuyerFulfillmentBusyId(`variance:${invoiceId}`);
    setWorkflowStatus(null);
    try {
      const varianceHandling = await javaApiClient.createBuyerVarianceHandling({
        invoiceId,
        reason: draft.reconciliationNote || '三单匹配差异待核对',
        ownerId,
        result: draft.reconciliationNote || '待财务复核',
        status: '待处理',
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`差异处理已创建/更新：${varianceHandling.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '差异处理创建失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updateBuyerPaymentRequestStatus = async (paymentRequestId: string, status: string) => {
    if (!javaApiClient || !buyerData) return;
    const paymentRequest = buyerData.paymentRequests.find((item) => item.id === paymentRequestId);
    setBuyerFulfillmentBusyId(paymentRequest ? `payment-request:${paymentRequest.invoiceId}` : `payment-request-status:${paymentRequestId}`);
    setWorkflowStatus(null);
    try {
      const updated = await javaApiClient.updateBuyerPaymentRequestStatus(paymentRequestId, {
        requestStatus: status,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款申请状态已更新：${updated.id} / ${updated.requestStatus}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '付款申请状态更新失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updatePaymentBatchStatus = async (paymentBatchNo: string, status: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-batch:${paymentBatchNo}`);
    setWorkflowStatus(null);
    try {
      const updated = await javaApiClient.updateBuyerPaymentBatchStatus(paymentBatchNo, {
        batchStatus: status,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款批次状态已更新：${updated.paymentBatchNo} / ${updated.batchStatus}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '付款批次状态更新失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const createBuyerPaymentArchiveExceptionRequest = async (paymentBatchNo: string, exceptionType: string, exceptionReason: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-archive-exception:${paymentBatchNo}:${exceptionType}`);
    setWorkflowStatus(null);
    try {
      const request = await javaApiClient.createBuyerPaymentArchiveExceptionRequest({
        paymentBatchNo,
        exceptionType,
        exceptionReason,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`归档异常申请已提交：${request.paymentBatchNo} / ${request.exceptionType} / ${request.approvalStatus}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '归档异常申请提交失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const completeBuyerPaymentArchiveExceptionAction = async (requestId: string, actionResult: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-archive-exception-action:${requestId}`);
    setWorkflowStatus(null);
    try {
      const request = await javaApiClient.completeBuyerPaymentArchiveExceptionAction(requestId, {
        actionResult,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`归档异常受控处理已登记：${request.paymentBatchNo} / ${request.exceptionType} / ${request.actionStatus}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '归档异常受控处理登记失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const closeBuyerPaymentArchiveExceptionRequest = async (requestId: string, closureResult: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-archive-exception-closure:${requestId}`);
    setWorkflowStatus(null);
    try {
      const request = await javaApiClient.closeBuyerPaymentArchiveExceptionRequest(requestId, {
        closureResult,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`归档异常关闭复核已完成：${request.paymentBatchNo} / ${request.exceptionType} / ${request.closureStatus}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '归档异常关闭复核失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updateBuyerVarianceHandlingStatus = async (varianceHandlingId: string, status: string) => {
    if (!javaApiClient || !buyerData) return;
    const varianceHandling = buyerData.varianceHandlings.find((item) => item.id === varianceHandlingId);
    setBuyerFulfillmentBusyId(varianceHandling ? `variance:${varianceHandling.invoiceId}` : `variance-status:${varianceHandlingId}`);
    setWorkflowStatus(null);
    try {
      const updated = await javaApiClient.updateBuyerVarianceHandlingStatus(varianceHandlingId, {
        status,
        result: status === '已处理' ? '差异已核对并关闭，允许进入付款申请。' : varianceHandling?.result,
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`差异处理状态已更新：${updated.id} / ${updated.status}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '差异处理状态更新失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const saveBuyerPaymentBlockResolutionStatus = async (payload: BuyerPaymentBlockResolutionDraft) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment-block-resolution:${payload.paymentRequestId}:${payload.blockReason}`);
    setWorkflowStatus(null);
    try {
      const handledBy = buyerData.workspace.users[0]?.id ?? 'user-buyer-owner';
      const saved = payload.existingResolutionId
        ? await javaApiClient.updateBuyerPaymentBlockResolutionStatus(payload.existingResolutionId, {
          resolutionStatus: payload.resolutionStatus,
          resolutionAction: payload.resolutionAction,
          nextStep: payload.nextStep,
          handledBy,
        })
        : await javaApiClient.createBuyerPaymentBlockResolution({
          paymentBatchNo: payload.paymentBatchNo,
          paymentRequestId: payload.paymentRequestId,
          invoiceId: payload.invoiceId,
          supplierId: payload.supplierId ?? undefined,
          blockReason: payload.blockReason,
          resolutionStatus: payload.resolutionStatus,
          resolutionAction: payload.resolutionAction,
          nextStep: payload.nextStep,
          handledBy,
        });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`付款阻断处理状态已保存：${saved.id} / ${saved.resolutionStatus}`);
    } catch (error) {
      setWorkflowStatus(formatWorkflowError(error, '付款阻断处理状态保存失败'));
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const rebuildBuyerThreeWayMatchSnapshots = async () => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId('three-way-rebuild');
    setWorkflowStatus(null);
    try {
      const result = await javaApiClient.rebuildBuyerThreeWayMatches();
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`三单匹配快照已刷新：${result.rebuiltCount} 条`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '三单匹配刷新失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const updateBuyerInvoiceDetail = async (invoiceId: string, payload: UpdateInvoicePayload) => {
    if (!javaApiClient || !buyerData) return;
    setInvoiceUpdateBusyId(invoiceId);
    setWorkflowStatus(null);
    try {
      const invoice = await javaApiClient.updateBuyerInvoice(invoiceId, payload);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`发票付款已保存、已同步供应商应收并刷新后回显：${invoice.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '发票付款保存失败');
    } finally {
      setInvoiceUpdateBusyId(null);
    }
  };

  const submitSupplierQuote = async (rfqId: string, draft: SupplierQuoteDraft) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`quote:${rfqId}`);
    setWorkflowStatus(null);
    try {
      const quote = await javaApiClient.submitSupplierQuote(rfqId, {
        amount: draft.amount,
        taxRate: draft.taxRate,
        deliveryDays: draft.deliveryDays,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`报价已提交并同步采购方报价对比：${quote.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '报价提交失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const updateSupplierQuote = async (quoteId: string, draft: SupplierQuoteDraft) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`quote-update:${quoteId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updateSupplierQuote(quoteId, {
        amount: draft.amount,
        taxRate: draft.taxRate,
        deliveryDays: draft.deliveryDays,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`报价记录已保存并已通知采购方重新比价：${quoteId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '报价记录保存失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const confirmSupplierOrder = async (orderId: string) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`confirm:${orderId}`);
    setWorkflowStatus(null);
    try {
      const order = await javaApiClient.confirmSupplierOrder(orderId);
      await refreshAfterSupplierAction();
      setWorkflowStatus(`供应商订单已确认，${order.status}，已同步采购方订单状态：${order.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商订单确认失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const createSupplierDelivery = async (orderId: string, draft: SupplierDeliveryDraft) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`delivery:${orderId}`);
    setWorkflowStatus(null);
    try {
      const delivery = await javaApiClient.createSupplierDelivery(orderId, {
        carrier: draft.carrier,
        trackingNo: draft.trackingNo,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`发货信息已提交，${delivery.status}，已同步采购方收货验收：${orderId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '发货信息提交失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const updateSupplierDelivery = async (deliveryId: string, draft: SupplierDeliveryDraft) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`delivery-update:${deliveryId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updateSupplierDelivery(deliveryId, {
        carrier: draft.carrier,
        trackingNo: draft.trackingNo,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`物流信息已保存并刷新：${deliveryId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '物流信息保存失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const createSupplierInvoice = async (orderId: string, draft: SupplierInvoiceDraft) => {
    if (!javaApiClient || !supplierData) return;
    const order = supplierData.workspace.orders.find((item) => item.id === orderId);
    const existingInvoice = supplierData.workspace.invoices.find((item) => item.orderId === orderId);
    if (!order || order.status !== '已收货') {
      setWorkflowStatus('订单未完成收货验收，不能提交发票');
      return;
    }
    if (existingInvoice) {
      setWorkflowStatus('该订单已提交发票，不能重复开票');
      return;
    }
    setSupplierActionBusyId(`invoice:${orderId}`);
    setWorkflowStatus(null);
    try {
      const invoice = await javaApiClient.createSupplierInvoice(orderId, {
        amount: draft.amount,
        invoiceNo: draft.invoiceNo,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`发票信息已提交，${invoice.paymentStatus}，已同步采购方待付款台账：${invoice.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '发票信息提交失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const updateSupplierReceivable = async (invoiceId: string, draft: SupplierReceivableDraft) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`receivable-update:${invoiceId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.updateSupplierReceivable(invoiceId, {
        reconciliationNote: draft.reconciliationNote,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`应收对账备注已保存、已同步采购方对账并刷新：${invoiceId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '应收对账备注保存失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const updateSupplierProfile = async (payload: SupplierProfileDraft) => {
    if (!supplierData) return;
    setSupplierProfileBusy(true);
    setWorkflowStatus(null);
    try {
      if (javaApiClient) {
        await javaApiClient.updateSupplierProfile(payload);
        setSupplierData(await refreshJavaSupplierData(supplierData));
      } else {
        setSupplierData({
          ...supplierData,
          supplier: {
            ...supplierData.supplier,
            ...payload,
            profileStatus: '资料草稿已保存',
          },
        });
      }
      setWorkflowStatus(`供应商企业档案已保存并刷新：${payload.name}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商企业档案保存失败');
    } finally {
      setSupplierProfileBusy(false);
    }
  };

  const createSupplierQualification = async (payload: SupplierQualificationDraft) => {
    if (!supplierData) return;
    setSupplierQualificationBusy(true);
    setWorkflowStatus(null);
    try {
      if (javaApiClient) {
        const qualification = await javaApiClient.createSupplierQualification(payload);
        setSupplierData(await refreshJavaSupplierData(supplierData));
        setWorkflowStatus(`供应商资质已提交并刷新：${qualification.qualificationType}`);
      } else {
        setSupplierData({
          ...supplierData,
          qualifications: [
            ...(supplierData.qualifications ?? []),
            {
              id: `mock-qualification-${Date.now()}`,
              supplierId: supplierData.supplier.id,
              ...payload,
              status: 'active',
              createdAt: new Date().toISOString(),
            },
          ],
        });
        setWorkflowStatus(`供应商资质草稿已保存：${payload.qualificationType}`);
      }
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商资质提交失败');
    } finally {
      setSupplierQualificationBusy(false);
    }
  };

  if (configurationError || loadError) {
    return (
      <ShellState
        variant="error"
        title="加载失败"
        desc={configurationError ?? loadError ?? '工作台数据加载失败'}
        actionLabel="重新加载"
        onAction={() => setRefreshKey((value) => value + 1)}
        fullScreen
      />
    );
  }

  if (!platformData || !buyerData || !supplierData) {
    return (
      <ShellState
        variant="loading"
        title="正在加载采购工作台"
        desc="正在同步平台、采购方和供应商工作台数据。"
        fullScreen
      />
    );
  }

  const activeModule = activeModules[activeRole];
  const setActiveRoleModule = (role: AdminRole, moduleId: string) => {
    setActiveRole(role);
    setActiveModules((current) => ({
      ...current,
      [role]: moduleId,
    }));
  };
  const focusBuyerKeyAction = (actionLabel: string) => {
    setWorkflowStatus(`已定位关键操作：${actionLabel}。请在当前页下方业务卡片的快捷动作区执行真实操作；若按钮仍禁用，按边界提示先补齐前置状态。`);
    window.requestAnimationFrame(() => {
      document.querySelector('[data-buyer-action-anchor="primary-business-action"]')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden overflow-x-hidden bg-slate-100/70 text-slate-900 lg:flex-row">
      <MobileAdminNav
        activeRole={activeRole}
        activeModules={activeModules}
        onSelectRole={setActiveRole}
        onSelectModule={setActiveRoleModule}
      />
      <AppSidebar
        activeRole={activeRole}
        activeModules={activeModules}
        onSelectRole={setActiveRole}
        onSelectModule={setActiveRoleModule}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AppHeader
          activeRole={activeRole}
          activeModule={activeModule}
          model={platformData.model}
          tenantId={tenantId}
          supplierId={supplierId}
          setTenantId={setTenantId}
          setSupplierId={setSupplierId}
          javaEnabled={Boolean(javaApiClient)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          refreshBusy={refreshBusy}
          workflowBusy={workflowBusy}
          onRefresh={triggerRefresh}
          onRunJavaWorkflow={runJavaWorkflow}
        />
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/70 [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-7xl space-y-5 p-3 pb-8 sm:space-y-6 sm:p-6 lg:p-8">
            {activeRole === 'platform' && (
              <PlatformWorkspace
                data={platformData}
                activeModule={activeModule as PlatformAdminModule}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                platformReviewBusyId={platformReviewBusyId}
                platformTenantBusyId={platformTenantBusyId}
                announcementPublishBusy={announcementPublishBusy}
                announcementLifecycleBusyId={announcementLifecycleBusyId}
                onReviewEnterprise={reviewPlatformEnterprise}
                onUpdateTenantStatus={updatePlatformTenantStatus}
                onUpdateTenantPlan={updatePlatformTenantPlan}
                onToggleTenantFeature={togglePlatformTenantFeature}
                onPublishAnnouncement={publishPlatformAnnouncement}
                onUpdateAnnouncement={updatePlatformAnnouncement}
                onWithdrawAnnouncement={withdrawPlatformAnnouncement}
                onNavigatePlatformModule={(moduleId) => setActiveRoleModule('platform', moduleId)}
              />
            )}
            {activeRole === 'buyer' && (
              <BuyerWorkspaceView
                activeModule={activeModule as BuyerAdminModule}
                workspace={buyerData.workspace}
                kpis={buyerData.kpis}
                pendingApprovals={buyerData.pendingApprovals}
                recentApprovals={buyerData.recentApprovals}
                buyerNotifications={buyerData.buyerNotifications}
                approvalTemplates={buyerData.approvalTemplates}
                roles={buyerData.roles}
                paymentBatches={buyerData.paymentBatches}
                paymentExecutionRecords={buyerData.paymentExecutionRecords}
                paymentBlockResolutions={buyerData.paymentBlockResolutions}
                paymentArchiveExceptionRequests={buyerData.paymentArchiveExceptionRequests}
                paymentRequests={buyerData.paymentRequests}
                varianceHandlings={buyerData.varianceHandlings}
                auditLogs={buyerData.workspace.auditLogs}
                searchQuery={searchQuery}
                approvalBusyId={approvalBusyId}
                demandCreateBusy={demandCreateBusy}
                materialSaveBusyId={materialSaveBusyId}
                demandSubmitBusyId={demandSubmitBusyId}
                demandUpdateBusyId={demandUpdateBusyId}
                supplierAdmissionBusyId={supplierAdmissionBusyId}
                supplierRelationBusyId={supplierRelationBusyId}
                rfqCreateBusy={rfqCreateBusy}
                rfqUpdateBusyId={rfqUpdateBusyId}
                awardSubmitBusyId={awardSubmitBusyId}
                orderCreateBusy={orderCreateBusy}
                orderUpdateBusyId={orderUpdateBusyId}
                invoiceUpdateBusyId={invoiceUpdateBusyId}
                buyerFulfillmentBusyId={buyerFulfillmentBusyId}
                notificationReadBusyId={notificationReadBusyId}
                contractAttachmentsById={contractAttachmentsById}
                contractAttachmentUploadTicketsById={contractAttachmentUploadTicketsById}
                contractAttachmentDownloadLinksById={contractAttachmentDownloadLinksById}
                contractFulfillmentEventsById={contractFulfillmentEventsById}
                contractTargetAuditLogsById={contractTargetAuditLogsById}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                onFocusBuyerKeyAction={focusBuyerKeyAction}
                onNavigateBuyerModule={(moduleId) => setActiveRoleModule('buyer', moduleId)}
                onCreateDemand={createBuyerDemand}
                onSaveMaterial={saveBuyerMaterial}
                onSubmitDemand={submitBuyerDemandApproval}
                onUpdateDemand={updateBuyerDemandDetail}
                onReviewApproval={reviewApprovalTask}
                onSubmitSupplierAdmission={submitSupplierAdmission}
                onCreateSupplierRelation={createBuyerSupplierRelation}
                onSaveSupplierRelationProfile={saveBuyerSupplierRelationProfile}
                onSaveSupplierRelationStatus={saveBuyerSupplierRelationStatus}
                onSaveSupplierRelationPerformance={saveBuyerSupplierRelationPerformance}
                onCreateRfqFromDemand={createBuyerRfqFromDemand}
                onUpdateRfq={updateBuyerRfqDetail}
                onSubmitAwardApproval={submitBuyerAwardApproval}
                onCreateOrderFromAward={createBuyerOrderFromAward}
                onUpdateOrder={updateBuyerOrderDetail}
                onCreateReceipt={createBuyerReceiptFromOrder}
                onRegisterPayment={registerBuyerInvoicePayment}
                onRegisterPaymentExecutionRecord={registerBuyerPaymentExecutionRecord}
                onCreatePaymentRequest={createBuyerPaymentRequestRecord}
                onCreateVarianceHandling={createBuyerVarianceHandlingRecord}
                onUpdatePaymentRequestStatus={updateBuyerPaymentRequestStatus}
                onUpdatePaymentBatchStatus={updatePaymentBatchStatus}
                onCreatePaymentArchiveExceptionRequest={createBuyerPaymentArchiveExceptionRequest}
                onCompletePaymentArchiveExceptionAction={completeBuyerPaymentArchiveExceptionAction}
                onClosePaymentArchiveExceptionRequest={closeBuyerPaymentArchiveExceptionRequest}
                onSavePaymentBlockResolutionStatus={saveBuyerPaymentBlockResolutionStatus}
                onUpdateVarianceHandlingStatus={updateBuyerVarianceHandlingStatus}
                onRebuildThreeWayMatches={rebuildBuyerThreeWayMatchSnapshots}
                onUpdateInvoice={updateBuyerInvoiceDetail}
                onSaveContract={saveBuyerContractLedger}
                onSubmitContractApproval={submitBuyerContractApproval}
                onLoadContractAttachments={loadBuyerContractAttachments}
                onCreateContractAttachment={createBuyerContractAttachment}
                onCreateContractAttachmentUploadTicket={createBuyerContractAttachmentUploadTicket}
                onCreateContractAttachmentDownloadLink={createBuyerContractAttachmentDownloadLink}
                onLoadContractFulfillmentEvents={loadBuyerContractFulfillmentEvents}
                onLoadContractTargetAuditLogs={loadBuyerContractTargetAuditLogs}
                onCreateContractFulfillmentEvent={createBuyerContractFulfillmentEvent}
                onUpdateContractStatus={updateBuyerContractStatus}
                onArchiveContract={archiveBuyerContract}
                onUpdateApprovalTemplate={updateApprovalTemplate}
                onMarkBuyerNotificationRead={markBuyerNotificationRead}
              />
            )}
            {activeRole === 'supplier' && (
              <SupplierWorkspaceView
                activeModule={activeModule as SupplierAdminModule}
                workspace={supplierData}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                supplierActionBusyId={supplierActionBusyId}
                supplierProfileBusy={supplierProfileBusy}
                supplierQualificationBusy={supplierQualificationBusy}
                notificationReadBusyId={notificationReadBusyId}
                onSubmitQuote={submitSupplierQuote}
                onUpdateQuote={updateSupplierQuote}
                onConfirmOrder={confirmSupplierOrder}
                onCreateDelivery={createSupplierDelivery}
                onUpdateDelivery={updateSupplierDelivery}
                onCreateInvoice={createSupplierInvoice}
                onUpdateReceivable={updateSupplierReceivable}
                onUpdateSupplierProfile={updateSupplierProfile}
                onCreateSupplierQualification={createSupplierQualification}
                onMarkSupplierNotificationRead={markSupplierNotificationRead}
                onNavigateSupplierModule={(moduleId) => setActiveRoleModule('supplier', moduleId)}
              />
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

const AppSidebar: React.FC<{
  activeRole: AdminRole;
  activeModules: Record<AdminRole, string>;
  onSelectRole: (role: AdminRole) => void;
  onSelectModule: (role: AdminRole, moduleId: string) => void;
}> = ({ activeRole, activeModules, onSelectRole, onSelectModule }) => {
  return (
    <aside className="hidden min-h-0 shrink-0 flex-col bg-slate-950 text-white lg:flex lg:w-72">
      <div className="border-b border-white/10 p-3 lg:p-6">
        <div className="flex items-center justify-center gap-3 lg:justify-start">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/40 lg:h-11 lg:w-11">
            24
          </div>
          <div className="hidden lg:block">
            <p className="text-lg font-black leading-none">24Bid</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-blue-300">Procurement SaaS</p>
          </div>
        </div>
        <div className="mt-5 hidden rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 lg:block">
          <p className="text-xs font-bold text-blue-200">MVP 主线</p>
          <p className="mt-1 text-sm font-semibold text-white">需求申请 - 询价比价 - 订单履约 - 发票付款</p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-2 lg:space-y-5 lg:p-4">
        {adminRoleNavigation.map((role) => {
          const roleActive = activeRole === role.id;
          const roleIcon = role.id === 'platform' ? Layers3 : role.id === 'buyer' ? ShoppingCart : Truck;
          const RoleIcon = roleIcon;
          return (
            <div key={role.id} className="space-y-2">
              <button
                type="button"
                onClick={() => onSelectRole(role.id)}
                title={role.label}
                aria-current={roleActive ? 'true' : undefined}
                aria-pressed={roleActive}
                className={`flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-center transition lg:flex-row lg:gap-3 lg:px-4 lg:text-left ${
                  roleActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <RoleIcon size={19} className="shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold lg:hidden">{role.shortLabel}</span>
                  <span className="hidden text-sm font-bold lg:block">{role.label}</span>
                  <span className={`hidden truncate text-xs lg:block ${roleActive ? 'text-blue-100' : 'text-slate-500'}`}>{role.desc}</span>
                </span>
              </button>
              {roleActive && (
                <div className="space-y-1 lg:ml-3 lg:border-l lg:border-white/10 lg:pl-3">
                  {role.modules.map((module) => {
                    const moduleActive = activeModules[role.id] === module.id;
                    const ModuleIcon = moduleIcon(module.id);
                    return (
                      <button
                        key={`${role.id}:${module.id}`}
                        type="button"
                        onClick={() => onSelectModule(role.id, module.id)}
                        title={`${module.label}：${module.desc}`}
                        aria-current={moduleActive ? 'page' : undefined}
                        aria-pressed={moduleActive}
                        className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition lg:flex-row lg:items-start lg:gap-2 lg:px-3 lg:text-left ${
                          moduleActive ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <ModuleIcon size={15} className={`mt-0.5 shrink-0 ${moduleActive ? 'text-blue-600' : 'text-slate-500'}`} />
                        <span className="min-w-0">
                          <span className="block text-[11px] font-black leading-tight lg:text-sm">{module.label}</span>
                          <span className={`mt-0.5 hidden truncate text-xs lg:block ${moduleActive ? 'text-slate-500' : 'text-slate-600'}`}>
                            {module.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2 lg:p-4">
        <div className="rounded-lg bg-white/5 p-2 lg:p-4">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-400 lg:justify-start">
            <LockKeyhole size={14} />
            <span className="hidden lg:inline">多租户隔离</span>
          </div>
          <p className="mt-2 hidden text-sm text-slate-300 lg:block">采购数据、供应商私域关系、订单和财务记录按采购企业隔离。</p>
        </div>
      </div>
    </aside>
  );
};

const MobileAdminNav: React.FC<{
  activeRole: AdminRole;
  activeModules: Record<AdminRole, string>;
  onSelectRole: (role: AdminRole) => void;
  onSelectModule: (role: AdminRole, moduleId: string) => void;
}> = ({ activeRole, activeModules, onSelectRole, onSelectModule }) => {
  const activeRoleNavigation = adminRoleNavigation.find((role) => role.id === activeRole) ?? adminRoleNavigation[0];

  return (
    <div className="shrink-0 border-b border-slate-200 bg-slate-950 text-white lg:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-base font-black">24</div>
        <div className="min-w-0">
          <p className="text-sm font-black leading-none">24Bid</p>
          <p className="mt-1 truncate text-xs font-bold uppercase tracking-widest text-blue-300">Procurement SaaS</p>
        </div>
      </div>

      <nav aria-label="移动端角色导航" className="flex gap-2 overflow-x-auto px-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {adminRoleNavigation.map((role) => {
          const roleActive = activeRole === role.id;
          const RoleIcon = role.id === 'platform' ? Layers3 : role.id === 'buyer' ? ShoppingCart : Truck;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelectRole(role.id)}
              aria-current={roleActive ? 'true' : undefined}
              aria-pressed={roleActive}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                roleActive ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <RoleIcon size={15} />
              {role.shortLabel}
            </button>
          );
        })}
      </nav>

      <nav aria-label="移动端模块导航" className="flex gap-2 overflow-x-auto px-3 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {activeRoleNavigation.modules.map((module) => {
          const moduleActive = activeModules[activeRoleNavigation.id] === module.id;
          const ModuleIcon = moduleIcon(module.id);
          return (
            <button
              key={`${activeRoleNavigation.id}:${module.id}`}
              type="button"
              onClick={() => onSelectModule(activeRoleNavigation.id, module.id)}
              title={`${module.label}：${module.desc}`}
              aria-current={moduleActive ? 'page' : undefined}
              aria-pressed={moduleActive}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-black transition ${
                moduleActive ? 'bg-white text-slate-950' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ModuleIcon size={14} className={moduleActive ? 'text-blue-600' : 'text-slate-400'} />
              {module.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

const AppHeader: React.FC<{
  activeRole: AdminRole;
  activeModule: string;
  model: ProcurementMvpModel;
  tenantId: string;
  supplierId: string;
  setTenantId: (id: string) => void;
  setSupplierId: (id: string) => void;
  javaEnabled: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refreshBusy: boolean;
  workflowBusy: boolean;
  onRefresh: () => void;
  onRunJavaWorkflow: () => void;
}> = ({
  activeRole,
  activeModule,
  model,
  tenantId,
  supplierId,
  setTenantId,
  setSupplierId,
  javaEnabled,
  searchQuery,
  setSearchQuery,
  refreshBusy,
  workflowBusy,
  onRefresh,
  onRunJavaWorkflow,
}) => {
  const buyerTenants = model.tenants;
  const suppliers = model.enterprises.filter((enterprise) => enterprise.type === 'supplier');
  const roleNavigation = adminRoleNavigation.find((role) => role.id === activeRole);
  const moduleNavigation = roleNavigation?.modules.find((module) => module.id === activeModule);
  const title =
    activeRole === 'platform'
      ? '平台运营总览'
      : activeRole === 'buyer'
        ? buyerTenants.find((tenant) => tenant.id === tenantId)?.name
        : suppliers.find((supplier) => supplier.id === supplierId)?.name;

  return (
    <header className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm shadow-slate-200/70 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">当前工作区</p>
          <h1 className="max-w-[220px] truncate text-lg font-black text-slate-900 sm:max-w-none">{title}</h1>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {roleNavigation?.shortLabel} / {moduleNavigation?.label}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 lg:justify-end lg:gap-3">
        {activeRole === 'buyer' && (
          <Select value={tenantId} onChange={setTenantId}>
            {buyerTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        )}
        {activeRole === 'supplier' && (
          <Select value={supplierId} onChange={setSupplierId}>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        )}
        <div className="relative order-last min-w-0 w-full sm:min-w-[18rem] xl:order-none xl:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            aria-label="搜索当前工作区"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-16 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="搜索企业、询价、订单、供应商"
          />
          {searchQuery.trim() && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-black text-slate-500 hover:bg-white hover:text-slate-700"
            >
              清空搜索
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshBusy}
          aria-busy={refreshBusy || undefined}
          className="inline-flex h-9 min-w-0 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:flex-none"
        >
          {refreshBusy ? '刷新中' : '刷新'}
        </button>
        {javaEnabled && activeRole === 'buyer' && (
          <button
            type="button"
            onClick={onRunJavaWorkflow}
            disabled={workflowBusy}
            className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:flex-none sm:px-4"
          >
            <Send size={16} />
            {workflowBusy ? '执行中' : '跑通主流程'}
          </button>
        )}
        <button className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" title="通知">
          <Bell size={18} />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            6
          </span>
        </button>
      </div>
    </header>
  );
};

const Select: React.FC<{
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}> = ({ value, onChange, children }) => (
  <label className="relative w-full min-w-0 sm:w-auto">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full min-w-0 appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-bold text-slate-700 outline-none hover:bg-slate-50"
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
  </label>
);

type PlatformAnnouncement = {
  id: string;
  title: string;
  content: string;
  targetScope: string;
  publishedAt: string;
};

type BuyerModuleHeaderConfig = {
  title: string;
  desc: string;
  primaryAction: string;
  currentFilter: string;
};

const buyerModuleHeaders: Record<BuyerAdminModule, BuyerModuleHeaderConfig> = {
  dashboard: {
    title: '首页看板',
    desc: '汇总采购金额、审批待办、询价状态和履约进度。',
    primaryAction: '查看主流程进度',
    currentFilter: '全部采购业务',
  },
  demands: {
    title: '采购需求',
    desc: '从需求申请、预算和物料明细开始，推动审批后转入询价。',
    primaryAction: '新建需求 / 提交审批',
    currentFilter: '全部需求状态',
  },
  approvals: {
    title: '审批中心',
    desc: '集中处理需求审批、供应商准入和定标审批。',
    primaryAction: '通过 / 驳回审批',
    currentFilter: '待审批优先',
  },
  suppliers: {
    title: '供应商库',
    desc: '维护采购方私域供应商关系、准入状态、分级和品类授权。',
    primaryAction: '提交供应商准入',
    currentFilter: '私域合作关系',
  },
  materials: {
    title: '物料目录',
    desc: '维护物料和服务主数据，为需求、询价和供应商覆盖分析提供基础。',
    primaryAction: '查看物料引用',
    currentFilter: '全部物料与服务',
  },
  rfqs: {
    title: '询价项目',
    desc: '跟进 RFQ 邀请供应商、报价响应、截止时间和项目状态。',
    primaryAction: '邀请供应商 / 跟进报价',
    currentFilter: '全部询价项目',
  },
  quotes: {
    title: '报价对比',
    desc: '比较供应商报价、交付周期和税率，推荐定标并提交审批。',
    primaryAction: '推荐定标 / 提交审批',
    currentFilter: '按询价项目聚合',
  },
  orders: {
    title: '采购订单',
    desc: '跟进定标后的采购订单、供应商确认和履约状态。',
    primaryAction: '生成订单 / 跟进确认',
    currentFilter: '全部采购订单',
  },
  contracts: {
    title: '合同管理',
    desc: '以采购订单为来源沉淀合同台账，跟进合同审批、履约和归档状态。',
    primaryAction: '查看合同台账',
    currentFilter: '全部合同状态',
  },
  receipts: {
    title: '收货验收',
    desc: '处理待收货订单，登记收货验收结果并推动发票协同。',
    primaryAction: '登记收货验收',
    currentFilter: '待收货优先',
  },
  invoices: {
    title: '发票付款',
    desc: '查看发票登记、付款状态和订单对账进度。',
    primaryAction: '登记付款状态',
    currentFilter: '待付款优先',
  },
  audit: {
    title: '审计日志',
    desc: '查看近期操作记录、对象编号和流程留痕结果。',
    primaryAction: '查看操作留痕',
    currentFilter: '最近操作',
  },
};

const buyerDemoWalkthroughModules: BuyerAdminModule[] = [
  'demands',
  'approvals',
  'rfqs',
  'quotes',
  'orders',
  'receipts',
  'invoices',
];

const buyerDemoWalkthroughSteps: Array<DemoWalkthroughStep<BuyerAdminModule>> = [
  { moduleId: 'demands', label: '需求申请', summary: '预算、物料明细、附件和审批入口' },
  { moduleId: 'approvals', label: '审批处理', summary: '需求审批、准入审批和定标审批' },
  { moduleId: 'rfqs', label: '询价协同', summary: '邀请供应商、报价要求和截止时间' },
  { moduleId: 'quotes', label: '比价定标', summary: '报价矩阵、推荐理由和定标审批' },
  { moduleId: 'orders', label: '订单履约', summary: '生成订单、确认、发货和预计到货' },
  { moduleId: 'receipts', label: '收货验收', summary: '登记收货、异常原因和验收结果' },
  { moduleId: 'invoices', label: '发票付款', summary: '开票对账、差异处理和付款状态' },
];

const contractDemoWalkthroughSteps: Array<DemoWalkthroughStep<BuyerAdminModule>> = [
  { moduleId: 'orders', label: '采购订单', summary: '订单生成合同的来源单据' },
  { moduleId: 'contracts', label: '合同管理', summary: '合同台账、审批、履约事件和归档边界' },
  { moduleId: 'approvals', label: '审批中心', summary: '合同审批任务回看' },
  { moduleId: 'receipts', label: '收货验收', summary: '合同履约事件的收货证据' },
  { moduleId: 'invoices', label: '发票付款', summary: '合同与发票付款关系回看' },
];

const platformDemoWalkthroughModules: PlatformAdminModule[] = [
  'overview',
  'tenants',
  'reviews',
  'announcements',
];

const platformDemoWalkthroughSteps: Array<DemoWalkthroughStep<PlatformAdminModule>> = [
  { moduleId: 'overview', label: '平台看板', summary: '租户、供应商、审核和公告总览' },
  { moduleId: 'tenants', label: '租户列表', summary: '套餐、状态、容量和功能开关' },
  { moduleId: 'reviews', label: '企业审核', summary: '入驻资料、风险确认和审核处理' },
  { moduleId: 'announcements', label: '平台公告', summary: '发布、编辑、撤回和运营触达' },
];

const supplierDemoWalkthroughModules: SupplierAdminModule[] = [
  'opportunities',
  'quotes',
  'orders',
  'invoices',
  'profile',
];

const supplierDemoWalkthroughSteps: Array<DemoWalkthroughStep<SupplierAdminModule>> = [
  { moduleId: 'opportunities', label: '询价邀请', summary: '收到邀请、查看要求和提交报价' },
  { moduleId: 'quotes', label: '报价记录', summary: '回看报价金额、交付周期和定标结果' },
  { moduleId: 'orders', label: '销售订单', summary: '确认订单、提交发货和提交发票' },
  { moduleId: 'invoices', label: '发票应收', summary: '保存对账备注并跟进回款状态' },
  { moduleId: 'profile', label: '企业档案', summary: '维护企业资料、资质和协作身份' },
];

type SupplierCollaborationOperationStripConfig = {
  pageLabel: string;
  operationTitle: string;
  focus: string;
  recommendedAction: string;
  boundary: string;
  listPolish: string;
  detailPolish: string;
  emptyStatePolish: string;
  buttonBoundaryPolish: string;
  nextModuleLabel: string;
  nextModuleId: SupplierAdminModule;
};

const supplierCollaborationOperationStrips: Partial<Record<SupplierAdminModule, SupplierCollaborationOperationStripConfig>> = {
  opportunities: {
    pageLabel: '询价邀请',
    operationTitle: '询价邀请 · 演示操作收束',
    focus: '先说明采购方邀请来源、报价截止、采购要求和本企业响应状态。',
    recommendedAction: '提交报价或查看采购要求',
    boundary: '供应商只能处理自己的邀请，不能查看采购方预算和其他供应商报价。',
    listPolish: '商机卡片优先展示 RFQ、截止时间、报价状态和响应入口。',
    detailPolish: '详情先看采购要求，再看报价草稿、拒绝邀请和报价历史。',
    emptyStatePolish: '暂无邀请时说明需由采购方创建 RFQ 并邀请当前供应商。',
    buttonBoundaryPolish: '已报价或已拒绝后不重复提交报价。',
    nextModuleLabel: '报价记录',
    nextModuleId: 'quotes',
  },
  quotes: {
    pageLabel: '报价记录',
    operationTitle: '报价记录 · 演示操作收束',
    focus: '回看本企业已提交报价、交付周期、税率、关联 RFQ 和定标结果。',
    recommendedAction: '跟进定标结果',
    boundary: '只有报价中的 RFQ 才能维护本企业报价，定标和审批由采购方处理。',
    listPolish: '报价金额、交付天数、状态和关联询价保持同屏。',
    detailPolish: '详情先看报价结论，再看修改边界和采购方定标状态。',
    emptyStatePolish: '暂无报价时引导回询价邀请页提交报价。',
    buttonBoundaryPolish: '已定标报价只读，避免误以为供应商可改定标结果。',
    nextModuleLabel: '销售订单',
    nextModuleId: 'orders',
  },
  orders: {
    pageLabel: '销售订单',
    operationTitle: '销售订单 · 演示操作收束',
    focus: '把采购方订单承接为供应商履约动作，说明确认、发货和开票条件。',
    recommendedAction: '确认订单、提交发货或提交发票',
    boundary: '供应商不能登记采购方收货或付款结果。',
    listPolish: '订单状态、发货状态、开票状态和下一动作固定展示。',
    detailPolish: '详情先看订单金额、履约轨迹，再看物流和发票入口。',
    emptyStatePolish: '暂无订单时说明采购方定标并生成订单后才进入供应商侧。',
    buttonBoundaryPolish: '待确认、待发货、已收货三个状态分别开放不同动作。',
    nextModuleLabel: '发票应收',
    nextModuleId: 'invoices',
  },
  invoices: {
    pageLabel: '发票应收',
    operationTitle: '发票应收 · 演示操作收束',
    focus: '把供应商发票、对账备注、逾期提醒和采购方付款状态放在同一视线内。',
    recommendedAction: '保存对账备注并跟进回款',
    boundary: '供应商只能维护应收备注，付款登记由采购方驱动。',
    listPolish: '发票金额、付款状态、逾期天数和关联订单优先展示。',
    detailPolish: '详情先看应收风险，再看对账备注和订单来源。',
    emptyStatePolish: '暂无应收时说明需先完成收货并提交发票。',
    buttonBoundaryPolish: '已付款发票只做回看，不再重复跟进应收备注。',
    nextModuleLabel: '企业档案',
    nextModuleId: 'profile',
  },
  profile: {
    pageLabel: '企业档案',
    operationTitle: '企业档案 · 演示操作收束',
    focus: '维护企业认证、资质附件、联系人和服务能力，支撑采购方准入。',
    recommendedAction: '维护企业档案',
    boundary: '供应商只能维护本企业档案，不能替采购方建立私域准入关系。',
    listPolish: '档案页不做大列表，优先展示认证、资质、联系人和合作采购方。',
    detailPolish: '详情先看企业身份，再看资质附件和授权品类。',
    emptyStatePolish: '资料缺失时说明先补齐认证和资质，再等待采购方准入。',
    buttonBoundaryPolish: 'Java 模式才保存档案，资料不完整时禁用保存。',
    nextModuleLabel: '询价邀请',
    nextModuleId: 'opportunities',
  },
};

type SupplierModuleHeaderConfig = {
  title: string;
  desc: string;
  primaryAction: string;
  currentFilter: string;
};

const supplierModuleHeaders: Record<SupplierAdminModule, SupplierModuleHeaderConfig> = {
  overview: {
    title: '供应商看板',
    desc: '汇总合作采购方、询价邀请、销售订单和待回款发票。',
    primaryAction: '查看协同待办',
    currentFilter: '全部采购方协作',
  },
  opportunities: {
    title: '询价邀请',
    desc: '查看采购方发来的 RFQ，确认采购要求并提交报价或拒绝邀请。',
    primaryAction: '提交报价 / 查看要求',
    currentFilter: '待报价优先',
  },
  quotes: {
    title: '报价记录',
    desc: '追踪已提交报价、交付周期、税率和关联询价状态。',
    primaryAction: '跟进定标结果',
    currentFilter: '全部报价历史',
  },
  orders: {
    title: '销售订单',
    desc: '处理采购方生成的订单，完成确认、发货和开票协同。',
    primaryAction: '确认订单 / 提交发货',
    currentFilter: '待履约优先',
  },
  invoices: {
    title: '发票应收',
    desc: '查看已提交发票、付款状态和应收回款进度。',
    primaryAction: '跟进回款状态',
    currentFilter: '未回款优先',
  },
  profile: {
    title: '企业档案',
    desc: '维护企业认证、资质、联系人和服务能力信息。',
    primaryAction: '维护企业档案',
    currentFilter: '当前供应商主体',
  },
};

const buildSupplierModuleFacts = (
  workspace: SupplierWorkspace,
  activeModule: SupplierAdminModule,
): Array<{ label: string; value: string }> => {
  const pendingQuoteCount = workspace.opportunities.filter((rfq) =>
    rfq.status === '报价中' && !rfq.quotes.some((quote) => quote.supplierId === workspace.supplier.id)
  ).length;
  const pendingOrderCount = workspace.orders.filter((order) =>
    order.status === '待供应商确认' || order.status === '待发货'
  ).length;
  const pendingReceivableCount = workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款').length;
  const pendingReceivableAmount = workspace.invoices
    .filter((invoice) => invoice.paymentStatus !== '已付款')
    .reduce((sum, invoice) => sum + invoice.amount, 0);

  const commonFacts = {
    overview: [
      { label: '合作采购方', value: `${workspace.connectedBuyerNames.length} 家` },
      { label: '询价邀请', value: `${workspace.opportunities.length} 个` },
      { label: '销售订单', value: `${workspace.orders.length} 单` },
      { label: '待回款发票', value: `${pendingReceivableCount} 张` },
    ],
    opportunities: [
      { label: '邀请总数', value: `${workspace.opportunities.length} 个` },
      { label: '待报价', value: `${pendingQuoteCount} 个` },
      { label: '已报价', value: `${workspace.quotes.length} 条` },
      { label: '合作采购方', value: `${workspace.connectedBuyerNames.length} 家` },
    ],
    quotes: [
      { label: '报价记录', value: `${workspace.quotes.length} 条` },
      { label: '报价总额', value: currency(workspace.quotes.reduce((sum, quote) => sum + quote.amount, 0)) },
      { label: '待定标', value: `${workspace.opportunities.filter((rfq) => rfq.status === '报价中').length} 个` },
      { label: '下一步', value: pendingQuoteCount > 0 ? '补充报价' : '等待定标' },
    ],
    orders: [
      { label: '订单总数', value: `${workspace.orders.length} 单` },
      { label: '待履约', value: `${pendingOrderCount} 单` },
      { label: '发货记录', value: `${workspace.deliveries.length} 条` },
      { label: '下一步', value: pendingOrderCount > 0 ? '处理履约' : '跟进开票' },
    ],
    invoices: [
      { label: '发票总数', value: `${workspace.invoices.length} 张` },
      { label: '待回款', value: `${pendingReceivableCount} 张` },
      { label: '待回款金额', value: currency(pendingReceivableAmount) },
      { label: '下一步', value: pendingReceivableCount > 0 ? '跟进回款' : '归档对账' },
    ],
    profile: [
      { label: '认证状态', value: workspace.supplier.verified ? '已认证' : '待认证' },
      { label: '所属行业', value: workspace.supplier.industry },
      { label: '合作采购方', value: `${workspace.connectedBuyerNames.length} 家` },
      { label: '服务状态', value: workspace.supplier.verified ? '资料有效' : '待补充' },
    ],
  } satisfies Record<SupplierAdminModule, Array<{ label: string; value: string }>>;

  return commonFacts[activeModule];
};

const buildSupplierMessageCenterNotifications = (workspace: SupplierWorkspace): JavaNotificationDto[] => {
  const createdAt = new Date().toISOString();
  const supplierPaymentNotificationTitles = ['发票已付款', '发票部分付款'];
  const backendNotifications = [...(workspace.notifications ?? [])].sort((left, right) =>
    Number(supplierPaymentNotificationTitles.includes(right.title))
    - Number(supplierPaymentNotificationTitles.includes(left.title))
  );
  const pendingQuoteMessages = workspace.opportunities
    .filter((rfq) => rfq.status === '报价中' && !rfq.quotes.some((quote) => quote.supplierId === workspace.supplier.id))
    .map((rfq) => ({
      id: `supplier-message-rfq-${rfq.id}`,
      tenantId: rfq.tenantId,
      recipientId: workspace.supplier.id,
      title: '收到询价邀请',
      content: `${rfq.title} 等待报价，报价截止 ${rfq.deadline}。`,
      read: false,
      createdAt,
    }));
  const orderMessages = workspace.orders
    .filter((order) => ['待供应商确认', '待发货', '已收货'].includes(order.status))
    .map((order) => ({
      id: `supplier-message-order-${order.id}`,
      tenantId: order.tenantId,
      recipientId: workspace.supplier.id,
      title: order.status === '待供应商确认' ? '销售订单待确认' : order.status === '待发货' ? '销售订单待发货' : '销售订单可开票',
      content: `${order.id} 当前状态为 ${order.status}，订单金额 ${currency(order.amount)}。`,
      read: order.status === '已收货',
      createdAt,
    }));
  const invoiceMessages = workspace.invoices
    .filter((invoice) => invoice.paymentStatus !== '已付款')
    .map((invoice) => ({
      id: `supplier-message-invoice-${invoice.id}`,
      tenantId: invoice.tenantId,
      recipientId: workspace.supplier.id,
      title: '发票回款待跟进',
      content: `${invoice.id} 当前付款状态为 ${invoice.paymentStatus}，应收金额 ${currency(invoice.amount)}。`,
      read: invoice.paymentStatus === '部分付款',
      createdAt,
    }));

  return [
    ...backendNotifications,
    ...pendingQuoteMessages,
    ...orderMessages,
    ...invoiceMessages,
  ].slice(0, 6);
};

type PlatformModuleHeaderConfig = {
  title: string;
  desc: string;
  primaryAction: string;
  currentFilter: string;
};

const platformModuleHeaders: Record<PlatformAdminModule, PlatformModuleHeaderConfig> = {
  overview: {
    title: '平台看板',
    desc: '汇总 SaaS 租户、公共供应商、企业审核和平台公告运营状态。',
    primaryAction: '查看运营概览',
    currentFilter: '全部平台运营数据',
  },
  tenants: {
    title: '租户列表',
    desc: '管理采购方企业租户、套餐版本、用户容量和基础功能开关。',
    primaryAction: '启停租户 / 调整套餐',
    currentFilter: '全部采购企业租户',
  },
  reviews: {
    title: '企业审核',
    desc: '处理采购方与供应商企业入驻认证，维护平台公共企业身份。',
    primaryAction: '通过 / 驳回企业审核',
    currentFilter: '待审核优先',
  },
  announcements: {
    title: '平台公告',
    desc: '面向采购方、供应商或全部企业发布平台运营通知。',
    primaryAction: '发布平台公告',
    currentFilter: '已发布公告',
  },
};

const buildPlatformModuleFacts = (
  activeModule: PlatformAdminModule,
  tenants: PlatformTenantRow[],
  enterpriseReviews: PlatformEnterpriseReview[],
  announcements: PlatformAnnouncement[],
  buyerCount: number,
  supplierCount: number,
): Array<{ label: string; value: string }> => {
  const activeTenantCount = tenants.filter((tenant) =>
    tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用'
  ).length;
  const pendingReviewCount = enterpriseReviews.filter((review) => review.status === '待审核').length;
  const verifiedReviewCount = enterpriseReviews.filter((review) => review.status === '已认证').length;
  const planCount = new Set(tenants.map((tenant) => tenant.plan)).size;
  const latestAnnouncement = announcements
    .slice()
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0];

  const facts = {
    overview: [
      { label: '采购租户', value: `${buyerCount} 家` },
      { label: '公共供应商', value: `${supplierCount} 家` },
      { label: '待审核企业', value: `${pendingReviewCount} 家` },
      { label: '公告数量', value: `${announcements.length} 条` },
    ],
    tenants: [
      { label: '租户总数', value: `${tenants.length} 家` },
      { label: '启用租户', value: `${activeTenantCount} 家` },
      { label: '套餐覆盖', value: `${planCount} 类` },
      { label: '用户容量', value: `${tenants.reduce((sum, tenant) => sum + tenant.userLimit, 0)} 人` },
    ],
    reviews: [
      { label: '待审核', value: `${pendingReviewCount} 家` },
      { label: '已认证', value: `${verifiedReviewCount} 家` },
      { label: '采购方企业', value: `${enterpriseReviews.filter((review) => review.type === 'buyer').length} 家` },
      { label: '供应商企业', value: `${enterpriseReviews.filter((review) => review.type === 'supplier').length} 家` },
    ],
    announcements: [
      { label: '公告数量', value: `${announcements.length} 条` },
      { label: '发布范围', value: `${new Set(announcements.map((announcement) => announcement.targetScope)).size} 类` },
      { label: '最近发布', value: latestAnnouncement ? formatAuditTime(latestAnnouncement.publishedAt) : '暂无' },
      { label: '下一步', value: announcements.length > 0 ? '维护公告内容' : '发布平台公告' },
    ],
  } satisfies Record<PlatformAdminModule, Array<{ label: string; value: string }>>;

  return facts[activeModule];
};

const buildPlatformAnnouncements = (announcements: JavaPlatformAnnouncementDto[]): PlatformAnnouncement[] =>
  announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    targetScope: announcement.audience,
    publishedAt: announcement.createdAt,
  }));

type PlatformEnterpriseReview = {
  id: string;
  name: string;
  type: string;
  industry: string;
  status: string;
  reviewComment?: string;
  profileConfirmed?: boolean;
  riskConfirmed?: boolean;
};

type PlatformEnterpriseReviewDraft = {
  comment: string;
  profileConfirmed: boolean;
  riskConfirmed: boolean;
};

const buildPlatformEnterpriseReviews = (model: ProcurementMvpModel): PlatformEnterpriseReview[] =>
  model.enterprises.map((enterprise) => ({
    id: enterprise.id,
    name: enterprise.name,
    type: enterprise.type,
    industry: enterprise.industry,
    status: enterprise.verified ? '已认证' : '待审核',
    reviewComment: enterprise.reviewComment,
    profileConfirmed: enterprise.profileConfirmed,
    riskConfirmed: enterprise.riskConfirmed,
  }));

type PlatformTenantRow = Omit<PlatformWorkspaceData['tenants'][number], 'status'> & {
  status: string;
  features: string[];
};

const formatPlatformTenantFeature = (feature: string) => {
  if (feature === 'rfq') return '询价比价';
  if (feature === 'order') return '订单履约';
  if (feature === 'finance') return '财务协同';
  return feature;
};

const buildPlatformTenantRows = (tenants: PlatformWorkspaceData['tenants']): PlatformTenantRow[] =>
  tenants.map((tenant) => ({
    ...tenant,
    features: tenant.enabledFeatures.map(formatPlatformTenantFeature),
  }));

const describePlatformTenantNextAction = (tenant: PlatformTenantRow | undefined) => {
  if (!tenant) return '选择租户后查看套餐、状态和功能开关。';
  if (tenant.status === '停用') return '核对停用原因，必要时重新启用租户。';
  if (!tenant.features.includes('询价比价')) return '核对套餐能力，可为租户开启询价比价功能。';
  return '持续维护套餐、容量和功能开关。';
};

const describePlatformReviewNextAction = (review: PlatformEnterpriseReview | undefined) => {
  if (!review) return '选择企业后查看入驻资料、风险检查和审核建议。';
  if (review.status === '待审核') return '核对资料和风险确认后通过或驳回企业审核。';
  if (review.status === '已驳回') return '等待企业补充资料后重新提交。';
  return '企业已认证，后续维护公共企业档案。';
};

const describePlatformAnnouncementNextAction = (announcement: PlatformAnnouncement | undefined) => {
  if (!announcement) return '先发布平台公告，再维护站内通知范围。';
  return '可编辑公告内容、调整发布范围或撤回公告。';
};

const PlatformWorkspace: React.FC<{
  data: PlatformWorkspaceData;
  activeModule: PlatformAdminModule;
  javaEnabled: boolean;
  workflowStatus: string | null;
  platformReviewBusyId: string | null;
  platformTenantBusyId: string | null;
  announcementPublishBusy: boolean;
  announcementLifecycleBusyId: string | null;
  onReviewEnterprise: (
    reviewId: string,
    result: 'approved' | 'rejected',
    draft: PlatformEnterpriseReviewDraft,
  ) => Promise<void> | void;
  onUpdateTenantStatus: (tenantId: string, status: '已启用' | '停用') => Promise<void> | void;
  onUpdateTenantPlan: (tenantId: string, plan: PlatformTenantRow['plan']) => Promise<void> | void;
  onToggleTenantFeature: (tenantId: string, enabledFeatures: string[], feature: 'rfq') => Promise<void> | void;
  onPublishAnnouncement: (payload: { title: string; content: string; targetScope: string }) => Promise<JavaPlatformAnnouncementDto[] | null> | void;
  onUpdateAnnouncement: (
    announcementId: string,
    payload: { title: string; content: string; targetScope: string },
  ) => Promise<JavaPlatformAnnouncementDto[] | null> | void;
  onWithdrawAnnouncement: (announcementId: string) => Promise<JavaPlatformAnnouncementDto[] | null> | void;
  onNavigatePlatformModule: (moduleId: PlatformAdminModule) => void;
}> = ({
  data,
  activeModule,
  javaEnabled,
  workflowStatus,
  platformReviewBusyId,
  platformTenantBusyId,
  announcementPublishBusy,
  announcementLifecycleBusyId,
  onReviewEnterprise,
  onUpdateTenantStatus,
  onUpdateTenantPlan,
  onToggleTenantFeature,
  onPublishAnnouncement,
  onUpdateAnnouncement,
  onWithdrawAnnouncement,
  onNavigatePlatformModule,
}) => {
  const { model, platformOverview } = data;
  const supplierCount = platformOverview?.publicSupplierCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'supplier').length;
  const buyerCount = platformOverview?.tenantCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'buyer').length;
  const pendingTenantCount = platformOverview?.pendingEnterpriseReviews
    ?? model.tenants.filter((tenant) => tenant.status === '待审核').length;
  const [platformTenants, setPlatformTenants] = useState<PlatformTenantRow[]>(() =>
    buildPlatformTenantRows(data.tenants));
  const [selectedPlatformTenantId, setSelectedPlatformTenantId] = useState(data.tenants[0]?.id ?? '');
  useEffect(() => {
    const nextTenants = buildPlatformTenantRows(data.tenants);
    setPlatformTenants(nextTenants);
    setSelectedPlatformTenantId((current) => (
      nextTenants.some((tenant) => tenant.id === current) ? current : nextTenants[0]?.id ?? ''
    ));
  }, [data.tenants]);
  const handleUpdateTenantStatus = async (tenantId: string, status: '已启用' | '停用') => {
    if (javaEnabled) {
      await onUpdateTenantStatus(tenantId, status);
      return;
    }
    setPlatformTenants((current) => current.map((tenant) => (
      tenant.id === tenantId ? { ...tenant, status } : tenant
    )));
  };
  const handleUpdateTenantPlan = async (tenantId: string, plan: PlatformTenantRow['plan']) => {
    if (javaEnabled) {
      await onUpdateTenantPlan(tenantId, plan);
      return;
    }
    setPlatformTenants((current) => current.map((tenant) => (
      tenant.id === tenantId ? { ...tenant, plan } : tenant
    )));
  };
  const handleToggleTenantFeature = async (tenantId: string, feature: 'rfq') => {
    const featureLabel = feature === 'rfq' ? '询价比价' : feature;
    const targetTenant = platformTenants.find((tenant) => tenant.id === tenantId);
    if (javaEnabled && targetTenant) {
      await onToggleTenantFeature(tenantId, targetTenant.enabledFeatures, feature);
      return;
    }
    setPlatformTenants((current) => current.map((tenant) => {
      if (tenant.id !== tenantId) {
        return tenant;
      }
      const nextFeatures = tenant.features.includes(featureLabel)
        ? tenant.features.filter((enabledFeature) => enabledFeature !== featureLabel)
        : [...tenant.features, featureLabel];

      return {
        ...tenant,
        enabledFeatures: nextFeatures,
        features: nextFeatures,
      };
    }));
  };
  const [platformEnterpriseReviews, setPlatformEnterpriseReviews] = useState<PlatformEnterpriseReview[]>(() =>
    buildPlatformEnterpriseReviews(model));
  const [selectedPlatformReviewId, setSelectedPlatformReviewId] = useState(model.enterprises[0]?.id ?? '');
  useEffect(() => {
    const nextReviews = buildPlatformEnterpriseReviews(model);
    setPlatformEnterpriseReviews(nextReviews);
    setSelectedPlatformReviewId((current) => (
      nextReviews.some((review) => review.id === current) ? current : nextReviews[0]?.id ?? ''
    ));
  }, [model]);
  const enterpriseReviews = platformEnterpriseReviews;
  const selectedPlatformReview = enterpriseReviews.find((review) => review.id === selectedPlatformReviewId)
    ?? enterpriseReviews[0];
  const handleReviewEnterprise = async (
    reviewId: string,
    result: 'approved' | 'rejected',
    draft: PlatformEnterpriseReviewDraft,
  ) => {
    if (javaEnabled) {
      await onReviewEnterprise(reviewId, result, draft);
      return;
    }
    setPlatformEnterpriseReviews((current) => current.map((review) => (
      review.id === reviewId
        ? { ...review, status: result === 'approved' ? '已认证' : '已驳回' }
        : review
    )));
  };
  const [platformAnnouncements, setPlatformAnnouncements] = useState<PlatformAnnouncement[]>([{
    id: 'platform-announcement-stage3',
    title: '阶段三后台化改造进行中',
    content: '采购方后台菜单、核心列表和主流程操作入口已进入联调优化阶段。',
    targetScope: 'all',
    publishedAt: new Date().toISOString(),
  }]);
  const [selectedPlatformAnnouncementId, setSelectedPlatformAnnouncementId] = useState('platform-announcement-stage3');
  useEffect(() => {
    if (!javaEnabled || !javaApiClient) return;
    let active = true;
    javaApiClient.listPlatformAnnouncements()
      .then((announcements) => {
        if (active) {
          const nextAnnouncements = buildPlatformAnnouncements(announcements);
          setPlatformAnnouncements(nextAnnouncements);
          setSelectedPlatformAnnouncementId((current) => (
            nextAnnouncements.some((announcement) => announcement.id === current)
              ? current
              : nextAnnouncements[0]?.id ?? ''
          ));
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, [javaEnabled, data.platformOverview?.operationSummary?.activeAnnouncementCount]);
  const announcements = platformAnnouncements;
  const selectedPlatformTenant = platformTenants.find((tenant) => tenant.id === selectedPlatformTenantId)
    ?? platformTenants[0];
  const selectedPlatformAnnouncement = announcements.find((announcement) => announcement.id === selectedPlatformAnnouncementId)
    ?? announcements[0];
  const platformModuleFacts = buildPlatformModuleFacts(
    activeModule,
    platformTenants,
    enterpriseReviews,
    announcements,
    buyerCount,
    supplierCount,
  );
  const platformModuleHeader = platformModuleHeaders[activeModule];
  const handlePublishAnnouncement = async (payload: { title: string; content: string; targetScope: string }) => {
    if (javaEnabled) {
      const nextAnnouncements = await onPublishAnnouncement(payload);
      if (nextAnnouncements) {
        setPlatformAnnouncements(buildPlatformAnnouncements(nextAnnouncements));
      }
      return;
    }
    const nextAnnouncement: PlatformAnnouncement = {
      id: `platform-announcement-${Date.now()}`,
        title: payload.title,
        content: payload.content,
        targetScope: payload.targetScope,
        publishedAt: new Date().toISOString(),
    };
    setPlatformAnnouncements((current) => [
      nextAnnouncement,
      ...current,
    ]);
    setSelectedPlatformAnnouncementId(nextAnnouncement.id);
  };
  const handleUpdateAnnouncement = async (
    announcementId: string,
    payload: { title: string; content: string; targetScope: string },
  ) => {
    if (javaEnabled) {
      const nextAnnouncements = await onUpdateAnnouncement(announcementId, payload);
      if (nextAnnouncements) {
        const mappedAnnouncements = buildPlatformAnnouncements(nextAnnouncements);
        setPlatformAnnouncements(mappedAnnouncements);
        setSelectedPlatformAnnouncementId((current) => (
          mappedAnnouncements.some((announcement) => announcement.id === current)
            ? current
            : mappedAnnouncements[0]?.id ?? ''
        ));
      }
      return;
    }
    setPlatformAnnouncements((current) => current.map((announcement) => (
      announcement.id === announcementId
        ? {
            ...announcement,
            title: payload.title,
            content: payload.content,
            targetScope: payload.targetScope,
          }
        : announcement
    )));
  };
  const handleWithdrawAnnouncement = async (announcementId: string) => {
    if (javaEnabled) {
      const nextAnnouncements = await onWithdrawAnnouncement(announcementId);
      if (nextAnnouncements) {
        const mappedAnnouncements = buildPlatformAnnouncements(nextAnnouncements);
        setPlatformAnnouncements(mappedAnnouncements);
        setSelectedPlatformAnnouncementId((current) => (
          mappedAnnouncements.some((announcement) => announcement.id === current)
            ? current
            : mappedAnnouncements[0]?.id ?? ''
        ));
      }
      return;
    }
    setPlatformAnnouncements((current) => {
      const nextAnnouncements = current.filter((announcement) => announcement.id !== announcementId);
      setSelectedPlatformAnnouncementId((selected) => (
        selected === announcementId ? nextAnnouncements[0]?.id ?? '' : selected
      ));
      return nextAnnouncements;
    });
  };
  const operationSummary = platformOverview?.operationSummary;
  const locatePlatformDemoSample = () => {
    if (activeModule === 'tenants') {
      setSelectedPlatformTenantId('tenant-stage7-platform-action');
      scrollToStageNineDemoSample('stage9-demo-sample-platform-tenant');
    }
    if (activeModule === 'reviews') {
      setSelectedPlatformReviewId('ent-stage7-platform-review-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-platform-review');
    }
    if (activeModule === 'announcements') {
      setSelectedPlatformAnnouncementId('announcement-stage7-platform-withdraw-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-platform-announcement');
    }
  };
  const platformDemoSequenceNavigation = buildDemoSequenceNavigation(
    platformDemoWalkthroughSteps,
    activeModule,
    '平台运营演示收束',
    onNavigatePlatformModule,
    locatePlatformDemoSample,
  );
  const platformDemoReadinessItems = buildDemoReadinessItems(
    javaEnabled,
    '平台端 5 个真实动作',
    'stage-seven-platform-java-real-action-click-result.json',
    '租户、企业审核、公告推荐样本已标记，适合先讲 SaaS 治理边界。',
  );
  const platformOperationsDemoLoopItems = buildPlatformOperationsDemoLoopItems({
    tenantActionCount: platformTenants.length,
    enterpriseReviewCount: enterpriseReviews.filter((review) => review.status === '待审核').length,
    announcementCount: announcements.length,
    javaEnabled,
  });

  return (
    <>
      <PlatformModuleHeader
        header={platformModuleHeader}
        facts={platformModuleFacts}
        javaEnabled={javaEnabled}
      />

      <PermissionBoundaryPanel
        roleLabel="平台运营方"
        modeLabel={javaEnabled ? 'Java 模式' : 'Mock 模式'}
        allowedActions={[
          '管理租户、企业审核、平台公告和功能开关',
          '维护平台公共供应商企业档案和运营摘要',
        ]}
        blockedActions={[
          '不直接参与采购方定标、收货和付款决策',
          '不读取采购方私域供应商评价和财务明细',
        ]}
        dataBoundary="平台公共企业档案与租户运营数据"
      />

      <DemoCommandCenterPanel
        title="平台端现场演示总线"
        subtitle="先讲平台如何治理 SaaS 租户、企业准入和公告运营，再落到 5 个已验证真实动作。"
        items={platformDemoCommandCenterItems}
        currentGuide={platformDemoCurrentActionGuides[activeModule]}
        sequenceNavigation={platformDemoSequenceNavigation}
        testId="stage9-platform-demo-command-center"
      />

      <DemoReadinessPanel
        title="平台端演示准备检查"
        subtitle="开场前确认平台端 Java 数据源、前端加载、推荐样本和真实动作证据都可讲。"
        status={javaEnabled ? 'Java 数据源已连接' : '等待 Java 数据源'}
        items={platformDemoReadinessItems}
        testId="stage9-platform-demo-readiness"
      />

      <DemoActionFeedbackPanel
        title="平台端 5 个真实点击动作"
        subtitle="平台只做 SaaS 治理，不直接修改采购业务单据；平台动作服务租户、企业准入和公告运营。"
        items={platformDemoActionFeedbackItems}
        testId="stage8-platform-action-feedback"
      />

      <PlatformOperationsDemoLoopPanel
        items={platformOperationsDemoLoopItems}
        workflowStatus={workflowStatus}
      />

      <DemoReadonlyBoundaryPanel
        title="平台端只读边界与空状态"
        subtitle="把已完成审核、已撤回公告和平台只读治理边界提前说清，避免现场把不可操作误解成页面异常。"
        items={platformReadonlyBoundaryItems}
        testId="stage8-platform-readonly-boundary"
      />

      <DemoPermissionAuditPanel
        title="平台端权限与审计留痕"
        subtitle="把平台动作讲成治理闭环：谁能维护租户和公告、动作落在哪个对象、后续在哪里追溯。"
        items={platformGovernanceTraceItems}
        testId="stage8-platform-permission-audit"
      />

      {platformDemoWalkthroughModules.includes(activeModule) && (
        <DemoWalkthroughRail
          ariaLabel="平台运营演示路径"
          eyebrow="平台运营演示路径"
          title="按 4 页顺序完成平台运营轻量演示"
          description="从平台看板进入，依次讲清租户运营、企业准入和平台公告，强调平台只提供运营底座和合规边界。"
          steps={platformDemoWalkthroughSteps}
          activeModule={activeModule}
          closedLabel="平台运营演示收束"
          gridClassName="grid-cols-2 sm:grid-cols-4"
          onNavigate={(moduleId) => onNavigatePlatformModule(moduleId)}
        />
      )}

      {activeModule === 'overview' && (
        <>
          <HeroBand
            eyebrow="SaaS 平台底座"
            title="管理多采购企业入驻、套餐开关和公共供应商企业档案"
            desc="平台方提供账号、租户、权限、审计和运营能力，不直接参与采购业务定标。"
          />
          <div className="grid gap-4 md:grid-cols-4">
            <MetricCard icon={Building2} label="采购租户" value={`${buyerCount} 家`} tone="blue" />
            <MetricCard icon={Users} label="公共供应商" value={`${supplierCount} 家`} tone="green" />
            <MetricCard icon={Settings} label="启用套餐" value={`${model.tenants.length} 个`} tone="slate" />
            <MetricCard icon={ClipboardCheck} label="待审核企业" value={`${pendingTenantCount} 个`} tone="amber" />
          </div>
          <PlatformOperationSummaryPanel
            buyerCount={buyerCount}
            supplierCount={supplierCount}
            pendingTenantCount={pendingTenantCount}
            activeTenantCount={operationSummary?.activeTenantCount ?? platformTenants.filter((tenant) => tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用').length}
            announcementCount={operationSummary?.activeAnnouncementCount ?? announcements.length}
            enterpriseReviews={enterpriseReviews}
          />
          <Panel title="平台能力边界" icon={ShieldCheck}>
            <CapabilityList
              items={[
                '租户隔离、企业认证、套餐与功能开关',
                '公共供应商企业身份，不暴露采购方私域评价',
                '站内通知、附件中心、操作日志和审计底座',
                '后续开放 API、Webhook、ERP/OA/财务集成',
              ]}
            />
          </Panel>
        </>
      )}

      {activeModule === 'tenants' && (
        <>
          <PlatformOperationSummaryPanel
            buyerCount={buyerCount}
            supplierCount={supplierCount}
            pendingTenantCount={pendingTenantCount}
            activeTenantCount={operationSummary?.activeTenantCount ?? platformTenants.filter((tenant) => tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用').length}
            announcementCount={operationSummary?.activeAnnouncementCount ?? announcements.length}
            enterpriseReviews={enterpriseReviews}
          />
          <PlatformTenantListSummaryPanel tenants={platformTenants} />
          <PlatformTenantActionPanel
            tenants={platformTenants}
            tenantBusyId={platformTenantBusyId}
            onUpdateTenantStatus={handleUpdateTenantStatus}
            onUpdateTenantPlan={handleUpdateTenantPlan}
            onToggleTenantFeature={handleToggleTenantFeature}
          />
          {javaEnabled && workflowStatus && (
            <FeedbackNotice message={workflowStatus} />
          )}
          <Panel title="租户列表" icon={Layers3}>
            <ListToolbar
              title="租户运营列表"
              recordCount={platformTenants.length}
              filterLabel="全部采购企业租户"
              actionLabel="租户配置"
            />
            <FilterResultSummary
              label="租户列表筛选结果"
              filterLabel="全部状态"
              resultCount={platformTenants.length}
              totalCount={platformTenants.length}
              selectedLabel={selectedPlatformTenantId}
              onClear={() => setSelectedPlatformTenantId(platformTenants[0]?.id ?? '')}
            />
            <SelectedBusinessHandoffPanel
              moduleLabel="租户列表"
              selectedTitle={selectedPlatformTenant?.name}
              selectedMeta={selectedPlatformTenant?.plan}
              selectedStatus={selectedPlatformTenant?.status}
              nextActionTitle={describePlatformTenantNextAction(selectedPlatformTenant)}
              detailHint="右侧详情会核对套餐容量、功能开关、多租户隔离和审计动作。"
              boundaryHint="平台只能维护租户配置和功能开关，不直接处理采购方业务定标、收货和付款。"
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <ResponsiveTableFrame
                mobileCards={platformTenants.map((tenant) => {
                  const platformTenantDemoHighlight = tenant.id === 'tenant-stage7-platform-action'
                    ? {
                        label: '阶段七平台租户操作样本',
                        testId: `stage9-demo-sample-platform-tenant-${tenant.id}`,
                      }
                    : undefined;
                  return (
                    <ResponsiveSummaryCard
                      key={tenant.id}
                      ariaLabel={`${tenant.name} 租户摘要`}
                      title={tenant.name}
                      meta={tenant.plan}
                      status={tenant.status}
                      selected={selectedPlatformTenantId === tenant.id}
                      demoHighlight={platformTenantDemoHighlight}
                      facts={[
                        { label: '功能开关', value: tenant.features.join('、') || '未启用' },
                        { label: '用户上限', value: `${tenant.userLimit}` },
                      ]}
                      detailButton="detail"
                      onSelectDetail={() => setSelectedPlatformTenantId(tenant.id)}
                    />
                  );
                })}
              >
                <table className="min-w-[860px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3">企业</th>
                      <th className="px-4 py-3">套餐</th>
                      <th className="px-4 py-3">状态</th>
                      <th className="px-4 py-3">功能开关</th>
                      <th className="px-4 py-3 text-right">用户上限</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {platformTenants.map((tenant) => {
                      const platformTenantDemoHighlight = tenant.id === 'tenant-stage7-platform-action'
                        ? {
                            label: '阶段七平台租户操作样本',
                            testId: `stage9-demo-sample-platform-tenant-desktop-${tenant.id}`,
                          }
                        : undefined;
                      return (
                        <tr
                          key={tenant.id}
                          className={platformTenantDemoHighlight ? 'bg-sky-50' : undefined}
                        >
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <DetailToggleButton
                                selected={selectedPlatformTenantId === tenant.id}
                                onClick={() => setSelectedPlatformTenantId(tenant.id)}
                                compact
                              />
                              <div className="min-w-0">
                                <DemoSampleHighlightBadge demoHighlight={platformTenantDemoHighlight} />
                                <span className="font-bold text-slate-900">{tenant.name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{tenant.plan}</td>
                          <td className="px-4 py-4">
                            <StatusPill label={tenant.status} />
                          </td>
                          <td className="px-4 py-4 text-slate-600">{tenant.features.join('、') || '未启用'}</td>
                          <td className="px-4 py-4 text-right font-mono font-bold">{tenant.userLimit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
              <PlatformTenantDetailPanel tenant={selectedPlatformTenant} />
            </div>
          </Panel>
        </>
      )}

      {activeModule === 'reviews' && (
        <>
          <PlatformOperationSummaryPanel
            buyerCount={buyerCount}
            supplierCount={supplierCount}
            pendingTenantCount={pendingTenantCount}
            activeTenantCount={operationSummary?.activeTenantCount ?? platformTenants.filter((tenant) => tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用').length}
            announcementCount={operationSummary?.activeAnnouncementCount ?? announcements.length}
            enterpriseReviews={enterpriseReviews}
          />
          <PlatformEnterpriseReviewSummaryPanel enterpriseReviews={enterpriseReviews} />
          <PlatformEnterpriseReviewActionPanel
            enterpriseReviews={enterpriseReviews}
            reviewBusyId={platformReviewBusyId}
            onReviewEnterprise={handleReviewEnterprise}
          />
          {javaEnabled && workflowStatus && (
            <FeedbackNotice message={workflowStatus} />
          )}
          <Panel title="企业审核" icon={ClipboardCheck}>
            <ListToolbar
              title="企业审核池"
              recordCount={enterpriseReviews.length}
              filterLabel="待审核优先"
              actionLabel="批量审核"
            />
            <FilterResultSummary
              label="企业审核筛选结果"
              filterLabel="全部状态"
              resultCount={enterpriseReviews.length}
              totalCount={enterpriseReviews.length}
              selectedLabel={selectedPlatformReviewId}
              onClear={() => setSelectedPlatformReviewId(enterpriseReviews[0]?.id ?? '')}
            />
            <SelectedBusinessHandoffPanel
              moduleLabel="企业审核"
              selectedTitle={selectedPlatformReview?.name}
              selectedMeta={selectedPlatformReview ? formatEnterpriseType(selectedPlatformReview.type) : undefined}
              selectedStatus={selectedPlatformReview?.status}
              nextActionTitle={describePlatformReviewNextAction(selectedPlatformReview)}
              detailHint="右侧详情会核对入驻资料、资料确认、风险确认、审核轨迹和处理建议。"
              boundaryHint="平台只做企业身份准入审核，不参与采购方私域供应商评价和后续定标。"
            />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-3">
                {enterpriseReviews.map((review) => (
                  <PlatformEnterpriseReviewCard
                    key={review.id}
                    review={review}
                    selected={selectedPlatformReviewId === review.id}
                    onSelectDetail={() => setSelectedPlatformReviewId(review.id)}
                  />
                ))}
              </div>
              <PlatformEnterpriseReviewDetailPanel review={selectedPlatformReview} />
            </div>
          </Panel>
        </>
      )}

      {activeModule === 'announcements' && (
        <>
          <PlatformOperationSummaryPanel
            buyerCount={buyerCount}
            supplierCount={supplierCount}
            pendingTenantCount={pendingTenantCount}
            activeTenantCount={operationSummary?.activeTenantCount ?? platformTenants.filter((tenant) => tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用').length}
            announcementCount={operationSummary?.activeAnnouncementCount ?? announcements.length}
            enterpriseReviews={enterpriseReviews}
          />
          <PlatformAnnouncementSummaryPanel announcements={announcements} />
          <PlatformAnnouncementPublishPanel
            publishBusy={announcementPublishBusy}
            onPublishAnnouncement={handlePublishAnnouncement}
          />
          <PlatformAnnouncementLifecyclePanel
            announcement={selectedPlatformAnnouncement}
            javaEnabled={javaEnabled}
            announcementLifecycleBusyId={announcementLifecycleBusyId}
            onUpdateAnnouncement={handleUpdateAnnouncement}
            onWithdrawAnnouncement={handleWithdrawAnnouncement}
          />
          {javaEnabled && workflowStatus && (
            <FeedbackNotice message={workflowStatus} />
          )}
          <Panel title="平台公告" icon={Bell}>
            <ListToolbar
              title="公告发布池"
              recordCount={announcements.length}
              filterLabel="已发布公告"
              actionLabel="发布公告"
            />
            <FilterResultSummary
              label="平台公告筛选结果"
              filterLabel="全部状态"
              resultCount={announcements.length}
              totalCount={announcements.length}
              selectedLabel={selectedPlatformAnnouncementId}
              onClear={() => setSelectedPlatformAnnouncementId(announcements[0]?.id ?? '')}
            />
            <SelectedBusinessHandoffPanel
              moduleLabel="平台公告"
              selectedTitle={selectedPlatformAnnouncement?.title}
              selectedMeta={selectedPlatformAnnouncement ? formatAuditTime(selectedPlatformAnnouncement.publishedAt) : undefined}
              selectedStatus={selectedPlatformAnnouncement ? '已发布' : undefined}
              nextActionTitle={describePlatformAnnouncementNextAction(selectedPlatformAnnouncement)}
              detailHint="公告生命周期面板会核对标题、正文、发布范围、站内通知和撤回审计。"
              boundaryHint="公告只影响平台通知和运营触达，不变更采购方业务单据、供应商报价或财务状态。"
            />
            <div className="space-y-3">
              {platformAnnouncements.map((announcement) => (
                <PlatformAnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  selected={selectedPlatformAnnouncementId === announcement.id}
                  onSelectDetail={() => setSelectedPlatformAnnouncementId(announcement.id)}
                />
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
};

const PlatformAnnouncementLifecyclePanel: React.FC<{
  announcement?: PlatformAnnouncement;
  javaEnabled: boolean;
  announcementLifecycleBusyId: string | null;
  onUpdateAnnouncement: (
    announcementId: string,
    payload: { title: string; content: string; targetScope: string },
  ) => Promise<void> | void;
  onWithdrawAnnouncement: (announcementId: string) => Promise<void> | void;
}> = ({
  announcement,
  javaEnabled,
  announcementLifecycleBusyId,
  onUpdateAnnouncement,
  onWithdrawAnnouncement,
}) => {
  const [editableAnnouncementTitle, setEditableAnnouncementTitle] = useState(announcement?.title ?? '');
  const [editableAnnouncementContent, setEditableAnnouncementContent] = useState(announcement?.content ?? '');
  const [editableAnnouncementScope, setEditableAnnouncementScope] = useState(announcement?.targetScope ?? 'all');
  const updateBusy = Boolean(announcement && announcementLifecycleBusyId === `update:${announcement.id}`);
  const withdrawBusy = Boolean(announcement && announcementLifecycleBusyId === `withdraw:${announcement.id}`);
  const validAnnouncementScopes = ['all', 'buyer', 'supplier'];
  const editInvalid = editableAnnouncementTitle.trim().length === 0
    || editableAnnouncementContent.trim().length === 0
    || !validAnnouncementScopes.includes(editableAnnouncementScope);

  useEffect(() => {
    setEditableAnnouncementTitle(announcement?.title ?? '');
    setEditableAnnouncementContent(announcement?.content ?? '');
    setEditableAnnouncementScope(announcement?.targetScope ?? 'all');
  }, [announcement?.id, announcement?.title, announcement?.content, announcement?.targetScope]);

  return (
    <section className="rounded-lg border border-violet-100 bg-violet-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-violet-700">公告生命周期</p>
          <h3 className="mt-1 text-base font-black text-slate-950">
            {announcement ? announcement.title : '请选择公告'}
          </h3>
          <p className="mt-1 text-xs font-bold leading-5 text-violet-700">
            {javaEnabled
              ? 'Java 模式下可保存公告修改和撤回公告，并同步审计留痕。'
              : 'Mock 模式仅更新页面草稿，不影响真实公告发布状态。'}
          </p>
        </div>
        <StatusPill label={announcement ? '已发布' : '未选择'} />
      </div>

      {announcement ? (
        <>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-white bg-white p-3">
              <p className="text-xs font-black text-slate-700">编辑草稿</p>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">公告标题</span>
                  <input
                    data-testid={`stage7-platform-edit-announcement-title-${announcement.id}`}
                    value={editableAnnouncementTitle}
                    onChange={(event) => setEditableAnnouncementTitle(event.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">公告正文</span>
                  <textarea
                    data-testid={`stage7-platform-edit-announcement-content-${announcement.id}`}
                    value={editableAnnouncementContent}
                    onChange={(event) => setEditableAnnouncementContent(event.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold leading-6 text-slate-800 outline-none focus:border-violet-400"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-black text-slate-500">发布范围</span>
                  <select
                    data-testid={`stage7-platform-edit-announcement-scope-${announcement.id}`}
                    value={editableAnnouncementScope}
                    onChange={(event) => setEditableAnnouncementScope(event.target.value)}
                    className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-violet-400"
                  >
                    <option value="all">全部企业</option>
                    <option value="buyer">采购方企业</option>
                    <option value="supplier">供应商企业</option>
                  </select>
                </label>
                <PrimaryActionButton
                  onClick={() => onUpdateAnnouncement(announcement.id, {
                    title: editableAnnouncementTitle.trim(),
                    content: editableAnnouncementContent.trim(),
                    targetScope: editableAnnouncementScope,
                  })}
                  disabled={editInvalid || updateBusy}
                  busy={updateBusy}
                  pendingLabel="保存中"
                  fullWidth
                  testId={`stage7-platform-update-announcement-${announcement.id}`}
                >
                  保存公告修改
                </PrimaryActionButton>
              </div>
            </div>

            <div className="rounded-lg border border-white bg-white p-3">
              <p className="text-xs font-black text-slate-700">撤回公告</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="影响范围" value={formatAnnouncementScope(announcement.targetScope)} />
                <MiniFact label="站内通知" value="需同步撤回提醒" />
                <MiniFact label="审计留痕" value="记录撤回人和原因" />
                <MiniFact label="发布时间" value={formatAuditTime(announcement.publishedAt)} />
              </div>
              <PrimaryActionButton
                onClick={() => onWithdrawAnnouncement(announcement.id)}
                disabled={withdrawBusy}
                busy={withdrawBusy}
                pendingLabel="撤回中"
                tone="red"
                fullWidth
                testId={`stage7-platform-withdraw-announcement-${announcement.id}`}
              >
                撤回公告
              </PrimaryActionButton>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-violet-100 bg-white p-3">
            <CapabilityList
              items={[
                '编辑草稿用于复核标题、正文和发布范围，保存后刷新公告列表。',
                '撤回公告需要同步站内通知，并沉淀平台公告审计留痕。',
                '公告生命周期不影响采购方业务数据，只影响公告可见性。',
              ]}
            />
          </div>
        </>
      ) : (
        <EmptyState title="暂无公告可维护" desc="发布公告后，可在这里查看编辑草稿、撤回公告和影响范围。" />
      )}
    </section>
  );
};

const PlatformAnnouncementPublishPanel: React.FC<{
  publishBusy: boolean;
  onPublishAnnouncement: (payload: { title: string; content: string; targetScope: string }) => Promise<void> | void;
}> = ({ publishBusy, onPublishAnnouncement }) => {
  const [title, setTitle] = useState('平台维护窗口通知');
  const [content, setContent] = useState('平台将在周五晚间进行采购协同服务维护，期间询价、报价和订单确认能力正常可用。');
  const [targetScope, setTargetScope] = useState('all');
  const validAnnouncementScopes = ['all', 'buyer', 'supplier'];
  const announcementTitleInvalid = title.trim().length === 0;
  const announcementContentInvalid = content.trim().length === 0;
  const announcementScopeInvalid = !validAnnouncementScopes.includes(targetScope);
  const announcementPublishInvalid = announcementTitleInvalid || announcementContentInvalid || announcementScopeInvalid;
  const publishAnnouncement = () => {
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (announcementPublishInvalid) {
      return;
    }
    onPublishAnnouncement({ title: nextTitle, content: nextContent, targetScope });
    setTitle('');
    setContent('');
    setTargetScope('all');
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-700">发布平台公告</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Java 模式下持久化发布公告，mock 模式保留本地发布预览。</p>
        </div>
        <Bell size={18} className="text-green-600" />
      </div>
      <form
        className="mt-4 grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(260px,1.2fr)_180px_auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          publishAnnouncement();
        }}
      >
        <label className="block">
          <span className="text-xs font-black text-slate-500">公告标题</span>
          <input
            data-testid="stage7-platform-announcement-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-green-400"
            placeholder="请输入公告标题"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">公告正文</span>
          <textarea
            data-testid="stage7-platform-announcement-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className="mt-2 min-h-10 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-green-400"
            placeholder="请输入公告正文"
            rows={2}
          />
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">发布范围</span>
          <select
            data-testid="stage7-platform-announcement-scope"
            value={targetScope}
            onChange={(event) => setTargetScope(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-green-400"
          >
            <option value="all">全部企业</option>
            <option value="buyer">采购方企业</option>
            <option value="supplier">供应商企业</option>
          </select>
        </label>
        {announcementPublishInvalid && (
          <div aria-live="polite" className="space-y-2 lg:col-span-4">
            {announcementTitleInvalid && (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                请填写公告标题后再发布。
              </p>
            )}
            {announcementContentInvalid && (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                请填写公告正文后再发布。
              </p>
            )}
            {announcementScopeInvalid && (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                请选择有效发布范围。
              </p>
            )}
          </div>
        )}
        <PrimaryActionButton
          onClick={publishAnnouncement}
          disabled={announcementPublishInvalid || publishBusy}
          busy={publishBusy}
          pendingLabel="发布中"
          tone="emerald"
          size="md"
          flushTop
          testId="stage7-platform-publish-announcement"
        >
          发布公告
        </PrimaryActionButton>
      </form>
    </section>
  );
};

const formatAnnouncementScope = (scope: string) => {
  if (scope === 'all') {
    return '全部企业';
  }
  if (scope === 'buyer') {
    return '采购方企业';
  }
  if (scope === 'supplier') {
    return '供应商企业';
  }
  return scope;
};

const PlatformAnnouncementCard: React.FC<{
  announcement: PlatformAnnouncement;
  selected: boolean;
  onSelectDetail: () => void;
}> = ({ announcement, selected, onSelectDetail }) => (
  <ReadonlyDetailCardSurface
    title={announcement.title}
    selected={selected}
    demoHighlight={announcement.id === 'announcement-stage7-platform-withdraw-ready'
      ? {
          label: '阶段七可撤回公告样本',
          testId: `stage9-demo-sample-platform-announcement-${announcement.id}`,
        }
      : undefined}
  >
    <DetailHeroCard
      eyebrow="平台公告"
      title={`公告明细卡片 ${announcement.title}`}
      meta={`公告编号 ${announcement.id}`}
      status="已发布"
      facts={[
        { label: '公告编号', value: announcement.id },
        { label: '发布范围', value: formatAnnouncementScope(announcement.targetScope) },
        { label: '发布时间', value: formatAuditTime(announcement.publishedAt) },
        { label: '发布状态', value: '已发布' },
      ]}
    />
    <DetailSelectionSurface
      title={announcement.title}
      selected={selected}
      onSelectDetail={onSelectDetail}
      testId={`stage7-platform-select-announcement-${announcement.id}`}
    />
    <DetailSection title="公告正文">
      <p className="break-words text-sm font-bold leading-6 text-slate-700">{announcement.content}</p>
    </DetailSection>
  </ReadonlyDetailCardSurface>
);

const PlatformAnnouncementSummaryPanel: React.FC<{
  announcements: Array<{ targetScope: string; publishedAt: string }>;
}> = ({ announcements }) => {
  const publishedAnnouncementCount = announcements.length;
  const scopeCount = new Set(announcements.map((announcement) => announcement.targetScope)).size;
  const latestAnnouncement = announcements
    .slice()
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))[0];
  const latestPublishedAt = latestAnnouncement ? formatAuditTime(latestAnnouncement.publishedAt) : '暂无';
  const nextAction = publishedAnnouncementCount > 0 ? '维护公告内容' : '发布平台公告';

  return (
    <section className="rounded-lg border border-green-100 bg-green-50 p-4">
      <p className="text-xs font-black text-green-800">公告发布摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="公告数量" value={`${announcements.length} 条`} />
        <MiniFact label="发布范围" value={`${scopeCount} 类`} />
        <MiniFact label="最近发布" value={latestPublishedAt} />
        <MiniFact label="已发布" value={`${publishedAnnouncementCount} 条`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </section>
  );
};

const PlatformEnterpriseReviewActionPanel: React.FC<{
  enterpriseReviews: PlatformEnterpriseReview[];
  reviewBusyId: string | null;
  onReviewEnterprise: (
    reviewId: string,
    result: 'approved' | 'rejected',
    draft: PlatformEnterpriseReviewDraft,
  ) => Promise<void> | void;
}> = ({ enterpriseReviews, reviewBusyId, onReviewEnterprise }) => {
  const pendingReviews = enterpriseReviews.filter((review) => review.status === '待审核');
  const reviewedResults = enterpriseReviews.filter((review) => review.status !== '待审核');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, PlatformEnterpriseReviewDraft>>({});
  const getReviewDraft = (review: PlatformEnterpriseReview): PlatformEnterpriseReviewDraft =>
    reviewDrafts[review.id] ?? {
      comment: `已核对 ${review.name} 入驻资料，按平台企业审核规则处理。`,
      profileConfirmed: false,
      riskConfirmed: false,
    };
  const updateReviewDraft = (reviewId: string, patch: Partial<PlatformEnterpriseReviewDraft>) => {
    const review = enterpriseReviews.find((item) => item.id === reviewId);
    if (!review) return;
    setReviewDrafts((current) => ({
      ...current,
      [reviewId]: {
        ...getReviewDraft(review),
        ...patch,
      },
    }));
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-700">审核操作</p>
          <p className="mt-1 text-xs font-bold text-slate-500">Java 模式下持久化审核结果，mock 模式保留本地状态预览。</p>
        </div>
        <ClipboardCheck size={18} className="text-amber-600" />
      </div>
      {pendingReviews.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="暂无待审核企业" desc="企业提交入驻资料后，平台审核任务会在这里显示。" />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingReviews.map((review) => {
            const approveBusy = reviewBusyId === `${review.id}:approved`;
            const rejectBusy = reviewBusyId === `${review.id}:rejected`;
            const draft = getReviewDraft(review);
            const reviewCommentInvalid = draft.comment.trim().length === 0;
            const reviewProfileInvalid = !draft.profileConfirmed;
            const reviewRiskInvalid = !draft.riskConfirmed;
            const enterpriseReviewInvalid = reviewCommentInvalid || reviewProfileInvalid || reviewRiskInvalid;

            return (
              <div key={review.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{review.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{review.type} · {review.industry}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PrimaryActionButton
                      onClick={() => onReviewEnterprise(review.id, 'approved', draft)}
                      disabled={approveBusy || rejectBusy || enterpriseReviewInvalid}
                      busy={approveBusy}
                      pendingLabel="审核中"
                      tone="emerald"
                      flushTop
                      testId={`stage7-platform-approve-review-${review.id}`}
                    >
                      通过审核
                    </PrimaryActionButton>
                    <PrimaryActionButton
                      onClick={() => onReviewEnterprise(review.id, 'rejected', draft)}
                      disabled={approveBusy || rejectBusy || enterpriseReviewInvalid}
                      busy={rejectBusy}
                      pendingLabel="审核中"
                      tone="red"
                      flushTop
                      testId={`stage7-platform-reject-review-${review.id}`}
                    >
                      驳回
                    </PrimaryActionButton>
                  </div>
                </div>
                <label className="mt-3 block text-xs font-black text-slate-600" htmlFor={`platform-review-comment-${review.id}`}>
                  审核意见
                  <textarea
                    id={`platform-review-comment-${review.id}`}
                    value={draft.comment}
                    onChange={(event) => updateReviewDraft(review.id, { comment: event.target.value })}
                    className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
                  />
                </label>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <label
                    htmlFor={`platform-review-profile-${review.id}`}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs font-bold text-slate-600"
                  >
                    <input
                      id={`platform-review-profile-${review.id}`}
                      data-testid={`stage7-platform-review-profile-${review.id}`}
                      type="checkbox"
                      checked={draft.profileConfirmed}
                      onChange={(event) => updateReviewDraft(review.id, { profileConfirmed: event.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-amber-600"
                    />
                    <span>企业入驻资料已核对</span>
                  </label>
                  <label
                    htmlFor={`platform-review-risk-${review.id}`}
                    className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800"
                  >
                    <input
                      id={`platform-review-risk-${review.id}`}
                      data-testid={`stage7-platform-review-risk-${review.id}`}
                      type="checkbox"
                      checked={draft.riskConfirmed}
                      onChange={(event) => updateReviewDraft(review.id, { riskConfirmed: event.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-amber-200 text-amber-600"
                    />
                    <span>风险与重复企业已复核</span>
                  </label>
                </div>
                {enterpriseReviewInvalid && (
                  <div aria-live="polite" className="mt-3 space-y-2">
                    {reviewCommentInvalid && (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                        请填写审核意见后再处理。
                      </p>
                    )}
                    {reviewProfileInvalid && (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                        请先确认企业入驻资料已核对。
                      </p>
                    )}
                    {reviewRiskInvalid && (
                      <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                        请先确认风险与重复企业已复核。
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {reviewedResults.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-700">最近审核结果</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {reviewedResults.length} 条
            </span>
          </div>
          <div className="space-y-2">
            {reviewedResults.map((review) => (
              <div key={`${review.id}:${review.status}`} className="rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-900">{review.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{formatEnterpriseType(review.type)} · {review.industry}</p>
                  </div>
                  <StatusPill label={review.status} />
                </div>
                <p className={`mt-2 text-xs font-bold ${review.status === '已驳回' ? 'text-red-600' : 'text-emerald-700'}`}>
                  {review.status === '已驳回' ? '等待重新提交' : '认证档案可维护'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const formatEnterpriseType = (type: string) => {
  if (type === 'buyer') {
    return '采购方企业';
  }
  if (type === 'supplier') {
    return '供应商企业';
  }
  return type;
};

const PlatformEnterpriseReviewDetailPanel: React.FC<{
  review?: PlatformEnterpriseReview;
}> = ({ review }) => {
  if (!review) {
    return (
      <Panel title="审核详情" icon={ClipboardCheck}>
        <EmptyState title="暂无审核详情" desc="选择一家入驻企业后，可查看入驻资料、风险检查、审核轨迹和处理建议。" />
      </Panel>
    );
  }

  const handlingAdvice = review.status === '待审核'
    ? '核对入驻资料并完成风险检查'
    : review.status === '已认证'
      ? '维护认证档案'
      : '等待企业重新提交资料';

  return (
    <Panel title="审核详情" icon={ClipboardCheck}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="审核详情"
          title={review.name}
          meta={`企业编号 ${review.id}`}
          status={review.status}
          facts={[
            { label: '企业类型', value: formatEnterpriseType(review.type) },
            { label: '所属行业', value: review.industry },
            { label: '审核状态', value: review.status },
            { label: '处理建议', value: handlingAdvice },
          ]}
        />

        <DetailSection title="入驻资料">
          <div className="space-y-2">
            <DetailKeyValueRow label="企业名称" value={review.name} />
            <DetailKeyValueRow label="企业类型" value={formatEnterpriseType(review.type)} />
            <DetailKeyValueRow label="所属行业" value={review.industry} />
            <DetailKeyValueRow label="资料状态" value={review.status === '待审核' ? '待平台核对' : '已进入审核记录'} />
          </div>
        </DetailSection>

        <DetailSection title="风险检查">
          <div className="space-y-2">
            <DetailKeyValueRow label="重复企业" value="需核对统一社会信用代码" />
            <DetailKeyValueRow label="黑名单风险" value="需核对平台公共企业档案" />
            <DetailKeyValueRow label="业务边界" value="平台只审核入驻，不参与采购业务决策" />
          </div>
        </DetailSection>

        <DetailSection title="审核轨迹">
          <div className="space-y-2">
            <DetailKeyValueRow label="当前状态" value={review.status} />
            <DetailKeyValueRow label="审核意见" value={review.reviewComment ?? '待填写'} />
            <DetailKeyValueRow label="资料确认" value={review.profileConfirmed ? '已确认' : '待确认'} />
            <DetailKeyValueRow label="风险确认" value={review.riskConfirmed ? '已确认' : '待确认'} />
            <DetailKeyValueRow label="审计动作" value="enterprise.reviewed" />
            <DetailKeyValueRow label="留痕对象" value={review.id} />
          </div>
        </DetailSection>

        <DetailSection title="处理建议">
          <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
            {handlingAdvice}
          </p>
        </DetailSection>
      </div>
    </Panel>
  );
};

const PlatformEnterpriseReviewCard: React.FC<{
  review: PlatformEnterpriseReview;
  selected: boolean;
  onSelectDetail: () => void;
}> = ({ review, selected, onSelectDetail }) => {
  const nextAction = review.status === '待审核'
    ? '处理企业审核'
    : review.status === '已驳回'
      ? '等待重新提交'
      : '维护认证档案';

  return (
    <ReadonlyDetailCardSurface
      title={review.name}
      selected={selected}
      demoHighlight={review.id === 'ent-stage7-platform-review-ready'
        ? {
            label: '阶段七企业审核样本',
            testId: `stage9-demo-sample-platform-review-${review.id}`,
          }
        : undefined}
    >
      <DetailHeroCard
        eyebrow="企业审核"
        title={`企业审核卡片 ${review.name}`}
        meta={`审核编号 ${review.id}`}
        status={review.status}
        facts={[
          { label: '企业类型', value: formatEnterpriseType(review.type) },
          { label: '所属行业', value: review.industry },
          { label: '审核状态', value: review.status },
          { label: '下一步', value: nextAction },
        ]}
        summaryFacts={[
          { label: '企业类型', value: formatEnterpriseType(review.type) },
          { label: '下一步', value: nextAction },
        ]}
      />
      <DetailSelectionSurface
        title={review.name}
        selected={selected}
        onSelectDetail={onSelectDetail}
      />
    </ReadonlyDetailCardSurface>
  );
};

const PlatformEnterpriseReviewSummaryPanel: React.FC<{
  enterpriseReviews: Array<{ type: string; status: string }>;
}> = ({ enterpriseReviews }) => {
  const pendingReviewCount = enterpriseReviews.filter((review) => review.status === '待审核').length;
  const verifiedReviewCount = enterpriseReviews.filter((review) => review.status === '已认证').length;
  const buyerEnterpriseCount = enterpriseReviews.filter((review) => review.type === 'buyer').length;
  const supplierEnterpriseCount = enterpriseReviews.filter((review) => review.type === 'supplier').length;
  const nextAction = pendingReviewCount > 0 ? '处理待审核企业' : '复核认证资料';

  return (
    <section className="rounded-lg border border-amber-100 bg-amber-50 p-4">
      <p className="text-xs font-black text-amber-800">企业审核摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="待审核" value={`${pendingReviewCount} 家`} />
        <MiniFact label="已认证" value={`${verifiedReviewCount} 家`} />
        <MiniFact label="采购方企业" value={`${buyerEnterpriseCount} 家`} />
        <MiniFact label="供应商企业" value={`${supplierEnterpriseCount} 家`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </section>
  );
};

const PlatformTenantActionPanel: React.FC<{
  tenants: PlatformTenantRow[];
  tenantBusyId: string | null;
  onUpdateTenantStatus: (tenantId: string, status: '已启用' | '停用') => void;
  onUpdateTenantPlan: (tenantId: string, plan: PlatformTenantRow['plan']) => void;
  onToggleTenantFeature: (tenantId: string, feature: 'rfq') => void;
}> = ({
  tenants,
  tenantBusyId,
  onUpdateTenantStatus,
  onUpdateTenantPlan,
  onToggleTenantFeature,
}) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black text-slate-700">租户操作</p>
        <p className="mt-1 text-xs font-bold text-slate-500">Java 模式下持久化租户操作，mock 模式保留本地状态预览。</p>
      </div>
      <Settings size={18} className="text-blue-600" />
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-2">
      {tenants.map((tenant) => {
        const rfqEnabled = tenant.features.includes('询价比价');
        const disabled = tenant.status === '停用';
        const enableBusy = tenantBusyId === `${tenant.id}:enable`;
        const disableBusy = tenantBusyId === `${tenant.id}:disable`;
        const planBusy = tenantBusyId === `${tenant.id}:plan`;
        const featureBusy = tenantBusyId === `${tenant.id}:feature:rfq`;
        const enableDisabled = !disabled || enableBusy || disableBusy;
        const disableDisabled = disabled || enableBusy || disableBusy;

        return (
          <div key={tenant.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{tenant.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{tenant.plan} · {tenant.userLimit} 人 · {tenant.features.join('、') || '未启用功能'}</p>
              </div>
              <StatusPill label={tenant.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                data-testid={`stage7-platform-enable-tenant-${tenant.id}`}
                onClick={() => onUpdateTenantStatus(tenant.id, '已启用')}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={enableDisabled}
              >
                {enableBusy ? '处理中' : '启用租户'}
              </button>
              <button
                type="button"
                data-testid={`stage7-platform-disable-tenant-${tenant.id}`}
                onClick={() => onUpdateTenantStatus(tenant.id, '停用')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={disableDisabled}
              >
                {disableBusy ? '处理中' : '停用租户'}
              </button>
              <button
                type="button"
                data-testid={`stage7-platform-upgrade-plan-${tenant.id}`}
                onClick={() => onUpdateTenantPlan(tenant.id, '专业版')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50"
                disabled={planBusy || featureBusy}
              >
                {planBusy ? '处理中' : '升级专业版'}
              </button>
              <button
                type="button"
                data-testid={`stage7-platform-toggle-rfq-${tenant.id}`}
                onClick={() => onToggleTenantFeature(tenant.id, 'rfq')}
                disabled={planBusy || featureBusy}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition ${
                  rfqEnabled
                    ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border border-green-200 bg-white text-green-700 hover:bg-green-50'
                }`}
              >
                {featureBusy ? '处理中' : '切换询价'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

const PlatformTenantDetailPanel: React.FC<{
  tenant?: PlatformTenantRow;
}> = ({ tenant }) => {
  if (!tenant) {
    return (
      <Panel title="租户详情" icon={Layers3}>
        <EmptyState title="暂无租户详情" desc="选择一个采购方租户后，可查看套餐容量、功能开关和审计上下文。" />
      </Panel>
    );
  }

  const featureItems = [
    { key: 'rfq', label: '询价比价', enabled: tenant.features.includes('询价比价') || tenant.enabledFeatures.includes('rfq') },
    { key: 'order', label: '订单履约', enabled: tenant.features.includes('订单履约') || tenant.enabledFeatures.includes('order') },
    { key: 'finance', label: '财务协同', enabled: tenant.features.includes('财务协同') || tenant.enabledFeatures.includes('finance') },
  ];

  return (
    <Panel title="租户详情" icon={Layers3}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="租户详情"
          title={tenant.name}
          meta={`租户编号 ${tenant.id}`}
          status={tenant.status}
          facts={[
            { label: '套餐容量', value: tenant.plan },
            { label: '用户上限', value: `${tenant.userLimit} 人` },
            { label: '功能开关', value: tenant.features.join('、') || '未启用' },
            { label: '租户状态', value: tenant.status },
          ]}
        />

        <DetailSection title="套餐容量">
          <div className="space-y-2">
            <DetailKeyValueRow label="当前套餐" value={tenant.plan} />
            <DetailKeyValueRow label="用户容量" value={`${tenant.userLimit} 人`} />
            <DetailKeyValueRow label="容量策略" value="创建采购方用户时按 userLimit 约束" />
          </div>
        </DetailSection>

        <DetailSection title="功能开关详情">
          <div className="space-y-2">
            {featureItems.map((feature) => (
              <div key={feature.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-900">{feature.label}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">feature key: {feature.key}</p>
                  </div>
                  <StatusPill label={feature.enabled ? '已启用' : '未启用'} />
                </div>
              </div>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="多租户数据隔离">
          <div className="space-y-2">
            <DetailKeyValueRow label="采购数据" value="需求、询价、订单、发票按租户隔离" />
            <DetailKeyValueRow label="供应商关系" value="采购方私域供应商库按租户隔离" />
            <DetailKeyValueRow label="数据边界" value="平台只维护租户配置，不参与业务定标" />
          </div>
        </DetailSection>

        <DetailSection title="审计动作">
          <div className="space-y-2">
            <DetailKeyValueRow label="套餐调整" value="tenant.plan_updated" />
            <DetailKeyValueRow label="功能开关" value="tenant.features.updated" />
            <DetailKeyValueRow label="启停租户" value="tenant.enabled / tenant.disabled" />
          </div>
        </DetailSection>
      </div>
    </Panel>
  );
};

const PlatformTenantListSummaryPanel: React.FC<{
  tenants: PlatformTenantRow[];
}> = ({ tenants }) => {
  const activeTenantCount = tenants.filter((tenant) => tenant.status === 'active' || tenant.status === '启用' || tenant.status === '已启用').length;
  const pendingTenantCount = tenants.filter((tenant) => tenant.status === '待审核').length;
  const userCapacity = tenants.reduce((sum, tenant) => sum + tenant.userLimit, 0);
  const planCount = new Set(tenants.map((tenant) => tenant.plan)).size;
  const nextAction = pendingTenantCount > 0 ? '审核租户入驻' : '维护套餐容量';

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-black text-slate-700">租户运营摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MiniFact label="租户总数" value={`${tenants.length} 家`} />
        <MiniFact label="启用租户" value={`${activeTenantCount} 家`} />
        <MiniFact label="待审核租户" value={`${pendingTenantCount} 家`} />
        <MiniFact label="用户容量" value={`${userCapacity} 人`} />
        <MiniFact label="套餐覆盖" value={`${planCount} 类`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </section>
  );
};

const PlatformOperationSummaryPanel: React.FC<{
  buyerCount: number;
  supplierCount: number;
  pendingTenantCount: number;
  activeTenantCount: number;
  announcementCount: number;
  enterpriseReviews: Array<{ status: string }>;
}> = ({
  buyerCount,
  supplierCount,
  pendingTenantCount,
  activeTenantCount,
  announcementCount,
  enterpriseReviews,
}) => {
  const reviewCount = enterpriseReviews.filter((review) => review.status === '待审核').length;
  const nextAction = reviewCount > 0 ? '处理企业审核' : '维护套餐与公告';

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <p className="text-xs font-black text-blue-800">平台运营摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MiniFact label="采购租户" value={`${buyerCount} 家`} />
        <MiniFact label="公共供应商" value={`${supplierCount} 家`} />
        <MiniFact label="待审核企业" value={`${pendingTenantCount} 个`} />
        <MiniFact label="启用套餐" value={`${activeTenantCount} 个`} />
        <MiniFact label="公告数量" value={`${announcementCount} 条`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </section>
  );
};

const BuyerWorkspaceView: React.FC<{
  activeModule: BuyerAdminModule;
  workspace: BuyerWorkspace;
  kpis: TenantKpis;
  pendingApprovals: JavaApprovalTaskDto[];
  recentApprovals: JavaApprovalTaskDto[];
  buyerNotifications: JavaNotificationDto[];
  approvalTemplates: JavaApprovalTemplateDto[];
  roles: BuyerRoleDto[];
  paymentBatches: PaymentBatchRecord[];
  paymentExecutionRecords: PaymentExecutionRecord[];
  paymentBlockResolutions: PaymentBlockResolutionRecord[];
  paymentArchiveExceptionRequests: PaymentArchiveExceptionRequestRecord[];
  paymentRequests: PaymentRequestRecord[];
  varianceHandlings: VarianceHandlingRecord[];
  auditLogs: AuditLogRecord[];
  searchQuery: string;
  approvalBusyId: string | null;
  demandCreateBusy: boolean;
  materialSaveBusyId: string | null;
  demandSubmitBusyId: string | null;
  demandUpdateBusyId: string | null;
  supplierAdmissionBusyId: string | null;
  supplierRelationBusyId: string | null;
  rfqCreateBusy: string | null;
  rfqUpdateBusyId: string | null;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  orderUpdateBusyId: string | null;
  invoiceUpdateBusyId: string | null;
  buyerFulfillmentBusyId: string | null;
  notificationReadBusyId: string | null;
  contractAttachmentsById: Record<string, AttachmentRecord[]>;
  contractAttachmentUploadTicketsById: Record<string, AttachmentUploadTicketRecord>;
  contractAttachmentDownloadLinksById: Record<string, AttachmentDownloadLinkRecord>;
  contractFulfillmentEventsById: Record<string, ContractFulfillmentEventRecord[]>;
  contractTargetAuditLogsById: Record<string, AuditLogRecord[]>;
  javaEnabled: boolean;
  workflowStatus: string | null;
  onFocusBuyerKeyAction: (actionLabel: string) => void;
  onNavigateBuyerModule: (moduleId: BuyerAdminModule) => void;
  onCreateDemand: (payload: CreateDemandPayload, submitForApproval: boolean) => void;
  onSaveMaterial: (materialId: string | null, payload: SaveMaterialPayload) => void;
  onSubmitDemand: (demandId: string) => void;
  onUpdateDemand: (demandId: string, payload: UpdateDemandPayload) => void;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft) => void;
  onSubmitSupplierAdmission: (relationId: string, draft: BuyerSupplierAdmissionDraft) => void;
  onCreateSupplierRelation: (payload: CreateBuyerSupplierRelationPayload) => void;
  onSaveSupplierRelationProfile: (relationId: string, payload: UpdateBuyerSupplierProfilePayload) => void;
  onSaveSupplierRelationStatus: (relationId: string, status: string) => void;
  onSaveSupplierRelationPerformance: (relationId: string, performanceScore: number) => void;
  onCreateRfqFromDemand: (demandId: string, supplierIds?: string[], deadline?: string) => void;
  onUpdateRfq: (rfqId: string, payload: UpdateRfqPayload) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
  onUpdateOrder: (orderId: string, payload: UpdateOrderPayload) => void;
  onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void;
  onRegisterPayment: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onRegisterPaymentExecutionRecord: (executionRecordId: string) => void;
  onCreatePaymentRequest: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onCreateVarianceHandling: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onUpdatePaymentRequestStatus: (paymentRequestId: string, status: string) => void;
  onUpdatePaymentBatchStatus: (paymentBatchNo: string, status: string) => void;
  onCreatePaymentArchiveExceptionRequest: (paymentBatchNo: string, exceptionType: string, exceptionReason: string) => void;
  onCompletePaymentArchiveExceptionAction: (requestId: string, actionResult: string) => void;
  onClosePaymentArchiveExceptionRequest: (requestId: string, closureResult: string) => void;
  onSavePaymentBlockResolutionStatus: (payload: BuyerPaymentBlockResolutionDraft) => void;
  onUpdateVarianceHandlingStatus: (varianceHandlingId: string, status: string) => void;
  onRebuildThreeWayMatches: () => void;
  onUpdateInvoice: (invoiceId: string, payload: UpdateInvoicePayload) => void;
  onSaveContract: (mode: 'create' | 'update', contractId: string | null, draft: BuyerContractDraft) => void;
  onSubmitContractApproval: (contractId: string) => void;
  onLoadContractAttachments: (contractId: string) => void;
  onCreateContractAttachment: (
    contractId: string,
    payload: Omit<CreateAttachmentPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateContractAttachmentUploadTicket: (
    contractId: string,
    payload: Omit<CreateAttachmentUploadTicketPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateContractAttachmentDownloadLink: (attachmentId: string) => void;
  onLoadContractFulfillmentEvents: (contractId: string) => void;
  onLoadContractTargetAuditLogs: (contractId: string) => void;
  onCreateContractFulfillmentEvent: (
    contractId: string,
    payload: CreateContractFulfillmentEventPayload,
  ) => void;
  onUpdateContractStatus: (contractId: string, status: string, fulfillmentProgress: string) => void;
  onArchiveContract: (contractId: string) => void;
  onUpdateApprovalTemplate: (
    templateCode: string,
    defaultApproverRoleId: string,
    status: 'active' | 'inactive',
  ) => void;
  onMarkBuyerNotificationRead: (notificationId: string) => void;
}> = ({
  activeModule,
  workspace,
  kpis,
  pendingApprovals,
  recentApprovals,
  buyerNotifications,
  approvalTemplates,
  roles,
  paymentBatches,
  paymentExecutionRecords,
  paymentBlockResolutions,
  paymentArchiveExceptionRequests,
  paymentRequests,
  varianceHandlings,
  auditLogs,
  searchQuery,
  approvalBusyId,
  demandCreateBusy,
  materialSaveBusyId,
  demandSubmitBusyId,
  demandUpdateBusyId,
  supplierAdmissionBusyId,
  supplierRelationBusyId,
  rfqCreateBusy,
  rfqUpdateBusyId,
  awardSubmitBusyId,
  orderCreateBusy,
  orderUpdateBusyId,
  invoiceUpdateBusyId,
  buyerFulfillmentBusyId,
  notificationReadBusyId,
  contractAttachmentsById,
  contractAttachmentUploadTicketsById,
  contractAttachmentDownloadLinksById,
  contractFulfillmentEventsById,
  contractTargetAuditLogsById,
  javaEnabled,
  workflowStatus,
  onFocusBuyerKeyAction,
  onNavigateBuyerModule,
  onCreateDemand,
  onSaveMaterial,
  onSubmitDemand,
  onUpdateDemand,
  onReviewApproval,
  onSubmitSupplierAdmission,
  onCreateSupplierRelation,
  onSaveSupplierRelationProfile,
  onSaveSupplierRelationStatus,
  onSaveSupplierRelationPerformance,
  onCreateRfqFromDemand,
  onUpdateRfq,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
  onUpdateOrder,
  onCreateReceipt,
  onRegisterPayment,
  onRegisterPaymentExecutionRecord,
  onCreatePaymentRequest,
  onCreateVarianceHandling,
  onUpdatePaymentRequestStatus,
  onUpdatePaymentBatchStatus,
  onCreatePaymentArchiveExceptionRequest,
  onCompletePaymentArchiveExceptionAction,
  onClosePaymentArchiveExceptionRequest,
  onSavePaymentBlockResolutionStatus,
  onUpdateVarianceHandlingStatus,
  onRebuildThreeWayMatches,
  onUpdateInvoice,
  onSaveContract,
  onSubmitContractApproval,
  onLoadContractAttachments,
  onCreateContractAttachment,
  onCreateContractAttachmentUploadTicket,
  onCreateContractAttachmentDownloadLink,
  onLoadContractFulfillmentEvents,
  onLoadContractTargetAuditLogs,
  onCreateContractFulfillmentEvent,
  onUpdateContractStatus,
  onArchiveContract,
  onUpdateApprovalTemplate,
  onMarkBuyerNotificationRead: markBuyerNotificationRead,
}) => {
  const [selectedDemandId, setSelectedDemandId] = useState(workspace.demands[0]?.id ?? '');
  const [selectedRfqId, setSelectedRfqId] = useState(workspace.rfqs[0]?.id ?? '');
  const [selectedOrderId, setSelectedOrderId] = useState(workspace.orders[0]?.id ?? '');
  const [selectedContractId, setSelectedContractId] = useState(workspace.orders[0] ? `contract-${workspace.orders[0].id}` : '');
  const [selectedSupplierRelationId, setSelectedSupplierRelationId] = useState(workspace.privateSupplierRelations[0]?.id ?? '');
  const [selectedMaterialId, setSelectedMaterialId] = useState(workspace.materials[0]?.id ?? '');
  const [selectedApprovalId, setSelectedApprovalId] = useState('');
  const [selectedReceiptOrderId, setSelectedReceiptOrderId] = useState(workspace.orders.find((order) => order.status === '已发货' || order.status === '待收货')?.id ?? '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(workspace.invoices[0]?.id ?? '');
  const [contractTargetFocus, setContractTargetFocus] = useState<BuyerContractTargetFocus | null>(null);
  const [contractLinkedActionResult, setContractLinkedActionResult] = useState<BuyerContractLinkedActionResult | null>(null);
  const [approvalReviewDrafts, setApprovalReviewDrafts] = useState<Record<string, BuyerApprovalReviewDraft>>({});
  const [supplierAdmissionDrafts, setSupplierAdmissionDrafts] = useState<Record<string, BuyerSupplierAdmissionDraft>>({});
  const [awardDrafts, setAwardDrafts] = useState<Record<string, BuyerAwardDraft>>({});
  const [orderDrafts, setOrderDrafts] = useState<Record<string, BuyerOrderDraft>>({});
  const [receiptDrafts, setReceiptDrafts] = useState<Record<string, BuyerReceiptDraft>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, BuyerPaymentDraft>>({});
  const [demandStatusFilter, setDemandStatusFilter] = useState('全部状态');
  const [rfqStatusFilter, setRfqStatusFilter] = useState('全部状态');
  const [orderStatusFilter, setOrderStatusFilter] = useState('全部状态');
  const [contractStatusFilter, setContractStatusFilter] = useState('全部状态');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState('全部状态');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('全部状态');
  const [reconciliationLedgerStatusFilter, setReconciliationLedgerStatusFilter] = useState('全部状态');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('全部状态');
  const [supplierStatusFilter, setSupplierStatusFilter] = useState('全部状态');
  const [materialStatusFilter, setMaterialStatusFilter] = useState('全部状态');
  const defaultExpectedReceiptDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  };
  const getAwardDraft = (rfqId: string): BuyerAwardDraft =>
    awardDrafts[rfqId] ?? { reason: '系统推荐：报价金额最低，交付周期优先' };
  const getOrderDraft = (awardId: string): BuyerOrderDraft =>
    orderDrafts[awardId] ?? { expectedReceiptDate: defaultExpectedReceiptDate() };
  const getSupplierAdmissionDraft = (
    relation: BuyerWorkspace['privateSupplierRelations'][number],
  ): BuyerSupplierAdmissionDraft => supplierAdmissionDrafts[relation.id] ?? {
    reason: `申请将该供应商纳入私域供应商库，授权品类：${relation.categories.join('、') || '待补充'}`,
    qualificationSummary: '已核对营业执照、授权代理资质、近一年合作记录和基础履约能力。',
    contactName: '供应商业务联系人',
    contactPhone: '13800000000',
    categoryConfirmed: false,
    riskConfirmed: false,
  };
  const getApprovalReviewDraft = (approval: JavaApprovalTaskDto): BuyerApprovalReviewDraft =>
    approvalReviewDrafts[approval.id] ?? {
      comment: `已核对${approvalTypeLabel(approval.bizType)}上下文，同意按当前业务状态处理。`,
      confirmed: false,
    };
  const getReceiptDraft = (orderId: string): BuyerReceiptDraft => receiptDrafts[orderId] ?? {
    result: '验收通过',
    receiptRemark: '数量、外观和包装已完成现场核验。',
    exceptionReason: '',
    attachmentNames: '收货照片.jpg\n验收单.pdf',
  };
  const getPaymentDraft = (invoiceId: string): BuyerPaymentDraft => paymentDrafts[invoiceId] ?? {
    paymentStatus: '已付款',
    paymentRemark: '已完成付款登记，付款凭证待附件中心接入后补充。',
    paymentRequestStatus: '付款申请已通过',
    reconciliationNote: '订单、收货、发票金额一致，满足三单匹配。',
  };
  const updateReceiptDraft = (orderId: string, draft: Partial<BuyerReceiptDraft>) => {
    setReceiptDrafts((current) => ({
      ...current,
      [orderId]: { ...(current[orderId] ?? getReceiptDraft(orderId)), ...draft },
    }));
  };
  const updatePaymentDraft = (invoiceId: string, draft: Partial<BuyerPaymentDraft>) => {
    setPaymentDrafts((current) => ({
      ...current,
      [invoiceId]: { ...(current[invoiceId] ?? getPaymentDraft(invoiceId)), ...draft },
    }));
  };
  const sortedPendingApprovals = [...pendingApprovals].sort((left, right) => {
    const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
  const sortedRecentApprovals = [...recentApprovals].sort((left, right) => {
    const leftTime = new Date(left.actedAt ?? left.createdAt).getTime();
    const rightTime = new Date(right.actedAt ?? right.createdAt).getTime();
    return rightTime - leftTime;
  });
  const sortedBuyerNotifications = [...buyerNotifications]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 6);
  const linkedDemandIds = new Set(workspace.rfqs.flatMap((rfq) => rfq.demandIds));
  const admittedSupplierCountForRfq = workspace.privateSupplierRelations
    .filter((relation) => relation.status === '已准入')
    .length;
  const demandToRfqReadyCount = workspace.demands.filter((demand) => (
    demand.status === '已通过'
    && !linkedDemandIds.has(demand.id)
    && admittedSupplierCountForRfq > 0
  )).length;
  const demandToRfqLinkedCount = workspace.demands.filter((demand) => linkedDemandIds.has(demand.id)).length;
  const demandToRfqApprovalBlockedCount = workspace.demands.filter((demand) => demand.status !== '已通过').length;
  const demandToRfqSupplierBlockedCount = workspace.demands.filter((demand) => (
    demand.status === '已通过'
    && !linkedDemandIds.has(demand.id)
    && admittedSupplierCountForRfq === 0
  )).length;
  const displayPendingApprovals = javaEnabled ? sortedPendingApprovals : buildWorkspaceApprovalQueue(workspace);
  const moduleFacts = buildBuyerModuleFacts(activeModule, workspace, displayPendingApprovals);
  const approvalQueueRows = buildApprovalQueueRows(displayPendingApprovals);
  const allApprovalSources = [...displayPendingApprovals, ...sortedRecentApprovals];
  const selectedApproval = allApprovalSources.some((approval) => (approval.id ?? `${approval.bizType}:${approval.bizId}`) === selectedApprovalId)
    ? selectedApprovalId
    : allApprovalSources[0]?.id ?? '';
  const selectedApprovalDetail = selectedApproval
    ? buildApprovalDetailPanel(workspace, displayPendingApprovals, sortedRecentApprovals, selectedApproval)
    : undefined;
  const selectedApprovalSource = allApprovalSources.find((approval) =>
    (approval.id ?? `${approval.bizType}:${approval.bizId}`) === selectedApproval);
  const supplierRelationRows = buildSupplierRelationRows(workspace);
  const rfqListRows = buildRfqListRows(workspace);
  const orderFulfillmentRows = buildOrderFulfillmentRows(workspace);
  const contractLedgerRows = buildContractLedgerRows(workspace);
  const receiptInspectionRows = buildReceiptInspectionRows(workspace);
  const invoicePaymentRows = buildInvoicePaymentRows(workspace);
  const updatePaymentBatchStatus = onUpdatePaymentBatchStatus;
  const demandListRows = buildDemandListRows(workspace);
  const materialRows = buildMaterialCatalogRows(workspace);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchesSearchQuery = (values: Array<string | number | undefined>) =>
    !normalizedSearchQuery
    || values.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearchQuery));
  const demandMatches = (demandId: string, extraValues: Array<string | number | undefined> = []) => {
    const demand = workspace.demands.find((item) => item.id === demandId);
    return matchesSearchQuery([
      demand?.id,
      demand?.title,
      demand?.status,
      demand?.department,
      demand?.requester,
      ...(demand?.lineItems.map((lineItem) => {
        const material = workspace.materials.find((item) => item.id === lineItem.materialId);
        return material?.name ?? lineItem.materialId;
      }) ?? []),
      ...extraValues,
    ]);
  };
  const filteredApprovalQueueRows = approvalQueueRows.filter((row) =>
    (approvalStatusFilter === '全部状态' || row.status === approvalStatusFilter)
    && matchesSearchQuery([
    row.id,
    row.title,
    row.typeLabel,
    row.status,
    ...row.facts.map((fact) => fact.value),
  ]));
  const displayedApprovalQueueRows = limitBuyerDemoRows(
    filteredApprovalQueueRows,
    (row) => row.id === 'approval-stage7-demand-pending',
  );
  const filteredRecentApprovals = sortedRecentApprovals.filter((approval) =>
    (approvalStatusFilter === '全部状态' || approval.status === approvalStatusFilter)
    && matchesSearchQuery([
    approval.id,
    approval.bizId,
    approval.parentBizId,
    approval.summaryTitle,
    approval.status,
    approval.bizType,
  ]));
  const filteredBuyerNotifications = sortedBuyerNotifications.filter((notification) => matchesSearchQuery([
    notification.id,
    notification.title,
    notification.content,
    notification.type,
  ]));
  const buyerMessageCenterNotifications = sortedBuyerNotifications;
  const filteredDemandListRows = demandListRows.filter((demandRow) =>
    (demandStatusFilter === '全部状态' || demandRow.status === demandStatusFilter)
    && demandMatches(demandRow.id, [
    demandRow.title,
    demandRow.status,
    demandRow.materialSummary,
    ...demandRow.facts.map((fact) => fact.value),
  ]));
  const displayedDemandListRows = limitBuyerDemoRows(
    filteredDemandListRows,
    (row) => row.id === 'dem-stage7-submit-ready' || row.id === 'dem-stage7-rfq-ready',
  );
  const filteredRfqListRows = rfqListRows.filter((rfq) =>
    (rfqStatusFilter === '全部状态' || rfq.status === rfqStatusFilter)
    && matchesSearchQuery([
    rfq.id,
    rfq.title,
    rfq.status,
    rfq.demandLabel,
    rfq.supplierLabel,
     rfq.quoteLabel,
     rfq.deadlineLabel,
   ]));
  const displayedRfqListRows = limitBuyerDemoRows(
    filteredRfqListRows,
    (row) => row.id === 'rfq-stage7-supplier-quote-ready' || row.id === 'rfq-stage7-award-ready',
  );
  const rfqPendingInvitationCount = workspace.rfqs.filter((rfq) => rfq.invitedSupplierIds.length === 0).length;
  const rfqInsufficientQuoteCount = workspace.rfqs.filter((rfq) => (
    rfq.status === '报价中'
    && rfq.invitedSupplierIds.length > 0
    && rfq.quotes.length < rfq.invitedSupplierIds.length
  )).length;
  const rfqReadyForComparisonCount = workspace.rfqs.filter((rfq) => (
    rfq.status === '报价中'
    && rfq.quotes.length > 0
    && !rfq.awardedSupplierId
  )).length;
  const rfqAwardedCount = workspace.rfqs.filter((rfq) => (
    rfq.status === '已定标' || Boolean(rfq.awardedSupplierId)
  )).length;
  const filteredQuoteRfqs = workspace.rfqs.filter((rfq) => matchesSearchQuery([
      rfq.id,
      rfq.title,
     rfq.status,
    rfq.owner,
    rfq.awardedSupplierId,
    ...rfq.demandIds,
     ...rfq.invitedSupplierIds,
     ...rfq.quotes.flatMap((quote) => [quote.id, quote.supplierId, quote.amount, quote.status]),
   ]));
  const displayedQuoteRfqs = limitBuyerDemoRows(
    filteredQuoteRfqs,
    (rfq) => rfq.id === 'rfq-stage7-award-ready' || rfq.id === 'rfq-stage7-order-ready',
  );
  const quoteAwardableQuoteCount = filteredQuoteRfqs
    .filter((rfq) => canSubmitAwardApproval(rfq))
    .reduce((sum, rfq) => sum + rfq.quotes.filter((quote) => quote.status === '已提交').length, 0);
  const quoteRecommendedRfqCount = filteredQuoteRfqs
    .filter((rfq) => Boolean(selectRecommendedQuote(rfq)))
    .length;
  const quoteAwardApprovalPendingCount = filteredQuoteRfqs.filter((rfq) => (
    rfq.status === '定标审批中'
    || allApprovalSources.some((approval) => (
      approval.bizType === 'rfq_award'
      && approval.parentBizId === rfq.id
      && approval.status === '待审批'
    ))
  )).length;
  const quoteGeneratedOrderCount = filteredQuoteRfqs
    .filter((rfq) => workspace.orders.some((order) => order.rfqId === rfq.id))
    .length;
  const quoteAwardSubmittableRfqCount = filteredQuoteRfqs.filter((rfq) => canSubmitAwardApproval(rfq)).length;
  const filteredSupplierRelationRows = supplierRelationRows.filter((relationRow) =>
    (supplierStatusFilter === '全部状态' || relationRow.status === supplierStatusFilter)
    && matchesSearchQuery([
    relationRow.id,
    relationRow.supplierName,
    relationRow.categoryLabel,
    relationRow.status,
    relationRow.level,
    relationRow.action.title,
    relationRow.action.riskLabel,
    ...relationRow.facts.map((fact) => fact.value),
  ]));
  const filteredMaterialRows = materialRows.filter((material) =>
    (materialStatusFilter === '全部状态' || material.status === materialStatusFilter)
    && matchesSearchQuery([
    material.id,
    material.title,
    material.status,
    material.usageLabel,
    ...material.facts.map((fact) => fact.value),
  ]));
  const filteredOrderFulfillmentRows = orderFulfillmentRows.filter((orderRow) =>
     (orderStatusFilter === '全部状态' || orderRow.status === orderStatusFilter)
     && matchesSearchQuery([
     orderRow.id,
    orderRow.supplierName,
    orderRow.amountLabel,
    orderRow.status,
     orderRow.nextAction.title,
     ...orderRow.facts.map((fact) => fact.value),
   ]));
  const displayedOrderFulfillmentRows = limitBuyerDemoRows(
    filteredOrderFulfillmentRows,
    (row) => row.id === 'po-stage7-receipt-ready',
  );
  const filteredContractLedgerRows = contractLedgerRows.filter((contractRow) =>
    (contractStatusFilter === '全部状态' || contractRow.status === contractStatusFilter || contractRow.archiveStatus === contractStatusFilter)
    && matchesSearchQuery([
      contractRow.id,
      contractRow.contractNo,
      contractRow.contractName,
      contractRow.relatedOrderId,
      contractRow.supplierName,
      contractRow.amountLabel,
      contractRow.status,
      contractRow.archiveStatus,
      contractRow.nextAction.title,
      ...contractRow.facts.map((fact) => fact.value),
    ]));
  const contractDraftCount = contractLedgerRows.filter((contract) => contract.status === '草案').length;
  const contractActiveCount = contractLedgerRows.filter((contract) => contract.status === '履约中' || contract.status === '已生效').length;
  const contractArchivedCount = contractLedgerRows.filter((contract) => contract.archiveStatus === '已归档').length;
  const hasJavaContractLedger = Boolean(workspace.contracts && workspace.contracts.length > 0);
  const contractDataSourceLabel = hasJavaContractLedger ? 'Java 合同台账' : '采购订单派生';
  const contractBoundaryHint = hasJavaContractLedger
    ? '本轮合同数据已优先读取 Java 合同台账；合同新建、编辑、附件元数据和归档写入已接入，审批待后续迭代。'
    : '本轮合同数据从采购订单派生；需先保存为 Java 合同后再登记附件和归档。';
  const orderPendingGenerationCount = workspace.rfqs.filter((rfq) => {
    const approvedAward = allApprovalSources.find((approval) => (
      approval.bizType === 'rfq_award'
      && approval.parentBizId === rfq.id
      && approval.status === '已通过'
    ));
    return canCreateOrderFromAward(rfq, approvedAward?.bizId, workspace.orders);
  }).length;
  const orderPendingSupplierConfirmCount = workspace.orders
    .filter((order) => order.status === '待供应商确认')
    .length;
  const orderPendingShipmentCount = workspace.orders
    .filter((order) => order.status === '待发货')
    .length;
  const orderPendingReceiptCount = workspace.orders
    .filter((order) => order.status === '已发货' || order.status === '待收货')
    .length;
  const orderFulfillmentCompletedCount = workspace.orders
    .filter((order) => order.status === '已收货' || order.status === '已完成')
    .length;
  const filteredReceiptInspectionRows = receiptInspectionRows.filter((orderRow) =>
    (receiptStatusFilter === '全部状态' || orderRow.status === receiptStatusFilter)
    && matchesSearchQuery([
    orderRow.id,
    orderRow.supplierName,
    orderRow.logisticsLabel,
     orderRow.status,
     orderRow.nextAction.title,
   ]));
  const displayedReceiptInspectionRows = limitBuyerDemoRows(
    filteredReceiptInspectionRows,
    (row) => row.id === 'po-stage7-receipt-ready',
  );
  const receiptPendingShipmentCount = workspace.orders
    .filter((order) => order.status === '待发货')
    .length;
  const receiptPendingArrivalCount = workspace.orders
    .filter((order) => order.status === '待收货')
    .length;
  const receiptReadyForInspectionCount = workspace.orders
    .filter((order) => order.status === '已发货')
    .length;
  const receiptExceptionPendingCount = Object.values(receiptDrafts)
    .filter((draft) => draft.result === '异常待处理')
    .length;
  const receiptCompletedCount = workspace.orders
    .filter((order) => order.status === '已收货' || order.status === '已完成')
    .length;
  const filteredInvoicePaymentRows = invoicePaymentRows.filter((invoiceRow) =>
    (invoiceStatusFilter === '全部状态' || invoiceRow.status === invoiceStatusFilter)
    && matchesSearchQuery([
    invoiceRow.id,
    invoiceRow.supplierName,
    invoiceRow.orderLabel,
    invoiceRow.amountLabel,
    invoiceRow.status,
    invoiceRow.nextAction.title,
  ]));
  const displayedInvoicePaymentRows = limitBuyerDemoRows(
    filteredInvoicePaymentRows,
    (row) => row.id === 'inv-stage7-payment-ready',
  );
  const invoicePendingIssueCount = workspace.orders
    .filter((order) => (
      (order.status === '已收货' || order.status === '已完成')
      && !workspace.invoices.some((invoice) => invoice.orderId === order.id)
    ))
    .length;
  const invoicePendingReconciliationCount = workspace.invoices
    .filter((invoice) => {
      const status = invoice.reconciliationStatus ?? invoice.reconciliationStage ?? '待对账';
      return status.includes('待') || status === '待同步' || status === '待核对';
    })
    .length;
  const invoiceVariancePendingCount = workspace.invoices
    .filter((invoice) => Math.abs(invoice.varianceAmount ?? 0) > 0)
    .filter((invoice) => !varianceHandlings.some((handling) => (
      handling.invoiceId === invoice.id && handling.status === '已处理'
    )))
    .length;
  const invoicePendingPaymentCount = workspace.invoices
    .filter((invoice) => invoice.paymentStatus !== '已付款')
    .length;
  const invoicePaidCount = workspace.invoices
    .filter((invoice) => invoice.paymentStatus === '已付款')
    .length;
  const demandStatusOptions = Array.from(new Set(demandListRows.map((demandRow) => demandRow.status)));
  const rfqStatusOptions = Array.from(new Set(rfqListRows.map((rfq) => rfq.status)));
  const orderStatusOptions = Array.from(new Set(orderFulfillmentRows.map((orderRow) => orderRow.status)));
  const contractStatusOptions = Array.from(new Set([
    ...contractLedgerRows.map((contractRow) => contractRow.status),
    ...contractLedgerRows.map((contractRow) => contractRow.archiveStatus),
  ]));
  const receiptStatusOptions = Array.from(new Set(receiptInspectionRows.map((orderRow) => orderRow.status)));
  const invoiceStatusOptions = Array.from(new Set(invoicePaymentRows.map((invoiceRow) => invoiceRow.status)));
  const approvalStatusOptions = Array.from(new Set([
    ...approvalQueueRows.map((row) => row.status),
    ...sortedRecentApprovals.map((approval) => approval.status),
  ]));
  const supplierStatusOptions = Array.from(new Set(supplierRelationRows.map((relationRow) => relationRow.status)));
  const materialStatusOptions = Array.from(new Set(materialRows.map((material) => material.status)));
  const searchFilterLabel = normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : undefined;
  const moduleHeader = buyerModuleHeaders[activeModule];
  const selectedDemand = workspace.demands.some((demand) => demand.id === selectedDemandId)
    ? selectedDemandId
    : workspace.demands[0]?.id ?? '';
  const selectedDemandDetail = selectedDemand
    ? buildDemandDetailPanel(workspace, selectedDemand)
    : undefined;
  const selectedDemandRecord = selectedDemandDetail
    ? workspace.demands.find((demand) => demand.id === selectedDemandDetail.id)
    : undefined;
  const selectedRfq = workspace.rfqs.some((rfq) => rfq.id === selectedRfqId)
    ? selectedRfqId
    : workspace.rfqs[0]?.id ?? '';
  const selectedRfqDetail = selectedRfq
    ? buildRfqDetailPanel(workspace, selectedRfq)
    : undefined;
  const selectedRfqRecord = selectedRfqDetail
    ? workspace.rfqs.find((rfq) => rfq.id === selectedRfqDetail.id)
    : undefined;
  const selectedRfqApprovedAward = sortedRecentApprovals.find((approval) =>
    approval.bizType === 'rfq_award'
    && approval.parentBizId === selectedRfq
    && approval.status === '已通过');
  const selectedRfqApprovedAwardId = selectedRfqApprovedAward?.bizId;
  const selectedQuoteComparisonDetail = selectedRfq
    ? buildQuoteComparisonDetailPanel(workspace, selectedRfq)
    : undefined;
  const selectedOrder = workspace.orders.some((order) => order.id === selectedOrderId)
    ? selectedOrderId
    : workspace.orders[0]?.id ?? '';
  const selectedOrderDetail = selectedOrder
    ? buildOrderDetailPanel(workspace, selectedOrder)
    : undefined;
  const selectedOrderRecord = selectedOrderDetail
    ? workspace.orders.find((order) => order.id === selectedOrderDetail.id)
    : undefined;
  const selectedContract = contractLedgerRows.some((contract) => contract.id === selectedContractId)
    ? selectedContractId
    : contractLedgerRows[0]?.id ?? '';
  const selectedContractDetail = selectedContract
    ? buildContractDetailPanel(workspace, selectedContract, {
        paymentRequests,
        paymentBatches,
        fulfillmentEvents: contractFulfillmentEventsById[selectedContract] ?? [],
        attachmentCount: contractAttachmentsById[selectedContract]?.length ?? 0,
        auditLogCount: contractTargetAuditLogsById[selectedContract]?.length ?? 0,
      })
    : undefined;
  const selectedContractRecord = selectedContract
    ? workspace.contracts?.find((contract) => contract.id === selectedContract)
    : undefined;
  const recommendedContractSample = contractLedgerRows.find((contract) => workspace.contracts?.some((item) => item.id === contract.id))
    ?? contractLedgerRows[0];
  const locateContractDemoSample = () => {
    setContractStatusFilter('全部状态');
    if (recommendedContractSample) {
      setSelectedContractId(recommendedContractSample.id);
    }
    scrollToStageNineDemoSample('stage10-demo-sample-contract');
  };
  const contractDemoSequenceNavigation = buildDemoSequenceNavigation(
    contractDemoWalkthroughSteps,
    'contracts' as BuyerAdminModule,
    '合同演示闭环',
    onNavigateBuyerModule,
    locateContractDemoSample,
  );
  const contractDemoReadinessItems: DemoReadinessItem[] = [
    {
      label: 'Java 合同台账',
      status: hasJavaContractLedger ? '已接入 Java 合同台账' : '订单派生合同可演示',
      evidence: hasJavaContractLedger ? 'GET /api/v1/buyer/contracts' : '采购订单派生合同台账',
      detail: hasJavaContractLedger
        ? '合同页优先展示 Java 合同数据，可继续提交审批、登记附件、写入履约事件和归档。'
        : '当前仍可用订单派生合同讲解承接关系，真实保存需先创建 Java 合同。',
      tone: hasJavaContractLedger ? 'ready' : 'warning',
    },
    {
      label: '推荐合同样本',
      status: recommendedContractSample ? '已定位' : '待生成合同',
      evidence: recommendedContractSample?.contractNo ?? '暂无合同样本',
      detail: recommendedContractSample
        ? `优先讲解 ${recommendedContractSample.contractNo}，从来源订单、审批状态、履约事件和发票付款关系展开。`
        : '需要先从订单生成合同或保存合同台账，再进行合同演示。',
      tone: recommendedContractSample ? 'ready' : 'warning',
    },
    {
      label: '合同路径复核',
      status: '已复核',
      evidence: 'stage-ten-contract-demo-path-result.json',
      detail: '采购订单、合同管理、审批中心、收货验收和发票付款已完成桌面与移动视觉复核。',
      tone: 'ready',
    },
    {
      label: '演示边界',
      status: '边界明确',
      evidence: 'stage-ten-contract-demo-path-review.md',
      detail: '本轮不做电子签章、外部合同系统、法务红线和真实支付，只讲合同承接订单的演示闭环。',
      tone: 'ready',
    },
  ];
  const contractDeepeningReadinessItems = buildContractDeepeningReadinessItems(
    javaEnabled,
    contractLedgerRows.length,
    selectedContractDetail,
    recommendedContractSample,
  );
  useEffect(() => {
    if (activeModule === 'contracts' && javaEnabled && selectedContract) {
      onLoadContractFulfillmentEvents(selectedContract);
      onLoadContractTargetAuditLogs(selectedContract);
    }
  }, [activeModule, javaEnabled, selectedContract]);
  const selectedReceiptOrder = workspace.orders.some((order) => order.id === selectedReceiptOrderId)
    ? selectedReceiptOrderId
    : receiptInspectionRows[0]?.id ?? '';
  const selectedReceiptDetail = selectedReceiptOrder
    ? buildReceiptInspectionDetailPanel(workspace, selectedReceiptOrder)
    : undefined;
  const selectedReceiptOrderRecord = selectedReceiptDetail
    ? workspace.orders.find((order) => order.id === selectedReceiptDetail.id)
    : undefined;
  const selectedSupplierRelation = workspace.privateSupplierRelations.some((relation) => relation.id === selectedSupplierRelationId)
    ? selectedSupplierRelationId
    : workspace.privateSupplierRelations[0]?.id ?? '';
  const selectedSupplierDetail = selectedSupplierRelation
    ? buildSupplierDetailPanel(workspace, selectedSupplierRelation)
    : undefined;
  const selectedSupplierRelationRecord = selectedSupplierDetail
    ? workspace.privateSupplierRelations.find((relation) => relation.id === selectedSupplierDetail.id)
    : undefined;
  const selectedMaterial = workspace.materials.some((material) => material.id === selectedMaterialId)
    ? selectedMaterialId
    : workspace.materials[0]?.id ?? '';
  const selectedMaterialDetail = selectedMaterial
    ? buildMaterialDetailPanel(workspace, selectedMaterial)
    : undefined;
  const selectedMaterialRecord = selectedMaterial
    ? workspace.materials.find((material) => material.id === selectedMaterial)
    : undefined;
  const selectedInvoice = workspace.invoices.some((invoice) => invoice.id === selectedInvoiceId)
    ? selectedInvoiceId
    : workspace.invoices[0]?.id ?? '';
  const selectedInvoiceDetail = selectedInvoice
    ? buildInvoicePaymentDetailPanel(workspace, selectedInvoice, {
        paymentRequests,
        varianceHandlings,
      })
    : undefined;
  const selectedInvoiceRecord = selectedInvoiceDetail
    ? workspace.invoices.find((invoice) => invoice.id === selectedInvoiceDetail.id)
    : undefined;
  const selectedPaymentRequestRecord = selectedInvoiceRecord
    ? paymentRequests.find((paymentRequest) => paymentRequest.invoiceId === selectedInvoiceRecord.id)
    : undefined;
  const selectedVarianceHandlingRecord = selectedInvoiceRecord
    ? varianceHandlings.find((varianceHandling) => varianceHandling.invoiceId === selectedInvoiceRecord.id)
    : undefined;
  const navigateBuyerModuleFromContract = (moduleId: BuyerAdminModule, detail: ContractDetailPanel) => {
    const focus: BuyerContractTargetFocus = {
      moduleId,
      contractNo: detail.contractNo,
      orderId: detail.relatedOrderId,
      invoiceId: workspace.invoices.find((invoice) => invoice.orderId === detail.relatedOrderId)?.id,
      sourceLabel: `${detail.contractNo} · ${detail.contractName}`,
    };
    setContractTargetFocus(focus);
    if (moduleId === 'receipts') {
      setReceiptStatusFilter('全部状态');
      setSelectedReceiptOrderId(focus.orderId);
    }
    if (moduleId === 'invoices' && focus.invoiceId) {
      setInvoiceStatusFilter('全部状态');
      setSelectedInvoiceId(focus.invoiceId);
    }
    onNavigateBuyerModule(moduleId);
  };
  const navigateBuyerModuleFromArchiveReviewSuggestion = (
    suggestion: ContractArchiveReviewActionSuggestion,
    detail: ContractDetailPanel,
  ) => {
    const focus: BuyerContractTargetFocus = {
      moduleId: suggestion.targetModuleId,
      contractNo: detail.contractNo,
      orderId: detail.relatedOrderId,
      invoiceId: workspace.invoices.find((invoice) => invoice.orderId === detail.relatedOrderId)?.id,
      sourceLabel: `${detail.contractNo} · ${detail.contractName}`,
      archiveReviewGapItem: suggestion.item,
      archiveReviewSuggestedAction: suggestion.suggestedAction,
      archiveReviewHandlingPath: suggestion.handlingPath,
    };
    setContractTargetFocus(focus);
    if (suggestion.targetModuleId === 'receipts') {
      setReceiptStatusFilter('全部状态');
      setSelectedReceiptOrderId(focus.orderId);
    }
    if (suggestion.targetModuleId === 'invoices' && focus.invoiceId) {
      setInvoiceStatusFilter('全部状态');
      setSelectedInvoiceId(focus.invoiceId);
    }
    onNavigateBuyerModule(suggestion.targetModuleId);
  };
  const receiptContractTargetFocus = contractTargetFocus?.moduleId === 'receipts' ? contractTargetFocus : null;
  const invoiceContractTargetFocus = contractTargetFocus?.moduleId === 'invoices' ? contractTargetFocus : null;
  const focusContractId = (contractNo: string) =>
    contractLedgerRows.find((contract) => contract.contractNo === contractNo)?.id ?? selectedContract;
  const createReceiptFromContractFocus = (orderId: string) => {
    if (receiptContractTargetFocus?.orderId === orderId) {
      const contractId = focusContractId(receiptContractTargetFocus.contractNo);
      const summary = `收货验收已由合同联动入口推进：${orderId}`;
      setContractLinkedActionResult({
        contractNo: receiptContractTargetFocus.contractNo,
        actionType: 'receipt',
        targetId: orderId,
        sourceLabel: receiptContractTargetFocus.sourceLabel,
        summary,
        archiveReviewResultGapItem: receiptContractTargetFocus.archiveReviewGapItem,
        archiveReviewResultEvidenceStatus: receiptContractTargetFocus.archiveReviewGapItem
          ? '收货验收已形成新的归档复核证据'
          : undefined,
        archiveReviewResultNextStep: receiptContractTargetFocus.archiveReviewGapItem
          ? '返回合同归档复核清单，确认该缺口是否已覆盖。'
          : undefined,
      });
      setSelectedContractId(contractId);
      onCreateContractFulfillmentEvent(contractId, {
        actionType: 'receipt',
        targetId: orderId,
        summary,
        sourceLabel: receiptContractTargetFocus.sourceLabel,
      });
    }
  };
  const registerPaymentFromContractFocus = (invoiceId: string) => {
    if (invoiceContractTargetFocus?.invoiceId === invoiceId) {
      const contractId = focusContractId(invoiceContractTargetFocus.contractNo);
      const summary = `发票付款已由合同联动入口推进：${invoiceId}`;
      setContractLinkedActionResult({
        contractNo: invoiceContractTargetFocus.contractNo,
        actionType: 'payment',
        targetId: invoiceId,
        sourceLabel: invoiceContractTargetFocus.sourceLabel,
        summary,
        archiveReviewResultGapItem: invoiceContractTargetFocus.archiveReviewGapItem,
        archiveReviewResultEvidenceStatus: invoiceContractTargetFocus.archiveReviewGapItem
          ? '发票付款已形成新的归档复核证据'
          : undefined,
        archiveReviewResultNextStep: invoiceContractTargetFocus.archiveReviewGapItem
          ? '返回合同归档复核清单，确认该缺口是否已覆盖。'
          : undefined,
      });
      setSelectedContractId(contractId);
      onCreateContractFulfillmentEvent(contractId, {
        actionType: 'payment',
        targetId: invoiceId,
        summary,
        sourceLabel: invoiceContractTargetFocus.sourceLabel,
      });
    }
  };
  const locateBuyerDemoSample = () => {
    if (activeModule === 'demands') {
      setDemandStatusFilter('全部状态');
      setSelectedDemandId('dem-stage7-submit-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-demand');
    }
    if (activeModule === 'approvals') {
      setApprovalStatusFilter('全部状态');
      setSelectedApprovalId('approval-stage7-demand-pending');
      scrollToStageNineDemoSample('stage9-demo-sample-approval');
    }
    if (activeModule === 'rfqs' || activeModule === 'quotes') {
      setRfqStatusFilter('全部状态');
      setSelectedRfqId('rfq-stage7-award-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-rfq');
    }
    if (activeModule === 'orders') {
      setOrderStatusFilter('全部状态');
      setSelectedOrderId('po-stage7-receipt-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-receipt');
    }
    if (activeModule === 'receipts') {
      setReceiptStatusFilter('全部状态');
      setSelectedReceiptOrderId('po-stage7-receipt-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-receipt');
    }
    if (activeModule === 'invoices') {
      setInvoiceStatusFilter('全部状态');
      setSelectedInvoiceId('inv-stage7-payment-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-invoice');
    }
  };
  const buyerDemoSequenceNavigation = buildDemoSequenceNavigation(
    buyerDemoWalkthroughSteps,
    activeModule as BuyerAdminModule,
    '主流程演示闭环',
    onNavigateBuyerModule,
    locateBuyerDemoSample,
  );
  const buyerDemoReadinessItems = buildDemoReadinessItems(
    javaEnabled,
    '采购方 7 个真实动作',
    'stage-seven-java-real-action-click-result.json',
    '需求、审批、报价、收货、发票推荐样本已标记，适合从询价比价闭环开始演示。',
  );
  const demoPresenterCue = {
    demands: {
      moduleLabel: '采购需求',
      selectedTitle: selectedDemandDetail?.title,
      selectedMeta: selectedDemandDetail?.id,
      statusLabel: selectedDemandDetail?.status,
      displayedCount: displayedDemandListRows.length,
      totalCount: filteredDemandListRows.length,
      primaryActionLabel: '提交审批 / 创建询价',
      densityHint: '需求摘要、预算、审批状态和询价入口同屏可见',
      listHeightHint: '需求卡片只保留状态、预算、物料和下一步动作，避免列表首屏过高。',
      primaryButtonHint: '提交审批和创建询价按钮紧贴需求卡片动作区',
      disabledReasonHint: '审批中、已通过或已关联 RFQ 的需求用状态说明禁用原因。',
      detailEntryHint: '查看详情入口保留在需求卡片操作状态区，进入后核对物料、预算和附件。',
      postClickHint: '提交审批后进入审批中心，创建询价后进入询价项目。',
      nextModuleLabel: '审批中心',
    },
    approvals: {
      moduleLabel: '审批中心',
      selectedTitle: selectedApprovalDetail?.title,
      selectedMeta: selectedApprovalDetail?.id,
      statusLabel: selectedApprovalDetail?.status,
      displayedCount: displayedApprovalQueueRows.length,
      totalCount: approvalQueueRows.length,
      primaryActionLabel: '通过 / 驳回',
      densityHint: '审批对象、处理意见、处理按钮和流转结果同屏可见',
      listHeightHint: '审批卡片优先展示对象、状态和动作，最近记录保持紧凑只读。',
      primaryButtonHint: '审批通过和驳回按钮固定在待办卡片右侧',
      disabledReasonHint: '已处理审批只显示最近记录，不再展示可点击处理按钮。',
      detailEntryHint: '详情入口用于核对业务对象、审批类型、处理意见和流转记录。',
      postClickHint: '通过需求审批后回到采购需求或继续创建询价。',
      nextModuleLabel: '询价项目',
    },
    rfqs: {
      moduleLabel: '询价项目',
      selectedTitle: selectedRfqDetail?.title,
      selectedMeta: selectedRfqDetail?.id,
      statusLabel: selectedRfqDetail?.status,
      displayedCount: displayedRfqListRows.length,
      totalCount: filteredRfqListRows.length,
      primaryActionLabel: '邀请供应商 / 进入比价',
      densityHint: 'RFQ 摘要、邀请供应商、截止时间和报价数量同屏可见',
      listHeightHint: 'RFQ 卡片按状态、供应商、报价数量和截止时间扫读，详情下沉。',
      primaryButtonHint: '邀请供应商按钮跟随 RFQ 状态区展示',
      disabledReasonHint: '已定标或报价截止后的 RFQ 只保留只读说明和报价回看。',
      detailEntryHint: '详情入口用于核对需求来源、邀请供应商、报价要求和状态流转。',
      postClickHint: '邀请供应商后继续在报价对比页查看报价数量和推荐结果。',
      nextModuleLabel: '报价对比',
    },
    quotes: {
      moduleLabel: '报价对比',
      selectedTitle: selectedQuoteComparisonDetail?.title,
      selectedMeta: selectedQuoteComparisonDetail?.id,
      statusLabel: selectedQuoteComparisonDetail?.status,
      displayedCount: displayedQuoteRfqs.length,
      totalCount: filteredQuoteRfqs.length,
      primaryActionLabel: '提交定标审批 / 生成订单',
      densityHint: '报价矩阵、推荐理由、定标审批和生成订单入口同屏可见',
      listHeightHint: '报价卡片优先露出推荐结论和报价数量，比较明细放进详情区。',
      primaryButtonHint: '定标审批和生成订单按钮固定在报价推荐区',
      disabledReasonHint: '无报价、定标审批未通过或订单已生成时展示不可重复操作原因。',
      detailEntryHint: '详情入口用于核对报价矩阵、推荐理由、审批状态和订单来源。',
      postClickHint: '提交定标后进入审批中心，审批通过后生成采购订单。',
      nextModuleLabel: '采购订单',
    },
    orders: {
      moduleLabel: '采购订单',
      selectedTitle: selectedOrderDetail?.id,
      selectedMeta: selectedOrderDetail?.supplierName,
      statusLabel: selectedOrderDetail?.status,
      displayedCount: displayedOrderFulfillmentRows.length,
      totalCount: filteredOrderFulfillmentRows.length,
      primaryActionLabel: '跟进供应商确认 / 登记收货',
      densityHint: '订单摘要、履约时间线、供应商确认和收货入口同屏可见',
      listHeightHint: '订单卡片固定展示供应商、金额、履约状态和下一动作，物流细节下沉。',
      primaryButtonHint: '登记收货入口从订单履约状态直接衔接',
      disabledReasonHint: '供应商未发货或订单已收货时，登记收货按钮保持禁用并解释原因。',
      detailEntryHint: '详情入口用于核对供应商确认、发货、预计到货和履约时间线。',
      postClickHint: '订单发货后进入收货验收，收货完成后衔接发票付款。',
      nextModuleLabel: '收货验收',
    },
    receipts: {
      moduleLabel: '收货验收',
      selectedTitle: selectedReceiptDetail?.id,
      selectedMeta: selectedReceiptDetail?.supplierName,
      statusLabel: selectedReceiptDetail?.status,
      displayedCount: displayedReceiptInspectionRows.length,
      totalCount: filteredReceiptInspectionRows.length,
      primaryActionLabel: '登记收货 / 异常处理',
      densityHint: '物流状态、验收结果、异常原因和发票衔接同屏可见',
      listHeightHint: '收货卡片先展示物流和验收状态，异常原因进入详情核对。',
      primaryButtonHint: '登记收货按钮跟随待验收订单展示',
      disabledReasonHint: '未发货、已收货或异常原因不完整时，用边界提示解释不可操作。',
      detailEntryHint: '详情入口用于核对物流状态、验收检查项、异常原因和后续发票入口。',
      postClickHint: '登记收货后订单进入发票协同，下一步查看发票付款。',
      nextModuleLabel: '发票付款',
    },
    invoices: {
      moduleLabel: '发票付款',
      selectedTitle: selectedInvoiceDetail?.id,
      selectedMeta: selectedInvoiceDetail?.supplierName,
      statusLabel: selectedInvoiceDetail?.status,
      displayedCount: displayedInvoicePaymentRows.length,
      totalCount: filteredInvoicePaymentRows.length,
      primaryActionLabel: '对账 / 登记付款',
      densityHint: '对账差异、付款计划、逾期提醒和付款登记同屏可见',
      listHeightHint: '发票卡片只保留对账、付款状态和下一步，三单匹配细节放详情。',
      primaryButtonHint: '登记付款入口与对账差异和付款计划同屏',
      disabledReasonHint: '存在对账差异、付款已完成或批次已归档时说明禁用原因。',
      detailEntryHint: '详情入口用于核对三单匹配、付款计划、付款轨迹和审计留痕。',
      postClickHint: '登记付款后回到首页看板或审计日志查看闭环结果。',
      nextModuleLabel: '首页看板',
    },
  }[activeModule as BuyerAdminModule];
  const demoKeyActionReadiness = {
    demands: [
      {
        label: '提交审批',
        enabled: workspace.demands.some((demand) => demand.status === '草稿'),
        reason: '草稿需求可直接提交审批；没有草稿时，用边界提示说明当前数据不可重复提交。',
      },
      {
        label: '创建询价',
        enabled: demandToRfqReadyCount > 0,
        reason: '已审批通过且未关联 RFQ 的需求可创建询价；否则先处理审批或供应商准入。',
      },
    ],
    approvals: [
      {
        label: '通过',
        enabled: filteredApprovalQueueRows.length > 0,
        reason: '存在待审批事项时可演示通过；无待办时说明审批队列已处理。',
      },
    ],
    rfqs: [
      {
        label: '邀请供应商',
        enabled: filteredRfqListRows.some((rfq) => rfq.status === '草稿' || rfq.status === '报价中'),
        reason: '草稿或报价中项目可继续邀请供应商；已定标项目保持只读。',
      },
    ],
    quotes: [
      {
        label: '按推荐报价提交定标审批',
        enabled: quoteAwardSubmittableRfqCount > 0,
        reason: '有已提交报价且未定标项目时开放定标审批；已定标项目用于讲解比较结果。',
      },
      {
        label: '生成采购订单',
        enabled: orderPendingGenerationCount > 0,
        reason: '定标审批通过后才生成订单；已生成订单时保持只读并衔接到采购订单页。',
      },
    ],
    orders: [
      {
        label: '登记收货',
        enabled: receiptReadyForInspectionCount > 0,
        reason: '供应商已发货后可登记收货；未发货时先跟进供应商确认和发货。',
      },
    ],
    receipts: [
      {
        label: '登记收货',
        enabled: receiptReadyForInspectionCount > 0,
        reason: '已发货订单可登记验收；待发货或已收货订单显示当前边界。',
      },
    ],
    invoices: [
      {
        label: '登记付款',
        enabled: invoicePendingPaymentCount > 0,
        reason: '未付款发票可登记付款；已付款记录只做状态回看和对账讲解。',
      },
    ],
  }[activeModule as BuyerAdminModule] ?? [];
  const buyerMainFlowOperationStrip = buyerMainFlowOperationStrips[activeModule as BuyerAdminModule];

  return (
    <>
    <HeroBand
      eyebrow="采购方企业后台"
      title="从需求申请到发票付款的询价比价闭环"
      desc="采购方维护组织、物料、私域供应商关系，并对需求、定标、订单和财务状态负责。"
    />

    {workflowStatus && (
      <FeedbackNotice message={workflowStatus} />
    )}

    <BuyerModuleHeader header={moduleHeader} facts={moduleFacts} javaEnabled={javaEnabled} />

    <PermissionBoundaryPanel
      roleLabel="采购方企业"
      modeLabel={javaEnabled ? 'Java 模式' : 'Mock 模式'}
      allowedActions={[
        '提交需求、审批、询价比价、生成订单、登记收货和付款状态',
        '维护组织用户、物料目录和私域供应商关系',
      ]}
      blockedActions={[
        '不能维护平台套餐，也不能查看其他采购企业的采购数据',
        '不能替供应商确认订单、发货或登记应收发票',
      ]}
      dataBoundary="当前采购租户内的需求、供应商关系、订单和财务记录"
    />

    <DemoCommandCenterPanel
      title="采购方现场演示总线"
      subtitle="把采购方作为主叙事入口，从需求申请一路讲到发票付款，所有真实动作都有 Java 验收证据。"
      items={buyerDemoCommandCenterItems}
      currentGuide={buyerDemoCurrentActionGuides[activeModule as BuyerAdminModule]}
      sequenceNavigation={buyerDemoSequenceNavigation}
      testId="stage9-buyer-demo-command-center"
    />

    <DemoReadinessPanel
      title="采购方演示准备检查"
      subtitle="开场前确认采购方主流程的 Java 数据源、前端加载、推荐样本和验收证据。"
      status={javaEnabled ? 'Java 数据源已连接' : '等待 Java 数据源'}
      items={buyerDemoReadinessItems}
      testId="stage9-buyer-demo-readiness"
    />

    <DemoActionFeedbackPanel
      title="采购方 7 个真实点击动作"
      subtitle="逐个说明操作前置条件、成功反馈、失败兜底和下一步说明，减少现场演示解释成本。"
      items={buyerDemoActionFeedbackItems}
      testId="stage8-buyer-action-feedback"
    />

    <DemoReadonlyBoundaryPanel
      title="采购方只读边界与空状态"
      subtitle="把已完成、已归档、无数据和不可操作边界放到演示起点，帮助业务人员理解流程为什么被锁定。"
      items={buyerReadonlyBoundaryItems}
      testId="stage8-buyer-readonly-boundary"
    />

    <DemoPermissionAuditPanel
      title="采购方权限与审计留痕"
      subtitle="把采购方主流程动作映射到角色权限、业务对象和审计追溯入口，方便现场解释内控闭环。"
      items={buyerGovernanceTraceItems}
      testId="stage8-buyer-permission-audit"
    />

    {buyerDemoWalkthroughModules.includes(activeModule as BuyerAdminModule) && (
      <>
      <DemoWalkthroughRail
        ariaLabel="采购方主流程演示路径"
        eyebrow="采购方主流程演示路径"
        title="按 7 页顺序完成询价比价闭环走查"
        description="当前演示页从需求进入，最终在发票付款收束；每一步保留独立列表、详情和操作边界。"
        steps={buyerDemoWalkthroughSteps}
        activeModule={activeModule as BuyerAdminModule}
        closedLabel="主流程演示闭环"
        gridClassName="grid-cols-2 sm:grid-cols-4 xl:grid-cols-7"
        onNavigate={(moduleId) => onNavigateBuyerModule(moduleId)}
      />
      {buyerMainFlowOperationStrip && (
        <BuyerMainFlowOperationStrip
          config={buyerMainFlowOperationStrip}
          onNext={onNavigateBuyerModule}
        />
      )}
      {demoPresenterCue && (
        <BuyerDemoPresenterCue
          moduleLabel={demoPresenterCue.moduleLabel}
          selectedTitle={demoPresenterCue.selectedTitle}
          selectedMeta={demoPresenterCue.selectedMeta}
          statusLabel={demoPresenterCue.statusLabel}
          displayedCount={demoPresenterCue.displayedCount}
          totalCount={demoPresenterCue.totalCount}
          primaryActionLabel={demoPresenterCue.primaryActionLabel}
          densityHint={demoPresenterCue.densityHint}
          listHeightHint={demoPresenterCue.listHeightHint}
          nextModuleLabel={demoPresenterCue.nextModuleLabel}
        />
      )}
      {demoPresenterCue && (
        <BuyerDemoDataSlimmingCue
          moduleLabel={demoPresenterCue.moduleLabel}
          displayedCount={demoPresenterCue.displayedCount}
          totalCount={demoPresenterCue.totalCount}
        />
      )}
      {demoKeyActionReadiness.length > 0 && (
        <BuyerKeyActionReadinessPanel
          actions={demoKeyActionReadiness}
          visibilityHint={{
            moduleLabel: demoPresenterCue.moduleLabel,
            primaryButtonHint: demoPresenterCue.primaryButtonHint,
            disabledReasonHint: demoPresenterCue.disabledReasonHint,
            detailEntryHint: demoPresenterCue.detailEntryHint,
            postClickHint: demoPresenterCue.postClickHint,
          }}
          onActionFocus={onFocusBuyerKeyAction}
        />
      )}
      </>
    )}

    <div data-buyer-action-anchor="primary-business-action" />

    {javaEnabled && activeModule === 'dashboard' && (
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div>
          <p className="text-sm font-black text-blue-950">Java MVP 主流程联调</p>
          <p className="mt-1 text-sm font-bold text-blue-700">顶部按钮可随时执行完整询价比价闭环</p>
        </div>
      </div>
    )}

    {activeModule === 'dashboard' && (
      <div className="grid gap-4 md:grid-cols-5">
        <MetricCard icon={WalletCards} label="采购金额" value={currency(kpis.totalSpend)} tone="blue" />
        <MetricCard icon={ClipboardCheck} label="待审批需求" value={`${kpis.pendingApprovals} 条`} tone="amber" />
        <MetricCard icon={Send} label="进行中询价" value={`${kpis.activeRfqs} 个`} tone="green" />
        <MetricCard icon={Truck} label="履约进度" value={`${kpis.fulfillmentRate}%`} tone="slate" />
        <MetricCard icon={Users} label="私域供应商" value={`${kpis.supplierCount} 家`} tone="blue" />
      </div>
    )}

    {activeModule === 'dashboard' && (
      <MessageCenterPanel
        title="采购方消息中心"
        scopeLabel="审批、询价、订单、发票"
        notifications={buyerMessageCenterNotifications}
        onMarkRead={markBuyerNotificationRead}
        markReadBusyId={notificationReadBusyId}
      />
    )}

    {activeModule === 'dashboard' && (
      <Panel title="MVP 业务主线" icon={Activity}>
        <WorkflowRail steps={workspace.workflow} />
      </Panel>
    )}

    {activeModule === 'demands' && (
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-blue-700">需求到审批演示台</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">采购需求先跑通，后续询价才有入口</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-blue-800">
              演示路径：先创建或选择采购需求，再提交审批，审批通过后回到需求页创建询价。
            </p>
          </div>
          <PrimaryActionButton
            onClick={() => onNavigateBuyerModule('approvals')}
            icon={ShieldCheck}
            size="md"
            flushTop
          >
            打开审批中心处理待办
          </PrimaryActionButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniFact label="待提交审批" value={`${workspace.demands.filter((demand) => demand.status === '草稿').length} 条`} />
          <MiniFact label="审批中需求" value={`${workspace.demands.filter((demand) => demand.status === '审批中').length} 条`} />
          <MiniFact label="可创建询价" value={`${demandToRfqReadyCount} 条`} />
          <MiniFact label="已进入询价" value={`${demandToRfqLinkedCount} 条`} />
        </div>
      </section>
    )}

    {activeModule === 'approvals' && (
      <section className="rounded-lg border border-amber-100 bg-amber-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-amber-700">审批处理演示台</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">审批决定直接影响需求能否进入询价</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
              演示路径：选择待审批事项，填写审批意见并确认影响，再通过或驳回。
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
            <PrimaryActionButton
              onClick={() => onNavigateBuyerModule('demands')}
              icon={FileText}
              tone="amber"
              size="md"
              flushTop
            >
              返回采购需求查看结果
            </PrimaryActionButton>
            <PrimaryActionButton
              onClick={() => onNavigateBuyerModule('rfqs')}
              icon={Send}
              size="md"
              flushTop
            >
              进入询价项目跟进
            </PrimaryActionButton>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniFact label="待处理审批" value={`${displayedApprovalQueueRows.length} 条`} />
          <MiniFact label="最近处理" value={`${filteredRecentApprovals.length} 条`} />
          <MiniFact label="当前筛选" value={approvalStatusFilter} />
          <MiniFact label="下一步" value="审批通过后回到采购需求继续创建询价" />
        </div>
      </section>
    )}

    {activeModule === 'approvals' && (
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="审批待办" icon={ClipboardCheck}>
          <ListToolbar
            title="审批待办池"
            recordCount={displayedApprovalQueueRows.length}
            filterLabel={searchFilterLabel ?? '待审批优先'}
            actionLabel="批量审批"
          />
          <StatusFilterControl
            label="审批状态"
            value={approvalStatusFilter}
            statusOptions={approvalStatusOptions}
            onChange={setApprovalStatusFilter}
          />
          <DemoListLimitNotice
            moduleLabel="审批中心"
            totalCount={filteredApprovalQueueRows.length}
            displayedCount={displayedApprovalQueueRows.length}
          />
          {displayedApprovalQueueRows.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {displayedApprovalQueueRows.map((approvalRow) => {
                const approval = displayPendingApprovals.find((item) => item.id === approvalRow.id);
                const approvalDraft = approval ? getApprovalReviewDraft(approval as JavaApprovalTaskDto) : undefined;
                return (
                  <AdminInfoCard
                    key={approvalRow.id}
                    title={approvalRow.title}
                    meta={approvalRow.typeLabel}
                    status={approvalRow.status}
                    facts={approvalRow.facts}
                    detailSelected={selectedApproval === approvalRow.id}
                    onSelectDetail={() => setSelectedApprovalId(approvalRow.id)}
                    tone="warning"
                    demoHighlight={approvalRow.id === 'approval-stage7-demand-pending'
                      ? {
                          label: '阶段七需求审批样本',
                          testId: `stage9-demo-sample-approval-${approvalRow.id}`,
                        }
                      : undefined}
                  >
                    {javaEnabled && approval && approvalDraft && approvalRow.canReview ? (
                      <ApprovalReviewForm
                        approvalId={approvalRow.id}
                        draft={approvalDraft}
                        busy={approvalBusyId === approvalRow.id}
                        onChange={(draft) => setApprovalReviewDrafts((drafts) => ({ ...drafts, [approvalRow.id]: draft }))}
                        onReject={() => onReviewApproval(approval as JavaApprovalTaskDto, false, approvalDraft)}
                        onApprove={() => onReviewApproval(approval as JavaApprovalTaskDto, true, approvalDraft)}
                      />
                    ) : (
                      <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-black text-blue-700">
                        Java 模式下可直接通过或驳回，mock 模式仅展示审批队列。
                      </div>
                    )}
                  </AdminInfoCard>
                );
              })}
            </div>
          ) : (
            <EmptyState title="当前没有待审批事项" desc="当前筛选条件下没有待处理审批，可切换审批状态或清空搜索后再查看。" />
          )}
        </Panel>

        <ApprovalDetailPanelView
          detail={selectedApprovalDetail}
          approval={javaEnabled ? selectedApprovalSource as JavaApprovalTaskDto | undefined : undefined}
          approvalBusyId={approvalBusyId}
          javaEnabled={javaEnabled}
          reviewDraft={selectedApprovalSource ? getApprovalReviewDraft(selectedApprovalSource as JavaApprovalTaskDto) : undefined}
          onChangeReviewDraft={(approvalId, draft) => setApprovalReviewDrafts((drafts) => ({ ...drafts, [approvalId]: draft }))}
          onReviewApproval={onReviewApproval}
        />
      </div>
    )}

    {activeModule === 'approvals' && (
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="最近审批记录" icon={ShieldCheck}>
          <ListToolbar
            title="审批记录池"
            recordCount={filteredRecentApprovals.length}
            filterLabel={searchFilterLabel ?? '最近处理优先'}
            actionLabel="审批模板"
          />
          <StatusFilterControl
            label="审批状态"
            value={approvalStatusFilter}
            statusOptions={approvalStatusOptions}
            onChange={setApprovalStatusFilter}
          />
          {javaEnabled && filteredRecentApprovals.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredRecentApprovals.map((approval) => {
                const facts = buildApprovalCardFacts(approval);
                return (
                  <AdminInfoCard
                    key={approval.id}
                    title={approval.summaryTitle || approval.bizId}
                    meta={approvalTypeLabel(approval.bizType)}
                    status={approval.status}
                    facts={[
                      ...facts.slice(0, 4),
                      { label: '处理时间', value: formatAuditTime(approval.actedAt ?? approval.createdAt) },
                    ]}
                    detailSelected={selectedApproval === approval.id}
                    onSelectDetail={() => setSelectedApprovalId(approval.id)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState title="暂无已处理审批记录" desc="审批通过或驳回后，最近处理记录会在这里沉淀。" />
          )}
        </Panel>

        {javaEnabled ? (
          <ApprovalTemplateSettings
            templates={approvalTemplates}
            roles={roles}
            onSave={onUpdateApprovalTemplate}
          />
        ) : (
          <Panel title="审批模板配置" icon={Settings}>
            <EmptyState title="当前为 mock 数据源" desc="Java 模式下可配置需求审批、供应商准入和定标审批的默认审批角色。" />
          </Panel>
        )}

        <MessageCenterPanel
          title="审批消息中心"
          scopeLabel="审批结果通知、驳回原因、流程提醒"
          notifications={filteredBuyerNotifications}
          onMarkRead={markBuyerNotificationRead}
          markReadBusyId={notificationReadBusyId}
        />
      </div>
    )}

    {(activeModule === 'demands' || activeModule === 'rfqs' || activeModule === 'quotes') && (
    <div className={`grid gap-6 ${
      activeModule === 'demands'
        ? '2xl:grid-cols-[340px_minmax(0,1fr)_420px]'
        : '2xl:grid-cols-[minmax(0,1fr)_420px]'
    }`}
    >
      {activeModule === 'demands' && (
      <>
      <Panel title="新建采购需求" icon={FileText}>
        <DemandCreateForm
          materials={workspace.materials}
          departments={workspace.departments}
          users={workspace.users}
          defaultDepartment={workspace.demands[0]?.department ?? 'dept-it'}
          defaultRequester={workspace.demands[0]?.requester ?? '采购负责人'}
          disabled={!javaEnabled || demandCreateBusy}
          busy={demandCreateBusy}
          onSubmit={onCreateDemand}
        />
      </Panel>

      <Panel title="采购需求列表" icon={Database}>
        <ListToolbar
          title="需求池"
          recordCount={filteredDemandListRows.length}
          filterLabel={searchFilterLabel ?? '全部需求状态'}
          actionLabel="新建需求"
        />
        <StatusFilterControl
          label="需求状态"
          value={demandStatusFilter}
          statusOptions={demandStatusOptions}
          onChange={setDemandStatusFilter}
        />
        <FilterResultSummary
          label="采购需求筛选结果"
          filterLabel={demandStatusFilter}
          resultCount={filteredDemandListRows.length}
          totalCount={demandListRows.length}
          selectedLabel={selectedDemandDetail?.title}
          onClear={() => setDemandStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="采购需求"
          selectedTitle={selectedDemandDetail?.title}
          selectedMeta={selectedDemandDetail?.id}
          selectedStatus={selectedDemandDetail?.status}
          nextActionTitle={selectedDemandDetail?.nextActionTitle}
          detailHint="右侧详情会核对审批、预算、附件、物料明细和创建询价可用性。"
          boundaryHint="未审批通过、已关联询价或无已准入供应商时，不开放创建询价。"
        />
        <DemoListLimitNotice
          moduleLabel="采购需求"
          totalCount={filteredDemandListRows.length}
          displayedCount={displayedDemandListRows.length}
        />
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-blue-900">转询价准备摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
                优先处理审批阻断和供应商准入阻断，已通过且未关联需求可直接创建 RFQ。
              </p>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-blue-700">
              优先处理审批阻断和供应商准入阻断
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="可转询价" value={`${demandToRfqReadyCount} 条`} />
            <MiniFact label="已关联询价" value={`${demandToRfqLinkedCount} 条`} />
            <MiniFact label="审批阻断" value={`${demandToRfqApprovalBlockedCount} 条`} />
            <MiniFact label="供应商准入阻断" value={`${demandToRfqSupplierBlockedCount} 条`} />
          </div>
        </div>
        {filteredDemandListRows.length === 0 ? (
          <EmptyState title="暂无采购需求" desc="创建需求后可提交审批，审批通过后再转为询价项目。" />
        ) : (
        <div className="space-y-3">
          {displayedDemandListRows.map((demandRow) => {
            const demand = workspace.demands.find((item) => item.id === demandRow.id);
            if (!demand) return null;
            return (
            <WorkflowListCard
              key={demandRow.id}
              title={demandRow.title}
              meta={demandRow.materialSummary}
              facts={demandRow.facts}
              status={demandRow.status}
              nextAction={demandRow.nextAction}
              detailSelected={selectedDemand === demandRow.id}
              onSelectDetail={() => setSelectedDemandId(demandRow.id)}
              demoHighlight={demand.id === 'dem-stage7-submit-ready' || demand.id === 'dem-stage7-rfq-ready'
                ? {
                    label: '阶段七采购需求样本',
                    testId: `stage9-demo-sample-demand-${demand.id}`,
                  }
                : undefined}
              action={javaEnabled && demand.status === '草稿' ? (
                <PrimaryActionButton
                  onClick={() => onSubmitDemand(demand.id)}
                  disabled={demandSubmitBusyId === demand.id}
                  busy={demandSubmitBusyId === demand.id}
                  icon={ClipboardCheck}
                  pendingLabel="提交中"
                  fullWidth
                  testId={`stage7-submit-demand-${demand.id}`}
                >
                  提交审批
                </PrimaryActionButton>
              ) : undefined}
            >
              {javaEnabled
                && demand.status === '已通过'
                && !linkedDemandIds.has(demand.id)
                && workspace.privateSupplierRelations.some((relation) => relation.status === '已准入') && (
                <RfqCreateForm
                  demand={demand}
                  suppliers={workspace.suppliers}
                  relations={workspace.privateSupplierRelations}
                  busy={rfqCreateBusy === demand.id}
                  onSubmit={onCreateRfqFromDemand}
                />
              )}
            </WorkflowListCard>
            );
          })}
        </div>
        )}
      </Panel>

      <DemandDetailPanelView
        detail={selectedDemandDetail}
        demand={selectedDemandRecord}
        workspace={workspace}
        javaEnabled={javaEnabled}
        linkedDemandIds={linkedDemandIds}
        demandSubmitBusyId={demandSubmitBusyId}
        demandUpdateBusyId={demandUpdateBusyId}
        rfqCreateBusy={rfqCreateBusy}
        onSubmitDemand={onSubmitDemand}
        onUpdateDemand={onUpdateDemand}
        onCreateRfqFromDemand={onCreateRfqFromDemand}
      />
      </>
      )}

      {activeModule === 'rfqs' && (
      <>
        <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-indigo-700">询价协同演示台</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">把已审批需求转成供应商可响应的 RFQ</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-indigo-800">
                演示路径：从已审批需求进入询价，补齐邀请供应商、报价要求和截止时间，再进入报价对比。
              </p>
            </div>
            <PrimaryActionButton
              onClick={() => onNavigateBuyerModule('quotes')}
              icon={BarChart3}
              size="md"
              flushTop
            >
              进入报价对比定标
            </PrimaryActionButton>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="待补邀请" value={`${rfqPendingInvitationCount} 个`} />
            <MiniFact label="报价不足" value={`${rfqInsufficientQuoteCount} 个`} />
            <MiniFact label="可进入比价" value={`${rfqReadyForComparisonCount} 个`} />
            <MiniFact label="已完成定标" value={`${rfqAwardedCount} 个`} />
          </div>
        </section>
        <Panel title="询价项目" icon={Send}>
          <ListToolbar
            title="询价项目池"
            recordCount={filteredRfqListRows.length}
            filterLabel={searchFilterLabel ?? '全部询价状态'}
            actionLabel="邀请供应商"
          />
          <StatusFilterControl
            label="询价状态"
            value={rfqStatusFilter}
            statusOptions={rfqStatusOptions}
            onChange={setRfqStatusFilter}
          />
          <FilterResultSummary
            label="询价项目筛选结果"
            filterLabel={rfqStatusFilter}
            resultCount={filteredRfqListRows.length}
            totalCount={rfqListRows.length}
            selectedLabel={selectedRfqDetail?.title}
            onClear={() => setRfqStatusFilter('全部状态')}
          />
          <SelectedBusinessHandoffPanel
            moduleLabel="询价项目"
            selectedTitle={selectedRfqDetail?.title}
            selectedMeta={selectedRfqDetail?.id}
            selectedStatus={selectedRfqDetail?.status}
            nextActionTitle={selectedRfqDetail?.nextActionTitle}
            detailHint="右侧详情会核对关联需求、邀请供应商、报价数量、截止时间和履约轨迹。"
            boundaryHint="未收到报价时只能跟进供应商响应；定标后避免重复提交审批。"
          />
          <DemoListLimitNotice
            moduleLabel="询价项目"
            totalCount={filteredRfqListRows.length}
            displayedCount={displayedRfqListRows.length}
          />
          <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-indigo-900">询价推进摘要</p>
                <p className="mt-1 text-xs font-bold leading-5 text-indigo-700">
                  优先跟进报价不足项目，再推进可比价项目定标审批。
                </p>
              </div>
              <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-indigo-700">
                优先跟进报价不足项目，再推进可比价项目定标审批。
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <MiniFact label="待补邀请" value={`${rfqPendingInvitationCount} 个`} />
              <MiniFact label="报价不足" value={`${rfqInsufficientQuoteCount} 个`} />
              <MiniFact label="可进入比价定标" value={`${rfqReadyForComparisonCount} 个`} />
              <MiniFact label="已完成定标" value={`${rfqAwardedCount} 个`} />
            </div>
          </div>
          {filteredRfqListRows.length === 0 ? (
            <EmptyState title="暂无询价项目" desc="需求审批通过后，可从采购需求页选择已准入供应商并创建询价。" />
          ) : (
          <ResponsiveTableFrame
            mobileCards={displayedRfqListRows.map((rfq) => (
              <ResponsiveSummaryCard
                key={rfq.id}
                ariaLabel={`${rfq.title} 询价摘要`}
                title={rfq.title}
                meta={rfq.id}
                status={rfq.status}
                selected={selectedRfq === rfq.id}
                facts={[
                  { label: '关联需求', value: rfq.demandLabel },
                  { label: '供应商', value: rfq.supplierLabel },
                  { label: '响应', value: rfq.quoteLabel },
                  { label: '截止时间', value: rfq.deadlineLabel },
                ]}
                detailButton="table"
                onSelectDetail={() => setSelectedRfqId(rfq.id)}
              />
            ))}
          >
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">询价项目</th>
                  <th className="px-4 py-3">关联需求</th>
                  <th className="px-4 py-3">供应商</th>
                  <th className="px-4 py-3">响应</th>
                  <th className="px-4 py-3">截止时间</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {displayedRfqListRows.map((rfq) => (
                  <tr
                    key={rfq.id}
                    className={`align-top ${selectedRfq === rfq.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <td className="px-4 py-4">
                      <p className="font-black text-slate-900">{rfq.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{rfq.id}</p>
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-600">{rfq.demandLabel}</td>
                    <td className="px-4 py-4 font-mono font-bold text-slate-700">{rfq.supplierLabel}</td>
                    <td className="px-4 py-4">
                      <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-black text-blue-700">
                        {rfq.quoteLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-600">{rfq.deadlineLabel}</td>
                    <td className="px-4 py-4"><StatusPill label={rfq.status} /></td>
                    <td className="px-4 py-4">
                      <TableDetailButton
                        selected={selectedRfq === rfq.id}
                        onClick={() => setSelectedRfqId(rfq.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          )}
        </Panel>
        <RfqDetailPanelView
          detail={selectedRfqDetail}
          rfq={selectedRfqRecord}
          workspace={workspace}
          approvedAwardId={selectedRfqApprovedAwardId}
          rfqUpdateBusyId={rfqUpdateBusyId}
          awardSubmitBusyId={awardSubmitBusyId}
          orderCreateBusy={orderCreateBusy}
          javaEnabled={javaEnabled}
          awardDraft={selectedRfqRecord ? getAwardDraft(selectedRfqRecord.id) : undefined}
          orderDraft={selectedRfqApprovedAwardId ? getOrderDraft(selectedRfqApprovedAwardId) : undefined}
          onChangeAwardDraft={(rfqId, draft) => setAwardDrafts((drafts) => ({ ...drafts, [rfqId]: draft }))}
          onChangeOrderDraft={(awardId, draft) => setOrderDrafts((drafts) => ({ ...drafts, [awardId]: draft }))}
          onUpdateRfq={onUpdateRfq}
          onSubmitAwardApproval={onSubmitAwardApproval}
          onCreateOrderFromAward={onCreateOrderFromAward}
        />
      </>
      )}

      {activeModule === 'quotes' && (
      <>
      <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-emerald-700">比价定标演示台</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">从报价矩阵走到定标审批和订单生成</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-emerald-800">
              演示路径：先核对报价比较矩阵和推荐理由，再提交定标审批，审批通过后生成采购订单。
            </p>
          </div>
          <PrimaryActionButton
            onClick={() => onNavigateBuyerModule('orders')}
            icon={ShoppingCart}
            tone="emerald"
            size="md"
            flushTop
          >
            查看采购订单履约
          </PrimaryActionButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniFact label="可提交定标" value={`${quoteAwardSubmittableRfqCount} 个项目 / ${quoteAwardableQuoteCount} 条报价`} />
          <MiniFact label="推荐定标项目" value={`${quoteRecommendedRfqCount} 个`} />
          <MiniFact label="定标审批中" value={`${quoteAwardApprovalPendingCount} 个`} />
          <MiniFact label="生成订单后只读" value={`${quoteGeneratedOrderCount} 个`} />
        </div>
      </section>
      <Panel title="询价比价与定标" icon={BarChart3}>
        <ListToolbar
          title="比价定标池"
          recordCount={filteredQuoteRfqs.length}
          filterLabel={searchFilterLabel ?? '按询价项目聚合'}
          actionLabel="提交定标审批"
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="报价对比"
          selectedTitle={selectedQuoteComparisonDetail?.title}
          selectedMeta={selectedQuoteComparisonDetail?.id}
          selectedStatus={selectedQuoteComparisonDetail?.status}
          nextActionTitle={selectedQuoteComparisonDetail?.nextActionTitle}
          detailHint="右侧详情会核对报价比较矩阵、推荐定标理由、定标审批状态和生成订单条件。"
          boundaryHint="暂无报价不能定标；定标未审批通过前不生成采购订单。"
        />
        <DemoListLimitNotice
          moduleLabel="报价对比"
          totalCount={filteredQuoteRfqs.length}
          displayedCount={displayedQuoteRfqs.length}
        />
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-emerald-900">定标准备摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
                先确认推荐报价，再提交定标审批，审批通过后生成采购订单。
              </p>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-emerald-700">
              先确认推荐报价，再提交定标审批，审批通过后生成采购订单。
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="可定标报价" value={`${quoteAwardableQuoteCount} 条`} />
            <MiniFact label="推荐报价项目" value={`${quoteRecommendedRfqCount} 个`} />
            <MiniFact label="待审批定标" value={`${quoteAwardApprovalPendingCount} 个`} />
            <MiniFact label="已生成订单" value={`${quoteGeneratedOrderCount} 个`} />
          </div>
        </div>
        {filteredQuoteRfqs.length === 0 ? (
          <EmptyState title="暂无可比价项目" desc="创建询价并收到供应商报价后，可在这里推荐定标并提交审批。" />
        ) : (
        <div className="space-y-4">
          {displayedQuoteRfqs.map((rfq) => {
            const approvedAward = recentApprovals.find((approval) =>
              approval.bizType === 'rfq_award'
              && approval.parentBizId === rfq.id
              && approval.status === '已通过');
            return (
              <RfqCard
                key={rfq.id}
                rfq={rfq}
                workspace={workspace}
                approvedAwardId={approvedAward?.bizId}
                awardSubmitBusyId={awardSubmitBusyId}
                orderCreateBusy={orderCreateBusy}
                javaEnabled={javaEnabled}
                awardDraft={getAwardDraft(rfq.id)}
                orderDraft={approvedAward?.bizId ? getOrderDraft(approvedAward.bizId) : undefined}
                onChangeAwardDraft={(rfqId, draft) => setAwardDrafts((drafts) => ({ ...drafts, [rfqId]: draft }))}
                onChangeOrderDraft={(awardId, draft) => setOrderDrafts((drafts) => ({ ...drafts, [awardId]: draft }))}
                onSubmitAwardApproval={onSubmitAwardApproval}
                onCreateOrderFromAward={onCreateOrderFromAward}
                selected={selectedRfq === rfq.id}
                onSelectDetail={() => setSelectedRfqId(rfq.id)}
                demoHighlight={rfq.id === 'rfq-stage7-award-ready' || rfq.id === 'rfq-stage7-order-ready'
                  ? {
                      label: '阶段七比价定标样本',
                      testId: `stage9-demo-sample-rfq-${rfq.id}`,
                    }
                  : undefined}
              />
            );
          })}
        </div>
        )}
      </Panel>
      <QuoteComparisonDetailPanelView
        detail={selectedQuoteComparisonDetail}
        rfq={selectedRfqRecord}
        workspace={workspace}
        approvedAwardId={selectedRfqApprovedAwardId}
        awardSubmitBusyId={awardSubmitBusyId}
        orderCreateBusy={orderCreateBusy}
        javaEnabled={javaEnabled}
        awardDraft={selectedRfqRecord ? getAwardDraft(selectedRfqRecord.id) : undefined}
        orderDraft={selectedRfqApprovedAwardId ? getOrderDraft(selectedRfqApprovedAwardId) : undefined}
        onChangeAwardDraft={(rfqId, draft) => setAwardDrafts((drafts) => ({ ...drafts, [rfqId]: draft }))}
        onChangeOrderDraft={(awardId, draft) => setOrderDrafts((drafts) => ({ ...drafts, [awardId]: draft }))}
        onSubmitAwardApproval={onSubmitAwardApproval}
        onCreateOrderFromAward={onCreateOrderFromAward}
      />
      </>
      )}
    </div>
    )}

    {activeModule === 'materials' && (
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="物料目录" icon={Database}>
          <ListToolbar
            title="物料服务池"
            recordCount={filteredMaterialRows.length}
            filterLabel={searchFilterLabel ?? '全部物料品类'}
            actionLabel="新增物料"
          />
          <MaterialSaveForm
            title="新增物料"
            javaEnabled={javaEnabled}
            busy={materialSaveBusyId === 'new'}
            onSave={(payload) => onSaveMaterial(null, payload)}
          />
          <StatusFilterControl
            label="物料状态"
            value={materialStatusFilter}
            statusOptions={materialStatusOptions}
            onChange={setMaterialStatusFilter}
          />
          {filteredMaterialRows.length === 0 ? (
            <EmptyState title="暂无物料目录" desc="先维护物料或服务主数据，再用于采购需求明细和询价范围。" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {filteredMaterialRows.map((material) => (
                <AdminInfoCard
                  key={material.id}
                  title={material.title}
                  meta={material.usageLabel}
                  status={material.status}
                  facts={material.facts}
                  detailSelected={selectedMaterial === material.id}
                  onSelectDetail={() => setSelectedMaterialId(material.id)}
                />
              ))}
            </div>
          )}
        </Panel>
        <MaterialDetailPanelView
          detail={selectedMaterialDetail}
          material={selectedMaterialRecord}
          javaEnabled={javaEnabled}
          materialSaveBusyId={materialSaveBusyId}
          onSaveMaterial={onSaveMaterial}
        />
      </div>
    )}

    {(activeModule === 'suppliers' || activeModule === 'orders' || activeModule === 'contracts' || activeModule === 'invoices' || activeModule === 'receipts') && (
    <div className={`grid gap-6 ${activeModule === 'suppliers' ? '2xl:grid-cols-[minmax(0,1fr)_420px]' : '2xl:grid-cols-[minmax(0,1fr)_420px]'}`}>
      {activeModule === 'suppliers' && (
      <>
      <Panel title="私域供应商关系" icon={Users}>
        <ListToolbar
          title="私域供应商池"
          recordCount={filteredSupplierRelationRows.length}
          filterLabel={searchFilterLabel ?? '全部合作状态'}
          actionLabel="供应商准入"
        />
        <SupplierRelationCreateForm
          suppliers={workspace.suppliers}
          existingRelations={workspace.privateSupplierRelations}
          javaEnabled={javaEnabled}
          busy={supplierRelationBusyId === 'new'}
          onCreateSupplierRelation={onCreateSupplierRelation}
        />
        <StatusFilterControl
          label="合作状态"
          value={supplierStatusFilter}
          statusOptions={supplierStatusOptions}
          onChange={setSupplierStatusFilter}
        />
        {filteredSupplierRelationRows.length === 0 ? (
          <EmptyState title="暂无私域供应商" desc="平台公共供应商通过准入后，会形成采购方自己的合作关系和绩效记录。" />
        ) : (
        <div className="space-y-3">
          {filteredSupplierRelationRows.map((relationRow) => {
            const relation = workspace.privateSupplierRelations.find((item) => item.id === relationRow.id);
            const supplierAdmissionDraft = relation ? getSupplierAdmissionDraft(relation) : undefined;
            return (
              <AdminInfoCard
                key={relationRow.id}
                title={relationRow.supplierName}
                meta={relationRow.categoryLabel}
                status={relationRow.status}
                badge={relationRow.level}
                facts={relationRow.facts}
                detailSelected={selectedSupplierRelation === relationRow.id}
                onSelectDetail={() => setSelectedSupplierRelationId(relationRow.id)}
              >
                <div className="mt-3 flex justify-end">
                  <span className="rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs font-black text-slate-700">
                    {relationRow.action.riskLabel}
                  </span>
                </div>
                <SupplierRelationNotice action={relationRow.action} />
                {javaEnabled && relation && supplierAdmissionDraft && relationRow.status === '待准入' && (
                  <SupplierAdmissionForm
                    relationId={relationRow.id}
                    categoryLabel={relation.categories.join(' / ')}
                    draft={supplierAdmissionDraft}
                    busy={supplierAdmissionBusyId === relationRow.id}
                    onChange={(draft) => setSupplierAdmissionDrafts((drafts) => ({ ...drafts, [relationRow.id]: draft }))}
                    onSubmit={() => onSubmitSupplierAdmission(relationRow.id, supplierAdmissionDraft)}
                  />
                )}
              </AdminInfoCard>
            );
          })}
        </div>
        )}
      </Panel>
      <SupplierDetailPanelView
        detail={selectedSupplierDetail}
        relation={selectedSupplierRelationRecord}
        javaEnabled={javaEnabled}
        supplierAdmissionBusyId={supplierAdmissionBusyId}
        supplierRelationBusyId={supplierRelationBusyId}
        admissionDraft={selectedSupplierRelationRecord ? getSupplierAdmissionDraft(selectedSupplierRelationRecord) : undefined}
        onChangeAdmissionDraft={(relationId, draft) => setSupplierAdmissionDrafts((drafts) => ({ ...drafts, [relationId]: draft }))}
        onSubmitSupplierAdmission={onSubmitSupplierAdmission}
        onSaveSupplierRelationProfile={onSaveSupplierRelationProfile}
        onSaveSupplierRelationStatus={onSaveSupplierRelationStatus}
        onSaveSupplierRelationPerformance={onSaveSupplierRelationPerformance}
      />
      </>
      )}

      {activeModule === 'orders' && (
      <>
      <section className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-cyan-700">订单履约演示台</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">定标结果进入订单履约跟踪</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-cyan-800">
              演示路径：从定标审批通过生成订单，跟进供应商确认、发货和预计到货，再进入收货验收。
            </p>
          </div>
          <PrimaryActionButton
            onClick={() => onNavigateBuyerModule('receipts')}
            icon={PackageCheck}
            size="md"
            flushTop
          >
            进入收货验收
          </PrimaryActionButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniFact label="待生成订单" value={`${orderPendingGenerationCount} 个`} />
          <MiniFact label="待供应商确认" value={`${orderPendingSupplierConfirmCount} 单`} />
          <MiniFact label="待发货" value={`${orderPendingShipmentCount} 单`} />
          <MiniFact label="待收货" value={`${orderPendingReceiptCount} 单`} />
          <MiniFact label="已完成" value={`${orderFulfillmentCompletedCount} 单`} />
        </div>
      </section>
      <Panel title="订单履约" icon={PackageCheck}>
        <ListToolbar
          title="订单履约池"
          recordCount={filteredOrderFulfillmentRows.length}
          filterLabel={searchFilterLabel ?? '全部订单状态'}
          actionLabel="生成订单"
        />
        <StatusFilterControl
          label="订单状态"
          value={orderStatusFilter}
          statusOptions={orderStatusOptions}
          onChange={setOrderStatusFilter}
        />
        <FilterResultSummary
          label="采购订单筛选结果"
          filterLabel={orderStatusFilter}
          resultCount={filteredOrderFulfillmentRows.length}
          totalCount={orderFulfillmentRows.length}
          selectedLabel={selectedOrderDetail?.id}
          onClear={() => setOrderStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="采购订单"
          selectedTitle={selectedOrderDetail?.id}
          selectedMeta={selectedOrderDetail?.supplierName}
          selectedStatus={selectedOrderDetail?.status}
          nextActionTitle={selectedOrderDetail?.nextActionTitle}
          detailHint="右侧详情会核对供应商确认、发货、收货、预计到货日期和发票付款状态。"
          boundaryHint="供应商未发货前不能登记收货；已收货订单不再修改预计到货日期。"
        />
        <DemoListLimitNotice
          moduleLabel="采购订单"
          totalCount={filteredOrderFulfillmentRows.length}
          displayedCount={displayedOrderFulfillmentRows.length}
        />
        <div className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-cyan-900">订单履约推进摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-cyan-700">
                先生成采购订单，再跟进供应商确认、发货和收货验收。
              </p>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-cyan-700">
              先生成采购订单，再跟进供应商确认、发货和收货验收。
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MiniFact label="待生成订单" value={`${orderPendingGenerationCount} 个`} />
            <MiniFact label="待供应商确认" value={`${orderPendingSupplierConfirmCount} 单`} />
            <MiniFact label="待发货" value={`${orderPendingShipmentCount} 单`} />
            <MiniFact label="待收货" value={`${orderPendingReceiptCount} 单`} />
            <MiniFact label="已完成" value={`${orderFulfillmentCompletedCount} 单`} />
          </div>
        </div>
        {filteredOrderFulfillmentRows.length === 0 ? (
          <EmptyState title="暂无采购订单" desc="定标审批通过后，可在报价对比页生成采购订单。" />
        ) : (
        <div className="space-y-3">
          {displayedOrderFulfillmentRows.map((orderRow) => {
            const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
            const receiptDraft = getReceiptDraft(orderRow.id);
            const receiptDraftInvalid = receiptDraft.result.trim().length === 0
              || receiptDraft.receiptRemark.trim().length === 0
              || (receiptDraft.result === '异常待处理' && receiptDraft.exceptionReason.trim().length === 0);
            return (
              <WorkflowListCard
                key={orderRow.id}
                title={orderRow.id}
                meta={orderRow.supplierName}
                amountLabel={orderRow.amountLabel}
                facts={orderRow.facts}
                status={orderRow.status}
                nextAction={orderRow.nextAction}
                detailSelected={selectedOrder === orderRow.id}
                onSelectDetail={() => setSelectedOrderId(orderRow.id)}
                action={javaEnabled && orderRow.canRegisterReceipt ? (
                  <InlineWorkflowAction
                    title="快捷登记收货"
                    desc="右侧详情可补充验收备注、异常原因和附件清单。"
                    tone="emerald"
                  >
                    <label className="block">
                      <span className="text-xs font-black text-emerald-700">验收结果</span>
                      <select
                        value={receiptDraft.result}
                        onChange={(event) => updateReceiptDraft(orderRow.id, { result: event.target.value })}
                        className="mt-1 h-9 w-full rounded-lg border border-emerald-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400"
                      >
                        <option value="验收通过">验收通过</option>
                        <option value="异常待处理">异常待处理</option>
                      </select>
                    </label>
                    <PrimaryActionButton
                      onClick={() => onCreateReceipt(orderRow.id, receiptDraft)}
                      disabled={receiptBusy || receiptDraftInvalid}
                      busy={receiptBusy}
                      tone="emerald"
                      pendingLabel="登记中"
                      flushTop
                    >
                      登记收货
                    </PrimaryActionButton>
                  </InlineWorkflowAction>
                  ) : undefined}
              />
            );
          })}
        </div>
        )}
      </Panel>
      <OrderDetailPanelView
        detail={selectedOrderDetail}
        order={selectedOrderRecord}
        javaEnabled={javaEnabled}
        orderUpdateBusyId={orderUpdateBusyId}
        buyerFulfillmentBusyId={buyerFulfillmentBusyId}
        receiptDraft={selectedOrderRecord ? getReceiptDraft(selectedOrderRecord.id) : undefined}
        onChangeReceiptDraft={(orderId, draft) => setReceiptDrafts((drafts) => ({ ...drafts, [orderId]: draft }))}
        onUpdateOrder={onUpdateOrder}
        onCreateReceipt={onCreateReceipt}
      />
      </>
      )}

      {activeModule === 'contracts' && (
      <>
      <DemoCommandCenterPanel
        eyebrow="阶段十合同演示总线"
        title="合同管理承接订单演示路径"
        subtitle="把采购订单、合同审批、履约事件、收货验收和发票付款收束成一条可点击讲解路径。"
        items={contractDemoCommandCenterItems}
        currentGuide={contractDemoCurrentActionGuide}
        sequenceNavigation={contractDemoSequenceNavigation}
        testId="stage10-contract-demo-command-center"
      />
      <DemoReadinessPanel
        title="合同演示准备检查"
        subtitle="开场前确认 Java 合同台账、推荐合同样本、路径复核证据和阶段边界。"
        status={recommendedContractSample ? '推荐合同样本已准备' : '等待合同样本'}
        items={contractDemoReadinessItems}
        testId="stage10-contract-demo-readiness"
      />
      <ContractDeepeningDemoReadinessPanel
        items={contractDeepeningReadinessItems}
        javaEnabled={javaEnabled}
      />
      <ContractSavePanel
        workspace={workspace}
        selectedContract={selectedContractRecord}
        javaEnabled={javaEnabled}
        busyId={buyerFulfillmentBusyId}
        onSaveContract={onSaveContract}
      />
      <Panel title="合同台账" icon={FileText}>
        <ListToolbar
          title="合同台账"
          recordCount={filteredContractLedgerRows.length}
          filterLabel={searchFilterLabel ?? '全部合同状态'}
          actionLabel="合同详情"
        />
        <StatusFilterControl
          label="合同状态"
          value={contractStatusFilter}
          statusOptions={contractStatusOptions}
          onChange={setContractStatusFilter}
        />
        <FilterResultSummary
          label="合同台账筛选结果"
          filterLabel={contractStatusFilter}
          resultCount={filteredContractLedgerRows.length}
          totalCount={contractLedgerRows.length}
          selectedLabel={selectedContractDetail?.contractNo}
          onClear={() => setContractStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="合同管理"
          selectedTitle={selectedContractDetail?.contractNo}
          selectedMeta={selectedContractDetail?.supplierName}
          selectedStatus={selectedContractDetail?.status}
          nextActionTitle={selectedContractDetail?.nextActionTitle}
          detailHint="右侧合同详情会串联采购订单、收货验收、发票付款和合同归档。"
          boundaryHint={contractBoundaryHint}
        />
        <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-indigo-900">合同管理推进摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-indigo-700">
                先基于采购订单形成合同台账，再跟进合同审批、履约状态和归档边界。
              </p>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-indigo-700">
              {contractDataSourceLabel}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="合同数量" value={`${contractLedgerRows.length} 份`} />
            <MiniFact label="草案" value={`${contractDraftCount} 份`} />
            <MiniFact label="生效/履约" value={`${contractActiveCount} 份`} />
            <MiniFact label="已归档" value={`${contractArchivedCount} 份`} />
          </div>
        </div>
        {filteredContractLedgerRows.length === 0 ? (
          <EmptyState title="暂无合同记录" desc="定标并生成采购订单后，会先以订单数据派生合同台账雏形。" />
        ) : (
        <div className="space-y-3">
          {filteredContractLedgerRows.map((contractRow) => (
            <WorkflowListCard
              key={contractRow.id}
              title={contractRow.contractNo}
              meta={`${contractRow.contractName} · 关联订单 ${contractRow.relatedOrderId}`}
              amountLabel={contractRow.amountLabel}
              facts={contractRow.facts}
              status={contractRow.status}
              nextAction={contractRow.nextAction}
              detailSelected={selectedContract === contractRow.id}
              onSelectDetail={() => setSelectedContractId(contractRow.id)}
              demoHighlight={recommendedContractSample?.id === contractRow.id ? {
                label: '推荐合同样本',
                testId: `stage10-demo-sample-contract-${contractRow.id}`,
              } : undefined}
            >
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-black text-slate-700">
                  {contractRow.archiveStatus}
                </span>
                <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                  {contractDataSourceLabel}
                </span>
              </div>
            </WorkflowListCard>
          ))}
        </div>
        )}
      </Panel>
      <ContractDetailPanelView
        detail={selectedContractDetail}
        attachments={selectedContract ? contractAttachmentsById[selectedContract] ?? [] : []}
        uploadTicket={selectedContract ? contractAttachmentUploadTicketsById[selectedContract] : undefined}
        downloadLinksById={contractAttachmentDownloadLinksById}
        fulfillmentEvents={selectedContract ? contractFulfillmentEventsById[selectedContract] ?? [] : []}
        targetAuditLogs={selectedContract ? contractTargetAuditLogsById[selectedContract] ?? [] : []}
        javaEnabled={javaEnabled}
        buyerFulfillmentBusyId={buyerFulfillmentBusyId}
        onLoadAttachments={onLoadContractAttachments}
        onCreateAttachment={onCreateContractAttachment}
        onCreateUploadTicket={onCreateContractAttachmentUploadTicket}
        onCreateDownloadLink={onCreateContractAttachmentDownloadLink}
        onSubmitContractApproval={onSubmitContractApproval}
        onUpdateContractStatus={onUpdateContractStatus}
        onArchiveContract={onArchiveContract}
        onNavigateBuyerModule={(moduleId) => navigateBuyerModuleFromContract(moduleId, selectedContractDetail)}
        onNavigateArchiveReviewSuggestion={(suggestion) => navigateBuyerModuleFromArchiveReviewSuggestion(suggestion, selectedContractDetail)}
        linkedActionResult={contractLinkedActionResult?.contractNo === selectedContractDetail?.contractNo ? contractLinkedActionResult : undefined}
      />
      </>
      )}

      {activeModule === 'receipts' && (
      <>
        <section className="rounded-lg border border-lime-100 bg-lime-50 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-lime-700">收货验收演示台</p>
              <h3 className="mt-1 text-lg font-black text-slate-950">把物流到货转成可开票的验收结果</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-lime-800">
                演示路径：供应商发货后登记收货验收，异常先记录原因，验收完成后进入发票付款。
              </p>
            </div>
            <PrimaryActionButton
              onClick={() => onNavigateBuyerModule('invoices')}
              icon={Receipt}
              tone="emerald"
              size="md"
              flushTop
            >
              进入发票付款
            </PrimaryActionButton>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MiniFact label="待发货" value={`${receiptPendingShipmentCount} 单`} />
            <MiniFact label="待收货" value={`${receiptPendingArrivalCount} 单`} />
            <MiniFact label="可登记验收" value={`${receiptReadyForInspectionCount} 单`} />
            <MiniFact label="异常待处理" value={`${receiptExceptionPendingCount} 单`} />
            <MiniFact label="已验收" value={`${receiptCompletedCount} 单`} />
          </div>
        </section>
        <Panel title="收货验收" icon={PackageCheck}>
          <ListToolbar
            title="收货验收池"
            recordCount={filteredReceiptInspectionRows.length}
            filterLabel={searchFilterLabel ?? '待收货优先'}
            actionLabel="登记收货"
          />
          <StatusFilterControl
            label="收货状态"
            value={receiptStatusFilter}
            statusOptions={receiptStatusOptions}
            onChange={setReceiptStatusFilter}
          />
          <FilterResultSummary
            label="收货验收筛选结果"
            filterLabel={receiptStatusFilter}
            resultCount={filteredReceiptInspectionRows.length}
            totalCount={receiptInspectionRows.length}
            selectedLabel={selectedReceiptDetail?.id}
            onClear={() => setReceiptStatusFilter('全部状态')}
          />
          <DemoListLimitNotice
            moduleLabel="收货验收"
            totalCount={filteredReceiptInspectionRows.length}
            displayedCount={displayedReceiptInspectionRows.length}
          />
          {receiptContractTargetFocus && (
            <div id="contract-target-focus" className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
              <p className="text-xs font-black text-cyan-900">
                {receiptContractTargetFocus.archiveReviewGapItem ? '来自归档复核建议' : '来自合同联动'}
              </p>
              <p className="mt-1 text-xs font-bold leading-5 text-cyan-700">
                已从 {receiptContractTargetFocus.sourceLabel} 跳转并聚焦订单 {receiptContractTargetFocus.orderId}，可在当前页登记或复核收货验收。
              </p>
              {receiptContractTargetFocus.archiveReviewGapItem && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="归档复核缺口" value={receiptContractTargetFocus.archiveReviewGapItem} />
                  <MiniFact label="建议处理动作" value={receiptContractTargetFocus.archiveReviewSuggestedAction ?? '待处理'} />
                  <MiniFact label="建议处理路径" value={receiptContractTargetFocus.archiveReviewHandlingPath ?? '按当前模块处理'} />
                </div>
              )}
            </div>
          )}
          <div className="rounded-lg border border-lime-100 bg-lime-50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black text-lime-900">收货验收推进摘要</p>
                <p className="mt-1 text-xs font-bold leading-5 text-lime-700">
                  先跟进供应商发货，再登记收货验收并处理异常。
                </p>
              </div>
              <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-lime-700">
                先跟进供应商发货，再登记收货验收并处理异常。
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <MiniFact label="待发货" value={`${receiptPendingShipmentCount} 单`} />
              <MiniFact label="待收货" value={`${receiptPendingArrivalCount} 单`} />
              <MiniFact label="可登记验收" value={`${receiptReadyForInspectionCount} 单`} />
              <MiniFact label="异常待处理" value={`${receiptExceptionPendingCount} 单`} />
              <MiniFact label="已验收" value={`${receiptCompletedCount} 单`} />
            </div>
          </div>
          {filteredReceiptInspectionRows.length === 0 ? (
            <EmptyState title="暂无待收货订单" desc="供应商发货后，待收货订单会出现在这里。" />
          ) : (
          <div className="space-y-3">
            {displayedReceiptInspectionRows
              .map((orderRow) => {
                const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
                const highlightedByContract = receiptContractTargetFocus?.orderId === orderRow.id;
                const receiptDraft = getReceiptDraft(orderRow.id);
                const receiptDraftInvalid = receiptDraft.result.trim().length === 0
                  || receiptDraft.receiptRemark.trim().length === 0
                  || (receiptDraft.result === '异常待处理' && receiptDraft.exceptionReason.trim().length === 0);
                const contractActionGuard = highlightedByContract
                  ? {
                      contractNo: receiptContractTargetFocus.contractNo,
                      title: '合同来源确认',
                      desc: `目标单据已锁定：仅处理当前合同关联订单 ${receiptContractTargetFocus.orderId}。`,
                    }
                  : null;
                return (
                  <WorkflowListCard
                    key={orderRow.id}
                    title={orderRow.id}
                    meta={`${orderRow.supplierName} · ${orderRow.logisticsLabel}`}
                    facts={[{ label: '物流单号', value: orderRow.logisticsLabel }]}
                    status={orderRow.status}
                    nextAction={orderRow.nextAction}
                    detailSelected={selectedReceiptOrder === orderRow.id}
                    onSelectDetail={() => setSelectedReceiptOrderId(orderRow.id)}
                    demoHighlight={orderRow.id === 'po-stage7-receipt-ready'
                      ? {
                          label: '阶段七待收货订单样本',
                          testId: `stage9-demo-sample-receipt-${orderRow.id}`,
                        }
                      : undefined}
                    action={javaEnabled && orderRow.canRegisterReceipt ? (
                      <InlineWorkflowAction
                        title="快捷登记收货"
                        desc="右侧详情可补充验收备注、异常原因和附件清单。"
                        tone="emerald"
                      >
                        {contractActionGuard && (
                          <p className="rounded-lg border border-cyan-100 bg-white p-2 text-xs font-black leading-5 text-cyan-800">
                            {contractActionGuard.title}：{contractActionGuard.contractNo}。{contractActionGuard.desc}
                          </p>
                        )}
                        <label className="block">
                          <span className="text-xs font-black text-emerald-700">验收结果</span>
                          <select
                            value={receiptDraft.result}
                            onChange={(event) => updateReceiptDraft(orderRow.id, { result: event.target.value })}
                            className="mt-1 h-9 w-full rounded-lg border border-emerald-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400"
                          >
                            <option value="验收通过">验收通过</option>
                            <option value="异常待处理">异常待处理</option>
                          </select>
                        </label>
                        <PrimaryActionButton
                          onClick={() => {
                            createReceiptFromContractFocus(orderRow.id);
                            onCreateReceipt(orderRow.id, receiptDraft);
                          }}
                          disabled={receiptBusy || receiptDraftInvalid}
                          busy={receiptBusy}
                          tone="emerald"
                          pendingLabel="登记中"
                          flushTop
                        >
                          登记收货
                        </PrimaryActionButton>
                      </InlineWorkflowAction>
                    ) : undefined}
                  >
                    {highlightedByContract && (
                      <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-xs font-black text-cyan-800">
                        合同联动高亮：来自 {receiptContractTargetFocus.contractNo} 的目标收货记录。
                      </div>
                    )}
                  </WorkflowListCard>
                );
              })}
          </div>
          )}
        </Panel>
        <ReceiptInspectionDetailPanelView
          detail={selectedReceiptDetail}
          order={selectedReceiptOrderRecord}
          busy={buyerFulfillmentBusyId === `receipt:${selectedReceiptOrder}`}
          javaEnabled={javaEnabled}
          receiptDraft={selectedReceiptOrderRecord ? getReceiptDraft(selectedReceiptOrderRecord.id) : undefined}
          onChangeReceiptDraft={(orderId, draft) => setReceiptDrafts((drafts) => ({ ...drafts, [orderId]: draft }))}
          onCreateReceipt={onCreateReceipt}
        />
      </>
      )}

      {activeModule === 'invoices' && (
      <>
      <section className="rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-fuchsia-700">发票付款演示台</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">把发票、对账和付款状态收束成闭环</h3>
            <p className="mt-2 text-sm font-bold leading-6 text-fuchsia-800">
              演示路径：供应商提交发票后完成对账，处理差异和付款计划，最后登记付款状态。
            </p>
          </div>
          <PrimaryActionButton
            onClick={() => onNavigateBuyerModule('dashboard')}
            icon={LayoutDashboard}
            tone="red"
            size="md"
            flushTop
          >
            主流程演示闭环
          </PrimaryActionButton>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniFact label="待开票" value={`${invoicePendingIssueCount} 单`} />
          <MiniFact label="待对账" value={`${invoicePendingReconciliationCount} 张`} />
          <MiniFact label="差异待处理" value={`${invoiceVariancePendingCount} 张`} />
          <MiniFact label="待付款" value={`${invoicePendingPaymentCount} 张`} />
          <MiniFact label="已付款" value={`${invoicePaidCount} 张`} />
        </div>
      </section>
      <Panel title="发票付款" icon={Receipt}>
        <ListToolbar
          title="发票付款池"
          recordCount={filteredInvoicePaymentRows.length}
          filterLabel={searchFilterLabel ?? '待付款优先'}
          actionLabel="登记付款"
        />
        <StatusFilterControl
          label="付款状态"
          value={invoiceStatusFilter}
          statusOptions={invoiceStatusOptions}
          onChange={setInvoiceStatusFilter}
        />
        <FilterResultSummary
          label="发票付款筛选结果"
          filterLabel={invoiceStatusFilter}
          resultCount={filteredInvoicePaymentRows.length}
          totalCount={invoicePaymentRows.length}
          selectedLabel={selectedInvoiceDetail?.id}
          onClear={() => setInvoiceStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="发票付款"
          selectedTitle={selectedInvoiceDetail?.id}
          selectedMeta={selectedInvoiceDetail?.supplierName}
          selectedStatus={selectedInvoiceDetail?.status}
          nextActionTitle={selectedInvoiceDetail?.nextActionTitle}
          detailHint="右侧详情会核对订单上下文、对账单摘要、付款计划、差异处理和付款轨迹。"
          boundaryHint="存在对账差异时先处理差异；已付款发票不再修改付款状态。"
        />
        <DemoListLimitNotice
          moduleLabel="发票付款"
          totalCount={filteredInvoicePaymentRows.length}
          displayedCount={displayedInvoicePaymentRows.length}
        />
        {invoiceContractTargetFocus && (
          <div id="contract-target-focus" className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
            <p className="text-xs font-black text-cyan-900">
              {invoiceContractTargetFocus.archiveReviewGapItem ? '来自归档复核建议' : '来自合同联动'}
            </p>
            <p className="mt-1 text-xs font-bold leading-5 text-cyan-700">
              已从 {invoiceContractTargetFocus.sourceLabel} 跳转并聚焦发票 {invoiceContractTargetFocus.invoiceId ?? '待开票'}，可在当前页处理付款或差异。
            </p>
            {invoiceContractTargetFocus.archiveReviewGapItem && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <MiniFact label="归档复核缺口" value={invoiceContractTargetFocus.archiveReviewGapItem} />
                <MiniFact label="建议处理动作" value={invoiceContractTargetFocus.archiveReviewSuggestedAction ?? '待处理'} />
                <MiniFact label="建议处理路径" value={invoiceContractTargetFocus.archiveReviewHandlingPath ?? '按当前模块处理'} />
              </div>
            )}
          </div>
        )}
        <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black text-fuchsia-900">发票付款推进摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-fuchsia-700">
                先完成开票和对账，再处理差异并登记付款。
              </p>
            </div>
            <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-fuchsia-700">
              先完成开票和对账，再处理差异并登记付款。
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MiniFact label="待开票" value={`${invoicePendingIssueCount} 单`} />
            <MiniFact label="待对账" value={`${invoicePendingReconciliationCount} 张`} />
            <MiniFact label="差异待处理" value={`${invoiceVariancePendingCount} 张`} />
            <MiniFact label="待付款" value={`${invoicePendingPaymentCount} 张`} />
            <MiniFact label="已付款" value={`${invoicePaidCount} 张`} />
          </div>
        </div>
        <ReconciliationLedgerPanel
          title="应付对账单台账"
          invoices={workspace.invoices}
          paymentBatches={paymentBatches}
          paymentExecutionRecords={paymentExecutionRecords}
          paymentBlockResolutions={paymentBlockResolutions}
          paymentArchiveExceptionRequests={paymentArchiveExceptionRequests}
          paymentRequests={paymentRequests}
          varianceHandlings={varianceHandlings}
          auditLogs={workspace.auditLogs}
          statusFilter={reconciliationLedgerStatusFilter}
          onChangeStatusFilter={setReconciliationLedgerStatusFilter}
          javaEnabled={javaEnabled}
          buyerFulfillmentBusyId={buyerFulfillmentBusyId}
          onUpdatePaymentBatchStatus={updatePaymentBatchStatus}
          onCreatePaymentArchiveExceptionRequest={onCreatePaymentArchiveExceptionRequest}
          onCompletePaymentArchiveExceptionAction={onCompletePaymentArchiveExceptionAction}
          onClosePaymentArchiveExceptionRequest={onClosePaymentArchiveExceptionRequest}
          onUpdatePaymentRequestStatus={onUpdatePaymentRequestStatus}
          onSavePaymentBlockResolutionStatus={onSavePaymentBlockResolutionStatus}
          onUpdateVarianceHandlingStatus={onUpdateVarianceHandlingStatus}
          onRebuildThreeWayMatches={onRebuildThreeWayMatches}
          onRegisterPayment={onRegisterPayment}
          onRegisterPaymentExecutionRecord={onRegisterPaymentExecutionRecord}
          onSelectInvoiceForReview={(invoiceId) => {
            setInvoiceStatusFilter('全部状态');
            setSelectedInvoiceId(invoiceId);
          }}
          scope="buyer"
        />
        {filteredInvoicePaymentRows.length === 0 ? (
          <EmptyState title="暂无发票" desc="供应商在订单收货后提交发票，采购方在这里登记付款状态。" />
        ) : (
        <div className="space-y-3">
          {displayedInvoicePaymentRows.map((invoiceRow) => {
            const paymentBusy = buyerFulfillmentBusyId === `payment:${invoiceRow.id}`;
            const highlightedByContract = invoiceContractTargetFocus?.invoiceId === invoiceRow.id;
            const paymentDraft = getPaymentDraft(invoiceRow.id);
            const paymentDraftInvalid = paymentDraft.paymentStatus.trim().length === 0
              || paymentDraft.paymentRemark.trim().length === 0
              || paymentDraft.paymentRequestStatus.trim().length === 0
              || paymentDraft.reconciliationNote.trim().length === 0;
            const contractActionGuard = highlightedByContract
              ? {
                  contractNo: invoiceContractTargetFocus.contractNo,
                  title: '合同来源确认',
                  desc: `目标单据已锁定：仅处理当前合同关联发票 ${invoiceContractTargetFocus.invoiceId ?? invoiceRow.id}。`,
                }
              : null;
            return (
              <WorkflowListCard
                key={invoiceRow.id}
                title={invoiceRow.id}
                meta={`${invoiceRow.supplierName} · ${invoiceRow.orderLabel}`}
                amountLabel={invoiceRow.amountLabel}
                status={invoiceRow.status}
                nextAction={invoiceRow.nextAction}
                detailSelected={selectedInvoice === invoiceRow.id}
                onSelectDetail={() => setSelectedInvoiceId(invoiceRow.id)}
                demoHighlight={invoiceRow.id === 'inv-stage7-payment-ready'
                  ? {
                      label: '阶段七待付款发票样本',
                      testId: `stage9-demo-sample-invoice-${invoiceRow.id}`,
                    }
                  : undefined}
                action={javaEnabled && invoiceRow.canRegisterPayment ? (
                  <InlineWorkflowAction
                    title="快捷登记付款"
                    desc="右侧详情可补充付款备注、付款申请状态和对账说明。"
                  >
                    {contractActionGuard && (
                      <p className="rounded-lg border border-cyan-100 bg-white p-2 text-xs font-black leading-5 text-cyan-800">
                        {contractActionGuard.title}：{contractActionGuard.contractNo}。{contractActionGuard.desc}
                      </p>
                    )}
                    <label className="block">
                      <span className="text-xs font-black text-blue-700">付款状态</span>
                      <select
                        value={paymentDraft.paymentStatus}
                        onChange={(event) => updatePaymentDraft(invoiceRow.id, { paymentStatus: event.target.value })}
                        className="mt-1 h-9 w-full rounded-lg border border-blue-100 bg-white px-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-400"
                      >
                        <option value="部分付款">部分付款</option>
                        <option value="已付款">已付款</option>
                      </select>
                    </label>
                    <PrimaryActionButton
                      onClick={() => {
                        registerPaymentFromContractFocus(invoiceRow.id);
                        onRegisterPayment(invoiceRow.id, paymentDraft);
                      }}
                      disabled={paymentBusy || paymentDraftInvalid}
                      busy={paymentBusy}
                      pendingLabel="登记中"
                      flushTop
                      testId={`stage7-register-payment-${invoiceRow.id}`}
                    >
                      登记付款
                    </PrimaryActionButton>
                  </InlineWorkflowAction>
                  ) : undefined}
              >
                {highlightedByContract && (
                  <div className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-xs font-black text-cyan-800">
                    合同联动高亮：来自 {invoiceContractTargetFocus.contractNo} 的目标发票记录。
                  </div>
                )}
              </WorkflowListCard>
            );
          })}
        </div>
        )}
      </Panel>
      <InvoicePaymentDetailPanelView
        detail={selectedInvoiceDetail}
        invoice={selectedInvoiceRecord}
        paymentRequest={selectedPaymentRequestRecord}
        varianceHandling={selectedVarianceHandlingRecord}
        busy={buyerFulfillmentBusyId === `payment:${selectedInvoice}`
          || buyerFulfillmentBusyId === `payment-request:${selectedInvoice}`
          || buyerFulfillmentBusyId === `variance:${selectedInvoice}`}
        invoiceUpdateBusyId={invoiceUpdateBusyId}
        javaEnabled={javaEnabled}
        paymentDraft={selectedInvoiceRecord ? getPaymentDraft(selectedInvoiceRecord.id) : undefined}
        onChangePaymentDraft={(invoiceId, draft) => setPaymentDrafts((drafts) => ({ ...drafts, [invoiceId]: draft }))}
        onRegisterPayment={onRegisterPayment}
        onCreatePaymentRequest={onCreatePaymentRequest}
        onCreateVarianceHandling={onCreateVarianceHandling}
        onUpdatePaymentRequestStatus={onUpdatePaymentRequestStatus}
        onUpdateVarianceHandlingStatus={onUpdateVarianceHandlingStatus}
        onUpdateInvoice={onUpdateInvoice}
      />
      </>
      )}
    </div>
    )}

    {activeModule === 'audit' && (
      <Panel title="最近操作日志" icon={ShieldCheck}>
        <AuditLogList workspace={workspace} searchQuery={searchQuery} />
      </Panel>
    )}
    </>
  );
};

const contractDraftFromOrder = (workspace: BuyerWorkspace, orderId: string): BuyerContractDraft => {
  const order = workspace.orders.find((item) => item.id === orderId) ?? workspace.orders[0];
  const supplier = order ? workspace.suppliers.find((item) => item.id === order.supplierId) : undefined;
  const effectiveDate = new Date().toISOString().slice(0, 10);
  return {
    relatedOrderId: order?.id ?? '',
    contractNo: order ? `CTR-${order.id.toUpperCase()}` : '',
    contractName: order ? `${supplier?.name ?? order.supplierId}采购合同` : '',
    amount: order?.amount ?? 0,
    status: '已生效',
    fulfillmentProgress: '履约中',
    effectiveDate,
  };
};

const contractDraftFromContract = (contract: ContractLedgerItem): BuyerContractDraft => ({
  relatedOrderId: contract.relatedOrderId,
  contractNo: contract.contractNo,
  contractName: contract.contractName,
  amount: contract.amount,
  status: contract.status,
  fulfillmentProgress: contract.fulfillmentProgress,
  effectiveDate: contract.effectiveDate ?? new Date().toISOString().slice(0, 10),
});

const ContractSavePanel: React.FC<{
  workspace: BuyerWorkspace;
  selectedContract?: ContractLedgerItem;
  javaEnabled: boolean;
  busyId: string | null;
  onSaveContract: (mode: 'create' | 'update', contractId: string | null, draft: BuyerContractDraft) => void;
}> = ({ workspace, selectedContract, javaEnabled, busyId, onSaveContract }) => {
  const contractOrderIds = new Set((workspace.contracts ?? []).map((contract) => contract.relatedOrderId));
  const createOrder = workspace.orders.find((order) => !contractOrderIds.has(order.id)) ?? workspace.orders[0];
  const [mode, setMode] = useState<'create' | 'update'>('create');
  const [draft, setDraft] = useState<BuyerContractDraft>(() => contractDraftFromOrder(workspace, createOrder?.id ?? ''));
  const updateDraft = (patch: Partial<BuyerContractDraft>) => setDraft((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (mode === 'update' && selectedContract) {
      setDraft(contractDraftFromContract(selectedContract));
      return;
    }
    setDraft(contractDraftFromOrder(workspace, createOrder?.id ?? ''));
  }, [mode, selectedContract?.id, createOrder?.id, workspace]);

  const selectedOrder = workspace.orders.find((order) => order.id === draft.relatedOrderId);
  const selectedSupplier = selectedOrder ? workspace.suppliers.find((supplier) => supplier.id === selectedOrder.supplierId) : undefined;
  const busy = busyId === `contract-save:${mode}`;
  const editingArchived = mode === 'update' && selectedContract?.archiveStatus === '已归档';
  const missingEditableContract = mode === 'update' && !selectedContract;
  const invalid = !draft.contractNo.trim()
    || !draft.contractName.trim()
    || !draft.relatedOrderId
    || draft.amount <= 0
    || !draft.status.trim()
    || !draft.fulfillmentProgress.trim()
    || !draft.effectiveDate;
  const disabled = !javaEnabled || busy || invalid || missingEditableContract || editingArchived;

  return (
    <Panel title="合同保存" icon={FileText}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black text-slate-700">合同保存入口</p>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
              基于采购订单创建合同台账；编辑仅开放给未归档的 Java 合同记录。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`h-9 rounded-md px-3 text-xs font-black ${mode === 'create' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
            >
              新建合同
            </button>
            <button
              type="button"
              onClick={() => setMode('update')}
              className={`h-9 rounded-md px-3 text-xs font-black ${mode === 'update' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'}`}
            >
              编辑选中合同
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-order">
            关联采购订单
            <select
              id="contract-save-order"
              value={draft.relatedOrderId}
              disabled={mode === 'update'}
              onChange={(event) => setDraft(contractDraftFromOrder(workspace, event.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            >
              {workspace.orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.id} · {order.status}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-no">
            合同编号
            <input
              id="contract-save-no"
              value={draft.contractNo}
              onChange={(event) => updateDraft({ contractNo: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-black text-slate-600 lg:col-span-2" htmlFor="contract-save-name">
            合同名称
            <input
              id="contract-save-name"
              value={draft.contractName}
              onChange={(event) => updateDraft({ contractName: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-amount">
            合同金额
            <input
              id="contract-save-amount"
              type="number"
              min="0"
              value={draft.amount}
              onChange={(event) => updateDraft({ amount: Number(event.target.value) })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-effective-date">
            生效日期
            <input
              id="contract-save-effective-date"
              type="date"
              value={draft.effectiveDate}
              onChange={(event) => updateDraft({ effectiveDate: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-status">
            合同状态
            <select
              id="contract-save-status"
              value={draft.status}
              onChange={(event) => updateDraft({ status: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {['草案', '已生效', '履约中', '履约完成'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor="contract-save-progress">
            履约进度
            <select
              id="contract-save-progress"
              value={draft.fulfillmentProgress}
              onChange={(event) => updateDraft({ fulfillmentProgress: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {['待审批', '已生效', '履约中', '已收货验收'].map((progress) => (
                <option key={progress} value={progress}>{progress}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-black text-blue-800">保存边界</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            当前订单供应商：{selectedSupplier?.name ?? selectedOrder?.supplierId ?? '未选择'}；已归档合同不可编辑，附件和审批流留待下一轮。
          </p>
          {missingEditableContract && (
            <p className="mt-2 rounded-lg border border-amber-100 bg-white p-3 text-xs font-bold text-amber-800">
              当前选中记录不是 Java 合同台账，需先新建合同后再编辑。
            </p>
          )}
          {editingArchived && (
            <p className="mt-2 rounded-lg border border-amber-100 bg-white p-3 text-xs font-bold text-amber-800">
              当前合同已归档，仅允许审计追溯，不允许继续编辑。
            </p>
          )}
        </div>

        <PrimaryActionButton
          icon={FileText}
          onClick={() => onSaveContract(mode, mode === 'update' ? selectedContract?.id ?? null : null, draft)}
          disabled={disabled}
          busy={busy}
          pendingLabel="保存中"
          fullWidth
          flushTop
        >
          保存合同
        </PrimaryActionButton>
      </div>
    </Panel>
  );
};

const ContractAttachmentPanel: React.FC<{
  contractId: string;
  attachments: AttachmentRecord[];
  uploadTicket?: AttachmentUploadTicketRecord;
  downloadLinksById: Record<string, AttachmentDownloadLinkRecord>;
  fulfillmentEvents: ContractFulfillmentEventRecord[];
  linkedActionResult?: BuyerContractLinkedActionResult | null;
  javaEnabled: boolean;
  busyId: string | null;
  onLoadAttachments?: (contractId: string) => void;
  onCreateAttachment?: (
    contractId: string,
    payload: Omit<CreateAttachmentPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateUploadTicket?: (
    contractId: string,
    payload: Omit<CreateAttachmentUploadTicketPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateDownloadLink?: (attachmentId: string) => void;
}> = ({
  contractId,
  attachments,
  uploadTicket,
  downloadLinksById,
  fulfillmentEvents,
  linkedActionResult,
  javaEnabled,
  busyId,
  onLoadAttachments,
  onCreateAttachment,
  onCreateUploadTicket,
  onCreateDownloadLink,
}) => {
  const [draft, setDraft] = useState<BuyerContractAttachmentDraft>({
    fileName: '合同正文.pdf',
    visibility: 'buyer_internal',
  });
  const loadBusy = busyId === `contract-attachment:${contractId}:load`;
  const createBusy = busyId === `contract-attachment:${contractId}:create`;
  const uploadTicketBusy = busyId === `contract-attachment:${contractId}:upload-ticket`;
  const fileNameInvalid = !draft.fileName.trim();
  const storageKey = uploadTicket?.fileName === draft.fileName.trim()
    ? uploadTicket.storageKey
    : `contract/${contractId}/${draft.fileName.trim()}`;

  return (
    <section className="rounded-lg border border-sky-100 bg-sky-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-sky-800">合同附件</p>
          <p className="mt-1 text-xs font-bold leading-5 text-sky-700">
            复用附件中心登记合同正文、补充协议和盖章扫描件元数据，暂不上传原文件。
          </p>
        </div>
        <PrimaryActionButton
          icon={Database}
          onClick={() => onLoadAttachments?.(contractId)}
          disabled={!javaEnabled || !onLoadAttachments || loadBusy}
          busy={loadBusy}
          pendingLabel="加载中"
          flushTop
        >
          刷新附件
        </PrimaryActionButton>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniFact label="业务对象" value="contract" />
        <MiniFact label="合同编号" value={contractId} />
        <MiniFact label="附件数量" value={`${attachments.length} 个`} />
      </div>

      <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
        <p className="text-xs font-black text-slate-700">附件清单</p>
        {attachments.length > 0 ? (
          <div className="mt-2 space-y-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-black text-slate-900">{attachment.fileName}</p>
                    <p className="mt-1 break-words text-xs font-bold text-slate-500">{attachment.storageKey}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                    <StatusPill label={attachment.visibility} />
                    <PrimaryActionButton
                      icon={Database}
                      onClick={() => onCreateDownloadLink?.(attachment.id)}
                      disabled={!javaEnabled || !onCreateDownloadLink || busyId === `contract-attachment-download:${attachment.id}`}
                      busy={busyId === `contract-attachment-download:${attachment.id}`}
                      pendingLabel="生成中"
                      flushTop
                    >
                      生成下载签名
                    </PrimaryActionButton>
                  </div>
                </div>
                {downloadLinksById[attachment.id] && (
                  <p className="mt-2 break-words rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-xs font-bold leading-5 text-emerald-700">
                    downloadUrl: {downloadLinksById[attachment.id].downloadUrl}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
            暂无合同附件元数据，可先登记合同正文或补充协议名称。
          </p>
        )}
      </div>

      <div className="mt-3 rounded-lg border border-sky-100 bg-white p-3">
        <p className="text-xs font-black text-sky-800">登记合同附件</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
          <label className="block text-xs font-black text-slate-600" htmlFor={`contract-attachment-file-${contractId}`}>
            附件名称
            <input
              id={`contract-attachment-file-${contractId}`}
              value={draft.fileName}
              onChange={(event) => setDraft((current) => ({ ...current, fileName: event.target.value }))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          </label>
          <label className="block text-xs font-black text-slate-600" htmlFor={`contract-attachment-visibility-${contractId}`}>
            可见范围
            <select
              id={`contract-attachment-visibility-${contractId}`}
              value={draft.visibility}
              onChange={(event) => setDraft((current) => ({
                ...current,
                visibility: event.target.value as BuyerContractAttachmentDraft['visibility'],
              }))}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              <option value="buyer_internal">采购方内部</option>
              <option value="tenant">租户内可见</option>
              <option value="supplier_shared">供应商共享</option>
            </select>
          </label>
        </div>
        <p className="mt-2 break-words text-xs font-bold text-slate-500">storageKey: {storageKey}</p>
        {uploadTicket && (
          <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-xs font-bold leading-5 text-emerald-700">
            <p className="break-words">uploadUrl: {uploadTicket.uploadUrl}</p>
            <p className="mt-1 break-words">storageKey: {uploadTicket.storageKey}</p>
          </div>
        )}
        <PrimaryActionButton
          icon={Database}
          onClick={() => onCreateUploadTicket?.(contractId, {
            fileName: draft.fileName.trim(),
            visibility: draft.visibility,
          })}
          disabled={!javaEnabled || !onCreateUploadTicket || uploadTicketBusy || fileNameInvalid}
          busy={uploadTicketBusy}
          pendingLabel="生成中"
          fullWidth
        >
          生成上传凭证
        </PrimaryActionButton>
        <PrimaryActionButton
          icon={FileText}
          onClick={() => onCreateAttachment?.(contractId, {
            fileName: draft.fileName.trim(),
            storageKey,
            visibility: draft.visibility,
          })}
          disabled={!javaEnabled || !onCreateAttachment || createBusy || fileNameInvalid}
          busy={createBusy}
          pendingLabel="登记中"
          fullWidth
        >
          登记合同附件
        </PrimaryActionButton>
      </div>

      <AttachmentCenterEntryPanel
        title="合同附件中心"
        ownerType="contract"
        ownerId={contractId}
        visibility={draft.visibility}
        desc="登记合同正文、补充协议和盖章扫描件的附件元数据，后续与合同审批和归档审计关联。"
        attachmentNames={attachments.map((attachment) => attachment.fileName)}
      />
    </section>
  );
};

const ContractApprovalEntryPanel: React.FC<{
  detail: ContractDetailPanel;
  javaEnabled: boolean;
  onSubmitContractApproval?: (contractId: string) => void;
}> = ({ detail, javaEnabled, onSubmitContractApproval }) => {
  const approvalDisabled = !javaEnabled
    || !onSubmitContractApproval
    || detail.approvalReadiness.status !== '待提交审批';

  return (
    <section className="rounded-lg border border-violet-100 bg-violet-50 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-violet-900">合同审批</p>
          <p className="mt-1 text-xs font-bold leading-5 text-violet-700">
            合同审批入口当前只记录入口边界，后续接入 Java 审批流后再写入审批任务。
          </p>
        </div>
        <PrimaryActionButton
          icon={Send}
          onClick={() => onSubmitContractApproval?.(detail.id)}
          disabled={approvalDisabled}
          flushTop
        >
          提交合同审批
        </PrimaryActionButton>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniFact label="审批就绪" value={detail.approvalReadiness.status} />
        <MiniFact label="审批阻断原因" value={detail.approvalReadiness.reason} />
        <MiniFact label="下一步" value={detail.approvalReadiness.nextAction} />
      </div>
      {approvalDisabled && (
        <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-violet-800">
          当前不可提交合同审批：{javaEnabled ? detail.approvalReadiness.reason : '请先切换到 Java 数据源'}。
        </p>
      )}
    </section>
  );
};

const ContractDeepeningDemoReadinessPanel: React.FC<{
  items: ContractDeepeningReadinessItem[];
  javaEnabled: boolean;
}> = ({ items, javaEnabled }) => (
  <section data-testid="stage13-contract-demo-readiness" className="rounded-lg border border-cyan-100 bg-cyan-50 p-4">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-cyan-900">阶段十三合同深化</p>
        <h3 className="mt-1 text-lg font-black text-slate-950">合同管理第一屏演示验收</h3>
        <p className="mt-2 text-sm font-bold leading-6 text-cyan-800">
          真实动作复验围绕合同总览、合同审批、履约事件、订单/收货/发票/付款关系、归档门禁、演示操作条和推荐合同样本展开。
        </p>
      </div>
      <StatusPill label={javaEnabled ? 'Java 数据源' : '等待 Java 数据源'} />
    </div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-white/80 bg-white p-3 shadow-sm shadow-cyan-100/50">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="break-words text-xs font-black text-slate-900">{item.label}</p>
            <StatusPill label={item.status} />
          </div>
          <div className="mt-3 grid gap-2">
            <MiniFact label="验收证据" value={item.evidence} />
            <MiniFact label="演示口径" value={item.detail} />
          </div>
        </div>
      ))}
    </div>
    <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-cyan-800">
      本轮不新增合同工作流接口，优先把已有 Java 合同动作整理成客户可看、可讲、可复验的合同深化切片。
    </p>
  </section>
);

const ContractDetailPanelView: React.FC<{
  detail?: ContractDetailPanel;
  attachments: AttachmentRecord[];
  uploadTicket?: AttachmentUploadTicketRecord;
  downloadLinksById: Record<string, AttachmentDownloadLinkRecord>;
  fulfillmentEvents: ContractFulfillmentEventRecord[];
  targetAuditLogs: AuditLogRecord[];
  javaEnabled: boolean;
  buyerFulfillmentBusyId: string | null;
  linkedActionResult?: BuyerContractLinkedActionResult;
  onLoadAttachments?: (contractId: string) => void;
  onCreateAttachment?: (
    contractId: string,
    payload: Omit<CreateAttachmentPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateUploadTicket?: (
    contractId: string,
    payload: Omit<CreateAttachmentUploadTicketPayload, 'ownerType' | 'ownerId'>,
  ) => void;
  onCreateDownloadLink?: (attachmentId: string) => void;
  onSubmitContractApproval?: (contractId: string) => void;
  onUpdateContractStatus?: (contractId: string, status: string, fulfillmentProgress: string) => void;
  onArchiveContract?: (contractId: string) => void;
  onNavigateBuyerModule?: (moduleId: BuyerAdminModule) => void;
  onNavigateArchiveReviewSuggestion?: (suggestion: ContractArchiveReviewActionSuggestion) => void;
}> = ({
  detail,
  attachments,
  uploadTicket,
  downloadLinksById,
  fulfillmentEvents,
  targetAuditLogs,
  javaEnabled,
  buyerFulfillmentBusyId,
  linkedActionResult,
  onLoadAttachments,
  onCreateAttachment,
  onCreateUploadTicket,
  onCreateDownloadLink,
  onSubmitContractApproval,
  onUpdateContractStatus,
  onArchiveContract,
  onNavigateBuyerModule,
  onNavigateArchiveReviewSuggestion,
}) => {
  const [focusedArchiveReviewTarget, setFocusedArchiveReviewTarget] = useState<string | null>(null);
  const [archiveReviewFilter, setArchiveReviewFilter] = useState<'all' | 'gaps' | 'covered'>('all');
  const [archiveReviewConfirmedEvidenceItem, setArchiveReviewConfirmedEvidenceItem] = useState<string | null>(null);

  if (!detail) {
    return (
      <Panel title="合同详情" icon={FileText}>
        <EmptyState title="暂无合同详情" desc="选择一条合同台账后，可查看订单、收货、发票付款和归档状态。" />
      </Panel>
    );
  }

  const isArchived = detail.archiveStatus === '已归档';
  const statusBusyId = `contract-status:${detail.id}`;
  const archiveBusyId = `contract-archive:${detail.id}`;
  const contractArchiveDisabled = !javaEnabled || isArchived || !onArchiveContract || detail.archiveReadiness.status !== '可归档';
  const receiptEventCount = fulfillmentEvents.filter((event) => event.actionType === 'receipt').length;
  const paymentEventCount = fulfillmentEvents.filter((event) => event.actionType === 'payment').length;
  const latestFulfillmentEvent = fulfillmentEvents[0];
  const contractEventEvidenceSummary = receiptEventCount > 0 && paymentEventCount > 0
    ? '收货与付款事件证据已覆盖'
    : receiptEventCount > 0
      ? '已有收货事件，仍需关注付款事件'
      : paymentEventCount > 0
        ? '已有付款事件，仍需关注收货事件'
        : '暂无事件证据，需先从合同联动入口推进目标单据';
  const contractEventWriteBoundary = isArchived
    ? '已归档合同仅保留审计查看，不再写入新的履约事件'
    : '未归档合同可从合同联动入口继续沉淀收货和付款事件证据';
  const contractArchiveAuditConclusion = isArchived
    ? '归档后合同进入只读审计态，可复核审批、附件、履约事件和边界控制。'
    : '合同尚未归档，审计视图用于预检归档证据是否齐备。';
  const contractArchiveAuditEvidenceRows = [
    {
      label: '审批追溯',
      value: detail.approvalReadiness.status,
      hint: detail.approvalReadiness.reason,
    },
    {
      label: '附件凭证',
      value: `${attachments.length} 份`,
      hint: attachments.length > 0 ? '合同附件元数据已登记，可作为归档凭证索引。' : '暂无合同附件凭证，后续可补充正文或补充协议。',
    },
    {
      label: '履约事件证据',
      value: `${fulfillmentEvents.length} 条`,
      hint: contractEventEvidenceSummary,
    },
    {
      label: '只读边界',
      value: isArchived ? '已冻结写入' : '待归档冻结',
      hint: contractEventWriteBoundary,
    },
  ];
  const latestContractTargetAuditLog = targetAuditLogs[0];
  const contractTargetAuditSummary = targetAuditLogs.length > 0
    ? `${targetAuditLogs.length} 条目标对象审计记录`
    : '暂无目标对象审计记录';
  const focusedArchiveReviewRow = detail.archiveReviewChecklistRows.find(
    (row) => row.archiveReviewTargetSection === focusedArchiveReviewTarget,
  );
  const archiveReviewSectionHighlightClass = (targetSection: string) => (
    focusedArchiveReviewTarget === targetSection
      ? 'ring-2 ring-rose-400 ring-offset-2 ring-offset-white'
      : ''
  );
  const filteredArchiveReviewChecklistRows = detail.archiveReviewChecklistRows.filter((row) => {
    if (archiveReviewFilter === 'gaps') return row.status !== '已覆盖';
    if (archiveReviewFilter === 'covered') return row.status === '已覆盖';
    return true;
  });
  const archiveReviewNewEvidenceItem = linkedActionResult?.archiveReviewResultGapItem;
  const archiveReviewNewEvidenceStatus = linkedActionResult?.archiveReviewResultEvidenceStatus;
  const archiveReviewNewEvidenceNextStep = linkedActionResult?.archiveReviewResultNextStep;
  const archiveReviewOperationTraceTargetSection = archiveReviewNewEvidenceItem
    ? detail.archiveReviewChecklistRows.find((row) => row.item === archiveReviewNewEvidenceItem)?.archiveReviewTargetSection ?? null
    : null;
  const confirmArchiveReviewNewEvidence = (item: string) => {
    setArchiveReviewConfirmedEvidenceItem(item);
  };
  const archiveReviewProgressConfirmedCount = archiveReviewConfirmedEvidenceItem ? 1 : 0;
  const archiveReviewProgressPendingNewEvidenceCount = archiveReviewNewEvidenceItem && !archiveReviewConfirmedEvidenceItem ? 1 : 0;
  const archiveReviewProgressOpenGapCount = Math.max(
    detail.archiveReviewGroupSummary.gapCount - archiveReviewProgressConfirmedCount,
    0,
  );
  const archiveReviewOperationTraceRows = archiveReviewNewEvidenceItem && linkedActionResult
    ? [
        {
          id: `${linkedActionResult.contractNo}-${linkedActionResult.targetId}-${archiveReviewNewEvidenceItem}`,
          sourceEntry: linkedActionResult.actionType === 'receipt' ? '收货验收目标页' : '发票付款目标页',
          gapItem: archiveReviewNewEvidenceItem,
          targetId: linkedActionResult.targetId,
          targetSection: archiveReviewOperationTraceTargetSection,
          confirmationStatus: archiveReviewConfirmedEvidenceItem === archiveReviewNewEvidenceItem ? '已确认覆盖' : '待复核新证据',
        },
      ]
    : [];
  const archiveReviewHistoryRows = archiveReviewNewEvidenceItem && linkedActionResult
    ? [
        {
          id: `${linkedActionResult.targetId}-processed`,
          stage: '目标页处理',
          conclusion: archiveReviewNewEvidenceStatus ?? '已形成页面内处理证据',
          nextStep: archiveReviewNewEvidenceNextStep ?? '返回归档复核清单继续复核。',
        },
        {
          id: `${linkedActionResult.targetId}-located`,
          stage: '轨迹定位',
          conclusion: archiveReviewOperationTraceTargetSection ? '已关联证据区块' : '暂无可定位证据区块',
          nextStep: archiveReviewOperationTraceTargetSection ? '可通过定位轨迹证据回到对应缺口。' : '需补充复核项定位配置。',
        },
        {
          id: `${linkedActionResult.targetId}-confirmed`,
          stage: '复核确认结果',
          conclusion: archiveReviewConfirmedEvidenceItem === archiveReviewNewEvidenceItem ? '已确认覆盖' : '待复核确认',
          nextStep: archiveReviewConfirmedEvidenceItem === archiveReviewNewEvidenceItem
            ? '页面内闭环已完成，最终归档仍以服务端门禁为准。'
            : '在复核清单中标记为已复核后完成页面内闭环。',
        },
      ]
    : [];
  const archiveReviewHistoryRiskSummary = archiveReviewNewEvidenceItem
    ? archiveReviewConfirmedEvidenceItem === archiveReviewNewEvidenceItem
      ? {
          level: '低风险',
          reason: '新证据已确认覆盖，页面内复核闭环已完成。',
          nextStep: '复核归档门禁并准备归档。',
        }
      : {
          level: '中风险',
          reason: '新证据仍待复核确认，仍会阻断最终归档。',
          nextStep: '返回复核清单标记新证据已复核。',
        }
    : archiveReviewProgressOpenGapCount > 0
      ? {
          level: '高风险',
          reason: '仍存在待处理缺口，仍会阻断最终归档。',
          nextStep: '先处理缺口建议并形成目标页证据。',
        }
      : {
          level: '低风险',
          reason: '暂无页面内历史阻断信号。',
          nextStep: '继续复核服务端归档门禁。',
        };
  const archiveReviewRiskResolutionSuggestion = archiveReviewNewEvidenceItem
    ? detail.archiveReviewActionSuggestions.find((suggestion) => suggestion.item === archiveReviewNewEvidenceItem)
      ?? detail.archiveReviewActionSuggestions[0]
    : detail.archiveReviewActionSuggestions[0];
  const archiveReviewCloseoutCheck = {
    pageConfirmationStatus: archiveReviewNewEvidenceItem
      ? archiveReviewConfirmedEvidenceItem === archiveReviewNewEvidenceItem ? '页面新证据已确认' : '页面新证据待确认'
      : archiveReviewProgressOpenGapCount > 0 ? '仍有缺口待处理' : '暂无页面内待确认项',
    riskResolutionEntry: archiveReviewRiskResolutionSuggestion && archiveReviewHistoryRiskSummary.level !== '低风险'
      ? '已提供风险解除入口'
      : '暂无需解除的页面风险',
    serverArchiveGate: detail.archiveReadiness.status,
    closeoutDecision: archiveReviewHistoryRiskSummary.level === '低风险' && detail.archiveReadiness.status === '可归档'
      ? '可进入最终归档确认'
      : '继续处理页面复核和服务端归档门禁',
  };
  const archiveReviewPreArchiveActionHint = {
    archiveButtonDecision: !contractArchiveDisabled && archiveReviewCloseoutCheck.closeoutDecision === '可进入最终归档确认'
      ? '可点击归档合同按钮'
      : '暂不可点击归档合同按钮',
    blockingPath: archiveReviewCloseoutCheck.closeoutDecision === '可进入最终归档确认'
      ? '复核归档按钮状态并执行最终归档。'
      : archiveReviewRiskResolutionSuggestion
        ? `先处理${archiveReviewRiskResolutionSuggestion.ownerModule}：${archiveReviewRiskResolutionSuggestion.handlingPath}`
        : detail.archiveReadiness.nextAction,
    actionHint: archiveReviewCloseoutCheck.closeoutDecision === '可进入最终归档确认'
      ? '归档动作提示：可点击归档合同按钮，提交 Java 服务端归档门禁校验。'
      : '归档动作提示：先完成页面复核确认、解除阻断并满足服务端归档门禁。',
  };
  const archiveReviewFilterOptions = [
    {
      id: 'all' as const,
      label: '全部复核项',
      count: detail.archiveReviewGroupSummary.totalCount,
    },
    {
      id: 'gaps' as const,
      label: '优先处理缺口',
      count: detail.archiveReviewGroupSummary.gapCount,
    },
    {
      id: 'covered' as const,
      label: '已覆盖证据',
      count: detail.archiveReviewGroupSummary.coveredCount,
    },
  ];
  const handleArchiveReviewSuggestionModuleLink = (suggestion: typeof detail.archiveReviewActionSuggestions[number]) => {
    setArchiveReviewFilter('gaps');
    setFocusedArchiveReviewTarget(suggestion.archiveReviewTargetSection);
    if (onNavigateArchiveReviewSuggestion) {
      onNavigateArchiveReviewSuggestion(suggestion);
      return;
    }
    onNavigateBuyerModule?.(suggestion.targetModuleId);
  };
  const contractDemoActionLoopRows = [
    {
      label: '提交合同审批',
      status: detail.approvalReadiness.status,
      feedback: detail.approvalReadiness.status === '待提交审批'
        ? '点击后生成合同审批任务，审批中心可回看并处理。'
        : detail.approvalReadiness.reason,
      nextStep: '下一步承接到审批中心，讲合同审批任务回写合同状态。',
      disabled: !javaEnabled || !onSubmitContractApproval || detail.approvalReadiness.status !== '待提交审批',
      tone: 'blue' as const,
      onClick: () => onSubmitContractApproval?.(detail.id),
    },
    {
      label: '推进履约',
      status: isArchived ? '已归档只读' : detail.fulfillmentLinkageSummary.stage,
      feedback: '点击后把合同状态推进到履约完成，页面继续保留归档门禁和事件证据边界。',
      nextStep: '下一步承接到收货验收或发票付款，补齐合同履约事件证据。',
      disabled: !javaEnabled || isArchived || !onUpdateContractStatus,
      tone: 'emerald' as const,
      onClick: () => onUpdateContractStatus?.(detail.id, '履约完成', '已收货验收'),
    },
    {
      label: '处理收货验收',
      status: receiptEventCount > 0 ? '已有收货事件' : '待形成收货证据',
      feedback: '点击后进入收货验收页，并保留当前合同上下文提示。',
      nextStep: '下一步承接回合同详情，形成合同履约事件回看。',
      disabled: !onNavigateBuyerModule || isArchived,
      tone: 'emerald' as const,
      onClick: () => onNavigateBuyerModule?.('receipts'),
    },
    {
      label: '处理发票付款',
      status: paymentEventCount > 0 ? '已有付款事件' : '待形成付款证据',
      feedback: '点击后进入发票付款页，并保留当前合同上下文提示。',
      nextStep: '下一步承接回合同详情，复核发票、付款和归档关系。',
      disabled: !onNavigateBuyerModule || isArchived,
      tone: 'blue' as const,
      onClick: () => onNavigateBuyerModule?.('invoices'),
    },
    {
      label: '归档合同',
      status: archiveReviewPreArchiveActionHint.archiveButtonDecision,
      feedback: contractArchiveDisabled
        ? `归档条件未满足：${detail.archiveReadiness.reason}`
        : '点击后提交 Java 服务端归档门禁校验，成功后合同进入只读审计态。',
      nextStep: '下一步承接到归档审计视图，复核审批、附件、事件和付款证据。',
      disabled: contractArchiveDisabled,
      tone: 'amber' as const,
      onClick: () => onArchiveContract?.(detail.id),
    },
  ];

  return (
    <Panel title="合同详情" icon={FileText}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="合同管理"
          title={detail.contractNo}
          meta={`${detail.contractName} · ${detail.supplierName}`}
          status={detail.status}
          facts={[
            { label: '关联订单', value: detail.relatedOrderId },
            { label: '合同金额', value: detail.amountLabel },
            { label: '归档状态', value: detail.archiveStatus },
            { label: '下一步', value: detail.nextActionTitle },
          ]}
        />
        <section data-testid="stage10-contract-demo-action-loop" className="rounded-lg border border-sky-100 bg-sky-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black text-sky-900">合同演示动作闭环</p>
              <p className="mt-1 text-xs font-bold leading-5 text-sky-700">
                把合同详情里的真实动作按钮集中成推荐链：提交合同审批、推进履约、处理收货验收、处理发票付款和归档合同。
              </p>
            </div>
            <StatusPill label="真实动作按钮 / 动作反馈 / 下一步承接" />
          </div>
          <div className="mt-3 grid gap-2 xl:grid-cols-5">
            {contractDemoActionLoopRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/80 bg-white p-3 shadow-sm shadow-sky-100/40">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black text-slate-900">{row.label}</p>
                    <p className="mt-1 text-[11px] font-black text-sky-700">真实动作按钮</p>
                  </div>
                  <StatusPill label={row.status} />
                </div>
                <div className="mt-3 grid gap-2">
                  <MiniFact label="动作反馈" value={row.feedback} />
                  <MiniFact label="下一步承接" value={row.nextStep} />
                </div>
                <PrimaryActionButton
                  onClick={row.onClick}
                  disabled={row.disabled}
                  tone={row.tone}
                  fullWidth
                >
                  {row.label}
                </PrimaryActionButton>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-sky-800">
            本轮不新增合同工作流接口，只把已有合同审批、履约推进、跨模块处理和归档动作整理成可演示的动作闭环。
          </p>
        </section>
        <div data-review-section="contract-approval-entry" className={archiveReviewSectionHighlightClass('contract-approval-entry')}>
          <ContractApprovalEntryPanel
            detail={detail}
            javaEnabled={javaEnabled}
            onSubmitContractApproval={onSubmitContractApproval}
          />
        </div>
        <div data-review-section="contract-attachment-evidence" className={archiveReviewSectionHighlightClass('contract-attachment-evidence')}>
          <ContractAttachmentPanel
            contractId={detail.id}
            attachments={attachments}
            uploadTicket={uploadTicket}
            downloadLinksById={downloadLinksById}
            javaEnabled={javaEnabled}
            busyId={buyerFulfillmentBusyId}
            onLoadAttachments={onLoadAttachments}
            onCreateAttachment={onCreateAttachment}
            onCreateUploadTicket={onCreateUploadTicket}
            onCreateDownloadLink={onCreateDownloadLink}
          />
        </div>
        {linkedActionResult && (
          <section className="rounded-lg border border-teal-100 bg-teal-50 p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-teal-900">
                  {linkedActionResult.archiveReviewResultGapItem ? '归档复核处理回看' : '合同联动结果回看'}
                </p>
                <p className="mt-1 text-xs font-bold leading-5 text-teal-700">
                  最近一次从合同上下文进入目标页后的操作结果已回写到当前合同详情，便于采购方复核跨模块处理是否闭合。
                </p>
              </div>
              <StatusPill label={linkedActionResult.actionType === 'receipt' ? '收货验收' : '发票付款'} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniFact label="最近联动动作" value={linkedActionResult.actionType === 'receipt' ? '收货验收' : '发票付款'} />
              <MiniFact label="目标单据" value={linkedActionResult.targetId} />
              <MiniFact label="来源合同" value={linkedActionResult.contractNo} />
            </div>
            <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-black leading-5 text-teal-800">
              {linkedActionResult.summary}
            </p>
            {linkedActionResult.archiveReviewResultGapItem && (
              <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
                <p className="text-xs font-black text-teal-900">缺口处理结果</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="归档复核缺口" value={linkedActionResult.archiveReviewResultGapItem} />
                  <MiniFact label="新增证据状态" value={linkedActionResult.archiveReviewResultEvidenceStatus ?? '已形成页面内处理证据'} />
                  <MiniFact label="后续复核动作" value={linkedActionResult.archiveReviewResultNextStep ?? '返回归档复核清单继续复核。'} />
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] font-bold leading-5 text-teal-700">
              来源：{linkedActionResult.sourceLabel}。本轮先做页面内结果回看，不新增后端持久化接口。
            </p>
          </section>
        )}
        <section data-review-section="contract-fulfillment-event-ledger" className={`rounded-lg border border-sky-100 bg-sky-50 p-3 ${archiveReviewSectionHighlightClass('contract-fulfillment-event-ledger')}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-sky-900">后端履约事件台账</p>
              <p className="mt-1 text-xs font-bold leading-5 text-sky-700">
                Java 持久化事件会记录从合同联动入口推进的收货、付款等关键动作，刷新页面后仍可用于合同履约复核。
              </p>
            </div>
            <StatusPill label={`Java 持久化事件 ${fulfillmentEvents.length} 条`} />
          </div>
          {fulfillmentEvents.length === 0 ? (
            <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-sky-700">
              暂无 Java 持久化事件；从合同详情进入收货验收或发票付款并完成快捷登记后会写入这里。
            </p>
          ) : (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {fulfillmentEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-lg border border-white/80 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs font-black text-sky-900">{event.targetId}</p>
                    <StatusPill label={event.actionType === 'receipt' ? '收货验收' : event.actionType === 'payment' ? '发票付款' : event.actionType} />
                  </div>
                  <p className="mt-2 break-words text-xs font-black leading-5 text-slate-800">{event.summary}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <MiniFact label="来源上下文" value={event.sourceLabel} />
                    <MiniFact label="记录时间" value={formatAuditTime(event.createdAt)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="rounded-lg border border-lime-100 bg-lime-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-lime-900">合同履约事件状态机</p>
              <p className="mt-1 text-xs font-bold leading-5 text-lime-700">
                基于当前合同履约事件只读状态派生，按待收货、待付款、待归档、已完成展示事件覆盖和下一步动作。
              </p>
            </div>
            <StatusPill label="只读状态派生" />
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {detail.contractFulfillmentEventStateRows.map((row) => (
              <div key={row.eventStage} className="rounded-lg border border-white/80 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-500">当前事件阶段</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">{row.eventStage}</p>
                  </div>
                  <StatusPill label={row.status} />
                </div>
                <div className="mt-3 grid gap-2">
                  <MiniFact label="事件证据" value={row.eventEvidenceLabel} />
                  <MiniFact label="下一步动作" value={row.eventNextAction} />
                </div>
                <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-600">{row.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-lime-800">
            只读状态派生：本轮不新增复杂履约事件状态机接口，不自动改写合同状态；归档门禁仍以订单收货和发票付款为准。
          </p>
        </section>
        <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-emerald-900">合同履约联动摘要</p>
              <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
                汇总订单、收货、发票付款和归档节点，给出当前履约阶段、风险等级与下一步责任人。
              </p>
            </div>
            <StatusPill label={detail.fulfillmentLinkageSummary.stage} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MiniFact label="履约进度百分比" value={`${detail.fulfillmentLinkageSummary.progressPercent}%`} />
            <MiniFact label="风险等级" value={detail.fulfillmentLinkageSummary.riskLevel} />
            <MiniFact label="下一步责任人" value={detail.fulfillmentLinkageSummary.owner} />
            <MiniFact label="下一步动作" value={detail.fulfillmentLinkageSummary.nextStep} />
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${detail.fulfillmentLinkageSummary.progressPercent}%` }}
            />
          </div>
        </section>
        <section className="rounded-lg border border-violet-100 bg-violet-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-violet-900">合同履约财务汇总</p>
              <p className="mt-1 text-xs font-bold leading-5 text-violet-700">
                从合同视角汇总合同金额、收货状态、发票金额、付款状态、归档阻断和付款准备，便于归档前核对履约与财务闭环。
              </p>
            </div>
            <StatusPill label={detail.contractFinancialSummary.paymentReadinessLabel} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <MiniFact label="合同金额" value={detail.contractFinancialSummary.contractAmountLabel} />
            <MiniFact label="发票金额" value={detail.contractFinancialSummary.invoiceAmountLabel} />
            <MiniFact label="发票差异" value={detail.contractFinancialSummary.invoiceVarianceLabel} />
            <MiniFact label="付款准备" value={detail.contractFinancialSummary.paymentReadinessLabel} />
            <MiniFact label="归档阻断" value={detail.contractFinancialSummary.archiveBlockingLabel} />
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {detail.fulfillmentFinanceRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/80 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black text-slate-900">{row.label}</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">{row.value}</p>
                  </div>
                  <StatusPill label={row.status} />
                </div>
                <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-600">{row.hint}</p>
              </div>
            ))}
          </div>
        </section>
        <section data-review-section="contract-payment-plan-readonly" className={`rounded-lg border border-fuchsia-100 bg-fuchsia-50 p-3 ${archiveReviewSectionHighlightClass('contract-payment-plan-readonly')}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-fuchsia-900">合同付款计划只读视图</p>
              <p className="mt-1 text-xs font-bold leading-5 text-fuchsia-700">
                聚合当前合同关联发票、付款申请、付款批次和计划付款日；不新增合同付款计划接口，付款处理仍回到发票付款模块完成。
              </p>
            </div>
            <StatusPill label={detail.contractFinancialSummary.paymentPlanSummary} />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {detail.contractPaymentPlanRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/80 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black text-slate-900">{row.label}</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">{row.value}</p>
                  </div>
                  <StatusPill label={row.status} />
                </div>
                <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-600">{row.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-fuchsia-800">
            只读边界：合同详情只展示付款计划成熟度、付款批次和计划付款日，不直接创建付款申请、不登记付款、不接真实支付。
          </p>
        </section>
        <section className="rounded-lg border border-cyan-100 bg-cyan-50 p-3">
          <p className="text-xs font-black text-cyan-900">合同上下文操作入口</p>
          <p className="mt-1 text-xs font-bold leading-5 text-cyan-700">
            从合同详情直接跳转到下一步处理模块，保留当前合同的业务上下文提示。
          </p>
          {isArchived && (
            <p aria-live="polite" className="mt-3 rounded-lg border border-amber-100 bg-white/80 p-3 text-xs font-bold leading-5 text-amber-800">
              {contractEventWriteBoundary}
            </p>
          )}
          <div className="mt-3 grid gap-2 lg:grid-cols-3">
            {detail.contextActionRows.map((row) => {
              const actionLabel = row.moduleId === 'receipts'
                ? '去收货验收'
                : row.moduleId === 'invoices' ? '去发票付款' : row.label;
              return (
                <div key={`${row.moduleId}-${row.label}`} className="rounded-lg border border-white/80 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="break-words text-xs font-black text-slate-800">{row.label}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">{row.moduleLabel}</p>
                    </div>
                    <StatusPill label={row.status} />
                  </div>
                  <p className="mt-2 break-words text-xs font-bold leading-5 text-slate-600">{row.hint}</p>
                  <PrimaryActionButton
                    icon={ArrowRight}
                    onClick={() => onNavigateBuyerModule?.(row.moduleId)}
                    disabled={!onNavigateBuyerModule || isArchived}
                    fullWidth
                  >
                    {actionLabel}
                  </PrimaryActionButton>
                </div>
              );
            })}
          </div>
        </section>
        <section className="rounded-lg border border-rose-100 bg-rose-50 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-rose-900">合同归档复核清单</p>
              <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                只读复核清单汇总审批追溯、附件凭证、履约事件、付款计划和审计日志，用于归档前最终检查。
              </p>
            </div>
            <StatusPill label={`复核结论 ${detail.archiveReviewConclusion}`} />
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">复核分组</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  下一优先项：{detail.archiveReviewGroupSummary.nextReviewFocus}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniFact label="全部复核项" value={`${detail.archiveReviewGroupSummary.totalCount} 项`} />
                <MiniFact label="优先处理缺口" value={`${detail.archiveReviewGroupSummary.gapCount} 项`} />
                <MiniFact label="已覆盖证据" value={`${detail.archiveReviewGroupSummary.coveredCount} 项`} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {archiveReviewFilterOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setArchiveReviewFilter(option.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-black transition ${
                    archiveReviewFilter === option.id
                      ? 'border-rose-300 bg-rose-100 text-rose-900'
                      : 'border-rose-100 bg-rose-50 text-rose-700 hover:border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  {option.label} · {option.count}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档复核进度摘要</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  汇总当前页面内复核确认、新证据待复核和剩余待处理缺口；最终归档仍以服务端门禁为准。
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <MiniFact label="本次复核确认" value={`${archiveReviewProgressConfirmedCount} 项`} />
                <MiniFact label="待复核新证据" value={`${archiveReviewProgressPendingNewEvidenceCount} 项`} />
                <MiniFact label="待处理缺口" value={`${archiveReviewProgressOpenGapCount} 项`} />
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档复核操作轨迹</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  页面内轨迹用于回看本次新证据处理和确认过程，不替代后端审计日志。
                </p>
              </div>
              <StatusPill label={`页面内轨迹 ${archiveReviewOperationTraceRows.length} 条`} />
            </div>
            {archiveReviewOperationTraceRows.length === 0 ? (
              <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                暂无页面内归档复核操作轨迹；从处理建议进入目标页并产生新证据后会展示在这里。
              </p>
            ) : (
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {archiveReviewOperationTraceRows.map((trace) => (
                  <div key={trace.id} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-black text-rose-900">复核缺口：{trace.gapItem}</p>
                        <p className="mt-1 break-words text-xs font-bold leading-5 text-rose-700">
                          轨迹来源入口：{trace.sourceEntry} · 目标单据 {trace.targetId}
                        </p>
                      </div>
                      <StatusPill label={trace.confirmationStatus} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <MiniFact label="轨迹来源入口" value={trace.sourceEntry} />
                      <MiniFact label="复核缺口" value={trace.gapItem} />
                      <MiniFact label="轨迹定位目标" value={trace.targetSection ?? '暂无定位目标'} />
                      <MiniFact label="确认状态" value={trace.confirmationStatus} />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!trace.targetSection) return;
                        setFocusedArchiveReviewTarget(trace.targetSection);
                        setArchiveReviewFilter('gaps');
                      }}
                      disabled={!trace.targetSection}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-800 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      定位轨迹证据
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档复核处理历史视图</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  页面内历史用于串联目标页处理、轨迹定位和复核确认结果，不替代后端审计日志。
                </p>
              </div>
              <StatusPill label={`页面内历史 ${archiveReviewHistoryRows.length} 条`} />
            </div>
            {archiveReviewHistoryRows.length === 0 ? (
              <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                暂无页面内归档复核处理历史；完成目标页处理后会生成处理、定位和确认阶段。
              </p>
            ) : (
              <div className="mt-3 grid gap-2 lg:grid-cols-3">
                {archiveReviewHistoryRows.map((row) => (
                  <div key={row.id} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="break-words text-xs font-black text-rose-900">{row.stage}</p>
                      <StatusPill label={row.conclusion} />
                    </div>
                    <div className="mt-3 grid gap-2">
                      <MiniFact label="历史阶段" value={row.stage} />
                      <MiniFact label="历史结论" value={row.conclusion} />
                      <MiniFact label="下一步" value={row.nextStep} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档复核历史风险摘要</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  基于页面内历史、待复核新证据和剩余缺口判断当前阻断风险；最终归档仍以服务端门禁为准。
                </p>
              </div>
              <StatusPill label={archiveReviewHistoryRiskSummary.level} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniFact label="阻断等级" value={archiveReviewHistoryRiskSummary.level} />
              <MiniFact label="阻断原因" value={archiveReviewHistoryRiskSummary.reason} />
              <MiniFact label="风险下一步" value={archiveReviewHistoryRiskSummary.nextStep} />
            </div>
            {archiveReviewRiskResolutionSuggestion && archiveReviewHistoryRiskSummary.level !== '低风险' && (
              <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black text-rose-900">解除阻断动作入口</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                      解除阻断建议：{archiveReviewRiskResolutionSuggestion.suggestedAction}
                    </p>
                  </div>
                  <StatusPill label={archiveReviewRiskResolutionSuggestion.ownerModule} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <MiniFact label="阻断缺口" value={archiveReviewRiskResolutionSuggestion.item} />
                  <MiniFact label="处理路径" value={archiveReviewRiskResolutionSuggestion.handlingPath} />
                  <MiniFact label="负责模块" value={archiveReviewRiskResolutionSuggestion.ownerModule} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveReviewFilter('gaps');
                      setFocusedArchiveReviewTarget(archiveReviewRiskResolutionSuggestion.archiveReviewTargetSection);
                    }}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-800 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    定位阻断缺口
                  </button>
                  <button
                    type="button"
                    onClick={() => handleArchiveReviewSuggestionModuleLink(archiveReviewRiskResolutionSuggestion)}
                    disabled={!onNavigateBuyerModule || isArchived}
                    className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-600 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:border-rose-100 disabled:bg-rose-100 disabled:text-rose-300"
                  >
                    去解除阻断
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档复核关闭前检查条</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  汇总页面确认、风险解除入口和服务端归档门禁；最终归档仍以服务端门禁为准。
                </p>
              </div>
              <StatusPill label={archiveReviewCloseoutCheck.closeoutDecision} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MiniFact label="页面确认状态" value={archiveReviewCloseoutCheck.pageConfirmationStatus} />
              <MiniFact label="风险解除入口" value={archiveReviewCloseoutCheck.riskResolutionEntry} />
              <MiniFact label="服务端归档门禁" value={archiveReviewCloseoutCheck.serverArchiveGate} />
              <MiniFact label="关闭前判断" value={archiveReviewCloseoutCheck.closeoutDecision} />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">归档前确认动作提示</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  将关闭前检查结果映射到归档按钮或阻断处理路径；最终提交仍由 Java 服务端门禁校验。
                </p>
              </div>
              <StatusPill label={archiveReviewPreArchiveActionHint.archiveButtonDecision} />
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <MiniFact label="归档按钮判断" value={archiveReviewPreArchiveActionHint.archiveButtonDecision} />
              <MiniFact label="阻断处理路径" value={archiveReviewPreArchiveActionHint.blockingPath} />
              <MiniFact label="归档动作提示" value={archiveReviewPreArchiveActionHint.actionHint} />
            </div>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-5">
            {filteredArchiveReviewChecklistRows.map((row) => {
              const newEvidenceConfirmed = archiveReviewConfirmedEvidenceItem === row.item;
              const newEvidencePendingReview = archiveReviewNewEvidenceItem === row.item && !newEvidenceConfirmed;
              const newEvidenceMatched = archiveReviewNewEvidenceItem === row.item;
              return (
              <div key={row.item} className={`rounded-lg border bg-white p-3 ${
                newEvidenceMatched ? 'border-emerald-200 ring-2 ring-emerald-100' : 'border-white/80'
              }`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-xs font-black text-slate-900">{row.item}</p>
                    <p className="mt-1 break-words text-sm font-black text-slate-950">{row.evidence}</p>
                  </div>
                  <StatusPill label={newEvidenceConfirmed ? '已确认覆盖' : newEvidencePendingReview ? '待复核新证据' : row.status} />
                </div>
                {newEvidencePendingReview && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                    <p className="text-xs font-black text-emerald-900">新证据待复核</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
                      处理回看摘要：{archiveReviewNewEvidenceStatus ?? '已形成页面内处理证据'}。
                      {archiveReviewNewEvidenceNextStep ?? '请复核该缺口是否已覆盖。'}
                    </p>
                    <button
                      type="button"
                      onClick={() => confirmArchiveReviewNewEvidence(row.item)}
                      className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-300"
                    >
                      标记为已复核
                    </button>
                  </div>
                )}
                {newEvidenceConfirmed && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                    <p className="text-xs font-black text-emerald-900">复核确认结果</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
                      页面内确认：该新增证据已由当前操作员复核为覆盖当前缺口；最终归档仍以服务端门禁为准。
                    </p>
                  </div>
                )}
                <MiniFact label="下一步动作" value={row.nextAction} />
                <MiniFact label="定位目标" value={row.archiveReviewLocationHint} />
                <button
                  type="button"
                  onClick={() => setFocusedArchiveReviewTarget(row.archiveReviewTargetSection)}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
                >
                  定位证据区块
                </button>
              </div>
              );
            })}
          </div>
          {filteredArchiveReviewChecklistRows.length === 0 && (
            <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-rose-700">
              暂无该分组复核项。
            </p>
          )}
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-rose-900">合同归档复核处理建议</p>
                <p className="mt-1 text-xs font-bold leading-5 text-rose-700">
                  仅根据当前缺口派生建议动作、负责模块和处理路径，不新增后端复核流。
                </p>
              </div>
              <StatusPill label={`建议 ${detail.archiveReviewActionSuggestions.length} 条`} />
            </div>
            {detail.archiveReviewActionSuggestions.length === 0 ? (
              <p className="mt-3 rounded-lg border border-rose-100 bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                暂无缺口处理建议。
              </p>
            ) : (
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {detail.archiveReviewActionSuggestions.map((suggestion) => (
                  <div key={suggestion.item} className="rounded-lg border border-rose-100 bg-rose-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-black text-rose-900">{suggestion.item}</p>
                        <p className="mt-1 break-words text-xs font-bold leading-5 text-rose-700">{suggestion.suggestedAction}</p>
                      </div>
                      <StatusPill label={suggestion.ownerModule} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <MiniFact label="建议动作" value={suggestion.suggestedAction} />
                      <MiniFact label="负责模块" value={suggestion.ownerModule} />
                      <MiniFact label="处理路径" value={suggestion.handlingPath} />
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setFocusedArchiveReviewTarget(suggestion.archiveReviewTargetSection)}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-800 transition hover:border-rose-300 hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-300"
                      >
                        定位建议证据区块
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveReviewSuggestionModuleLink(suggestion)}
                        disabled={!onNavigateBuyerModule || isArchived}
                        className="inline-flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-600 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300 disabled:cursor-not-allowed disabled:border-rose-100 disabled:bg-rose-100 disabled:text-rose-300"
                      >
                        去处理模块
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] font-bold leading-5 text-rose-700">
                      处理建议联动：进入 {suggestion.ownerModule}，并保留当前合同上下文。
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {focusedArchiveReviewRow && (
            <p aria-live="polite" className="mt-3 rounded-lg border border-rose-200 bg-white p-3 text-xs font-black leading-5 text-rose-800">
              缺口定位：{focusedArchiveReviewRow.archiveReviewLocationHint} · {focusedArchiveReviewRow.nextAction}
            </p>
          )}
          <p className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs font-bold leading-5 text-rose-800">
            复核结论：{detail.archiveReviewConclusion}。该清单只做只读聚合，不新增归档复核接口，不替代服务端归档门禁。
          </p>
        </section>
        <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-3">
          <p className="text-xs font-black text-indigo-900">归档后只读</p>
          <p className="mt-1 text-xs font-bold leading-5 text-indigo-700">{detail.archiveBoundary}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <MiniFact label="归档就绪" value={detail.archiveReadiness.status} />
            <MiniFact label="归档阻断原因" value={detail.archiveReadiness.reason} />
            <MiniFact label="下一步联动" value={detail.archiveReadiness.nextAction} />
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <p className="text-xs font-black text-indigo-900">归档复核事件证据</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <MiniFact label="事件证据覆盖" value={contractEventEvidenceSummary} />
              <MiniFact label="收货事件" value={`${receiptEventCount} 条`} />
              <MiniFact label="付款事件" value={`${paymentEventCount} 条`} />
              <MiniFact label="最近事件证据" value={latestFulfillmentEvent?.summary ?? '暂无事件证据'} />
            </div>
            <p className="mt-2 text-[11px] font-bold leading-5 text-indigo-700">
              合同事件审计提示：事件写入后会形成后端审计动作，可作为归档复核的辅助证据；最终归档门禁仍以订单收货和发票付款状态为准。
            </p>
          </div>
          <div className="mt-3 rounded-lg border border-white/80 bg-white p-3">
            <p className="text-xs font-black text-indigo-900">归档只读写入边界</p>
            <p className="mt-2 text-xs font-bold leading-5 text-indigo-700">{contractEventWriteBoundary}</p>
          </div>
          <p className="mt-2 text-[11px] font-black text-indigo-700">
            Java 已支持状态推进、归档写入和附件元数据登记；合同审批流待后续迭代。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <PrimaryActionButton
              icon={CheckCircle2}
              onClick={() => onUpdateContractStatus?.(detail.id, '履约完成', '已收货验收')}
              disabled={!javaEnabled || isArchived || !onUpdateContractStatus}
              busy={buyerFulfillmentBusyId === statusBusyId}
              pendingLabel="推进中"
              fullWidth
              flushTop
            >
              推进履约
            </PrimaryActionButton>
            <PrimaryActionButton
              icon={LockKeyhole}
              tone="amber"
              onClick={() => onArchiveContract?.(detail.id)}
              disabled={contractArchiveDisabled}
              busy={buyerFulfillmentBusyId === archiveBusyId}
              pendingLabel="归档中"
              fullWidth
              flushTop
            >
              归档合同
            </PrimaryActionButton>
          </div>
          {contractArchiveDisabled && !isArchived && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-white/80 p-3 text-xs font-bold leading-5 text-amber-800">
              归档条件未满足：请先处理阻断原因，当前为 {detail.archiveReadiness.reason}。
            </p>
          )}
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-black text-slate-900">合同归档审计视图</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                归档审计结论：{contractArchiveAuditConclusion}
              </p>
            </div>
            <StatusPill label={isArchived ? '归档审计态' : '归档预检态'} />
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-4">
            {contractArchiveAuditEvidenceRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <MiniFact label={row.label} value={row.value} />
                <p className="mt-2 text-[11px] font-bold leading-5 text-slate-600">{row.hint}</p>
              </div>
            ))}
          </div>
          <div data-review-section="contract-audit-log-detail" className={`mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 ${archiveReviewSectionHighlightClass('contract-audit-log-detail')}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-black text-slate-900">合同审计日志明细</p>
                <p className="mt-1 text-xs font-bold leading-5 text-slate-600">
                  目标对象审计：{contractTargetAuditSummary}
                </p>
              </div>
              <StatusPill label={`最近审计动作 ${latestContractTargetAuditLog?.action ?? '暂无'}`} />
            </div>
            {targetAuditLogs.length === 0 ? (
              <p className="mt-3 rounded-lg border border-white bg-white p-3 text-xs font-bold leading-5 text-slate-600">
                暂无合同目标审计日志；提交审批、审批回写或履约事件写入后会在这里展示。
              </p>
            ) : (
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {targetAuditLogs.slice(0, 4).map((log) => (
                  <div key={log.id} className="rounded-lg border border-white bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs font-black text-slate-900">{log.action}</p>
                      <StatusPill label="目标对象审计" />
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <MiniFact label="审计对象" value={`${log.targetType} · ${log.targetId}`} />
                      <MiniFact label="操作时间" value={formatAuditTime(log.createdAt)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
        <section className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-black text-blue-900">订单-合同-收货-发票付款联动</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            合同归档前先校验采购订单、收货验收和发票付款，未完成节点会形成归档阻断原因。
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {detail.linkageCheckRows.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/80 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-black text-slate-800">{row.label}</p>
                  <StatusPill label={row.status} />
                </div>
                <p className="mt-2 break-words text-xs font-bold text-slate-600">{row.value}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-black text-slate-700">合同履约链路</p>
          <div className="mt-3 space-y-2">
            {detail.fulfillmentRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2">
                <span className="text-xs font-black text-slate-600">{row.label}</span>
                <span className="min-w-0 break-words text-right text-xs font-bold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-xs font-black text-slate-700">关联业务</p>
          <div className="mt-3 space-y-2">
            {detail.relatedRows.map((row) => (
              <div key={row.id} className="rounded-md bg-slate-50 px-3 py-2">
                <p className="text-xs font-black text-slate-800">{row.title}</p>
                <p className="mt-1 break-words text-xs font-bold text-slate-500">{row.detail}</p>
              </div>
            ))}
          </div>
        </section>
        <InlineFactGrid facts={detail.facts} />
      </div>
    </Panel>
  );
};

const AuditLogList: React.FC<{ workspace: BuyerWorkspace; searchQuery: string }> = ({ workspace, searchQuery }) => {
  const logs = buildAuditLogRows(workspace);
  const [auditTargetFilter, setAuditTargetFilter] = useState(ALL_STATUS_FILTER);
  const [auditActionFilter, setAuditActionFilter] = useState(ALL_STATUS_FILTER);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const auditTargetOptions = Array.from(new Set(logs.map((log) => log.targetLabel)));
  const auditActionOptions = Array.from(new Set(logs.map((log) => log.title)));
  const filteredLogs = logs.filter((log) =>
    (auditTargetFilter === ALL_STATUS_FILTER || log.targetLabel === auditTargetFilter)
    && (auditActionFilter === ALL_STATUS_FILTER || log.title === auditActionFilter)
    && (!normalizedSearchQuery
    || [
      log.id,
      log.title,
      log.targetLabel,
      log.actorName,
      log.timeLabel,
    ].some((value) => value.toLowerCase().includes(normalizedSearchQuery))));
  const [selectedAuditLogId, setSelectedAuditLogId] = useState(filteredLogs[0]?.id ?? '');
  const selectedAuditLog = filteredLogs.some((log) => log.id === selectedAuditLogId)
    ? selectedAuditLogId
    : filteredLogs[0]?.id ?? '';
  const selectedAuditDetail = selectedAuditLog
    ? buildAuditLogDetailPanel(workspace, selectedAuditLog)
    : undefined;
  const auditFilterLabel = buildAuditFilterLabel(auditTargetFilter, auditActionFilter);
  const clearAuditFilters = () => {
    setAuditTargetFilter(ALL_STATUS_FILTER);
    setAuditActionFilter(ALL_STATUS_FILTER);
  };

  if (filteredLogs.length === 0) {
    return (
      <>
        <ListToolbar
          title="操作审计池"
          recordCount={filteredLogs.length}
          filterLabel={normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : '最近操作优先'}
          actionLabel="导出记录"
        />
        <div className="grid gap-3 lg:grid-cols-2">
          <StatusFilterControl
            label="对象类型"
            value={auditTargetFilter}
            statusOptions={auditTargetOptions}
            onChange={setAuditTargetFilter}
          />
          <StatusFilterControl
            label="动作类型"
            value={auditActionFilter}
            statusOptions={auditActionOptions}
            onChange={setAuditActionFilter}
          />
        </div>
        <FilterResultSummary
          label="操作日志筛选结果"
          filterLabel={auditFilterLabel}
          resultCount={filteredLogs.length}
          totalCount={logs.length}
          selectedLabel={selectedAuditDetail?.title}
          onClear={clearAuditFilters}
        />
        <EmptyState title="暂无审计记录" desc="当前对象类型或搜索条件下没有匹配的操作日志。" />
      </>
    );
  }

  return (
    <>
      <ListToolbar
        title="操作审计池"
        recordCount={filteredLogs.length}
        filterLabel={normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : '最近操作优先'}
        actionLabel="导出日志"
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <StatusFilterControl
          label="对象类型"
          value={auditTargetFilter}
          statusOptions={auditTargetOptions}
          onChange={setAuditTargetFilter}
        />
        <StatusFilterControl
          label="动作类型"
          value={auditActionFilter}
          statusOptions={auditActionOptions}
          onChange={setAuditActionFilter}
        />
      </div>
      <FilterResultSummary
        label="操作日志筛选结果"
        filterLabel={auditFilterLabel}
        resultCount={filteredLogs.length}
        totalCount={logs.length}
        selectedLabel={selectedAuditDetail?.title}
        onClear={clearAuditFilters}
      />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid gap-3 md:grid-cols-2">
          {filteredLogs.map((log) => (
            <AdminInfoCard
              key={log.id}
              title={log.title}
              meta={log.targetLabel}
              badge={log.timeLabel}
              facts={[
                { label: '操作人', value: log.actorName },
                { label: '审计编号', value: log.id },
              ]}
              detailSelected={selectedAuditLog === log.id}
              onSelectDetail={() => setSelectedAuditLogId(log.id)}
            />
          ))}
        </div>
        <AuditLogDetailPanelView detail={selectedAuditDetail} />
      </div>
    </>
  );
};

const buildAuditFilterLabel = (targetFilter: string, actionFilter: string) => {
  const labels = [
    targetFilter !== ALL_STATUS_FILTER ? `对象类型：${targetFilter}` : '',
    actionFilter !== ALL_STATUS_FILTER ? `动作类型：${actionFilter}` : '',
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(' · ') : ALL_STATUS_FILTER;
};

const ApprovalTemplateSettings: React.FC<{
  templates: JavaApprovalTemplateDto[];
  roles: BuyerRoleDto[];
  onSave: (
    templateCode: string,
    defaultApproverRoleId: string,
    status: 'active' | 'inactive',
  ) => void;
}> = ({ templates, roles, onSave }) => {
  const [drafts, setDrafts] = useState<Record<string, {
    defaultApproverRoleId: string;
    status: 'active' | 'inactive';
  }>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(templates.map((template) => [
      template.templateCode,
      {
        defaultApproverRoleId: template.defaultApproverRoleId,
        status: template.status === 'active' ? 'active' : 'inactive',
      },
    ])));
  }, [templates]);

  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name ?? roleId;

  if (templates.length === 0) {
    return (
      <Panel title="审批模板配置" icon={Settings}>
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
          暂无可配置审批模板
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="审批模板配置" icon={Settings}>
      <div className="space-y-3">
        {templates.map((template) => {
          const draft = drafts[template.templateCode] ?? {
            defaultApproverRoleId: template.defaultApproverRoleId,
            status: template.status === 'active' ? 'active' : 'inactive',
          };
          return (
            <div key={template.templateCode} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-950">{template.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{approvalTypeLabel(template.bizType)}</p>
                </div>
                <StatusPill label={draft.status === 'active' ? '启用' : '停用'} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">默认审批角色</span>
                  <select
                    value={draft.defaultApproverRoleId}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [template.templateCode]: {
                        ...draft,
                        defaultApproverRoleId: event.target.value,
                      },
                    }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                    {!roles.some((role) => role.id === draft.defaultApproverRoleId) && (
                      <option value={draft.defaultApproverRoleId}>
                        {roleName(draft.defaultApproverRoleId)}
                      </option>
                    )}
                  </select>
                </label>

                <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-600">
                  <input
                    type="checkbox"
                    checked={draft.status === 'active'}
                    onChange={(event) => setDrafts((current) => ({
                      ...current,
                      [template.templateCode]: {
                        ...draft,
                        status: event.target.checked ? 'active' : 'inactive',
                      },
                    }))}
                    className="h-4 w-4 accent-blue-600"
                  />
                  启用
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="truncate text-xs font-bold text-slate-500">
                  当前默认：{roleName(template.defaultApproverRoleId)}
                </p>
                <button
                  type="button"
                  onClick={() => onSave(template.templateCode, draft.defaultApproverRoleId, draft.status)}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
                >
                  保存配置
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

const DemandDetailPanelView: React.FC<{
  detail?: DemandDetailPanel;
  demand?: BuyerWorkspace['demands'][number];
  workspace: BuyerWorkspace;
  javaEnabled: boolean;
  linkedDemandIds: Set<string>;
  demandSubmitBusyId: string | null;
  demandUpdateBusyId: string | null;
  rfqCreateBusy: string | null;
  onSubmitDemand: (demandId: string) => void;
  onUpdateDemand: (demandId: string, payload: UpdateDemandPayload) => void;
  onCreateRfqFromDemand: (demandId: string, supplierIds: string[], deadline: string) => void;
}> = ({
  detail,
  demand,
  workspace,
  javaEnabled,
  linkedDemandIds,
  demandSubmitBusyId,
  demandUpdateBusyId,
  rfqCreateBusy,
  onSubmitDemand,
  onUpdateDemand,
  onCreateRfqFromDemand,
}) => {
  const [editableDemandTitle, setEditableDemandTitle] = useState(demand?.title ?? '');
  const [editableDemandDepartment, setEditableDemandDepartment] = useState(demand?.department ?? '');
  const [editableDemandBudget, setEditableDemandBudget] = useState(demand?.budget ?? 0);
  const [editableDemandLineItems, setEditableDemandLineItems] = useState(
    demand?.lineItems.length ? demand.lineItems : [{ materialId: workspace.materials[0]?.id ?? '', quantity: 1 }],
  );

  useEffect(() => {
    setEditableDemandTitle(demand?.title ?? '');
    setEditableDemandDepartment(demand?.department ?? '');
    setEditableDemandBudget(demand?.budget ?? 0);
    setEditableDemandLineItems(
      demand?.lineItems.length ? demand.lineItems : [{ materialId: workspace.materials[0]?.id ?? '', quantity: 1 }],
    );
  }, [demand?.id, demand?.title, demand?.department, demand?.budget, demand?.lineItems, workspace.materials]);

  const updateEditableDemandLineItem = (index: number, nextLineItem: Partial<(typeof editableDemandLineItems)[number]>) => {
    setEditableDemandLineItems((current) => current.map((lineItem, currentIndex) =>
      currentIndex === index ? { ...lineItem, ...nextLineItem } : lineItem,
    ));
  };

  const addEditableDemandLineItem = () => {
    setEditableDemandLineItems((current) => [...current, { materialId: workspace.materials[0]?.id ?? '', quantity: 1 }]);
  };

  const removeEditableDemandLineItem = (index: number) => {
    setEditableDemandLineItems((current) => current.length === 1
      ? current
      : current.filter((_, currentIndex) => currentIndex !== index));
  };

  const validEditableLineItems = editableDemandLineItems
    .filter((lineItem) => lineItem.materialId && lineItem.quantity > 0)
    .map((lineItem) => ({ materialId: lineItem.materialId, quantity: Number(lineItem.quantity) }));
  const editableDemandInvalid = !editableDemandTitle.trim()
    || !editableDemandDepartment
    || editableDemandBudget <= 0
    || validEditableLineItems.length === 0;
  const admittedSupplierCount = workspace.privateSupplierRelations.filter((relation) => relation.status === '已准入').length;
  const demandCreateRfqAvailability = !javaEnabled
    ? '当前为 mock 数据源，切换 Java 模式后可创建真实询价。'
    : !demand
      ? '未找到需求原始记录，请刷新后重试。'
        : linkedDemandIds.has(demand.id)
          ? '该需求已关联询价，避免重复创建 RFQ。'
        : demand.status !== '已通过'
          ? '需求审批通过后才能创建询价。'
          : admittedSupplierCount === 0
            ? '暂无已准入供应商，需先完成供应商准入。'
            : `可邀请 ${admittedSupplierCount} 家已准入供应商创建询价。`;
  const demandWriteBoundaryRows = [
    {
      label: '审批中禁改提示',
      value: demand?.status === '审批中'
        ? '审批中需求已锁定编辑，待审批通过或驳回后再继续处理。'
        : '只有草稿需求允许编辑，提交后由审批结果驱动下一步。',
    },
    {
      label: '重复提交保护',
      value: demandSubmitBusyId === demand?.id
        ? '提交审批请求处理中，请等待 Java 返回后再继续操作。'
        : '非草稿、审批中或已通过需求不会重复开放提交审批按钮。',
    },
    {
      label: '已通过创建 RFQ 准备提示',
      value: demand?.status === '已通过'
        ? '请先确认已准入供应商、报价截止时间和重复创建风险。'
        : '需求审批通过前不开放创建 RFQ 表单。',
    },
    {
      label: 'Java 错误反馈文案',
      value: '若 Java 写入失败，顶部流程提示会展示服务端返回的错误信息。',
    },
  ];

  return (
    <Panel title="需求详情" icon={FileText}>
      {!detail ? (
        <EmptyState title="暂无需求详情" desc="选择一条采购需求后，可查看物料明细、关联询价和审批上下文。" />
      ) : (
        <DetailPanelBody>
          <DetailHeroCard
            eyebrow="采购需求"
            title={detail.title}
            meta={detail.id}
            status={detail.status}
            facts={detail.facts}
            summaryFacts={[
              { label: '审批状态', value: detail.approvalLabel },
              { label: '下一步', value: detail.nextActionTitle },
            ]}
          />

        <DetailSection title="采购需求主流程判断">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <MiniFact label="审批状态" value={detail.approvalLabel} />
            <MiniFact label="预算与附件" value={`${detail.facts.find((fact) => fact.label.includes('预算'))?.value ?? '预算待同步'} · 附件入口随需求对象保留`} />
            <MiniFact label="物料明细" value={`${detail.lineItems.length} 行物料/服务明细`} />
            <MiniFact label="创建询价可用性" value={demandCreateRfqAvailability} />
          </div>
        </DetailSection>

        <DetailSection title="采购需求写入边界">
          <div className="space-y-2">
            {demandWriteBoundaryRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </DetailSection>

        <DetailSection title="物料明细" countLabel={`${detail.lineItems.length} 行`}>
          <div className="space-y-2">
            {detail.lineItems.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.category}</p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-black text-slate-900">
                    {item.referenceAmountLabel}
                  </p>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500">数量 {item.quantityLabel}</p>
              </div>
            ))}
          </div>
        </DetailSection>

        <DetailSection title="需求编辑">
          <div className="space-y-3">
            <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
              只能编辑草稿需求。保存后会重新刷新 Java 工作台数据，验证刷新后回显。
            </p>
            <label className="block text-xs font-black text-slate-500" htmlFor={`edit-demand-title-${detail.id}`}>
              需求标题
            </label>
            <input
              id={`edit-demand-title-${detail.id}`}
              value={editableDemandTitle}
              onChange={(event) => setEditableDemandTitle(event.target.value)}
              disabled={!javaEnabled || demand?.status !== '草稿'}
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-black text-slate-500" htmlFor={`edit-demand-department-${detail.id}`}>
                  申请部门
                </label>
                <select
                  id={`edit-demand-department-${detail.id}`}
                  value={editableDemandDepartment}
                  onChange={(event) => setEditableDemandDepartment(event.target.value)}
                  disabled={!javaEnabled || demand?.status !== '草稿'}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {workspace.departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black text-slate-500" htmlFor={`edit-demand-budget-${detail.id}`}>
                  预算金额
                </label>
                <input
                  id={`edit-demand-budget-${detail.id}`}
                  type="number"
                  min={1}
                  value={editableDemandBudget}
                  onChange={(event) => setEditableDemandBudget(Number(event.target.value))}
                  disabled={!javaEnabled || demand?.status !== '草稿'}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black text-slate-500">物料行</p>
                <button
                  type="button"
                  onClick={addEditableDemandLineItem}
                  disabled={!javaEnabled || demand?.status !== '草稿'}
                  className="inline-flex h-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  增加物料
                </button>
              </div>
              {editableDemandLineItems.map((lineItem, index) => (
                <div key={`${lineItem.materialId}:${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_90px_64px]">
                  <select
                    value={lineItem.materialId}
                    onChange={(event) => updateEditableDemandLineItem(index, { materialId: event.target.value })}
                    disabled={!javaEnabled || demand?.status !== '草稿'}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {workspace.materials.map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={lineItem.quantity}
                    onChange={(event) => updateEditableDemandLineItem(index, { quantity: Number(event.target.value) })}
                    disabled={!javaEnabled || demand?.status !== '草稿'}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeEditableDemandLineItem(index)}
                    disabled={!javaEnabled || demand?.status !== '草稿' || editableDemandLineItems.length === 1}
                    className="h-9 rounded-lg border border-red-100 bg-red-50 px-2 text-xs font-black text-red-700 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
            {editableDemandInvalid && (
              <p aria-live="polite" className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                请填写标题、部门、预算和至少一行有效物料后再保存需求修改。
              </p>
            )}
            <PrimaryActionButton
              onClick={() => demand && onUpdateDemand(demand.id, {
                title: editableDemandTitle.trim(),
                department: editableDemandDepartment,
                requester: demand.requester,
                budget: editableDemandBudget,
                lineItems: validEditableLineItems,
              })}
              disabled={!javaEnabled || demand?.status !== '草稿' || !demand || editableDemandInvalid || demandUpdateBusyId === demand?.id}
              busy={demandUpdateBusyId === demand?.id}
              icon={FileText}
              pendingLabel="保存中"
              fullWidth
            >
              保存需求修改
            </PrimaryActionButton>
          </div>
        </DetailSection>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联询价</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.linkedRfqs.length} 个
            </span>
          </div>
          {detail.linkedRfqs.length > 0 ? (
            <div className="space-y-2">
              {detail.linkedRfqs.map((rfq) => (
                <div key={rfq.id} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{rfq.title}</p>
                      <p className="mt-1 text-xs font-bold text-blue-700">{rfq.quoteLabel}</p>
                    </div>
                    <StatusPill label={rfq.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无关联询价，需求审批通过后可从列表创建 RFQ。
            </p>
          )}
        </section>

        <DetailSection title="流程检查">
          <div className="space-y-2">
            {detail.flowCheckRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </DetailSection>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">流程轨迹</p>
          <div className="space-y-2">
            {detail.workflowTimelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联业务</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.relatedRows.length} 条
            </span>
          </div>
          {detail.relatedRows.length > 0 ? (
            <div className="space-y-2">
              {detail.relatedRows.map((row) => (
                <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无关联业务记录。
            </p>
          )}
        </section>

        <DemandDetailOperationPanel
          detail={detail}
          demand={demand}
          workspace={workspace}
          javaEnabled={javaEnabled}
          linkedDemandIds={linkedDemandIds}
          demandSubmitBusyId={demandSubmitBusyId}
          rfqCreateBusy={rfqCreateBusy}
          onSubmitDemand={onSubmitDemand}
          onCreateRfqFromDemand={onCreateRfqFromDemand}
        />
      </DetailPanelBody>
    )}
  </Panel>
  );
};

const DemandDetailOperationPanel: React.FC<{
  detail: DemandDetailPanel;
  demand?: BuyerWorkspace['demands'][number];
  workspace: BuyerWorkspace;
  javaEnabled: boolean;
  linkedDemandIds: Set<string>;
  demandSubmitBusyId: string | null;
  rfqCreateBusy: string | null;
  onSubmitDemand: (demandId: string) => void;
  onCreateRfqFromDemand: (demandId: string, supplierIds: string[], deadline: string) => void;
}> = ({
  detail,
  demand,
  workspace,
  javaEnabled,
  linkedDemandIds,
  demandSubmitBusyId,
  rfqCreateBusy,
  onSubmitDemand,
  onCreateRfqFromDemand,
}) => {
  const hasAdmittedSuppliers = workspace.privateSupplierRelations.some((relation) => relation.status === '已准入');

  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">需求操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在详情中提交审批、创建询价并继续主流程联调。"
        />
      </section>
    );
  }

  if (!demand) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">需求操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="未找到需求记录"
          desc="请重新选择采购需求或刷新数据。"
        />
      </section>
    );
  }

  const linked = linkedDemandIds.has(demand.id);
  const submittingCurrentDemand = demandSubmitBusyId === demand.id;

  return (
    <DetailActionPanel
      title="需求操作"
      desc={detail.nextActionTitle}
      status={detail.status}
    >
      {demand.status === '草稿' && (
        <>
          {submittingCurrentDemand && (
            <ProcessStateNotice
              variant="waiting"
              title="重复提交保护"
              desc="提交审批请求处理中，请等待 Java 返回后再继续操作。"
            />
          )}
          <PrimaryActionButton
            onClick={() => onSubmitDemand(demand.id)}
            disabled={submittingCurrentDemand}
            busy={submittingCurrentDemand}
            icon={ClipboardCheck}
            pendingLabel="提交中"
            fullWidth
            testId={`stage7-submit-demand-detail-${demand.id}`}
          >
            提交审批
          </PrimaryActionButton>
        </>
      )}

      {demand.status === '已通过' && !linked && hasAdmittedSuppliers && (
        <>
          <ProcessStateNotice
            variant="handled"
            title="已通过创建 RFQ 准备提示"
            desc="请先确认已准入供应商、报价截止时间和重复创建风险。"
          />
          <RfqCreateForm
            demand={demand}
            suppliers={workspace.suppliers}
            relations={workspace.privateSupplierRelations}
            busy={rfqCreateBusy === demand.id}
            onSubmit={onCreateRfqFromDemand}
          />
        </>
      )}

      {demand.status === '已通过' && !linked && !hasAdmittedSuppliers && (
        <ProcessStateNotice
          variant="waiting"
          title="缺少已准入供应商"
          desc="先在供应商库完成准入，再回到需求详情创建询价项目。"
        />
      )}

      {demand.status === '已通过' && linked && (
        <ProcessStateNotice
          variant="handled"
          title="询价已创建"
          desc="该需求已关联询价项目，可切换到询价项目或报价对比继续处理。"
        />
      )}

      {demand.status === '审批中' && (
        <ProcessStateNotice
          variant="waiting"
          title="审批中禁改提示"
          desc="审批中需求已锁定编辑，待审批通过或驳回后再继续处理。"
        />
      )}

      {demand.status === '已驳回' && (
        <ProcessStateNotice
          variant="waiting"
          title="需求已驳回"
          desc="请调整需求内容后重新提交审批。"
        />
      )}
    </DetailActionPanel>
  );
};

const ApprovalReviewForm: React.FC<{
  approvalId: string;
  draft: BuyerApprovalReviewDraft;
  busy: boolean;
  onChange: (draft: BuyerApprovalReviewDraft) => void;
  onReject: () => void;
  onApprove: () => void;
}> = ({ approvalId, draft, busy, onChange, onReject, onApprove }) => {
  const approvalCommentInvalid = draft.comment.trim().length === 0;
  const approvalConfirmationInvalid = !draft.confirmed;
  const approvalReviewInvalid = approvalCommentInvalid || approvalConfirmationInvalid;

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <label className="block text-xs font-black text-blue-800" htmlFor={`approval-review-comment-${approvalId}`}>
        审批意见
      </label>
      <textarea
        id={`approval-review-comment-${approvalId}`}
        value={draft.comment}
        onChange={(event) => onChange({ ...draft, comment: event.target.value })}
        className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      <label
        htmlFor={`approval-review-confirmed-${approvalId}`}
        className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-white p-3 text-xs font-bold text-slate-600"
      >
        <input
          id={`approval-review-confirmed-${approvalId}`}
          type="checkbox"
          checked={draft.confirmed}
          onChange={(event) => onChange({ ...draft, confirmed: event.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-blue-200 text-blue-600"
        />
        <span>已核对业务上下文和审批影响</span>
      </label>
      {approvalReviewInvalid && (
        <div aria-live="polite" className="mt-3 space-y-2">
          {approvalCommentInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写审批意见后再处理。
            </p>
          )}
          {approvalConfirmationInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请先确认已核对业务上下文和审批影响。
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <PrimaryActionButton
          onClick={onReject}
          disabled={busy || approvalReviewInvalid}
          busy={busy}
          tone="red"
          pendingLabel="处理中"
          fullWidth
        >
          驳回
        </PrimaryActionButton>
        <PrimaryActionButton
          onClick={onApprove}
          disabled={busy || approvalReviewInvalid}
          busy={busy}
          tone="emerald"
          icon={CheckCircle2}
          pendingLabel="处理中"
          fullWidth
          testId={`stage7-approve-${approvalId}`}
        >
          通过
        </PrimaryActionButton>
      </div>
    </div>
  );
};

const ApprovalDetailPanelView: React.FC<{
  detail?: ApprovalDetailPanel;
  approval?: JavaApprovalTaskDto;
  approvalBusyId: string | null;
  javaEnabled: boolean;
  reviewDraft?: BuyerApprovalReviewDraft;
  onChangeReviewDraft: (approvalId: string, draft: BuyerApprovalReviewDraft) => void;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft) => void;
}> = ({
  detail,
  approval,
  approvalBusyId,
  javaEnabled,
  reviewDraft,
  onChangeReviewDraft,
  onReviewApproval,
}) => (
  <Panel title="审批详情" icon={ShieldCheck}>
    {!detail ? (
      <EmptyState title="暂无审批详情" desc="选择一条待办或最近审批记录后，可查看业务上下文和处理轨迹。" />
    ) : (
      <DetailPanelBody>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{detail.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail.typeLabel} · {detail.id}</p>
            </div>
            <StatusPill label={detail.status} />
          </div>
          <InlineFactGrid facts={detail.facts} />
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">业务上下文</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.businessFacts.map((fact) => (
              <MiniFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">处理检查</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.reviewCheckRows.map((row) => (
              <MiniFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        {detail.reviewComment && (
          <section>
            <p className="mb-2 text-xs font-black text-slate-500">审批意见记录</p>
            <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              {detail.reviewComment}
            </p>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联明细</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.contextRows.length} 条
            </span>
          </div>
          {detail.contextRows.length > 0 ? (
            <div className="space-y-2">
              {detail.contextRows.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="truncate text-sm font-black text-slate-900">{row.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{row.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无可展示的关联明细。
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">处理轨迹</p>
          <div className="space-y-2">
            {detail.timelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} fontMono />
            ))}
          </div>
        </section>

        <ApprovalDetailOperationPanel
          detail={detail}
          approval={approval}
          approvalBusyId={approvalBusyId}
          javaEnabled={javaEnabled}
          reviewDraft={reviewDraft}
          onChangeReviewDraft={onChangeReviewDraft}
          onReviewApproval={onReviewApproval}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const ApprovalDetailOperationPanel: React.FC<{
  detail: ApprovalDetailPanel;
  approval?: JavaApprovalTaskDto;
  approvalBusyId: string | null;
  javaEnabled: boolean;
  reviewDraft?: BuyerApprovalReviewDraft;
  onChangeReviewDraft: (approvalId: string, draft: BuyerApprovalReviewDraft) => void;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean, draft: BuyerApprovalReviewDraft) => void;
}> = ({
  detail,
  approval,
  approvalBusyId,
  javaEnabled,
  reviewDraft,
  onChangeReviewDraft,
  onReviewApproval,
}) => {
  const busy = approvalBusyId === detail.id;
  const approvalStatus = detail.reviewCheckRows.find((row) => row.label === '审批状态')?.value ?? detail.status;
  const businessStatus = detail.reviewCheckRows.find((row) => row.label === '业务状态')?.value ?? detail.status;
  const contextCount = detail.reviewCheckRows.find((row) => row.label === '关联明细')?.value ?? `${detail.contextRows.length} 条`;
  const pendingTime = detail.timelineRows.find((row) => row.label === '等待处理')?.value
    ?? detail.timelineRows.find((row) => row.label === '处理完成')?.value
    ?? '未记录';
  const nextAction = detail.reviewCheckRows.find((row) => row.label === '下一步')?.value ?? (detail.canReview ? '通过或驳回' : '已归档');
  const renderApprovalSummary = () => (
    <div className="mb-3 rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-black text-slate-500">审批摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="审批类型" value={detail.typeLabel} />
        <MiniFact label="审批状态" value={approvalStatus} />
        <MiniFact label="业务状态" value={businessStatus} />
        <MiniFact label="关联明细" value={contextCount} />
        <MiniFact label="等待处理" value={pendingTime} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">审批操作</p>
          <p className="mt-1 text-sm font-black text-slate-950">{detail.canReview ? '等待审批处理' : '审批结果已归档'}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {renderApprovalSummary()}

      {!javaEnabled && (
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 数据源后，可在详情中直接通过或驳回审批。"
        />
      )}

      {javaEnabled && detail.canReview && !approval && (
        <ProcessStateNotice
          variant="blocked"
          title="未找到审批任务"
          desc="请刷新审批队列后重新选择待办，再执行审批处理。"
        />
      )}

      {javaEnabled && approval && detail.canReview && reviewDraft && (
        <ApprovalReviewForm
          approvalId={approval.id}
          draft={reviewDraft}
          busy={busy}
          onChange={(draft) => onChangeReviewDraft(approval.id, draft)}
          onReject={() => onReviewApproval(approval, false, reviewDraft)}
          onApprove={() => onReviewApproval(approval, true, reviewDraft)}
        />
      )}

      {javaEnabled && !detail.canReview && (
        <ProcessStateNotice
          variant="handled"
          title="该审批已处理"
          desc="审批结果已写入业务状态，当前详情仅保留业务上下文和处理轨迹。"
        />
      )}
    </section>
  );
};

const AuditLogDetailPanelView: React.FC<{
  detail?: AuditLogDetailPanel;
}> = ({ detail }) => (
  <Panel title="日志详情" icon={Activity}>
    {!detail ? (
      <EmptyState title="暂无日志详情" desc="选择一条审计记录后，可查看操作对象、关联业务和处理轨迹。" />
    ) : (
      <DetailPanelBody>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{detail.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail.actionCode}</p>
            </div>
            <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
              {detail.timeLabel}
            </span>
          </div>
          <InlineFactGrid facts={detail.facts} />
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">对象上下文</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.targetFacts.map((fact) => (
              <MiniFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">追溯检查</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.traceabilityRows.map((row) => (
              <MiniFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联业务</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.relatedRows.length} 条
            </span>
          </div>
          {detail.relatedRows.length > 0 ? (
            <div className="space-y-2">
              {detail.relatedRows.map((row) => (
                <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无关联业务记录。
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">处理轨迹</p>
          <div className="space-y-2">
            {detail.timelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} fontMono />
            ))}
          </div>
        </section>

        <AuditTraceabilitySummaryPanel detail={detail} />
        <AuditLogDetailOperationPanel detail={detail} />
      </DetailPanelBody>
    )}
  </Panel>
);

const AuditTraceabilitySummaryPanel: React.FC<{
  detail: AuditLogDetailPanel;
}> = ({ detail }) => {
  const targetType = detail.facts.find((fact) => fact.label === '对象类型')?.value ?? detail.targetLabel;
  const targetId = detail.facts.find((fact) => fact.label === '对象编号')?.value ?? detail.targetLabel;
  const traceResult = detail.traceabilityRows.find((row) => row.label === '留痕结果')?.value ?? detail.traceabilityStatus;

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">审计结论</p>
          <p className="mt-1 text-sm font-black text-slate-950">{detail.traceabilityTitle}</p>
        </div>
        <StatusPill label={detail.traceabilityStatus} />
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-slate-600">{detail.traceabilityDesc}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="操作人" value={detail.actorName} />
        <MiniFact label="操作时间" value={detail.timeLabel} />
        <MiniFact label="对象" value={detail.targetLabel} />
        <MiniFact label="关联业务" value={`${detail.relatedRows.length} 条`} />
      </div>
      <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-xs font-black text-slate-500">操作摘要</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MiniFact label="动作编码" value={detail.actionCode} />
          <MiniFact label="对象类型" value={targetType} />
          <MiniFact label="对象编号" value={targetId} />
          <MiniFact label="留痕结果" value={traceResult} />
          <MiniFact label="关联业务" value={`${detail.relatedRows.length} 条`} />
        </div>
      </div>
    </section>
  );
};

const AuditLogDetailOperationPanel: React.FC<{
  detail: AuditLogDetailPanel;
}> = ({ detail }) => {
  const recommendedAction = detail.traceabilityStatus === '完整留痕'
    ? '归档审计记录，必要时用于业务追溯和合规抽查。'
    : '补齐操作对象、关联业务和处理轨迹后再归档。';

  return (
    <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-emerald-700">追溯处理摘要</p>
          <p className="mt-1 text-sm font-black text-slate-950">{detail.title}</p>
        </div>
        <StatusPill label={detail.traceabilityStatus} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="追溯状态" value={detail.traceabilityStatus} />
        <MiniFact label="关联业务" value={`${detail.relatedRows.length} 条`} />
        <MiniFact label="处理轨迹" value={`${detail.timelineRows.length} 条`} />
        <MiniFact label="操作时间" value={detail.timeLabel} />
      </div>
      <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
        <p className="text-xs font-black text-slate-500">建议动作</p>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-600">{recommendedAction}</p>
      </div>
    </section>
  );
};

const RfqDetailPanelView: React.FC<{
  detail?: RfqDetailPanel;
  rfq?: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  rfqUpdateBusyId: string | null;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  awardDraft?: BuyerAwardDraft;
  orderDraft?: BuyerOrderDraft;
  onChangeAwardDraft: (rfqId: string, draft: BuyerAwardDraft) => void;
  onChangeOrderDraft: (awardId: string, draft: BuyerOrderDraft) => void;
  onUpdateRfq: (rfqId: string, payload: UpdateRfqPayload) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  rfqUpdateBusyId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  awardDraft,
  orderDraft,
  onChangeAwardDraft,
  onChangeOrderDraft,
  onUpdateRfq,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
}) => {
  const [editableRfqTitle, setEditableRfqTitle] = useState(rfq?.title ?? '');
  const [editableRfqDeadline, setEditableRfqDeadline] = useState(rfq?.deadline.slice(0, 16) ?? '');
  const [editableRfqSupplierIds, setEditableRfqSupplierIds] = useState<string[]>(rfq?.invitedSupplierIds ?? []);

  useEffect(() => {
    setEditableRfqTitle(rfq?.title ?? '');
    setEditableRfqDeadline(rfq?.deadline.slice(0, 16) ?? '');
    setEditableRfqSupplierIds(rfq?.invitedSupplierIds ?? []);
  }, [rfq?.id, rfq?.title, rfq?.deadline, rfq?.invitedSupplierIds]);

  const rfqEligibleRelations = workspace.privateSupplierRelations.filter((relation) =>
    relation.status === '已准入'
      && Boolean(relation.qualifications?.some((qualification) => qualification.status === 'active')));
  const rfqEligibleSupplierIds = new Set(rfqEligibleRelations.map((relation) => relation.supplierId));
  const editableEligibleSupplierIds = editableRfqSupplierIds.filter((supplierId) => rfqEligibleSupplierIds.has(supplierId));
  const editableRfqInvalid = !editableRfqTitle.trim()
    || !editableRfqDeadline
    || editableEligibleSupplierIds.length === 0;
  const updateEditableRfqSupplier = (supplierId: string, checked: boolean) => {
    setEditableRfqSupplierIds((current) =>
      checked
        ? Array.from(new Set([...current, supplierId]))
        : current.filter((item) => item !== supplierId),
    );
  };
  const canEditRfq = javaEnabled && rfq?.status === '报价中';
  const rfqDeadlineLabel = detail?.facts.find((fact) => fact.label.includes('截止'))?.value
    ?? (rfq?.deadline ? rfq.deadline.replace('T', ' ').slice(0, 16) : '未维护');
  const rfqRequirementLabel = rfq
    ? `按 RFQ 要求在线报价，已邀请 ${rfq.invitedSupplierIds.length} 家供应商。`
    : '选择询价项目后展示报价要求。';

  return (
    <Panel title="询价详情" icon={Send}>
      {!detail ? (
        <EmptyState title="暂无询价详情" desc="选择一个询价项目后，可查看关联需求、邀请供应商、报价排行和履约状态。" />
      ) : (
        <DetailPanelBody>
        <DetailHeroCard
          eyebrow="询价项目"
          title={detail.title}
          meta={detail.id}
          status={detail.status}
          facts={detail.facts}
          summaryFacts={[
            { label: '推荐结果', value: detail.recommendedSupplierLabel },
            { label: '订单状态', value: detail.orderLabel },
            { label: '下一步', value: detail.nextActionTitle },
          ]}
        />

        <DetailSection title="询价状态流转">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <MiniFact label="供应商邀请" value={`${detail.supplierRows.length} 家供应商已进入邀请池`} />
            <MiniFact label="报价要求" value={rfqRequirementLabel} />
            <MiniFact label="截止时间" value={rfqDeadlineLabel} />
            <MiniFact label="报价数量" value={`${detail.quoteRows.length} 条报价，状态为 ${detail.status}`} />
          </div>
        </DetailSection>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联需求</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.demandRows.length} 条
            </span>
          </div>
          <div className="space-y-2">
            {detail.demandRows.map((demand) => (
              <div key={demand.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{demand.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{demand.budgetLabel}</p>
                  </div>
                  <StatusPill label={demand.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">邀请供应商</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.supplierRows.length} 家
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.supplierRows.map((supplier) => (
              <div key={supplier.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-slate-900">{supplier.name}</p>
                  <StatusPill label={supplier.status} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <DetailSection title="报价排行" countLabel={`${detail.quoteRows.length} 条`}>
          {detail.quoteRows.length > 0 ? (
            <div className="space-y-2">
              {detail.quoteRows.map((quote) => (
                <div
                  key={quote.id}
                  className={`rounded-lg border p-3 ${
                    quote.awarded
                      ? 'border-emerald-200 bg-emerald-50'
                      : quote.recommended
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{quote.supplierName}</p>
                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-black text-slate-500">
                          {quote.rankLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {quote.deliveryLabel}交付 · 税率 {quote.taxLabel}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-black text-slate-900">{quote.amountLabel}</p>
                  </div>
                  {(quote.recommended || quote.awarded) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {quote.recommended && (
                        <span className="rounded-lg bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-700">
                          推荐报价
                        </span>
                      )}
                      {quote.awarded && (
                        <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700">
                          已定标
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无供应商报价，等待邀请供应商响应。
            </p>
          )}
        </DetailSection>

        {detail.awardApprovalComment && (
          <DetailSection title="定标审批意见">
            <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              {detail.awardApprovalComment}
            </p>
          </DetailSection>
        )}

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">履约轨迹</p>
          <div className="space-y-2">
            {detail.fulfillmentTimelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <DetailSection title="关联业务" countLabel={`${detail.relatedRows.length} 条`}>
          {detail.relatedRows.length > 0 ? (
            <div className="space-y-2">
              {detail.relatedRows.map((row) => (
                <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无关联业务记录。
            </p>
          )}
        </DetailSection>

        <DetailSection title="询价编辑">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
            只能编辑报价中的 RFQ。保存后会通知供应商按最新要求报价，并刷新 Java 工作台数据。
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Field label="询价标题">
              <input
                value={editableRfqTitle}
                onChange={(event) => setEditableRfqTitle(event.target.value)}
                disabled={!canEditRfq}
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </Field>
            <Field label="报价截止时间">
              <input
                type="datetime-local"
                value={editableRfqDeadline}
                onChange={(event) => setEditableRfqDeadline(event.target.value)}
                disabled={!canEditRfq}
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-500">邀请供应商</p>
            {rfqEligibleRelations.length === 0 ? (
              <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                暂无具备有效资质的已准入供应商，无法编辑邀请列表。
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                {workspace.privateSupplierRelations.map((relation) => {
                  const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
                  const checked = editableRfqSupplierIds.includes(relation.supplierId);
                  const eligible = rfqEligibleSupplierIds.has(relation.supplierId);
                  return (
                    <label
                      key={relation.id}
                      className={`rounded-lg border bg-white p-3 transition ${
                        checked ? 'border-blue-300 ring-2 ring-blue-100' : eligible ? 'border-slate-200' : 'border-amber-100 bg-amber-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!canEditRfq || !eligible}
                          onChange={(event) => updateEditableRfqSupplier(relation.supplierId, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-slate-300"
                        />
                        <div className="min-w-0">
                          <p className="break-words text-xs font-black text-slate-800">{supplier?.name ?? relation.supplierId}</p>
                          <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">
                            {relation.level} 级 · 绩效 {relation.performanceScore} 分
                          </p>
                          {!eligible && (
                            <p className="mt-1 break-words text-xs font-black leading-5 text-amber-700">
                              {relation.status !== '已准入' ? '未完成准入，不可邀请' : '无有效资质，不可邀请'}
                            </p>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {(!canEditRfq || editableRfqInvalid) && (
            <p aria-live="polite" className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              {!canEditRfq ? '只能编辑报价中的 RFQ。' : '请填写询价标题、报价截止时间并至少选择一家具备有效资质的已准入供应商。'}
            </p>
          )}
          <PrimaryActionButton
            onClick={() => rfq && onUpdateRfq(rfq.id, {
              title: editableRfqTitle.trim(),
              invitedSupplierIds: editableEligibleSupplierIds,
              deadline: `${editableRfqDeadline}:00+08:00`,
            })}
            disabled={!rfq || !canEditRfq || editableRfqInvalid || rfqUpdateBusyId === rfq?.id}
            busy={rfqUpdateBusyId === rfq?.id}
            icon={Send}
            pendingLabel="保存中"
            fullWidth
          >
            保存询价修改
          </PrimaryActionButton>
        </DetailSection>

        <RfqDetailOperationPanel
          detail={detail}
          rfq={rfq}
          workspace={workspace}
          approvedAwardId={approvedAwardId}
          awardSubmitBusyId={awardSubmitBusyId}
          orderCreateBusy={orderCreateBusy}
          javaEnabled={javaEnabled}
          awardDraft={awardDraft}
          orderDraft={orderDraft}
          onChangeAwardDraft={onChangeAwardDraft}
          onChangeOrderDraft={onChangeOrderDraft}
          onSubmitAwardApproval={onSubmitAwardApproval}
          onCreateOrderFromAward={onCreateOrderFromAward}
        />
        </DetailPanelBody>
      )}
    </Panel>
  );
};

const RfqDetailOperationPanel: React.FC<{
  detail: RfqDetailPanel;
  rfq?: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  awardDraft?: BuyerAwardDraft;
  orderDraft?: BuyerOrderDraft;
  onChangeAwardDraft: (rfqId: string, draft: BuyerAwardDraft) => void;
  onChangeOrderDraft: (awardId: string, draft: BuyerOrderDraft) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  awardDraft,
  orderDraft,
  onChangeAwardDraft,
  onChangeOrderDraft,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
}) => {
  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">询价操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在详情中提交定标审批并生成采购订单。"
        />
      </section>
    );
  }

  if (!rfq) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">询价操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="未找到询价项目"
          desc="请重新选择询价项目或刷新数据。"
        />
      </section>
    );
  }

  const recommendedQuote = selectRecommendedQuote(rfq);
  const canSubmitAward = canSubmitAwardApproval(rfq) && Boolean(recommendedQuote);
  const canCreateOrder = canCreateOrderFromAward(rfq, approvedAwardId, workspace.orders);
  const nextAction = describeRfqNextAction(rfq, approvedAwardId, workspace.orders);
  const todayDate = new Date().toISOString().slice(0, 10);
  const awardReasonInvalid = !awardDraft?.reason.trim();
  const orderReceiptDateInvalid = !orderDraft?.expectedReceiptDate || orderDraft.expectedReceiptDate <= todayDate;

  return (
    <DetailActionPanel
      title="询价操作"
      desc={nextAction.title}
      status={detail.status}
    >
      {rfq.quotes.length === 0 && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商报价"
          desc="暂无供应商报价，收到有效报价后会开放定标审批入口。"
        />
      )}

      {canSubmitAward && recommendedQuote && awardDraft && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
          <label className="block text-xs font-black text-slate-600" htmlFor={`rfq-detail-award-reason-${rfq.id}`}>
            定标理由
          </label>
          <textarea
            id={`rfq-detail-award-reason-${rfq.id}`}
            value={awardDraft.reason}
            onChange={(event) => onChangeAwardDraft(rfq.id, { reason: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {awardReasonInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写定标理由后再提交审批。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id, awardDraft)}
            disabled={awardSubmitBusyId === rfq.id || awardReasonInvalid}
            busy={awardSubmitBusyId === rfq.id}
            icon={BadgeCheck}
            pendingLabel="提交中"
            fullWidth
            testId={`stage7-submit-award-${rfq.id}`}
          >
            按推荐报价提交定标审批
          </PrimaryActionButton>
        </div>
      )}

      {rfq.quotes.length > 0 && !canSubmitAward && rfq.status === '报价中' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待更多报价或截标"
          desc="当前已有报价，但暂未达到可提交定标审批的状态。"
        />
      )}

      {rfq.status === '定标审批中' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待定标审批"
          desc="定标审批通过后，将开放生成采购订单入口。"
        />
      )}

      {canCreateOrder && approvedAwardId && orderDraft && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
          <label className="block text-xs font-black text-slate-600" htmlFor={`rfq-detail-order-date-${approvedAwardId}`}>
            预计到货日期
          </label>
          <input
            id={`rfq-detail-order-date-${approvedAwardId}`}
            type="date"
            value={orderDraft.expectedReceiptDate}
            onChange={(event) => onChangeOrderDraft(approvedAwardId, { expectedReceiptDate: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
          {orderReceiptDateInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              预计到货日期必须晚于今天。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onCreateOrderFromAward(approvedAwardId, orderDraft)}
            disabled={orderCreateBusy === approvedAwardId || orderReceiptDateInvalid}
            busy={orderCreateBusy === approvedAwardId}
            tone="emerald"
            icon={ShoppingCart}
            pendingLabel="生成中"
            fullWidth
            testId={`stage7-create-order-${approvedAwardId}`}
          >
            生成采购订单
          </PrimaryActionButton>
        </div>
      )}

      {rfq.status === '已定标' && !canCreateOrder && (
        <ProcessStateNotice
          variant="handled"
          title={nextAction.title === '订单已生成' ? '订单已生成，RFQ 和报价进入只读跟踪' : '定标已处理'}
          desc={nextAction.title === '订单已生成'
            ? '该询价项目已生成采购订单，定标结果和报价状态不可再变更，可在采购订单、收货验收和发票付款中继续履约。'
            : '该询价项目已完成定标，可在关联业务中查看后续订单和履约记录。'}
        />
      )}
    </DetailActionPanel>
  );
};

const QuoteComparisonDetailPanelView: React.FC<{
  detail?: QuoteComparisonDetailPanel;
  rfq?: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  awardDraft?: BuyerAwardDraft;
  orderDraft?: BuyerOrderDraft;
  onChangeAwardDraft: (rfqId: string, draft: BuyerAwardDraft) => void;
  onChangeOrderDraft: (awardId: string, draft: BuyerOrderDraft) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  awardDraft,
  orderDraft,
  onChangeAwardDraft,
  onChangeOrderDraft,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
}) => (
  <Panel title="比价详情" icon={BarChart3}>
    {!detail ? (
      <EmptyState title="暂无比价详情" desc="选择一个询价项目后，可查看推荐结论、报价排行和关联业务。" />
    ) : (
      <DetailPanelBody>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{detail.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail.id}</p>
            </div>
            <StatusPill label={detail.status} />
          </div>
          <p className="mt-3 text-sm font-black text-blue-700">{detail.recommendationLabel}</p>
          <InlineFactGrid facts={detail.facts} />
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">推荐结论</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.recommendationFacts.map((fact) => (
              <MiniFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </div>
        </section>

        <DetailSection title="报价比较矩阵" countLabel={`${detail.quoteRows.length} 家`}>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <MiniFact label="推荐定标理由" value={detail.recommendationLabel} />
            <MiniFact
              label="定标审批状态"
              value={detail.awardTimelineRows.length > 0
                ? detail.awardTimelineRows.map((row) => `${row.label}：${row.value}`).join(' / ')
                : '暂无定标审批记录'}
            />
            <MiniFact
              label="不可操作边界"
              value={!javaEnabled
                ? '当前为 mock 数据源，仅展示比价结果。'
                : detail.quoteRows.length === 0
                  ? '暂无报价，不能提交定标审批。'
                  : approvedAwardId
                    ? '定标已审批，避免重复提交。'
                    : '仅推荐报价可进入定标审批。'}
            />
          </div>
        </DetailSection>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">定标审批</p>
          <div className="space-y-2">
            {detail.awardTimelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        {detail.awardApprovalComment && (
          <section>
            <p className="mb-2 text-xs font-black text-slate-500">定标审批意见</p>
            <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
              {detail.awardApprovalComment}
            </p>
          </section>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">报价排行</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.quoteRows.length} 条
            </span>
          </div>
          {detail.quoteRows.length > 0 ? (
            <div className="space-y-2">
              {detail.quoteRows.map((quote) => (
                <div
                  key={quote.id}
                  className={`rounded-lg border p-3 ${
                    quote.awarded
                      ? 'border-emerald-200 bg-emerald-50'
                      : quote.recommended
                        ? 'border-blue-200 bg-blue-50'
                        : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-black text-slate-900">{quote.supplierName}</p>
                        <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-black text-slate-500">
                          {quote.rankLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {quote.deliveryLabel}交付 · 税率 {quote.taxLabel}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-black text-slate-900">{quote.amountLabel}</p>
                  </div>
                  {(quote.recommended || quote.awarded) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {quote.recommended && (
                        <span className="rounded-lg bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-700">
                          推荐报价
                        </span>
                      )}
                      {quote.awarded && (
                        <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[11px] font-black text-emerald-700">
                          已定标
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无供应商报价，等待邀请供应商响应。
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联业务</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.relatedRows.length} 条
            </span>
          </div>
          <div className="space-y-2">
            {detail.relatedRows.map((row) => (
              <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
            ))}
          </div>
        </section>

        <MiniFact label="下一步" value={detail.nextActionTitle} />

        <QuoteComparisonOperationPanel
          detail={detail}
          rfq={rfq}
          workspace={workspace}
          approvedAwardId={approvedAwardId}
          awardSubmitBusyId={awardSubmitBusyId}
          orderCreateBusy={orderCreateBusy}
          javaEnabled={javaEnabled}
          awardDraft={awardDraft}
          orderDraft={orderDraft}
          onChangeAwardDraft={onChangeAwardDraft}
          onChangeOrderDraft={onChangeOrderDraft}
          onSubmitAwardApproval={onSubmitAwardApproval}
          onCreateOrderFromAward={onCreateOrderFromAward}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const QuoteComparisonOperationPanel: React.FC<{
  detail: QuoteComparisonDetailPanel;
  rfq?: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  awardDraft?: BuyerAwardDraft;
  orderDraft?: BuyerOrderDraft;
  onChangeAwardDraft: (rfqId: string, draft: BuyerAwardDraft) => void;
  onChangeOrderDraft: (awardId: string, draft: BuyerOrderDraft) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  awardDraft,
  orderDraft,
  onChangeAwardDraft,
  onChangeOrderDraft,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
}) => {
  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">比价操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在比价详情中提交定标审批并生成采购订单。"
        />
      </section>
    );
  }

  if (!rfq) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">比价操作</p>
        <ProcessStateNotice
          variant="waiting"
          title="未找到询价项目"
          desc="请重新选择比价项目或刷新数据。"
        />
      </section>
    );
  }

  const recommendedQuote = selectRecommendedQuote(rfq);
  const canSubmitAward = canSubmitAwardApproval(rfq) && Boolean(recommendedQuote);
  const canCreateOrder = canCreateOrderFromAward(rfq, approvedAwardId, workspace.orders);
  const nextAction = describeRfqNextAction(rfq, approvedAwardId, workspace.orders);
  const todayDate = new Date().toISOString().slice(0, 10);
  const awardReasonInvalid = !awardDraft?.reason.trim();
  const orderReceiptDateInvalid = !orderDraft?.expectedReceiptDate || orderDraft.expectedReceiptDate <= todayDate;

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">比价操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">{nextAction.title}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {rfq.quotes.length === 0 && (
        <ProcessStateNotice
          variant="waiting"
          title="等待报价形成比价"
          desc="暂无供应商报价，收到报价后可生成推荐结论并提交定标审批。"
        />
      )}

      {canSubmitAward && recommendedQuote && awardDraft && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
          <label className="block text-xs font-black text-slate-600" htmlFor={`quote-award-reason-${rfq.id}`}>
            定标理由
          </label>
          <textarea
            id={`quote-award-reason-${rfq.id}`}
            value={awardDraft.reason}
            onChange={(event) => onChangeAwardDraft(rfq.id, { reason: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {awardReasonInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写定标理由后再提交审批。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id, awardDraft)}
            disabled={awardSubmitBusyId === rfq.id || awardReasonInvalid}
            busy={awardSubmitBusyId === rfq.id}
            icon={BadgeCheck}
            pendingLabel="提交中"
            fullWidth
            testId={`stage7-submit-award-${rfq.id}`}
          >
            按推荐报价提交定标审批
          </PrimaryActionButton>
        </div>
      )}

      {rfq.status === '定标审批中' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待定标审批"
          desc="审批通过后，比价结论会进入可生成采购订单状态。"
        />
      )}

      {canCreateOrder && approvedAwardId && orderDraft && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
          <label className="block text-xs font-black text-slate-600" htmlFor={`quote-order-date-${approvedAwardId}`}>
            预计到货日期
          </label>
          <input
            id={`quote-order-date-${approvedAwardId}`}
            type="date"
            value={orderDraft.expectedReceiptDate}
            onChange={(event) => onChangeOrderDraft(approvedAwardId, { expectedReceiptDate: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
          {orderReceiptDateInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              预计到货日期必须晚于今天。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onCreateOrderFromAward(approvedAwardId, orderDraft)}
            disabled={orderCreateBusy === approvedAwardId || orderReceiptDateInvalid}
            busy={orderCreateBusy === approvedAwardId}
            tone="emerald"
            icon={ShoppingCart}
            pendingLabel="生成中"
            fullWidth
            testId={`stage7-create-order-${approvedAwardId}`}
          >
            生成采购订单
          </PrimaryActionButton>
        </div>
      )}

      {rfq.status === '已定标' && !canCreateOrder && (
        <ProcessStateNotice
          variant="handled"
          title={nextAction.title === '订单已生成' ? '订单已生成，RFQ 和报价进入只读跟踪' : '比价已处理'}
          desc={nextAction.title === '订单已生成'
            ? '该询价项目已生成采购订单，定标结果和报价状态不可再变更，可在采购订单、收货验收和发票付款中继续履约。'
            : '定标和后续订单已进入关联业务，可继续跟踪履约、收货和付款。'}
        />
      )}
    </section>
  );
};

const ReceiptRegistrationForm: React.FC<{
  orderId: string;
  draft: BuyerReceiptDraft;
  busy: boolean;
  onChange: (draft: BuyerReceiptDraft) => void;
  onSubmit: () => void;
}> = ({ orderId, draft, busy, onChange, onSubmit }) => {
  const receiptResultInvalid = draft.result.trim().length === 0;
  const receiptRemarkInvalid = draft.receiptRemark.trim().length === 0;
  const receiptExceptionInvalid = draft.result === '异常待处理' && draft.exceptionReason.trim().length === 0;
  const receiptDraftInvalid = receiptResultInvalid || receiptRemarkInvalid || receiptExceptionInvalid;

  return (
    <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
      <label className="block text-xs font-black text-emerald-700" htmlFor={`receipt-result-${orderId}`}>
        验收结果
      </label>
      <select
        id={`receipt-result-${orderId}`}
        value={draft.result}
        onChange={(event) => onChange({ ...draft, result: event.target.value })}
        className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      >
        <option value="验收通过">验收通过</option>
        <option value="异常待处理">异常待处理</option>
      </select>
      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
        <label className="block text-xs font-black text-emerald-700" htmlFor={`receipt-remark-${orderId}`}>
          验收备注
          <textarea
            id={`receipt-remark-${orderId}`}
            value={draft.receiptRemark}
            onChange={(event) => onChange({ ...draft, receiptRemark: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
        <label className="block text-xs font-black text-emerald-700" htmlFor={`receipt-exception-${orderId}`}>
          异常原因
          <textarea
            id={`receipt-exception-${orderId}`}
            value={draft.exceptionReason}
            onChange={(event) => onChange({ ...draft, exceptionReason: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      </div>
      <label className="mt-3 block text-xs font-black text-emerald-700" htmlFor={`receipt-attachments-${orderId}`}>
        附件清单
        <textarea
          id={`receipt-attachments-${orderId}`}
          value={draft.attachmentNames}
          onChange={(event) => onChange({ ...draft, attachmentNames: event.target.value })}
          className="mt-2 min-h-20 w-full rounded-lg border border-emerald-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <AttachmentCenterEntryPanel
        title="收货附件中心"
        ownerType="收货验收"
        ownerId={orderId}
        visibility="buyer_internal"
        desc="登记收货照片、验收单和差异说明的附件元数据，后续与订单履约和异常处理关联。"
        attachmentNames={parseAttachmentNames(draft.attachmentNames)}
      />
      <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
        差异处理提示：如选择异常待处理，请填写异常原因并在附件清单中登记照片、验收单或差异说明；后续将衔接差异处理和补发/退换流程。
      </div>
      {receiptDraftInvalid && (
        <div aria-live="polite" className="mt-3 space-y-2">
          {receiptResultInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请选择验收结果后再登记收货。
            </p>
          )}
          {receiptRemarkInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写验收备注后再登记收货。
            </p>
          )}
          {receiptExceptionInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              异常待处理时必须填写异常原因。
            </p>
          )}
        </div>
      )}
      <PrimaryActionButton
        onClick={onSubmit}
        disabled={busy || receiptDraftInvalid}
        busy={busy}
        tone="emerald"
        icon={PackageCheck}
        pendingLabel="登记中"
        fullWidth
        testId={`stage7-create-receipt-${orderId}`}
      >
        登记收货
      </PrimaryActionButton>
    </div>
  );
};

const PaymentRegistrationForm: React.FC<{
  invoiceId: string;
  draft: BuyerPaymentDraft;
  busy: boolean;
  onChange: (draft: BuyerPaymentDraft) => void;
  onSubmit: () => void;
}> = ({ invoiceId, draft, busy, onChange, onSubmit }) => {
  const paymentStatusInvalid = draft.paymentStatus.trim().length === 0;
  const paymentRemarkInvalid = draft.paymentRemark.trim().length === 0;
  const paymentRequestStatusInvalid = draft.paymentRequestStatus.trim().length === 0;
  const paymentReconciliationInvalid = draft.reconciliationNote.trim().length === 0;
  const paymentDraftInvalid = paymentStatusInvalid
    || paymentRemarkInvalid
    || paymentRequestStatusInvalid
    || paymentReconciliationInvalid;

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
      <label className="block text-xs font-black text-blue-700" htmlFor={`payment-status-${invoiceId}`}>
        付款状态
      </label>
      <select
        id={`payment-status-${invoiceId}`}
        value={draft.paymentStatus}
        onChange={(event) => onChange({ ...draft, paymentStatus: event.target.value })}
        className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      >
        <option value="部分付款">部分付款</option>
        <option value="已付款">已付款</option>
      </select>
      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
        <label className="block text-xs font-black text-blue-700" htmlFor={`payment-remark-${invoiceId}`}>
          付款备注
          <textarea
            id={`payment-remark-${invoiceId}`}
            value={draft.paymentRemark}
            onChange={(event) => onChange({ ...draft, paymentRemark: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="block text-xs font-black text-blue-700" htmlFor={`payment-request-status-${invoiceId}`}>
          付款申请状态
          <select
            id={`payment-request-status-${invoiceId}`}
            value={draft.paymentRequestStatus}
            onChange={(event) => onChange({ ...draft, paymentRequestStatus: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          >
            <option value="付款申请待提交">付款申请待提交</option>
            <option value="付款申请审批中">付款申请审批中</option>
            <option value="付款申请已通过">付款申请已通过</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-black text-blue-700" htmlFor={`payment-reconciliation-${invoiceId}`}>
        对账入口
        <textarea
          id={`payment-reconciliation-${invoiceId}`}
          value={draft.reconciliationNote}
          onChange={(event) => onChange({ ...draft, reconciliationNote: event.target.value })}
          className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <AttachmentCenterEntryPanel
        title="发票附件中心"
        ownerType="发票付款"
        ownerId={invoiceId}
        visibility="buyer_internal"
        desc="登记发票影像、付款凭证和对账说明附件元数据，后续与三单匹配和付款审批关联。"
        attachmentNames={['发票影像.pdf', '付款凭证待补充']}
      />
      <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs font-bold leading-5 text-indigo-800">
        三单匹配提示：付款前请核对采购订单、收货验收和发票金额；如存在差异，应先完成对账处理再登记付款。
      </div>
      {paymentDraftInvalid && (
        <div aria-live="polite" className="mt-3 space-y-2">
          {paymentStatusInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请选择付款状态后再登记付款。
            </p>
          )}
          {paymentRemarkInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写付款备注后再登记付款。
            </p>
          )}
          {paymentRequestStatusInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请选择付款申请状态后再登记付款。
            </p>
          )}
          {paymentReconciliationInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写对账说明后再登记付款。
            </p>
          )}
        </div>
      )}
      <PrimaryActionButton
        onClick={onSubmit}
        disabled={busy || paymentDraftInvalid}
        busy={busy}
        icon={CreditCard}
        pendingLabel="登记中"
        fullWidth
        testId={`stage7-register-payment-${invoiceId}`}
      >
        登记付款
      </PrimaryActionButton>
    </div>
  );
};

const OrderDetailPanelView: React.FC<{
  detail?: OrderDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  javaEnabled: boolean;
  orderUpdateBusyId: string | null;
  buyerFulfillmentBusyId: string | null;
  receiptDraft?: BuyerReceiptDraft;
  onChangeReceiptDraft: (orderId: string, draft: BuyerReceiptDraft) => void;
  onUpdateOrder: (orderId: string, payload: UpdateOrderPayload) => void;
  onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void;
}> = ({
  detail,
  order,
  javaEnabled,
  orderUpdateBusyId,
  buyerFulfillmentBusyId,
  receiptDraft,
  onChangeReceiptDraft,
  onUpdateOrder,
  onCreateReceipt,
}) => {
  const logisticsStatus = detail?.facts.find((fact) => fact.label === '物流状态')?.value ?? '待发货';
  const invoicePaymentStatus = detail?.facts.find((fact) => fact.label === '发票状态')?.value ?? '待开票';
  const orderExpectedReceiptDate = detail?.facts.find((fact) => fact.label === '预计到货')?.value
    ?? order?.expectedReceiptDate
    ?? '未维护';
  const orderSupplierConfirmLabel = order?.status === '待确认'
    ? '等待供应商确认订单'
    : '供应商确认节点已进入后续履约';
  const orderDeliveryLabel = detail?.delivery
    ? `${detail.delivery.status} · ${detail.delivery.carrier}`
    : '等待供应商发货';
  const orderReceiptLabel = order?.status === '已收货'
    ? '采购方已完成收货验收'
    : '收货验收待登记或待物流完成';
  const [editableOrderExpectedReceiptDate, setEditableOrderExpectedReceiptDate] = useState(order?.expectedReceiptDate ?? '');

  useEffect(() => {
    setEditableOrderExpectedReceiptDate(order?.expectedReceiptDate ?? '');
  }, [order?.id, order?.expectedReceiptDate]);

  const canEditOrder = javaEnabled && order?.status !== '已收货';
  const orderEditInvalid = !editableOrderExpectedReceiptDate;

  return (
    <Panel title="订单详情" icon={PackageCheck}>
      {!detail ? (
        <EmptyState title="暂无订单详情" desc="选择一张采购订单后，可查看询价来源、物流、发票和付款状态。" />
      ) : (
        <DetailPanelBody>
          <DetailHeroCard
            eyebrow="采购订单"
            title={detail.id}
            meta={detail.supplierName}
            status={detail.status}
            amountLabel={detail.amountLabel}
            facts={detail.facts}
            summaryFacts={[
              { label: '物流状态', value: logisticsStatus },
              { label: '发票付款', value: invoicePaymentStatus },
              { label: '下一步', value: detail.nextActionTitle },
            ]}
          />

          <DetailSection title="订单履约时间线">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniFact label="供应商确认" value={orderSupplierConfirmLabel} />
              <MiniFact label="发货" value={orderDeliveryLabel} />
              <MiniFact label="收货" value={orderReceiptLabel} />
              <MiniFact label="预计到货日期" value={orderExpectedReceiptDate} />
            </div>
          </DetailSection>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">询价来源</p>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="truncate text-sm font-black text-slate-900">{detail.rfqLabel}</p>
            </div>
          </section>

          {(detail.sourceRfqLabel || detail.awardApprovalStatus) && (
            <DetailSection title="定标审批来源">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <MiniFact label="来源询价" value={detail.sourceRfqLabel ?? detail.rfqLabel} />
                <MiniFact label="定标审批" value={detail.awardApprovalStatus ?? '暂无审批记录'} />
              </div>
            </DetailSection>
          )}

          {detail.awardApprovalComment && (
            <DetailSection title="定标审批意见">
              <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-800">
                {detail.awardApprovalComment}
              </p>
            </DetailSection>
          )}

          <DetailSection title="物流信息">
            {detail.delivery ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{detail.delivery.carrier}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{detail.delivery.trackingNo}</p>
                  </div>
                  <StatusPill label={detail.delivery.status} />
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                暂无物流信息，等待供应商发货。
              </p>
            )}
          </DetailSection>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">发票付款</p>
            {detail.invoice ? (
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{detail.invoice.id}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{detail.invoice.amountLabel}</p>
                  </div>
                  <StatusPill label={detail.invoice.paymentStatus} />
                </div>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                暂无发票，订单收货后供应商可提交发票。
              </p>
            )}
          </section>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">履约检查</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {detail.fulfillmentCheckRows.map((row) => (
                <MiniFact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </section>

          <DetailSection title="履约轨迹">
            <div className="space-y-2">
              {detail.fulfillmentTimelineRows.map((row) => (
                <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </DetailSection>

          <DetailSection title="订单编辑">
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs font-bold leading-5 text-blue-700">
              维护预计到货日期。保存后会通知供应商按最新预计到货日期履约，并刷新 Java 工作台数据。
            </div>
            <Field label="预计到货日期">
              <input
                type="date"
                value={editableOrderExpectedReceiptDate}
                onChange={(event) => setEditableOrderExpectedReceiptDate(event.target.value)}
                disabled={!canEditOrder}
                className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </Field>
            {(!canEditOrder || orderEditInvalid) && (
              <p aria-live="polite" className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
                {!canEditOrder ? '已收货订单不可再修改预计到货日期。' : '请维护预计到货日期后再保存。'}
              </p>
            )}
            <PrimaryActionButton
              onClick={() => order && onUpdateOrder(order.id, {
                expectedReceiptDate: editableOrderExpectedReceiptDate,
              })}
              disabled={!order || !canEditOrder || orderEditInvalid || orderUpdateBusyId === order?.id}
              busy={orderUpdateBusyId === order?.id}
              icon={ShoppingCart}
              pendingLabel="保存中"
              fullWidth
            >
              保存订单修改
            </PrimaryActionButton>
          </DetailSection>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-500">关联业务</p>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                {detail.relatedRows.length} 条
              </span>
            </div>
            {detail.relatedRows.length > 0 ? (
              <div className="space-y-2">
                {detail.relatedRows.map((row) => (
                  <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                暂无关联业务记录。
              </p>
            )}
          </section>

          <OrderDetailOperationPanel
            detail={detail}
            order={order}
            javaEnabled={javaEnabled}
            buyerFulfillmentBusyId={buyerFulfillmentBusyId}
            receiptDraft={receiptDraft}
            onChangeReceiptDraft={onChangeReceiptDraft}
            onCreateReceipt={onCreateReceipt}
          />
        </DetailPanelBody>
      )}
    </Panel>
  );
};

const OrderDetailOperationPanel: React.FC<{
  detail: OrderDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  javaEnabled: boolean;
  buyerFulfillmentBusyId: string | null;
  receiptDraft?: BuyerReceiptDraft;
  onChangeReceiptDraft: (orderId: string, draft: BuyerReceiptDraft) => void;
  onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void;
}> = ({
  detail,
  order,
  javaEnabled,
  buyerFulfillmentBusyId,
  receiptDraft,
  onChangeReceiptDraft,
  onCreateReceipt,
}) => {
  const expectedReceiptDate = detail.facts.find((fact) => fact.label === '预计到货')?.value ?? order?.expectedReceiptDate ?? '未维护';
  const logisticsStatus = detail.facts.find((fact) => fact.label === '物流状态')?.value ?? '待发货';
  const invoicePaymentStatus = detail.facts.find((fact) => fact.label === '发票状态')?.value ?? '待开票';
  const renderFulfillmentSummary = () => (
    <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-black text-slate-500">履约摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="供应商" value={detail.supplierName} />
        <MiniFact label="订单金额" value={detail.amountLabel} />
        <MiniFact label="预计到货" value={expectedReceiptDate} />
        <MiniFact label="物流状态" value={logisticsStatus} />
        <MiniFact label="发票付款" value={invoicePaymentStatus} />
      </div>
    </div>
  );

  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">订单操作</p>
        {renderFulfillmentSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在订单详情中登记收货并继续发票付款。"
        />
      </section>
    );
  }

  if (!order) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">订单操作</p>
        {renderFulfillmentSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="未找到订单记录"
          desc="请重新选择订单或刷新数据。"
        />
      </section>
    );
  }

  const receiptBusy = buyerFulfillmentBusyId === `receipt:${order.id}`;
  const canRegisterReceipt = order.status === '已发货' && detail.delivery?.status === '已发货';

  return (
    <DetailActionPanel
      title="订单操作"
      desc={detail.nextActionTitle}
      status={detail.status}
    >
      {renderFulfillmentSummary()}

      {order.status === '待供应商确认' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商确认"
          desc="订单已生成，需供应商确认后进入发货环节。"
        />
      )}

      {order.status === '待发货' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商发货"
          desc="供应商确认订单后，需提交物流信息，采购方才能登记收货。"
        />
      )}

      {canRegisterReceipt && receiptDraft && (
        <ReceiptRegistrationForm
          orderId={order.id}
          draft={receiptDraft}
          busy={receiptBusy}
          onChange={(draft) => onChangeReceiptDraft(order.id, draft)}
          onSubmit={() => onCreateReceipt(order.id, receiptDraft)}
        />
      )}

      {!canRegisterReceipt && order.status === '已发货' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商提交有效发货记录"
          desc="订单已进入发货状态，但缺少已发货物流记录，暂不能登记收货验收。"
        />
      )}

      {order.status === '已收货' && (
        <ProcessStateNotice
          variant="handled"
          title="收货已登记"
          desc="等待供应商提交发票，随后可在发票付款页登记付款状态。"
        />
      )}

      {order.status === '已完成' && (
        <ProcessStateNotice
          variant="handled"
          title="订单已完成"
          desc="该订单已完成履约和付款，可继续查看关联业务留痕。"
        />
      )}
    </DetailActionPanel>
  );
};

const ReceiptInspectionDetailPanelView: React.FC<{
  detail?: ReceiptInspectionDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  busy: boolean;
  javaEnabled: boolean;
  receiptDraft?: BuyerReceiptDraft;
  onChangeReceiptDraft: (orderId: string, draft: BuyerReceiptDraft) => void;
  onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void;
}> = ({ detail, order, busy, javaEnabled, receiptDraft, onChangeReceiptDraft, onCreateReceipt }) => {
  const logisticsStatus = detail?.logisticsFacts.find((fact) => fact.label === '物流状态')?.value ?? '待发货';
  const acceptanceStatus = detail?.acceptanceChecks.find((check) => check.label === '验收结果')?.value ?? '待登记';

  return (
    <Panel title="验收详情" icon={PackageCheck}>
      {!detail ? (
        <EmptyState title="暂无验收详情" desc="选择一张待收货订单后，可查看物流、验收检查和关联业务。" />
      ) : (
        <DetailPanelBody>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-black text-slate-950">{detail.id}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{detail.supplierName}</p>
              </div>
              <StatusPill label={detail.status} />
            </div>
            <p className="mt-3 font-mono text-xl font-black text-slate-950">{detail.amountLabel}</p>
            <InlineFactGrid facts={detail.facts} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <MiniFact label="物流状态" value={logisticsStatus} />
              <MiniFact label="验收状态" value={acceptanceStatus} />
              <MiniFact label="下一步" value={detail.nextActionTitle} />
            </div>
          </div>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">物流信息</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="truncate text-sm font-black text-slate-900">{detail.logisticsLabel}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                {detail.logisticsFacts.map((fact) => (
                  <MiniFact key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">定标审批来源</p>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <MiniFact label="来源订单" value={detail.sourceOrderLabel ?? detail.id} />
              <MiniFact label="来源询价" value={detail.sourceRfqLabel ?? '未关联询价'} />
              <MiniFact label="定标审批" value={detail.awardApprovalStatus ?? '暂无审批记录'} />
            </div>
          </section>

          {detail.awardApprovalComment && (
            <section>
              <p className="mb-2 text-xs font-black text-slate-500">定标审批意见</p>
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-900">
                {detail.awardApprovalComment}
              </p>
            </section>
          )}

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">验收检查</p>
            <div className="space-y-2">
              {detail.acceptanceChecks.map((check) => (
                <DetailKeyValueRow key={check.label} label={check.label} value={check.value} />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">后续协同</p>
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {detail.postReceiptRows.map((row) => (
                <MiniFact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-500">关联业务</p>
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                {detail.relatedRows.length} 条
              </span>
            </div>
            {detail.relatedRows.length > 0 ? (
              <div className="space-y-2">
                {detail.relatedRows.map((row) => (
                  <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                暂无关联业务记录。
              </p>
            )}
          </section>

          <ReceiptInspectionOperationPanel
            detail={detail}
            order={order}
            busy={busy}
            javaEnabled={javaEnabled}
            receiptDraft={receiptDraft}
            onChangeReceiptDraft={onChangeReceiptDraft}
            onCreateReceipt={onCreateReceipt}
          />
        </DetailPanelBody>
      )}
    </Panel>
  );
};

const ReceiptInspectionOperationPanel: React.FC<{
  detail: ReceiptInspectionDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  busy: boolean;
  javaEnabled: boolean;
  receiptDraft?: BuyerReceiptDraft;
  onChangeReceiptDraft: (orderId: string, draft: BuyerReceiptDraft) => void;
  onCreateReceipt: (orderId: string, draft: BuyerReceiptDraft) => void;
}> = ({
  detail,
  order,
  busy,
  javaEnabled,
  receiptDraft,
  onChangeReceiptDraft,
  onCreateReceipt,
}) => {
  const supplierName = detail.facts.find((fact) => fact.label === '供应商')?.value ?? detail.supplierName;
  const orderAmount = detail.facts.find((fact) => fact.label === '订单金额')?.value ?? detail.amountLabel;
  const expectedReceiptDate = detail.facts.find((fact) => fact.label === '预计到货')?.value ?? order?.expectedReceiptDate ?? '未维护';
  const trackingNo = detail.logisticsFacts.find((fact) => fact.label === '物流单号')?.value ?? '待维护';
  const invoiceStatus = detail.facts.find((fact) => fact.label === '发票状态')?.value ?? '待开票';
  const renderReceiptSummary = () => (
    <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-black text-slate-500">验收摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="供应商" value={supplierName} />
        <MiniFact label="订单金额" value={orderAmount} />
        <MiniFact label="预计到货" value={expectedReceiptDate} />
        <MiniFact label="物流单号" value={trackingNo} />
        <MiniFact label="发票状态" value={invoiceStatus} />
      </div>
    </div>
  );

  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">验收操作</p>
        {renderReceiptSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在验收详情中登记收货并衔接发票付款。"
        />
      </section>
    );
  }

  if (!order) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">验收操作</p>
        {renderReceiptSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="未找到订单记录"
          desc="请重新选择待验收订单或刷新数据。"
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">验收操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">{detail.nextActionTitle}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {renderReceiptSummary()}

      {detail.canRegisterReceipt && receiptDraft && (
        <ReceiptRegistrationForm
          orderId={detail.id}
          draft={receiptDraft}
          busy={busy}
          onChange={(draft) => onChangeReceiptDraft(detail.id, draft)}
          onSubmit={() => onCreateReceipt(detail.id, receiptDraft)}
        />
      )}

      {!detail.canRegisterReceipt && (order.status === '待供应商确认' || order.status === '待发货') && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商履约"
          desc="供应商确认并发货后，采购方才能登记收货验收。"
        />
      )}

      {!detail.canRegisterReceipt && order.status === '已发货' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商提交有效发货记录"
          desc="订单已进入发货状态，但缺少已发货物流记录，暂不能登记收货验收。"
        />
      )}

      {!detail.canRegisterReceipt && (order.status === '已收货' || order.status === '已完成') && (
        <ProcessStateNotice
          variant="handled"
          title="验收已完成"
          desc="收货验收已登记，可继续跟进供应商发票和付款状态。"
        />
      )}
    </section>
  );
};

const InvoicePaymentDetailPanelView: React.FC<{
  detail?: InvoicePaymentDetailPanel;
  invoice?: BuyerWorkspace['invoices'][number];
  paymentRequest?: PaymentRequestRecord;
  varianceHandling?: VarianceHandlingRecord;
  busy: boolean;
  invoiceUpdateBusyId: string | null;
  javaEnabled: boolean;
  paymentDraft?: BuyerPaymentDraft;
  onChangePaymentDraft: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onRegisterPayment: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onCreatePaymentRequest: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onCreateVarianceHandling: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onUpdatePaymentRequestStatus: (paymentRequestId: string, status: string) => void;
  onUpdateVarianceHandlingStatus: (varianceHandlingId: string, status: string) => void;
  onUpdateInvoice: (invoiceId: string, payload: UpdateInvoicePayload) => void;
}> = ({
  detail,
  invoice,
  paymentRequest,
  varianceHandling,
  busy,
  invoiceUpdateBusyId,
  javaEnabled,
  paymentDraft,
  onChangePaymentDraft,
  onRegisterPayment,
  onCreatePaymentRequest,
  onCreateVarianceHandling,
  onUpdatePaymentRequestStatus,
  onUpdateVarianceHandlingStatus,
  onUpdateInvoice,
}) => {
  const normalizeEditableInvoicePaymentStatus = (status?: string) =>
    status === '已付款' || status === '部分付款' ? status : '部分付款';
  const [editableInvoicePaymentStatus, setEditableInvoicePaymentStatus] = useState(
    normalizeEditableInvoicePaymentStatus(invoice?.paymentStatus),
  );
  const paymentStatus = detail?.facts.find((fact) => fact.label === '付款状态')?.value ?? '待付款';
  const invoiceAmount = detail?.facts.find((fact) => fact.label === '发票金额')?.value ?? detail?.amountLabel ?? '未找到';
  const orderAmount = detail?.orderFacts.find((fact) => fact.label === '订单金额')?.value ?? '未找到';
  const reconciliationStatus = invoice?.reconciliationStatus ?? (detail && invoiceAmount === orderAmount ? '金额一致' : '待核对');
  const statementOrderAmount = invoice?.orderAmount == null ? orderAmount : currency(invoice.orderAmount);
  const statementVarianceAmount = invoice?.varianceAmount == null ? '待同步' : currency(invoice.varianceAmount);
  const statementReceiptStatus = invoice?.receiptStatus ?? '待同步';
  const threeWayMatchStatus = !invoice
    ? '待三单同步'
    : statementReceiptStatus.includes('待') || statementReceiptStatus === '未收货'
      ? '待收货核对'
      : invoice.varianceAmount == null || invoice.orderAmount == null
        ? '待三单同步'
        : Math.abs(invoice.varianceAmount) > 0
          ? '金额差异待处理'
          : '三单匹配通过';
  const threeWayMatchBlockingLabel = threeWayMatchStatus === '三单匹配通过'
    ? '三单匹配已通过，可继续按付款计划登记付款。'
    : '付款前请先完成三单匹配核对，确认订单、收货和发票一致后再付款。';
  const invoiceUpdateBusy = Boolean(invoice && invoiceUpdateBusyId === invoice.id);
  const invoicePaymentEditable = Boolean(javaEnabled && invoice && invoice.paymentStatus !== '已付款');
  const varianceHandlingLabel = invoice?.varianceAmount == null
    ? '等待对账单同步差异金额。'
    : invoice.varianceAmount === 0
      ? '订单、收货、发票金额一致，可按计划付款。'
      : `存在 ${currency(invoice.varianceAmount)} 差异，需先处理差异再付款。`;
  const overdueReminderLabel = paymentStatus === '已付款'
    ? '已完成付款登记，无逾期提醒。'
    : '付款未完成，需关注账期和内部付款申请节点。';
  const paymentPlanLabel = paymentStatus === '已付款'
    ? '付款计划已关闭。'
    : '按对账结果发起付款登记，真实支付和银企直连暂不接入。';
  const paymentFeedbackLabel = invoicePaymentEditable
    ? '可登记部分付款或已付款状态，并刷新 Java 数据回显。'
    : '当前状态不可继续修改付款结果。';
  const paymentBatchDueLabel = !paymentRequest
    ? '待创建付款申请后排期'
    : invoice?.dueDate
      ? `计划付款日 ${invoice.dueDate}`
      : '待财务排期';
  const paymentBatchOwnershipLabel = paymentRequest?.paymentBatchNo
    ? `批次 ${paymentRequest.paymentBatchNo}`
    : '暂未归属付款批次';
  const paymentPlanMaturityLabel = !paymentRequest
    ? '未形成申请'
    : paymentRequest.requestStatus === '付款申请已通过'
      ? '可进入付款排期'
      : paymentRequest.requestStatus === '付款申请审批中'
        ? '审批中'
        : '待提交审批';
  const paymentRequestBlockedByVariance = Boolean(
    invoice?.varianceAmount
    && Math.abs(invoice.varianceAmount) > 0
    && varianceHandling?.status !== '已处理',
  );
  const paymentRequestBoundaryLabel = paymentRequestBlockedByVariance
    ? '差异未处理，暂不能创建付款申请。'
    : invoice?.varianceAmount && Math.abs(invoice.varianceAmount) > 0
      ? '差异已处理，付款申请已恢复。'
      : '金额一致，可进入付款申请。';
  const varianceHandlingRows = [
    { label: '差异金额', value: statementVarianceAmount },
    { label: '责任人', value: varianceHandling?.ownerId ?? (invoice?.varianceAmount && Math.abs(invoice.varianceAmount) > 0 ? '采购负责人 / 供应商对账联系人' : '采购财务') },
    { label: '处理结果', value: varianceHandling?.result ?? (threeWayMatchStatus === '金额差异待处理' ? '待差异处理' : '无需差异处理') },
    { label: '处理状态', value: varianceHandling?.status ?? (threeWayMatchStatus === '金额差异待处理' ? '待处理' : '无需处理') },
    { label: '记录来源', value: varianceHandling ? '真实 Java 记录' : '尚未创建 Java 差异处理' },
    { label: '处理边界', value: invoice?.varianceAmount && Math.abs(invoice.varianceAmount) > 0 ? '先确认差异原因，再登记付款结果。' : '金额一致时可进入付款申请。' },
  ];
  const paymentRequestRows = [
    { label: '申请状态', value: paymentRequest?.requestStatus ?? paymentDraft?.paymentRequestStatus ?? (paymentStatus === '已付款' ? '付款申请已通过' : '付款申请待提交') },
    { label: '付款批次', value: paymentRequest?.paymentBatchNo ?? (invoice?.dueDate ? `计划付款 ${invoice.dueDate}` : '暂未形成付款批次') },
    { label: '申请金额', value: paymentRequest ? currency(paymentRequest.amount) : invoiceAmount },
    { label: '记录来源', value: paymentRequest ? '真实 Java 记录' : '尚未创建 Java 付款申请' },
    { label: '付款阻断', value: paymentRequestBoundaryLabel },
    { label: '台账边界', value: paymentRequest ? '已落库为独立付款申请记录。' : '暂未落库为独立付款申请，待创建 Java 付款申请后形成独立台账。' },
  ];
  const financeActionDisabled = !javaEnabled || !invoice || !paymentDraft || busy;
  const paymentRequestCreateDisabled = financeActionDisabled || paymentRequestBlockedByVariance;
  const paymentRequestStatusDisabled = !javaEnabled || !paymentRequest || busy;
  const varianceHandlingStatusDisabled = !javaEnabled || !varianceHandling || busy;
  const invoicePaymentEditDisabled = !invoicePaymentEditable || invoiceUpdateBusy || editableInvoicePaymentStatus.trim().length === 0;

  useEffect(() => {
    setEditableInvoicePaymentStatus(normalizeEditableInvoicePaymentStatus(invoice?.paymentStatus));
  }, [invoice?.id, invoice?.paymentStatus]);

  return (
    <Panel title="发票详情" icon={Receipt}>
      {!detail ? (
        <EmptyState title="暂无发票详情" desc="选择一张发票后，可查看订单、物流、供应商和付款状态。" />
      ) : (
        <DetailPanelBody>
          <DetailHeroCard
            eyebrow="发票付款"
            title={detail.id}
            meta={detail.supplierName}
            status={detail.status}
            amountLabel={detail.amountLabel}
            facts={detail.facts}
            summaryFacts={[
              { label: '付款状态', value: paymentStatus },
              { label: '对账状态', value: reconciliationStatus },
              { label: '下一步', value: detail.nextActionTitle },
            ]}
          />

          <DetailSection title="三单匹配">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniFact label="订单金额" value={statementOrderAmount} />
              <MiniFact label="收货状态" value={statementReceiptStatus} />
              <MiniFact label="发票金额" value={invoiceAmount} />
              <MiniFact label="差异金额" value={statementVarianceAmount} />
              <MiniFact label="匹配结论" value={threeWayMatchStatus} />
              <MiniFact label="付款边界" value={threeWayMatchBlockingLabel} />
            </div>
          </DetailSection>

          <DetailSection title="定标审批来源">
            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
              <MiniFact label="来源订单" value={detail.sourceOrderLabel ?? invoice?.orderId ?? '未找到'} />
              <MiniFact label="来源询价" value={detail.sourceRfqLabel ?? '未关联询价'} />
              <MiniFact label="定标审批" value={detail.awardApprovalStatus ?? '暂无审批记录'} />
            </div>
          </DetailSection>

          {detail.awardApprovalComment && (
            <DetailSection title="定标审批意见">
              <p className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-900">
                {detail.awardApprovalComment}
              </p>
            </DetailSection>
          )}

          <DetailSection title="付款计划">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniFact label="差异处理" value={varianceHandlingLabel} />
              <MiniFact label="逾期提醒" value={overdueReminderLabel} />
              <MiniFact label="付款状态反馈" value={paymentFeedbackLabel} />
              <MiniFact label="计划边界" value={paymentPlanLabel} />
            </div>
          </DetailSection>

          <DetailSection title="付款批次计划">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniFact label="付款计划成熟度" value={paymentPlanMaturityLabel} />
              <MiniFact label="批次归属" value={paymentBatchOwnershipLabel} />
              <MiniFact label="计划付款日" value={paymentBatchDueLabel} />
              <MiniFact label="计划边界" value="当前按付款申请派生批次视图，真实支付和批量付款审批暂不接入。" />
            </div>
          </DetailSection>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">订单上下文</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {detail.orderFacts.map((fact) => (
                <MiniFact key={fact.label} label={fact.label} value={fact.value} />
              ))}
            </div>
          </section>

          <DetailSection title="对账单摘要">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <MiniFact label="订单金额" value={statementOrderAmount} />
              <MiniFact label="发票金额" value={invoiceAmount} />
              <MiniFact label="差异金额" value={statementVarianceAmount} />
              <MiniFact label="收货状态" value={statementReceiptStatus} />
              <MiniFact label="对账状态" value={reconciliationStatus} />
            </div>
          </DetailSection>

          <section>
            <p className="mb-2 text-xs font-black text-slate-500">付款检查</p>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {detail.paymentCheckRows.map((row) => (
                <MiniFact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </section>

          <DetailSection title="差异处理台账">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {varianceHandlingRows.map((row) => (
                <MiniFact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <PrimaryActionButton
              onClick={() => invoice && paymentDraft && onCreateVarianceHandling(invoice.id, paymentDraft)}
              disabled={financeActionDisabled}
              busy={busy}
              pendingLabel="创建中"
              tone="amber"
              fullWidth
            >
              创建/更新差异处理
            </PrimaryActionButton>
            <div aria-label="差异处理状态流转" className="mt-3 grid gap-2 sm:grid-cols-2">
              <PrimaryActionButton
                onClick={() => varianceHandling && onUpdateVarianceHandlingStatus(varianceHandling.id, '已处理')}
                disabled={varianceHandlingStatusDisabled || varianceHandling?.status === '已处理'}
                busy={busy}
                pendingLabel="处理中"
                tone="emerald"
                fullWidth
              >
                标记差异已处理
              </PrimaryActionButton>
              <PrimaryActionButton
                onClick={() => varianceHandling && onUpdateVarianceHandlingStatus(varianceHandling.id, '待复核')}
                disabled={varianceHandlingStatusDisabled}
                busy={busy}
                pendingLabel="处理中"
                tone="amber"
                fullWidth
              >
                退回差异复核
              </PrimaryActionButton>
            </div>
          </DetailSection>

          <DetailSection title="付款申请台账">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {paymentRequestRows.map((row) => (
                <MiniFact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
            <PrimaryActionButton
              onClick={() => invoice && paymentDraft && onCreatePaymentRequest(invoice.id, paymentDraft)}
              disabled={paymentRequestCreateDisabled}
              busy={busy}
              pendingLabel="创建中"
              fullWidth
            >
              创建/更新付款申请
            </PrimaryActionButton>
            <div aria-label="付款申请状态流转" className="mt-3 grid gap-2 sm:grid-cols-2">
              <PrimaryActionButton
                onClick={() => paymentRequest && onUpdatePaymentRequestStatus(paymentRequest.id, '付款申请审批中')}
                disabled={paymentRequestStatusDisabled || paymentRequest?.requestStatus === '付款申请审批中'}
                busy={busy}
                pendingLabel="提交中"
                fullWidth
              >
                提交付款审批
              </PrimaryActionButton>
              <PrimaryActionButton
                onClick={() => paymentRequest && onUpdatePaymentRequestStatus(paymentRequest.id, '付款申请已通过')}
                disabled={paymentRequestStatusDisabled || paymentRequest?.requestStatus === '付款申请已通过'}
                busy={busy}
                pendingLabel="审批中"
                tone="emerald"
                fullWidth
              >
                通过付款申请
              </PrimaryActionButton>
            </div>
          </DetailSection>

          <DetailSection title="关联业务" countLabel={`${detail.relatedRows.length} 条`}>
            {detail.relatedRows.length > 0 ? (
              <div className="space-y-2">
                {detail.relatedRows.map((row) => (
                  <RelatedBusinessRow key={row.id} title={row.title} detail={row.detail} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                暂无关联业务记录。
              </p>
            )}
          </DetailSection>

          <DetailSection title="付款轨迹">
            <div className="space-y-2">
              {detail.paymentTimelineRows.map((row) => (
                <DetailKeyValueRow key={row.label} label={row.label} value={row.value} fontMono />
              ))}
            </div>
          </DetailSection>

          <DetailSection title="发票付款编辑">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">付款状态</span>
                  <select
                    value={editableInvoicePaymentStatus}
                    onChange={(event) => setEditableInvoicePaymentStatus(event.target.value)}
                    disabled={!invoicePaymentEditable}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="部分付款">部分付款</option>
                    <option value="已付款">已付款</option>
                  </select>
                </label>
                <PrimaryActionButton
                  onClick={() => invoice && onUpdateInvoice(invoice.id, { paymentStatus: editableInvoicePaymentStatus })}
                  disabled={invoicePaymentEditDisabled}
                  busy={invoiceUpdateBusy}
                  pendingLabel="保存中"
                >
                  保存发票付款修改
                </PrimaryActionButton>
              </div>
              <p className="text-xs font-bold text-slate-500">
                保存后会同步供应商应收并重新加载 Java 数据回显；已付款发票不可再修改付款状态。
              </p>
            </div>
          </DetailSection>

          <InvoicePaymentOperationPanel
            detail={detail}
            invoice={invoice}
            busy={busy}
            javaEnabled={javaEnabled}
            paymentDraft={paymentDraft}
            onChangePaymentDraft={onChangePaymentDraft}
            onRegisterPayment={onRegisterPayment}
          />
        </DetailPanelBody>
      )}
    </Panel>
  );
};

const InvoicePaymentOperationPanel: React.FC<{
  detail: InvoicePaymentDetailPanel;
  invoice?: BuyerWorkspace['invoices'][number];
  busy: boolean;
  javaEnabled: boolean;
  paymentDraft?: BuyerPaymentDraft;
  onChangePaymentDraft: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onRegisterPayment: (invoiceId: string, draft: BuyerPaymentDraft) => void;
}> = ({ detail, invoice, busy, javaEnabled, paymentDraft, onChangePaymentDraft, onRegisterPayment }) => {
  const supplierName = detail.facts.find((fact) => fact.label === '供应商')?.value ?? detail.supplierName;
  const orderLabel = detail.facts.find((fact) => fact.label === '关联订单')?.value ?? invoice?.orderId ?? '未找到';
  const invoiceAmount = detail.facts.find((fact) => fact.label === '发票金额')?.value ?? detail.amountLabel;
  const orderAmount = detail.orderFacts.find((fact) => fact.label === '订单金额')?.value ?? '未找到';
  const paymentStatus = detail.facts.find((fact) => fact.label === '付款状态')?.value ?? detail.status;
  const renderPaymentSummary = () => (
    <div className="mb-3 rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-black text-slate-500">付款摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="供应商" value={supplierName} />
        <MiniFact label="关联订单" value={orderLabel} />
        <MiniFact label="发票金额" value={invoiceAmount} />
        <MiniFact label="订单金额" value={orderAmount} />
        <MiniFact label="付款状态" value={paymentStatus} />
      </div>
    </div>
  );

  return (
    <DetailActionPanel
      title="付款操作"
      desc={detail.nextActionTitle}
      status={detail.status}
    >
      {renderPaymentSummary()}

      {!javaEnabled && (
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 数据源后，可在此处登记付款并写入真实履约状态。"
        />
      )}

      {javaEnabled && !invoice && (
        <ProcessStateNotice
          variant="blocked"
          title="未找到发票记录"
          desc="请刷新数据后重新选择发票，再执行付款登记。"
        />
      )}

      {javaEnabled && invoice && detail.canRegisterPayment && paymentDraft && (
        <PaymentRegistrationForm
          invoiceId={detail.id}
          draft={paymentDraft}
          busy={busy}
          onChange={(draft) => onChangePaymentDraft(detail.id, draft)}
          onSubmit={() => onRegisterPayment(detail.id, paymentDraft)}
        />
      )}

      {javaEnabled && invoice && !detail.canRegisterPayment && invoice.paymentStatus === '已付款' && (
        <ProcessStateNotice
          variant="handled"
          title="付款已登记"
          desc="该发票已完成付款登记，可在关联业务中查看订单和物流留痕。"
        />
      )}
    </DetailActionPanel>
  );
};

const SupplierAdmissionForm: React.FC<{
  relationId: string;
  categoryLabel: string;
  hasActiveQualification: boolean;
  draft: BuyerSupplierAdmissionDraft;
  busy: boolean;
  onChange: (draft: BuyerSupplierAdmissionDraft) => void;
  onSubmit: () => void;
}> = ({ relationId, categoryLabel, hasActiveQualification, draft, busy, onChange, onSubmit }) => {
  const admissionReasonInvalid = draft.reason.trim().length === 0;
  const admissionQualificationInvalid = draft.qualificationSummary.trim().length === 0;
  const admissionContactInvalid = draft.contactName.trim().length === 0;
  const admissionPhoneInvalid = draft.contactPhone.trim().length === 0;
  const admissionCategoryInvalid = !draft.categoryConfirmed;
  const admissionRiskInvalid = !draft.riskConfirmed;
  const supplierQualificationInvalid = !hasActiveQualification;
  const supplierAdmissionInvalid = admissionReasonInvalid
    || admissionQualificationInvalid
    || admissionContactInvalid
    || admissionPhoneInvalid
    || admissionCategoryInvalid
    || admissionRiskInvalid;

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <label className="block text-xs font-black text-blue-800" htmlFor={`supplier-admission-reason-${relationId}`}>
        准入说明
      </label>
      <textarea
        id={`supplier-admission-reason-${relationId}`}
        value={draft.reason}
        onChange={(event) => onChange({ ...draft, reason: event.target.value })}
        className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
      />
      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-1">
        <label className="block text-xs font-black text-blue-800" htmlFor={`supplier-admission-qualification-${relationId}`}>
          资质摘要
          <textarea
            id={`supplier-admission-qualification-${relationId}`}
            value={draft.qualificationSummary}
            onChange={(event) => onChange({ ...draft, qualificationSummary: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <label className="block text-xs font-black text-blue-800" htmlFor={`supplier-admission-contact-${relationId}`}>
            联系人
            <input
              id={`supplier-admission-contact-${relationId}`}
              value={draft.contactName}
              onChange={(event) => onChange({ ...draft, contactName: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="block text-xs font-black text-blue-800" htmlFor={`supplier-admission-phone-${relationId}`}>
            联系电话
            <input
              id={`supplier-admission-phone-${relationId}`}
              value={draft.contactPhone}
              onChange={(event) => onChange({ ...draft, contactPhone: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>
        </div>
      </div>
      <label
        htmlFor={`supplier-admission-category-${relationId}`}
        className="mt-3 flex items-start gap-2 rounded-lg border border-blue-100 bg-white p-3 text-xs font-bold text-slate-600"
      >
        <input
          id={`supplier-admission-category-${relationId}`}
          type="checkbox"
          checked={draft.categoryConfirmed}
          onChange={(event) => onChange({ ...draft, categoryConfirmed: event.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-blue-200 text-blue-600"
        />
        <span>授权品类已确认：{categoryLabel || '待补充'}</span>
      </label>
      <label
        htmlFor={`supplier-admission-risk-${relationId}`}
        className="mt-3 flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold text-amber-800"
      >
        <input
          id={`supplier-admission-risk-${relationId}`}
          type="checkbox"
          checked={draft.riskConfirmed}
          onChange={(event) => onChange({ ...draft, riskConfirmed: event.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-amber-200 text-amber-600"
        />
        <span>黑名单与风险已复核：确认当前供应商未处于黑名单、暂停合作或高风险状态。</span>
      </label>
      {supplierAdmissionInvalid && (
        <div aria-live="polite" className="mt-3 space-y-2">
          {admissionReasonInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写准入说明后再提交。
            </p>
          )}
          {admissionQualificationInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写资质摘要后再提交。
            </p>
          )}
          {(admissionContactInvalid || admissionPhoneInvalid) && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写联系人和联系电话后再提交。
            </p>
          )}
          {admissionCategoryInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请先确认授权品类。
            </p>
          )}
          {admissionRiskInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请先复核黑名单与风险状态。
            </p>
          )}
          {supplierQualificationInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请先要求供应商补充至少一条有效资质，再提交准入审批。
            </p>
          )}
        </div>
      )}
      <PrimaryActionButton
        onClick={onSubmit}
        disabled={busy || supplierAdmissionInvalid || supplierQualificationInvalid}
        busy={busy}
        icon={Send}
        pendingLabel="提交中"
        fullWidth
      >
        提交准入
      </PrimaryActionButton>
    </div>
  );
};

const splitCategoryInput = (value: string) =>
  value
    .split(/[，,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

const SupplierRelationCreateForm: React.FC<{
  suppliers: BuyerWorkspace['suppliers'];
  existingRelations: BuyerWorkspace['privateSupplierRelations'];
  javaEnabled: boolean;
  busy: boolean;
  onCreateSupplierRelation: (payload: CreateBuyerSupplierRelationPayload) => void;
}> = ({ suppliers, existingRelations, javaEnabled, busy, onCreateSupplierRelation }) => {
  const availableSuppliers = suppliers.filter((supplier) =>
    !existingRelations.some((relation) => relation.supplierId === supplier.id));
  const [supplierId, setSupplierId] = useState(availableSuppliers[0]?.id ?? suppliers[0]?.id ?? '');
  const [status, setStatus] = useState('待准入');
  const [level, setLevel] = useState('B');
  const [categories, setCategories] = useState('办公设备');
  const categoryList = splitCategoryInput(categories);
  const invalid = !javaEnabled || !supplierId || !status.trim() || !level.trim() || categoryList.length === 0;

  useEffect(() => {
    setSupplierId(availableSuppliers[0]?.id ?? suppliers[0]?.id ?? '');
  }, [availableSuppliers[0]?.id, suppliers[0]?.id]);

  return (
    <form
      className="mb-3 space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid || busy) return;
        onCreateSupplierRelation({ supplierId, status, level, categories: categoryList });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-blue-800">新增供应商关系</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            将公共供应商加入采购方私域供应商库，再提交准入审批。
          </p>
        </div>
        <StatusPill label={javaEnabled ? 'Java 写入' : '当前不可写'} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="公共供应商">
          <select
            value={supplierId}
            onChange={(event) => setSupplierId(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          >
            {availableSuppliers.length > 0 ? availableSuppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            )) : suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
            ))}
          </select>
        </Field>
        <Field label="初始状态">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          >
            {['待准入', '已准入', '黑名单'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="供应商等级">
          <input
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="授权品类">
          <input
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
      </div>
      {invalid && (
        <p aria-live="polite" className="rounded-lg border border-amber-100 bg-white p-3 text-xs font-bold leading-5 text-amber-800">
          {!javaEnabled ? '切换到 Java 数据源后可新增供应商关系。' : '请选择供应商，并填写状态、等级和至少一个授权品类。'}
        </p>
      )}
      <PrimaryActionButton
        onClick={() => onCreateSupplierRelation({ supplierId, status, level, categories: categoryList })}
        disabled={invalid || busy}
        busy={busy}
        pendingLabel="创建中"
        icon={Users}
        fullWidth
      >
        新增供应商关系
      </PrimaryActionButton>
    </form>
  );
};

const SupplierRelationProfileForm: React.FC<{
  relation: BuyerWorkspace['privateSupplierRelations'][number];
  javaEnabled: boolean;
  profileBusy: boolean;
  statusBusy: boolean;
  performanceBusy: boolean;
  onSaveSupplierRelationProfile: (relationId: string, payload: UpdateBuyerSupplierProfilePayload) => void;
  onSaveSupplierRelationStatus: (relationId: string, status: string) => void;
  onSaveSupplierRelationPerformance: (relationId: string, performanceScore: number) => void;
}> = ({
  relation,
  javaEnabled,
  profileBusy,
  statusBusy,
  performanceBusy,
  onSaveSupplierRelationProfile,
  onSaveSupplierRelationStatus,
  onSaveSupplierRelationPerformance,
}) => {
  const [level, setLevel] = useState(relation.level);
  const [categories, setCategories] = useState(relation.categories.join('、'));
  const [status, setStatus] = useState(relation.status);
  const [performanceScore, setPerformanceScore] = useState(relation.performanceScore);
  const categoryList = splitCategoryInput(categories);
  const profileInvalid = !javaEnabled || !level.trim() || categoryList.length === 0;
  const statusInvalid = !javaEnabled || !status.trim();
  const performanceInvalid = !javaEnabled || performanceScore < 0 || performanceScore > 100;

  useEffect(() => {
    setLevel(relation.level);
    setCategories(relation.categories.join('、'));
    setStatus(relation.status);
    setPerformanceScore(relation.performanceScore);
  }, [relation.id, relation.level, relation.categories.join('、'), relation.status, relation.performanceScore]);

  return (
    <section className="mt-3 space-y-3 rounded-lg border border-white/80 bg-white p-3">
      <p className="text-xs font-black text-slate-500">供应商关系维护</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="供应商等级">
          <input
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            disabled={!javaEnabled || profileBusy}
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="授权品类">
          <input
            value={categories}
            onChange={(event) => setCategories(event.target.value)}
            disabled={!javaEnabled || profileBusy}
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
      </div>
      <PrimaryActionButton
        onClick={() => onSaveSupplierRelationProfile(relation.id, { level: level.trim(), categories: categoryList })}
        disabled={profileInvalid || profileBusy}
        busy={profileBusy}
        pendingLabel="保存中"
        fullWidth
      >
        保存等级和品类
      </PrimaryActionButton>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="合作状态">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={!javaEnabled || statusBusy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          >
            {['待准入', '准入审批中', '已准入', '已驳回', '黑名单'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <PrimaryActionButton
          onClick={() => onSaveSupplierRelationStatus(relation.id, status)}
          disabled={statusInvalid || statusBusy}
          busy={statusBusy}
          pendingLabel="保存中"
          flushTop
        >
          保存合作状态
        </PrimaryActionButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="绩效评分">
          <input
            type="number"
            min="0"
            max="100"
            value={performanceScore}
            onChange={(event) => setPerformanceScore(Number(event.target.value))}
            disabled={!javaEnabled || performanceBusy}
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <PrimaryActionButton
          onClick={() => onSaveSupplierRelationPerformance(relation.id, performanceScore)}
          disabled={performanceInvalid || performanceBusy}
          busy={performanceBusy}
          pendingLabel="保存中"
          flushTop
        >
          保存绩效评分
        </PrimaryActionButton>
      </div>
      {(profileInvalid || statusInvalid || performanceInvalid) && (
        <p aria-live="polite" className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
          {!javaEnabled ? '切换到 Java 数据源后可维护供应商关系。' : '请补齐等级、品类和状态；绩效评分需在 0 到 100 之间。'}
        </p>
      )}
    </section>
  );
};

const SupplierDetailPanelView: React.FC<{
  detail?: SupplierDetailPanel;
  relation?: BuyerWorkspace['privateSupplierRelations'][number];
  javaEnabled: boolean;
  supplierAdmissionBusyId: string | null;
  supplierRelationBusyId: string | null;
  admissionDraft?: BuyerSupplierAdmissionDraft;
  onChangeAdmissionDraft: (relationId: string, draft: BuyerSupplierAdmissionDraft) => void;
  onSubmitSupplierAdmission: (relationId: string, draft: BuyerSupplierAdmissionDraft) => void;
  onSaveSupplierRelationProfile: (relationId: string, payload: UpdateBuyerSupplierProfilePayload) => void;
  onSaveSupplierRelationStatus: (relationId: string, status: string) => void;
  onSaveSupplierRelationPerformance: (relationId: string, performanceScore: number) => void;
}> = ({
  detail,
  relation,
  javaEnabled,
  supplierAdmissionBusyId,
  supplierRelationBusyId,
  admissionDraft,
  onChangeAdmissionDraft,
  onSubmitSupplierAdmission,
  onSaveSupplierRelationProfile,
  onSaveSupplierRelationStatus,
  onSaveSupplierRelationPerformance,
}) => (
  <Panel title="供应商详情" icon={Users}>
    {!detail ? (
      <EmptyState title="暂无供应商详情" desc="选择一个私域供应商关系后，可查看准入、品类、绩效和协作记录。" />
    ) : (
      <DetailPanelBody>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{detail.supplierName}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail.supplierId}</p>
            </div>
            <StatusPill label={detail.status} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
              等级 {detail.level}
            </span>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
              {detail.riskLabel}
            </span>
          </div>
          <InlineFactGrid facts={detail.facts} />
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">合作关系</p>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="text-sm font-black text-blue-950">{detail.actionTitle}</p>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">准入检查</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.admissionCheckRows.map((row) => (
              <MiniFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">准入依据 · 资质台账</p>
            <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700">
              {(relation?.qualifications ?? []).length} 条
            </span>
          </div>
          {(relation?.qualifications ?? []).length > 0 ? (
            <div className="space-y-2">
              {(relation?.qualifications ?? []).map((qualification) => (
                <div key={qualification.id} className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-amber-950">
                        {qualification.qualificationType}
                      </p>
                      <p className="mt-1 break-words text-xs font-bold text-amber-700">
                        {qualification.fileName}
                      </p>
                    </div>
                    <StatusPill label={qualification.status} />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                    <MiniFact label="证书编号" value={qualification.certificateNo || '未填写'} />
                    <MiniFact label="到期日" value={qualification.expiresAt || '长期'} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-700">
              暂无供应商自维护资质记录，准入前请要求供应商补充营业执照或授权代理证书。
            </p>
          )}
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">协作记录</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.collaborationRows.map((row) => (
              <MiniFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">参与询价</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.rfqRows.length} 个
            </span>
          </div>
          {detail.rfqRows.length > 0 ? (
            <div className="space-y-2">
              {detail.rfqRows.map((rfq) => (
                <div key={rfq.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{rfq.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{rfq.quoteLabel}</p>
                    </div>
                    <StatusPill label={rfq.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无询价协作记录。
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">采购订单</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.orderRows.length} 单
            </span>
          </div>
          {detail.orderRows.length > 0 ? (
            <div className="space-y-2">
              {detail.orderRows.map((order) => (
                <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">{order.id}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-500">{order.amountLabel}</p>
                    </div>
                    <StatusPill label={order.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无采购订单。
            </p>
          )}
        </section>

        <SupplierDetailOperationPanel
          detail={detail}
          relation={relation}
          javaEnabled={javaEnabled}
          supplierAdmissionBusyId={supplierAdmissionBusyId}
          supplierRelationBusyId={supplierRelationBusyId}
          admissionDraft={admissionDraft}
          onChangeAdmissionDraft={onChangeAdmissionDraft}
          onSubmitSupplierAdmission={onSubmitSupplierAdmission}
          onSaveSupplierRelationProfile={onSaveSupplierRelationProfile}
          onSaveSupplierRelationStatus={onSaveSupplierRelationStatus}
          onSaveSupplierRelationPerformance={onSaveSupplierRelationPerformance}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const SupplierDetailOperationPanel: React.FC<{
  detail: SupplierDetailPanel;
  relation?: BuyerWorkspace['privateSupplierRelations'][number];
  javaEnabled: boolean;
  supplierAdmissionBusyId: string | null;
  supplierRelationBusyId: string | null;
  admissionDraft?: BuyerSupplierAdmissionDraft;
  onChangeAdmissionDraft: (relationId: string, draft: BuyerSupplierAdmissionDraft) => void;
  onSubmitSupplierAdmission: (relationId: string, draft: BuyerSupplierAdmissionDraft) => void;
  onSaveSupplierRelationProfile: (relationId: string, payload: UpdateBuyerSupplierProfilePayload) => void;
  onSaveSupplierRelationStatus: (relationId: string, status: string) => void;
  onSaveSupplierRelationPerformance: (relationId: string, performanceScore: number) => void;
}> = ({
  detail,
  relation,
  javaEnabled,
  supplierAdmissionBusyId,
  supplierRelationBusyId,
  admissionDraft,
  onChangeAdmissionDraft,
  onSubmitSupplierAdmission,
  onSaveSupplierRelationProfile,
  onSaveSupplierRelationStatus,
  onSaveSupplierRelationPerformance,
}) => {
  const authorizedCategories = detail.facts.find((fact) => fact.label === '授权品类')?.value ?? '未维护';
  const performanceScore = detail.facts.find((fact) => fact.label === '绩效评分')?.value ?? detail.riskLabel;
  const rfqCount = detail.collaborationRows.find((row) => row.label === '参与询价')?.value ?? '0 个';
  const orderCount = detail.collaborationRows.find((row) => row.label === '采购订单')?.value ?? '0 单';
  const renderSupplierRelationSummary = () => (
    <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3">
      <p className="text-xs font-black text-slate-500">关系摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="准入状态" value={detail.status} />
        <MiniFact label="供应商等级" value={detail.level} />
        <MiniFact label="绩效评分" value={performanceScore} />
        <MiniFact label="授权品类" value={authorizedCategories} />
        <MiniFact label="参与询价" value={rfqCount} />
        <MiniFact label="采购订单" value={orderCount} />
      </div>
    </div>
  );

  if (!javaEnabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">关系操作</p>
        {renderSupplierRelationSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="当前为 mock 数据源"
          desc="切换到 Java 模式后，可在详情中提交供应商准入审批。"
        />
      </section>
    );
  }

  if (!relation) {
    return (
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black text-slate-500">关系操作</p>
        {renderSupplierRelationSummary()}
        <ProcessStateNotice
          variant="waiting"
          title="未找到供应商关系"
          desc="请重新选择供应商或刷新数据。"
        />
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">关系操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">{detail.actionTitle}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {renderSupplierRelationSummary()}

      <SupplierRelationProfileForm
        relation={relation}
        javaEnabled={javaEnabled}
        profileBusy={supplierRelationBusyId === `profile:${relation.id}`}
        statusBusy={supplierRelationBusyId === `status:${relation.id}`}
        performanceBusy={supplierRelationBusyId === `performance:${relation.id}`}
        onSaveSupplierRelationProfile={onSaveSupplierRelationProfile}
        onSaveSupplierRelationStatus={onSaveSupplierRelationStatus}
        onSaveSupplierRelationPerformance={onSaveSupplierRelationPerformance}
      />

      {relation.status === '待准入' && admissionDraft && (
        <SupplierAdmissionForm
          relationId={relation.id}
          categoryLabel={relation.categories.join(' / ')}
          hasActiveQualification={Boolean(relation.qualifications?.some((qualification) => qualification.status === 'active'))}
          draft={admissionDraft}
          busy={supplierAdmissionBusyId === relation.id}
          onChange={(draft) => onChangeAdmissionDraft(relation.id, draft)}
          onSubmit={() => onSubmitSupplierAdmission(relation.id, admissionDraft)}
        />
      )}

      {relation.status === '准入审批中' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待准入审批"
          desc="审批通过后，该供应商会进入已准入状态，可参与后续询价邀请。"
        />
      )}

      {relation.status === '已准入' && (
        <ProcessStateNotice
          variant="handled"
          title="已完成准入"
          desc="该供应商已可参与授权品类下的询价、报价和订单履约。"
        />
      )}

      {relation.status === '黑名单' && (
        <ProcessStateNotice
          variant="waiting"
          title="合作受限"
          desc="该供应商已进入黑名单，暂不建议邀请参与新询价。"
        />
      )}

      {relation.status === '已驳回' && (
        <ProcessStateNotice
          variant="waiting"
          title="准入已驳回"
          desc="请补充资质或调整关系信息后，再重新发起准入审批。"
        />
      )}
    </section>
  );
};

const MaterialDetailPanelView: React.FC<{
  detail?: MaterialDetailPanel;
  material?: MaterialItem;
  javaEnabled: boolean;
  materialSaveBusyId: string | null;
  onSaveMaterial: (materialId: string | null, payload: SaveMaterialPayload) => void;
}> = ({ detail, material, javaEnabled, materialSaveBusyId, onSaveMaterial }) => (
  <Panel title="物料详情" icon={Database}>
    {!detail ? (
      <EmptyState title="暂无物料详情" desc="选择一个物料或服务后，可查看引用需求、询价项目和供应商覆盖情况。" />
    ) : (
      <DetailPanelBody>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{detail.title}</p>
              <p className="mt-1 text-xs font-bold text-slate-400">{detail.id}</p>
            </div>
            <StatusPill label={detail.status} />
          </div>
          <InlineFactGrid facts={detail.facts} />
        </div>

        <MaterialDetailSummaryPanel detail={detail} />
        <MaterialDetailOperationPanel detail={detail} />
        <section>
          <p className="mb-2 text-xs font-black text-slate-500">物料目录维护</p>
          <MaterialSaveForm
            title="编辑当前物料"
            material={material}
            javaEnabled={javaEnabled}
            busy={materialSaveBusyId === detail.id}
            onSave={(payload) => onSaveMaterial(detail.id, payload)}
          />
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">使用概览</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.usageSummary.map((fact) => (
              <MiniFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">采购可用性</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.procurementReadinessRows.map((row) => (
              <MiniFact key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">引用需求</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.demandRows.length} 条
            </span>
          </div>
          {detail.demandRows.length > 0 ? (
            <div className="space-y-2">
              {detail.demandRows.map((demand) => (
                <div key={demand.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{demand.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {demand.quantityLabel} · {demand.referenceAmountLabel}
                      </p>
                    </div>
                    <StatusPill label={demand.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无需求引用。
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">关联询价</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.rfqRows.length} 个
            </span>
          </div>
          {detail.rfqRows.length > 0 ? (
            <div className="space-y-2">
              {detail.rfqRows.map((rfq) => (
                <div key={rfq.id} className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{rfq.title}</p>
                      <p className="mt-1 text-xs font-bold text-blue-700">{rfq.quoteLabel}</p>
                    </div>
                    <StatusPill label={rfq.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无关联询价。
            </p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">供应商覆盖</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.supplierCoverageRows.length} 家
            </span>
          </div>
          {detail.supplierCoverageRows.length > 0 ? (
            <div className="space-y-2">
              {detail.supplierCoverageRows.map((supplier) => (
                <div key={supplier.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">{supplier.supplierName}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">等级 {supplier.level}</p>
                    </div>
                    <StatusPill label={supplier.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
              暂无已准入供应商覆盖该品类。
            </p>
          )}
        </section>
      </DetailPanelBody>
    )}
  </Panel>
);

const MaterialDetailSummaryPanel: React.FC<{
  detail: MaterialDetailPanel;
}> = ({ detail }) => {
  const code = detail.facts.find((fact) => fact.label === '物料编码')?.value ?? detail.id;
  const category = detail.facts.find((fact) => fact.label === '品类')?.value ?? '未维护';
  const referencePrice = detail.facts.find((fact) => fact.label === '参考价')?.value ?? '未维护';
  const demandUsage = detail.usageSummary.find((row) => row.label === '引用需求')?.value ?? '0 条';
  const supplierCoverage = detail.usageSummary.find((row) => row.label === '准入供应商')?.value ?? '0 家';
  const nextAction = detail.procurementReadinessRows.find((row) => row.label === '下一步')?.value ?? '待确认';

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <p className="text-xs font-black text-blue-800">目录摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="物料编码" value={code} />
        <MiniFact label="品类" value={category} />
        <MiniFact label="参考价" value={referencePrice} />
        <MiniFact label="引用需求" value={demandUsage} />
        <MiniFact label="准入供应商" value={supplierCoverage} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </section>
  );
};

const MaterialDetailOperationPanel: React.FC<{
  detail: MaterialDetailPanel;
}> = ({ detail }) => {
  const demandUsage = detail.usageSummary.find((row) => row.label === '引用需求')?.value ?? `${detail.demandRows.length} 条`;
  const supplierCoverage = detail.usageSummary.find((row) => row.label === '准入供应商')?.value ?? `${detail.supplierCoverageRows.length} 家`;
  const readiness = detail.procurementReadinessRows.find((row) => row.label === '可采购')?.value ?? detail.status;
  const nextAction = detail.procurementReadinessRows.find((row) => row.label === '下一步')?.value ?? '待确认';

  return (
    <section className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-emerald-700">采购就绪摘要</p>
          <p className="mt-1 text-sm font-black text-slate-950">{detail.title}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="物料状态" value={detail.status} />
        <MiniFact label="引用次数" value={demandUsage} />
        <MiniFact label="覆盖供应商" value={supplierCoverage} />
        <MiniFact label="可采购状态" value={readiness} />
      </div>
      <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
        <p className="text-xs font-black text-slate-500">推荐动作</p>
        <p className="mt-1 text-sm font-black leading-5 text-slate-950">{nextAction}</p>
        <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
          已覆盖 {detail.supplierCoverageRows.length} 家供应商，可结合引用需求和关联询价决定是否补充目录或发起采购。
        </p>
      </div>
    </section>
  );
};

const MaterialSaveForm: React.FC<{
  title: string;
  material?: MaterialItem;
  javaEnabled: boolean;
  busy: boolean;
  onSave: (payload: SaveMaterialPayload) => void;
}> = ({ title, material, javaEnabled, busy, onSave }) => {
  const [code, setCode] = useState(material?.code ?? 'MAT-NEW');
  const [name, setName] = useState(material?.name ?? '新增物料');
  const [category, setCategory] = useState(material?.category ?? '办公设备');
  const [unit, setUnit] = useState(material?.unit ?? '件');
  const [referencePrice, setReferencePrice] = useState(material?.referencePrice ?? 1000);

  useEffect(() => {
    setCode(material?.code ?? 'MAT-NEW');
    setName(material?.name ?? '新增物料');
    setCategory(material?.category ?? '办公设备');
    setUnit(material?.unit ?? '件');
    setReferencePrice(material?.referencePrice ?? 1000);
  }, [material?.id, material?.code, material?.name, material?.category, material?.unit, material?.referencePrice]);

  const invalid = !javaEnabled
    || !code.trim()
    || !name.trim()
    || !category.trim()
    || !unit.trim()
    || referencePrice < 0;

  return (
    <form
      className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalid || busy) return;
        onSave({
          code: code.trim(),
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          referencePrice,
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-blue-800">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            保存后刷新 Java 物料目录，并可直接用于采购需求明细。
          </p>
        </div>
        <StatusPill label={javaEnabled ? 'Java 写入' : '当前不可写'} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="物料编码">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="物料名称">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="品类">
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="单位">
          <input
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
        <Field label="参考价">
          <input
            type="number"
            min="0"
            value={referencePrice}
            onChange={(event) => setReferencePrice(Number(event.target.value))}
            disabled={!javaEnabled || busy}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
          />
        </Field>
      </div>
      {invalid && (
        <p aria-live="polite" className="rounded-lg border border-amber-100 bg-white p-3 text-xs font-bold leading-5 text-amber-800">
          {!javaEnabled ? '切换到 Java 数据源后可维护物料目录。' : '请填写编码、名称、品类、单位，参考价不能小于 0。'}
        </p>
      )}
      <PrimaryActionButton
        onClick={() => onSave({
          code: code.trim(),
          name: name.trim(),
          category: category.trim(),
          unit: unit.trim(),
          referencePrice,
        })}
        disabled={invalid || busy}
        busy={busy}
        pendingLabel="保存中"
        icon={Database}
        fullWidth
      >
        保存物料
      </PrimaryActionButton>
    </form>
  );
};

const DemandCreateForm: React.FC<{
  materials: BuyerWorkspace['materials'];
  departments: BuyerWorkspace['departments'];
  users: BuyerWorkspace['users'];
  defaultDepartment: string;
  defaultRequester: string;
  disabled: boolean;
  busy: boolean;
  onSubmit: (payload: CreateDemandPayload, submitForApproval: boolean) => void;
}> = ({ materials, departments, users, defaultDepartment, defaultRequester, disabled, busy, onSubmit }) => {
  const firstMaterial = materials[0];
  const firstDepartment = departments[0];
  const firstRequester = users[0];
  const [title, setTitle] = useState('办公设备补充采购');
  const [department, setDepartment] = useState(firstDepartment?.id ?? defaultDepartment);
  const [requester, setRequester] = useState(firstRequester?.id ?? defaultRequester);
  const [budget, setBudget] = useState(68000);
  const defaultExpectedDeliveryDate = new Date();
  defaultExpectedDeliveryDate.setDate(defaultExpectedDeliveryDate.getDate() + 14);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(defaultExpectedDeliveryDate.toISOString().slice(0, 10));
  const [demandDescription, setDemandDescription] = useState('用于补充研发、行政办公和会议协同场景的设备缺口。');
  const [attachmentNames, setAttachmentNames] = useState('预算批复.pdf\n配置说明.xlsx');
  const [demandLineItems, setDemandLineItems] = useState([{ materialId: firstMaterial?.id ?? '', quantity: 1 }]);
  const [submitForApproval, setSubmitForApproval] = useState(true);

  const validLineItems = demandLineItems
    .filter((lineItem) => lineItem.materialId && lineItem.quantity > 0);
  const estimatedAmount = validLineItems.reduce((sum, lineItem) => {
    const material = materials.find((item) => item.id === lineItem.materialId);
    return sum + ((material?.referencePrice ?? 0) * lineItem.quantity);
  }, 0);
  const budgetBalance = budget - estimatedAmount;
  const budgetExceeded = budgetBalance < 0;
  const canSubmit = !disabled && title.trim() && department.trim() && budget > 0 && validLineItems.length > 0 && !budgetExceeded;
  const updateDemandLineItem = (index: number, nextLineItem: Partial<(typeof demandLineItems)[number]>) => {
    setDemandLineItems((current) => current.map((lineItem, lineIndex) =>
      lineIndex === index ? { ...lineItem, ...nextLineItem } : lineItem,
    ));
  };
  const addDemandLineItem = () => {
    setDemandLineItems((current) => [...current, { materialId: firstMaterial?.id ?? '', quantity: 1 }]);
  };
  const removeDemandLineItem = (index: number) => {
    setDemandLineItems((current) => current.length > 1
      ? current.filter((_, lineIndex) => lineIndex !== index)
      : current);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!canSubmit) return;
        onSubmit({
          title: title.trim(),
          department: department.trim(),
          requester: requester.trim(),
          budget,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          description: demandDescription.trim() || undefined,
          attachmentNames: attachmentNames
            .split('\n')
            .map((name) => name.trim())
            .filter(Boolean),
          lineItems: demandLineItems
            .filter((lineItem) => lineItem.materialId && lineItem.quantity > 0)
            .map((lineItem) => ({ materialId: lineItem.materialId, quantity: lineItem.quantity })),
        }, submitForApproval);
      }}
    >
      <Field label="需求标题">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="申请部门">
          <select
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {departments.length > 0 ? departments.map((departmentItem) => (
              <option key={departmentItem.id} value={departmentItem.id}>
                {departmentItem.name}
              </option>
            )) : (
              <option value={defaultDepartment}>{defaultDepartment}</option>
            )}
          </select>
        </Field>
        <Field label="申请人">
          <select
            value={requester}
            onChange={(event) => setRequester(event.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {users.length > 0 ? users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            )) : (
              <option value={defaultRequester}>{defaultRequester}</option>
            )}
          </select>
        </Field>
      </div>
      <Field label="预算金额">
        <input
          type="number"
          min={1}
          value={budget}
          onChange={(event) => setBudget(Number(event.target.value))}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </Field>
      <Field label="期望到货日期">
        <input
          type="date"
          value={expectedDeliveryDate}
          onChange={(event) => setExpectedDeliveryDate(event.target.value)}
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </Field>
      <Field label="需求说明">
        <textarea
          value={demandDescription}
          onChange={(event) => setDemandDescription(event.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold leading-6 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </Field>

      <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-500">物料明细</p>
          <button
            type="button"
            onClick={addDemandLineItem}
            disabled={materials.length === 0}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            增加明细
          </button>
        </div>
        <div className="space-y-3">
          {demandLineItems.map((lineItem, index) => {
            const material = materials.find((item) => item.id === lineItem.materialId);
            const lineAmount = (material?.referencePrice ?? 0) * lineItem.quantity;
            return (
              <div key={`${index}-${lineItem.materialId}`} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_96px_auto] xl:grid-cols-1">
                  <Field label={`物料 ${index + 1}`}>
                    <select
                      value={lineItem.materialId}
                      onChange={(event) => updateDemandLineItem(index, { materialId: event.target.value })}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {materials.map((materialItem) => (
                        <option key={materialItem.id} value={materialItem.id}>
                          {materialItem.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="数量">
                    <input
                      type="number"
                      min={1}
                      value={lineItem.quantity}
                      onChange={(event) => updateDemandLineItem(index, { quantity: Number(event.target.value) })}
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={() => removeDemandLineItem(index)}
                    disabled={demandLineItems.length === 1}
                    className="h-10 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 sm:self-end"
                  >
                    删除
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                  <span>单位：{material?.unit ?? '未维护'}</span>
                  <span>参考价：{currency(material?.referencePrice ?? 0)}</span>
                  <span>预估金额：{currency(lineAmount)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <MiniFact label="预估金额" value={currency(estimatedAmount)} />
        <MiniFact label="预算差额" value={currency(budgetBalance)} />
      </div>
      {budgetExceeded && (
        <div
          aria-live="polite"
          className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800"
        >
          预估金额已超出预算，请调整预算或物料数量后再提交审批。
        </div>
      )}

      <section className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
        <p className="text-xs font-black text-slate-500">需求附件</p>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
          附件入口用于归集需求说明、报价依据和预算批复材料；上传能力接入后将关联到当前需求。
        </p>
        <AttachmentCenterEntryPanel
          title="需求附件中心"
          ownerType="采购需求"
          ownerId="新建需求草稿"
          visibility="tenant"
          desc="登记需求说明、报价依据和预算批复材料的附件元数据，创建后关联到采购需求。"
          attachmentNames={parseAttachmentNames(attachmentNames)}
        />
        <label className="mt-3 block text-xs font-black text-slate-500">
          附件清单
          <textarea
            value={attachmentNames}
            onChange={(event) => setAttachmentNames(event.target.value)}
            rows={3}
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold leading-6 text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
      </section>

      <label className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-700">
        <input
          type="checkbox"
          checked={submitForApproval}
          onChange={(event) => setSubmitForApproval(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        创建后直接提交审批
      </label>
      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <FileText size={16} />
        {busy ? '创建中' : '创建采购需求'}
      </button>
      {!materials.length && (
        <p className="text-xs font-bold text-amber-700">请先维护物料目录后再创建采购需求。</p>
      )}
    </form>
  );
};

const RfqCreateForm: React.FC<{
  demand: BuyerWorkspace['demands'][number];
  suppliers: BuyerWorkspace['suppliers'];
  relations: BuyerWorkspace['privateSupplierRelations'];
  busy: boolean;
  onSubmit: (demandId: string, supplierIds: string[], deadline: string) => void;
}> = ({ demand, suppliers, relations, busy, onSubmit }) => {
  const rfqEligibleRelations = relations.filter(isRfqEligibleSupplierRelation);
  const rfqEligibleSupplierIds = new Set(rfqEligibleRelations.map((relation) => relation.supplierId));
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(
    rfqEligibleRelations.map((relation) => relation.supplierId).slice(0, 2),
  );
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 14);
  const [deadline, setDeadline] = useState(defaultDeadline.toISOString().slice(0, 10));
  const [quoteRequirement, setQuoteRequirement] = useState('请按含税总价报价，并注明税率、质保周期和可替代型号。');
  const [deliveryRequirement, setDeliveryRequirement] = useState('中标后 7 个自然日内送达指定收货地点，支持分批交付需提前说明。');
  const [invitationNote, setInvitationNote] = useState('本次询价优先考虑准时交付、售后响应和历史合作绩效。');
  const todayDate = new Date().toISOString().slice(0, 10);
  const selectedEligibleSupplierIds = selectedSupplierIds.filter((supplierId) => rfqEligibleSupplierIds.has(supplierId));
  const supplierSelectionInvalid = selectedEligibleSupplierIds.length === 0;
  const deadlineInvalid = !deadline || deadline <= todayDate;
  const canSubmit = !supplierSelectionInvalid && !deadlineInvalid;
  const toggleSupplierSelection = (supplierId: string, checked: boolean) => {
    setSelectedSupplierIds((current) =>
      checked
        ? Array.from(new Set([...current, supplierId]))
        : current.filter((item) => item !== supplierId),
    );
  };

  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-blue-800">创建询价</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            从具备有效资质的已准入供应商中选择邀请对象，生成后进入报价和比价流程。
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700">
          已选择供应商 {selectedEligibleSupplierIds.length} 家
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
        <MiniFact label="需求编号" value={demand.id} />
        <MiniFact label="需求预算" value={currency(demand.budget)} />
        <Field label="预计报价截止">
          <input
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3 xl:grid-cols-1">
        <Field label="报价要求">
          <textarea
            value={quoteRequirement}
            onChange={(event) => setQuoteRequirement(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </Field>
        <Field label="交付要求">
          <textarea
            value={deliveryRequirement}
            onChange={(event) => setDeliveryRequirement(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </Field>
        <Field label="邀请说明">
          <textarea
            value={invitationNote}
            onChange={(event) => setInvitationNote(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold leading-5 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </Field>
      </div>

      <div className="mt-3 space-y-2">
        {rfqEligibleRelations.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
            暂无具备有效资质的已准入供应商，请先完成供应商准入并维护有效资质后再创建询价。
          </div>
        )}
        {relations.map((relation) => {
          const supplier = suppliers.find((item) => item.id === relation.supplierId);
          const checked = selectedSupplierIds.includes(relation.supplierId);
          const eligible = rfqEligibleSupplierIds.has(relation.supplierId);
          return (
            <label
              key={relation.id}
              className={`block rounded-lg border bg-white p-3 transition ${
                checked ? 'border-blue-300 ring-2 ring-blue-100' : eligible ? 'border-slate-200 hover:border-blue-200' : 'border-amber-100 bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!eligible}
                  onChange={(event) => toggleSupplierSelection(relation.supplierId, event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-xs font-black text-slate-800">{supplier?.name ?? relation.supplierId}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
                      {relation.level} 级
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                      绩效 {relation.performanceScore} 分
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">
                    授权品类：{relation.categories.join(' / ')}
                  </p>
                  {!eligible && (
                    <p className="mt-1 break-words text-xs font-black leading-5 text-amber-700">
                      {relation.status !== '已准入' ? '未完成准入，不可邀请' : '无有效资质，不可邀请'}
                    </p>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3 text-xs font-bold leading-5 text-blue-700">
        RFQ 创建后将向 {selectedEligibleSupplierIds.length} 家具备有效资质的已准入供应商发送询价邀请；报价要求、交付要求和邀请说明会作为页面上下文展示，待后端字段开放后再持久化。
      </div>

      {(supplierSelectionInvalid || deadlineInvalid) && (
        <div aria-live="polite" className="mt-3 space-y-2">
          {supplierSelectionInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请至少选择一家具备有效资质的已准入供应商。
            </p>
          )}
          {deadlineInvalid && (
            <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              报价截止日期必须晚于今天。
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => onSubmit(demand.id, selectedEligibleSupplierIds, `${deadline}T18:00:00+08:00`)}
        disabled={!canSubmit || busy}
        data-testid={`stage7-create-rfq-${demand.id}`}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <Send size={14} />
        {busy ? '创建中' : '创建询价'}
      </button>
    </div>
  );
};

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black text-slate-500">{label}</span>
    {children}
  </label>
);

const DetailPanelBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-3 rounded-lg border border-slate-200/70 bg-slate-50/70 p-2 shadow-inner shadow-slate-200/50 sm:space-y-4 sm:p-3">
    {children}
  </div>
);

const DetailHeroCard: React.FC<{
  eyebrow: string;
  title: string;
  meta: string;
  status?: string;
  amountLabel?: string;
  facts: Array<{ label: string; value: string }>;
  summaryFacts?: Array<{ label: string; value: string }>;
}> = ({
  eyebrow,
  title,
  meta,
  status,
  amountLabel,
  facts,
  summaryFacts = [],
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/60">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-full">
        <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">{eyebrow}</p>
        <p className="mt-1 break-words text-base font-black text-slate-950">{title}</p>
        <p className="mt-1 break-words text-xs font-bold text-slate-400">{meta}</p>
      </div>
      {status && <StatusPill label={status} />}
    </div>
    {amountLabel && <p className="mt-3 max-w-full font-mono text-xl font-black text-slate-950">{amountLabel}</p>}
    <InlineFactGrid facts={facts} />
    {summaryFacts.length > 0 && (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {summaryFacts.map((fact) => (
          <MiniFact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>
    )}
  </div>
);

const DetailSection: React.FC<{
  title: string;
  countLabel?: string;
  children: React.ReactNode;
}> = ({ title, countLabel, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="break-words text-xs font-black text-slate-600">{title}</p>
      {countLabel && (
        <span className="self-start rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
          {countLabel}
        </span>
      )}
    </div>
    {children}
  </section>
);

const parseAttachmentNames = (value: string) =>
  value
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);

const AttachmentCenterEntryPanel: React.FC<{
  title: string;
  ownerType: string;
  ownerId: string;
  visibility: 'tenant' | 'buyer_internal' | 'supplier_shared';
  desc: string;
  attachmentNames?: string[];
}> = ({
  title,
  ownerType,
  ownerId,
  visibility,
  desc,
  attachmentNames = [],
}) => {
  const visibilityLabel = visibility === 'supplier_shared'
    ? '供应商共享'
    : visibility === 'buyer_internal'
      ? '采购方内部'
      : '租户内可见';

  return (
    <section className="mt-3 rounded-lg border border-sky-100 bg-sky-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-sky-800">附件中心入口</p>
          <p className="mt-1 text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-sky-700">{desc}</p>
        </div>
        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[11px] font-black text-sky-700">
          登记附件元数据
        </span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <MiniFact label="业务对象" value={ownerType} />
        <MiniFact label="对象编号" value={ownerId} />
        <MiniFact label="visibility" value={visibilityLabel} />
      </div>
      <div className="mt-3 rounded-lg border border-sky-100 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black text-slate-600">附件清单预览</p>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
            {attachmentNames.length} 个
          </span>
        </div>
        {attachmentNames.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachmentNames.map((name) => (
              <span key={name} className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-bold text-slate-600">
                {name}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs font-bold text-slate-500">暂无附件名称，保存业务单据后可补充附件元数据。</p>
        )}
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-sky-700">
        当前阶段只登记附件元数据并关联业务对象，暂不上传原文件、生成下载签名或处理文件预览。
      </p>
    </section>
  );
};

const DetailActionPanel: React.FC<{
  title: string;
  desc?: string;
  status?: string;
  tone?: 'blue' | 'emerald' | 'slate';
  children: React.ReactNode;
}> = ({ title, desc, status, tone = 'blue', children }) => {
  const toneClass = tone === 'emerald'
    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
    : tone === 'slate'
      ? 'border-slate-200 bg-slate-50 text-slate-700'
      : 'border-blue-100 bg-blue-50 text-blue-800';

  return (
    <section className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-xs font-black">{title}</p>
          {desc && <p className="mt-1 break-words text-xs font-bold leading-5">{desc}</p>}
        </div>
        {status && <span className="self-start"><StatusPill label={status} /></span>}
      </div>
      <div className="min-w-0 space-y-3 overflow-x-auto rounded-lg border border-white/70 bg-white/60 p-3">
        {children}
      </div>
    </section>
  );
};

const MiniFact: React.FC<{
  label: string;
  value: string;
  compact?: boolean;
}> = ({ label, value, compact = false }) => (
  <div className={`min-w-0 rounded-lg border border-slate-100 bg-white/80 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
    <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-black text-slate-400`}>{label}</p>
    <p className={`${compact ? 'mt-0.5 line-clamp-3 text-[11px] leading-4' : 'mt-1 text-xs leading-5'} break-words font-bold text-slate-700`}>{value}</p>
  </div>
);

const DetailKeyValueRow: React.FC<{
  label: string;
  value: string;
  fontMono?: boolean;
}> = ({ label, value, fontMono = false }) => (
  <div className="flex min-w-0 flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <span className="text-xs font-black text-slate-500 sm:min-w-[7rem]">{label}</span>
    <span className={`max-w-full break-words text-xs font-black text-slate-900 sm:text-right ${fontMono ? 'font-mono' : ''}`}>
      {value}
    </span>
  </div>
);

const RelatedBusinessRow: React.FC<{
  title: string;
  detail: string;
}> = ({ title, detail }) => (
  <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
    <p className="break-words text-sm font-black text-slate-900">{title}</p>
    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">{detail}</p>
  </div>
);

const ModuleSummaryStrip: React.FC<{
  facts: BuyerModuleFact[];
}> = ({ facts }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {facts.map((fact) => (
      <div key={fact.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-black text-slate-400">{fact.label}</p>
        <p className="mt-1 truncate font-mono text-lg font-black text-slate-950">{fact.value}</p>
      </div>
    ))}
  </div>
);

const InlineFactGrid: React.FC<{
  facts: BuyerModuleFact[];
}> = ({ facts }) => (
  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
    {facts.map((fact) => (
      <div key={`${fact.label}:${fact.value}`} className="min-w-0 rounded-md border border-slate-100 bg-white/80 px-3 py-2">
        <p className="text-[11px] font-black text-slate-400">{fact.label}</p>
        <p className="mt-1 break-words text-xs font-bold text-slate-700">{fact.value}</p>
      </div>
    ))}
  </div>
);

const nextActionToneClasses: Record<BuyerNextAction['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
};

const NextActionNotice: React.FC<{
  action: BuyerNextAction;
}> = ({ action }) => (
  <div className={`mt-4 rounded-lg border p-3 ${nextActionToneClasses[action.tone]}`}>
    <p className="text-xs font-black">{action.title}</p>
    <p className="mt-1 text-xs font-bold leading-5 opacity-80">{action.detail}</p>
  </div>
);

const supplierActionToneClasses: Record<SupplierRelationAction['tone'], string> = {
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
  blue: 'border-blue-100 bg-blue-50 text-blue-700',
  amber: 'border-amber-100 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  red: 'border-red-100 bg-red-50 text-red-700',
};

const SupplierRelationNotice: React.FC<{
  action: SupplierRelationAction;
}> = ({ action }) => (
  <div className={`mt-4 rounded-lg border p-3 ${supplierActionToneClasses[action.tone]}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-black">{action.title}</p>
        <p className="mt-1 text-xs font-bold leading-5 opacity-80">{action.detail}</p>
      </div>
      <span className="shrink-0 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-black">
        {action.riskLabel}
      </span>
    </div>
  </div>
);

const shellStateToneClasses = {
  loading: 'border-blue-100 bg-blue-50 text-blue-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  empty: 'border-slate-200 bg-slate-50 text-slate-600',
};

const ShellState: React.FC<{
  variant: 'loading' | 'error' | 'empty';
  title: string;
  desc: string;
  fullScreen?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ variant, title, desc, fullScreen = false, actionLabel, onAction }) => {
  const Icon = variant === 'error' ? ShieldCheck : variant === 'loading' ? Activity : Database;
  const body = (
    <div className={`flex min-h-[12rem] items-center justify-center rounded-lg border p-6 text-center ${shellStateToneClasses[variant]}`}>
      <div className="flex max-w-xl flex-col items-center justify-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="break-words text-sm font-black">{title}</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{desc}</p>
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-white px-3 text-xs font-black shadow-sm transition hover:bg-white/80"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (!fullScreen) return body;

  return (
    <div className="flex h-dvh items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="w-full max-w-md">{body}</div>
    </div>
  );
};

const EmptyState: React.FC<{
  title: string;
  desc: string;
}> = ({ title, desc }) => (
  <ShellState variant="empty" title={title} desc={desc} />
);

const PermissionBoundaryPanel: React.FC<{
  roleLabel: string;
  modeLabel: string;
  allowedActions: string[];
  blockedActions: string[];
  dataBoundary: string;
}> = ({ roleLabel, modeLabel, allowedActions, blockedActions, dataBoundary }) => (
  <section className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-indigo-700" />
          <p className="text-sm font-black text-indigo-950">权限差异提示</p>
        </div>
        <p className="mt-1 text-xs font-bold leading-5 text-indigo-700">
          当前为 {modeLabel}，Java 模式执行真实 API 权限校验；Mock 模式仅用于页面形态和交互预览。
        </p>
      </div>
      <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:w-[520px]">
        <MiniFact label="当前角色" value={roleLabel} />
        <MiniFact label="运行模式" value={modeLabel} />
        <MiniFact label="数据边界" value={dataBoundary} />
      </div>
    </div>

    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border border-emerald-100 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-black text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          可执行动作
        </div>
        <div className="space-y-2">
          {allowedActions.map((action) => (
            <p key={action} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-800">
              {action}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-black text-slate-600">
          <LockKeyhole className="h-4 w-4" />
          不可越界动作
        </div>
        <div className="space-y-2">
          {blockedActions.map((action) => (
            <p key={action} className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
              {action}
            </p>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const MessageCenterPanel: React.FC<{
  title: string;
  scopeLabel: string;
  notifications: JavaNotificationDto[];
  onMarkRead?: (notificationId: string) => void;
  markReadBusyId?: string | null;
}> = ({ title, scopeLabel, notifications, onMarkRead, markReadBusyId }) => {
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <Panel title={title} icon={Bell}>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">消息中心入口</p>
          <p className="mt-1 text-sm font-bold text-slate-500">{scopeLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
            未读 {unreadCount} 条
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            共 {notifications.length} 条
          </span>
        </div>
      </div>
      {notifications.length > 0 ? (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const markReadBusy = markReadBusyId?.endsWith(`:${notification.id}`) ?? false;
            const canMarkRead = Boolean(onMarkRead && !notification.read && !notification.id.startsWith('supplier-message-'));
            return (
              <div
                key={notification.id}
                className={`rounded-lg border p-4 ${
                  notification.read ? 'border-slate-200 bg-white' : 'border-blue-100 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{notification.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">
                      {notification.content}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {!notification.read && (
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-blue-700">
                        未读
                      </span>
                    )}
                    {canMarkRead && (
                      <button
                        type="button"
                        onClick={() => onMarkRead?.(notification.id)}
                        disabled={markReadBusy}
                        className="rounded-lg border border-blue-100 bg-white px-2 py-1 text-xs font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {markReadBusy ? '处理中' : '标记已读'}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-400">{formatAuditTime(notification.createdAt)}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title="暂无站内通知" desc="审批、询价、订单、发票和付款状态变化会在这里汇总。" />
      )}
    </Panel>
  );
};

const feedbackNoticeToneClasses: Record<'success' | 'error' | 'info', string> = {
  success: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  error: 'border-red-100 bg-red-50 text-red-700',
  info: 'border-blue-100 bg-blue-50 text-blue-700',
};

const resolveFeedbackTone = (message: string): 'success' | 'error' | 'info' => {
  if (message.includes('失败') || message.includes('拒绝') || message.includes('冻结') || message.includes('不允许')) {
    return 'error';
  }
  if (message.includes('已完成') || message.includes('已')) {
    return 'success';
  }
  return 'info';
};

const FeedbackNotice: React.FC<{
  message: string;
  tone?: 'success' | 'error' | 'info';
}> = ({ message, tone = resolveFeedbackTone(message) }) => (
  <div
    aria-live="polite"
    role="status"
    className={`rounded-lg border px-4 py-3 text-sm font-bold ${feedbackNoticeToneClasses[tone]}`}
  >
    {message}
  </div>
);

const processStateToneClasses = {
  handled: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  waiting: 'border-slate-200 bg-slate-50 text-slate-600',
  blocked: 'border-amber-100 bg-amber-50 text-amber-800',
};

const ProcessStateNotice: React.FC<{
  variant: 'handled' | 'waiting' | 'blocked';
  title: string;
  desc: string;
}> = ({ variant, title, desc }) => {
  const Icon = variant === 'handled' ? CheckCircle2 : variant === 'blocked' ? AlertCircle : Activity;

  return (
    <div
      aria-label={`${title}：${desc}`}
      className={`mt-4 rounded-lg border p-3 ${processStateToneClasses[variant]}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="break-words text-xs font-black">{title}</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{desc}</p>
        </div>
      </div>
    </div>
  );
};

const describeSupplierOpportunityNextAction = (
  rfq: SupplierWorkspace['opportunities'][number] | undefined,
  supplierId: string,
) => {
  if (!rfq) return '选择询价邀请后展示报价或拒绝入口。';
  if (rfq.quotes.some((quote) => quote.supplierId === supplierId)) return '已提交报价，继续跟进报价记录和定标结果。';
  if (rfq.status === '报价中') return '核对采购要求后提交报价，或明确拒绝邀请。';
  return '询价已不在报价期，等待采购方定标或后续通知。';
};

const describeSupplierQuoteNextAction = (
  quote: SupplierWorkspace['quotes'][number] | undefined,
  rfq: SupplierWorkspace['opportunities'][number] | undefined,
) => {
  if (!quote) return '选择报价记录后查看关联询价和定标结果。';
  if (quote.status === '已定标') return '报价已定标，等待采购方生成采购订单。';
  if (rfq?.status === '报价中') return '报价仍在窗口期，可维护本企业报价信息。';
  return '报价已提交，等待采购方比价、定标和审批。';
};

const describeSupplierOrderNextAction = (
  order: SupplierWorkspace['orders'][number] | undefined,
  delivery: SupplierWorkspace['deliveries'][number] | undefined,
  invoice: SupplierWorkspace['invoices'][number] | undefined,
) => {
  if (!order) return '选择销售订单后查看确认、发货和开票入口。';
  if (order.status === '待供应商确认') return '确认订单后进入待发货。';
  if (order.status === '待发货') return '维护承运商和物流单号并提交发货。';
  if (!delivery) return '补充发货信息，便于采购方收货验收。';
  if (order.status === '已收货' && !invoice) return '采购方已收货，可提交发票形成应收。';
  if (invoice) return '发票已提交，继续跟进应收和付款状态。';
  return '等待采购方收货验收后再进入开票应收。';
};

const describeSupplierInvoiceNextAction = (invoice: SupplierWorkspace['invoices'][number] | undefined) => {
  if (!invoice) return '选择应收发票后查看对账、逾期和付款状态。';
  if (invoice.paymentStatus === '已付款') return '采购方已登记付款，应收流程可归档。';
  if (invoice.varianceAmount && invoice.varianceAmount !== 0) return '存在对账差异，先维护对账备注并跟进采购方处理。';
  if (invoice.overdueDays && invoice.overdueDays > 0) return `已逾期 ${invoice.overdueDays} 天，需要跟进回款。`;
  return '持续跟进采购方付款计划和应收状态。';
};

const SupplierWorkspaceView: React.FC<{
  activeModule: SupplierAdminModule;
  workspace: SupplierWorkspace;
  javaEnabled: boolean;
  workflowStatus: string | null;
  supplierActionBusyId: string | null;
  supplierProfileBusy: boolean;
  supplierQualificationBusy: boolean;
  notificationReadBusyId: string | null;
  onSubmitQuote: (rfqId: string, draft: SupplierQuoteDraft) => void;
  onUpdateQuote: (quoteId: string, draft: SupplierQuoteDraft) => void;
  onConfirmOrder: (orderId: string) => void;
  onCreateDelivery: (orderId: string, draft: SupplierDeliveryDraft) => void;
  onUpdateDelivery: (deliveryId: string, draft: SupplierDeliveryDraft) => void;
  onCreateInvoice: (orderId: string, draft: SupplierInvoiceDraft) => void;
  onUpdateReceivable: (invoiceId: string, draft: SupplierReceivableDraft) => void;
  onUpdateSupplierProfile: (draft: SupplierProfileDraft) => void;
  onCreateSupplierQualification: (draft: SupplierQualificationDraft) => void;
  onMarkSupplierNotificationRead: (notificationId: string) => void;
  onNavigateSupplierModule: (moduleId: SupplierAdminModule) => void;
}> = ({
  activeModule,
  workspace,
  javaEnabled,
  workflowStatus,
  supplierActionBusyId,
  supplierProfileBusy,
  supplierQualificationBusy,
  notificationReadBusyId,
  onSubmitQuote,
  onUpdateQuote,
  onConfirmOrder,
  onCreateDelivery,
  onUpdateDelivery,
  onCreateInvoice,
  onUpdateReceivable,
  onUpdateSupplierProfile,
  onCreateSupplierQualification,
  onMarkSupplierNotificationRead: markSupplierNotificationRead,
  onNavigateSupplierModule,
}) => {
  const [declinedOpportunityIds, setDeclinedOpportunityIds] = useState<string[]>([]);
  const [selectedRequirementRfqId, setSelectedRequirementRfqId] = useState<string | null>(null);
  const [selectedSupplierQuoteId, setSelectedSupplierQuoteId] = useState(workspace.quotes[0]?.id ?? '');
  const [selectedSupplierOrderId, setSelectedSupplierOrderId] = useState(workspace.orders[0]?.id ?? '');
  const [selectedSupplierInvoiceId, setSelectedSupplierInvoiceId] = useState(workspace.invoices[0]?.id ?? '');
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, SupplierQuoteDraft>>({});
  const [quoteUpdateDrafts, setQuoteUpdateDrafts] = useState<Record<string, SupplierQuoteDraft>>({});
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, SupplierDeliveryDraft>>({});
  const [deliveryUpdateDrafts, setDeliveryUpdateDrafts] = useState<Record<string, SupplierDeliveryDraft>>({});
  const [invoiceDrafts, setInvoiceDrafts] = useState<Record<string, SupplierInvoiceDraft>>({});
  const [receivableUpdateDrafts, setReceivableUpdateDrafts] = useState<Record<string, SupplierReceivableDraft>>({});
  const [opportunityStatusFilter, setOpportunityStatusFilter] = useState('全部状态');
  const [quoteStatusFilter, setQuoteStatusFilter] = useState('全部状态');
  const [supplierOrderStatusFilter, setSupplierOrderStatusFilter] = useState('全部状态');
  const [supplierInvoiceStatusFilter, setSupplierInvoiceStatusFilter] = useState('全部状态');
  const [reconciliationLedgerStatusFilter, setReconciliationLedgerStatusFilter] = useState('全部状态');
  const onDeclineOpportunity = (rfqId: string) => {
    setDeclinedOpportunityIds((current) => (
      current.includes(rfqId) ? current : [...current, rfqId]
    ));
  };
  const onViewRequirement = (rfqId: string) => {
    setSelectedRequirementRfqId((current) => (current === rfqId ? null : rfqId));
  };
  const getQuoteUpdateDraft = (quote: SupplierWorkspace['quotes'][number]): SupplierQuoteDraft =>
    quoteUpdateDrafts[quote.id] ?? {
      amount: quote.amount,
      taxRate: quote.taxRate,
      deliveryDays: quote.deliveryDays,
    };
  const getDeliveryUpdateDraft = (delivery: SupplierWorkspace['deliveries'][number]): SupplierDeliveryDraft =>
    deliveryUpdateDrafts[delivery.id] ?? {
      carrier: delivery.carrier,
      trackingNo: delivery.trackingNo,
    };
  const getReceivableUpdateDraft = (invoice: SupplierWorkspace['invoices'][number]): SupplierReceivableDraft =>
    receivableUpdateDrafts[invoice.id] ?? {
      reconciliationNote: invoice.reconciliationNote ?? '',
    };
  const supplierModuleFacts = buildSupplierModuleFacts(workspace, activeModule);
  const supplierModuleHeader = supplierModuleHeaders[activeModule];
  const isSupplierRfqQuoteOpen = (rfq: SupplierWorkspace['opportunities'][number]) =>
    rfq.status === '报价中' && new Date(rfq.deadline).getTime() > Date.now();
  const pendingQuoteCount = workspace.opportunities.filter((rfq) =>
    isSupplierRfqQuoteOpen(rfq)
    && !rfq.quotes.some((quote) => quote.supplierId === workspace.supplier.id),
  ).length;
  const pendingConfirmCount = workspace.orders.filter((order) => order.status === '待供应商确认').length;
  const pendingDeliveryCount = workspace.orders.filter((order) => order.status === '待发货').length;
  const invoiceReadyCount = workspace.orders.filter((order) =>
    order.status === '已收货'
    && !workspace.invoices.some((invoice) => invoice.orderId === order.id),
  ).length;
  const pendingReceivableCount = workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款').length;
  const opportunityStatus = (rfq: SupplierWorkspace['opportunities'][number]) =>
    declinedOpportunityIds.includes(rfq.id) ? '已拒绝' : rfq.status;
  const opportunityStatusOptions = Array.from(new Set([
    ...workspace.opportunities.map(opportunityStatus),
    '已拒绝',
  ]));
  const quoteStatusOptions = Array.from(new Set(workspace.quotes.map((quote) => quote.status)));
  const supplierOrderStatusOptions = Array.from(new Set(workspace.orders.map((order) => order.status)));
  const supplierInvoiceStatusOptions = Array.from(new Set(workspace.invoices.map((invoice) => invoice.paymentStatus)));
  const filteredSupplierOpportunities = workspace.opportunities.filter((rfq) =>
    opportunityStatusFilter === '全部状态' || opportunityStatus(rfq) === opportunityStatusFilter);
  const filteredSupplierQuotes = workspace.quotes.filter((quote) =>
    quoteStatusFilter === '全部状态' || quote.status === quoteStatusFilter);
  const filteredSupplierOrders = workspace.orders.filter((order) =>
    supplierOrderStatusFilter === '全部状态' || order.status === supplierOrderStatusFilter);
  const filteredSupplierInvoices = workspace.invoices.filter((invoice) =>
    supplierInvoiceStatusFilter === '全部状态' || invoice.paymentStatus === supplierInvoiceStatusFilter);
  const displayedSupplierOpportunities = limitSupplierDemoRows(
    filteredSupplierOpportunities,
    (rfq) => rfq.id === 'rfq-stage7-supplier-quote-ready',
  );
  const displayedSupplierQuotes = limitSupplierDemoRows(
    filteredSupplierQuotes,
    (quote) => quote.rfqId === 'rfq-stage7-supplier-quote-ready',
  );
  const displayedSupplierOrders = limitSupplierDemoRows(
    filteredSupplierOrders,
    (order) => order.id === 'po-stage7-supplier-confirm-ready'
      || order.id === 'po-stage7-supplier-delivery-ready'
      || order.id === 'po-stage7-supplier-invoice-ready',
  );
  const displayedSupplierInvoices = limitSupplierDemoRows(
    filteredSupplierInvoices,
    (invoice) => invoice.id === 'inv-stage7-supplier-receivable-ready',
  );
  const selectedSupplierOpportunity = selectedRequirementRfqId
    ? filteredSupplierOpportunities.find((rfq) => rfq.id === selectedRequirementRfqId) ?? filteredSupplierOpportunities[0]
    : filteredSupplierOpportunities[0];
  const selectedSupplierQuoteDetail = filteredSupplierQuotes.find((quote) => quote.id === selectedSupplierQuoteId)
    ?? filteredSupplierQuotes[0];
  const selectedSupplierQuoteRfq = selectedSupplierQuoteDetail
    ? workspace.opportunities.find((rfq) => rfq.id === selectedSupplierQuoteDetail.rfqId)
    : undefined;
  const selectedSupplierOrderDetail = filteredSupplierOrders.find((order) => order.id === selectedSupplierOrderId)
    ?? filteredSupplierOrders[0];
  const selectedSupplierOrderDelivery = selectedSupplierOrderDetail
    ? workspace.deliveries.find((delivery) => delivery.orderId === selectedSupplierOrderDetail.id)
    : undefined;
  const selectedSupplierOrderInvoice = selectedSupplierOrderDetail
    ? workspace.invoices.find((invoice) => invoice.orderId === selectedSupplierOrderDetail.id)
    : undefined;
  const selectedSupplierInvoiceDetail = filteredSupplierInvoices.find((invoice) => invoice.id === selectedSupplierInvoiceId)
    ?? filteredSupplierInvoices[0];
  const selectedSupplierInvoiceOrder = selectedSupplierInvoiceDetail
    ? workspace.orders.find((order) => order.id === selectedSupplierInvoiceDetail.orderId)
    : undefined;
  const supplierMessageCenterNotifications = buildSupplierMessageCenterNotifications(workspace);
  const locateSupplierDemoSample = () => {
    if (activeModule === 'opportunities') {
      setOpportunityStatusFilter('全部状态');
      setSelectedRequirementRfqId('rfq-stage7-supplier-quote-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-supplier-opportunity');
    }
    if (activeModule === 'quotes') {
      const stageSevenQuote = workspace.quotes.find((quote) => quote.rfqId === 'rfq-stage7-supplier-quote-ready');
      setQuoteStatusFilter('全部状态');
      setSelectedSupplierQuoteId(stageSevenQuote?.id ?? workspace.quotes[0]?.id ?? '');
      scrollToStageNineDemoSample('stage9-demo-sample-supplier-opportunity');
    }
    if (activeModule === 'orders') {
      setSupplierOrderStatusFilter('全部状态');
      setSelectedSupplierOrderId('po-stage7-supplier-confirm-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-supplier-order');
    }
    if (activeModule === 'invoices') {
      setSupplierInvoiceStatusFilter('全部状态');
      setSelectedSupplierInvoiceId('inv-stage7-supplier-receivable-ready');
      scrollToStageNineDemoSample('stage9-demo-sample-supplier-receivable');
    }
  };
  const supplierDemoSequenceNavigation = buildDemoSequenceNavigation(
    supplierDemoWalkthroughSteps,
    activeModule,
    '供应商协同演示收束',
    (moduleId) => {
      onNavigateSupplierModule(moduleId);
      if (moduleId === 'opportunities') {
        setOpportunityStatusFilter('全部状态');
      }
      if (moduleId === 'orders') {
        setSupplierOrderStatusFilter('全部状态');
      }
      if (moduleId === 'invoices') {
        setSupplierInvoiceStatusFilter('全部状态');
      }
    },
    locateSupplierDemoSample,
  );
  const supplierDemoReadinessItems = buildDemoReadinessItems(
    javaEnabled,
    '供应商 5 个真实动作',
    'stage-seven-supplier-java-real-action-click-result.json',
    '商机、订单、应收推荐样本已标记，适合讲采购方流程的供应商协同镜像。',
  );
  const supplierCollaborationOperationStrip = supplierCollaborationOperationStrips[activeModule];
  const supplierDemoPresenterCue = {
    opportunities: {
      moduleLabel: '询价邀请',
      selectedTitle: selectedSupplierOpportunity?.title,
      selectedMeta: selectedSupplierOpportunity?.id,
      statusLabel: selectedSupplierOpportunity ? opportunityStatus(selectedSupplierOpportunity) : undefined,
      displayedCount: displayedSupplierOpportunities.length,
      totalCount: filteredSupplierOpportunities.length,
      primaryActionLabel: '提交报价 / 查看要求',
      densityHint: 'RFQ 摘要、报价截止、采购要求和本企业响应状态同屏可见',
      listHeightHint: '商机卡片只保留截止时间、报价状态、采购要求和响应入口。',
      nextModuleLabel: '报价记录',
      primaryButtonHint: '提交报价按钮紧贴询价邀请卡片的报价草稿区',
      disabledReasonHint: '已报价、已拒绝或非报价中 RFQ 会解释不可重复报价原因。',
      detailEntryHint: '查看要求入口用于核对采购要求、需求编号和邀请范围。',
      postClickHint: '提交报价后进入报价记录，采购方侧可继续比价定标。',
    },
    quotes: {
      moduleLabel: '报价记录',
      selectedTitle: selectedSupplierQuoteRfq?.title ?? selectedSupplierQuoteDetail?.rfqId,
      selectedMeta: selectedSupplierQuoteDetail?.id,
      statusLabel: selectedSupplierQuoteDetail?.status,
      displayedCount: displayedSupplierQuotes.length,
      totalCount: filteredSupplierQuotes.length,
      primaryActionLabel: '跟进定标结果',
      densityHint: '报价金额、交付周期、税率、关联 RFQ 和定标结果同屏可见',
      listHeightHint: '报价卡片优先展示金额、交期、状态和关联询价。',
      nextModuleLabel: '销售订单',
      primaryButtonHint: '报价修改入口跟随报价详情展示',
      disabledReasonHint: '已定标或非报价中 RFQ 只读，定标结果由采购方侧产生。',
      detailEntryHint: '详情入口用于核对报价历史、采购要求和修改边界。',
      postClickHint: '报价被定标并生成采购订单后，进入销售订单履约。',
    },
    orders: {
      moduleLabel: '销售订单',
      selectedTitle: selectedSupplierOrderDetail?.id,
      selectedMeta: selectedSupplierOrderDetail?.tenantId,
      statusLabel: selectedSupplierOrderDetail?.status,
      displayedCount: displayedSupplierOrders.length,
      totalCount: filteredSupplierOrders.length,
      primaryActionLabel: '确认订单 / 提交发货 / 提交发票',
      densityHint: '订单金额、确认状态、发货状态、开票状态和下一动作同屏可见',
      listHeightHint: '订单卡片固定展示订单状态、物流、发票和下一步。',
      nextModuleLabel: '发票应收',
      primaryButtonHint: '确认订单、提交发货和提交发票按钮跟随订单状态展示',
      disabledReasonHint: '不同订单状态只开放对应动作，已发货或已开票记录保持只读。',
      detailEntryHint: '详情入口用于核对订单金额、物流、发票和履约轨迹。',
      postClickHint: '提交发票后进入发票应收，等待采购方付款登记。',
    },
    invoices: {
      moduleLabel: '发票应收',
      selectedTitle: selectedSupplierInvoiceDetail?.invoiceNo ?? selectedSupplierInvoiceDetail?.id,
      selectedMeta: selectedSupplierInvoiceDetail?.orderId,
      statusLabel: selectedSupplierInvoiceDetail?.paymentStatus,
      displayedCount: displayedSupplierInvoices.length,
      totalCount: filteredSupplierInvoices.length,
      primaryActionLabel: '保存对账备注 / 跟进回款',
      densityHint: '发票金额、对账备注、逾期提醒、付款状态和关联订单同屏可见',
      listHeightHint: '应收卡片优先展示金额、付款状态、逾期和订单来源。',
      nextModuleLabel: '企业档案',
      primaryButtonHint: '保存对账备注入口固定在应收详情区',
      disabledReasonHint: '已付款发票只做回看，付款结果由采购方登记。',
      detailEntryHint: '详情入口用于核对应收风险、对账备注和订单来源。',
      postClickHint: '备注保存后继续等待采购方付款，或回到企业档案维护资质。',
    },
    profile: {
      moduleLabel: '企业档案',
      selectedTitle: workspace.supplier.name,
      selectedMeta: workspace.supplier.industry,
      statusLabel: workspace.supplier.verified ? '已认证' : '待认证',
      displayedCount: 1,
      totalCount: 1,
      primaryActionLabel: '维护企业档案',
      densityHint: '企业认证、资质附件、联系人、授权品类和合作采购方同屏可见',
      listHeightHint: '档案页不做大列表，集中展示身份、资质和协同能力。',
      nextModuleLabel: '询价邀请',
      primaryButtonHint: '保存企业档案按钮固定在档案维护入口底部',
      disabledReasonHint: 'Mock 模式或资料不完整时禁用保存并保留说明。',
      detailEntryHint: '档案能力卡片用于核对资质、联系人和多采购方协同信息。',
      postClickHint: '档案保存后回到询价邀请，支撑采购方准入和后续邀请。',
    },
  }[activeModule];
  const supplierKeyActionReadiness = {
    opportunities: [
      {
        label: '提交报价',
        enabled: displayedSupplierOpportunities.some((rfq) => (
          rfq.status === '报价中'
          && new Date(rfq.deadline).getTime() > Date.now()
          && !rfq.quotes.some((quote) => quote.supplierId === workspace.supplier.id)
          && !declinedOpportunityIds.includes(rfq.id)
        )),
        reason: '存在报价中且本企业未报价的邀请时可提交报价；已报价或已拒绝保持只读解释。',
      },
    ],
    quotes: [
      {
        label: '跟进定标结果',
        enabled: displayedSupplierQuotes.length > 0,
        reason: '报价记录用于回看采购方比价、定标和订单生成状态。',
      },
    ],
    orders: [
      {
        label: '确认订单',
        enabled: displayedSupplierOrders.some((order) => order.status === '待供应商确认'),
        reason: '采购方生成订单后，供应商确认才能进入发货履约。',
      },
      {
        label: '提交发货',
        enabled: displayedSupplierOrders.some((order) => order.status === '待发货'),
        reason: '订单确认后可填写承运商和物流单号并同步给采购方收货验收。',
      },
      {
        label: '提交发票',
        enabled: displayedSupplierOrders.some((order) => (
          order.status === '已收货'
          && !workspace.invoices.some((invoice) => invoice.orderId === order.id)
        )),
        reason: '采购方收货后供应商可提交发票，形成应收台账。',
      },
    ],
    invoices: [
      {
        label: '保存对账备注',
        enabled: displayedSupplierInvoices.some((invoice) => invoice.paymentStatus !== '已付款'),
        reason: '未付款应收可维护对账备注；付款结论仍由采购方登记。',
      },
    ],
    profile: [
      {
        label: '保存企业档案',
        enabled: javaEnabled,
        reason: 'Java 模式下可保存企业档案；Mock 模式只展示草稿和边界。',
      },
    ],
  }[activeModule] ?? [];
  const supplierRealActionFeedbackItems = buildSupplierRealActionFeedbackItems({
    pendingQuoteCount,
    pendingConfirmCount,
    pendingDeliveryCount,
    invoiceReadyCount,
    pendingReceivableCount,
  });
  useEffect(() => {
    setSelectedSupplierQuoteId((current) => (
      workspace.quotes.some((quote) => quote.id === current) ? current : workspace.quotes[0]?.id ?? ''
    ));
    setSelectedSupplierOrderId((current) => (
      workspace.orders.some((order) => order.id === current) ? current : workspace.orders[0]?.id ?? ''
    ));
    setSelectedSupplierInvoiceId((current) => (
      workspace.invoices.some((invoice) => invoice.id === current) ? current : workspace.invoices[0]?.id ?? ''
    ));
  }, [workspace.quotes, workspace.orders, workspace.invoices]);

  return (
    <>
    <HeroBand
      eyebrow="供应商协同中心"
      title="一次注册，多采购方协作"
      desc="供应商维护企业档案与资质，接收不同采购方的询价邀请，但报价、订单、发票按采购方隔离。"
    />

    {javaEnabled && workflowStatus && (
      <FeedbackNotice message={workflowStatus} />
    )}

    <SupplierModuleHeader
      header={supplierModuleHeader}
      facts={supplierModuleFacts}
      javaEnabled={javaEnabled}
    />

    <PermissionBoundaryPanel
      roleLabel="供应商企业"
      modeLabel={javaEnabled ? 'Java 模式' : 'Mock 模式'}
      allowedActions={[
        '响应询价、提交报价、确认订单、发货和登记发票',
        '维护企业档案、资质附件和联系人协同信息',
      ]}
      blockedActions={[
        '不能查看采购方内部审批、预算和其他供应商报价明细',
        '不能修改采购方定标、收货验收和付款审批结果',
      ]}
      dataBoundary="当前供应商主体下的商机、报价、销售订单和应收记录"
    />

    <SupplierActionLoopSummaryPanel
      pendingQuoteCount={pendingQuoteCount}
      pendingConfirmCount={pendingConfirmCount}
      pendingDeliveryCount={pendingDeliveryCount}
      invoiceReadyCount={invoiceReadyCount}
      pendingReceivableCount={pendingReceivableCount}
    />

    <DemoCommandCenterPanel
      title="供应商现场演示总线"
      subtitle="把供应商侧讲成采购方流程的协同镜像：从收到询价到报价、履约、开票和应收跟进。"
      items={supplierDemoCommandCenterItems}
      currentGuide={supplierDemoCurrentActionGuides[activeModule]}
      sequenceNavigation={supplierDemoSequenceNavigation}
      testId="stage9-supplier-demo-command-center"
    />

    <DemoReadinessPanel
      title="供应商演示准备检查"
      subtitle="开场前确认供应商侧商机、报价、订单、发票应收的演示证据和样本定位。"
      status={javaEnabled ? 'Java 数据源已连接' : '等待 Java 数据源'}
      items={supplierDemoReadinessItems}
      testId="stage9-supplier-demo-readiness"
    />

    <DemoActionFeedbackPanel
      title="供应商 5 个真实点击动作"
      subtitle="供应商只能处理自己的邀请、订单和应收记录；采购方审批、收货和付款结果由采购方驱动。"
      items={supplierDemoActionFeedbackItems}
      testId="stage8-supplier-action-feedback"
    />

    <DemoReadonlyBoundaryPanel
      title="供应商只读边界与空状态"
      subtitle="说明已报价、已发货、已收货、已付款后的只读逻辑，让供应商侧演示更像真实协同后台。"
      items={supplierReadonlyBoundaryItems}
      testId="stage8-supplier-readonly-boundary"
    />

    <DemoPermissionAuditPanel
      title="供应商权限与审计留痕"
      subtitle="把供应商侧动作限制在本企业协同数据内，强调报价、履约、发票和应收备注均可追溯。"
      items={supplierGovernanceTraceItems}
      testId="stage8-supplier-permission-audit"
    />

    <MessageCenterPanel
      title="供应商消息中心"
      scopeLabel="询价邀请、销售订单、发票应收"
      notifications={supplierMessageCenterNotifications}
      onMarkRead={markSupplierNotificationRead}
      markReadBusyId={notificationReadBusyId}
    />

    {supplierDemoWalkthroughModules.includes(activeModule) && (
      <>
      <DemoWalkthroughRail
        ariaLabel="供应商协同演示路径"
        eyebrow="供应商协同演示路径"
        title="按 5 页顺序完成报价到应收走查"
        description="从询价邀请进入，回看报价记录，完成订单履约、发票应收和企业档案维护。"
        steps={supplierDemoWalkthroughSteps}
        activeModule={activeModule}
        closedLabel="供应商协同演示收束"
        gridClassName="grid-cols-2 sm:grid-cols-5"
        onNavigate={(moduleId) => {
          onNavigateSupplierModule(moduleId);
          if (moduleId === 'opportunities') {
            setOpportunityStatusFilter('全部状态');
          }
          if (moduleId === 'orders') {
            setSupplierOrderStatusFilter('全部状态');
          }
          if (moduleId === 'invoices') {
            setSupplierInvoiceStatusFilter('全部状态');
          }
        }}
      />
      {supplierCollaborationOperationStrip && (
        <SupplierCollaborationOperationStrip
          config={supplierCollaborationOperationStrip}
          onNext={onNavigateSupplierModule}
        />
      )}
      {supplierDemoPresenterCue && (
        <SupplierDemoPresenterCue
          moduleLabel={supplierDemoPresenterCue.moduleLabel}
          selectedTitle={supplierDemoPresenterCue.selectedTitle}
          selectedMeta={supplierDemoPresenterCue.selectedMeta}
          statusLabel={supplierDemoPresenterCue.statusLabel}
          displayedCount={supplierDemoPresenterCue.displayedCount}
          totalCount={supplierDemoPresenterCue.totalCount}
          primaryActionLabel={supplierDemoPresenterCue.primaryActionLabel}
          densityHint={supplierDemoPresenterCue.densityHint}
          listHeightHint={supplierDemoPresenterCue.listHeightHint}
          nextModuleLabel={supplierDemoPresenterCue.nextModuleLabel}
        />
      )}
      {supplierDemoPresenterCue && (
        <SupplierDemoDataSlimmingCue
          moduleLabel={supplierDemoPresenterCue.moduleLabel}
          displayedCount={supplierDemoPresenterCue.displayedCount}
          totalCount={supplierDemoPresenterCue.totalCount}
        />
      )}
      {supplierDemoPresenterCue && supplierKeyActionReadiness.length > 0 && (
        <SupplierKeyActionReadinessPanel
          actions={supplierKeyActionReadiness}
          visibilityHint={{
            moduleLabel: supplierDemoPresenterCue.moduleLabel,
            primaryButtonHint: supplierDemoPresenterCue.primaryButtonHint,
            disabledReasonHint: supplierDemoPresenterCue.disabledReasonHint,
            detailEntryHint: supplierDemoPresenterCue.detailEntryHint,
            postClickHint: supplierDemoPresenterCue.postClickHint,
          }}
          onActionFocus={locateSupplierDemoSample}
        />
      )}
      <SupplierRealActionFeedbackPanel
        items={supplierRealActionFeedbackItems}
        workflowStatus={workflowStatus}
      />
      </>
    )}

    {activeModule === 'overview' && (
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Building2} label="合作采购方" value={`${workspace.connectedBuyerNames.length} 家`} tone="blue" />
        <MetricCard icon={Send} label="询价邀请" value={`${workspace.opportunities.length} 个`} tone="green" />
        <MetricCard icon={ShoppingCart} label="销售订单" value={`${workspace.orders.length} 单`} tone="slate" />
        <MetricCard icon={CreditCard} label="待回款发票" value={`${workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款').length} 张`} tone="amber" />
      </div>
    )}

    {(activeModule === 'opportunities' || activeModule === 'quotes' || activeModule === 'profile') && (
    <div className={`grid gap-6 ${activeModule === 'profile' ? '' : 'lg:grid-cols-[1fr_0.9fr]'}`}>
      {activeModule === 'opportunities' && (
      <Panel title="商机与报价" icon={Send}>
        <div className="space-y-4">
          <ListToolbar
            title="询价邀请池"
            recordCount={workspace.opportunities.length}
            filterLabel="待报价优先"
            actionLabel="批量响应"
          />
          <StatusFilterControl
            label="商机状态"
            value={opportunityStatusFilter}
            statusOptions={opportunityStatusOptions}
            onChange={setOpportunityStatusFilter}
          />
          <FilterResultSummary
            label="询价邀请筛选结果"
            filterLabel={opportunityStatusFilter}
            resultCount={filteredSupplierOpportunities.length}
            totalCount={workspace.opportunities.length}
            selectedLabel={selectedRequirementRfqId ?? undefined}
            onClear={() => setOpportunityStatusFilter('全部状态')}
          />
          <SelectedBusinessHandoffPanel
            moduleLabel="询价邀请"
            selectedTitle={selectedSupplierOpportunity?.title}
            selectedMeta={selectedSupplierOpportunity?.id}
            selectedStatus={selectedSupplierOpportunity ? opportunityStatus(selectedSupplierOpportunity) : undefined}
            nextActionTitle={describeSupplierOpportunityNextAction(selectedSupplierOpportunity, workspace.supplier.id)}
            detailHint="展开采购要求后核对报价截止、需求编号、邀请范围和本企业报价状态。"
            boundaryHint="供应商只能提交或拒绝自己的报价响应，不能查看采购方预算和其他供应商报价。"
          />
          <SupplierOpportunityResponseSummaryPanel
            opportunities={filteredSupplierOpportunities}
            supplierId={workspace.supplier.id}
          />
          {filteredSupplierOpportunities.length === 0 ? (
            <EmptyState title="暂无询价邀请" desc="当前筛选条件下没有可响应的询价邀请，可切换商机状态或等待采购方邀请。" />
          ) : displayedSupplierOpportunities.map((rfq) => {
            const myQuotes = rfq.quotes.filter((quote) => quote.supplierId === workspace.supplier.id);
            const hasMyQuote = myQuotes.length > 0;
            const quoteBusy = supplierActionBusyId === `quote:${rfq.id}`;
            const declined = declinedOpportunityIds.includes(rfq.id);
            const requirementVisible = selectedRequirementRfqId === rfq.id;
            const quoteDraft = quoteDrafts[rfq.id] ?? { amount: 118000, taxRate: 13, deliveryDays: 7 };
            const quoteOpen = isSupplierRfqQuoteOpen(rfq);
            const supplierOpportunityDemoHighlight = rfq.id === 'rfq-stage7-supplier-quote-ready'
              ? {
                  label: '阶段七供应商报价样本',
                  testId: `stage9-demo-sample-supplier-opportunity-${rfq.id}`,
                }
              : undefined;
            return (
              <div
                key={rfq.id}
                className={`rounded-lg border p-4 ${
                  supplierOpportunityDemoHighlight ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'
                }`}
              >
                <DemoSampleHighlightBadge demoHighlight={supplierOpportunityDemoHighlight} />
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-900">{rfq.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {rfq.id} · 截止 {rfq.deadline}
                    </p>
                  </div>
                  <StatusPill label={declined ? '已拒绝' : rfq.status} />
                </div>
                {requirementVisible && (
                  <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-black text-blue-800">采购要求</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      <MiniFact label="报价截止" value={rfq.deadline} />
                      <MiniFact label="邀请供应商" value={`${rfq.invitedSupplierIds.length} 家`} />
                      <MiniFact label="需求编号" value={rfq.demandIds.join('、') || '暂无'} />
                    </div>
                  </div>
                )}
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {myQuotes.map((quote) => (
                    <div key={quote.id} className="rounded-lg bg-orange-50 p-3">
                      <p className="text-xs font-bold text-orange-700">我的报价</p>
                      <p className="mt-1 font-mono text-lg font-black text-slate-900">{currency(quote.amount)}</p>
                      <p className="text-xs text-slate-500">{quote.deliveryDays} 天交付</p>
                    </div>
                  ))}
                  {javaEnabled && quoteOpen && !hasMyQuote && (
                    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 sm:col-span-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto] md:items-end">
                        <label className="block">
                          <span className="text-xs font-black text-blue-700">报价金额</span>
                          <input
                            type="number"
                            min={1}
                            value={quoteDraft.amount}
                            onChange={(event) => setQuoteDrafts((current) => ({
                              ...current,
                              [rfq.id]: {
                                ...quoteDraft,
                                amount: Number(event.target.value),
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-black text-blue-700">税率</span>
                          <input
                            type="number"
                            min={0}
                            value={quoteDraft.taxRate}
                            onChange={(event) => setQuoteDrafts((current) => ({
                              ...current,
                              [rfq.id]: {
                                ...quoteDraft,
                                taxRate: Number(event.target.value),
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-black text-blue-700">交付天数</span>
                          <input
                            type="number"
                            min={1}
                            value={quoteDraft.deliveryDays}
                            onChange={(event) => setQuoteDrafts((current) => ({
                              ...current,
                              [rfq.id]: {
                                ...quoteDraft,
                                deliveryDays: Number(event.target.value),
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400"
                          />
                        </label>
                        <PrimaryActionButton
                          onClick={() => onSubmitQuote(rfq.id, quoteDraft)}
                          disabled={declinedOpportunityIds.includes(rfq.id) || quoteBusy || !quoteOpen || quoteDraft.amount <= 0 || quoteDraft.deliveryDays <= 0}
                          busy={quoteBusy}
                          pendingLabel="提交中"
                          size="md"
                          flushTop
                          testId={`stage7-supplier-submit-quote-${rfq.id}`}
                        >
                          提交报价
                        </PrimaryActionButton>
                      </div>
                    </div>
                  )}
                  {javaEnabled && rfq.status === '报价中' && !quoteOpen && !hasMyQuote && (
                    <p className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800 sm:col-span-3">
                      询价已截止，不能再提交报价。
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onViewRequirement(rfq.id)}
                    className="inline-flex min-h-24 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    查看要求
                  </button>
                  {!hasMyQuote && rfq.status === '报价中' && (
                    <button
                      type="button"
                      onClick={() => onDeclineOpportunity(rfq.id)}
                      disabled={declined}
                      className="inline-flex min-h-24 items-center justify-center rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {declined ? '已拒绝' : '拒绝邀请'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      )}

      {activeModule === 'quotes' && (
        <Panel title="报价记录" icon={BarChart3}>
          <ListToolbar
            title="报价记录池"
            recordCount={workspace.quotes.length}
            filterLabel="按询价项目聚合"
            actionLabel="跟进定标"
          />
          <StatusFilterControl
            label="报价状态"
            value={quoteStatusFilter}
            statusOptions={quoteStatusOptions}
            onChange={setQuoteStatusFilter}
          />
          <FilterResultSummary
            label="报价记录筛选结果"
            filterLabel={quoteStatusFilter}
            resultCount={filteredSupplierQuotes.length}
            totalCount={workspace.quotes.length}
            selectedLabel={selectedSupplierQuoteId}
            onClear={() => setQuoteStatusFilter('全部状态')}
          />
          <SelectedBusinessHandoffPanel
            moduleLabel="报价记录"
            selectedTitle={selectedSupplierQuoteRfq?.title ?? selectedSupplierQuoteDetail?.rfqId}
            selectedMeta={selectedSupplierQuoteDetail?.id}
            selectedStatus={selectedSupplierQuoteDetail?.status}
            nextActionTitle={describeSupplierQuoteNextAction(selectedSupplierQuoteDetail, selectedSupplierQuoteRfq)}
            detailHint="右侧详情会核对关联询价、报价金额、交付天数、定标结果和修改边界。"
            boundaryHint="仅报价中 RFQ 可修改本企业报价；定标和审批结果由采购方处理。"
          />
          {filteredSupplierQuotes.length === 0 ? (
            <EmptyState title="暂无报价记录" desc="收到询价邀请并提交报价后，报价历史和关联询价状态会显示在这里。" />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <div className="space-y-3">
                <SupplierQuoteHistorySummaryPanel
                  quotes={filteredSupplierQuotes}
                  opportunities={workspace.opportunities}
                />
                {displayedSupplierQuotes.map((quote) => {
                  const rfq = workspace.opportunities.find((rfq) => rfq.id === quote.rfqId);
                  return (
                    <SupplierQuoteHistoryCard
                      key={quote.id}
                      quote={quote}
                      rfq={rfq}
                      selected={selectedSupplierQuoteId === quote.id}
                      onSelectDetail={() => setSelectedSupplierQuoteId(quote.id)}
                    />
                  );
                })}
              </div>
              <SupplierQuoteDetailPanel
                quote={selectedSupplierQuoteDetail}
                rfq={selectedSupplierQuoteRfq}
                javaEnabled={javaEnabled}
                quoteUpdateDraft={selectedSupplierQuoteDetail ? getQuoteUpdateDraft(selectedSupplierQuoteDetail) : undefined}
                supplierActionBusyId={supplierActionBusyId}
                onChangeQuoteUpdateDraft={(quoteId, draft) => setQuoteUpdateDrafts((current) => ({ ...current, [quoteId]: draft }))}
                onUpdateQuote={onUpdateQuote}
              />
            </div>
          )}
        </Panel>
      )}

      {activeModule === 'profile' && (
      <Panel title="供应商企业档案" icon={BadgeCheck}>
        <div className="space-y-4">
          <SupplierProfileSummaryPanel workspace={workspace} />
          <AttachmentCenterEntryPanel
            title="资质附件中心"
            ownerType="供应商资质"
            ownerId={workspace.supplier.id}
            visibility="supplier_shared"
            desc="登记营业执照、授权代理证书和服务能力证明的附件元数据，供供应商自维护和采购方准入参考。"
            attachmentNames={[
              '营业执照.pdf',
              workspace.supplier.verified ? '授权代理资质.pdf' : '资质材料待补充',
            ]}
          />
          <SupplierProfileMaintenancePanel
            workspace={workspace}
            javaEnabled={javaEnabled}
            supplierProfileBusy={supplierProfileBusy}
            supplierQualificationBusy={supplierQualificationBusy}
            onUpdateSupplierProfile={onUpdateSupplierProfile}
            onCreateSupplierQualification={onCreateSupplierQualification}
          />
          <div className="grid gap-3 lg:grid-cols-2">
            <SupplierProfileCapabilityCard
              title="企业档案卡片"
              icon={Building2}
              facts={[
                { label: '企业名称', value: workspace.supplier.name },
                { label: '所属行业', value: workspace.supplier.industry },
                { label: '认证状态', value: workspace.supplier.verified ? '已认证' : '待认证' },
                { label: '合作采购方', value: `${workspace.connectedBuyerNames.length} 家` },
              ]}
            />
            <SupplierProfileCapabilityCard
              title="协同能力卡片"
              icon={BadgeCheck}
              facts={[
                { label: '资质维护', value: workspace.supplier.verified ? '资料有效' : '待补充' },
                { label: '联系人与子账号', value: '待接入管理' },
                { label: '询价邀请', value: `${workspace.opportunities.length} 个` },
                { label: '销售订单', value: `${workspace.orders.length} 单` },
              ]}
            />
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-black text-slate-700">档案维护范围</p>
            <div className="mt-3">
              <CapabilityList
                items={[
                  '企业认证、资质维护、联系人与子账号',
                  '接收不同采购方询价邀请并在线报价',
                  '确认销售订单、提交发货和发票信息',
                  '按采购方隔离报价历史、订单和应收记录',
                ]}
              />
            </div>
          </div>
        </div>
      </Panel>
      )}
    </div>
    )}

    {activeModule === 'orders' && (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="销售订单与发货" icon={Truck}>
        <ListToolbar
          title="销售订单池"
          recordCount={workspace.orders.length}
          filterLabel="待处理优先"
          actionLabel="批量履约"
        />
        <StatusFilterControl
          label="销售订单状态"
          value={supplierOrderStatusFilter}
          statusOptions={supplierOrderStatusOptions}
          onChange={setSupplierOrderStatusFilter}
        />
        <FilterResultSummary
          label="销售订单筛选结果"
          filterLabel={supplierOrderStatusFilter}
          resultCount={filteredSupplierOrders.length}
          totalCount={workspace.orders.length}
          selectedLabel={selectedSupplierOrderId}
          onClear={() => setSupplierOrderStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="销售订单"
          selectedTitle={selectedSupplierOrderDetail?.id}
          selectedMeta={selectedSupplierOrderDetail?.tenantId}
          selectedStatus={selectedSupplierOrderDetail?.status}
          nextActionTitle={describeSupplierOrderNextAction(selectedSupplierOrderDetail, selectedSupplierOrderDelivery, selectedSupplierOrderInvoice)}
          detailHint="右侧详情会核对订单金额、确认状态、发货信息、发票应收和履约轨迹。"
          boundaryHint="供应商可确认订单、维护发货和提交发票，但不能登记采购方收货或付款结果。"
        />
        {filteredSupplierOrders.length === 0 ? (
          <EmptyState title="暂无销售订单" desc="采购方定标并生成订单后，供应商会在这里确认订单、提交发货和开票。" />
        ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-3">
            <SupplierOrderFulfillmentSummaryPanel
              orders={filteredSupplierOrders}
              invoices={workspace.invoices}
            />
            {displayedSupplierOrders.map((order) => {
              const confirmBusy = supplierActionBusyId === `confirm:${order.id}`;
              const deliveryBusy = supplierActionBusyId === `delivery:${order.id}`;
              const invoiceBusy = supplierActionBusyId === `invoice:${order.id}`;
              const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
              const invoice = workspace.invoices.find((item) => item.orderId === order.id);
              const deliveryDraft = deliveryDrafts[order.id] ?? { carrier: '顺丰速运', trackingNo: '' };
              const invoiceDraft = invoiceDrafts[order.id] ?? { amount: order.amount, invoiceNo: '' };
              const supplierOrderDemoHighlight = order.id === 'po-stage7-supplier-confirm-ready'
                || order.id === 'po-stage7-supplier-delivery-ready'
                || order.id === 'po-stage7-supplier-invoice-ready'
                ? {
                    label: '阶段七供应商订单履约样本',
                    testId: `stage9-demo-sample-supplier-order-${order.id}`,
                  }
                : undefined;
              return (
                <div
                  key={order.id}
                  className={`rounded-lg border p-4 transition ${
                    supplierOrderDemoHighlight ? 'border-sky-300 bg-sky-50' : 'bg-white'
                  } ${
                    selectedSupplierOrderId === order.id ? 'border-blue-200 ring-2 ring-blue-100' : supplierOrderDemoHighlight ? 'border-sky-300' : 'border-slate-200'
                  }`}
                >
                  <DemoSampleHighlightBadge demoHighlight={supplierOrderDemoHighlight} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-900">{order.id}</p>
                      <p className="mt-1 text-sm text-slate-500">采购方租户 {order.tenantId}</p>
                    </div>
                    <p className="font-mono font-black text-slate-900">{currency(order.amount)}</p>
                  </div>
                  <SupplierOrderActionSummaryPanel
                    order={order}
                    deliveryLabel={delivery ? `${delivery.carrier} ${delivery.trackingNo}` : '待发货'}
                    invoiceStatus={invoice ? invoice.paymentStatus : '待开票'}
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusPill label={order.status} />
                    <div className="flex flex-wrap justify-end gap-2">
                      <DetailToggleButton
                        selected={selectedSupplierOrderId === order.id}
                        onClick={() => setSelectedSupplierOrderId(order.id)}
                        compact
                      />
                      {javaEnabled && (
                        <>
                        {order.status === '待供应商确认' && (
                          <PrimaryActionButton
                            onClick={() => onConfirmOrder(order.id)}
                            disabled={confirmBusy}
                            busy={confirmBusy}
                            pendingLabel="确认中"
                            flushTop
                            testId={`stage7-supplier-confirm-order-${order.id}`}
                          >
                            确认订单
                          </PrimaryActionButton>
                        )}
                        {order.status === '待发货' && (
                          <span className="text-xs font-black text-emerald-700">填写发货信息</span>
                        )}
                        {order.status === '已收货' && !workspace.invoices.some((invoice) => invoice.orderId === order.id) && (
                          <span className="text-xs font-black text-amber-700">填写发票信息</span>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                  {javaEnabled && order.status === '待发货' && (
                    <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <label className="block">
                          <span className="text-xs font-black text-emerald-700">承运商</span>
                          <input
                            value={deliveryDraft.carrier}
                            onChange={(event) => setDeliveryDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...deliveryDraft,
                                carrier: event.target.value,
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-black text-emerald-700">物流单号</span>
                          <input
                            value={deliveryDraft.trackingNo}
                            onChange={(event) => setDeliveryDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...deliveryDraft,
                                trackingNo: event.target.value,
                              },
                            }))}
                            data-testid={`stage7-supplier-delivery-tracking-${order.id}`}
                            className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400"
                            placeholder="请输入物流单号"
                          />
                        </label>
                        <PrimaryActionButton
                          onClick={() => onCreateDelivery(order.id, deliveryDraft)}
                          disabled={deliveryBusy || !deliveryDraft.carrier.trim() || !deliveryDraft.trackingNo.trim()}
                          busy={deliveryBusy}
                          pendingLabel="提交中"
                          tone="emerald"
                          size="md"
                          flushTop
                          testId={`stage7-supplier-create-delivery-${order.id}`}
                        >
                          提交发货
                        </PrimaryActionButton>
                      </div>
                    </div>
                  )}
                  {javaEnabled && order.status === '已收货' && !workspace.invoices.some((invoice) => invoice.orderId === order.id) && (
                    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
                      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <label className="block">
                          <span className="text-xs font-black text-amber-700">发票号</span>
                          <input
                            value={invoiceDraft.invoiceNo}
                            onChange={(event) => setInvoiceDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...invoiceDraft,
                                invoiceNo: event.target.value,
                              },
                            }))}
                            data-testid={`stage7-supplier-invoice-no-${order.id}`}
                            className="mt-2 h-10 w-full rounded-lg border border-amber-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400"
                            placeholder="请输入发票号"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-black text-amber-700">发票金额</span>
                          <input
                            type="number"
                            min={1}
                            value={invoiceDraft.amount}
                            onChange={(event) => setInvoiceDrafts((current) => ({
                              ...current,
                              [order.id]: {
                                ...invoiceDraft,
                                amount: Number(event.target.value),
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg border border-amber-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-400"
                          />
                        </label>
                        <PrimaryActionButton
                          onClick={() => onCreateInvoice(order.id, invoiceDraft)}
                          disabled={invoiceBusy || !invoiceDraft.invoiceNo.trim() || invoiceDraft.amount <= 0}
                          busy={invoiceBusy}
                          pendingLabel="提交中"
                          tone="amber"
                          size="md"
                          flushTop
                          testId={`stage7-supplier-create-invoice-${order.id}`}
                        >
                          提交发票
                        </PrimaryActionButton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <SupplierOrderFulfillmentDetailPanel
            order={selectedSupplierOrderDetail}
            delivery={selectedSupplierOrderDelivery}
            invoice={selectedSupplierOrderInvoice}
            javaEnabled={javaEnabled}
            deliveryUpdateDraft={selectedSupplierOrderDelivery ? getDeliveryUpdateDraft(selectedSupplierOrderDelivery) : undefined}
            supplierActionBusyId={supplierActionBusyId}
            onChangeDeliveryUpdateDraft={(deliveryId, draft) => setDeliveryUpdateDrafts((current) => ({ ...current, [deliveryId]: draft }))}
            onUpdateDelivery={onUpdateDelivery}
          />
        </div>
        )}
      </Panel>
    </div>
    )}

    {activeModule === 'invoices' && (
      <Panel title="发票与应收" icon={Receipt}>
        <ListToolbar
          title="发票应收池"
          recordCount={workspace.invoices.length}
          filterLabel="待回款优先"
          actionLabel="对账处理"
        />
        <StatusFilterControl
          label="应收状态"
          value={supplierInvoiceStatusFilter}
          statusOptions={supplierInvoiceStatusOptions}
          onChange={setSupplierInvoiceStatusFilter}
        />
        <FilterResultSummary
          label="发票应收筛选结果"
          filterLabel={supplierInvoiceStatusFilter}
          resultCount={filteredSupplierInvoices.length}
          totalCount={workspace.invoices.length}
          selectedLabel={selectedSupplierInvoiceId}
          onClear={() => setSupplierInvoiceStatusFilter('全部状态')}
        />
        <SelectedBusinessHandoffPanel
          moduleLabel="发票应收"
          selectedTitle={selectedSupplierInvoiceDetail?.invoiceNo ?? selectedSupplierInvoiceDetail?.id}
          selectedMeta={selectedSupplierInvoiceDetail?.orderId}
          selectedStatus={selectedSupplierInvoiceDetail?.paymentStatus}
          nextActionTitle={describeSupplierInvoiceNextAction(selectedSupplierInvoiceDetail)}
          detailHint="右侧详情会核对应收金额、对账备注、逾期提醒、付款状态和关联销售订单。"
          boundaryHint="供应商可维护应收对账备注，付款登记和付款状态仍由采购方侧驱动。"
        />
        {filteredSupplierInvoices.length === 0 ? (
          <EmptyState title="暂无应收发票" desc="订单收货后提交发票，应收和付款状态会显示在这里。" />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="space-y-4">
              <ReconciliationLedgerPanel
                title="应收对账单台账"
                invoices={workspace.invoices}
                statusFilter={reconciliationLedgerStatusFilter}
                onChangeStatusFilter={setReconciliationLedgerStatusFilter}
                scope="supplier"
              />
              <SupplierInvoiceReceivableSummaryPanel invoices={filteredSupplierInvoices} />
              <div className="space-y-3">
                {displayedSupplierInvoices.map((invoice) => {
                  const order = workspace.orders.find((order) => order.id === invoice.orderId);
                  return (
                    <SupplierInvoiceReceivableCard
                      key={invoice.id}
                      invoice={invoice}
                      order={order}
                      selected={selectedSupplierInvoiceId === invoice.id}
                      demoHighlight={invoice.id === 'inv-stage7-supplier-receivable-ready'
                        ? {
                            label: '阶段七供应商应收备注样本',
                            testId: `stage9-demo-sample-supplier-receivable-${invoice.id}`,
                          }
                        : undefined}
                      onSelectDetail={() => setSelectedSupplierInvoiceId(invoice.id)}
                    />
                  );
                })}
              </div>
            </div>
            <SupplierInvoiceReceivableDetailPanel
              invoice={selectedSupplierInvoiceDetail}
              order={selectedSupplierInvoiceOrder}
              javaEnabled={javaEnabled}
              receivableUpdateDraft={selectedSupplierInvoiceDetail ? getReceivableUpdateDraft(selectedSupplierInvoiceDetail) : undefined}
              supplierActionBusyId={supplierActionBusyId}
              onChangeReceivableUpdateDraft={(invoiceId, draft) => setReceivableUpdateDrafts((current) => ({ ...current, [invoiceId]: draft }))}
              onUpdateReceivable={onUpdateReceivable}
            />
          </div>
        )}
      </Panel>
    )}
    </>
  );
};

const SupplierProfileSummaryPanel: React.FC<{
  workspace: SupplierWorkspace;
}> = ({ workspace }) => {
  const receivableCount = workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款').length;
  const deliveryCount = workspace.deliveries.length;
  const nextAction = workspace.supplier.verified ? '维护资质与联系人' : '补充认证资料';

  return (
    <section className="rounded-lg border border-orange-100 bg-orange-50 p-4">
      <p className="text-xs font-black text-orange-800">供应商档案摘要</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="认证状态" value={workspace.supplier.verified ? '已认证' : '待认证'} />
        <MiniFact label="合作采购方" value={`${workspace.connectedBuyerNames.length} 家`} />
        <MiniFact label="报价记录" value={`${workspace.quotes.length} 条`} />
        <MiniFact label="发货记录" value={`${deliveryCount} 条`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
      <p className="mt-3 text-xs font-bold text-orange-700">
        当前还有 {receivableCount} 张待回款发票，档案与资质信息会影响采购方准入和后续合作评价。
      </p>
    </section>
  );
};

const SupplierProfileCapabilityCard: React.FC<{
  title: string;
  icon: LucideIcon;
  facts: Array<{ label: string; value: string }>;
}> = ({ title, icon: Icon, facts }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-black text-slate-900">{title}</p>
        <p className="mt-1 text-xs font-bold text-slate-500">企业档案、资质、联系人与多采购方协同信息。</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {facts.map((fact) => (
        <MiniFact key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </div>
  </div>
);

const SupplierProfileMaintenancePanel: React.FC<{
  workspace: SupplierWorkspace;
  javaEnabled: boolean;
  supplierProfileBusy: boolean;
  supplierQualificationBusy: boolean;
  onUpdateSupplierProfile: (draft: SupplierProfileDraft) => void;
  onCreateSupplierQualification: (draft: SupplierQualificationDraft) => void;
}> = ({
  workspace,
  javaEnabled,
  supplierProfileBusy,
  supplierQualificationBusy,
  onUpdateSupplierProfile,
  onCreateSupplierQualification,
}) => {
  const [profileDraft, setProfileDraft] = useState<SupplierProfileDraft>({
    name: workspace.supplier.name,
    industry: workspace.supplier.industry,
    creditCode: workspace.supplier.creditCode ?? '91310000MA1K000001',
    legalPerson: workspace.supplier.legalPerson ?? workspace.orders[0]?.supplierName ?? workspace.supplier.name,
  });
  const [qualificationDraft, setQualificationDraft] = useState<SupplierQualificationDraft>({
    qualificationType: '营业执照',
    certificateNo: '',
    expiresAt: '2027-12-31',
    fileName: '营业执照.pdf',
    storageKey: 'supplier/qualifications/business-license.pdf',
  });
  const authorizedCategories = Array.from(new Set(
    workspace.opportunities.flatMap((rfq) => rfq.demandIds.length > 0 ? rfq.demandIds : ['通用采购']),
  )).slice(0, 3);
  const qualifications = workspace.qualifications ?? [];
  const profileInvalid = !profileDraft.name.trim()
    || !profileDraft.industry.trim()
    || !profileDraft.creditCode.trim()
    || !profileDraft.legalPerson.trim();
  const qualificationInvalid = !qualificationDraft.qualificationType.trim()
    || !qualificationDraft.fileName.trim()
    || !qualificationDraft.storageKey.trim();

  useEffect(() => {
    setProfileDraft({
      name: workspace.supplier.name,
      industry: workspace.supplier.industry,
      creditCode: workspace.supplier.creditCode ?? '91310000MA1K000001',
      legalPerson: workspace.supplier.legalPerson ?? workspace.orders[0]?.supplierName ?? workspace.supplier.name,
    });
  }, [
    workspace.supplier.name,
    workspace.supplier.industry,
    workspace.supplier.creditCode,
    workspace.supplier.legalPerson,
    workspace.orders,
  ]);

  const updateDraft = (patch: Partial<SupplierProfileDraft>) => {
    setProfileDraft((current) => ({ ...current, ...patch }));
  };
  const updateQualificationDraft = (patch: Partial<SupplierQualificationDraft>) => {
    setQualificationDraft((current) => ({ ...current, ...patch }));
  };

  return (
    <section className="rounded-lg border border-orange-100 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-orange-700">档案维护入口</p>
          <h3 className="mt-1 text-base font-black text-slate-950">企业档案草稿</h3>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
            {javaEnabled
              ? 'Java 模式下可调用 POST /api/v1/supplier/profile 保存企业档案。'
              : 'Mock 模式先保留页面草稿和上传入口，后续切换 Java 模式联调保存。'}
          </p>
        </div>
        <StatusPill label={workspace.supplier.profileStatus ?? (workspace.supplier.verified ? '资料有效' : '待补充资料')} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-black text-slate-600">企业名称</span>
          <input
            value={profileDraft.name}
            onChange={(event) => updateDraft({ name: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-black text-slate-600">所属行业</span>
          <input
            value={profileDraft.industry}
            onChange={(event) => updateDraft({ industry: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-black text-slate-600">统一社会信用代码</span>
          <input
            value={profileDraft.creditCode}
            onChange={(event) => updateDraft({ creditCode: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </label>
        <label className="block rounded-lg border border-slate-200 bg-slate-50 p-3">
          <span className="text-xs font-black text-slate-600">联系人维护</span>
          <input
            value={profileDraft.legalPerson}
            onChange={(event) => updateDraft({ legalPerson: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-black text-blue-700">授权品类</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(authorizedCategories.length > 0 ? authorizedCategories : ['通用采购']).map((category) => (
              <span key={category} className="rounded-lg bg-white px-3 py-2 text-xs font-black text-blue-700">
                {category}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-700">资质台账</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <MiniFact label="已登记资质" value={`${qualifications.length} 条`} />
            <MiniFact label="有效资质" value={`${qualifications.filter((item) => item.status === 'active').length} 条`} />
            <MiniFact label="最近文件" value={qualifications[0]?.fileName ?? '待登记'} />
            <MiniFact label="可见范围" value="供应商共享" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black text-amber-700">资质登记表单</p>
            <p className="mt-1 text-xs font-bold leading-5 text-amber-700">
              Java 模式提交到 POST /api/v1/supplier/qualifications，提交后刷新本企业资质台账。
            </p>
          </div>
          <StatusPill label={qualificationInvalid ? '待补齐' : '可提交'} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-5">
          <label className="block rounded-lg border border-amber-100 bg-white p-3">
            <span className="text-xs font-black text-slate-600">资质类型</span>
            <input
              value={qualificationDraft.qualificationType}
              onChange={(event) => updateQualificationDraft({ qualificationType: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block rounded-lg border border-amber-100 bg-white p-3">
            <span className="text-xs font-black text-slate-600">证书编号</span>
            <input
              value={qualificationDraft.certificateNo ?? ''}
              onChange={(event) => updateQualificationDraft({ certificateNo: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block rounded-lg border border-amber-100 bg-white p-3">
            <span className="text-xs font-black text-slate-600">到期日期</span>
            <input
              type="date"
              value={qualificationDraft.expiresAt ?? ''}
              onChange={(event) => updateQualificationDraft({ expiresAt: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block rounded-lg border border-amber-100 bg-white p-3">
            <span className="text-xs font-black text-slate-600">文件名</span>
            <input
              value={qualificationDraft.fileName}
              onChange={(event) => updateQualificationDraft({ fileName: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </label>
          <label className="block rounded-lg border border-amber-100 bg-white p-3">
            <span className="text-xs font-black text-slate-600">存储键</span>
            <input
              value={qualificationDraft.storageKey}
              onChange={(event) => updateQualificationDraft({ storageKey: event.target.value })}
              className="mt-2 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold leading-5 text-amber-700">
            资质记录会作为供应商企业档案的一部分，供采购方准入、询价邀请和后续绩效评价读取。
          </p>
          <PrimaryActionButton
            onClick={() => onCreateSupplierQualification({
              qualificationType: qualificationDraft.qualificationType.trim(),
              certificateNo: qualificationDraft.certificateNo?.trim(),
              expiresAt: qualificationDraft.expiresAt,
              fileName: qualificationDraft.fileName.trim(),
              storageKey: qualificationDraft.storageKey.trim(),
            })}
            disabled={!javaEnabled || supplierQualificationBusy || qualificationInvalid}
            busy={supplierQualificationBusy}
            pendingLabel="提交中"
            tone="amber"
            size="md"
            flushTop
          >
            提交资质
          </PrimaryActionButton>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {qualifications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-amber-200 bg-white p-3 text-xs font-bold text-amber-700">
              暂无资质记录，请先登记营业执照或授权代理证书。
            </p>
          ) : qualifications.slice(0, 6).map((qualification) => (
            <div key={qualification.id} className="rounded-lg border border-amber-100 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="break-words text-sm font-black text-slate-900">{qualification.qualificationType}</p>
                <StatusPill label={qualification.status} />
              </div>
              <p className="mt-1 break-words text-xs font-bold text-slate-500">{qualification.fileName}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <MiniFact label="证书编号" value={qualification.certificateNo || '未填写'} />
                <MiniFact label="到期日" value={qualification.expiresAt || '长期'} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <CapabilityList
          items={[
            '维护企业基础档案、联系人维护和授权品类',
            '登记营业执照、授权代理证书和服务能力证明附件元数据',
            '提交后供采购方准入、询价邀请和合作评价参考',
          ]}
        />
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold leading-5 text-slate-500">
            {javaEnabled
              ? '保存后会刷新供应商工作台，采购方准入和询价邀请将读取最新企业档案。'
              : 'Mock 模式可查看草稿结构，保存动作在 Java 模式启用。'}
          </p>
          <PrimaryActionButton
            onClick={() => onUpdateSupplierProfile({
              name: profileDraft.name.trim(),
              industry: profileDraft.industry.trim(),
              creditCode: profileDraft.creditCode.trim(),
              legalPerson: profileDraft.legalPerson.trim(),
            })}
            disabled={!javaEnabled || supplierProfileBusy || profileInvalid}
            busy={supplierProfileBusy}
            pendingLabel="保存中"
            size="md"
            flushTop
          >
            保存企业档案
          </PrimaryActionButton>
        </div>
      </div>
    </section>
  );
};

const SupplierActionLoopSummaryPanel: React.FC<{
  pendingQuoteCount: number;
  pendingConfirmCount: number;
  pendingDeliveryCount: number;
  invoiceReadyCount: number;
  pendingReceivableCount: number;
}> = ({
  pendingQuoteCount,
  pendingConfirmCount,
  pendingDeliveryCount,
  invoiceReadyCount,
  pendingReceivableCount,
}) => {
  const totalActionCount = pendingQuoteCount
    + pendingConfirmCount
    + pendingDeliveryCount
    + invoiceReadyCount
    + pendingReceivableCount;
  const nextAction = pendingQuoteCount > 0
    ? '优先处理询价报价'
    : pendingConfirmCount > 0
      ? '确认采购订单'
      : pendingDeliveryCount > 0
        ? '提交发货信息'
        : invoiceReadyCount > 0
          ? '提交发票信息'
          : pendingReceivableCount > 0
            ? '跟进回款状态'
            : '暂无待处理动作';

  return (
    <section className="rounded-lg border border-orange-100 bg-orange-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-orange-800">操作闭环摘要</p>
          <p className="mt-1 text-sm font-black text-slate-950">{nextAction}</p>
        </div>
        <StatusPill label={totalActionCount > 0 ? `${totalActionCount} 个待办` : '已清空'} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="待报价" value={`${pendingQuoteCount} 个`} />
        <MiniFact label="待确认" value={`${pendingConfirmCount} 单`} />
        <MiniFact label="待发货" value={`${pendingDeliveryCount} 单`} />
        <MiniFact label="可开票" value={`${invoiceReadyCount} 单`} />
        <MiniFact label="待回款" value={`${pendingReceivableCount} 张`} />
      </div>
    </section>
  );
};

const SupplierOpportunityResponseSummaryPanel: React.FC<{
  opportunities: SupplierWorkspace['opportunities'];
  supplierId: string;
}> = ({ opportunities, supplierId }) => {
  const activeOpportunities = opportunities.filter((rfq) => rfq.status === '报价中');
  const pendingQuoteCount = activeOpportunities.filter(
    (rfq) => !rfq.quotes.some((quote) => quote.supplierId === supplierId),
  ).length;
  const quotedCount = opportunities.filter((rfq) =>
    rfq.quotes.some((quote) => quote.supplierId === supplierId),
  ).length;
  const closestDeadline = activeOpportunities
    .map((rfq) => rfq.deadline)
    .sort((left, right) => left.localeCompare(right))[0] ?? '暂无';
  const nextAction = pendingQuoteCount > 0 ? '提交报价' : '等待定标';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-black text-blue-800">商机响应摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="邀请总数" value={`${opportunities.length} 个`} />
        <MiniFact label="待报价" value={`${pendingQuoteCount} 个`} />
        <MiniFact label="已报价" value={`${quotedCount} 个`} />
        <MiniFact label="最近截止" value={closestDeadline} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );
};

const SupplierOrderFulfillmentSummaryPanel: React.FC<{
  orders: SupplierWorkspace['orders'];
  invoices: SupplierWorkspace['invoices'];
}> = ({ orders, invoices }) => {
  const pendingConfirmCount = orders.filter((order) => order.status === '待供应商确认').length;
  const pendingDeliveryCount = orders.filter((order) => order.status === '待发货').length;
  const pendingInvoiceCount = orders.filter((order) =>
    order.status === '已收货' && !invoices.some((invoice) => invoice.orderId === order.id)
  ).length;
  const receivableAmount = invoices
    .filter((invoice) => invoice.paymentStatus !== '已付款')
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const nextAction = pendingConfirmCount > 0
    ? '确认订单'
    : pendingDeliveryCount > 0
      ? '提交发货'
      : pendingInvoiceCount > 0
        ? '提交发票'
        : receivableAmount > 0
          ? '跟进回款'
          : '归档履约';

  return (
    <div className="rounded-lg border border-orange-100 bg-orange-50 p-3">
      <p className="text-xs font-black text-orange-800">履约工作摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <MiniFact label="订单总数" value={`${orders.length} 单`} />
        <MiniFact label="待确认" value={`${pendingConfirmCount} 单`} />
        <MiniFact label="待发货" value={`${pendingDeliveryCount} 单`} />
        <MiniFact label="待开票" value={`${pendingInvoiceCount} 单`} />
        <MiniFact label="应收金额" value={currency(receivableAmount)} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );
};

const SupplierQuoteHistorySummaryPanel: React.FC<{
  quotes: SupplierWorkspace['quotes'];
  opportunities: SupplierWorkspace['opportunities'];
}> = ({ quotes, opportunities }) => {
  const submittedQuoteCount = quotes.filter((quote) => quote.status === '已提交').length;
  const quoteTotal = quotes.reduce((sum, quote) => sum + quote.amount, 0);
  const averageDeliveryDays = quotes.length === 0
    ? 0
    : Math.round(quotes.reduce((sum, quote) => sum + quote.deliveryDays, 0) / quotes.length);
  const waitingAwardCount = quotes.filter((quote) => {
    const rfq = opportunities.find((rfq) => rfq.id === quote.rfqId);
    return quote.status === '已提交' && (rfq?.status === '报价中' || rfq?.status === '已截标');
  }).length;
  const nextAction = waitingAwardCount > 0 ? '等待定标' : '跟进订单';

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-black text-blue-800">报价历史摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="报价总数" value={`${quotes.length} 条`} />
        <MiniFact label="已提交" value={`${submittedQuoteCount} 条`} />
        <MiniFact label="报价总额" value={currency(quoteTotal)} />
        <MiniFact label="平均交付" value={`${averageDeliveryDays} 天`} />
        <MiniFact label="等待定标" value={`${waitingAwardCount} 条`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );
};

const SupplierQuoteHistoryCard: React.FC<{
  quote: SupplierWorkspace['quotes'][number];
  rfq?: SupplierWorkspace['opportunities'][number];
  selected: boolean;
  onSelectDetail: () => void;
}> = ({ quote, rfq, selected, onSelectDetail }) => (
  <ReadonlyDetailCardSurface title={rfq?.title ?? quote.rfqId} selected={selected}>
    <DetailHeroCard
      eyebrow="报价记录"
      title={rfq?.title ?? `报价 ${quote.rfqId}`}
      meta={`关联询价 ${quote.rfqId} · ${rfq?.status ?? '未知状态'}`}
      status={quote.status}
      facts={[
        { label: '报价金额', value: currency(quote.amount) },
        { label: '税率', value: `${quote.taxRate}%` },
        { label: '交付周期', value: `${quote.deliveryDays} 天` },
        { label: '下一步', value: rfq?.status === '已定标' ? '查看订单' : '等待定标' },
      ]}
    />
    <DetailSelectionSurface
      title={rfq?.title ?? quote.rfqId}
      selected={selected}
      onSelectDetail={onSelectDetail}
    />
  </ReadonlyDetailCardSurface>
);

const SupplierQuoteDetailPanel: React.FC<{
  quote?: SupplierWorkspace['quotes'][number];
  rfq?: SupplierWorkspace['opportunities'][number];
  javaEnabled: boolean;
  quoteUpdateDraft?: SupplierQuoteDraft;
  supplierActionBusyId: string | null;
  onChangeQuoteUpdateDraft: (quoteId: string, draft: SupplierQuoteDraft) => void;
  onUpdateQuote: (quoteId: string, draft: SupplierQuoteDraft) => void;
}> = ({
  quote,
  rfq,
  javaEnabled,
  quoteUpdateDraft,
  supplierActionBusyId,
  onChangeQuoteUpdateDraft,
  onUpdateQuote,
}) => {
  if (!quote) {
    return (
      <Panel title="报价详情" icon={BarChart3}>
        <EmptyState title="暂无报价详情" desc="选择一条报价记录后，可查看关联询价、定标结果和下一步建议。" />
      </Panel>
    );
  }

  const awardLabel = rfq?.status === '已定标'
    ? quote.status === '已采纳' ? '已采纳' : '未采纳'
    : rfq?.status === '已截标'
      ? '等待定标'
      : '报价处理中';
  const nextAction = awardLabel === '已采纳'
    ? '查看订单履约'
    : awardLabel === '等待定标'
      ? '等待采购方定标'
      : '跟进询价状态';
  const quoteDeadlineOpen = Boolean(rfq?.deadline && new Date(rfq.deadline).getTime() > Date.now());
  const quoteReadonlyReason = quote.status !== '已提交' || rfq?.status !== '报价中'
    ? '报价已进入定标或归档状态，不能再修改。'
    : !quoteDeadlineOpen
      ? '询价已截止，报价不能再修改。'
      : '当前报价不在可修改状态，仅保留历史报价详情。';
  const canUpdateQuote = javaEnabled && quote.status === '已提交' && rfq?.status === '报价中' && quoteDeadlineOpen;
  const quoteUpdateBusy = supplierActionBusyId === `quote-update:${quote.id}`;
  const updateDraft = quoteUpdateDraft ?? {
    amount: quote.amount,
    taxRate: quote.taxRate,
    deliveryDays: quote.deliveryDays,
  };
  const updateInvalid = updateDraft.amount <= 0
    || updateDraft.taxRate <= 0
    || updateDraft.deliveryDays <= 0;

  return (
    <Panel title="报价详情" icon={BarChart3}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="报价详情"
          title={rfq?.title ?? `关联询价 ${quote.rfqId}`}
          meta={`报价 ${quote.id} · 关联询价 ${quote.rfqId}`}
          status={quote.status}
          facts={[
            { label: '报价金额', value: currency(quote.amount) },
            { label: '税率', value: `${quote.taxRate}%` },
            { label: '交付周期', value: `${quote.deliveryDays} 天` },
            { label: '下一步建议', value: nextAction },
          ]}
        />

        <DetailSection title="关联询价">
          <div className="space-y-2">
            <DetailKeyValueRow label="询价编号" value={quote.rfqId} />
            <DetailKeyValueRow label="询价状态" value={rfq?.status ?? '待同步'} />
            <DetailKeyValueRow label="报价截止" value={rfq?.deadline ?? '待同步'} />
            <DetailKeyValueRow label="邀请供应商" value={`${rfq?.invitedSupplierIds.length ?? 0} 家`} />
          </div>
        </DetailSection>

        <DetailSection title="定标结果">
          <div className="space-y-2">
            <DetailKeyValueRow label="当前结论" value={awardLabel} />
            <DetailKeyValueRow label="RFQ 状态" value={rfq?.status ?? '待同步'} />
            <DetailKeyValueRow label="下一步建议" value={nextAction} />
          </div>
        </DetailSection>

        <DetailActionPanel
          title="修改报价"
          desc={canUpdateQuote ? '报价仍在 RFQ 报价期内时可修改，保存后采购方比价页将读取最新报价。' : quoteReadonlyReason}
          status={canUpdateQuote ? '可修改' : '只读'}
          tone={canUpdateQuote ? 'blue' : 'slate'}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_120px_120px_auto] md:items-end">
            <label className="block">
              <span className="text-xs font-black">报价金额</span>
              <input
                type="number"
                min={1}
                value={updateDraft.amount}
                disabled={!canUpdateQuote || quoteUpdateBusy}
                onChange={(event) => onChangeQuoteUpdateDraft(quote.id, {
                  ...updateDraft,
                  amount: Number(event.target.value),
                })}
                className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black">税率</span>
              <input
                type="number"
                min={1}
                value={updateDraft.taxRate}
                disabled={!canUpdateQuote || quoteUpdateBusy}
                onChange={(event) => onChangeQuoteUpdateDraft(quote.id, {
                  ...updateDraft,
                  taxRate: Number(event.target.value),
                })}
                className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black">交付天数</span>
              <input
                type="number"
                min={1}
                value={updateDraft.deliveryDays}
                disabled={!canUpdateQuote || quoteUpdateBusy}
                onChange={(event) => onChangeQuoteUpdateDraft(quote.id, {
                  ...updateDraft,
                  deliveryDays: Number(event.target.value),
                })}
                className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <PrimaryActionButton
              onClick={() => onUpdateQuote(quote.id, updateDraft)}
              disabled={!canUpdateQuote || quoteUpdateBusy || updateInvalid}
              busy={quoteUpdateBusy}
              pendingLabel="保存中"
              flushTop
            >
              保存报价修改
            </PrimaryActionButton>
          </div>
        </DetailActionPanel>

        <AttachmentCenterEntryPanel
          title="报价附件"
          ownerType="供应商报价"
          ownerId={quote.id}
          visibility="buyer_supplier_shared"
          desc="登记报价清单、服务承诺和商务说明附件元数据，供采购方比价和供应商追溯使用。"
          attachmentNames={['报价清单.xlsx', '服务承诺.pdf']}
        />
      </div>
    </Panel>
  );
};

const SupplierOrderFulfillmentDetailPanel: React.FC<{
  order?: SupplierWorkspace['orders'][number];
  delivery?: SupplierWorkspace['deliveries'][number];
  invoice?: SupplierWorkspace['invoices'][number];
  javaEnabled: boolean;
  deliveryUpdateDraft?: SupplierDeliveryDraft;
  supplierActionBusyId: string | null;
  onChangeDeliveryUpdateDraft: (deliveryId: string, draft: SupplierDeliveryDraft) => void;
  onUpdateDelivery: (deliveryId: string, draft: SupplierDeliveryDraft) => void;
}> = ({
  order,
  delivery,
  invoice,
  javaEnabled,
  deliveryUpdateDraft,
  supplierActionBusyId,
  onChangeDeliveryUpdateDraft,
  onUpdateDelivery,
}) => {
  if (!order) {
    return (
      <Panel title="销售订单详情" icon={Truck}>
        <EmptyState title="暂无销售订单详情" desc="选择一张销售订单后，可查看发货详情、发票应收和履约轨迹。" />
      </Panel>
    );
  }

  const nextAction = order.status === '待供应商确认'
    ? '确认订单'
    : order.status === '待发货'
      ? '提交发货'
      : order.status === '已收货' && !invoice
        ? '提交发票'
        : invoice?.paymentStatus === '已付款'
          ? '归档履约'
          : '跟进回款';
  const canUpdateDelivery = javaEnabled && Boolean(delivery) && order.status === '已发货';
  const deliveryUpdateBusy = delivery ? supplierActionBusyId === `delivery-update:${delivery.id}` : false;
  const updateDraft = deliveryUpdateDraft ?? {
    carrier: delivery?.carrier ?? '',
    trackingNo: delivery?.trackingNo ?? '',
  };
  const updateInvalid = !updateDraft.carrier.trim() || !updateDraft.trackingNo.trim();

  return (
    <Panel title="销售订单详情" icon={Truck}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="销售订单详情"
          title={order.id}
          meta={`采购方租户 ${order.tenantId}`}
          status={order.status}
          facts={[
            { label: '订单金额', value: currency(order.amount) },
            { label: '预计收货', value: order.expectedReceiptDate },
            { label: '发票应收', value: invoice?.paymentStatus ?? '待开票' },
            { label: '下一步', value: nextAction },
          ]}
        />

        <DetailSection title="发货详情">
          <div className="space-y-2">
            <DetailKeyValueRow label="承运商" value={delivery?.carrier ?? '待发货'} />
            <DetailKeyValueRow label="物流单号" value={delivery?.trackingNo ?? '待登记'} />
            <DetailKeyValueRow label="发货时间" value={delivery?.createdAt ? formatAuditTime(delivery.createdAt) : '待登记'} />
            <DetailKeyValueRow label="物流状态" value={delivery?.trackingNo ? '已提交发货' : '等待供应商发货'} />
          </div>
        </DetailSection>

        <DetailActionPanel
          title="维护物流信息"
          desc={canUpdateDelivery ? '采购方收货前可修正承运商和物流单号，保存后采购方收货页会读取最新信息。' : '当前订单没有可维护的发货记录，或采购方已经完成收货。'}
          status={canUpdateDelivery ? '可维护' : '只读'}
          tone={canUpdateDelivery ? 'emerald' : 'slate'}
        >
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <label className="block">
              <span className="text-xs font-black">承运商</span>
              <input
                value={updateDraft.carrier}
                disabled={!canUpdateDelivery || deliveryUpdateBusy}
                onChange={(event) => delivery && onChangeDeliveryUpdateDraft(delivery.id, {
                  ...updateDraft,
                  carrier: event.target.value,
                })}
                className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black">物流单号</span>
              <input
                value={updateDraft.trackingNo}
                disabled={!canUpdateDelivery || deliveryUpdateBusy}
                onChange={(event) => delivery && onChangeDeliveryUpdateDraft(delivery.id, {
                  ...updateDraft,
                  trackingNo: event.target.value,
                })}
                className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-500"
              />
            </label>
            <PrimaryActionButton
              onClick={() => delivery && onUpdateDelivery(delivery.id, updateDraft)}
              disabled={!canUpdateDelivery || deliveryUpdateBusy || updateInvalid}
              busy={deliveryUpdateBusy}
              pendingLabel="保存中"
              tone="emerald"
              flushTop
            >
              保存物流信息
            </PrimaryActionButton>
          </div>
        </DetailActionPanel>

        <DetailSection title="发票应收">
          <div className="space-y-2">
            <DetailKeyValueRow label="发票编号" value={invoice?.invoiceNo ?? '待开票'} />
            <DetailKeyValueRow label="发票金额" value={invoice ? currency(invoice.amount) : '待开票'} />
            <DetailKeyValueRow label="付款状态" value={invoice?.paymentStatus ?? '待开票'} />
          </div>
        </DetailSection>

        <DetailSection title="履约轨迹">
          <div className="space-y-2">
            <DetailKeyValueRow label="订单状态" value={order.status} />
            <DetailKeyValueRow label="预计收货" value={order.expectedReceiptDate} />
            <DetailKeyValueRow label="下一步" value={nextAction} />
          </div>
        </DetailSection>
      </div>
    </Panel>
  );
};

const SupplierInvoiceReceivableSummaryPanel: React.FC<{
  invoices: SupplierWorkspace['invoices'];
}> = ({ invoices }) => {
  const receivableTotal = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const pendingReceivableTotal = invoices
    .filter((invoice) => invoice.paymentStatus !== '已付款')
    .reduce((sum, invoice) => sum + invoice.amount, 0);
  const paidTotal = receivableTotal - pendingReceivableTotal;
  const nextAction = pendingReceivableTotal > 0 ? '跟进回款' : '归档对账';

  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
      <p className="text-xs font-black text-amber-800">应收摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="应收总额" value={currency(receivableTotal)} />
        <MiniFact label="待回款" value={currency(pendingReceivableTotal)} />
        <MiniFact label="已回款" value={currency(paidTotal)} />
        <MiniFact label="发票数量" value={`${invoices.length} 张`} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );
};

const ReconciliationLedgerPanel: React.FC<{
  title: string;
  invoices: BuyerWorkspace['invoices'];
  paymentBatches?: PaymentBatchRecord[];
  paymentExecutionRecords?: PaymentExecutionRecord[];
  paymentBlockResolutions?: PaymentBlockResolutionRecord[];
  paymentArchiveExceptionRequests?: PaymentArchiveExceptionRequestRecord[];
  paymentRequests?: PaymentRequestRecord[];
  varianceHandlings?: VarianceHandlingRecord[];
  auditLogs?: AuditLogRecord[];
  statusFilter: string;
  onChangeStatusFilter: (status: string) => void;
  javaEnabled?: boolean;
  buyerFulfillmentBusyId?: string | null;
  onUpdatePaymentBatchStatus?: (paymentBatchNo: string, status: string) => void;
  onCreatePaymentArchiveExceptionRequest?: (paymentBatchNo: string, exceptionType: string, exceptionReason: string) => void;
  onCompletePaymentArchiveExceptionAction?: (requestId: string, actionResult: string) => void;
  onClosePaymentArchiveExceptionRequest?: (requestId: string, closureResult: string) => void;
  onUpdatePaymentRequestStatus?: (paymentRequestId: string, status: string) => void;
  onSavePaymentBlockResolutionStatus?: (payload: BuyerPaymentBlockResolutionDraft) => void;
  onUpdateVarianceHandlingStatus?: (varianceHandlingId: string, status: string) => void;
  onRebuildThreeWayMatches?: () => void;
  onRegisterPayment?: (invoiceId: string, draft: BuyerPaymentDraft) => void;
  onRegisterPaymentExecutionRecord?: (executionRecordId: string) => void;
  onSelectInvoiceForReview?: (invoiceId: string) => void;
  scope: 'buyer' | 'supplier';
}> = ({
  title,
  invoices,
  paymentBatches = [],
  paymentExecutionRecords = [],
  paymentBlockResolutions = [],
  paymentArchiveExceptionRequests = [],
  paymentRequests = [],
  varianceHandlings = [],
  auditLogs = [],
  statusFilter,
  onChangeStatusFilter,
  javaEnabled = false,
  buyerFulfillmentBusyId = null,
  onUpdatePaymentBatchStatus,
  onCreatePaymentArchiveExceptionRequest,
  onCompletePaymentArchiveExceptionAction,
  onClosePaymentArchiveExceptionRequest,
  onUpdatePaymentRequestStatus,
  onSavePaymentBlockResolutionStatus,
  onUpdateVarianceHandlingStatus,
  onRebuildThreeWayMatches,
  onRegisterPayment,
  onRegisterPaymentExecutionRecord,
  onSelectInvoiceForReview,
  scope,
}) => {
  const [paymentBatchRiskFilter, setPaymentBatchRiskFilter] = useState('全部批次');
  const [paymentBatchBlockReasonFilter, setPaymentBatchBlockReasonFilter] = useState('全部阻断原因');
  const [paymentBatchResolutionStageFilter, setPaymentBatchResolutionStageFilter] = useState('全部处理状态');
  const [selectedPaymentBatchNo, setSelectedPaymentBatchNo] = useState<string | null>(null);
  const [focusedPaymentRequestId, setFocusedPaymentRequestId] = useState<string | null>(null);
  const statusOptions = Array.from(new Set(invoices.map((invoice) => invoice.reconciliationStatus ?? '待同步')));
  const filteredInvoices = invoices.filter((invoice) => (
    statusFilter === '全部状态' || (invoice.reconciliationStatus ?? '待同步') === statusFilter
  ));
  const varianceHandlingByInvoice = new Map(varianceHandlings.map((handling) => [handling.invoiceId, handling]));
  const buildThreeWayMatchLabel = (invoice: BuyerWorkspace['invoices'][number]) => {
    const receiptStatus = invoice.receiptStatus ?? '待同步';
    if (receiptStatus.includes('待') || receiptStatus === '未收货') return '待收货核对';
    if (invoice.varianceAmount == null || invoice.orderAmount == null) return '待三单同步';
    if (Math.abs(invoice.varianceAmount) > 0) return '金额差异待处理';
    return '三单匹配通过';
  };
  const buildPaymentRequestReadinessLabel = (invoice: BuyerWorkspace['invoices'][number]) => {
    if (scope !== 'buyer') return '供应商跟进回款';
    if (invoice.paymentStatus === '已付款') return '付款已归档';
    if (Math.abs(invoice.varianceAmount ?? 0) > 0) {
      const handling = varianceHandlingByInvoice.get(invoice.id);
      return handling?.status === '已处理'
        ? '差异已处理，付款申请已恢复'
        : '差异未处理，付款申请被阻断';
    }
    return buildThreeWayMatchLabel(invoice) === '三单匹配通过'
      ? '可发起付款申请'
      : '等待三单匹配通过';
  };
  const invoiceTotal = filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
  const varianceTotal = filteredInvoices.reduce((sum, invoice) => sum + Math.abs(invoice.varianceAmount ?? 0), 0);
  const threeWayMatchPassCount = filteredInvoices.filter((invoice) => buildThreeWayMatchLabel(invoice) === '三单匹配通过').length;
  const pendingCount = filteredInvoices.length - threeWayMatchPassCount;
  const varianceHandlingCount = filteredInvoices.filter((invoice) => Math.abs(invoice.varianceAmount ?? 0) > 0).length;
  const varianceQueueCount = filteredInvoices.filter((invoice) => buildThreeWayMatchLabel(invoice) === '金额差异待处理').length;
  const paymentRequestBlockedCount = filteredInvoices.filter((invoice) => (
    buildPaymentRequestReadinessLabel(invoice) === '差异未处理，付款申请被阻断'
  )).length;
  const paymentRequestRestoredCount = filteredInvoices.filter((invoice) => (
    buildPaymentRequestReadinessLabel(invoice) === '差异已处理，付款申请已恢复'
  )).length;
  const paymentRequestReadyCount = filteredInvoices.filter((invoice) => (
    (buildThreeWayMatchLabel(invoice) === '三单匹配通过'
      || buildPaymentRequestReadinessLabel(invoice) === '差异已处理，付款申请已恢复')
    && invoice.paymentStatus !== '已付款'
  )).length;
  const overdueCount = filteredInvoices.filter((invoice) => invoice.overdue).length;
  const nextActionSummary = pendingCount > 0
    ? (scope === 'buyer' ? '优先处理付款和差异' : '优先跟进回款和差异')
    : '归档对账';
  const paymentPlanSummary = scope === 'buyer'
    ? (pendingCount > 0 ? '按付款申请批次登记付款' : '付款状态已归档')
    : (pendingCount > 0 ? '按采购方付款计划跟进回款' : '回款状态已归档');
  const roleLabel = scope === 'buyer' ? '应付' : '应收';
  const buildLedgerRiskLabel = (invoice: BuyerWorkspace['invoices'][number]) => {
    const paymentRequestReadinessLabel = buildPaymentRequestReadinessLabel(invoice);
    if (paymentRequestReadinessLabel === '差异未处理，付款申请被阻断'
        || paymentRequestReadinessLabel === '差异已处理，付款申请已恢复') {
      return paymentRequestReadinessLabel;
    }
    const threeWayMatchLabel = buildThreeWayMatchLabel(invoice);
    if (threeWayMatchLabel !== '三单匹配通过') return threeWayMatchLabel;
    if (Math.abs(invoice.varianceAmount ?? 0) > 0) return '需核对差异';
    if (invoice.overdue) return '已逾期';
    if ((invoice.reconciliationStatus ?? '待同步') !== '三单一致') return '按计划跟进';
    return '可归档';
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilPaymentDate = (dueDate: string) => {
    if (dueDate === '待排期') return null;
    const parsed = new Date(`${dueDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
  };
  const buildPaymentBatchScheduleRiskLabel = (dueDate: string, status: string) => {
    if (status === '已付款归档') return '已归档';
    const daysUntilDue = daysUntilPaymentDate(dueDate);
    if (daysUntilDue == null) return '待排期';
    if (daysUntilDue < 0) return `逾期 ${Math.abs(daysUntilDue)} 天`;
    if (daysUntilDue <= 7) return `7天内到期`;
    return '计划内';
  };
  const buildPaymentBatchRows = () => {
    const grouped = new Map<string, PaymentRequestRecord[]>();
    paymentRequests.forEach((request) => {
      const paymentBatchNo = request.paymentBatchNo || '未分配批次';
      grouped.set(paymentBatchNo, [...(grouped.get(paymentBatchNo) ?? []), request]);
    });
    return Array.from(grouped.entries()).map(([paymentBatchNo, requests]) => {
      const invoicesInBatch = requests
        .map((request) => invoices.find((invoice) => invoice.id === request.invoiceId))
        .filter((invoice): invoice is BuyerWorkspace['invoices'][number] => Boolean(invoice));
      const amount = requests.reduce((sum, request) => sum + request.amount, 0);
      const dueDate = invoicesInBatch
        .map((invoice) => invoice.dueDate)
        .filter((date): date is string => Boolean(date))
        .sort()[0] ?? '待排期';
      const allApproved = requests.every((request) => request.requestStatus === '付款申请已通过');
      const anyPending = requests.some((request) => request.requestStatus === '付款申请审批中');
      const status = allApproved ? '可安排付款' : anyPending ? '审批中' : '待提交审批';
      return {
        paymentBatchNo,
        amount,
        approvedAmount: allApproved ? amount : 0,
        registeredAmount: 0,
        pendingRegistrationAmount: 0,
        blockedRegistrationAmount: 0,
        registeredCount: 0,
        pendingRegistrationCount: 0,
        blockedRegistrationCount: 0,
        executionDecision: null,
        executionBlockSummary: '暂无后端阻断概览',
        invoiceCount: requests.length,
        dueDate,
        status,
        scheduleRiskLabel: buildPaymentBatchScheduleRiskLabel(dueDate, status),
      };
    });
  };
  const paymentBatchRows = scope === 'buyer'
    ? (paymentBatches.length > 0
      ? paymentBatches.map((batch) => {
        const dueDate = batch.plannedPaymentDate ?? '待排期';
        return {
          paymentBatchNo: batch.paymentBatchNo,
          amount: batch.totalAmount,
          approvedAmount: batch.approvedAmount,
          registeredAmount: batch.registeredAmount,
          pendingRegistrationAmount: batch.pendingRegistrationAmount,
          blockedRegistrationAmount: batch.blockedRegistrationAmount,
          registeredCount: batch.registeredCount,
          pendingRegistrationCount: batch.pendingRegistrationCount,
          blockedRegistrationCount: batch.blockedRegistrationCount,
          executionDecision: batch.executionDecision,
          executionBlockSummary: batch.executionBlockSummary,
          invoiceCount: batch.requestCount,
          dueDate,
          status: batch.batchStatus,
          scheduleRiskLabel: buildPaymentBatchScheduleRiskLabel(dueDate, batch.batchStatus),
        };
      })
      : buildPaymentBatchRows())
    : [];
  const paymentBatchTotalAmount = paymentBatchRows.reduce((sum, row) => sum + row.amount, 0);
  const paymentBatchExecutableAmount = paymentBatchRows
    .filter((row) => row.status === '可安排付款')
    .reduce((sum, row) => sum + row.approvedAmount, 0);
  const paymentBatchApprovalQueueCount = paymentBatchRows.filter((row) => row.status === '审批中').length;
  const paymentBatchPendingSubmissionCount = paymentBatchRows.filter((row) => row.status === '待提交审批').length;
  const paymentBatchArchivedCount = paymentBatchRows.filter((row) => row.status === '已付款归档').length;
  const paymentBatchOverdueCount = paymentBatchRows.filter((row) => row.scheduleRiskLabel.startsWith('逾期')).length;
  const paymentBatchDueSoonCount = paymentBatchRows.filter((row) => row.scheduleRiskLabel === '7天内到期').length;
  const paymentBatchEarliestDueDate = paymentBatchRows
    .map((row) => row.dueDate)
    .filter((date) => daysUntilPaymentDate(date) != null)
    .sort()[0] ?? '待排期';
  const paymentBatchScheduleRiskLabel = paymentBatchOverdueCount > 0
    ? `${paymentBatchOverdueCount} 个逾期`
    : paymentBatchDueSoonCount > 0
      ? `${paymentBatchDueSoonCount} 个7天内到期`
      : '暂无计划风险';
  const paymentBatchRiskFilterOptions = ['全部批次', '逾期优先', '7天内到期', '可执行批次', '审批中批次'];
  const paymentBatchBlockedExecutionRecords = paymentExecutionRecords.filter((record) => (
    record.executionStatus === '暂不可登记' || record.executionStatus === '付款审批中'
  ));
  const paymentBatchBlockReasonOptions = [
    '全部阻断原因',
    ...Array.from(new Set(paymentBatchBlockedExecutionRecords
      .map((record) => record.executionBlockReason)
      .filter((reason): reason is string => Boolean(reason && !['付款申请已通过', '已登记付款'].includes(reason)))))
      .sort(),
  ];
  const describePaymentBatchBlockAction = (reason: string) => {
    if (reason === '差异未处理') {
      return {
        blockActionHint: '处理差异后恢复付款申请',
        blockActionTarget: '定位批次内发票，使用差异处理按钮标记已处理。',
      };
    }
    if (reason === '三单未同步') {
      return {
        blockActionHint: '先重建或同步三单匹配',
        blockActionTarget: '回到三单匹配台账重建快照，再刷新付款执行记录。',
      };
    }
    if (reason === '三单未通过') {
      return {
        blockActionHint: '先处理收货、订单或发票差异',
        blockActionTarget: '定位批次内发票，核对收货、订单金额和发票金额。',
      };
    }
    if (reason === '付款申请审批中') {
      return {
        blockActionHint: '在批次内付款申请中推进审批',
        blockActionTarget: '定位批次详情，使用通过付款申请或批次审批动作。',
      };
    }
    if (reason === '付款申请未通过') {
      return {
        blockActionHint: '重新提交或调整付款申请',
        blockActionTarget: '定位批次内付款申请，补齐资料后重新提交审批。',
      };
    }
    return {
      blockActionHint: '定位后核对付款执行条件',
      blockActionTarget: '查看批次内付款申请、三单匹配和差异处理状态。',
    };
  };
  const paymentBatchAllBlockQueueRows = paymentBatchBlockedExecutionRecords
    .map((record) => {
      const request = paymentRequests.find((item) => item.id === record.paymentRequestId);
      const invoice = invoices.find((item) => item.id === record.invoiceId);
      const blockAction = describePaymentBatchBlockAction(record.executionBlockReason ?? '暂不可登记');
      return {
        paymentBatchNo: record.paymentBatchNo,
        invoiceId: record.invoiceId,
        requestId: record.paymentRequestId,
        amount: invoice?.amount ?? request?.amount ?? record.registeredAmount,
        paymentRegistrationStatus: record.executionStatus,
        executionBlockReason: record.executionBlockReason ?? '暂不可登记',
        executionTrace: record.executionTrace,
        blockActionHint: blockAction.blockActionHint,
        blockActionTarget: blockAction.blockActionTarget,
      };
    });
  const distributionByReason = new Map<string, {
    reasonCount: number;
    reasonAmount: number;
    reasonBatches: Set<string>;
  }>();
  paymentBatchAllBlockQueueRows.forEach((row) => {
    const current = distributionByReason.get(row.executionBlockReason) ?? {
      reasonCount: 0,
      reasonAmount: 0,
      reasonBatches: new Set<string>(),
    };
    current.reasonCount += 1;
    current.reasonAmount += row.amount;
    current.reasonBatches.add(row.paymentBatchNo);
    distributionByReason.set(row.executionBlockReason, current);
  });
  const paymentBatchBlockReasonDistributionRows = Array.from(distributionByReason.entries())
    .map(([reason, summary]) => ({
      reason,
      reasonCount: summary.reasonCount,
      reasonAmount: summary.reasonAmount,
      reasonBatches: summary.reasonBatches.size,
    }))
    .sort((left, right) => (
      right.reasonAmount - left.reasonAmount
      || right.reasonCount - left.reasonCount
      || left.reason.localeCompare(right.reason)
    ));
  const paymentBatchBlockQueueRows = paymentBatchAllBlockQueueRows
    .filter((row) => (
      paymentBatchBlockReasonFilter === '全部阻断原因'
      || row.executionBlockReason === paymentBatchBlockReasonFilter
    ));
  const paymentBatchBlockedQueueAmount = paymentBatchBlockQueueRows.reduce((sum, row) => sum + row.amount, 0);
  const paymentBatchCurrentBlockReasonLabel = paymentBatchBlockReasonFilter === '全部阻断原因'
    ? '全部阻断原因'
    : paymentBatchBlockReasonFilter;
  const paymentBatchRiskRank = (row: (typeof paymentBatchRows)[number]) => {
    if (row.scheduleRiskLabel.startsWith('逾期')) return 0;
    if (row.scheduleRiskLabel === '7天内到期') return 1;
    if (row.status === '可安排付款') return 2;
    if (row.status === '审批中') return 3;
    if (row.status === '待提交审批') return 4;
    return 5;
  };
  const isPaymentBatchArchiveReady = (row: (typeof paymentBatchRows)[number]) => (
    row.executionDecision === '批次付款已登记'
    && row.registeredCount > 0
    && row.pendingRegistrationCount === 0
    && row.blockedRegistrationCount === 0
  );
  const canApprovePaymentBatch = (row: (typeof paymentBatchRows)[number]) => (
    row.invoiceCount > 0
    && row.amount > 0
    && row.approvedAmount >= row.amount
  );
  const describePaymentBatchArchiveGate = (row: (typeof paymentBatchRows)[number]) => (
    isPaymentBatchArchiveReady(row)
      ? '归档门禁：全部执行记录已登记后才可归档。'
      : '归档门禁：全部执行记录已登记后才可归档，当前仍需处理待登记或阻断记录。'
  );
  const filteredPaymentBatchRows = [...paymentBatchRows]
    .filter((row) => {
      if (paymentBatchRiskFilter === '逾期优先') return row.scheduleRiskLabel.startsWith('逾期');
      if (paymentBatchRiskFilter === '7天内到期') return row.scheduleRiskLabel === '7天内到期';
      if (paymentBatchRiskFilter === '可执行批次') return row.status === '可安排付款';
      if (paymentBatchRiskFilter === '审批中批次') return row.status === '审批中';
      return true;
    })
    .filter((row) => {
      if (paymentBatchBlockReasonFilter !== '全部阻断原因') {
        return row.executionBlockSummary?.includes(paymentBatchBlockReasonFilter);
      }
      return true;
    })
    .sort((left, right) => (
      paymentBatchRiskRank(left) - paymentBatchRiskRank(right)
      || left.dueDate.localeCompare(right.dueDate)
      || left.paymentBatchNo.localeCompare(right.paymentBatchNo)
    ));
  const selectedPaymentBatchRow = filteredPaymentBatchRows.find((row) => row.paymentBatchNo === selectedPaymentBatchNo)
    ?? filteredPaymentBatchRows[0]
    ?? paymentBatchRows.find((row) => row.paymentBatchNo === selectedPaymentBatchNo)
    ?? paymentBatchRows[0];
  const selectedPaymentBatchArchived = selectedPaymentBatchRow?.status === '已付款归档';
  const selectedPaymentBatchFreezeHint = selectedPaymentBatchArchived
    ? '批次已归档，后续仅允许查看审计追踪；付款申请、差异处理、执行登记和阻断处理写入均已冻结。'
    : '批次未归档，可按审批、差异处理和执行登记状态继续推进。';
  const selectedPaymentBatchArchiveAudit = selectedPaymentBatchRow
    ? auditLogs.find((log) => (
      log.targetType === 'payment_batch'
      && log.targetId === selectedPaymentBatchRow.paymentBatchNo
      && log.action.startsWith('payment_batch.archived')
    ))
    : null;
  const selectedPaymentBatchArchiveAuditSummary = selectedPaymentBatchArchiveAudit?.action
    .split('|')
    .slice(1)
    .join(' · ') || '待归档后生成归档前执行摘要';
  const selectedPaymentBatchArchiveExceptionRows = selectedPaymentBatchRow && selectedPaymentBatchArchived
    ? [
      {
        exceptionType: '撤销申请',
        approvalStatus: selectedPaymentBatchArchiveAudit ? '待提交审批' : '待归档后开放',
        exceptionReason: '归档后发现付款登记、发票或审计摘要异常时，先提交撤销申请进入审批台账。',
      },
      {
        exceptionType: '异常解冻',
        approvalStatus: '需平台/财务负责人审批',
        exceptionReason: '异常解冻只进入审批台账，不直接解冻或改写已归档批次。',
      },
    ]
    : [];
  const selectedPaymentBatchArchiveExceptionLedgerRows = selectedPaymentBatchRow
    ? paymentArchiveExceptionRequests
      .filter((request) => request.paymentBatchNo === selectedPaymentBatchRow.paymentBatchNo)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    : [];
  const selectedPaymentBatchRequests = selectedPaymentBatchRow
    ? paymentRequests.filter((request) => request.paymentBatchNo === selectedPaymentBatchRow.paymentBatchNo)
    : [];
  const selectedPaymentBatchInvoiceRows = selectedPaymentBatchRequests.map((request) => {
    const invoice = invoices.find((item) => item.id === request.invoiceId);
    const varianceHandling = varianceHandlings.find((item) => item.invoiceId === request.invoiceId);
    return {
      request,
      invoice,
      varianceHandling,
      threeWayMatchStatus: invoice ? buildThreeWayMatchLabel(invoice) : '发票未同步',
      varianceHandlingStatus: varianceHandling?.status ?? (invoice && Math.abs(invoice.varianceAmount ?? 0) > 0 ? '待生成差异处理' : '无差异处理'),
    };
  });
  const selectedPaymentBatchJavaExecutionRows = selectedPaymentBatchRow
    ? paymentExecutionRecords
      .filter((record) => record.paymentBatchNo === selectedPaymentBatchRow.paymentBatchNo)
      .map((record) => {
        const request = paymentRequests.find((item) => item.id === record.paymentRequestId);
        const invoice = invoices.find((item) => item.id === record.invoiceId);
        return {
          executionRecordId: record.id,
          invoiceId: record.invoiceId,
          requestId: record.paymentRequestId,
          supplierId: record.supplierId,
          amount: record.registeredAmount > 0 ? record.registeredAmount : invoice?.amount ?? request?.amount ?? 0,
          paymentRegistrationStatus: record.executionStatus,
          executionTrace: record.executionTrace,
          executionBlockReason: record.executionBlockReason,
          executionStage: record.executionStage,
          executionNextAction: record.executionNextAction,
          executionTraceSource: 'Java执行台账',
        };
      })
    : [];
  const selectedPaymentBatchDerivedExecutionRows = selectedPaymentBatchInvoiceRows.map(({ request, invoice, threeWayMatchStatus, varianceHandlingStatus }) => {
    const paymentRegistered = invoice?.paymentStatus === '已付款';
    const executable = request.requestStatus === '付款申请已通过'
      && threeWayMatchStatus === '三单匹配通过'
      && (varianceHandlingStatus === '无差异处理' || varianceHandlingStatus === '已处理');
    return {
      executionRecordId: request.id,
      invoiceId: request.invoiceId,
      requestId: request.id,
      supplierId: request.supplierId,
      amount: invoice?.amount ?? request.amount,
      paymentRegistrationStatus: paymentRegistered ? '已登记付款' : executable ? '待登记付款' : '暂不可登记',
      executionTrace: paymentRegistered
        ? '模拟执行轨迹：付款状态已归档。'
        : executable
          ? '模拟执行轨迹：可安排付款，等待付款登记。'
          : '模拟执行轨迹：等待审批、三单匹配或差异处理。',
      executionBlockReason: executable
        ? '付款申请已通过'
        : paymentRegistered
          ? '已登记付款'
          : request.requestStatus !== '付款申请已通过'
            ? '付款申请未通过'
            : threeWayMatchStatus !== '三单匹配通过'
              ? threeWayMatchStatus
              : varianceHandlingStatus !== '无差异处理' && varianceHandlingStatus !== '已处理'
                ? varianceHandlingStatus
                : '暂不可登记',
      executionStage: paymentRegistered ? '已登记待归档' : executable ? '可登记付款' : '阻断待处理',
      executionNextAction: paymentRegistered
        ? '刷新执行记录后归档审计'
        : executable
          ? '登记付款状态，真实支付仍不接入'
          : '按阻断原因处理后刷新执行复核',
      executionTraceSource: '前端派生轨迹',
    };
  });
  const selectedPaymentBatchExecutionRows = selectedPaymentBatchJavaExecutionRows.length > 0
    ? selectedPaymentBatchJavaExecutionRows
    : selectedPaymentBatchDerivedExecutionRows;
  const describePaymentExecutionRegistrationGate = (row: (typeof selectedPaymentBatchExecutionRows)[number]) => {
    if (row.paymentRegistrationStatus === '已登记付款') {
      return {
        registrationGateStatus: row.executionStage ?? '已完成付款登记',
        registrationReleaseDecision: '无需重复登记',
        registrationNextAction: row.executionNextAction ?? '归档审计轨迹',
        registrationPostActionHint: '已登记记录进入归档审计，回看付款执行记录和审计轨迹。',
      };
    }
    if (row.paymentRegistrationStatus === '待登记付款') {
      return {
        registrationGateStatus: row.executionStage ?? '付款申请、三单匹配和差异处理均已放行',
        registrationReleaseDecision: '可进入付款登记',
        registrationNextAction: row.executionNextAction ?? '登记付款状态，真实支付仍不接入',
        registrationPostActionHint: '登记后刷新执行记录，回看已登记金额和待登记金额。',
      };
    }
    return {
      registrationGateStatus: row.executionStage ?? row.executionBlockReason ?? '前置条件未满足',
      registrationReleaseDecision: '仍阻断付款登记',
      registrationNextAction: row.executionNextAction ?? '按阻断原因处理后刷新执行复核',
      registrationPostActionHint: '先处理阻断原因，登记后复核提示会在放行后出现。',
    };
  };
  const selectedPaymentBatchExecutionGateRows = selectedPaymentBatchExecutionRows.map((row) => ({
    ...row,
    ...describePaymentExecutionRegistrationGate(row),
  }));
  const buildPaymentExecutionRegistrationDraft = (row: (typeof selectedPaymentBatchExecutionGateRows)[number]): BuyerPaymentDraft => ({
    paymentStatus: '已付款',
    paymentRemark: `付款批次执行记录登记：${row.requestId}`,
    paymentRequestStatus: '付款申请已通过',
    reconciliationNote: '付款批次执行记录已放行，仅登记付款状态，不接真实支付。',
  });
  const canRegisterPaymentExecution = (registrationReleaseDecision: string) => (
    registrationReleaseDecision === '可进入付款登记'
  );
  const selectedPaymentBatchReasonExecutionRows = paymentBatchBlockReasonFilter !== '全部阻断原因'
    ? selectedPaymentBatchExecutionGateRows.filter((row) => row.executionBlockReason === paymentBatchBlockReasonFilter)
    : [];
  const selectedPaymentBatchReasonAmount = selectedPaymentBatchReasonExecutionRows
    .reduce((sum, row) => sum + row.amount, 0);
  const selectedPaymentBatchReasonCount = selectedPaymentBatchReasonExecutionRows.length;
  const selectedPaymentBatchReasonAction = describePaymentBatchBlockAction(paymentBatchBlockReasonFilter);
  const selectedPaymentBatchReasonResolutionStatus = selectedPaymentBatchReasonExecutionRows.length > 0
    ? '原因明细已定位，按处理路径推进后刷新执行记录。'
    : '当前批次暂无该原因记录，切换原因或查看完整执行记录。';
  const paymentBlockResolutionKey = (paymentBatchNo: string, paymentRequestId: string, blockReason: string) =>
    `${paymentBatchNo}::${paymentRequestId}::${blockReason}`;
  const paymentBlockResolutionByKey = new Map(paymentBlockResolutions.map((resolution) => [
    paymentBlockResolutionKey(
      resolution.paymentBatchNo,
      resolution.paymentRequestId ?? '',
      resolution.blockReason,
    ),
    resolution,
  ]));
  const findPaymentBlockResolutionForRow = (row: (typeof selectedPaymentBatchExecutionRows)[number]) =>
    paymentBlockResolutionByKey.get(paymentBlockResolutionKey(
      selectedPaymentBatchRow?.paymentBatchNo ?? row.requestId,
      row.requestId,
      row.executionBlockReason ?? '暂不可登记',
    ));
  const describePaymentBatchResolutionQueueStatus = (row: (typeof selectedPaymentBatchExecutionRows)[number]) => {
    const javaResolution = findPaymentBlockResolutionForRow(row);
    if (javaResolution) {
      return {
        blockResolutionId: javaResolution.id,
        blockResolutionStage: javaResolution?.resolutionStatus ?? '待处理',
        blockResolutionRefreshHint: javaResolution?.nextStep ?? '按 Java 处理台账记录推进后刷新执行记录。',
        blockResolutionAction: javaResolution?.resolutionAction ?? selectedPaymentBatchReasonAction.blockActionHint,
        blockResolutionNextStep: javaResolution?.nextStep ?? '刷新付款批次执行台账。',
        blockResolutionSource: 'Java处理台账',
        blockResolutionHandledBy: javaResolution?.handledBy ?? javaResolution?.createdBy ?? '待写入',
        blockResolutionUpdatedAt: javaResolution?.updatedAt ?? null,
      };
    }
    if (row.paymentRegistrationStatus === '付款审批中' || row.executionBlockReason === '付款申请审批中') {
      return {
        blockResolutionId: null,
        blockResolutionStage: '处理中',
        blockResolutionRefreshHint: '审批动作完成后刷新付款执行记录。',
        blockResolutionAction: '跟进审批进度',
        blockResolutionNextStep: '审批完成后刷新 Java 执行台账。',
        blockResolutionSource: '前端派生状态',
        blockResolutionHandledBy: '待写入',
        blockResolutionUpdatedAt: null,
      };
    }
    if (row.executionTrace.includes('已处理') || row.executionTrace.includes('已通过')) {
      return {
        blockResolutionId: null,
        blockResolutionStage: '已处理待刷新',
        blockResolutionRefreshHint: '处理动作已出现，刷新 Java 执行台账确认是否解除阻断。',
        blockResolutionAction: '刷新执行记录',
        blockResolutionNextStep: '确认阻断是否解除。',
        blockResolutionSource: '前端派生状态',
        blockResolutionHandledBy: '待写入',
        blockResolutionUpdatedAt: null,
      };
    }
    if (row.paymentRegistrationStatus === '暂不可登记') {
      return {
        blockResolutionId: null,
        blockResolutionStage: '待处理',
        blockResolutionRefreshHint: '按处理入口完成前置动作后再刷新执行记录。',
        blockResolutionAction: selectedPaymentBatchReasonAction.blockActionHint,
        blockResolutionNextStep: '完成前置处理后刷新执行记录。',
        blockResolutionSource: '前端派生状态',
        blockResolutionHandledBy: '待写入',
        blockResolutionUpdatedAt: null,
      };
    }
    return {
      blockResolutionId: null,
      blockResolutionStage: '仍阻断',
      blockResolutionRefreshHint: '当前记录仍未进入可登记付款状态，继续核对阻断原因。',
      blockResolutionAction: '继续核对阻断原因',
      blockResolutionNextStep: '核对三单匹配、差异处理和付款申请状态。',
      blockResolutionSource: '前端派生状态',
      blockResolutionHandledBy: '待写入',
      blockResolutionUpdatedAt: null,
    };
  };
  const selectedPaymentBatchReasonResolutionRows = selectedPaymentBatchReasonExecutionRows.map((row) => ({
    ...row,
    ...describePaymentBatchResolutionQueueStatus(row),
  }));
  const describePaymentBatchResolutionAction = (row: (typeof selectedPaymentBatchReasonResolutionRows)[number]) => {
    if (row.blockResolutionStage === '待处理') {
      return {
        resolutionActionLabel: '处理该阻断',
        resolutionActionTarget: selectedPaymentBatchReasonAction.blockActionTarget,
        resolutionActionBoundary: '只定位到前置处理动作，不自动修改付款登记或三单状态。',
      };
    }
    if (row.blockResolutionStage === '处理中') {
      return {
        resolutionActionLabel: '跟进审批进度',
        resolutionActionTarget: '定位批次内付款申请，等待审批动作完成后刷新。',
        resolutionActionBoundary: '仅提示审批跟进，不绕过审批流。',
      };
    }
    if (row.blockResolutionStage === '已处理待刷新') {
      return {
        resolutionActionLabel: '刷新执行记录',
        resolutionActionTarget: '刷新 Java 执行台账，确认阻断是否解除。',
        resolutionActionBoundary: '只刷新只读执行台账，不发起真实付款。',
      };
    }
    return {
      resolutionActionLabel: '保持观察',
      resolutionActionTarget: '继续核对阻断原因、三单匹配和差异处理状态。',
      resolutionActionBoundary: '仍阻断时不开放付款登记动作。',
    };
  };
  const selectedPaymentBatchReasonActionRows = selectedPaymentBatchReasonResolutionRows.map((row) => ({
    ...row,
    ...describePaymentBatchResolutionAction(row),
  }));
  const describePaymentBatchResolutionContext = (row: (typeof selectedPaymentBatchReasonActionRows)[number]) => {
    if (row.blockResolutionStage === '处理中') {
      return {
        resolutionContextPanel: '批次内付款申请',
        resolutionContextTargetNo: row.requestId,
        resolutionContextInvoiceNo: row.invoiceId,
        resolutionContextHint: '已定位到批次详情，优先查看付款申请审批状态和批次审批动作。',
      };
    }
    if (row.blockResolutionStage === '已处理待刷新') {
      return {
        resolutionContextPanel: '付款批次执行记录',
        resolutionContextTargetNo: row.requestId,
        resolutionContextInvoiceNo: row.invoiceId,
        resolutionContextHint: '已定位到批次详情，刷新执行记录后确认阻断是否解除。',
      };
    }
    if (row.blockResolutionStage === '仍阻断') {
      return {
        resolutionContextPanel: '付款执行边界',
        resolutionContextTargetNo: row.requestId,
        resolutionContextInvoiceNo: row.invoiceId,
        resolutionContextHint: '已定位到批次详情，继续核对三单匹配、差异处理和付款申请状态。',
      };
    }
    return {
      resolutionContextPanel: '批次内发票',
      resolutionContextTargetNo: row.requestId,
      resolutionContextInvoiceNo: row.invoiceId,
      resolutionContextHint: '已定位到批次详情，按发票查看差异处理、三单匹配和付款申请资料。',
    };
  };
  const selectedPaymentBatchReasonContextRows = selectedPaymentBatchReasonActionRows.map((row) => ({
    ...row,
    ...describePaymentBatchResolutionContext(row),
  }));
  const selectedPaymentBatchReasonResolutionStageSummary = ['待处理', '处理中', '已处理待刷新', '仍阻断']
    .map((stage) => `${stage} ${selectedPaymentBatchReasonResolutionRows.filter((row) => row.blockResolutionStage === stage).length}`)
    .join(' / ');
  const paymentBatchResolutionStageFilterOptions = ['全部处理状态', '待处理', '处理中', '已处理待刷新', '仍阻断'];
  const filteredPaymentBatchReasonResolutionRows = selectedPaymentBatchReasonContextRows.filter((row) => (
    paymentBatchResolutionStageFilter === '全部处理状态'
    || row.blockResolutionStage === paymentBatchResolutionStageFilter
  ));
  const selectedPaymentBatchResolutionLedgerRows = selectedPaymentBatchRow
    ? paymentBlockResolutions.filter((resolution) => resolution.paymentBatchNo === selectedPaymentBatchRow.paymentBatchNo)
      .sort((nextResolution, resolution) => resolution.updatedAt.localeCompare(nextResolution.updatedAt))
    : [];
  const selectedPaymentBatchResolvedBlockCount = selectedPaymentBatchResolutionLedgerRows
    .filter((resolution) => resolution.resolutionStatus === '已处理待刷新')
    .length;
  const selectedPaymentBatchProcessingBlockCount = selectedPaymentBatchResolutionLedgerRows
    .filter((resolution) => resolution.resolutionStatus === '处理中')
    .length;
  const selectedPaymentBatchDerivedRegisteredPaymentCount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '已登记付款')
    .length;
  const selectedPaymentBatchDerivedPendingRegistrationCount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '待登记付款')
    .length;
  const selectedPaymentBatchDerivedBlockedCount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '暂不可登记')
    .length;
  const selectedPaymentBatchDerivedRegisteredAmount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '已登记付款')
    .reduce((sum, row) => sum + row.amount, 0);
  const selectedPaymentBatchDerivedPendingRegistrationAmount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '待登记付款')
    .reduce((sum, row) => sum + row.amount, 0);
  const selectedPaymentBatchDerivedBlockedAmount = selectedPaymentBatchExecutionRows
    .filter((row) => row.paymentRegistrationStatus === '暂不可登记')
    .reduce((sum, row) => sum + row.amount, 0);
  const selectedPaymentBatchHasBackendExecutionSummary = Boolean(selectedPaymentBatchRow?.executionDecision);
  const selectedPaymentBatchRegisteredPaymentCount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.registeredCount
    : selectedPaymentBatchDerivedRegisteredPaymentCount;
  const selectedPaymentBatchPendingRegistrationCount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.pendingRegistrationCount
    : selectedPaymentBatchDerivedPendingRegistrationCount;
  const selectedPaymentBatchBlockedCount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.blockedRegistrationCount
    : selectedPaymentBatchDerivedBlockedCount;
  const selectedPaymentBatchRegisteredAmount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.registeredAmount
    : selectedPaymentBatchDerivedRegisteredAmount;
  const selectedPaymentBatchPendingRegistrationAmount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.pendingRegistrationAmount
    : selectedPaymentBatchDerivedPendingRegistrationAmount;
  const selectedPaymentBatchBlockedAmount = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.blockedRegistrationAmount
    : selectedPaymentBatchDerivedBlockedAmount;
  const selectedPaymentBatchExecutionDecisionLabel = selectedPaymentBatchHasBackendExecutionSummary
    ? selectedPaymentBatchRow.executionDecision
    : selectedPaymentBatchExecutionRows.length === 0
    ? '暂无执行记录'
    : selectedPaymentBatchBlockedCount > 0
      ? '存在暂不可登记'
      : selectedPaymentBatchPendingRegistrationCount > 0
        ? '可继续登记付款'
        : '批次付款已登记';
  const selectedPaymentBatchBlockSummary = selectedPaymentBatchRow?.executionBlockSummary
    ?? '暂无后端阻断概览';
  const selectedPaymentBatchExecutionReviewLabel = selectedPaymentBatchResolvedBlockCount > 0
    ? `${selectedPaymentBatchResolvedBlockCount} 条阻断已处理待刷新，复核三单/差异/付款申请后再登记付款`
    : selectedPaymentBatchProcessingBlockCount > 0
      ? `${selectedPaymentBatchProcessingBlockCount} 条阻断处理中，等待处理完成后复核执行条件`
      : selectedPaymentBatchResolutionLedgerRows.length > 0
        ? '已有处理记录，按最新状态复核执行条件'
      : '暂无处理记录，按阻断原因先完成前置处理';
  const selectedPaymentBatchExecutionReviewBoundary = '处理记录只影响复核提示，不自动改写付款、三单或差异状态。';
  const selectedPaymentBatchRegistrationReviewSummary = selectedPaymentBatchExecutionRows.length === 0
    ? '暂无付款执行记录'
    : selectedPaymentBatchBlockedCount > 0
      ? `${selectedPaymentBatchBlockedCount} 笔暂不可登记，先处理暂不可登记阻断`
      : selectedPaymentBatchPendingRegistrationCount > 0
        ? `${selectedPaymentBatchPendingRegistrationCount} 笔待登记，继续登记待登记付款`
        : `${selectedPaymentBatchRegisteredPaymentCount} 笔已登记，刷新执行记录后归档审计`;
  const selectedPaymentBatchRegistrationReviewNextStep = selectedPaymentBatchBlockedCount > 0
    ? '先处理暂不可登记阻断'
    : selectedPaymentBatchPendingRegistrationCount > 0
      ? '继续登记待登记付款'
      : selectedPaymentBatchRegisteredPaymentCount > 0
        ? '刷新执行记录后归档审计'
        : '等待付款申请形成执行记录';
  const selectedPaymentBatchPendingVarianceRows = selectedPaymentBatchInvoiceRows.filter((row) => (
    row.varianceHandlingStatus !== '无差异处理' && row.varianceHandlingStatus !== '已处理'
  ));
  const selectedPaymentBatchPendingVarianceCount = selectedPaymentBatchPendingVarianceRows.length;
  const selectedPaymentBatchPendingPaymentRequestRows = selectedPaymentBatchRequests.filter((request) => (
    request.requestStatus !== '付款申请已通过'
  ));
  const selectedPaymentBatchPendingPaymentRequestCount = selectedPaymentBatchPendingPaymentRequestRows.length;
  const selectedPaymentBatchAllPaymentRequestsApproved = selectedPaymentBatchRequests.length > 0
    && selectedPaymentBatchPendingPaymentRequestCount === 0;
  const selectedPaymentBatchExecutionRefreshHint = selectedPaymentBatchAllPaymentRequestsApproved
    ? '付款申请均已通过，请刷新三单匹配和执行记录后再进入付款登记。'
    : '仍有付款申请待复核，先完成付款申请复核再刷新执行记录。';
  const selectedPaymentBatchExecutionRefreshActionDisabled = selectedPaymentBatchArchived
    || !selectedPaymentBatchAllPaymentRequestsApproved
    || buyerFulfillmentBusyId === 'three-way-rebuild';
  const selectedPaymentBatchExecutionRefreshActionLabel = '刷新执行复核';
  const selectedPaymentBatchExecutionRefreshActionStatus = selectedPaymentBatchAllPaymentRequestsApproved
    ? '可刷新执行复核'
    : '先完成付款申请复核';
  const advanceFocusedPaymentRequestAfterStatusChange = (paymentRequestId: string, status: string) => {
    if (!onUpdatePaymentRequestStatus) return;
    onUpdatePaymentRequestStatus(paymentRequestId, status);
    if (status === '付款申请已通过' && focusedPaymentRequestId === paymentRequestId) {
      const nextPendingRequest = selectedPaymentBatchPendingPaymentRequestRows.find((item) => item.id !== paymentRequestId);
      setFocusedPaymentRequestId(nextPendingRequest?.id ?? null);
      if (nextPendingRequest?.invoiceId && onSelectInvoiceForReview) {
        onSelectInvoiceForReview(nextPendingRequest.invoiceId);
      }
    }
  };
  const selectedPaymentBatchReviewActionRows = [
    {
      reviewAction: '三单匹配刷新',
      reviewStatus: selectedPaymentBatchInvoiceRows.some((row) => row.threeWayMatchStatus !== '三单匹配通过')
        ? '需刷新或复核'
        : '已通过',
      reviewEntry: '处理完成后刷新三单匹配快照，再回看付款执行记录。',
      reviewBoundary: '当前页先提示复核动作，不自动重建三单快照。',
      reviewTargetInvoiceId: null,
      reviewTargetPaymentRequestId: null,
      reviewTargetPaymentRequestInvoiceId: null,
    },
    {
      reviewAction: '差异处理复核',
      reviewStatus: selectedPaymentBatchPendingVarianceCount > 0
        ? `存在 ${selectedPaymentBatchPendingVarianceCount} 条待处理差异`
        : '暂无未处理差异',
      reviewEntry: '定位批次内发票，完成差异处理后刷新付款申请。',
      reviewBoundary: '差异处理按钮在批次内发票卡片中执行，本清单只做复核导航。',
      reviewTargetInvoiceId: selectedPaymentBatchPendingVarianceRows[0]?.request.invoiceId ?? null,
      reviewTargetPaymentRequestId: null,
      reviewTargetPaymentRequestInvoiceId: null,
    },
    {
      reviewAction: '付款申请复核',
      reviewStatus: selectedPaymentBatchPendingPaymentRequestCount > 0
        ? `存在 ${selectedPaymentBatchPendingPaymentRequestCount} 条待复核付款申请`
        : '申请均已通过',
      reviewEntry: '确认付款申请已通过后再登记付款。',
      reviewBoundary: '付款申请状态按钮在批次内付款申请卡片中执行，不直接登记真实支付。',
      reviewTargetInvoiceId: null,
      reviewTargetPaymentRequestId: selectedPaymentBatchPendingPaymentRequestRows[0]?.id ?? null,
      reviewTargetPaymentRequestInvoiceId: selectedPaymentBatchPendingPaymentRequestRows[0]?.invoiceId ?? null,
    },
  ];
  const selectedPaymentBatchExecutionSummary = selectedPaymentBatchExecutionRows.length === 0
    ? '暂无执行记录'
    : `${selectedPaymentBatchRegisteredPaymentCount} / ${selectedPaymentBatchExecutionRows.length} 已登记付款`;
  const ledgerMobileCards = (
    <div className="grid gap-3">
      {filteredInvoices.map((invoice) => (
        <ResponsiveSummaryCard
          key={invoice.id}
          ariaLabel={`${invoice.reconciliationNo ?? `REC-${invoice.id}`} 对账单摘要`}
          title={invoice.reconciliationNo ?? `REC-${invoice.id}`}
          meta={`对账单编号 ${invoice.reconciliationNo ?? `REC-${invoice.id}`} · 订单 ${invoice.orderId} · 发票 ${invoice.id}`}
          status={invoice.reconciliationStatus ?? '待同步'}
          facts={[
            { label: '订单金额', value: invoice.orderAmount == null ? '待同步' : currency(invoice.orderAmount) },
            { label: '发票金额', value: currency(invoice.amount) },
            { label: '差异金额', value: invoice.varianceAmount == null ? '待同步' : currency(invoice.varianceAmount) },
            { label: '收货状态', value: invoice.receiptStatus ?? '待同步' },
            { label: '三单匹配', value: buildThreeWayMatchLabel(invoice) },
            { label: '付款状态', value: invoice.paymentStatus },
            { label: '状态流转', value: invoice.reconciliationStage ?? '待同步' },
            { label: '下一步动作', value: invoice.nextReconciliationAction ?? '同步订单' },
            { label: '付款申请', value: buildPaymentRequestReadinessLabel(invoice) },
            { label: '逾期提醒', value: invoice.overdue ? `逾期 ${invoice.overdueDays ?? 0} 天` : (invoice.dueDate ?? '未逾期') },
            { label: '处理提示', value: buildLedgerRiskLabel(invoice) },
          ]}
        />
      ))}
    </div>
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {roleLabel}对账单台账 · {filteredInvoices.length} 张发票 · 待处理 {pendingCount} 张
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5 xl:w-[760px]">
          <MiniFact label={`${roleLabel}金额`} value={currency(invoiceTotal)} />
          <MiniFact label="差异金额" value={currency(varianceTotal)} />
          <MiniFact label="逾期提醒" value={overdueCount > 0 ? `${overdueCount} 张逾期` : '无逾期'} />
          <MiniFact label="三单匹配" value={`${threeWayMatchPassCount} 张通过`} />
          <MiniFact label="对账状态" value={pendingCount > 0 ? '待处理' : '三单一致'} />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniFact label="台账范围" value={`${filteredInvoices.length} / ${invoices.length} 张`} />
          <MiniFact label="下一步动作" value={nextActionSummary} />
          <MiniFact label="当前筛选" value={statusFilter} />
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <MiniFact label="差异处理队列" value={varianceQueueCount > 0 ? `${varianceQueueCount} 张待差异处理` : '暂无待差异处理'} />
          <MiniFact label="付款阻断" value={paymentRequestBlockedCount > 0 ? `${paymentRequestBlockedCount} 张被阻断` : '暂无阻断'} />
          <MiniFact label="已恢复申请" value={paymentRequestRestoredCount > 0 ? `${paymentRequestRestoredCount} 张已恢复` : '暂无恢复'} />
          <MiniFact label="付款申请队列" value={paymentRequestReadyCount > 0 ? `${paymentRequestReadyCount} 张可发起` : '暂无可发起'} />
          <MiniFact label="可付款批次" value={paymentRequestReadyCount > 0 ? '按到期日形成付款批次' : '等待三单匹配通过'} />
          <MiniFact label="台账边界" value="付款申请暂按发票维度派生，尚未落库为独立申请单。" />
        </div>
      </div>
      {scope === 'buyer' && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="付款批次台账" value={`${paymentBatchRows.length} 个批次`} />
            <MiniFact label="批次金额" value={currency(paymentBatchTotalAmount)} />
            <MiniFact label="批次状态" value={paymentBatchRows.some((row) => row.status === '审批中') ? '存在审批中批次' : '按申请状态推进'} />
            <MiniFact label="计划付款日" value={paymentBatchRows[0]?.dueDate ?? '待付款申请形成'} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="批次审批队列" value={paymentBatchApprovalQueueCount > 0 ? `${paymentBatchApprovalQueueCount} 个审批中` : '暂无审批中'} />
            <MiniFact label="可执行金额" value={currency(paymentBatchExecutableAmount)} />
            <MiniFact label="待提交批次" value={paymentBatchPendingSubmissionCount > 0 ? `${paymentBatchPendingSubmissionCount} 个待提交` : '暂无待提交'} />
            <MiniFact label="已归档批次" value={paymentBatchArchivedCount > 0 ? `${paymentBatchArchivedCount} 个已归档` : '暂无归档'} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MiniFact label="逾期批次" value={paymentBatchOverdueCount > 0 ? `${paymentBatchOverdueCount} 个逾期` : '暂无逾期'} />
            <MiniFact label="7天内到期" value={paymentBatchDueSoonCount > 0 ? `${paymentBatchDueSoonCount} 个到期` : '暂无临期'} />
            <MiniFact label="最早处理日" value={paymentBatchEarliestDueDate} />
            <MiniFact label="计划风险" value={paymentBatchScheduleRiskLabel} />
          </div>
          <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-2">
            <p className="text-xs font-black text-emerald-800">批次风险筛选</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {paymentBatchRiskFilterOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPaymentBatchRiskFilter(option)}
                  className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                    paymentBatchRiskFilter === option
                      ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-800 hover:border-emerald-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-amber-100 bg-white p-2">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black text-amber-800">阻断原因筛选</p>
                <p className="mt-1 text-xs font-bold text-slate-500">按付款执行记录定位卡住的批次和发票。</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:w-[480px]">
                <MiniFact label="阻断队列" value={`${paymentBatchBlockQueueRows.length} 条`} />
                <MiniFact label="阻断金额" value={currency(paymentBatchBlockedQueueAmount)} />
                <MiniFact label="当前阻断原因" value={paymentBatchCurrentBlockReasonLabel} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {paymentBatchBlockReasonOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPaymentBatchBlockReasonFilter(option)}
                  className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                    paymentBatchBlockReasonFilter === option
                      ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                      : 'border-amber-100 bg-amber-50 text-amber-800 hover:border-amber-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-2">
              <p className="text-xs font-black text-amber-800">阻断原因分布</p>
              {paymentBatchBlockReasonDistributionRows.length === 0 ? (
                <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                  暂无阻断原因分布；形成暂不可登记或付款审批中记录后会自动汇总。
                </p>
              ) : (
                <div className="mt-2 grid gap-2 lg:grid-cols-3">
                  {paymentBatchBlockReasonDistributionRows.map((row) => (
                    <button
                      key={row.reason}
                      type="button"
                      onClick={() => setPaymentBatchBlockReasonFilter(row.reason)}
                      className={`rounded-lg border p-2 text-left transition ${
                        paymentBatchBlockReasonFilter === row.reason
                          ? 'border-amber-500 bg-white shadow-sm'
                          : 'border-amber-100 bg-white hover:border-amber-300'
                      }`}
                    >
                      <p className="text-xs font-black text-amber-800">{row.reason}</p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                        <MiniFact label="阻断笔数" value={`${row.reasonCount} 笔`} />
                        <MiniFact label="阻断金额" value={currency(row.reasonAmount)} />
                        <MiniFact label="涉及批次" value={`${row.reasonBatches} 个`} />
                      </div>
                      <p className="mt-2 text-xs font-black text-amber-700">查看该原因</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-2">
              <p className="text-xs font-black text-amber-800">付款阻断队列</p>
              {paymentBatchBlockQueueRows.length === 0 ? (
                <p className="mt-2 text-xs font-bold leading-5 text-amber-700">
                  当前阻断原因下暂无付款执行记录；可切换为全部阻断原因查看完整队列。
                </p>
              ) : (
                <div className="mt-2 grid gap-2 lg:grid-cols-2">
                  {paymentBatchBlockQueueRows.map((row) => (
                    <div key={`${row.paymentBatchNo}-${row.requestId}-${row.invoiceId}`} className="rounded-lg border border-amber-100 bg-white p-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs font-black text-slate-900">{row.paymentBatchNo}</p>
                          <p className="mt-1 font-mono text-xs font-bold text-slate-500">{row.invoiceId}</p>
                        </div>
                        <StatusPill label={row.paymentRegistrationStatus} />
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <MiniFact label="阻断原因" value={row.executionBlockReason} />
                        <MiniFact label="执行金额" value={currency(row.amount)} />
                        <MiniFact label="付款申请" value={row.requestId} />
                        <MiniFact label="执行轨迹" value={row.executionTrace} />
                        <MiniFact label="处理建议" value={row.blockActionHint} />
                        <MiniFact label="处理入口" value={row.blockActionTarget} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentBatchNo(row.paymentBatchNo)}
                        className="mt-2 rounded-md border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-black text-amber-900 transition hover:border-amber-400"
                      >
                        定位后处理
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {paymentBatchRows.length === 0 ? (
            <p className="mt-2 text-xs font-bold leading-5 text-emerald-700">
              暂无付款批次台账；创建付款申请后会按付款批次号汇总展示。
            </p>
          ) : filteredPaymentBatchRows.length === 0 ? (
            <p className="mt-2 text-xs font-bold leading-5 text-emerald-700">
              当前筛选下暂无付款批次；切换为全部批次可查看完整付款计划。
            </p>
          ) : (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {filteredPaymentBatchRows.map((row) => (
                <div key={row.paymentBatchNo} className="rounded-lg border border-emerald-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-emerald-700">付款批次</p>
                      <p className="mt-1 text-sm font-black text-slate-950">{row.paymentBatchNo}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill status={row.status} />
                      <button
                        type="button"
                        onClick={() => setSelectedPaymentBatchNo(row.paymentBatchNo)}
                        className="rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-xs font-black text-emerald-800 transition hover:border-emerald-300"
                      >
                        选择批次
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <MiniFact label="批次金额" value={currency(row.amount)} />
                    <MiniFact label="发票数量" value={`${row.invoiceCount} 张`} />
                    <MiniFact label="计划付款日" value={row.dueDate} />
                  </div>
                  <div className="mt-2">
                    <MiniFact label="计划风险" value={row.scheduleRiskLabel} />
                  </div>
                  <div className="mt-2">
                    <MiniFact label="归档门禁" value={describePaymentBatchArchiveGate(row)} />
                  </div>
                  {javaEnabled && onUpdatePaymentBatchStatus && (
                    <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-2">
                      <p className="text-xs font-black text-emerald-800">批次级审批</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <PrimaryActionButton
                          onClick={() => onUpdatePaymentBatchStatus(row.paymentBatchNo, '审批中')}
                          disabled={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}` || row.status === '审批中'}
                          busy={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}`}
                          pendingLabel="提交中"
                        >
                          提交批次审批
                        </PrimaryActionButton>
                        <PrimaryActionButton
                          onClick={() => onUpdatePaymentBatchStatus(row.paymentBatchNo, '可安排付款')}
                          disabled={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}` || row.status === '可安排付款' || !canApprovePaymentBatch(row)}
                          busy={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}`}
                          pendingLabel="审批中"
                        >
                          通过批次审批
                        </PrimaryActionButton>
                        <PrimaryActionButton
                          onClick={() => onUpdatePaymentBatchStatus(row.paymentBatchNo, '已付款归档')}
                          disabled={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}` || row.status === '已付款归档' || !isPaymentBatchArchiveReady(row)}
                          busy={buyerFulfillmentBusyId === `payment-batch:${row.paymentBatchNo}`}
                          pendingLabel="归档中"
                        >
                          标记付款归档
                        </PrimaryActionButton>
                      </div>
                    </div>
                  )}
                  <p className="mt-2 text-xs font-bold leading-5 text-emerald-700">
                    执行准备：
                    {row.status === '可安排付款'
                      ? `已审批 ${currency(row.approvedAmount)}，可进入付款登记。`
                      : !canApprovePaymentBatch(row)
                        ? `付款申请未全部通过，已审批 ${currency(row.approvedAmount)} / 批次总额 ${currency(row.amount)}。`
                      : row.status === '审批中'
                        ? '等待付款申请审批通过后再安排付款。'
                        : row.status === '已付款归档'
                          ? '批次已归档，后续只做审计追踪。'
                          : '先提交付款申请审批，再进入执行队列。'}
                  </p>
                </div>
              ))}
            </div>
          )}
          {selectedPaymentBatchRow && (
            <div className="mt-3 rounded-lg border border-emerald-100 bg-white p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black text-emerald-700">付款批次详情</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{selectedPaymentBatchRow.paymentBatchNo}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    批次内付款申请 {selectedPaymentBatchRequests.length} 条 · 批次内发票 {selectedPaymentBatchInvoiceRows.length} 张
                  </p>
                </div>
                <StatusPill status={selectedPaymentBatchRow.status} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <MiniFact label="批次金额" value={currency(selectedPaymentBatchRow.amount)} />
                <MiniFact label="已审批金额" value={currency(selectedPaymentBatchRow.approvedAmount)} />
                <MiniFact label="计划付款日" value={selectedPaymentBatchRow.dueDate} />
                <MiniFact label="计划风险" value={selectedPaymentBatchRow.scheduleRiskLabel} />
              </div>
              <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-black text-emerald-800">归档审计摘要</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniFact label="归档人" value={selectedPaymentBatchArchiveAudit?.actorId ?? '待归档'} />
                  <MiniFact label="归档时间" value={selectedPaymentBatchArchiveAudit ? formatAuditTime(selectedPaymentBatchArchiveAudit.createdAt) : '待归档'} />
                  <MiniFact label="归档前执行摘要" value={selectedPaymentBatchArchiveAuditSummary} />
                  <MiniFact label="归档冻结边界" value={selectedPaymentBatchFreezeHint} />
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black text-slate-700">归档审计面板</p>
                    <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                      已归档批次集中查看归档动作、冻结反馈、付款登记摘要和处理记录入口。
                    </p>
                  </div>
                  <StatusPill label={selectedPaymentBatchArchived ? '只读审计' : '归档前复核'} />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniFact label="归档动作" value={selectedPaymentBatchArchiveAudit ? '已写入归档审计日志' : '待归档后生成审计日志'} />
                  <MiniFact label="冻结反馈" value={selectedPaymentBatchFreezeHint} />
                  <MiniFact label="付款登记摘要" value={selectedPaymentBatchRegistrationReviewSummary} />
                  <MiniFact label="处理记录入口" value={`${selectedPaymentBatchResolutionLedgerRows.length} 条处理记录可回看`} />
                  <MiniFact label="审计追踪入口" value={selectedPaymentBatchArchiveAudit ? selectedPaymentBatchArchiveAuditSummary : '归档后回看操作人、时间和执行摘要'} />
                  <MiniFact label="付款登记金额" value={currency(selectedPaymentBatchRegisteredAmount)} />
                  <MiniFact label="冻结操作范围" value="付款申请、差异处理、执行登记和阻断处理写入" />
                  <MiniFact label="真实支付边界" value="不接真实支付、银企直连或批量付款执行" />
                </div>
                <div className="mt-3 rounded-lg border border-amber-100 bg-white p-3">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-black text-amber-800">归档异常申请入口</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        归档异常只进入审批台账，不直接解冻或改写已归档批次。
                      </p>
                    </div>
                    <StatusPill label={selectedPaymentBatchArchived ? '可提交异常申请' : '归档后开放'} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    <MiniFact label="归档异常申请" value={`${selectedPaymentBatchArchiveExceptionRows.length} 类入口`} />
                    <MiniFact label="撤销申请" value={selectedPaymentBatchArchived ? '进入审批台账' : '归档后开放'} />
                    <MiniFact label="异常解冻" value="需审批后才允许后续处理" />
                    <MiniFact label="异常入口边界" value="仅登记申请，不改写已归档批次" />
                  </div>
                  {selectedPaymentBatchArchiveExceptionRows.length > 0 && (
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {selectedPaymentBatchArchiveExceptionRows.map((row) => (
                        <div key={row.exceptionType} className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-black text-amber-900">{row.exceptionType}</p>
                            <StatusPill label={row.approvalStatus} />
                          </div>
                          <p className="mt-2 text-xs font-bold leading-5 text-amber-800">{row.exceptionReason}</p>
                          <PrimaryActionButton
                            onClick={() => selectedPaymentBatchRow && onCreatePaymentArchiveExceptionRequest?.(
                              selectedPaymentBatchRow.paymentBatchNo,
                              row.exceptionType,
                              row.exceptionReason,
                            )}
                            disabled={!javaEnabled || !selectedPaymentBatchArchived || !onCreatePaymentArchiveExceptionRequest || buyerFulfillmentBusyId === `payment-archive-exception:${selectedPaymentBatchRow?.paymentBatchNo}:${row.exceptionType}`}
                            busy={buyerFulfillmentBusyId === `payment-archive-exception:${selectedPaymentBatchRow?.paymentBatchNo}:${row.exceptionType}`}
                            pendingLabel="提交中"
                            tone="amber"
                            fullWidth
                          >
                            {row.exceptionType === '撤销申请' ? '提交撤销申请' : '提交异常解冻'}
                          </PrimaryActionButton>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-black text-amber-900">归档异常申请台账</p>
                      <StatusPill label={`${selectedPaymentBatchArchiveExceptionLedgerRows.length} 条申请`} />
                    </div>
                    {selectedPaymentBatchArchiveExceptionLedgerRows.length === 0 ? (
                      <p className="mt-2 text-xs font-bold leading-5 text-amber-800">
                        当前批次暂无归档异常申请；提交后进入审批台账，不直接解冻或改写已归档批次。
                      </p>
                    ) : (
                      <div className="mt-2 grid gap-2 lg:grid-cols-2">
                        {selectedPaymentBatchArchiveExceptionLedgerRows.map((request) => (
                          <div key={request.id} className="rounded-lg border border-white bg-white p-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-black text-slate-900">{request.exceptionType}</p>
                              <StatusPill label={request.approvalStatus} />
                            </div>
                            <p className="mt-2 text-xs font-bold leading-5 text-slate-600">{request.exceptionReason}</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <MiniFact label="申请人" value={request.requestedBy} />
                              <MiniFact label="申请时间" value={formatAuditTime(request.createdAt)} />
                              <MiniFact label="受控处理状态" value={request.actionStatus} />
                              <MiniFact label="处理人" value={request.handledBy ?? '待登记'} />
                              <MiniFact label="处理结果" value={request.actionResult ?? '审批通过后登记受控处理动作'} />
                              <MiniFact label="关闭状态" value={request.closureStatus} />
                              <MiniFact label="关闭人" value={request.closedBy ?? '待复核关闭'} />
                              <MiniFact label="关闭结果" value={request.closureResult ?? '受控处理登记后复核关闭'} />
                            </div>
                            {request.approvalStatus === '已通过' && request.actionStatus !== '已登记受控处理' && (
                              <PrimaryActionButton
                                onClick={() => onCompletePaymentArchiveExceptionAction?.(
                                  request.id,
                                  `${request.exceptionType}已审批通过，登记受控处理动作；后续仍需专用流程执行，不直接解冻或改写已归档批次。`,
                                )}
                                disabled={!javaEnabled || !onCompletePaymentArchiveExceptionAction || buyerFulfillmentBusyId === `payment-archive-exception-action:${request.id}`}
                                busy={buyerFulfillmentBusyId === `payment-archive-exception-action:${request.id}`}
                                pendingLabel="登记中"
                                tone="amber"
                                fullWidth
                              >
                                登记受控处理
                              </PrimaryActionButton>
                            )}
                            {request.approvalStatus === '已通过' && request.actionStatus === '已登记受控处理' && request.closureStatus !== '已关闭' && (
                              <PrimaryActionButton
                                onClick={() => onClosePaymentArchiveExceptionRequest?.(
                                  request.id,
                                  `${request.exceptionType}受控处理已登记，关闭复核完成；后续如需解冻或撤销仍走专用流程，不直接改写已归档批次。`,
                                )}
                                disabled={!javaEnabled || !onClosePaymentArchiveExceptionRequest || buyerFulfillmentBusyId === `payment-archive-exception-closure:${request.id}`}
                                busy={buyerFulfillmentBusyId === `payment-archive-exception-closure:${request.id}`}
                                pendingLabel="关闭中"
                                tone="emerald"
                                fullWidth
                              >
                                关闭复核
                              </PrimaryActionButton>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
                  <MiniFact label="已登记金额" value={currency(selectedPaymentBatchRegisteredAmount)} />
                  <MiniFact label="待登记金额" value={currency(selectedPaymentBatchPendingRegistrationAmount)} />
                  <MiniFact label="暂不可登记金额" value={currency(selectedPaymentBatchBlockedAmount)} />
                  <MiniFact label="待登记笔数" value={`${selectedPaymentBatchPendingRegistrationCount} 笔`} />
                <MiniFact label="暂不可登记笔数" value={`${selectedPaymentBatchBlockedCount} 笔`} />
                <MiniFact label="执行判断" value={selectedPaymentBatchExecutionDecisionLabel} />
                <MiniFact label="阻断概览" value={selectedPaymentBatchBlockSummary} />
                <MiniFact label="执行复核提示" value={selectedPaymentBatchExecutionReviewLabel} />
                <MiniFact label="复核边界" value={selectedPaymentBatchExecutionReviewBoundary} />
                <MiniFact label="登记后复核摘要" value={selectedPaymentBatchRegistrationReviewSummary} />
                <MiniFact label="登记后下一步" value={selectedPaymentBatchRegistrationReviewNextStep} />
                <MiniFact label="执行记录刷新提示" value={selectedPaymentBatchExecutionRefreshHint} />
                <MiniFact label="执行刷新边界" value="真实支付仍不接入，刷新后仅复核付款登记条件。" />
              </div>
              {javaEnabled && onRebuildThreeWayMatches && (
                <div className="mt-3 rounded-lg border border-blue-100 bg-white p-2">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-xs font-black text-blue-900">执行复核刷新入口</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
                        {selectedPaymentBatchExecutionRefreshActionStatus} · {selectedPaymentBatchExecutionRefreshHint}
                      </p>
                    </div>
                    <PrimaryActionButton
                      onClick={() => onRebuildThreeWayMatches()}
                      disabled={selectedPaymentBatchExecutionRefreshActionDisabled}
                      busy={buyerFulfillmentBusyId === 'three-way-rebuild'}
                      pendingLabel="刷新中"
                      flushTop
                    >
                      {selectedPaymentBatchExecutionRefreshActionLabel}
                    </PrimaryActionButton>
                  </div>
                </div>
              )}
            </div>
              <DetailSection title="复核动作清单" countLabel={`${selectedPaymentBatchReviewActionRows.length} 项`}>
                <div className="grid gap-2 lg:grid-cols-3">
                  {selectedPaymentBatchReviewActionRows.map((row) => (
                    <div key={row.reviewAction} className="rounded-lg border border-blue-100 bg-blue-50 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-black text-blue-900">{row.reviewAction}</p>
                        <StatusPill label={row.reviewStatus} />
                      </div>
                      <div className="mt-2 grid gap-2">
                        <MiniFact label="复核入口" value={row.reviewEntry} />
                        <MiniFact label="复核边界" value={row.reviewBoundary} />
                        {row.reviewAction === '差异处理复核' && (
                          <MiniFact label="待处理差异数量" value={`${selectedPaymentBatchPendingVarianceCount} 条`} />
                        )}
                        {row.reviewAction === '付款申请复核' && (
                          <MiniFact label="待复核付款申请" value={`${selectedPaymentBatchPendingPaymentRequestCount} 条`} />
                        )}
                      </div>
                      {row.reviewAction === '三单匹配刷新' && javaEnabled && onRebuildThreeWayMatches && (
                          <PrimaryActionButton
                          onClick={() => onRebuildThreeWayMatches()}
                          disabled={selectedPaymentBatchArchived || buyerFulfillmentBusyId === 'three-way-rebuild'}
                          busy={buyerFulfillmentBusyId === 'three-way-rebuild'}
                          pendingLabel="刷新中"
                          fullWidth
                        >
                          刷新三单匹配
                        </PrimaryActionButton>
                      )}
                      {row.reviewAction === '差异处理复核' && row.reviewTargetInvoiceId && onSelectInvoiceForReview && (
                        <PrimaryActionButton
                          onClick={() => onSelectInvoiceForReview(row.reviewTargetInvoiceId)}
                          tone="amber"
                          fullWidth
                        >
                          定位待处理差异
                        </PrimaryActionButton>
                      )}
                      {row.reviewAction === '付款申请复核' && row.reviewTargetPaymentRequestInvoiceId && onSelectInvoiceForReview && (
                        <PrimaryActionButton
                          onClick={() => {
                            setFocusedPaymentRequestId(row.reviewTargetPaymentRequestId);
                            onSelectInvoiceForReview(row.reviewTargetPaymentRequestInvoiceId);
                          }}
                          tone="amber"
                          fullWidth
                        >
                          定位付款申请
                        </PrimaryActionButton>
                      )}
                    </div>
                  ))}
                </div>
              </DetailSection>
              {paymentBatchBlockReasonFilter !== '全部阻断原因' && (
                <DetailSection title="当前原因明细" countLabel={`${selectedPaymentBatchReasonCount} 条`}>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <MiniFact label="当前原因筛选" value={paymentBatchBlockReasonFilter} />
                    <MiniFact label="当前原因笔数" value={`${selectedPaymentBatchReasonCount} 笔`} />
                    <MiniFact label="当前原因金额" value={currency(selectedPaymentBatchReasonAmount)} />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <MiniFact label="当前处理状态" value={selectedPaymentBatchReasonResolutionStatus} />
                    <MiniFact label="处理路径" value={selectedPaymentBatchReasonAction.blockActionHint} />
                    <MiniFact label="处理入口" value={selectedPaymentBatchReasonAction.blockActionTarget} />
                    <MiniFact label="处理闭环边界" value="当前只是处理指引，不自动改写付款、三单或差异状态。" />
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <MiniFact label="处理队列状态" value={selectedPaymentBatchReasonCount > 0 ? '按阻断明细派生处理进度' : '暂无处理队列'} />
                    <MiniFact label="队列状态分布" value={selectedPaymentBatchReasonResolutionStageSummary} />
                  </div>
                  <div className="mt-2 rounded-lg border border-amber-100 bg-white p-2">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs font-black text-amber-800">处理状态筛选</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">按处理进度查看当前原因下的阻断明细。</p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 lg:w-[320px]">
                        <MiniFact label="当前处理筛选" value={paymentBatchResolutionStageFilter} />
                        <MiniFact label="筛选后记录" value={`${filteredPaymentBatchReasonResolutionRows.length} 条`} />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {paymentBatchResolutionStageFilterOptions.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setPaymentBatchResolutionStageFilter(option)}
                          className={`rounded-md border px-3 py-2 text-xs font-black transition ${
                            paymentBatchResolutionStageFilter === option
                              ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                              : 'border-amber-100 bg-amber-50 text-amber-800 hover:border-amber-300'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedPaymentBatchReasonExecutionRows.length === 0 ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      该批次当前原因下暂无执行记录；切换为全部阻断原因查看完整付款执行记录。
                    </p>
                  ) : filteredPaymentBatchReasonResolutionRows.length === 0 ? (
                    <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                      当前处理状态下暂无阻断明细；切换为全部处理状态查看完整处理队列。
                    </p>
                  ) : (
                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      {filteredPaymentBatchReasonResolutionRows.map((row) => (
                        <div key={`reason-${row.requestId}-${row.invoiceId}`} className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                          {(() => {
                            const resolutionBusyId = `payment-block-resolution:${row.requestId}:${row.executionBlockReason ?? '暂不可登记'}`;
                            const saveResolution = (resolutionDraft: {
                              resolutionStatus: string;
                              resolutionAction: string;
                              nextStep: string;
                            }) => {
                              if (!onSavePaymentBlockResolutionStatus) return;
                              onSavePaymentBlockResolutionStatus({
                              paymentBatchNo: selectedPaymentBatchRow.paymentBatchNo,
                              paymentRequestId: row.requestId,
                              invoiceId: row.invoiceId,
                              supplierId: row.supplierId,
                              blockReason: row.executionBlockReason ?? '暂不可登记',
                              resolutionStatus: resolutionDraft.resolutionStatus,
                              resolutionAction: resolutionDraft.resolutionAction,
                              nextStep: resolutionDraft.nextStep,
                              existingResolutionId: row.blockResolutionId,
                              });
                            };
                            const resolutionWriteDisabled = selectedPaymentBatchArchived || !javaEnabled
                              || !onSavePaymentBlockResolutionStatus
                              || buyerFulfillmentBusyId === resolutionBusyId;
                            return (
                              <>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-mono text-xs font-black text-amber-900">{row.invoiceId}</p>
                              <p className="mt-1 font-mono text-xs font-bold text-amber-700">{row.requestId}</p>
                            </div>
                            <StatusPill label={row.paymentRegistrationStatus} />
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <MiniFact label="阻断原因" value={row.executionBlockReason ?? '暂无阻断'} />
                            <MiniFact label="执行金额" value={currency(row.amount)} />
                            <MiniFact label="执行轨迹" value={row.executionTrace} />
                            <MiniFact label="执行记录来源" value={row.executionTraceSource} />
                            <MiniFact label="处理队列状态" value={row.blockResolutionStage} />
                            <MiniFact label="刷新提示" value={row.blockResolutionRefreshHint} />
                            <MiniFact label="处理来源" value={row.blockResolutionSource} />
                            <MiniFact label="最近处理人" value={row.blockResolutionHandledBy} />
                            <MiniFact label="处理时间" value={row.blockResolutionUpdatedAt ? formatAuditTime(row.blockResolutionUpdatedAt) : '待保存'} />
                            <MiniFact label="处理动作" value={row.blockResolutionAction} />
                            <MiniFact label="下一步" value={row.blockResolutionNextStep} />
                            <MiniFact label="下一步动作" value={row.resolutionActionLabel} />
                            <MiniFact label="定位入口" value={row.resolutionActionTarget} />
                            <MiniFact label="操作边界" value={row.resolutionActionBoundary} />
                          </div>
                          <div className="mt-2 rounded-lg border border-amber-100 bg-white p-2">
                            <p className="text-xs font-black text-amber-800">上下文定位</p>
                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                              <MiniFact label="目标分区" value={row.resolutionContextPanel} />
                              <MiniFact label="目标单号" value={row.resolutionContextTargetNo} />
                              <MiniFact label="关联发票" value={row.resolutionContextInvoiceNo} />
                              <MiniFact label="联动说明" value={row.resolutionContextHint} />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentBatchNo(selectedPaymentBatchRow.paymentBatchNo)}
                            className="mt-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:border-amber-400"
                          >
                            {row.resolutionActionLabel}
                          </button>
                          {javaEnabled && onSavePaymentBlockResolutionStatus && (
                            <div aria-label="付款阻断处理状态写入" className="mt-2 grid gap-2 sm:grid-cols-3">
                              <button
                                type="button"
                                disabled={resolutionWriteDisabled}
                                onClick={() => saveResolution({
                                  resolutionStatus: row.blockResolutionStage,
                                  resolutionAction: row.blockResolutionAction,
                                  nextStep: row.blockResolutionNextStep,
                                })}
                                className="rounded-md border border-amber-200 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:border-amber-400 disabled:bg-slate-100 disabled:text-slate-500"
                              >
                                保存处理状态
                              </button>
                              <button
                                type="button"
                                disabled={resolutionWriteDisabled}
                                onClick={() => saveResolution({
                                  resolutionStatus: '处理中',
                                  resolutionAction: '跟进付款阻断处理进度',
                                  nextStep: '处理动作完成后刷新付款执行记录。',
                                })}
                                className="rounded-md border border-blue-200 bg-white px-3 py-2 text-xs font-black text-blue-800 transition hover:border-blue-400 disabled:bg-slate-100 disabled:text-slate-500"
                              >
                                标记处理中
                              </button>
                              <button
                                type="button"
                                disabled={resolutionWriteDisabled}
                                onClick={() => saveResolution({
                                  resolutionStatus: '已处理待刷新',
                                  resolutionAction: '处理动作已完成，等待刷新执行记录',
                                  nextStep: '刷新 Java 执行台账确认阻断是否解除。',
                                })}
                                className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-800 transition hover:border-emerald-400 disabled:bg-slate-100 disabled:text-slate-500"
                              >
                                标记已处理待刷新
                              </button>
                            </div>
                          )}
                              </>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>
              )}
              <DetailSection title="处理记录台账" countLabel={`${selectedPaymentBatchResolutionLedgerRows.length} 条`}>
                {selectedPaymentBatchResolutionLedgerRows.length === 0 ? (
                  <p className="text-xs font-bold leading-5 text-slate-500">
                    暂无付款阻断处理记录；在当前原因处理队列中保存处理状态后会回填到这里。
                  </p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {selectedPaymentBatchResolutionLedgerRows.map((resolution) => (
                      <div key={resolution.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-mono text-xs font-black text-amber-900">{resolution.id}</p>
                            <p className="mt-1 font-mono text-xs font-bold text-amber-700">{resolution.paymentRequestId ?? '批次级记录'}</p>
                          </div>
                          <StatusPill label={resolution.resolutionStatus} />
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <MiniFact label="阻断原因" value={resolution.blockReason} />
                          <MiniFact label="处理状态" value={resolution.resolutionStatus} />
                          <MiniFact label="处理人" value={resolution.handledBy ?? resolution.createdBy ?? '待写入'} />
                          <MiniFact label="更新时间" value={formatAuditTime(resolution.updatedAt)} />
                          <MiniFact label="处理动作" value={resolution.resolutionAction} />
                          <MiniFact label="下一步" value={resolution.nextStep} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
              <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                <DetailSection title="批次内付款申请" countLabel={`${selectedPaymentBatchRequests.length} 条`}>
                  {selectedPaymentBatchRequests.length === 0 ? (
                    <p className="text-xs font-bold leading-5 text-slate-500">
                      暂无付款申请明细；当前批次来自 Java 批次汇总时，需继续回查付款申请列表补齐明细。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedPaymentBatchRequests.map((request) => (
                        <div
                          key={request.id}
                          className={`rounded-lg border p-2 ${
                            focusedPaymentRequestId === request.id
                              ? 'border-amber-400 bg-amber-50'
                              : 'border-slate-100 bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-mono text-xs font-black text-slate-800">{request.id}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {focusedPaymentRequestId === request.id && <StatusPill label="当前定位" />}
                              <StatusPill label={request.requestStatus} />
                            </div>
                          </div>
                          {focusedPaymentRequestId === request.id && (
                            <p className="mt-2 text-xs font-black text-amber-800">
                              待复核付款申请定位：请在此卡片推进提交或通过付款申请；通过后定位已推进到下一条待复核申请。
                            </p>
                          )}
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <MiniFact label="申请金额" value={currency(request.amount)} />
                            <MiniFact label="关联发票" value={request.invoiceId} />
                            <MiniFact label="供应商" value={request.supplierId} />
                          </div>
                          {javaEnabled && onUpdatePaymentRequestStatus && (
                            <div aria-label="批次内付款申请状态流转" className="mt-2 grid gap-2 sm:grid-cols-2">
                              <PrimaryActionButton
                                onClick={() => onUpdatePaymentRequestStatus(request.id, '付款申请审批中')}
                                disabled={selectedPaymentBatchArchived || buyerFulfillmentBusyId === `payment-request:${request.invoiceId}` || request.requestStatus === '付款申请审批中'}
                                busy={buyerFulfillmentBusyId === `payment-request:${request.invoiceId}`}
                                pendingLabel="提交中"
                                fullWidth
                              >
                                提交付款审批
                              </PrimaryActionButton>
                              <PrimaryActionButton
                                onClick={() => advanceFocusedPaymentRequestAfterStatusChange(request.id, '付款申请已通过')}
                                disabled={selectedPaymentBatchArchived || buyerFulfillmentBusyId === `payment-request:${request.invoiceId}` || request.requestStatus === '付款申请已通过'}
                                busy={buyerFulfillmentBusyId === `payment-request:${request.invoiceId}`}
                                pendingLabel="审批中"
                                tone="emerald"
                                fullWidth
                              >
                                通过付款申请
                              </PrimaryActionButton>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </DetailSection>
                <DetailSection title="付款执行边界">
                  <div className="space-y-2">
                    <DetailKeyValueRow label="三单匹配状态" value={selectedPaymentBatchInvoiceRows.some((row) => row.threeWayMatchStatus !== '三单匹配通过') ? '存在未通过或未同步' : '批次内发票均通过'} />
                    <DetailKeyValueRow label="差异处理状态" value={selectedPaymentBatchInvoiceRows.some((row) => row.varianceHandlingStatus !== '无差异处理' && row.varianceHandlingStatus !== '已处理') ? '存在待处理差异' : '暂无未处理差异'} />
                    <DetailKeyValueRow label="执行记录" value={selectedPaymentBatchExecutionSummary} />
                    <DetailKeyValueRow label="真实支付边界" value="仅记录计划执行和付款登记轨迹，不接真实支付、银企直连或批量付款执行。" />
                  </div>
                </DetailSection>
              </div>
              <DetailSection title="付款批次执行记录" countLabel={`${selectedPaymentBatchExecutionRows.length} 条`}>
                {selectedPaymentBatchExecutionRows.length === 0 ? (
                  <p className="text-xs font-bold leading-5 text-slate-500">
                    暂无模拟执行轨迹；批次内形成付款申请后会按发票维度展示付款登记状态。
                  </p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {selectedPaymentBatchExecutionGateRows.map((row) => (
                      <div key={`${row.requestId}-${row.invoiceId}`} className="rounded-lg border border-blue-100 bg-blue-50 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-xs font-black text-blue-900">{row.invoiceId}</p>
                          <StatusPill label={row.paymentRegistrationStatus} />
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <MiniFact label="执行金额" value={currency(row.amount)} />
                          <MiniFact label="付款登记状态" value={row.paymentRegistrationStatus} />
                          <MiniFact label="模拟执行轨迹" value={row.executionTrace} />
                          <MiniFact label="阻断原因" value={row.executionBlockReason ?? '暂无阻断'} />
                          <MiniFact label="执行记录来源" value={row.executionTraceSource} />
                          <MiniFact label="执行阶段" value={row.executionStage ?? row.registrationGateStatus} />
                          <MiniFact label="登记前置条件" value={row.registrationGateStatus} />
                          <MiniFact label="登记放行判断" value={row.registrationReleaseDecision} />
                          <MiniFact label="下一处理动作" value={row.registrationNextAction} />
                          <MiniFact label="登记后复核提示" value={row.registrationPostActionHint} />
                          <MiniFact label="登记入口边界" value="仅登记付款状态，不接真实支付" />
                          <MiniFact label="真实支付边界" value="不接真实支付" />
                        </div>
                        {javaEnabled && onRegisterPaymentExecutionRecord && (
                          <PrimaryActionButton
                            onClick={() => onRegisterPaymentExecutionRecord(row.executionRecordId)}
                            disabled={selectedPaymentBatchArchived || !canRegisterPaymentExecution(row.registrationReleaseDecision) || buyerFulfillmentBusyId === `payment-execution:${row.executionRecordId}`}
                            busy={buyerFulfillmentBusyId === `payment-execution:${row.executionRecordId}`}
                            pendingLabel="登记中"
                            tone="emerald"
                            fullWidth
                          >
                            登记付款状态
                          </PrimaryActionButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
              <DetailSection title="批次内发票" countLabel={`${selectedPaymentBatchInvoiceRows.length} 张`}>
                {selectedPaymentBatchInvoiceRows.length === 0 ? (
                  <p className="text-xs font-bold leading-5 text-slate-500">
                    暂无批次内发票；创建付款申请后会按发票维度回填三单匹配和差异处理状态。
                  </p>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {selectedPaymentBatchInvoiceRows.map(({ request, invoice, varianceHandling, threeWayMatchStatus, varianceHandlingStatus }) => (
                      <div key={`${request.id}-${request.invoiceId}`} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-mono text-xs font-black text-slate-800">{request.invoiceId}</p>
                          <StatusPill label={invoice?.paymentStatus ?? '发票未同步'} />
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <MiniFact label="发票金额" value={invoice ? currency(invoice.amount) : currency(request.amount)} />
                          <MiniFact label="三单匹配状态" value={threeWayMatchStatus} />
                          <MiniFact label="差异处理状态" value={varianceHandlingStatus} />
                          <MiniFact label="处理结果" value={varianceHandling?.result ?? '暂无处理记录'} />
                        </div>
                        {javaEnabled && varianceHandling && onUpdateVarianceHandlingStatus && (
                          <div aria-label="批次内差异处理状态流转" className="mt-2 grid gap-2 sm:grid-cols-2">
                            <PrimaryActionButton
                              onClick={() => onUpdateVarianceHandlingStatus(varianceHandling.id, '已处理')}
                              disabled={selectedPaymentBatchArchived || buyerFulfillmentBusyId === `variance:${request.invoiceId}` || varianceHandling.status === '已处理'}
                              busy={buyerFulfillmentBusyId === `variance:${request.invoiceId}`}
                              pendingLabel="处理中"
                              tone="emerald"
                              fullWidth
                            >
                              标记差异已处理
                            </PrimaryActionButton>
                            <PrimaryActionButton
                              onClick={() => onUpdateVarianceHandlingStatus(varianceHandling.id, '待复核')}
                              disabled={selectedPaymentBatchArchived || buyerFulfillmentBusyId === `variance:${request.invoiceId}`}
                              busy={buyerFulfillmentBusyId === `variance:${request.invoiceId}`}
                              pendingLabel="处理中"
                              tone="amber"
                              fullWidth
                            >
                              退回差异复核
                            </PrimaryActionButton>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </DetailSection>
            </div>
          )}
        </div>
      )}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
          <p className="text-xs font-black text-amber-800">差异处理建议</p>
          <p className="mt-1 text-sm font-black text-slate-950">
            {varianceHandlingCount > 0 ? `${varianceHandlingCount} 张需核对差异` : '暂无金额差异'}
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-amber-700">
            {paymentRequestBlockedCount > 0
              ? '先关闭差异处理，再恢复付款申请。'
              : varianceHandlingCount > 0
                ? '差异已处理后可继续付款或回款确认。'
                : '订单金额和发票金额一致，可继续按计划推进。'}
          </p>
        </div>
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-black text-blue-800">付款/回款计划</p>
          <p className="mt-1 text-sm font-black text-slate-950">{paymentPlanSummary}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            {scope === 'buyer' ? '采购方关注付款申请状态、付款批次和付款登记。' : '供应商关注采购方付款节点、尾款跟进和应收归档。'}
          </p>
        </div>
        <div className="rounded-lg border border-red-100 bg-red-50 p-3">
          <p className="text-xs font-black text-red-800">逾期跟进</p>
          <p className="mt-1 text-sm font-black text-slate-950">{overdueCount > 0 ? `${overdueCount} 张已逾期` : '暂无逾期'}</p>
          <p className="mt-1 text-xs font-bold leading-5 text-red-700">
            {overdueCount > 0 ? '优先联系责任人确认付款或回款计划。' : '继续监控应付/应收截止日期。'}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <StatusFilterControl
          label="对账状态筛选"
          value={statusFilter}
          statusOptions={statusOptions}
          onChange={onChangeStatusFilter}
        />
      </div>

      {filteredInvoices.length === 0 ? (
        <EmptyState title="暂无对账单台账" desc="切换筛选条件，或在发票登记后查看订单、收货、发票的对账状态。" />
      ) : (
        <div className="mt-3">
          <ResponsiveTableFrame mobileCards={ledgerMobileCards}>
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">对账单</th>
                  <th className="px-3 py-2">订单 / 发票</th>
                  <th className="px-3 py-2 text-right">订单金额</th>
                  <th className="px-3 py-2 text-right">发票金额</th>
                  <th className="px-3 py-2 text-right">差异</th>
                  <th className="px-3 py-2">收货 / 付款</th>
                  <th className="px-3 py-2">匹配结论</th>
                  <th className="px-3 py-2">状态流转</th>
                  <th className="px-3 py-2">下一步</th>
                  <th className="px-3 py-2">付款申请</th>
                  <th className="px-3 py-2">逾期提醒</th>
                  <th className="px-3 py-2">处理提示</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="align-top hover:bg-slate-50">
                    <td className="px-3 py-3">
                      <p className="font-black text-slate-950">{invoice.reconciliationNo ?? `REC-${invoice.id}`}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{roleLabel}对账单</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-mono text-xs font-black text-slate-800">{invoice.orderId}</p>
                      <p className="mt-1 font-mono text-xs font-bold text-slate-500">{invoice.id}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-slate-900">
                      {invoice.orderAmount == null ? '待同步' : currency(invoice.orderAmount)}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-black text-slate-900">{currency(invoice.amount)}</td>
                    <td className="px-3 py-3 text-right font-mono font-black text-slate-900">
                      {invoice.varianceAmount == null ? '待同步' : currency(invoice.varianceAmount)}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs font-black text-slate-700">{invoice.receiptStatus ?? '待同步'}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{invoice.paymentStatus}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                        {buildThreeWayMatchLabel(invoice)}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill label={invoice.reconciliationStage ?? invoice.reconciliationStatus ?? '待同步'} />
                    </td>
                    <td className="px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                      {invoice.nextReconciliationAction ?? '同步订单'}
                    </td>
                    <td className="px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                      {buildPaymentRequestReadinessLabel(invoice)}
                    </td>
                    <td className="px-3 py-3 text-xs font-bold leading-5 text-slate-600">
                      {invoice.overdue ? `逾期 ${invoice.overdueDays ?? 0} 天` : (invoice.dueDate ?? '未逾期')}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                        {buildLedgerRiskLabel(invoice)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableFrame>
        </div>
      )}
    </section>
  );
};

const SupplierInvoiceReceivableCard: React.FC<{
  invoice: SupplierWorkspace['invoices'][number];
  order?: SupplierWorkspace['orders'][number];
  selected: boolean;
  demoHighlight?: DemoSampleHighlight;
  onSelectDetail: () => void;
}> = ({ invoice, order, selected, demoHighlight, onSelectDetail }) => {
  const paymentProgress = invoice.paymentStatus === '已付款'
    ? '100%'
    : invoice.paymentStatus === '部分付款'
      ? '部分回款'
      : '待回款';
  const nextAction = invoice.paymentStatus === '已付款'
    ? '归档对账'
    : invoice.paymentStatus === '部分付款'
      ? '跟进尾款'
      : '跟进回款';

  return (
    <ReadonlyDetailCardSurface title={invoice.invoiceNo ?? invoice.id} selected={selected} demoHighlight={demoHighlight}>
      <DetailHeroCard
        eyebrow="发票应收"
        title={`发票应收卡片 ${invoice.id}`}
        meta={`关联订单 ${invoice.orderId} · ${order?.status ?? '订单状态待同步'}`}
        status={invoice.paymentStatus}
        facts={[
          { label: '关联订单', value: invoice.orderId },
          { label: '应收金额', value: currency(invoice.amount) },
          { label: '付款状态', value: invoice.paymentStatus },
          { label: '回款进度', value: paymentProgress },
          { label: '下一步', value: nextAction },
        ]}
      />
      <DetailSelectionSurface
        title={invoice.invoiceNo ?? invoice.id}
        selected={selected}
        onSelectDetail={onSelectDetail}
      />
    </ReadonlyDetailCardSurface>
  );
};

const SupplierInvoiceReceivableDetailPanel: React.FC<{
  invoice?: SupplierWorkspace['invoices'][number];
  order?: SupplierWorkspace['orders'][number];
  javaEnabled: boolean;
  receivableUpdateDraft?: SupplierReceivableDraft;
  supplierActionBusyId: string | null;
  onChangeReceivableUpdateDraft: (invoiceId: string, draft: SupplierReceivableDraft) => void;
  onUpdateReceivable: (invoiceId: string, draft: SupplierReceivableDraft) => void;
}> = ({
  invoice,
  order,
  javaEnabled,
  receivableUpdateDraft,
  supplierActionBusyId,
  onChangeReceivableUpdateDraft,
  onUpdateReceivable,
}) => {
  if (!invoice) {
    return (
      <Panel title="应收对账详情" icon={CreditCard}>
        <EmptyState title="暂无应收详情" desc="选择一张发票后，可查看关联订单、付款状态和对账备注。" />
      </Panel>
    );
  }

  const updateDraft = receivableUpdateDraft ?? {
    reconciliationNote: invoice.reconciliationNote ?? '',
  };
  const receivableUpdateBusy = supplierActionBusyId === `receivable-update:${invoice.id}`;
  const updateInvalid = !updateDraft.reconciliationNote.trim();
  const nextAction = invoice.paymentStatus === '已付款'
    ? '归档对账'
    : invoice.paymentStatus === '部分付款'
      ? '跟进尾款'
      : '跟进回款';
  const overdueLabel = invoice.overdue ? '已逾期' : '未逾期';
  const overdueDaysLabel = `${invoice.overdueDays ?? 0} 天`;
  const statementOrderAmount = invoice.orderAmount == null ? '待同步' : currency(invoice.orderAmount);
  const statementVarianceAmount = invoice.varianceAmount == null ? '待同步' : currency(invoice.varianceAmount);

  return (
    <Panel title="应收对账详情" icon={CreditCard}>
      <div className="space-y-4">
        <DetailHeroCard
          eyebrow="应收对账详情"
          title={invoice.invoiceNo ?? invoice.id}
          meta={`关联订单 ${invoice.orderId} · 采购方租户 ${invoice.tenantId}`}
          status={invoice.paymentStatus}
          facts={[
            { label: '应收金额', value: currency(invoice.amount) },
            { label: '付款状态', value: invoice.paymentStatus },
            { label: '关联订单', value: invoice.orderId },
            { label: '应收截止', value: invoice.dueDate ?? '待同步' },
            { label: '逾期提醒', value: overdueLabel },
            { label: '下一步', value: nextAction },
          ]}
        />

        <DetailSection title="关联订单">
          <div className="space-y-2">
            <DetailKeyValueRow label="订单编号" value={invoice.orderId} />
            <DetailKeyValueRow label="订单状态" value={order?.status ?? '待同步'} />
            <DetailKeyValueRow label="预计收货" value={order?.expectedReceiptDate ?? '待同步'} />
          </div>
        </DetailSection>

        <DetailSection title="逾期提醒">
          <div className="space-y-2">
            <DetailKeyValueRow label="应收截止" value={invoice.dueDate ?? '待同步'} />
            <DetailKeyValueRow label="逾期状态" value={overdueLabel} />
            <DetailKeyValueRow label="逾期天数" value={overdueDaysLabel} />
          </div>
        </DetailSection>

        <DetailSection title="对账单摘要">
          <div className="space-y-2">
            <DetailKeyValueRow label="订单金额" value={statementOrderAmount} />
            <DetailKeyValueRow label="发票金额" value={currency(invoice.amount)} />
            <DetailKeyValueRow label="差异金额" value={statementVarianceAmount} />
            <DetailKeyValueRow label="收货状态" value={invoice.receiptStatus ?? '待同步'} />
            <DetailKeyValueRow label="对账状态" value={invoice.reconciliationStatus ?? '待同步'} />
          </div>
        </DetailSection>

        <DetailActionPanel
          title="维护对账备注"
          desc={javaEnabled ? '供应商可记录与采购方确认的尾款时间、对账口径和回款跟进说明，付款状态仍由采购方登记。' : 'Mock 模式先保留对账备注草稿，Java 模式下保存后刷新回显。'}
          status={javaEnabled ? '可维护' : '草稿'}
          tone={javaEnabled ? 'amber' : 'slate'}
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-black">对账备注</span>
              <textarea
                value={updateDraft.reconciliationNote}
                disabled={!javaEnabled || receivableUpdateBusy}
                onChange={(event) => onChangeReceivableUpdateDraft(invoice.id, {
                  reconciliationNote: event.target.value,
                })}
                data-testid={`stage7-supplier-receivable-note-${invoice.id}`}
                rows={4}
                className="mt-2 w-full rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-amber-400 disabled:bg-slate-100 disabled:text-slate-500"
                placeholder="记录对账口径、尾款时间或回款跟进说明"
              />
            </label>
            <PrimaryActionButton
              onClick={() => onUpdateReceivable(invoice.id, updateDraft)}
              disabled={!javaEnabled || receivableUpdateBusy || updateInvalid}
              busy={receivableUpdateBusy}
              pendingLabel="保存中"
              tone="amber"
              flushTop
              testId={`stage7-supplier-update-receivable-${invoice.id}`}
            >
              保存对账备注
            </PrimaryActionButton>
          </div>
        </DetailActionPanel>

        <DetailSection title="当前备注">
          <DetailKeyValueRow label="对账说明" value={invoice.reconciliationNote ?? '暂无备注'} />
        </DetailSection>
      </div>
    </Panel>
  );
};

const SupplierOrderActionSummaryPanel: React.FC<{
  order: SupplierWorkspace['orders'][number];
  deliveryLabel: string;
  invoiceStatus: string;
}> = ({ order, deliveryLabel, invoiceStatus }) => {
  const nextAction = order.status === '待供应商确认'
    ? '确认订单'
    : order.status === '待发货'
      ? '提交发货'
      : order.status === '已收货' && invoiceStatus === '待开票'
        ? '提交发票'
        : order.status === '已完成'
          ? '履约完成'
          : '跟进履约';

  return (
    <div className="mt-3 rounded-lg border border-orange-100 bg-orange-50 p-3">
      <p className="text-xs font-black text-orange-800">销售订单摘要</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <MiniFact label="采购方租户" value={order.tenantId} />
        <MiniFact label="订单金额" value={currency(order.amount)} />
        <MiniFact label="预计收货" value={order.expectedReceiptDate} />
        <MiniFact label="物流单号" value={deliveryLabel} />
        <MiniFact label="发票状态" value={invoiceStatus} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
  );
};

const HeroBand: React.FC<{
  eyebrow: string;
  title: string;
  desc: string;
}> = ({ eyebrow, title, desc }) => (
  <section aria-label={`${eyebrow} 页面摘要`} className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 p-3 sm:p-4">
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <p className="text-[11px] font-black uppercase tracking-widest text-blue-600">{eyebrow}</p>
        <h2 className="mt-1 break-words text-base font-black leading-tight text-slate-950 sm:text-lg">{title}</h2>
        <p className="mt-1 max-w-4xl text-xs font-semibold leading-5 text-slate-600 sm:text-sm">{desc}</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <CheckCircle2 size={15} />
          流程边界
        </div>
        <div className="mt-3 grid grid-cols-2 sm:flex gap-2 sm:flex-wrap">
          {['多企业 SaaS', '平台公共库 + 私域关系', '询价比价闭环', '站内通知与附件'].map((item) => (
            <div key={item} className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600">
              <ArrowRight size={13} className="shrink-0 text-blue-500" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const MetricCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  tone: 'blue' | 'green' | 'amber' | 'slate';
}> = ({ icon: Icon, label, value, tone }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 break-words text-xl font-black text-slate-950">{value}</p>
    </div>
  );
};

const BuyerModuleHeader: React.FC<{
  header: BuyerModuleHeaderConfig;
  facts: BuyerModuleFact[];
  javaEnabled: boolean;
}> = ({ header, facts, javaEnabled }) => (
  <section className="overflow-hidden rounded-lg border border-l-4 border-slate-200 border-l-blue-500 bg-white p-4 shadow-sm">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 break-words text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl break-words text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="min-w-0 self-stretch rounded-lg border border-blue-100 bg-blue-50 p-3 lg:w-72">
        <p className="text-xs font-black text-blue-800">本页关键动作</p>
        <p className="mt-1 break-words text-sm font-black text-blue-950">{header.primaryAction}</p>
      </div>
    </div>
    {facts.length > 0 && (
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
        {facts.slice(0, 4).map((fact) => (
          <MiniFact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>
    )}
  </section>
);

const SupplierModuleHeader: React.FC<{
  header: SupplierModuleHeaderConfig;
  facts: Array<{ label: string; value: string }>;
  javaEnabled: boolean;
}> = ({ header, facts, javaEnabled }) => (
  <section className="overflow-hidden rounded-lg border border-l-4 border-slate-200 border-l-orange-500 bg-white p-4 shadow-sm">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 break-words text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl break-words text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="min-w-0 self-stretch rounded-lg border border-orange-100 bg-orange-50 p-3 lg:w-72">
        <p className="text-xs font-black text-orange-800">供应商当前动作</p>
        <p className="mt-1 break-words text-sm font-black text-orange-950">{header.primaryAction}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
      {facts.slice(0, 4).map((fact) => (
        <MiniFact key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </div>
  </section>
);

const PlatformModuleHeader: React.FC<{
  header: PlatformModuleHeaderConfig;
  facts: Array<{ label: string; value: string }>;
  javaEnabled: boolean;
}> = ({ header, facts, javaEnabled }) => (
  <section className="overflow-hidden rounded-lg border border-l-4 border-slate-200 border-l-emerald-500 bg-white p-4 shadow-sm">
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-stretch">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 break-words text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl break-words text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="min-w-0 self-stretch rounded-lg border border-emerald-100 bg-emerald-50 p-3 lg:w-72">
        <p className="text-xs font-black text-emerald-800">平台当前动作</p>
        <p className="mt-1 break-words text-sm font-black text-emerald-950">{header.primaryAction}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))]">
      {facts.slice(0, 4).map((fact) => (
        <MiniFact key={fact.label} label={fact.label} value={fact.value} />
      ))}
    </div>
  </section>
);

const ListToolbar: React.FC<{
  title: string;
  recordCount: number;
  filterLabel: string;
  actionLabel?: string;
}> = ({ title, recordCount, filterLabel, actionLabel }) => (
  <div
    aria-label={`${title} 列表工具条`}
    className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white/95 p-3 shadow-sm shadow-slate-200/70 lg:flex-row lg:items-start lg:justify-between"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="break-words text-sm font-black text-slate-950">{title}</p>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-black text-slate-600">
          共 {recordCount} 条
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">
        当前筛选：{filterLabel}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span
        aria-label="使用顶部搜索框筛选当前列表"
        className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-slate-600"
      >
        <Search size={16} />
        顶部搜索
      </span>
      <span
        aria-label="使用下方状态筛选器筛选当前列表"
        className="inline-flex h-8 shrink-0 items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-black text-slate-600"
      >
        状态筛选
      </span>
      {actionLabel && (
        <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-slate-900 px-2.5 text-xs font-black text-white">
          {actionLabel}
        </span>
      )}
    </div>
  </div>
);

const SelectedBusinessHandoffPanel: React.FC<{
  moduleLabel: string;
  selectedTitle?: string;
  selectedMeta?: string;
  selectedStatus?: string;
  nextActionTitle?: string;
  detailHint: string;
  boundaryHint: string;
}> = ({
  moduleLabel,
  selectedTitle,
  selectedMeta,
  selectedStatus,
  nextActionTitle,
  detailHint,
  boundaryHint,
}) => (
  <section
    aria-label={`${moduleLabel} 业务接力提示`}
    className="my-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3 shadow-sm shadow-blue-100/50"
  >
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-blue-800">业务接力提示</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">
          {selectedTitle ? `${moduleLabel}：${selectedTitle}` : `请选择一条${moduleLabel}记录`}
        </p>
        {selectedMeta && <p className="mt-1 break-words text-xs font-bold text-blue-700">{selectedMeta}</p>}
      </div>
      {selectedStatus && <StatusPill label={selectedStatus} />}
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact label="当前选中" value={selectedTitle ?? '暂无选中记录'} />
      <MiniFact label="下一处理" value={nextActionTitle ?? '选择记录后展示下一步处理建议'} />
      <MiniFact label="详情核对" value={detailHint} />
      <MiniFact label="处理边界" value={boundaryHint} />
    </div>
  </section>
);

const BuyerDemoPresenterCue: React.FC<{
  moduleLabel: string;
  selectedTitle?: string;
  selectedMeta?: string;
  statusLabel?: string;
  displayedCount: number;
  totalCount: number;
  primaryActionLabel: string;
  densityHint: string;
  listHeightHint: string;
  nextModuleLabel: string;
}> = ({
  moduleLabel,
  selectedTitle,
  selectedMeta,
  statusLabel,
  displayedCount,
  totalCount,
  primaryActionLabel,
  densityHint,
  listHeightHint,
  nextModuleLabel,
}) => (
  <section
    aria-label={`${moduleLabel}首屏业务焦点`}
    data-testid="stage11-buyer-first-screen-focus"
    className="rounded-lg border border-cyan-100 bg-cyan-50 p-2.5 shadow-sm shadow-cyan-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-cyan-800">首屏业务焦点</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">
          {moduleLabel} · 详情首屏与列表卡片高度
        </p>
        <p className="mt-1 hidden text-xs font-bold leading-5 text-cyan-700 sm:block">
          先看当前选中记录和状态，再扫详情首屏、列表卡片高度和下一步动作。
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-cyan-700">
        下一页衔接：{nextModuleLabel}
      </span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-5">
      <MiniFact compact label="当前选中" value={selectedTitle ? `${selectedTitle}${selectedMeta ? ` · ${selectedMeta}` : ''}` : '当前页暂无默认选中记录'} />
      <MiniFact compact label="当前状态" value={statusLabel ?? '待选择记录'} />
      <MiniFact compact label="详情首屏" value={densityHint} />
      <MiniFact compact label="列表卡片高度" value={`${displayedCount} / ${totalCount} 条 · ${listHeightHint}`} />
      <MiniFact compact label="下一步动作" value={primaryActionLabel} />
    </div>
  </section>
);

const BuyerDemoDataSlimmingCue: React.FC<{
  moduleLabel: string;
  displayedCount: number;
  totalCount: number;
}> = ({ moduleLabel, displayedCount, totalCount }) => (
  <section
    aria-label={`${moduleLabel}演示数据瘦身`}
    data-testid="stage11-buyer-demo-data-slimming"
    className="rounded-lg border border-teal-100 bg-teal-50 p-2.5 shadow-sm shadow-teal-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-teal-800">演示数据瘦身</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">
          {moduleLabel} · 保留推荐样本，减少首屏干扰
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-teal-700">
        已展示 {displayedCount} / {totalCount}
      </span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact compact label="压缩列表样本" value="主流程列表最多展示 6 条" />
      <MiniFact compact label="保留推荐样本" value="保留当前页推荐演示样本" />
      <MiniFact compact label="隐藏非主线说明" value="说明类内容下沉到详情、提示和清单" />
      <MiniFact compact label="演示节奏" value="先讲推荐样本，再按状态筛选补充全量数据" />
    </div>
  </section>
);

const BuyerMainFlowOperationStrip: React.FC<{
  config: BuyerMainFlowOperationStripConfig;
  onNext: (moduleId: BuyerAdminModule) => void;
}> = ({ config, onNext }) => (
  <section
    aria-label={`${config.pageLabel}采购方主流程操作条`}
    data-testid="stage11-buyer-main-flow-operation-strip"
    className="stage11-buyer-main-flow-operation-strip--compact rounded-lg border border-violet-100 bg-violet-50 p-2 shadow-sm shadow-violet-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-[10px] font-black text-violet-700 sm:text-xs">采购方主流程操作条</p>
        <h3 className="mt-1 text-sm font-black text-slate-950">{config.operationTitle}</h3>
        <p className="mt-1 hidden text-xs font-bold leading-5 text-violet-700 sm:block">
          把当前页讲解重点、推荐点击动作、不可操作边界和下一页承接放在同一视线内。
        </p>
      </div>
      <PrimaryActionButton
        onClick={() => onNext(config.nextModuleId)}
        icon={ArrowRight}
        tone="blue"
        size="sm"
        flushTop
      >
        去{config.nextModuleLabel}
      </PrimaryActionButton>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4">
      <MiniFact compact label="当前页讲解重点" value={config.focus} />
      <MiniFact compact label="推荐点击动作" value={config.recommendedAction} />
      <MiniFact compact label="不可操作边界" value={config.boundary} />
      <MiniFact compact label="下一页承接" value={config.nextModuleLabel} />
    </div>
    <div className="mt-2 rounded-lg border border-white/80 bg-white/70 p-2 sm:p-3">
      <p className="text-[10px] font-black text-violet-700 sm:text-xs">页面一致性检查</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:mt-2 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4">
        <MiniFact compact label="列表扫读" value={config.listPolish} />
        <MiniFact compact label="详情层级" value={config.detailPolish} />
        <MiniFact compact label="空状态解释" value={config.emptyStatePolish} />
        <MiniFact compact label="按钮边界" value={config.buttonBoundaryPolish} />
      </div>
    </div>
  </section>
);

const BuyerKeyActionReadinessPanel: React.FC<{
  actions: Array<{ label: string; enabled: boolean; reason: string }>;
  visibilityHint: {
    moduleLabel: string;
    primaryButtonHint: string;
    disabledReasonHint: string;
    detailEntryHint: string;
    postClickHint: string;
  };
  onActionFocus: (label: string) => void;
}> = ({ actions, visibilityHint, onActionFocus }) => (
  <section
    aria-label="关键操作可用性"
    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-slate-500">关键操作可用性</p>
        <p className="mt-1 text-sm font-black text-slate-950">把可演示按钮和不可操作边界放在同一视线内</p>
      </div>
      <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-slate-100 px-2.5 text-xs font-black text-slate-600">
        边界提示可解释
      </span>
    </div>
    <div
      data-testid="stage11-buyer-action-visibility"
      className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50 p-2.5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-indigo-800">动作区可见性</p>
          <p className="mt-1 break-words text-sm font-black text-slate-950">
            {visibilityHint.moduleLabel} · 能不能点、为什么不能点、点完去哪
          </p>
        </div>
        <span className="inline-flex min-h-7 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-black text-indigo-700">
          详情区入口可追溯
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniFact compact label="主按钮位置" value={visibilityHint.primaryButtonHint} />
        <MiniFact compact label="禁用原因" value={visibilityHint.disabledReasonHint} />
        <MiniFact compact label="详情区入口" value={visibilityHint.detailEntryHint} />
        <MiniFact compact label="点击后流向" value={visibilityHint.postClickHint} />
      </div>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => (
        <div
          key={action.label}
          className={`rounded-lg border p-3 ${
            action.enabled ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`break-words text-sm font-black ${action.enabled ? 'text-emerald-950' : 'text-amber-950'}`}>
              {action.label}
            </p>
            <button
              type="button"
              disabled={!action.enabled}
              aria-disabled={!action.enabled}
              onClick={() => onActionFocus(action.label)}
              className={`inline-flex min-h-8 min-w-0 items-center justify-center rounded-md px-2.5 py-1 text-xs font-black leading-4 transition ${
                action.enabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-white/80 text-amber-700'
              }`}
            >
              <span className="max-w-full min-w-0 break-words">
                {action.label} · {action.enabled ? '定位真实操作区' : '当前数据下不可直接操作'}
              </span>
            </button>
          </div>
          <p className={`mt-2 text-[11px] font-black ${action.enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
            {action.enabled ? '可直接演示' : '边界提示可解释'}
          </p>
          <p className={`mt-2 text-xs font-bold leading-5 ${action.enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
            {action.reason}
          </p>
        </div>
      ))}
    </div>
  </section>
);

const SupplierCollaborationOperationStrip: React.FC<{
  config: SupplierCollaborationOperationStripConfig;
  onNext: (moduleId: SupplierAdminModule) => void;
}> = ({ config, onNext }) => (
  <section
    aria-label={`${config.pageLabel}供应商协同操作条`}
    data-testid="stage12-supplier-collaboration-operation-strip"
    className="rounded-lg border border-orange-100 bg-orange-50 p-2.5 shadow-sm shadow-orange-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-orange-700">供应商协同操作条</p>
        <h3 className="mt-1 text-sm font-black text-slate-950">{config.pageLabel} · 演示操作收束</h3>
        <p className="mt-1 hidden text-xs font-bold leading-5 text-orange-700 sm:block">
          把供应商当前页讲解重点、推荐动作、只读边界和下一页承接放在同一视线内。
        </p>
      </div>
      <PrimaryActionButton
        onClick={() => onNext(config.nextModuleId)}
        icon={ArrowRight}
        tone="amber"
        size="sm"
        flushTop
      >
        去{config.nextModuleLabel}
      </PrimaryActionButton>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact compact label="当前页讲解重点" value={config.focus} />
      <MiniFact compact label="推荐点击动作" value={config.recommendedAction} />
      <MiniFact compact label="只读边界" value={config.boundary} />
      <MiniFact compact label="下一页承接" value={config.nextModuleLabel} />
    </div>
    <div className="mt-2 rounded-lg border border-white/80 bg-white/70 p-2 sm:p-3">
      <p className="text-xs font-black text-orange-700">供应商页面一致性检查</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniFact compact label="列表扫读" value={config.listPolish} />
        <MiniFact compact label="详情层级" value={config.detailPolish} />
        <MiniFact compact label="空状态解释" value={config.emptyStatePolish} />
        <MiniFact compact label="按钮边界" value={config.buttonBoundaryPolish} />
      </div>
    </div>
  </section>
);

const SupplierDemoPresenterCue: React.FC<{
  moduleLabel: string;
  selectedTitle?: string;
  selectedMeta?: string;
  statusLabel?: string;
  displayedCount: number;
  totalCount: number;
  primaryActionLabel: string;
  densityHint: string;
  listHeightHint: string;
  nextModuleLabel: string;
}> = ({
  moduleLabel,
  selectedTitle,
  selectedMeta,
  statusLabel,
  displayedCount,
  totalCount,
  primaryActionLabel,
  densityHint,
  listHeightHint,
  nextModuleLabel,
}) => (
  <section
    aria-label={`${moduleLabel}供应商首屏业务焦点`}
    data-testid="stage12-supplier-first-screen-focus"
    className="rounded-lg border border-amber-100 bg-amber-50 p-2.5 shadow-sm shadow-amber-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-amber-800">供应商首屏业务焦点</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">
          {moduleLabel} · 先讲协同对象和下一步动作
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-amber-700">
        下一页衔接：{nextModuleLabel}
      </span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-5">
      <MiniFact compact label="当前选中" value={selectedTitle ? `${selectedTitle}${selectedMeta ? ` · ${selectedMeta}` : ''}` : '当前页暂无默认选中记录'} />
      <MiniFact compact label="当前状态" value={statusLabel ?? '待选择记录'} />
      <MiniFact compact label="详情首屏" value={densityHint} />
      <MiniFact compact label="列表卡片高度" value={`${displayedCount} / ${totalCount} 条 · ${listHeightHint}`} />
      <MiniFact compact label="下一步动作" value={primaryActionLabel} />
    </div>
  </section>
);

const SupplierDemoDataSlimmingCue: React.FC<{
  moduleLabel: string;
  displayedCount: number;
  totalCount: number;
}> = ({ moduleLabel, displayedCount, totalCount }) => (
  <section
    aria-label={`${moduleLabel}供应商演示数据瘦身`}
    data-testid="stage12-supplier-demo-data-slimming"
    className="rounded-lg border border-yellow-100 bg-yellow-50 p-2.5 shadow-sm shadow-yellow-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-yellow-800">供应商演示数据瘦身</p>
        <p className="mt-1 break-words text-sm font-black text-slate-950">
          {moduleLabel} · 保留推荐样本，减少非主线干扰
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-yellow-700">
        已展示 {displayedCount} / {totalCount}
      </span>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact compact label="压缩列表样本" value="供应商主流程列表最多展示 6 条" />
      <MiniFact compact label="保留推荐样本" value="保留当前页阶段七推荐演示样本" />
      <MiniFact compact label="隐藏非主线说明" value="把说明下沉到详情、提示和讲解稿" />
      <MiniFact compact label="演示节奏" value="先讲供应商待办，再回看协同结果" />
    </div>
  </section>
);

const SupplierKeyActionReadinessPanel: React.FC<{
  actions: Array<{ label: string; enabled: boolean; reason: string }>;
  visibilityHint: {
    moduleLabel: string;
    primaryButtonHint: string;
    disabledReasonHint: string;
    detailEntryHint: string;
    postClickHint: string;
  };
  onActionFocus: (label: string) => void;
}> = ({ actions, visibilityHint, onActionFocus }) => (
  <section
    aria-label="供应商关键操作可用性"
    className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/60"
  >
    <div
      data-testid="stage12-supplier-action-visibility"
      className="rounded-lg border border-orange-100 bg-orange-50 p-2.5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-orange-800">供应商动作区可见性</p>
          <p className="mt-1 break-words text-sm font-black text-slate-950">
            {visibilityHint.moduleLabel} · 能不能处理、为什么不能处理、处理后去哪
          </p>
        </div>
        <span className="inline-flex min-h-7 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-[11px] font-black text-orange-700">
          协同边界可解释
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
        <MiniFact compact label="主按钮位置" value={visibilityHint.primaryButtonHint} />
        <MiniFact compact label="禁用原因" value={visibilityHint.disabledReasonHint} />
        <MiniFact compact label="详情区入口" value={visibilityHint.detailEntryHint} />
        <MiniFact compact label="点击后流向" value={visibilityHint.postClickHint} />
      </div>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {actions.map((action) => (
        <div
          key={action.label}
          className={`rounded-lg border p-3 ${
            action.enabled ? 'border-emerald-100 bg-emerald-50' : 'border-amber-100 bg-amber-50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={`break-words text-sm font-black ${action.enabled ? 'text-emerald-950' : 'text-amber-950'}`}>
              {action.label}
            </p>
            <button
              type="button"
              disabled={!action.enabled}
              aria-disabled={!action.enabled}
              onClick={() => onActionFocus(action.label)}
              className={`inline-flex min-h-8 min-w-0 items-center justify-center rounded-md px-2.5 py-1 text-xs font-black leading-4 transition ${
                action.enabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'cursor-not-allowed bg-white/80 text-amber-700'
              }`}
            >
              {action.enabled ? '定位推荐样本' : '当前数据下不可直接操作'}
            </button>
          </div>
          <p className={`mt-2 text-xs font-bold leading-5 ${action.enabled ? 'text-emerald-700' : 'text-amber-700'}`}>
            {action.reason}
          </p>
        </div>
      ))}
    </div>
  </section>
);

const SupplierRealActionFeedbackPanel: React.FC<{
  items: SupplierRealActionFeedbackItem[];
  workflowStatus: string | null;
}> = ({ items, workflowStatus }) => (
  <section
    aria-label="供应商真实协同动作反馈"
    data-testid="stage12-supplier-real-action-feedback"
    className="rounded-lg border border-emerald-100 bg-emerald-50 p-2.5 shadow-sm shadow-emerald-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-emerald-800">供应商真实协同动作补强</p>
        <h3 className="mt-1 text-sm font-black text-slate-950">报价提交、订单确认、发货提交、发票提交和应收备注</h3>
        <p className="mt-1 text-xs font-bold leading-5 text-emerald-700">
          每个动作固定讲清点前检查、点击后反馈、失败兜底、后续流向和协同边界，避免现场只看到按钮却讲不出业务闭环。
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-emerald-700">
        {items.filter((item) => item.enabled).length} / {items.length} 可演示
      </span>
    </div>

    <div className="mt-2 rounded-lg border border-white/80 bg-white/80 p-2 sm:p-3">
      <p className="text-xs font-black text-emerald-800">最近操作反馈</p>
      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">
        {workflowStatus ?? '等待供应商动作触发；点击真实按钮后顶部和本面板都用于说明结果。'}
      </p>
    </div>

    <div className="mt-2 grid gap-2 xl:grid-cols-5">
      {items.map((item) => (
        <div
          key={item.action}
          className={`rounded-lg border p-2.5 shadow-sm ${
            item.enabled ? 'border-emerald-100 bg-white' : 'border-amber-100 bg-amber-50'
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between xl:flex-col">
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-slate-950">{item.action}</p>
              <p className="mt-1 break-all font-mono text-[10px] font-bold text-slate-400">{item.targetTestId}</p>
            </div>
            <StatusPill label={item.enabled ? '当前可演示' : '等待数据条件'} />
          </div>
          <div className="mt-2 grid gap-1.5">
            <MiniFact compact label="点前检查" value={item.beforeCheck} />
            <MiniFact compact label="点击后反馈" value={item.afterFeedback} />
            <MiniFact compact label="失败兜底" value={item.failureFallback} />
            <MiniFact compact label="后续流向" value={item.nextFlow} />
            <MiniFact compact label="协同边界" value={item.collaborationBoundary} />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const PlatformOperationsDemoLoopPanel: React.FC<{
  items: PlatformOperationsDemoLoopItem[];
  workflowStatus: string | null;
}> = ({ items, workflowStatus }) => (
  <section
    aria-label="平台运营端演示闭环"
    data-testid="stage12-platform-operations-demo-loop"
    className="rounded-lg border border-blue-100 bg-blue-50 p-2.5 shadow-sm shadow-blue-100/60 sm:p-3"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-blue-800">平台运营端演示深化第一轮</p>
        <h3 className="mt-1 text-sm font-black text-slate-950">
          租户治理、企业审核、平台公告
        </h3>
        <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
          把平台端讲成 SaaS 运营闭环：先治理租户，再审核企业，最后用公告完成运营触达，同时强调平台不直接参与采购业务决策。
        </p>
      </div>
      <span className="inline-flex min-h-8 shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-blue-700">
        {items.filter((item) => item.enabled).length} / {items.length} 可演示
      </span>
    </div>

    <div className="mt-2 rounded-lg border border-white/80 bg-white/80 p-2 sm:p-3">
      <p className="text-xs font-black text-blue-800">最近平台操作反馈</p>
      <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">
        {workflowStatus ?? '等待平台动作触发；点击租户、审核或公告按钮后，这里配合顶部反馈说明 Java 写入结果。'}
      </p>
    </div>

    <div className="mt-2 grid gap-2 xl:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.storyline}
          className={`rounded-lg border p-2.5 shadow-sm ${
            item.enabled ? 'border-blue-100 bg-white' : 'border-amber-100 bg-amber-50'
          }`}
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between xl:flex-col">
            <div className="min-w-0">
              <p className="break-words text-sm font-black text-slate-950">{item.storyline}</p>
              <p className="mt-1 text-xs font-black text-blue-700">{item.primaryActions}</p>
            </div>
            <StatusPill label={item.enabled ? '当前可演示' : '等待数据条件'} />
          </div>
          <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-2">
            <p className="text-[11px] font-black text-slate-500">真实按钮映射</p>
            <div className="mt-1 space-y-1">
              {item.targetTestIds.map((targetTestId) => (
                <p key={targetTestId} className="break-all font-mono text-[10px] font-bold text-slate-500">
                  {targetTestId}
                </p>
              ))}
            </div>
          </div>
          <div className="mt-2 grid gap-1.5">
            <MiniFact compact label="治理对象" value={item.governanceTarget} />
            <MiniFact compact label="点前检查" value={item.beforeCheck} />
            <MiniFact compact label="点击后反馈" value={item.afterFeedback} />
            <MiniFact compact label="后续流向" value={item.nextFlow} />
            <MiniFact compact label="运营边界" value={item.operationsBoundary} />
          </div>
        </div>
      ))}
    </div>
  </section>
);

const StatusFilterControl: React.FC<{
  label: string;
  value: string;
  statusOptions: string[];
  onChange: (value: string) => void;
}> = ({ label, value, statusOptions, onChange }) => (
  <div
    aria-label={`${label}筛选器`}
    className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 border-l-4 border-l-blue-500 bg-white/95 p-3 shadow-sm shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between md:flex-row md:items-center md:justify-between"
  >
    <div className="min-w-0">
      <p className="text-[11px] font-black uppercase text-blue-600">查询条件</p>
      <label className="mt-1 block text-xs font-black text-slate-700" htmlFor={`status-filter-${label}`}>
        {label}
      </label>
      <p className="mt-1 text-xs font-bold text-slate-400">可选 {statusOptions.length} 项 · 当前值：{value}</p>
    </div>
    <select
      id={`status-filter-${label}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full min-w-0 rounded-md border border-blue-100 bg-blue-50 px-3 text-xs font-black text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:w-auto sm:min-w-[12rem]"
    >
      <option value="全部状态">全部状态</option>
      {statusOptions.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
    ))}
  </select>
</div>
);

const FilterResultSummary: React.FC<{
  label: string;
  filterLabel: string;
  resultCount: number;
  totalCount: number;
  selectedLabel?: string;
  onClear: () => void;
}> = ({
  label,
  filterLabel,
  resultCount,
  totalCount,
  selectedLabel,
  onClear,
}) => {
  const filtered = filterLabel !== '全部状态';

  return (
    <div
      aria-label={label}
      className="mb-4 grid gap-3 rounded-lg border border-slate-200 border-l-4 border-l-slate-300 bg-white/95 p-3 shadow-sm shadow-slate-200/60 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    >
      <div className="min-w-0">
        <p className="mb-2 text-[11px] font-black uppercase text-slate-500">结果摘要</p>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniFact label="当前筛选" value={filterLabel} />
          <MiniFact label="命中记录" value={`${resultCount} / ${totalCount}`} />
          <MiniFact label="已选详情" value={selectedLabel ?? '暂无'} />
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        disabled={!filtered}
        aria-disabled={!filtered}
        className="inline-flex h-9 items-center justify-center rounded-md border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
      >
        清空筛选
      </button>
    </div>
  );
};

const DemoListLimitNotice: React.FC<{
  totalCount: number;
  displayedCount: number;
  moduleLabel: string;
}> = ({ totalCount, displayedCount, moduleLabel }) => {
  if (totalCount <= displayedCount) return null;

  return (
    <section
      aria-label={`${moduleLabel}演示展示上限`}
      className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-sm shadow-amber-100/60"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-amber-800">演示展示上限</p>
          <p className="mt-1 text-xs font-bold leading-5 text-amber-700">
            当前仅渲染主流程演示优先样本，主流程列表最多展示 6 条；统计、搜索和状态筛选仍按当前命中的 {totalCount} 条完整结果计算。
          </p>
        </div>
        <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-white px-2.5 text-xs font-black text-amber-700">
          已展示 {displayedCount} / {totalCount}
        </span>
      </div>
    </section>
  );
};

const ResponsiveTableFrame: React.FC<{
  mobileCards: React.ReactNode;
  children: React.ReactNode;
}> = ({ mobileCards, children }) => (
  <div className="space-y-3">
    <div className="grid gap-3 lg:hidden">
      {mobileCards}
    </div>
    <div className="hidden overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
      <div className="min-w-max">
        {children}
      </div>
    </div>
  </div>
);

const ResponsiveSummaryCard: React.FC<{
  ariaLabel: string;
  title: string;
  meta: string;
  status?: string;
  selected?: boolean;
  demoHighlight?: DemoSampleHighlight;
  facts?: Array<{ label: string; value: string }>;
  detailButton?: 'detail' | 'table';
  onSelectDetail?: () => void;
}> = ({
  ariaLabel,
  title,
  meta,
  status,
  selected = false,
  demoHighlight,
  facts = [],
  detailButton = 'detail',
  onSelectDetail,
}) => (
  <div
    aria-label={ariaLabel}
    className={`rounded-lg border p-4 shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:shadow-sm active:scale-[0.995] focus-within:ring-2 focus-within:ring-blue-100 ${
      demoHighlight ? 'border-sky-300 bg-sky-50' : 'bg-white'
    } ${
      selected ? 'border-blue-200 ring-2 ring-blue-100' : demoHighlight ? 'border-sky-300' : 'border-slate-200'
    }`}
  >
    <DemoSampleHighlightBadge demoHighlight={demoHighlight} />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 max-w-full">
        <p className="break-words font-black text-slate-950">{title}</p>
        <p className="mt-1 break-words text-xs font-bold text-slate-500">{meta}</p>
      </div>
      {status && (
        <span className="self-start">
          <StatusPill label={status} />
        </span>
      )}
    </div>
    {facts.length > 0 && (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {facts.map((fact) => (
          <MiniFact key={fact.label} label={fact.label} value={fact.value} />
        ))}
      </div>
    )}
    {onSelectDetail && (
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        {detailButton === 'table' ? (
          <TableDetailButton selected={selected} onClick={onSelectDetail} />
        ) : (
          <DetailToggleButton selected={selected} onClick={onSelectDetail} compact />
        )}
      </div>
    )}
  </div>
);

const Panel: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
    <div className="mb-4 flex items-start gap-2 border-b border-slate-100 pb-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon size={17} />
      </div>
      <div className="min-w-0">
        <h3 className="break-words font-black text-slate-950">{title}</h3>
        <p className="mt-0.5 text-xs font-bold text-slate-400">列表、详情和操作入口</p>
      </div>
    </div>
    {children}
  </section>
);

const WorkflowRail: React.FC<{
  steps: BuyerWorkspace['workflow'];
}> = ({ steps }) => (
  <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-9">
    {steps.map((step, index) => (
      <div key={step.key} className="relative rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-black text-blue-700 shadow-sm">
            {index + 1}
          </span>
          <StatusPill label={step.status} />
        </div>
        <p className="mt-3 text-sm font-black text-slate-900">{step.label}</p>
        <p className="mt-1 text-xs font-bold text-slate-400">{step.owner}</p>
      </div>
    ))}
  </div>
);

const RfqCard: React.FC<{
  rfq: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  awardDraft: BuyerAwardDraft;
  orderDraft?: BuyerOrderDraft;
  onChangeAwardDraft: (rfqId: string, draft: BuyerAwardDraft) => void;
  onChangeOrderDraft: (awardId: string, draft: BuyerOrderDraft) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string, draft: BuyerAwardDraft) => void;
  onCreateOrderFromAward: (awardId: string, draft: BuyerOrderDraft) => void;
  selected: boolean;
  onSelectDetail: () => void;
  demoHighlight?: DemoSampleHighlight;
}> = ({
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  awardDraft,
  orderDraft,
  onChangeAwardDraft,
  onChangeOrderDraft,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
  selected,
  onSelectDetail,
  demoHighlight,
}) => {
  const recommendedQuote = selectRecommendedQuote(rfq);
  const canSubmitAward = javaEnabled && canSubmitAwardApproval(rfq) && Boolean(recommendedQuote);
  const canCreateOrder = javaEnabled && canCreateOrderFromAward(rfq, approvedAwardId, workspace.orders);
  const nextAction = describeRfqNextAction(rfq, approvedAwardId, workspace.orders);
  const handledState = nextAction.title === '流程已处理';
  const todayDate = new Date().toISOString().slice(0, 10);
  const awardReasonInvalid = !awardDraft.reason.trim();
  const orderReceiptDateInvalid = !orderDraft?.expectedReceiptDate || orderDraft.expectedReceiptDate <= todayDate;

  return (
    <div className={`rounded-lg border p-4 transition ${
      demoHighlight ? 'border-sky-300 bg-sky-50' : 'bg-white'
    } ${
      selected ? 'border-blue-200 ring-2 ring-blue-100' : demoHighlight ? 'border-sky-300' : 'border-slate-200'
    }`}
    >
      <DemoSampleHighlightBadge demoHighlight={demoHighlight} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">{rfq.title}</p>
          <p className="mt-1 text-sm text-slate-500">
            {rfq.id} · 负责人 {rfq.owner} · 截止 {rfq.deadline}
          </p>
        </div>
        <StatusPill label={rfq.status} />
      </div>

      <DetailToggleButton selected={selected} onClick={onSelectDetail} />

      <div className="mt-4 space-y-2">
        {rfq.quotes.length === 0 ? (
          <ProcessStateNotice
            variant="waiting"
            title="等待供应商响应"
            desc="暂无报价，等待供应商响应。收到有效报价后会开放定标入口。"
          />
        ) : (
          rfq.quotes.map((quote, index) => {
            const supplier = workspace.suppliers.find((item) => item.id === quote.supplierId);
            const awarded = rfq.awardedSupplierId === quote.supplierId;
            const recommended = recommendedQuote?.id === quote.id;
            return (
              <div
                key={quote.id}
                className={`flex items-center justify-between rounded-lg border p-3 ${
                  awarded
                    ? 'border-emerald-200 bg-emerald-50'
                    : recommended
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-slate-900">{supplier?.name}</p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-black text-slate-500">
                      第 {index + 1} 轮报价
                    </span>
                    {recommended && !awarded && (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-700">
                        推荐
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    税率 {quote.taxRate}% · {quote.deliveryDays} 天交付
                  </p>
                  <p className="mt-1 text-[11px] font-black text-slate-500">
                    报价状态：{quote.status}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-black text-slate-900">{currency(quote.amount)}</p>
                  {quote.status === '已中选' && <p className="text-xs font-bold text-emerald-700">已中选</p>}
                  {quote.status === '未中选' && <p className="text-xs font-bold text-slate-500">未中选</p>}
                  {awarded && <p className="text-xs font-bold text-emerald-700">已定标</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {handledState ? (
        <ProcessStateNotice
          variant="handled"
          title="流程已处理"
          desc="当前询价项目暂无需要采购方立即处理的动作。可进入详情查看关联订单、收货和付款状态。"
        />
      ) : (
        <NextActionNotice action={nextAction} />
      )}

      {canSubmitAward && recommendedQuote && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <label className="block text-xs font-black text-blue-800" htmlFor={`rfq-card-award-reason-${rfq.id}`}>
            定标理由
          </label>
          <textarea
            id={`rfq-card-award-reason-${rfq.id}`}
            value={awardDraft.reason}
            onChange={(event) => onChangeAwardDraft(rfq.id, { reason: event.target.value })}
            className="mt-2 min-h-20 w-full rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          {awardReasonInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              请填写定标理由后再提交审批。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id, awardDraft)}
            disabled={awardSubmitBusyId === rfq.id || awardReasonInvalid}
            busy={awardSubmitBusyId === rfq.id}
            icon={BadgeCheck}
            pendingLabel="提交中"
            fullWidth
            testId={`stage7-submit-award-${rfq.id}`}
          >
            按推荐报价提交定标审批
          </PrimaryActionButton>
        </div>
      )}

      {canCreateOrder && approvedAwardId && orderDraft && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <label className="block text-xs font-black text-emerald-800" htmlFor={`rfq-card-order-date-${approvedAwardId}`}>
            预计到货日期
          </label>
          <input
            id={`rfq-card-order-date-${approvedAwardId}`}
            type="date"
            value={orderDraft.expectedReceiptDate}
            onChange={(event) => onChangeOrderDraft(approvedAwardId, { expectedReceiptDate: event.target.value })}
            className="mt-2 h-10 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
          />
          {orderReceiptDateInvalid && (
            <p aria-live="polite" className="mt-2 rounded-lg border border-amber-100 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-800">
              预计到货日期必须晚于今天。
            </p>
          )}
          <PrimaryActionButton
            onClick={() => onCreateOrderFromAward(approvedAwardId, orderDraft)}
            disabled={orderCreateBusy === approvedAwardId || orderReceiptDateInvalid}
            busy={orderCreateBusy === approvedAwardId}
            tone="emerald"
            icon={ShoppingCart}
            pendingLabel="生成中"
            fullWidth
            testId={`stage7-create-order-${approvedAwardId}`}
          >
            生成采购订单
          </PrimaryActionButton>
        </div>
      )}
    </div>
  );
};

const AdminInfoCard: React.FC<{
  title: string;
  meta: string;
  status?: string;
  badge?: string;
  facts?: Array<{ label: string; value: string }>;
  detailSelected: boolean;
  onSelectDetail: () => void;
  tone?: 'default' | 'warning';
  demoHighlight?: DemoSampleHighlight;
  children?: React.ReactNode;
}> = ({
  title,
  meta,
  status,
  badge,
  facts = [],
  detailSelected,
  onSelectDetail,
  tone = 'default',
  demoHighlight,
  children,
}) => {
  const baseTone = tone === 'warning'
    ? 'border-amber-100 border-l-amber-400 bg-amber-50'
    : 'border-slate-200 border-l-slate-300 bg-white';
  const activeTone = 'border-blue-200 ring-2 ring-blue-100';
  const demoTone = 'border-sky-300 border-l-sky-400 bg-sky-50';
  const metaTone = tone === 'warning' ? 'text-amber-700' : 'text-slate-500';

  return (
    <div
      aria-label={`${title} 信息卡片`}
      className={`rounded-lg border border-l-4 p-4 transition hover:border-blue-200 hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-100 ${detailSelected ? activeTone : demoHighlight ? demoTone : baseTone}`}
    >
      <DemoSampleHighlightBadge demoHighlight={demoHighlight} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-full">
          <p className="break-words text-sm font-black text-slate-950">{title}</p>
          <p className={`mt-1 break-words text-xs font-bold ${metaTone}`}>{meta}</p>
        </div>
        <div className="flex w-full shrink-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end">
          {status && <StatusPill label={status} />}
          {badge && (
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
              {badge}
            </span>
          )}
        </div>
      </div>

      {facts.length > 0 && <InlineFactGrid facts={facts} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <DetailToggleButton
          compact
          selected={detailSelected}
          onClick={onSelectDetail}
        />
      </div>

      {children}
    </div>
  );
};

const InlineWorkflowAction: React.FC<{
  title: string;
  desc: string;
  tone?: 'blue' | 'emerald';
  children: React.ReactNode;
}> = ({ title, desc, tone = 'blue', children }) => {
  const panelTone = tone === 'emerald'
    ? 'border-emerald-100 bg-emerald-50'
    : 'border-blue-100 bg-blue-50';
  const textTone = tone === 'emerald' ? 'text-emerald-700' : 'text-blue-700';

  return (
    <div
      aria-label={`${title} 快捷操作`}
      className={`rounded-lg border p-3 shadow-inner shadow-white/60 ${panelTone}`}
    >
      <p className={`text-xs font-black ${textTone}`}>{title}</p>
      <p className={`mt-1 text-xs font-bold leading-5 ${textTone}`}>{desc}</p>
      <div className="mt-3 border-t border-white/70 pt-3">
        <p className={`mb-2 text-[11px] font-black uppercase ${textTone}`}>快捷动作</p>
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,160px)_minmax(0,1fr)] sm:items-end">
        {children}
        </div>
      </div>
    </div>
  );
};

type DemoSampleHighlight = {
  label: string;
  testId: string;
};

const DemoSampleHighlightBadge: React.FC<{ demoHighlight?: DemoSampleHighlight }> = ({ demoHighlight }) => {
  if (!demoHighlight) return null;
  return (
    <div
      data-testid={demoHighlight?.testId}
      className="mb-3 inline-flex max-w-full items-center rounded-md border border-sky-200 bg-white px-2 py-1 text-[11px] font-black text-sky-700"
    >
      推荐演示样本：{demoHighlight.label}
    </div>
  );
};

const WorkflowListCard: React.FC<{
  title: string;
  meta: string;
  amountLabel?: string;
  status: string;
  facts?: Array<{ label: string; value: string }>;
  nextAction: BuyerNextAction;
  detailSelected: boolean;
  onSelectDetail: () => void;
  action?: React.ReactNode;
  demoHighlight?: DemoSampleHighlight;
  children?: React.ReactNode;
}> = ({
  title,
  meta,
  amountLabel,
  status,
  facts = [],
  nextAction,
  detailSelected,
  onSelectDetail,
  action,
  demoHighlight,
  children,
}) => (
  <div
    aria-label={`${title} 工作流卡片`}
    className={`rounded-lg border border-l-4 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-100 ${
      demoHighlight ? 'border-sky-300 bg-sky-50' : 'bg-white'
    } ${
      detailSelected ? 'border-blue-200 ring-2 ring-blue-100' : demoHighlight ? 'border-sky-300' : 'border-slate-200'
    }`}
  >
    <DemoSampleHighlightBadge demoHighlight={demoHighlight} />
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 max-w-full">
        <p className="break-words font-black text-slate-900">{title}</p>
        <p className="mt-1 break-words text-sm text-slate-500">{meta}</p>
      </div>
      {amountLabel && (
        <p className="max-w-full self-start rounded-lg bg-slate-50 px-2 py-1 font-mono font-black text-slate-900">{amountLabel}</p>
      )}
    </div>

    {facts.length > 0 && <InlineFactGrid facts={facts} />}

    <div
      aria-label={`${title} 操作区`}
      className="mt-3 grid gap-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] md:items-start"
    >
      <div aria-label={`${title} 状态与详情`} className="min-w-0 rounded-md border border-white/80 bg-white/70 p-2">
        <p className="mb-2 text-[11px] font-black uppercase text-slate-500">操作状态</p>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={status} />
          <DetailToggleButton
            compact
            selected={detailSelected}
            onClick={onSelectDetail}
          />
        </div>
      </div>
      <div aria-label={`${title} 快捷动作`} className="min-w-0 w-full md:min-w-[12rem] md:w-auto">
        {action}
      </div>
    </div>

    <NextActionNotice action={nextAction} />
    {children}
  </div>
);

const SimpleList: React.FC<{
  rows: Array<{
    id: string;
    title: string;
    meta: string;
    value: string;
    status: string;
  }>;
}> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <EmptyState title="暂无列表数据" desc="当前列表暂未沉淀业务记录，可切换筛选条件或完成主流程后再查看。" />
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-black text-slate-900">{row.title}</p>
              <p className="mt-1 text-sm text-slate-500">{row.meta}</p>
            </div>
            <p className="shrink-0 font-mono font-black text-slate-900">{row.value}</p>
          </div>
          <div className="mt-3">
            <StatusPill label={row.status} />
          </div>
        </div>
      ))}
    </div>
  );
};

const ReadonlyDetailCardSurface: React.FC<{
  title: string;
  selected: boolean;
  demoHighlight?: DemoSampleHighlight;
  children: React.ReactNode;
}> = ({ title, selected, demoHighlight, children }) => (
  <div
    aria-label={`${title} 只读详情卡片`}
    className={`space-y-3 rounded-lg border border-l-4 p-4 shadow-sm shadow-slate-200/50 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm focus-within:ring-2 focus-within:ring-blue-100 ${
      demoHighlight ? 'border-sky-300 bg-sky-50' : 'bg-white'
    } ${
      selected ? 'border-blue-200 border-l-blue-400 ring-2 ring-blue-100' : demoHighlight ? 'border-sky-300 border-l-sky-400' : 'border-slate-200 border-l-slate-300'
    }`}
  >
    <DemoSampleHighlightBadge demoHighlight={demoHighlight} />
    {children}
  </div>
);

const DetailSelectionSurface: React.FC<{
  title: string;
  selected: boolean;
  onSelectDetail: () => void;
  testId?: string;
}> = ({ title, selected, onSelectDetail, testId }) => (
  <div
    aria-label={`${title} 详情操作`}
    className="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3"
  >
    <div className="rounded-md border border-white/80 bg-white/70 p-2">
      <p className="mb-2 text-[11px] font-black uppercase text-slate-500">详情操作</p>
      <DetailToggleButton
        compact
        selected={selected}
        onClick={onSelectDetail}
        testId={testId}
      />
    </div>
  </div>
);

const DetailToggleButton: React.FC<{
  selected: boolean;
  onClick: () => void;
  fullWidth?: boolean;
  compact?: boolean;
  testId?: string;
}> = ({ selected, onClick, fullWidth = false, compact = false, testId }) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    aria-current={selected ? 'true' : undefined}
    aria-pressed={selected}
    className={`${compact ? '' : 'mt-3'} inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-black transition ${
      fullWidth ? 'w-full' : ''
    } ${
      selected
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
    <Eye size={14} />
    {selected ? '当前详情' : '查看详情'}
  </button>
);

const TableDetailButton: React.FC<{
  selected: boolean;
  onClick: () => void;
}> = ({ selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={selected ? 'true' : undefined}
    aria-pressed={selected}
    className={`inline-flex h-8 min-w-[5.5rem] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-black transition ${
      selected
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
    <Eye size={14} />
    {selected ? '当前详情' : '查看详情'}
  </button>
);

const PrimaryActionButton: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  pendingLabel?: string;
  icon?: React.ElementType;
  fullWidth?: boolean;
  flushTop?: boolean;
  size?: 'sm' | 'md';
  tone?: 'blue' | 'emerald' | 'amber' | 'red';
  testId?: string;
}> = ({
  children,
  onClick,
  disabled = false,
  busy = false,
  pendingLabel,
  icon: Icon,
  fullWidth = false,
  flushTop = false,
  size = 'sm',
  tone = 'blue',
  testId,
}) => {
  const toneClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
    red: 'bg-red-600 hover:bg-red-700',
  };
  const sizeClasses = {
    sm: 'h-9 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      aria-busy={busy || undefined}
      className={`${flushTop ? '' : 'mt-3'} inline-flex min-w-0 items-center justify-center gap-2 rounded-lg text-center leading-4 font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white/80 ${
        fullWidth ? 'w-full' : ''
      } ${sizeClasses[size]} ${toneClasses[tone]}`}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      <span className="max-w-full min-w-0 break-words">{busy && pendingLabel ? pendingLabel : children}</span>
    </button>
  );
};

const CapabilityList: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="space-y-3">
    {items.map((item) => (
      <div key={item} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={16} />
        <p className="text-sm font-semibold leading-5 text-slate-700">{item}</p>
      </div>
    ))}
  </div>
);

const StatusPill: React.FC<{ label: string }> = ({ label }) => {
  const isPositive = ['已启用', '已通过', '已准入', '已定标', '已完成', '已付款', '已提交', '已签收', '已完成'].includes(label);
  const isWarning = ['审批中', '报价中', '待付款', '待供应商确认', '待收货', '运输中', '试用中', '待准入', '准入审批中', '进行中'].includes(label);
  const classes = isPositive
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : isWarning
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return <span className={`inline-flex max-w-full min-w-0 items-center break-words rounded-lg border px-2 py-1 text-xs font-black leading-4 ${classes}`}>{label}</span>;
};

export default App;
