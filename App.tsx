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
  procurementApiClient,
  runJavaMvpWorkflow,
  type PlatformWorkspaceData,
  type JavaApprovalTaskDto,
} from './services/procurementApiClient';

type WorkspaceMode = 'platform' | 'buyer' | 'supplier';

const currency = (value: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0,
  }).format(value);

const runtimeEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

const javaApiClient = runtimeEnv.VITE_JAVA_API_BASE_URL
  ? createJavaProcurementApiClient({
      baseUrl: runtimeEnv.VITE_JAVA_API_BASE_URL,
      platformLogin: {
        account: runtimeEnv.VITE_JAVA_PLATFORM_ACCOUNT ?? 'platform',
        password: runtimeEnv.VITE_JAVA_PLATFORM_PASSWORD ?? 'demo123456',
        scope: 'PLATFORM',
      },
      buyerLogin: {
        account: runtimeEnv.VITE_JAVA_BUYER_ACCOUNT ?? 'buyer',
        password: runtimeEnv.VITE_JAVA_BUYER_PASSWORD ?? 'demo123456',
        scope: 'BUYER',
        tenantId: runtimeEnv.VITE_JAVA_BUYER_TENANT_ID ?? 'tenant-acme',
      },
      supplierLogin: {
        account: runtimeEnv.VITE_JAVA_SUPPLIER_ACCOUNT ?? 'supplier',
        password: runtimeEnv.VITE_JAVA_SUPPLIER_PASSWORD ?? 'demo123456',
        scope: 'SUPPLIER',
        supplierId: runtimeEnv.VITE_JAVA_SUPPLIER_ID ?? 'ent-supplier-sunrise',
      },
    })
  : null;

