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

  useEffect(() => {
    if (configurationError) return;
    let active = true;
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
      });

    return () => {
      active = false;
    };
  }, [configurationError, tenantId, supplierId, refreshKey]);

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
          workflowBusy={workflowBusy}
          onRefresh={() => setRefreshKey((value) => value + 1)}
          onRunJavaWorkflow={runJavaWorkflow}
        />
        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto max-w-7xl max-w-full space-y-6 p-4 sm:p-6">
            {activeRole === 'platform' && (
              <PlatformWorkspace
                data={platformData}
                activeModule={activeModule as PlatformAdminModule}
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
        <div className="relative hidden w-64 xl:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="搜索企业、询价、订单、供应商"
          />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-600 hover:bg-slate-50"
        >
          刷新
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

type PlatformEnterpriseReview = {
  id: string;
  name: string;
  type: string;
  industry: string;
  status: string;
};

type PlatformTenantRow = Omit<PlatformWorkspaceData['tenants'][number], 'status'> & {
  status: string;
  features: string[];
};

const PlatformWorkspace: React.FC<{
  data: PlatformWorkspaceData;
  activeModule: PlatformAdminModule;
}> = ({ data, activeModule }) => {
  const { model, platformOverview } = data;
  const supplierCount = platformOverview?.publicSupplierCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'supplier').length;
  const buyerCount = platformOverview?.tenantCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'buyer').length;
  const pendingTenantCount = platformOverview?.pendingEnterpriseReviews
    ?? model.tenants.filter((tenant) => tenant.status === '待审核').length;
  const [platformTenants, setPlatformTenants] = useState<PlatformTenantRow[]>(data.tenants.map((tenant) => ({
    ...tenant,
    features: tenant.enabledFeatures,
  })));
  const onUpdateTenantStatus = (tenantId: string, status: '已启用' | '停用') => {
    setPlatformTenants((current) => current.map((tenant) => (
      tenant.id === tenantId ? { ...tenant, status } : tenant
    )));
  };
  const onUpdateTenantPlan = (tenantId: string, plan: PlatformTenantRow['plan']) => {
    setPlatformTenants((current) => current.map((tenant) => (
      tenant.id === tenantId ? { ...tenant, plan } : tenant
    )));
  };
  const onToggleTenantFeature = (tenantId: string, feature: 'rfq') => {
    const featureLabel = feature === 'rfq' ? '询价比价' : feature;
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
  const [platformEnterpriseReviews, setPlatformEnterpriseReviews] = useState<PlatformEnterpriseReview[]>(model.enterprises.map((enterprise) => ({
    id: enterprise.id,
    name: enterprise.name,
    type: enterprise.type,
    industry: enterprise.industry,
    status: enterprise.verified ? '已认证' : '待审核',
  })));
  const enterpriseReviews = platformEnterpriseReviews;
  const onReviewEnterprise = (reviewId: string, result: 'approved' | 'rejected') => {
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
  const announcements = platformAnnouncements;
  const onPublishAnnouncement = (payload: { title: string; targetScope: string }) => {
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
            onUpdateTenantStatus={onUpdateTenantStatus}
            onUpdateTenantPlan={onUpdateTenantPlan}
            onToggleTenantFeature={onToggleTenantFeature}
          />
          <Panel title="租户列表" icon={Layers3}>
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
            onReviewEnterprise={onReviewEnterprise}
          />
          <Panel title="企业审核" icon={ClipboardCheck}>
            <SimpleList
              rows={enterpriseReviews.map((review) => ({
                id: review.id,
                title: review.name,
                meta: `${review.type} · ${review.industry}`,
                value: review.status,
                status: review.status,
              }))}
            />
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
          <PlatformAnnouncementPublishPanel onPublishAnnouncement={onPublishAnnouncement} />
          <Panel title="平台公告" icon={Bell}>
            <SimpleList
              rows={platformAnnouncements.map((announcement) => ({
                id: announcement.id,
                title: announcement.title,
                meta: `发布范围 ${announcement.targetScope}`,
                value: formatAuditTime(announcement.publishedAt),
                status: '已发布',
              }))}
            />
          </Panel>
        </>
      )}
    </>
  );
};

