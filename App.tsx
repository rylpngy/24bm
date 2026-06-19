import React, { useEffect, useState } from 'react';
import {
  Activity,
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
  type BuyerWorkspace,
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
  type CreateDemandPayload,
  type PlatformWorkspaceData,
  type JavaPlatformAnnouncementDto,
  type JavaApprovalTaskDto,
  type JavaApprovalTemplateDto,
  type JavaNotificationDto,
  type BuyerRoleDto,
} from './services/procurementApiClient';

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
    receipts: PackageCheck,
    invoices: Receipt,
    audit: Activity,
    opportunities: Send,
    profile: BadgeCheck,
  };
  return icons[moduleId] ?? FileText;
};

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

const App: React.FC = () => {
  const [activeRole, setActiveRole] = useState<AdminRole>(defaultAdminRole);
  const [activeModules, setActiveModules] = useState<Record<AdminRole, string>>(defaultAdminModulesByRole);
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
  } | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierWorkspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);
  const [demandCreateBusy, setDemandCreateBusy] = useState(false);
  const [demandSubmitBusyId, setDemandSubmitBusyId] = useState<string | null>(null);
  const [supplierAdmissionBusyId, setSupplierAdmissionBusyId] = useState<string | null>(null);
  const [supplierActionBusyId, setSupplierActionBusyId] = useState<string | null>(null);
  const [rfqCreateBusy, setRfqCreateBusy] = useState<string | null>(null);
  const [awardSubmitBusyId, setAwardSubmitBusyId] = useState<string | null>(null);
  const [orderCreateBusy, setOrderCreateBusy] = useState<string | null>(null);
  const [buyerFulfillmentBusyId, setBuyerFulfillmentBusyId] = useState<string | null>(null);
  const [platformReviewBusyId, setPlatformReviewBusyId] = useState<string | null>(null);
  const [platformTenantBusyId, setPlatformTenantBusyId] = useState<string | null>(null);
  const [announcementPublishBusy, setAnnouncementPublishBusy] = useState(false);

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
        setBuyerData({
          ...nextBuyer,
          workspace: buyerWorkspace,
          pendingApprovals,
          recentApprovals,
          buyerNotifications,
          approvalTemplates,
          roles,
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

  const reviewPlatformEnterprise = async (reviewId: string, result: 'approved' | 'rejected') => {
    if (!javaApiClient || !platformData) return;
    setPlatformReviewBusyId(`${reviewId}:${result}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.reviewPlatformEnterprise(reviewId, {
        verified: result === 'approved',
        reviewStatus: result === 'approved' ? 'approved' : 'rejected',
      });
      setPlatformData(await refreshJavaPlatformData(platformData));
      setWorkflowStatus(`平台企业审核已${result === 'approved' ? '通过' : '驳回'}：${reviewId}`);
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

  const publishPlatformAnnouncement = async (payload: { title: string; targetScope: string }) => {
    if (!javaApiClient || !platformData) return;
    setAnnouncementPublishBusy(true);
    setWorkflowStatus(null);
    try {
      await javaApiClient.publishPlatformAnnouncement({
        title: payload.title,
        content: `平台公告：${payload.title}`,
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

  const reviewApprovalTask = async (approval: JavaApprovalTaskDto, approved: boolean) => {
    if (!javaApiClient || !buyerData) return;
    setApprovalBusyId(approval.id);
    setWorkflowStatus(null);
    try {
      if (approval.bizType === 'purchase_demand') {
        await javaApiClient.reviewBuyerDemandApproval(approval.bizId, approved);
      } else if (approval.bizType === 'buyer_supplier_admission') {
        await javaApiClient.reviewBuyerSupplierAdmission(approval.bizId, approved);
      } else if (approval.bizType === 'rfq_award') {
        if (!approval.parentBizId) {
          throw new Error('定标审批缺少询价项目 ID');
        }
        await javaApiClient.reviewBuyerAwardApproval(approval.parentBizId, approval.bizId, approved);
      } else {
        throw new Error(`暂不支持审批类型：${approval.bizType}`);
      }
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(approvalResultMessage(approval.bizType, approved, approval.summaryTitle || approval.bizId));
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '审批操作失败');
    } finally {
      setApprovalBusyId(null);
    }
  };

  const submitSupplierAdmission = async (relationId: string) => {
    if (!javaApiClient || !buyerData) return;
    setSupplierAdmissionBusyId(relationId);
    setWorkflowStatus(null);
    try {
      const approval = await javaApiClient.submitBuyerSupplierAdmission(relationId);
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`供应商准入已提交：${approval.summaryTitle || approval.bizId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商准入提交失败');
    } finally {
      setSupplierAdmissionBusyId(null);
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
    const relation = buyerData.workspace.privateSupplierRelations.find((item) => item.status === '已准入');
    const invitedSupplierIds = supplierIds && supplierIds.length > 0
      ? supplierIds
      : relation ? [relation.supplierId] : [];
    if (!demand || invitedSupplierIds.length === 0) {
      setWorkflowStatus('创建询价需要已通过需求和已准入供应商');
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
      setWorkflowStatus(`询价已创建：${rfq.title}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '询价创建失败');
    } finally {
      setRfqCreateBusy(null);
    }
  };

  const createBuyerOrderFromAward = async (awardId: string) => {
    if (!javaApiClient || !buyerData) return;
    const expectedReceiptDate = new Date();
    expectedReceiptDate.setDate(expectedReceiptDate.getDate() + 14);
    setOrderCreateBusy(awardId);
    setWorkflowStatus(null);
    try {
      const order = await javaApiClient.createBuyerOrder({
        awardId,
        expectedReceiptDate: expectedReceiptDate.toISOString().slice(0, 10),
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`订单已生成：${order.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '采购订单生成失败');
    } finally {
      setOrderCreateBusy(null);
    }
  };

  const submitBuyerAwardApproval = async (rfqId: string, quoteId: string) => {
    if (!javaApiClient || !buyerData) return;
    setAwardSubmitBusyId(rfqId);
    setWorkflowStatus(null);
    try {
      const award = await javaApiClient.awardBuyerRfq(rfqId, {
        quoteId,
        reason: '系统推荐：报价金额最低，交付周期优先',
      });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`定标审批已提交：${award.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '定标审批提交失败');
    } finally {
      setAwardSubmitBusyId(null);
    }
  };

  const createBuyerReceiptFromOrder = async (orderId: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`receipt:${orderId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.createBuyerReceipt(orderId, { result: '验收通过' });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`收货验收已登记：${orderId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '收货验收登记失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const registerBuyerInvoicePayment = async (invoiceId: string) => {
    if (!javaApiClient || !buyerData) return;
    setBuyerFulfillmentBusyId(`payment:${invoiceId}`);
    setWorkflowStatus(null);
    try {
      const invoice = await javaApiClient.registerBuyerPayment(invoiceId, { paymentStatus: '已付款' });
      setBuyerData(await refreshJavaBuyerData(buyerData));
      setWorkflowStatus(`登记付款完成：${invoice.id}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '付款登记失败');
    } finally {
      setBuyerFulfillmentBusyId(null);
    }
  };

  const submitSupplierQuote = async (rfqId: string) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`quote:${rfqId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.submitSupplierQuote(rfqId, {
        amount: 118000,
        taxRate: 13,
        deliveryDays: 7,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`报价已提交：${rfqId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '报价提交失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const confirmSupplierOrder = async (orderId: string) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`confirm:${orderId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.confirmSupplierOrder(orderId);
      await refreshAfterSupplierAction();
      setWorkflowStatus(`供应商订单已确认：${orderId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '供应商订单确认失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const createSupplierDelivery = async (orderId: string) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`delivery:${orderId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.createSupplierDelivery(orderId, {
        carrier: '顺丰速运',
        trackingNo: `SF${Date.now()}`,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`发货信息已提交：${orderId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '发货信息提交失败');
    } finally {
      setSupplierActionBusyId(null);
    }
  };

  const createSupplierInvoice = async (orderId: string, amount: number) => {
    if (!javaApiClient || !supplierData) return;
    setSupplierActionBusyId(`invoice:${orderId}`);
    setWorkflowStatus(null);
    try {
      await javaApiClient.createSupplierInvoice(orderId, {
        amount,
        invoiceNo: `INV-${Date.now()}`,
      });
      await refreshAfterSupplierAction();
      setWorkflowStatus(`发票信息已提交：${orderId}`);
    } catch (error) {
      setWorkflowStatus(error instanceof Error ? error.message : '发票信息提交失败');
    } finally {
      setSupplierActionBusyId(null);
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

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <AppSidebar
        activeRole={activeRole}
        activeModules={activeModules}
        onSelectRole={setActiveRole}
        onSelectModule={setActiveRoleModule}
      />
      <main className="flex min-h-0 flex-1 flex-col min-w-0">
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
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-7xl max-w-full space-y-6 p-4 sm:p-6">
            {activeRole === 'platform' && (
              <PlatformWorkspace
                data={platformData}
                activeModule={activeModule as PlatformAdminModule}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                platformReviewBusyId={platformReviewBusyId}
                platformTenantBusyId={platformTenantBusyId}
                announcementPublishBusy={announcementPublishBusy}
                onReviewEnterprise={reviewPlatformEnterprise}
                onUpdateTenantStatus={updatePlatformTenantStatus}
                onUpdateTenantPlan={updatePlatformTenantPlan}
                onToggleTenantFeature={togglePlatformTenantFeature}
                onPublishAnnouncement={publishPlatformAnnouncement}
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
                searchQuery={searchQuery}
                approvalBusyId={approvalBusyId}
                demandCreateBusy={demandCreateBusy}
                demandSubmitBusyId={demandSubmitBusyId}
                supplierAdmissionBusyId={supplierAdmissionBusyId}
                rfqCreateBusy={rfqCreateBusy}
                awardSubmitBusyId={awardSubmitBusyId}
                orderCreateBusy={orderCreateBusy}
                buyerFulfillmentBusyId={buyerFulfillmentBusyId}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                onCreateDemand={createBuyerDemand}
                onSubmitDemand={submitBuyerDemandApproval}
                onReviewApproval={reviewApprovalTask}
                onSubmitSupplierAdmission={submitSupplierAdmission}
                onCreateRfqFromDemand={createBuyerRfqFromDemand}
                onSubmitAwardApproval={submitBuyerAwardApproval}
                onCreateOrderFromAward={createBuyerOrderFromAward}
                onCreateReceipt={createBuyerReceiptFromOrder}
                onRegisterPayment={registerBuyerInvoicePayment}
                onUpdateApprovalTemplate={updateApprovalTemplate}
              />
            )}
            {activeRole === 'supplier' && (
              <SupplierWorkspaceView
                activeModule={activeModule as SupplierAdminModule}
                workspace={supplierData}
                javaEnabled={Boolean(javaApiClient)}
                workflowStatus={workflowStatus}
                supplierActionBusyId={supplierActionBusyId}
                onSubmitQuote={submitSupplierQuote}
                onConfirmOrder={confirmSupplierOrder}
                onCreateDelivery={createSupplierDelivery}
                onCreateInvoice={createSupplierInvoice}
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
    <aside className="flex min-h-0 w-24 shrink-0 flex-col bg-slate-950 text-white lg:w-72">
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
    <header className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">当前工作区</p>
          <h1 className="max-w-[220px] truncate text-lg font-black text-slate-900 sm:max-w-none">{title}</h1>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            {roleNavigation?.shortLabel} / {moduleNavigation?.label}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:gap-3">
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
        <div className="relative order-last w-full sm:min-w-[18rem] xl:order-none xl:w-64">
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
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
        >
          {refreshBusy ? '刷新中' : '刷新'}
        </button>
        {javaEnabled && activeRole === 'buyer' && (
          <button
            type="button"
            onClick={onRunJavaWorkflow}
            disabled={workflowBusy}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400 sm:px-4"
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
  <label className="relative">
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-bold text-slate-700 outline-none hover:bg-slate-50"
    >
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
  </label>
);

type PlatformAnnouncement = {
  id: string;
  title: string;
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
    targetScope: announcement.audience,
    publishedAt: announcement.createdAt,
  }));

type PlatformEnterpriseReview = {
  id: string;
  name: string;
  type: string;
  industry: string;
  status: string;
};

const buildPlatformEnterpriseReviews = (model: ProcurementMvpModel): PlatformEnterpriseReview[] =>
  model.enterprises.map((enterprise) => ({
    id: enterprise.id,
    name: enterprise.name,
    type: enterprise.type,
    industry: enterprise.industry,
    status: enterprise.verified ? '已认证' : '待审核',
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

const PlatformWorkspace: React.FC<{
  data: PlatformWorkspaceData;
  activeModule: PlatformAdminModule;
  javaEnabled: boolean;
  workflowStatus: string | null;
  platformReviewBusyId: string | null;
  platformTenantBusyId: string | null;
  announcementPublishBusy: boolean;
  onReviewEnterprise: (reviewId: string, result: 'approved' | 'rejected') => Promise<void> | void;
  onUpdateTenantStatus: (tenantId: string, status: '已启用' | '停用') => Promise<void> | void;
  onUpdateTenantPlan: (tenantId: string, plan: PlatformTenantRow['plan']) => Promise<void> | void;
  onToggleTenantFeature: (tenantId: string, enabledFeatures: string[], feature: 'rfq') => Promise<void> | void;
  onPublishAnnouncement: (payload: { title: string; targetScope: string }) => Promise<JavaPlatformAnnouncementDto[] | null> | void;
}> = ({
  data,
  activeModule,
  javaEnabled,
  workflowStatus,
  platformReviewBusyId,
  platformTenantBusyId,
  announcementPublishBusy,
  onReviewEnterprise,
  onUpdateTenantStatus,
  onUpdateTenantPlan,
  onToggleTenantFeature,
  onPublishAnnouncement,
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
  useEffect(() => {
    setPlatformTenants(buildPlatformTenantRows(data.tenants));
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
  useEffect(() => {
    setPlatformEnterpriseReviews(buildPlatformEnterpriseReviews(model));
  }, [model]);
  const enterpriseReviews = platformEnterpriseReviews;
  const handleReviewEnterprise = async (reviewId: string, result: 'approved' | 'rejected') => {
    if (javaEnabled) {
      await onReviewEnterprise(reviewId, result);
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
    targetScope: 'all',
    publishedAt: new Date().toISOString(),
  }]);
  useEffect(() => {
    if (!javaEnabled || !javaApiClient) return;
    let active = true;
    javaApiClient.listPlatformAnnouncements()
      .then((announcements) => {
        if (active) {
          setPlatformAnnouncements(buildPlatformAnnouncements(announcements));
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
  const platformModuleFacts = buildPlatformModuleFacts(
    activeModule,
    platformTenants,
    enterpriseReviews,
    announcements,
    buyerCount,
    supplierCount,
  );
  const platformModuleHeader = platformModuleHeaders[activeModule];
  const handlePublishAnnouncement = async (payload: { title: string; targetScope: string }) => {
    if (javaEnabled) {
      const nextAnnouncements = await onPublishAnnouncement(payload);
      if (nextAnnouncements) {
        setPlatformAnnouncements(buildPlatformAnnouncements(nextAnnouncements));
      }
      return;
    }
    setPlatformAnnouncements((current) => [
      {
        id: `platform-announcement-${Date.now()}`,
        title: payload.title,
        targetScope: payload.targetScope,
        publishedAt: new Date().toISOString(),
      },
      ...current,
    ]);
  };
  const operationSummary = platformOverview?.operationSummary;

  return (
    <>
      <PlatformModuleHeader
        header={platformModuleHeader}
        facts={platformModuleFacts}
        javaEnabled={javaEnabled}
      />

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
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {workflowStatus}
            </div>
          )}
          <Panel title="租户列表" icon={Layers3}>
            <ListToolbar
              title="租户运营列表"
              recordCount={platformTenants.length}
              filterLabel="全部采购企业租户"
              actionLabel="租户配置"
            />
            <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                  {platformTenants.map((tenant) => (
                    <tr key={tenant.id}>
                      <td className="px-4 py-4 font-bold text-slate-900">{tenant.name}</td>
                      <td className="px-4 py-4 text-slate-600">{tenant.plan}</td>
                      <td className="px-4 py-4">
                        <StatusPill label={tenant.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{tenant.features.join('、') || '未启用'}</td>
                      <td className="px-4 py-4 text-right font-mono font-bold">{tenant.userLimit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {workflowStatus}
            </div>
          )}
          <Panel title="企业审核" icon={ClipboardCheck}>
            <ListToolbar
              title="企业审核池"
              recordCount={enterpriseReviews.length}
              filterLabel="待审核优先"
              actionLabel="批量审核预留"
            />
            <div className="space-y-3">
              {enterpriseReviews.map((review) => (
                <PlatformEnterpriseReviewCard
                  key={review.id}
                  review={review}
                />
              ))}
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
          {javaEnabled && workflowStatus && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">
              {workflowStatus}
            </div>
          )}
          <Panel title="平台公告" icon={Bell}>
            <ListToolbar
              title="公告发布池"
              recordCount={announcements.length}
              filterLabel="已发布公告"
              actionLabel="发布公告"
            />
            <div className="space-y-3">
              {platformAnnouncements.map((announcement) => (
                <PlatformAnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                />
              ))}
            </div>
          </Panel>
        </>
      )}
    </>
  );
};

const PlatformAnnouncementPublishPanel: React.FC<{
  publishBusy: boolean;
  onPublishAnnouncement: (payload: { title: string; targetScope: string }) => Promise<void> | void;
}> = ({ publishBusy, onPublishAnnouncement }) => {
  const [title, setTitle] = useState('平台维护窗口通知');
  const [targetScope, setTargetScope] = useState('all');

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
        className="mt-4 grid gap-3 lg:grid-cols-[1fr_180px_auto] lg:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const nextTitle = title.trim();
          if (!nextTitle) {
            return;
          }
          onPublishAnnouncement({ title: nextTitle, targetScope });
          setTitle('');
          setTargetScope('all');
        }}
      >
        <label className="block">
          <span className="text-xs font-black text-slate-500">公告标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-green-400"
            placeholder="请输入公告标题"
          />
        </label>
        <label className="block">
          <span className="text-xs font-black text-slate-500">发布范围</span>
          <select
            value={targetScope}
            onChange={(event) => setTargetScope(event.target.value)}
            className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-green-400"
          >
            <option value="all">全部企业</option>
            <option value="buyer">采购方企业</option>
            <option value="supplier">供应商企业</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!title.trim() || publishBusy}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-black text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {publishBusy ? '发布中' : '发布公告'}
        </button>
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
}> = ({ announcement }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="font-black text-slate-900">公告明细卡片 {announcement.title}</p>
        <p className="mt-1 break-words text-sm text-slate-500">公告编号 {announcement.id}</p>
      </div>
      <StatusPill label="已发布" />
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact label="公告编号" value={announcement.id} />
      <MiniFact label="发布范围" value={formatAnnouncementScope(announcement.targetScope)} />
      <MiniFact label="发布时间" value={formatAuditTime(announcement.publishedAt)} />
      <MiniFact label="发布状态" value="已发布" />
    </div>
  </div>
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
  onReviewEnterprise: (reviewId: string, result: 'approved' | 'rejected') => Promise<void> | void;
}> = ({ enterpriseReviews, reviewBusyId, onReviewEnterprise }) => {
  const pendingReviews = enterpriseReviews.filter((review) => review.status === '待审核');

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
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-500">
          暂无待审核企业
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingReviews.map((review) => {
            const approveBusy = reviewBusyId === `${review.id}:approved`;
            const rejectBusy = reviewBusyId === `${review.id}:rejected`;

            return (
              <div key={review.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900">{review.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{review.type} · {review.industry}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onReviewEnterprise(review.id, 'approved')}
                    disabled={approveBusy || rejectBusy}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-green-600 px-3 text-xs font-black text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {approveBusy ? '审核中' : '通过审核'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewEnterprise(review.id, 'rejected')}
                    disabled={approveBusy || rejectBusy}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                  >
                    {rejectBusy ? '审核中' : '驳回'}
                  </button>
                </div>
              </div>
            );
          })}
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

const PlatformEnterpriseReviewCard: React.FC<{
  review: PlatformEnterpriseReview;
}> = ({ review }) => {
  const nextAction = review.status === '待审核'
    ? '处理企业审核'
    : review.status === '已驳回'
      ? '等待重新提交'
      : '维护认证档案';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="font-black text-slate-900">企业审核卡片 {review.name}</p>
          <p className="mt-1 break-words text-sm text-slate-500">审核编号 {review.id}</p>
        </div>
        <StatusPill label={review.status} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MiniFact label="企业类型" value={formatEnterpriseType(review.type)} />
        <MiniFact label="所属行业" value={review.industry} />
        <MiniFact label="审核状态" value={review.status} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
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
                onClick={() => onUpdateTenantStatus(tenant.id, '已启用')}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={enableDisabled}
              >
                {enableBusy ? '处理中' : '启用租户'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateTenantStatus(tenant.id, '停用')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={disableDisabled}
              >
                {disableBusy ? '处理中' : '停用租户'}
              </button>
              <button
                type="button"
                onClick={() => onUpdateTenantPlan(tenant.id, '专业版')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50"
                disabled={planBusy || featureBusy}
              >
                {planBusy ? '处理中' : '升级专业版'}
              </button>
              <button
                type="button"
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
  searchQuery: string;
  approvalBusyId: string | null;
  demandCreateBusy: boolean;
  demandSubmitBusyId: string | null;
  supplierAdmissionBusyId: string | null;
  rfqCreateBusy: string | null;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  buyerFulfillmentBusyId: string | null;
  javaEnabled: boolean;
  workflowStatus: string | null;
  onCreateDemand: (payload: CreateDemandPayload, submitForApproval: boolean) => void;
  onSubmitDemand: (demandId: string) => void;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean) => void;
  onSubmitSupplierAdmission: (relationId: string) => void;
  onCreateRfqFromDemand: (demandId: string, supplierIds?: string[], deadline?: string) => void;
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
  onCreateReceipt: (orderId: string) => void;
  onRegisterPayment: (invoiceId: string) => void;
  onUpdateApprovalTemplate: (
    templateCode: string,
    defaultApproverRoleId: string,
    status: 'active' | 'inactive',
  ) => void;
}> = ({
  activeModule,
  workspace,
  kpis,
  pendingApprovals,
  recentApprovals,
  buyerNotifications,
  approvalTemplates,
  roles,
  searchQuery,
  approvalBusyId,
  demandCreateBusy,
  demandSubmitBusyId,
  supplierAdmissionBusyId,
  rfqCreateBusy,
  awardSubmitBusyId,
  orderCreateBusy,
  buyerFulfillmentBusyId,
  javaEnabled,
  workflowStatus,
  onCreateDemand,
  onSubmitDemand,
  onReviewApproval,
  onSubmitSupplierAdmission,
  onCreateRfqFromDemand,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
  onCreateReceipt,
  onRegisterPayment,
  onUpdateApprovalTemplate,
}) => {
  const [selectedDemandId, setSelectedDemandId] = useState(workspace.demands[0]?.id ?? '');
  const [selectedRfqId, setSelectedRfqId] = useState(workspace.rfqs[0]?.id ?? '');
  const [selectedOrderId, setSelectedOrderId] = useState(workspace.orders[0]?.id ?? '');
  const [selectedSupplierRelationId, setSelectedSupplierRelationId] = useState(workspace.privateSupplierRelations[0]?.id ?? '');
  const [selectedMaterialId, setSelectedMaterialId] = useState(workspace.materials[0]?.id ?? '');
  const [selectedApprovalId, setSelectedApprovalId] = useState('');
  const [selectedReceiptOrderId, setSelectedReceiptOrderId] = useState(workspace.orders.find((order) => order.status === '已发货' || order.status === '待收货')?.id ?? '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(workspace.invoices[0]?.id ?? '');
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
  const unreadBuyerNotificationCount = buyerNotifications.filter((notification) => !notification.read).length;
  const linkedDemandIds = new Set(workspace.rfqs.flatMap((rfq) => rfq.demandIds));
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
  const receiptInspectionRows = buildReceiptInspectionRows(workspace);
  const invoicePaymentRows = buildInvoicePaymentRows(workspace);
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
  const filteredApprovalQueueRows = approvalQueueRows.filter((row) => matchesSearchQuery([
    row.id,
    row.title,
    row.typeLabel,
    row.status,
    ...row.facts.map((fact) => fact.value),
  ]));
  const filteredRecentApprovals = sortedRecentApprovals.filter((approval) => matchesSearchQuery([
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
  const filteredDemandListRows = demandListRows.filter((demandRow) => demandMatches(demandRow.id, [
    demandRow.title,
    demandRow.status,
    demandRow.materialSummary,
    ...demandRow.facts.map((fact) => fact.value),
  ]));
  const filteredRfqListRows = rfqListRows.filter((rfq) => matchesSearchQuery([
    rfq.id,
    rfq.title,
    rfq.status,
    rfq.demandLabel,
    rfq.supplierLabel,
    rfq.quoteLabel,
    rfq.deadlineLabel,
  ]));
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
  const filteredSupplierRelationRows = supplierRelationRows.filter((relationRow) => matchesSearchQuery([
    relationRow.id,
    relationRow.supplierName,
    relationRow.categoryLabel,
    relationRow.status,
    relationRow.level,
    relationRow.action.title,
    relationRow.action.riskLabel,
    ...relationRow.facts.map((fact) => fact.value),
  ]));
  const filteredMaterialRows = materialRows.filter((material) => matchesSearchQuery([
    material.id,
    material.title,
    material.status,
    material.usageLabel,
    ...material.facts.map((fact) => fact.value),
  ]));
  const filteredOrderFulfillmentRows = orderFulfillmentRows.filter((orderRow) => matchesSearchQuery([
    orderRow.id,
    orderRow.supplierName,
    orderRow.amountLabel,
    orderRow.status,
    orderRow.nextAction.title,
    ...orderRow.facts.map((fact) => fact.value),
  ]));
  const filteredReceiptInspectionRows = receiptInspectionRows.filter((orderRow) => matchesSearchQuery([
    orderRow.id,
    orderRow.supplierName,
    orderRow.logisticsLabel,
    orderRow.status,
    orderRow.nextAction.title,
  ]));
  const filteredInvoicePaymentRows = invoicePaymentRows.filter((invoiceRow) => matchesSearchQuery([
    invoiceRow.id,
    invoiceRow.supplierName,
    invoiceRow.orderLabel,
    invoiceRow.amountLabel,
    invoiceRow.status,
    invoiceRow.nextAction.title,
  ]));
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
  const selectedInvoice = workspace.invoices.some((invoice) => invoice.id === selectedInvoiceId)
    ? selectedInvoiceId
    : workspace.invoices[0]?.id ?? '';
  const selectedInvoiceDetail = selectedInvoice
    ? buildInvoicePaymentDetailPanel(workspace, selectedInvoice)
    : undefined;
  const selectedInvoiceRecord = selectedInvoiceDetail
    ? workspace.invoices.find((invoice) => invoice.id === selectedInvoiceDetail.id)
    : undefined;

  return (
    <>
    <HeroBand
      eyebrow="采购方企业后台"
      title="从需求申请到发票付款的询价比价闭环"
      desc="采购方维护组织、物料、私域供应商关系，并对需求、定标、订单和财务状态负责。"
    />

    {workflowStatus && (
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
        {workflowStatus}
      </div>
    )}

    <BuyerModuleHeader header={moduleHeader} facts={moduleFacts} javaEnabled={javaEnabled} />

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
      <Panel title="MVP 业务主线" icon={Activity}>
        <WorkflowRail steps={workspace.workflow} />
      </Panel>
    )}

    {activeModule === 'approvals' && (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="审批待办" icon={ClipboardCheck}>
          <ListToolbar
            title="审批待办池"
            recordCount={filteredApprovalQueueRows.length}
            filterLabel={searchFilterLabel ?? '待审批优先'}
            actionLabel="批量审批预留"
          />
          {filteredApprovalQueueRows.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredApprovalQueueRows.map((approvalRow) => {
                const approval = displayPendingApprovals.find((item) => item.id === approvalRow.id);
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
                  >
                    {javaEnabled && approval && approvalRow.canReview ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onReviewApproval(approval as JavaApprovalTaskDto, false)}
                        disabled={approvalBusyId === approvalRow.id}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white text-xs font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        驳回
                      </button>
                      <button
                        type="button"
                        onClick={() => onReviewApproval(approval as JavaApprovalTaskDto, true)}
                        disabled={approvalBusyId === approvalRow.id}
                        className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {approvalBusyId === approvalRow.id ? '处理中' : '通过'}
                      </button>
                    </div>
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
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
              当前没有待审批事项
            </p>
          )}
        </Panel>

        <ApprovalDetailPanelView
          detail={selectedApprovalDetail}
          approval={javaEnabled ? selectedApprovalSource as JavaApprovalTaskDto | undefined : undefined}
          approvalBusyId={approvalBusyId}
          javaEnabled={javaEnabled}
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
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
              暂无已处理审批记录
            </p>
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

        <Panel title="审批结果通知" icon={Bell}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-500">未读 {unreadBuyerNotificationCount} 条</p>
          </div>
          {filteredBuyerNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredBuyerNotifications.map((notification) => (
                <div key={notification.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-950">{notification.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">
                        {notification.content}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                        未读
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs font-bold text-slate-400">{formatAuditTime(notification.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
              暂无审批结果通知
            </p>
          )}
        </Panel>
      </div>
    )}

    {(activeModule === 'demands' || activeModule === 'rfqs' || activeModule === 'quotes') && (
    <div className={`grid gap-6 ${
      activeModule === 'demands'
        ? 'xl:grid-cols-[340px_minmax(0,1fr)_420px]'
        : 'xl:grid-cols-[minmax(0,1fr)_420px]'
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
        {filteredDemandListRows.length === 0 ? (
          <EmptyState title="暂无采购需求" desc="创建需求后可提交审批，审批通过后再转为询价项目。" />
        ) : (
        <div className="space-y-3">
          {filteredDemandListRows.map((demandRow) => {
            const demand = workspace.demands.find((item) => item.id === demandRow.id);
            if (!demand) return null;
            return (
            <div
              key={demandRow.id}
              className={`rounded-lg border bg-white p-4 transition ${
                selectedDemand === demandRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-slate-900">{demandRow.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{demandRow.materialSummary}</p>
                </div>
                <StatusPill label={demandRow.status} />
              </div>
              <InlineFactGrid facts={demandRow.facts} />
              <NextActionNotice action={demandRow.nextAction} />
              <DetailToggleButton
                selected={selectedDemand === demandRow.id}
                onClick={() => setSelectedDemandId(demandRow.id)}
                fullWidth
              />
              {javaEnabled && demand.status === '草稿' && (
                <PrimaryActionButton
                  onClick={() => onSubmitDemand(demand.id)}
                  disabled={demandSubmitBusyId === demand.id}
                  busy={demandSubmitBusyId === demand.id}
                  icon={ClipboardCheck}
                  pendingLabel="提交中"
                  fullWidth
                >
                  提交审批
                </PrimaryActionButton>
              )}
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
            </div>
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
        rfqCreateBusy={rfqCreateBusy}
        onSubmitDemand={onSubmitDemand}
        onCreateRfqFromDemand={onCreateRfqFromDemand}
      />
      </>
      )}

      {activeModule === 'rfqs' && (
      <>
        <Panel title="询价项目" icon={Send}>
          <ListToolbar
            title="询价项目池"
            recordCount={filteredRfqListRows.length}
            filterLabel={searchFilterLabel ?? '全部询价状态'}
            actionLabel="邀请供应商"
          />
          {filteredRfqListRows.length === 0 ? (
            <EmptyState title="暂无询价项目" desc="需求审批通过后，可从采购需求页选择已准入供应商并创建询价。" />
          ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                {filteredRfqListRows.map((rfq) => (
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
          </div>
          )}
        </Panel>
        <RfqDetailPanelView
          detail={selectedRfqDetail}
          rfq={selectedRfqRecord}
          workspace={workspace}
          approvedAwardId={selectedRfqApprovedAwardId}
          awardSubmitBusyId={awardSubmitBusyId}
          orderCreateBusy={orderCreateBusy}
          javaEnabled={javaEnabled}
          onSubmitAwardApproval={onSubmitAwardApproval}
          onCreateOrderFromAward={onCreateOrderFromAward}
        />
      </>
      )}

      {activeModule === 'quotes' && (
      <>
      <Panel title="询价比价与定标" icon={BarChart3}>
        <ListToolbar
          title="比价定标池"
          recordCount={filteredQuoteRfqs.length}
          filterLabel={searchFilterLabel ?? '按询价项目聚合'}
          actionLabel="提交定标审批"
        />
        {filteredQuoteRfqs.length === 0 ? (
          <EmptyState title="暂无可比价项目" desc="创建询价并收到供应商报价后，可在这里推荐定标并提交审批。" />
        ) : (
        <div className="space-y-4">
          {filteredQuoteRfqs.map((rfq) => {
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
                onSubmitAwardApproval={onSubmitAwardApproval}
                onCreateOrderFromAward={onCreateOrderFromAward}
                selected={selectedRfq === rfq.id}
                onSelectDetail={() => setSelectedRfqId(rfq.id)}
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
        onSubmitAwardApproval={onSubmitAwardApproval}
        onCreateOrderFromAward={onCreateOrderFromAward}
      />
      </>
      )}
    </div>
    )}

    {activeModule === 'materials' && (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="物料目录" icon={Database}>
          <ListToolbar
            title="物料服务池"
            recordCount={filteredMaterialRows.length}
            filterLabel={searchFilterLabel ?? '全部物料品类'}
            actionLabel="新增物料"
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
        <MaterialDetailPanelView detail={selectedMaterialDetail} />
      </div>
    )}

    {(activeModule === 'suppliers' || activeModule === 'orders' || activeModule === 'invoices' || activeModule === 'receipts') && (
    <div className={`grid gap-6 ${activeModule === 'suppliers' ? 'xl:grid-cols-[minmax(0,1fr)_420px]' : 'xl:grid-cols-[minmax(0,1fr)_420px]'}`}>
      {activeModule === 'suppliers' && (
      <>
      <Panel title="私域供应商关系" icon={Users}>
        <ListToolbar
          title="私域供应商池"
          recordCount={filteredSupplierRelationRows.length}
          filterLabel={searchFilterLabel ?? '全部合作状态'}
          actionLabel="供应商准入"
        />
        {filteredSupplierRelationRows.length === 0 ? (
          <EmptyState title="暂无私域供应商" desc="平台公共供应商通过准入后，会形成采购方自己的合作关系和绩效记录。" />
        ) : (
        <div className="space-y-3">
          {filteredSupplierRelationRows.map((relationRow) => {
            const relation = workspace.privateSupplierRelations.find((item) => item.id === relationRow.id);
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
                {javaEnabled && relation && relationRow.status === '待准入' && (
                  <button
                    type="button"
                    onClick={() => onSubmitSupplierAdmission(relationRow.id)}
                    disabled={supplierAdmissionBusyId === relationRow.id}
                    className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    <Send size={14} />
                    {supplierAdmissionBusyId === relationRow.id ? '提交中' : '提交准入'}
                  </button>
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
        onSubmitSupplierAdmission={onSubmitSupplierAdmission}
      />
      </>
      )}

      {activeModule === 'orders' && (
      <>
      <Panel title="订单履约" icon={PackageCheck}>
        <ListToolbar
          title="订单履约池"
          recordCount={filteredOrderFulfillmentRows.length}
          filterLabel={searchFilterLabel ?? '全部订单状态'}
          actionLabel="生成订单"
        />
        {filteredOrderFulfillmentRows.length === 0 ? (
          <EmptyState title="暂无采购订单" desc="定标审批通过后，可在报价对比页生成采购订单。" />
        ) : (
        <div className="space-y-3">
          {filteredOrderFulfillmentRows.map((orderRow) => {
            const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
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
                    <PrimaryActionButton
                      onClick={() => onCreateReceipt(orderRow.id)}
                      disabled={receiptBusy}
                      busy={receiptBusy}
                      tone="emerald"
                      pendingLabel="登记中"
                    >
                      登记收货
                    </PrimaryActionButton>
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
        buyerFulfillmentBusyId={buyerFulfillmentBusyId}
        onCreateReceipt={onCreateReceipt}
      />
      </>
      )}

      {activeModule === 'receipts' && (
      <>
        <Panel title="收货验收" icon={PackageCheck}>
          <ListToolbar
            title="收货验收池"
            recordCount={filteredReceiptInspectionRows.length}
            filterLabel={searchFilterLabel ?? '待收货优先'}
            actionLabel="登记收货"
          />
          {filteredReceiptInspectionRows.length === 0 ? (
            <EmptyState title="暂无待收货订单" desc="供应商发货后，待收货订单会出现在这里。" />
          ) : (
          <div className="space-y-3">
            {filteredReceiptInspectionRows
              .map((orderRow) => {
                const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
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
                    action={javaEnabled && orderRow.canRegisterReceipt ? (
                      <PrimaryActionButton
                        onClick={() => onCreateReceipt(orderRow.id)}
                        disabled={receiptBusy}
                        busy={receiptBusy}
                        tone="emerald"
                        pendingLabel="登记中"
                      >
                        登记收货
                      </PrimaryActionButton>
                    ) : undefined}
                  />
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
          onCreateReceipt={onCreateReceipt}
        />
      </>
      )}

      {activeModule === 'invoices' && (
      <>
      <Panel title="发票付款" icon={Receipt}>
        <ListToolbar
          title="发票付款池"
          recordCount={filteredInvoicePaymentRows.length}
          filterLabel={searchFilterLabel ?? '待付款优先'}
          actionLabel="登记付款"
        />
        {filteredInvoicePaymentRows.length === 0 ? (
          <EmptyState title="暂无发票" desc="供应商在订单收货后提交发票，采购方在这里登记付款状态。" />
        ) : (
        <div className="space-y-3">
          {filteredInvoicePaymentRows.map((invoiceRow) => {
            const paymentBusy = buyerFulfillmentBusyId === `payment:${invoiceRow.id}`;
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
                action={javaEnabled && invoiceRow.canRegisterPayment ? (
                    <PrimaryActionButton
                      onClick={() => onRegisterPayment(invoiceRow.id)}
                      disabled={paymentBusy}
                      busy={paymentBusy}
                      pendingLabel="登记中"
                    >
                      登记付款
                    </PrimaryActionButton>
                  ) : undefined}
              />
            );
          })}
        </div>
        )}
      </Panel>
      <InvoicePaymentDetailPanelView
        detail={selectedInvoiceDetail}
        invoice={selectedInvoiceRecord}
        busy={buyerFulfillmentBusyId === `payment:${selectedInvoice}`}
        javaEnabled={javaEnabled}
        onRegisterPayment={onRegisterPayment}
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

const AuditLogList: React.FC<{ workspace: BuyerWorkspace; searchQuery: string }> = ({ workspace, searchQuery }) => {
  const logs = buildAuditLogRows(workspace);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredLogs = logs.filter((log) =>
    !normalizedSearchQuery
    || [
      log.id,
      log.title,
      log.targetLabel,
      log.actorName,
      log.timeLabel,
    ].some((value) => value.toLowerCase().includes(normalizedSearchQuery)));
  const [selectedAuditLogId, setSelectedAuditLogId] = useState(filteredLogs[0]?.id ?? '');
  const selectedAuditLog = filteredLogs.some((log) => log.id === selectedAuditLogId)
    ? selectedAuditLogId
    : filteredLogs[0]?.id ?? '';
  const selectedAuditDetail = selectedAuditLog
    ? buildAuditLogDetailPanel(workspace, selectedAuditLog)
    : undefined;

  if (filteredLogs.length === 0) {
    return (
      <>
        <ListToolbar
          title="操作审计池"
          recordCount={filteredLogs.length}
          filterLabel={normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : '最近操作优先'}
          actionLabel="导出预留"
        />
        <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
          暂无审计记录
        </p>
      </>
    );
  }

  return (
    <>
      <ListToolbar
        title="操作审计池"
        recordCount={filteredLogs.length}
        filterLabel={normalizedSearchQuery ? `搜索匹配：${searchQuery.trim()}` : '最近操作优先'}
        actionLabel="导出预留"
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
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
}) => (
  <Panel title="需求详情" icon={FileText}>
    {!detail ? (
      <EmptyState title="暂无需求详情" desc="选择一条采购需求后，可查看物料明细、关联询价和审批上下文。" />
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

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-black text-slate-500">物料明细</p>
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
              {detail.lineItems.length} 行
            </span>
          </div>
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
        </section>

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

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">流程检查</p>
          <div className="space-y-2">
            {detail.flowCheckRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

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

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MiniFact label="审批状态" value={detail.approvalLabel} />
          <MiniFact label="下一步" value={detail.nextActionTitle} />
        </div>

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

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">需求操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            {detail.nextActionTitle}
          </p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {demand.status === '草稿' && (
        <PrimaryActionButton
          onClick={() => onSubmitDemand(demand.id)}
          disabled={demandSubmitBusyId === demand.id}
          busy={demandSubmitBusyId === demand.id}
          icon={ClipboardCheck}
          pendingLabel="提交中"
          fullWidth
        >
          提交审批
        </PrimaryActionButton>
      )}

      {demand.status === '已通过' && !linked && hasAdmittedSuppliers && (
        <RfqCreateForm
          demand={demand}
          suppliers={workspace.suppliers}
          relations={workspace.privateSupplierRelations}
          busy={rfqCreateBusy === demand.id}
          onSubmit={onCreateRfqFromDemand}
        />
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
          title="等待审批"
          desc="需求审批通过后，将开放创建询价入口。"
        />
      )}

      {demand.status === '已驳回' && (
        <ProcessStateNotice
          variant="waiting"
          title="需求已驳回"
          desc="请调整需求内容后重新提交审批。"
        />
      )}
    </section>
  );
};

const ApprovalDetailPanelView: React.FC<{
  detail?: ApprovalDetailPanel;
  approval?: JavaApprovalTaskDto;
  approvalBusyId: string | null;
  javaEnabled: boolean;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean) => void;
}> = ({ detail, approval, approvalBusyId, javaEnabled, onReviewApproval }) => (
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
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean) => void;
}> = ({ detail, approval, approvalBusyId, javaEnabled, onReviewApproval }) => {
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

      {javaEnabled && approval && detail.canReview && (
        <div className="grid grid-cols-2 gap-2">
          <PrimaryActionButton
            onClick={() => onReviewApproval(approval, false)}
            disabled={busy}
            busy={busy}
            tone="red"
            pendingLabel="处理中"
            fullWidth
          >
            驳回
          </PrimaryActionButton>
          <PrimaryActionButton
            onClick={() => onReviewApproval(approval, true)}
            disabled={busy}
            busy={busy}
            tone="emerald"
            icon={CheckCircle2}
            pendingLabel="处理中"
            fullWidth
          >
            通过
          </PrimaryActionButton>
        </div>
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
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
}) => (
  <Panel title="询价详情" icon={Send}>
    {!detail ? (
      <EmptyState title="暂无询价详情" desc="选择一个询价项目后，可查看关联需求、邀请供应商、报价排行和履约状态。" />
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
          <p className="mb-2 text-xs font-black text-slate-500">履约轨迹</p>
          <div className="space-y-2">
            {detail.fulfillmentTimelineRows.map((row) => (
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

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <MiniFact label="推荐结果" value={detail.recommendedSupplierLabel} />
          <MiniFact label="订单状态" value={detail.orderLabel} />
          <MiniFact label="下一步" value={detail.nextActionTitle} />
        </div>

        <RfqDetailOperationPanel
          detail={detail}
          rfq={rfq}
          workspace={workspace}
          approvedAwardId={approvedAwardId}
          awardSubmitBusyId={awardSubmitBusyId}
          orderCreateBusy={orderCreateBusy}
          javaEnabled={javaEnabled}
          onSubmitAwardApproval={onSubmitAwardApproval}
          onCreateOrderFromAward={onCreateOrderFromAward}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const RfqDetailOperationPanel: React.FC<{
  detail: RfqDetailPanel;
  rfq?: Rfq;
  workspace: BuyerWorkspace;
  approvedAwardId?: string;
  awardSubmitBusyId: string | null;
  orderCreateBusy: string | null;
  javaEnabled: boolean;
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
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

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">询价操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">{nextAction.title}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

      {rfq.quotes.length === 0 && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商报价"
          desc="暂无供应商报价，收到有效报价后会开放定标审批入口。"
        />
      )}

      {canSubmitAward && recommendedQuote && (
        <PrimaryActionButton
          onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id)}
          disabled={awardSubmitBusyId === rfq.id}
          busy={awardSubmitBusyId === rfq.id}
          icon={BadgeCheck}
          pendingLabel="提交中"
          fullWidth
        >
          按推荐报价提交定标审批
        </PrimaryActionButton>
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

      {canCreateOrder && approvedAwardId && (
        <PrimaryActionButton
          onClick={() => onCreateOrderFromAward(approvedAwardId)}
          disabled={orderCreateBusy === approvedAwardId}
          busy={orderCreateBusy === approvedAwardId}
          tone="emerald"
          icon={ShoppingCart}
          pendingLabel="生成中"
          fullWidth
        >
          生成采购订单
        </PrimaryActionButton>
      )}

      {rfq.status === '已定标' && !canCreateOrder && (
        <ProcessStateNotice
          variant="handled"
          title="定标已处理"
          desc="该询价项目已完成定标，可在关联业务中查看后续订单和履约记录。"
        />
      )}
    </section>
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
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
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

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">定标审批</p>
          <div className="space-y-2">
            {detail.awardTimelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} />
            ))}
          </div>
        </section>

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
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
}> = ({
  detail,
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
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

      {canSubmitAward && recommendedQuote && (
        <PrimaryActionButton
          onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id)}
          disabled={awardSubmitBusyId === rfq.id}
          busy={awardSubmitBusyId === rfq.id}
          icon={BadgeCheck}
          pendingLabel="提交中"
          fullWidth
        >
          按推荐报价提交定标审批
        </PrimaryActionButton>
      )}

      {rfq.status === '定标审批中' && (
        <ProcessStateNotice
          variant="waiting"
          title="等待定标审批"
          desc="审批通过后，比价结论会进入可生成采购订单状态。"
        />
      )}

      {canCreateOrder && approvedAwardId && (
        <PrimaryActionButton
          onClick={() => onCreateOrderFromAward(approvedAwardId)}
          disabled={orderCreateBusy === approvedAwardId}
          busy={orderCreateBusy === approvedAwardId}
          tone="emerald"
          icon={ShoppingCart}
          pendingLabel="生成中"
          fullWidth
        >
          生成采购订单
        </PrimaryActionButton>
      )}

      {rfq.status === '已定标' && !canCreateOrder && (
        <ProcessStateNotice
          variant="handled"
          title="比价已处理"
          desc="定标和后续订单已进入关联业务，可继续跟踪履约、收货和付款。"
        />
      )}
    </section>
  );
};

const OrderDetailPanelView: React.FC<{
  detail?: OrderDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  javaEnabled: boolean;
  buyerFulfillmentBusyId: string | null;
  onCreateReceipt: (orderId: string) => void;
}> = ({
  detail,
  order,
  javaEnabled,
  buyerFulfillmentBusyId,
  onCreateReceipt,
}) => (
  <Panel title="订单详情" icon={PackageCheck}>
    {!detail ? (
      <EmptyState title="暂无订单详情" desc="选择一张采购订单后，可查看询价来源、物流、发票和付款状态。" />
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
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">询价来源</p>
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
            <p className="truncate text-sm font-black text-slate-900">{detail.rfqLabel}</p>
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">物流信息</p>
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
        </section>

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

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">履约轨迹</p>
          <div className="space-y-2">
            {detail.fulfillmentTimelineRows.map((row) => (
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

        <MiniFact label="下一步" value={detail.nextActionTitle} />

        <OrderDetailOperationPanel
          detail={detail}
          order={order}
          javaEnabled={javaEnabled}
          buyerFulfillmentBusyId={buyerFulfillmentBusyId}
          onCreateReceipt={onCreateReceipt}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const OrderDetailOperationPanel: React.FC<{
  detail: OrderDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  javaEnabled: boolean;
  buyerFulfillmentBusyId: string | null;
  onCreateReceipt: (orderId: string) => void;
}> = ({
  detail,
  order,
  javaEnabled,
  buyerFulfillmentBusyId,
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

  return (
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-800">订单操作</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">{detail.nextActionTitle}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

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

      {(order.status === '已发货' || order.status === '待收货') && (
        <PrimaryActionButton
          onClick={() => onCreateReceipt(order.id)}
          disabled={receiptBusy}
          busy={receiptBusy}
          tone="emerald"
          icon={PackageCheck}
          pendingLabel="登记中"
          fullWidth
        >
          登记收货
        </PrimaryActionButton>
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
    </section>
  );
};

const ReceiptInspectionDetailPanelView: React.FC<{
  detail?: ReceiptInspectionDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  busy: boolean;
  javaEnabled: boolean;
  onCreateReceipt: (orderId: string) => void;
}> = ({ detail, order, busy, javaEnabled, onCreateReceipt }) => (
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

        <MiniFact label="下一步" value={detail.nextActionTitle} />

        <ReceiptInspectionOperationPanel
          detail={detail}
          order={order}
          busy={busy}
          javaEnabled={javaEnabled}
          onCreateReceipt={onCreateReceipt}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const ReceiptInspectionOperationPanel: React.FC<{
  detail: ReceiptInspectionDetailPanel;
  order?: BuyerWorkspace['orders'][number];
  busy: boolean;
  javaEnabled: boolean;
  onCreateReceipt: (orderId: string) => void;
}> = ({
  detail,
  order,
  busy,
  javaEnabled,
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

      {detail.canRegisterReceipt && (
        <PrimaryActionButton
          onClick={() => onCreateReceipt(detail.id)}
          disabled={busy}
          busy={busy}
          tone="emerald"
          icon={PackageCheck}
          pendingLabel="登记中"
          fullWidth
        >
          登记收货
        </PrimaryActionButton>
      )}

      {!detail.canRegisterReceipt && (order.status === '待供应商确认' || order.status === '待发货') && (
        <ProcessStateNotice
          variant="waiting"
          title="等待供应商履约"
          desc="供应商确认并发货后，采购方才能登记收货验收。"
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
  busy: boolean;
  javaEnabled: boolean;
  onRegisterPayment: (invoiceId: string) => void;
}> = ({ detail, invoice, busy, javaEnabled, onRegisterPayment }) => (
  <Panel title="发票详情" icon={Receipt}>
    {!detail ? (
      <EmptyState title="暂无发票详情" desc="选择一张发票后，可查看订单、物流、供应商和付款状态。" />
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
        </div>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">订单上下文</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.orderFacts.map((fact) => (
              <MiniFact key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </div>
        </section>

        <section>
          <p className="mb-2 text-xs font-black text-slate-500">付款检查</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            {detail.paymentCheckRows.map((row) => (
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
          <p className="mb-2 text-xs font-black text-slate-500">付款轨迹</p>
          <div className="space-y-2">
            {detail.paymentTimelineRows.map((row) => (
              <DetailKeyValueRow key={row.label} label={row.label} value={row.value} fontMono />
            ))}
          </div>
        </section>

        <MiniFact label="下一步" value={detail.nextActionTitle} />
        <InvoicePaymentOperationPanel
          detail={detail}
          invoice={invoice}
          busy={busy}
          javaEnabled={javaEnabled}
          onRegisterPayment={onRegisterPayment}
        />
      </DetailPanelBody>
    )}
  </Panel>
);

const InvoicePaymentOperationPanel: React.FC<{
  detail: InvoicePaymentDetailPanel;
  invoice?: BuyerWorkspace['invoices'][number];
  busy: boolean;
  javaEnabled: boolean;
  onRegisterPayment: (invoiceId: string) => void;
}> = ({ detail, invoice, busy, javaEnabled, onRegisterPayment }) => {
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
    <section className="rounded-lg border border-blue-100 bg-blue-50 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">付款操作</p>
          <p className="mt-1 text-sm font-black text-slate-950">{detail.nextActionTitle}</p>
        </div>
        <StatusPill label={detail.status} />
      </div>

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

      {javaEnabled && invoice && detail.canRegisterPayment && (
        <PrimaryActionButton
          onClick={() => onRegisterPayment(detail.id)}
          disabled={busy}
          busy={busy}
          icon={CreditCard}
          pendingLabel="登记中"
          fullWidth
        >
          登记付款
        </PrimaryActionButton>
      )}

      {javaEnabled && invoice && !detail.canRegisterPayment && invoice.paymentStatus === '已付款' && (
        <ProcessStateNotice
          variant="handled"
          title="付款已登记"
          desc="该发票已完成付款登记，可在关联业务中查看订单和物流留痕。"
        />
      )}
    </section>
  );
};

const SupplierDetailPanelView: React.FC<{
  detail?: SupplierDetailPanel;
  relation?: BuyerWorkspace['privateSupplierRelations'][number];
  javaEnabled: boolean;
  supplierAdmissionBusyId: string | null;
  onSubmitSupplierAdmission: (relationId: string) => void;
}> = ({
  detail,
  relation,
  javaEnabled,
  supplierAdmissionBusyId,
  onSubmitSupplierAdmission,
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
          onSubmitSupplierAdmission={onSubmitSupplierAdmission}
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
  onSubmitSupplierAdmission: (relationId: string) => void;
}> = ({
  detail,
  relation,
  javaEnabled,
  supplierAdmissionBusyId,
  onSubmitSupplierAdmission,
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

      {relation.status === '待准入' && (
        <PrimaryActionButton
          onClick={() => onSubmitSupplierAdmission(relation.id)}
          disabled={supplierAdmissionBusyId === relation.id}
          busy={supplierAdmissionBusyId === relation.id}
          icon={Send}
          pendingLabel="提交中"
          fullWidth
        >
          提交准入
        </PrimaryActionButton>
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
}> = ({ detail }) => (
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
  const [demandLineItems, setDemandLineItems] = useState([{ materialId: firstMaterial?.id ?? '', quantity: 1 }]);
  const [submitForApproval, setSubmitForApproval] = useState(true);

  const validLineItems = demandLineItems
    .filter((lineItem) => lineItem.materialId && lineItem.quantity > 0);
  const estimatedAmount = validLineItems.reduce((sum, lineItem) => {
    const material = materials.find((item) => item.id === lineItem.materialId);
    return sum + ((material?.referencePrice ?? 0) * lineItem.quantity);
  }, 0);
  const budgetBalance = budget - estimatedAmount;
  const canSubmit = !disabled && title.trim() && department.trim() && budget > 0 && validLineItems.length > 0;
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

      <section className="rounded-lg border border-dashed border-slate-200 bg-white p-3">
        <p className="text-xs font-black text-slate-500">需求附件</p>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-500">
          本阶段预留附件关联入口，可用于需求说明、报价依据和预算批复材料；上传能力接入后将关联到当前需求。
        </p>
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
  const admittedRelations = relations.filter((relation) => relation.status === '已准入');
  const admittedSupplierIds = admittedRelations.map((relation) => relation.supplierId);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>(admittedSupplierIds.slice(0, 2));
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 14);
  const [deadline, setDeadline] = useState(defaultDeadline.toISOString().slice(0, 10));
  const canSubmit = selectedSupplierIds.length > 0 && deadline;
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
            从已准入供应商中选择邀请对象，生成后进入报价和比价流程。
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-blue-700">
          已选择供应商 {selectedSupplierIds.length} 家
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

      <div className="mt-3 space-y-2">
        {admittedRelations.map((relation) => {
          const supplier = suppliers.find((item) => item.id === relation.supplierId);
          const checked = selectedSupplierIds.includes(relation.supplierId);
          return (
            <label
              key={relation.id}
              className={`block rounded-lg border bg-white p-3 transition ${
                checked ? 'border-blue-300 ring-2 ring-blue-100' : 'border-slate-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={checked}
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
                </div>
              </div>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onSubmit(demand.id, selectedSupplierIds, `${deadline}T18:00:00+08:00`)}
        disabled={!canSubmit || busy}
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
  <div className="space-y-3 sm:space-y-4">
    {children}
  </div>
);

const MiniFact: React.FC<{
  label: string;
  value: string;
}> = ({ label, value }) => (
  <div className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
    <p className="text-[11px] font-black text-slate-400">{label}</p>
    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{value}</p>
  </div>
);

const DetailKeyValueRow: React.FC<{
  label: string;
  value: string;
  fontMono?: boolean;
}> = ({ label, value, fontMono = false }) => (
  <div className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
    <span className="text-xs font-black text-slate-500">{label}</span>
    <span className={`break-words text-xs font-black text-slate-900 sm:text-right ${fontMono ? 'font-mono' : ''}`}>
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
  <div className="mt-3 grid gap-2 sm:grid-cols-2">
    {facts.map((fact) => (
      <div key={`${fact.label}:${fact.value}`} className="rounded-lg bg-white/70 px-3 py-2">
        <p className="text-[11px] font-black text-slate-400">{fact.label}</p>
        <p className="mt-1 truncate text-xs font-bold text-slate-700">{fact.value}</p>
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
    <div className={`rounded-lg border p-6 ${shellStateToneClasses[variant]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 opacity-80">{desc}</p>
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

const processStateToneClasses = {
  handled: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  waiting: 'border-slate-200 bg-slate-50 text-slate-600',
};

const ProcessStateNotice: React.FC<{
  variant: 'handled' | 'waiting';
  title: string;
  desc: string;
}> = ({ variant, title, desc }) => {
  const Icon = variant === 'handled' ? CheckCircle2 : Activity;

  return (
    <div className={`mt-4 rounded-lg border p-3 ${processStateToneClasses[variant]}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80">
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black">{title}</p>
          <p className="mt-1 text-xs font-bold leading-5 opacity-80">{desc}</p>
        </div>
      </div>
    </div>
  );
};

const SupplierWorkspaceView: React.FC<{
  activeModule: SupplierAdminModule;
  workspace: SupplierWorkspace;
  javaEnabled: boolean;
  workflowStatus: string | null;
  supplierActionBusyId: string | null;
  onSubmitQuote: (rfqId: string) => void;
  onConfirmOrder: (orderId: string) => void;
  onCreateDelivery: (orderId: string) => void;
  onCreateInvoice: (orderId: string, amount: number) => void;
}> = ({
  activeModule,
  workspace,
  javaEnabled,
  workflowStatus,
  supplierActionBusyId,
  onSubmitQuote,
  onConfirmOrder,
  onCreateDelivery,
  onCreateInvoice,
}) => {
  const [declinedOpportunityIds, setDeclinedOpportunityIds] = useState<string[]>([]);
  const [selectedRequirementRfqId, setSelectedRequirementRfqId] = useState<string | null>(null);
  const onDeclineOpportunity = (rfqId: string) => {
    setDeclinedOpportunityIds((current) => (
      current.includes(rfqId) ? current : [...current, rfqId]
    ));
  };
  const onViewRequirement = (rfqId: string) => {
    setSelectedRequirementRfqId((current) => (current === rfqId ? null : rfqId));
  };
  const supplierModuleFacts = buildSupplierModuleFacts(workspace, activeModule);
  const supplierModuleHeader = supplierModuleHeaders[activeModule];

  return (
    <>
    <HeroBand
      eyebrow="供应商协同中心"
      title="一次注册，多采购方协作"
      desc="供应商维护企业档案与资质，接收不同采购方的询价邀请，但报价、订单、发票按采购方隔离。"
    />

    {javaEnabled && workflowStatus && (
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700">
        {workflowStatus}
      </div>
    )}

    <SupplierModuleHeader
      header={supplierModuleHeader}
      facts={supplierModuleFacts}
      javaEnabled={javaEnabled}
    />

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
            actionLabel="批量响应预留"
          />
          <SupplierOpportunityResponseSummaryPanel
            opportunities={workspace.opportunities}
            supplierId={workspace.supplier.id}
          />
          {workspace.opportunities.map((rfq) => {
            const myQuotes = rfq.quotes.filter((quote) => quote.supplierId === workspace.supplier.id);
            const hasMyQuote = myQuotes.length > 0;
            const quoteBusy = supplierActionBusyId === `quote:${rfq.id}`;
            const declined = declinedOpportunityIds.includes(rfq.id);
            const requirementVisible = selectedRequirementRfqId === rfq.id;
            return (
              <div key={rfq.id} className="rounded-lg border border-slate-200 bg-white p-4">
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
                  {javaEnabled && rfq.status === '报价中' && !hasMyQuote && (
                    <button
                      type="button"
                      onClick={() => onSubmitQuote(rfq.id)}
                      disabled={declinedOpportunityIds.includes(rfq.id) || quoteBusy}
                      className="inline-flex min-h-24 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {quoteBusy ? '提交中' : '提交报价'}
                    </button>
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
          {workspace.quotes.length === 0 ? (
            <EmptyState title="暂无报价记录" desc="收到询价邀请并提交报价后，报价历史和关联询价状态会显示在这里。" />
          ) : (
            <div className="space-y-3">
              <SupplierQuoteHistorySummaryPanel
                quotes={workspace.quotes}
                opportunities={workspace.opportunities}
              />
              {workspace.quotes.map((quote) => {
                const rfq = workspace.opportunities.find((rfq) => rfq.id === quote.rfqId);
                return (
                  <SupplierQuoteHistoryCard
                    key={quote.id}
                    quote={quote}
                    rfq={rfq}
                  />
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {activeModule === 'profile' && (
      <Panel title="供应商企业档案" icon={BadgeCheck}>
        <div className="space-y-4">
          <SupplierProfileSummaryPanel workspace={workspace} />
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
          actionLabel="批量履约预留"
        />
        {workspace.orders.length === 0 ? (
          <EmptyState title="暂无销售订单" desc="采购方定标并生成订单后，供应商会在这里确认订单、提交发货和开票。" />
        ) : (
        <div className="space-y-3">
          <SupplierOrderFulfillmentSummaryPanel
            orders={workspace.orders}
            invoices={workspace.invoices}
          />
          {workspace.orders.map((order) => {
            const confirmBusy = supplierActionBusyId === `confirm:${order.id}`;
            const deliveryBusy = supplierActionBusyId === `delivery:${order.id}`;
            const invoiceBusy = supplierActionBusyId === `invoice:${order.id}`;
            const delivery = workspace.deliveries.find((item) => item.orderId === order.id);
            const invoice = workspace.invoices.find((item) => item.orderId === order.id);
            return (
              <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-4">
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
                  {javaEnabled && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {order.status === '待供应商确认' && (
                        <button
                          type="button"
                          onClick={() => onConfirmOrder(order.id)}
                          disabled={confirmBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {confirmBusy ? '确认中' : '确认订单'}
                        </button>
                      )}
                      {order.status === '待发货' && (
                        <button
                          type="button"
                          onClick={() => onCreateDelivery(order.id)}
                          disabled={deliveryBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {deliveryBusy ? '提交中' : '提交发货'}
                        </button>
                      )}
                      {order.status === '已收货' && !workspace.invoices.some((invoice) => invoice.orderId === order.id) && (
                        <button
                          type="button"
                          onClick={() => onCreateInvoice(order.id, order.amount)}
                          disabled={invoiceBusy}
                          className="inline-flex h-9 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                          {invoiceBusy ? '提交中' : '提交发票'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
          actionLabel="对账预留"
        />
        {workspace.invoices.length === 0 ? (
          <EmptyState title="暂无应收发票" desc="订单收货后提交发票，应收和付款状态会显示在这里。" />
        ) : (
          <div className="space-y-4">
            <SupplierInvoiceReceivableSummaryPanel invoices={workspace.invoices} />
            <div className="space-y-3">
              {workspace.invoices.map((invoice) => {
                const order = workspace.orders.find((order) => order.id === invoice.orderId);
                return (
                  <SupplierInvoiceReceivableCard
                    key={invoice.id}
                    invoice={invoice}
                    order={order}
                  />
                );
              })}
            </div>
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
}> = ({ quote, rfq }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-black text-slate-900">{rfq?.title ?? `报价 ${quote.rfqId}`}</p>
        <p className="mt-1 text-sm text-slate-500">关联询价 {quote.rfqId} · {rfq?.status ?? '未知状态'}</p>
      </div>
      <StatusPill label={quote.status} />
    </div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <MiniFact label="报价金额" value={currency(quote.amount)} />
      <MiniFact label="税率" value={`${quote.taxRate}%`} />
      <MiniFact label="交付周期" value={`${quote.deliveryDays} 天`} />
      <MiniFact label="下一步" value={rfq?.status === '已定标' ? '查看订单' : '等待定标'} />
    </div>
  </div>
);

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

const SupplierInvoiceReceivableCard: React.FC<{
  invoice: SupplierWorkspace['invoices'][number];
  order?: SupplierWorkspace['orders'][number];
}> = ({ invoice, order }) => {
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-900">发票应收卡片 {invoice.id}</p>
          <p className="mt-1 text-sm text-slate-500">关联订单 {invoice.orderId} · {order?.status ?? '订单状态待同步'}</p>
        </div>
        <StatusPill label={invoice.paymentStatus} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <MiniFact label="关联订单" value={invoice.orderId} />
        <MiniFact label="应收金额" value={currency(invoice.amount)} />
        <MiniFact label="付款状态" value={invoice.paymentStatus} />
        <MiniFact label="回款进度" value={paymentProgress} />
        <MiniFact label="下一步" value={nextAction} />
      </div>
    </div>
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
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_280px] lg:items-center">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-blue-600">{eyebrow}</p>
        <h2 className="mt-2 max-w-3xl text-xl font-black leading-tight text-slate-950 lg:text-2xl">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{desc}</p>
      </div>
      <div className="rounded-lg bg-slate-950 p-3 text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-300">
          <CheckCircle2 size={15} />
          Phase 1 MVP
        </div>
        <div className="mt-3 grid gap-2 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-1">
          {['多企业 SaaS', '平台公共库 + 私域关系', '询价比价闭环', '站内通知与附件'].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <ArrowRight size={14} className="text-blue-300" />
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
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon size={20} />
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xl font-black text-slate-950">{value}</p>
    </div>
  );
};

const BuyerModuleHeader: React.FC<{
  header: BuyerModuleHeaderConfig;
  facts: BuyerModuleFact[];
  javaEnabled: boolean;
}> = ({ header, facts, javaEnabled }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 p-3 lg:w-64">
        <p className="text-xs font-black text-blue-800">本页关键动作</p>
        <p className="mt-1 text-sm font-black text-blue-950">{header.primaryAction}</p>
      </div>
    </div>
    {facts.length > 0 && (
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-orange-50 px-2 py-1 text-xs font-black text-orange-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="shrink-0 rounded-lg border border-orange-100 bg-orange-50 p-3 lg:w-64">
        <p className="text-xs font-black text-orange-800">供应商当前动作</p>
        <p className="mt-1 text-sm font-black text-orange-950">{header.primaryAction}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
            {javaEnabled ? 'Java 数据源' : 'Mock 数据源'}
          </span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">
            当前筛选：{header.currentFilter}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-black text-slate-950">{header.title}</h3>
        <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{header.desc}</p>
      </div>
      <div className="shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 p-3 lg:w-64">
        <p className="text-xs font-black text-emerald-800">平台当前动作</p>
        <p className="mt-1 text-sm font-black text-emerald-950">{header.primaryAction}</p>
      </div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
  <div className="mb-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-slate-500">
          共 {recordCount} 条
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-slate-500">
        当前筛选：{filterLabel}
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-500">
        <Search size={16} />
        搜索预留
      </span>
      {actionLabel && (
        <span className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-3 text-xs font-black text-white">
          {actionLabel}
        </span>
      )}
    </div>
  </div>
);

const Panel: React.FC<{
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}> = ({ title, icon: Icon, children }) => (
  <section className="rounded-lg border border-slate-200 bg-white p-5">
    <div className="mb-4 flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
        <Icon size={17} />
      </div>
      <h3 className="font-black text-slate-950">{title}</h3>
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
  onSubmitAwardApproval: (rfqId: string, quoteId: string) => void;
  onCreateOrderFromAward: (awardId: string) => void;
  selected: boolean;
  onSelectDetail: () => void;
}> = ({
  rfq,
  workspace,
  approvedAwardId,
  awardSubmitBusyId,
  orderCreateBusy,
  javaEnabled,
  onSubmitAwardApproval,
  onCreateOrderFromAward,
  selected,
  onSelectDetail,
}) => {
  const recommendedQuote = selectRecommendedQuote(rfq);
  const canSubmitAward = javaEnabled && canSubmitAwardApproval(rfq) && Boolean(recommendedQuote);
  const canCreateOrder = javaEnabled && canCreateOrderFromAward(rfq, approvedAwardId, workspace.orders);
  const nextAction = describeRfqNextAction(rfq, approvedAwardId, workspace.orders);
  const handledState = nextAction.title === '流程已处理';

  return (
    <div className={`rounded-lg border bg-white p-4 transition ${
      selected ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
    }`}
    >
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
                </div>
                <div className="text-right">
                  <p className="font-mono font-black text-slate-900">{currency(quote.amount)}</p>
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
        <PrimaryActionButton
          onClick={() => onSubmitAwardApproval(rfq.id, recommendedQuote.id)}
          disabled={awardSubmitBusyId === rfq.id}
          busy={awardSubmitBusyId === rfq.id}
          icon={BadgeCheck}
          pendingLabel="提交中"
          fullWidth
        >
          按推荐报价提交定标审批
        </PrimaryActionButton>
      )}

      {canCreateOrder && (
        <PrimaryActionButton
          onClick={() => onCreateOrderFromAward(approvedAwardId)}
          disabled={orderCreateBusy === approvedAwardId}
          busy={orderCreateBusy === approvedAwardId}
          tone="emerald"
          icon={ShoppingCart}
          pendingLabel="生成中"
          fullWidth
        >
          生成采购订单
        </PrimaryActionButton>
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
  children,
}) => {
  const baseTone = tone === 'warning'
    ? 'border-amber-100 bg-amber-50'
    : 'border-slate-200 bg-white';
  const activeTone = 'border-blue-200 ring-2 ring-blue-100';
  const metaTone = tone === 'warning' ? 'text-amber-700' : 'text-slate-500';

  return (
    <div
      aria-label={`${title} 信息卡片`}
      className={`rounded-lg border p-4 transition ${detailSelected ? activeTone : baseTone}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-950">{title}</p>
          <p className={`mt-1 truncate text-xs font-bold ${metaTone}`}>{meta}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
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
}) => (
  <div
    className={`rounded-lg border bg-white p-4 transition ${
      detailSelected ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
    }`}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-black text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{meta}</p>
      </div>
      {amountLabel && (
        <p className="shrink-0 font-mono font-black text-slate-900">{amountLabel}</p>
      )}
    </div>

    {facts.length > 0 && <InlineFactGrid facts={facts} />}

    <div
      aria-label={`${title} 操作区`}
      className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill label={status} />
        <DetailToggleButton
          compact
          selected={detailSelected}
          onClick={onSelectDetail}
        />
      </div>
      {action}
    </div>

    <NextActionNotice action={nextAction} />
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
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-bold text-slate-500">
        暂无数据
      </div>
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

const DetailToggleButton: React.FC<{
  selected: boolean;
  onClick: () => void;
  fullWidth?: boolean;
  compact?: boolean;
}> = ({ selected, onClick, fullWidth = false, compact = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={selected ? 'true' : undefined}
    aria-pressed={selected}
    className={`${compact ? '' : 'mt-3'} inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
      fullWidth ? 'w-full' : ''
    } ${
      selected
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
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
    className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-lg border px-3 text-xs font-black transition ${
      selected
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`}
  >
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
  tone?: 'blue' | 'emerald' | 'amber';
}> = ({
  children,
  onClick,
  disabled = false,
  busy = false,
  pendingLabel,
  icon: Icon,
  fullWidth = false,
  tone = 'blue',
}) => {
  const toneClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    emerald: 'bg-emerald-600 hover:bg-emerald-700',
    amber: 'bg-amber-600 hover:bg-amber-700',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      className={`mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black text-white transition disabled:cursor-not-allowed disabled:bg-slate-400 ${
        fullWidth ? 'w-full' : ''
      } ${toneClasses[tone]}`}
    >
      {Icon && <Icon size={14} />}
      {busy && pendingLabel ? pendingLabel : children}
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

  return <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-black ${classes}`}>{label}</span>;
};

export default App;