const App: React.FC = () => {
  const [mode, setMode] = useState<WorkspaceMode>('buyer');
  const [tenantId, setTenantId] = useState('tenant-acme');
  const [supplierId, setSupplierId] = useState('supplier-orbit');
  const [platformData, setPlatformData] = useState<PlatformWorkspaceData | null>(null);
  const [buyerData, setBuyerData] = useState<{
    workspace: BuyerWorkspace;
    kpis: TenantKpis;
    pendingApprovals: JavaApprovalTaskDto[];
  } | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierWorkspace | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);
  const [approvalBusyId, setApprovalBusyId] = useState<string | null>(null);

  const refreshJavaBuyerData = async (currentBuyerData: NonNullable<typeof buyerData>) => {
    if (!javaApiClient) return currentBuyerData;
    const javaBuyerMasterData = await loadJavaBuyerMasterData(javaApiClient);
    return {
      ...currentBuyerData,
      workspace: applyJavaBuyerMasterData(currentBuyerData.workspace, javaBuyerMasterData),
      pendingApprovals: javaBuyerMasterData.pendingApprovals,
      kpis: {
        ...currentBuyerData.kpis,
        pendingApprovals: javaBuyerMasterData.pendingApprovals.length,
      },
    };
  };

  useEffect(() => {
    let active = true;
    setLoadError(null);
    Promise.all([
      procurementApiClient.getPlatformWorkspace(),
      procurementApiClient.getBuyerWorkspace(tenantId),
      procurementApiClient.getSupplierWorkspace(supplierId),
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
        setBuyerData({
          ...nextBuyer,
          workspace: buyerWorkspace,
          pendingApprovals,
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
  }, [tenantId, supplierId]);

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

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-slate-900">
        <div className="rounded-lg border border-red-100 bg-white p-6 shadow-sm">
          <p className="text-sm font-black text-red-600">加载失败</p>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!platformData || !buyerData || !supplierData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-bold text-slate-500">
        正在加载采购工作台...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <AppSidebar mode={mode} setMode={setMode} />
      <main className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          mode={mode}
          model={platformData.model}
          tenantId={tenantId}
          supplierId={supplierId}
          setTenantId={setTenantId}
          setSupplierId={setSupplierId}
        />
        <section className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl space-y-6 p-6">
            {mode === 'platform' && <PlatformWorkspace data={platformData} />}
            {mode === 'buyer' && (
              <BuyerWorkspaceView
                workspace={buyerData.workspace}
                kpis={buyerData.kpis}
                pendingApprovals={buyerData.pendingApprovals}
                approvalBusyId={approvalBusyId}
                javaEnabled={Boolean(javaApiClient)}
                workflowBusy={workflowBusy}
                workflowStatus={workflowStatus}
                onRunJavaWorkflow={runJavaWorkflow}
                onReviewApproval={reviewApprovalTask}
              />
            )}
            {mode === 'supplier' && <SupplierWorkspaceView workspace={supplierData} />}
          </div>
        </section>
      </main>
    </div>
  );
};

const AppSidebar: React.FC<{
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
}> = ({ mode, setMode }) => {
  const navItems = [
    { id: 'platform' as const, label: '平台运营台', desc: '租户 / 套餐 / 审核', icon: Layers3 },
    { id: 'buyer' as const, label: '采购方工作台', desc: '需求到付款闭环', icon: ShoppingCart },
    { id: 'supplier' as const, label: '供应商工作台', desc: '报价 / 交付 / 发票', icon: Truck },
  ];

  return (
    <aside className="flex w-72 shrink-0 flex-col bg-slate-950 text-white">
      <div className="border-b border-white/10 p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/40">
            24
          </div>
          <div>
            <p className="text-lg font-black leading-none">24Bid</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-blue-300">Procurement SaaS</p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
          <p className="text-xs font-bold text-blue-200">MVP 主线</p>
          <p className="mt-1 text-sm font-semibold text-white">需求申请 - 询价比价 - 订单履约 - 发票付款</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setMode(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
                active ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span>
                <span className="block text-sm font-bold">{item.label}</span>
                <span className={`block text-xs ${active ? 'text-blue-100' : 'text-slate-500'}`}>{item.desc}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="rounded-lg bg-white/5 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <LockKeyhole size={14} />
            多租户隔离
          </div>
          <p className="mt-2 text-sm text-slate-300">采购数据、供应商私域关系、订单和财务记录按采购企业隔离。</p>
        </div>
      </div>
    </aside>
  );
};

const AppHeader: React.FC<{
  mode: WorkspaceMode;
  model: ProcurementMvpModel;
  tenantId: string;
  supplierId: string;
  setTenantId: (id: string) => void;
  setSupplierId: (id: string) => void;
}> = ({ mode, model, tenantId, supplierId, setTenantId, setSupplierId }) => {
  const buyerTenants = model.tenants;
  const suppliers = model.enterprises.filter((enterprise) => enterprise.type === 'supplier');
  const title =
    mode === 'platform'
      ? '平台运营总览'
      : mode === 'buyer'
        ? buyerTenants.find((tenant) => tenant.id === tenantId)?.name
        : suppliers.find((supplier) => supplier.id === supplierId)?.name;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">当前工作区</p>
          <h1 className="truncate text-lg font-black text-slate-900">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {mode === 'buyer' && (
          <Select value={tenantId} onChange={setTenantId}>
            {buyerTenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.name}
              </option>
            ))}
          </Select>
        )}
        {mode === 'supplier' && (
          <Select value={supplierId} onChange={setSupplierId}>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        )}
        <div className="relative hidden w-80 md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            placeholder="搜索企业、询价、订单、供应商"
          />
        </div>
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

const PlatformWorkspace: React.FC<{ data: PlatformWorkspaceData }> = ({ data }) => {
  const { model, platformOverview } = data;
  const supplierCount = platformOverview?.publicSupplierCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'supplier').length;
  const buyerCount = platformOverview?.tenantCount
    ?? model.enterprises.filter((enterprise) => enterprise.type === 'buyer').length;
  const pendingTenantCount = platformOverview?.pendingEnterpriseReviews
    ?? model.tenants.filter((tenant) => tenant.status === '待审核').length;

  return (
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

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="租户运营台" icon={Layers3}>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">企业</th>
                  <th className="px-4 py-3">套餐</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3 text-right">用户上限</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.tenants.map((tenant) => (
                  <tr key={tenant.id}>
                    <td className="px-4 py-4 font-bold text-slate-900">{tenant.name}</td>
                    <td className="px-4 py-4 text-slate-600">{tenant.plan}</td>
                    <td className="px-4 py-4">
                      <StatusPill label={tenant.status} />
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold">{tenant.userLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

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
      </div>
    </>
  );
};