const PlatformAnnouncementPublishPanel: React.FC<{
  onPublishAnnouncement: (payload: { title: string; targetScope: string }) => void;
}> = ({ onPublishAnnouncement }) => {
  const [title, setTitle] = useState('平台维护窗口通知');
  const [targetScope, setTargetScope] = useState('all');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-700">发布平台公告</p>
          <p className="mt-1 text-xs font-bold text-slate-500">先支持本地发布预览，后续接入 Java 平台公告 API。</p>
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
          className="inline-flex h-10 items-center justify-center rounded-lg bg-green-600 px-4 text-sm font-black text-white transition hover:bg-green-700"
        >
          发布公告
        </button>
      </form>
    </section>
  );
};

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
  onReviewEnterprise: (reviewId: string, result: 'approved' | 'rejected') => void;
}> = ({ enterpriseReviews, onReviewEnterprise }) => {
  const pendingReviews = enterpriseReviews.filter((review) => review.status === '待审核');

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-700">审核操作</p>
          <p className="mt-1 text-xs font-bold text-slate-500">先支持前端审核状态预览，后续接入 Java 企业审核 API。</p>
        </div>
        <ClipboardCheck size={18} className="text-amber-600" />
      </div>
      {pendingReviews.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm font-bold text-slate-500">
          暂无待审核企业
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingReviews.map((review) => (
            <div key={review.id} className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{review.name}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{review.type} · {review.industry}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onReviewEnterprise(review.id, 'approved')}
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-green-600 px-3 text-xs font-black text-white transition hover:bg-green-700"
                >
                  通过审核
                </button>
                <button
                  type="button"
                  onClick={() => onReviewEnterprise(review.id, 'rejected')}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50"
                >
                  驳回
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
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
  onUpdateTenantStatus: (tenantId: string, status: '已启用' | '停用') => void;
  onUpdateTenantPlan: (tenantId: string, plan: PlatformTenantRow['plan']) => void;
  onToggleTenantFeature: (tenantId: string, feature: 'rfq') => void;
}> = ({
  tenants,
  onUpdateTenantStatus,
  onUpdateTenantPlan,
  onToggleTenantFeature,
}) => (
  <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-black text-slate-700">租户操作</p>
        <p className="mt-1 text-xs font-bold text-slate-500">先支持状态、套餐和询价功能开关的前端预览，后续接入 Java 租户管理 API。</p>
      </div>
      <Settings size={18} className="text-blue-600" />
    </div>
    <div className="mt-4 grid gap-3 xl:grid-cols-2">
      {tenants.map((tenant) => {
        const rfqEnabled = tenant.features.includes('询价比价');
        const disabled = tenant.status === '停用';

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
                disabled={!disabled}
              >
                启用租户
              </button>
              <button
                type="button"
                onClick={() => onUpdateTenantStatus(tenant.id, '停用')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
                disabled={disabled}
              >
                停用租户
              </button>
              <button
                type="button"
                onClick={() => onUpdateTenantPlan(tenant.id, '专业版')}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 transition hover:bg-indigo-50"
              >
                升级专业版
              </button>
              <button
                type="button"
                onClick={() => onToggleTenantFeature(tenant.id, 'rfq')}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black transition ${
                  rfqEnabled
                    ? 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border border-green-200 bg-white text-green-700 hover:bg-green-50'
                }`}
              >
                切换询价
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
  const orderFulfillmentRows = buildOrderFulfillmentRows(workspace);
  const receiptInspectionRows = buildReceiptInspectionRows(workspace);
  const invoicePaymentRows = buildInvoicePaymentRows(workspace);
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

    {moduleFacts.length > 0 && (
      <ModuleSummaryStrip facts={moduleFacts} />
    )}

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
          {approvalQueueRows.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {approvalQueueRows.map((approvalRow) => {
                const approval = displayPendingApprovals.find((item) => item.id === approvalRow.id);
                return (
                  <div
                    key={approvalRow.id}
                    className={`rounded-lg border bg-amber-50 p-4 transition ${
                      selectedApproval === approvalRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-amber-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{approvalRow.title}</p>
                        <p className="mt-1 text-xs font-bold text-amber-700">{approvalRow.typeLabel}</p>
                      </div>
                      <StatusPill label={approvalRow.status} />
                    </div>
                    <InlineFactGrid facts={approvalRow.facts} />
                    <button
                      type="button"
                      onClick={() => setSelectedApprovalId(approvalRow.id)}
                      className={`mt-4 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                        selectedApproval === approvalRow.id
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {selectedApproval === approvalRow.id ? '当前详情' : '查看详情'}
                    </button>
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
                  </div>
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
          {javaEnabled && sortedRecentApprovals.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {sortedRecentApprovals.map((approval) => {
                const facts = buildApprovalCardFacts(approval);
                return (
                  <div
                    key={approval.id}
                    className={`rounded-lg border bg-white p-4 transition ${
                      selectedApproval === approval.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">
                          {approval.summaryTitle || approval.bizId}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{approvalTypeLabel(approval.bizType)}</p>
                      </div>
                      <StatusPill label={approval.status} />
                    </div>
                    <InlineFactGrid facts={[
                      ...facts.slice(0, 4),
                      { label: '处理时间', value: formatAuditTime(approval.actedAt ?? approval.createdAt) },
                    ]} />
                    <button
                      type="button"
                      onClick={() => setSelectedApprovalId(approval.id)}
                      className={`mt-4 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                        selectedApproval === approval.id
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {selectedApproval === approval.id ? '当前详情' : '查看详情'}
                    </button>
                  </div>
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
          {sortedBuyerNotifications.length > 0 ? (
            <div className="space-y-3">
              {sortedBuyerNotifications.map((notification) => (
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
        {workspace.demands.length === 0 ? (
          <EmptyState title="暂无采购需求" desc="创建需求后可提交审批，审批通过后再转为询价项目。" />
        ) : (
        <div className="space-y-3">
          {buildDemandListRows(workspace).map((demandRow) => {
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
          {workspace.rfqs.length === 0 ? (
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
                {buildRfqListRows(workspace).map((rfq) => (
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
        {workspace.rfqs.length === 0 ? (
          <EmptyState title="暂无可比价项目" desc="创建询价并收到供应商报价后，可在这里推荐定标并提交审批。" />
        ) : (
        <div className="space-y-4">
          {workspace.rfqs.map((rfq) => {
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
          {workspace.materials.length === 0 ? (
            <EmptyState title="暂无物料目录" desc="先维护物料或服务主数据，再用于采购需求明细和询价范围。" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {buildMaterialCatalogRows(workspace).map((material) => (
                <div
                  key={material.id}
                  className={`rounded-lg border bg-white p-4 transition ${
                    selectedMaterial === material.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{material.title}</p>
                      <p className="mt-1 text-xs font-bold text-slate-400">{material.usageLabel}</p>
                    </div>
                    <StatusPill label={material.status} />
                  </div>
                  <InlineFactGrid facts={material.facts} />
                  <button
                    type="button"
                    onClick={() => setSelectedMaterialId(material.id)}
                    className={`mt-4 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                      selectedMaterial === material.id
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {selectedMaterial === material.id ? '当前详情' : '查看详情'}
                  </button>
                </div>
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
        {supplierRelationRows.length === 0 ? (
          <EmptyState title="暂无私域供应商" desc="平台公共供应商通过准入后，会形成采购方自己的合作关系和绩效记录。" />
        ) : (
        <div className="space-y-3">
          {supplierRelationRows.map((relationRow) => {
            const relation = workspace.privateSupplierRelations.find((item) => item.id === relationRow.id);
            return (
              <div
                key={relationRow.id}
                className={`rounded-lg border bg-white p-4 transition ${
                  selectedSupplierRelation === relationRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-900">{relationRow.supplierName}</p>
                    <p className="mt-1 truncate text-xs font-bold text-slate-400">{relationRow.categoryLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                    {relationRow.level}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <StatusPill label={relationRow.status} />
                  <span className="rounded-lg bg-slate-50 px-2 py-1 font-mono text-xs font-black text-slate-700">
                    {relationRow.action.riskLabel}
                  </span>
                </div>
                <InlineFactGrid facts={relationRow.facts} />
                <SupplierRelationNotice action={relationRow.action} />
                <button
                  type="button"
                  onClick={() => setSelectedSupplierRelationId(relationRow.id)}
                  className={`mt-4 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                    selectedSupplierRelation === relationRow.id
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {selectedSupplierRelation === relationRow.id ? '当前详情' : '查看详情'}
                </button>
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
              </div>
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
        {orderFulfillmentRows.length === 0 ? (
          <EmptyState title="暂无采购订单" desc="定标审批通过后，可在报价对比页生成采购订单。" />
        ) : (
        <div className="space-y-3">
          {orderFulfillmentRows.map((orderRow) => {
            const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
            return (
              <div
                key={orderRow.id}
                className={`rounded-lg border bg-white p-4 transition ${
                  selectedOrder === orderRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">{orderRow.id}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {orderRow.supplierName}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono font-black text-slate-900">{orderRow.amountLabel}</p>
                </div>
                <InlineFactGrid facts={orderRow.facts} />
                <DetailToggleButton
                  selected={selectedOrder === orderRow.id}
                  onClick={() => setSelectedOrderId(orderRow.id)}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusPill label={orderRow.status} />
                  {javaEnabled && orderRow.canRegisterReceipt && (
                    <PrimaryActionButton
                      onClick={() => onCreateReceipt(orderRow.id)}
                      disabled={receiptBusy}
                      busy={receiptBusy}
                      tone="emerald"
                      pendingLabel="登记中"
                    >
                      登记收货
                    </PrimaryActionButton>
                  )}
                </div>
                <NextActionNotice action={orderRow.nextAction} />
              </div>
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
          {receiptInspectionRows.length === 0 ? (
            <EmptyState title="暂无待收货订单" desc="供应商发货后，待收货订单会出现在这里。" />
          ) : (
          <div className="space-y-3">
            {receiptInspectionRows
              .map((orderRow) => {
                const receiptBusy = buyerFulfillmentBusyId === `receipt:${orderRow.id}`;
                return (
                  <div
                    key={orderRow.id}
                    className={`rounded-lg border bg-white p-4 transition ${
                      selectedReceiptOrder === orderRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900">{orderRow.id}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {orderRow.supplierName} · {orderRow.logisticsLabel}
                        </p>
                      </div>
                      <StatusPill label={orderRow.status} />
                    </div>
                    <DetailToggleButton
                      selected={selectedReceiptOrder === orderRow.id}
                      onClick={() => setSelectedReceiptOrderId(orderRow.id)}
                    />
                    {javaEnabled && orderRow.canRegisterReceipt && (
                      <PrimaryActionButton
                        onClick={() => onCreateReceipt(orderRow.id)}
                        disabled={receiptBusy}
                        busy={receiptBusy}
                        tone="emerald"
                        pendingLabel="登记中"
                      >
                        登记收货
                      </PrimaryActionButton>
                    )}
                    <NextActionNotice action={orderRow.nextAction} />
                  </div>
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
        {invoicePaymentRows.length === 0 ? (
          <EmptyState title="暂无发票" desc="供应商在订单收货后提交发票，采购方在这里登记付款状态。" />
        ) : (
        <div className="space-y-3">
          {invoicePaymentRows.map((invoiceRow) => {
            const paymentBusy = buyerFulfillmentBusyId === `payment:${invoiceRow.id}`;
            return (
              <div
                key={invoiceRow.id}
                className={`rounded-lg border bg-white p-4 transition ${
                  selectedInvoice === invoiceRow.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-slate-900">{invoiceRow.id}</p>
                    <p className="mt-1 text-sm text-slate-500">{invoiceRow.supplierName} · {invoiceRow.orderLabel}</p>
                  </div>
                  <p className="shrink-0 font-mono font-black text-slate-900">{invoiceRow.amountLabel}</p>
                </div>
                <DetailToggleButton
                  selected={selectedInvoice === invoiceRow.id}
                  onClick={() => setSelectedInvoiceId(invoiceRow.id)}
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <StatusPill label={invoiceRow.status} />
                  {javaEnabled && invoiceRow.canRegisterPayment && (
                    <PrimaryActionButton
                      onClick={() => onRegisterPayment(invoiceRow.id)}
                      disabled={paymentBusy}
                      busy={paymentBusy}
                      pendingLabel="登记中"
                    >
                      登记付款
                    </PrimaryActionButton>
                  )}
                </div>
                <NextActionNotice action={invoiceRow.nextAction} />
              </div>
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
        <AuditLogList workspace={workspace} />
      </Panel>
    )}
    </>
  );
};

const AuditLogList: React.FC<{ workspace: BuyerWorkspace }> = ({ workspace }) => {
  const logs = buildAuditLogRows(workspace);
  const [selectedAuditLogId, setSelectedAuditLogId] = useState(logs[0]?.id ?? '');
  const selectedAuditLog = logs.some((log) => log.id === selectedAuditLogId)
    ? selectedAuditLogId
    : logs[0]?.id ?? '';
  const selectedAuditDetail = selectedAuditLog
    ? buildAuditLogDetailPanel(workspace, selectedAuditLog)
    : undefined;

  if (logs.length === 0) {
    return (
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
        暂无审计记录
      </p>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-3 md:grid-cols-2">
        {logs.map((log) => (
          <div
            key={log.id}
            className={`rounded-lg border bg-white p-4 transition ${
              selectedAuditLog === log.id ? 'border-blue-200 ring-2 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-950">{log.title}</p>
                <p className="mt-1 truncate text-xs font-bold text-slate-500">{log.targetLabel}</p>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                {log.timeLabel}
              </span>
            </div>
            <InlineFactGrid
              facts={[
                { label: '操作人', value: log.actorName },
                { label: '审计编号', value: log.id },
              ]}
            />
            <button
              type="button"
              onClick={() => setSelectedAuditLogId(log.id)}
              className={`mt-4 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
                selectedAuditLog === log.id
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {selectedAuditLog === log.id ? '当前详情' : '查看详情'}
            </button>
          </div>
        ))}
      </div>
      <AuditLogDetailPanelView detail={selectedAuditDetail} />
    </div>
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
}> = ({ variant, title, desc, fullScreen = false }) => {
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
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
              <Building2 size={26} />
            </div>
            <div>
              <p className="text-lg font-black">{workspace.supplier.name}</p>
              <p className="text-sm text-slate-500">{workspace.supplier.industry}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
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
      </Panel>
      )}
    </div>
    )}

    {activeModule === 'orders' && (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="销售订单与发货" icon={Truck}>
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
        {workspace.invoices.length === 0 ? (
          <EmptyState title="暂无应收发票" desc="订单收货后提交发票，应收和付款状态会显示在这里。" />
        ) : (
          <div className="space-y-4">
            <SupplierInvoiceReceivableSummaryPanel invoices={workspace.invoices} />
            <SimpleList
              rows={workspace.invoices.map((invoice) => ({
                id: invoice.id,
                title: invoice.id,
                meta: `订单 ${invoice.orderId}`,
                value: currency(invoice.amount),
                status: invoice.paymentStatus,
              }))}
            />
          </div>
        )}
      </Panel>
    )}
    </>
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
}> = ({ selected, onClick, fullWidth = false }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={selected ? 'true' : undefined}
    aria-pressed={selected}
    className={`mt-3 inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-black transition ${
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