const BuyerWorkspaceView: React.FC<{
  workspace: BuyerWorkspace;
  kpis: TenantKpis;
  pendingApprovals: JavaApprovalTaskDto[];
  approvalBusyId: string | null;
  javaEnabled: boolean;
  workflowBusy: boolean;
  workflowStatus: string | null;
  onRunJavaWorkflow: () => void;
  onReviewApproval: (approval: JavaApprovalTaskDto, approved: boolean) => void;
}> = ({
  workspace,
  kpis,
  pendingApprovals,
  approvalBusyId,
  javaEnabled,
  workflowBusy,
  workflowStatus,
  onRunJavaWorkflow,
  onReviewApproval,
}) => (
  <>
    <HeroBand
      eyebrow="采购方企业后台"
      title="从需求申请到发票付款的询价比价闭环"
      desc="采购方维护组织、物料、私域供应商关系，并对需求、定标、订单和财务状态负责。"
    />

    {javaEnabled && (
      <div className="flex flex-col gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-blue-950">Java MVP 主流程联调</p>
          {workflowStatus && <p className="mt-1 text-sm font-bold text-blue-700">{workflowStatus}</p>}
        </div>
        <button
          type="button"
          onClick={onRunJavaWorkflow}
          disabled={workflowBusy}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <Send size={16} />
          {workflowBusy ? '执行中' : '跑通主流程'}
        </button>
      </div>
    )}

    <div className="grid gap-4 md:grid-cols-5">
      <MetricCard icon={WalletCards} label="采购金额" value={currency(kpis.totalSpend)} tone="blue" />
      <MetricCard icon={ClipboardCheck} label="待审批需求" value={`${kpis.pendingApprovals} 条`} tone="amber" />
      <MetricCard icon={Send} label="进行中询价" value={`${kpis.activeRfqs} 个`} tone="green" />
      <MetricCard icon={Truck} label="履约进度" value={`${kpis.fulfillmentRate}%`} tone="slate" />
      <MetricCard icon={Users} label="私域供应商" value={`${kpis.supplierCount} 家`} tone="blue" />
    </div>

    <Panel title="MVP 业务主线" icon={Activity}>
      <WorkflowRail steps={workspace.workflow} />
    </Panel>

    {javaEnabled && (
      <Panel title="审批待办" icon={ClipboardCheck}>
        {pendingApprovals.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-3">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">
                      {approval.summaryTitle || approval.bizId}
                    </p>
                    <p className="mt-1 text-xs font-bold text-amber-700">{approvalTypeLabel(approval.bizType)}</p>
                  </div>
                  <StatusPill label={approval.status} />
                </div>
                <div className="mt-3 space-y-2 text-xs font-bold text-slate-500">
                  {approval.counterpartyName && <p>{approval.counterpartyName}</p>}
                  {typeof approval.amount === 'number' && (
                    <p className="font-mono text-sm font-black text-slate-900">{currency(approval.amount)}</p>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onReviewApproval(approval, false)}
                    disabled={approvalBusyId === approval.id}
                    className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white text-xs font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    驳回
                  </button>
                  <button
                    type="button"
                    onClick={() => onReviewApproval(approval, true)}
                    disabled={approvalBusyId === approval.id}
                    className="inline-flex h-9 items-center justify-center rounded-lg bg-emerald-600 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {approvalBusyId === approval.id ? '处理中' : '通过'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm font-bold text-slate-500">
            当前没有待审批事项
          </p>
        )}
      </Panel>
    )}

    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <Panel title="采购需求与物料目录" icon={Database}>
        <div className="space-y-3">
          {workspace.demands.map((demand) => (
            <div key={demand.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{demand.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {demand.department} · {demand.requester}
                  </p>
                </div>
                <StatusPill label={demand.status} />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs font-bold text-slate-500">预算</span>
                <span className="font-mono font-black text-slate-900">{currency(demand.budget)}</span>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="询价比价与定标" icon={BarChart3}>
        <div className="space-y-4">
          {workspace.rfqs.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} workspace={workspace} />
          ))}
        </div>
      </Panel>
    </div>

    <div className="grid gap-6 lg:grid-cols-3">
      <Panel title="私域供应商关系" icon={Users}>
        <div className="space-y-3">
          {workspace.privateSupplierRelations.map((relation) => {
            const supplier = workspace.suppliers.find((item) => item.id === relation.supplierId);
            return (
              <div key={relation.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-black">{supplier?.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{relation.categories.join(' / ')}</p>
                  </div>
                  <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{relation.level}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <StatusPill label={relation.status} />
                  <span className="font-mono font-bold text-slate-700">{relation.performanceScore} 分</span>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="订单履约" icon={PackageCheck}>
        <SimpleList
          rows={workspace.orders.map((order) => ({
            id: order.id,
            title: order.id,
            meta: `${workspace.suppliers.find((supplier) => supplier.id === order.supplierId)?.name} · ${order.expectedReceiptDate}`,
            value: currency(order.amount),
            status: order.status,
          }))}
        />
      </Panel>

      <Panel title="发票付款" icon={Receipt}>
        <SimpleList
          rows={workspace.invoices.map((invoice) => ({
            id: invoice.id,
            title: invoice.id,
            meta: `订单 ${invoice.orderId}`,
            value: currency(invoice.amount),
            status: invoice.paymentStatus,
          }))}
        />
      </Panel>
    </div>
  </>
);

const SupplierWorkspaceView: React.FC<{ workspace: SupplierWorkspace }> = ({ workspace }) => (
  <>
    <HeroBand
      eyebrow="供应商协同中心"
      title="一次注册，多采购方协作"
      desc="供应商维护企业档案与资质，接收不同采购方的询价邀请，但报价、订单、发票按采购方隔离。"
    />

    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard icon={Building2} label="合作采购方" value={`${workspace.connectedBuyerNames.length} 家`} tone="blue" />
      <MetricCard icon={Send} label="询价邀请" value={`${workspace.opportunities.length} 个`} tone="green" />
      <MetricCard icon={ShoppingCart} label="销售订单" value={`${workspace.orders.length} 单`} tone="slate" />
      <MetricCard icon={CreditCard} label="待回款发票" value={`${workspace.invoices.filter((invoice) => invoice.paymentStatus !== '已付款').length} 张`} tone="amber" />
    </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <Panel title="商机与报价" icon={Send}>
        <div className="space-y-4">
          {workspace.opportunities.map((rfq) => (
            <div key={rfq.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{rfq.title}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {rfq.id} · 截止 {rfq.deadline}
                  </p>
                </div>
                <StatusPill label={rfq.status} />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {rfq.quotes
                  .filter((quote) => quote.supplierId === workspace.supplier.id)
                  .map((quote) => (
                    <div key={quote.id} className="rounded-lg bg-orange-50 p-3">
                      <p className="text-xs font-bold text-orange-700">我的报价</p>
                      <p className="mt-1 font-mono text-lg font-black text-slate-900">{currency(quote.amount)}</p>
                      <p className="text-xs text-slate-500">{quote.deliveryDays} 天交付</p>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

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
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <Panel title="销售订单与发货" icon={Truck}>
        <SimpleList
          rows={workspace.orders.map((order) => ({
            id: order.id,
            title: order.id,
            meta: `采购方租户 ${order.tenantId}`,
            value: currency(order.amount),
            status: order.status,
          }))}
        />
      </Panel>
      <Panel title="发票与应收" icon={Receipt}>
        <SimpleList
          rows={workspace.invoices.map((invoice) => ({
            id: invoice.id,
            title: invoice.id,
            meta: `订单 ${invoice.orderId}`,
            value: currency(invoice.amount),
            status: invoice.paymentStatus,
          }))}
        />
      </Panel>
    </div>
  </>
);

const HeroBand: React.FC<{
  eyebrow: string;
  title: string;
  desc: string;
}> = ({ eyebrow, title, desc }) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    <div className="grid gap-5 p-6 lg:grid-cols-[1fr_320px] lg:items-center">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-blue-600">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-black leading-tight text-slate-950">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{desc}</p>
      </div>
      <div className="rounded-lg bg-slate-950 p-4 text-white">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-300">
          <CheckCircle2 size={15} />
          Phase 1 MVP
        </div>
        <div className="mt-4 space-y-2 text-sm font-semibold">
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
}> = ({ rfq, workspace }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-black text-slate-900">{rfq.title}</p>
        <p className="mt-1 text-sm text-slate-500">
          {rfq.id} · 负责人 {rfq.owner} · 截止 {rfq.deadline}
        </p>
      </div>
      <StatusPill label={rfq.status} />
    </div>

    <div className="mt-4 space-y-2">
      {rfq.quotes.length === 0 ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-500">暂无报价，等待供应商响应。</div>
      ) : (
        rfq.quotes.map((quote) => {
          const supplier = workspace.suppliers.find((item) => item.id === quote.supplierId);
          const awarded = rfq.awardedSupplierId === quote.supplierId;
          return (
            <div
              key={quote.id}
              className={`flex items-center justify-between rounded-lg border p-3 ${
                awarded ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div>
                <p className="font-bold text-slate-900">{supplier?.name}</p>
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
}> = ({ rows }) => (
  <div className="space-y-3">
    {rows.map((row) => (
      <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-black text-slate-900">{row.title}</p>
            <p className="mt-1 text-sm text-slate-500">{row.meta}</p>
          </div>
          <p className="font-mono font-black text-slate-900">{row.value}</p>
        </div>
        <div className="mt-3">
          <StatusPill label={row.status} />
        </div>
      </div>
    ))}
  </div>
);

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
  const isWarning = ['审批中', '报价中', '待付款', '待供应商确认', '待收货', '运输中', '试用中', '待准入', '进行中'].includes(label);
  const classes = isPositive
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : isWarning
      ? 'bg-amber-50 text-amber-700 border-amber-100'
      : 'bg-slate-100 text-slate-600 border-slate-200';

  return <span className={`inline-flex rounded-lg border px-2 py-1 text-xs font-black ${classes}`}>{label}</span>;
};

export default App;
