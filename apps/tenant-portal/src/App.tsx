import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Construction, ShieldAlert } from 'lucide-react';
import { buyerNavigation, hasPermission } from '@24bid/shared';
import { useSessionPermissions, useBuyerCapabilityCapabilities } from '@24bid/api-client';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { PageErrorBoundary } from './lib/page-error-boundary';
import { PortalLanding } from './features/portal/portal-landing';
const DemandsPage = lazy(() => import('./features/demands/demands-page').then((module) => ({ default: module.DemandsPage })));
const ProcurementPlansPage = lazy(() => import('./features/procurement-plans/procurement-plans-page').then((module) => ({ default: module.ProcurementPlansPage })));
const MallPage = lazy(() => import('./features/mall/mall-page').then((module) => ({ default: module.MallPage })));
const ApprovalsPage = lazy(() => import('./features/approvals/approvals-page').then((module) => ({ default: module.ApprovalsPage })));
const SuppliersPage = lazy(() => import('./features/suppliers/suppliers-page').then((module) => ({ default: module.SuppliersPage })));
const MaterialsPage = lazy(() => import('./features/materials/materials-page').then((module) => ({ default: module.MaterialsPage })));
const RfqsPage = lazy(() => import('./features/rfqs/rfqs-page').then((module) => ({ default: module.RfqsPage })));
const OrdersPage = lazy(() => import('./features/orders/orders-page').then((module) => ({ default: module.OrdersPage })));
const ReceiptsPage = lazy(() => import('./features/receipts/receipts-page').then((module) => ({ default: module.ReceiptsPage })));
const AuctionsPage = lazy(() => import('./features/auctions/auctions-page').then((module) => ({ default: module.AuctionsPage })));
const TendersPage = lazy(() => import('./features/tenders/tenders-page').then((module) => ({ default: module.TendersPage })));
const InvoicesPage = lazy(() => import('./features/finance/invoices-page').then((module) => ({ default: module.InvoicesPage })));
const ContractsPage = lazy(() => import('./features/contracts/contracts-page').then((module) => ({ default: module.ContractsPage })));
const DashboardPage = lazy(() => import('./features/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })));
const AnalyticsPage = lazy(() => import('./features/analytics/analytics-page').then((module) => ({ default: module.AnalyticsPage })));
const BudgetsPage = lazy(() => import('./features/budgets/budgets-page').then((module) => ({ default: module.BudgetsPage })));
const AuditPage = lazy(() => import('./features/audit/audit-page').then((module) => ({ default: module.AuditPage })));
const TeamPage = lazy(() => import('./features/team/team-page').then((module) => ({ default: module.TeamPage })));
const NumberingRulesPage = lazy(() => import('./features/settings/numbering-rules-page').then((module) => ({ default: module.NumberingRulesPage })));
const AiPoliciesPage = lazy(() => import('./features/ai/ai-policies-page').then((module) => ({ default: module.AiPoliciesPage })));
const OrgStructurePage = lazy(() => import('./features/org/org-structure-page').then((module) => ({ default: module.OrgStructurePage })));
const ProcessEnginePage = lazy(() => import('./features/process/process-engine-page').then((module) => ({ default: module.ProcessEnginePage })));
const LudongPocApp = lazy(() => import('./features/ludong-poc/ludong-poc-app').then((module) => ({ default: module.LudongPocApp })));

const initialModuleId = () => {
  if (typeof window === 'undefined') return 'dashboard';
  return new URLSearchParams(window.location.search).get('module') ?? 'dashboard';
};

export function App() {
  const isLudongPoc = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('solution') === 'ludong-poc';
  return <PageErrorBoundary><Suspense fallback={<PageLoading />}>
    {isLudongPoc ? <LudongPocApp /> : <TenantPortalApp />}
  </Suspense></PageErrorBoundary>;
}

function PageLoading() {
  return <div role="status" className="p-6 text-sm text-slate-500">正在加载...</div>;
}

function TenantPortalApp() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState(initialModuleId);

  useEffect(() => {
    const handlePopState = () => setActiveModuleId(initialModuleId());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // 当前用户的有效权限点 → 菜单/路由门禁。仅登录后查询。
  const permsQuery = useSessionPermissions(session?.userId);
  const grantedKey = (permsQuery.isError ? [] : permsQuery.data?.data?.permissions ?? []).join(',');

  // Procurement capabilities gate new work; explicitly retained historical modules remain readable.
  const capabilityQuery = useBuyerCapabilityCapabilities({ query: { enabled: !!session } });
  const capability = capabilityQuery.data?.data;
  const enabledModuleKey = (capability?.moduleIds ?? []).join(',');
  const gatedModuleKey = (capability?.methodGatedModuleIds ?? []).join(',');
  const historicalModuleKey = (capability?.historicalModuleIds ?? []).join(',');

  const visibleModules = useMemo(() => {
    const granted = grantedKey ? grantedKey.split(',') : [];
    const enabled = enabledModuleKey ? enabledModuleKey.split(',') : [];
    const gated = gatedModuleKey ? gatedModuleKey.split(',') : [];
    const historical = historicalModuleKey ? historicalModuleKey.split(',') : [];
    return buyerNavigation.modules.filter((m) => {
      if (m.requiredPermission && !hasPermission(granted, m.requiredPermission)) return false;
      // Do not hide historical fulfillment when a procurement method is disabled.
      if (gated.length > 0 && gated.includes(m.id) && !enabled.includes(m.id) && !historical.includes(m.id)) return false;
      return true;
    });
  }, [grantedKey, enabledModuleKey, gatedModuleKey, historicalModuleKey]);

  // 当前模块若因权限收紧而不可见,回落到首页看板。
  useEffect(() => {
    if (!session || permsQuery.isLoading || capabilityQuery.isLoading) return;
    if (activeModuleId !== 'dashboard' && !visibleModules.some((m) => m.id === activeModuleId)) {
      setActiveModuleId('dashboard');
    }
  }, [visibleModules, activeModuleId, session, permsQuery.isLoading, capabilityQuery.isLoading]);

  const selectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    const url = new URL(window.location.href);
    url.searchParams.set('module', moduleId);
    url.searchParams.delete('recordId');
    if (url.href !== window.location.href) window.history.pushState(null, '', url.toString());
  };

  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);
  const permitted = visibleModules.some((m) => m.id === activeModuleId);

  // ?portal=1:登录态下也可回看系统门户(顶栏「门户首页」入口)。
  const forcePortal = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('portal') === '1';
  if (!session || forcePortal) {
    return <PortalLanding />;
  }

  if (permsQuery.isPending) return <PageLoading />;
  if (permsQuery.isError) return <div className="p-6"><FeedbackNotice tone="error" message="权限加载失败，请重试。" /><button type="button" onClick={() => void permsQuery.refetch()}>重新加载</button></div>;

  return (
    <AppShell
      brandSubtitle={buyerNavigation.label}
      mainlineHint="需求申请 - 询比报价 - 订单履约 - 发票付款"
      modules={visibleModules}
      activeModuleId={activeModuleId}
      onSelectModule={selectModule}
      portalUrl="/?portal=1"
      aiModuleId="analytics"
      title={activeModule?.label ?? '企业工作台'}
      accountLabel={`${session.displayName} · ${session.tenantId}`}
    >
      <PageErrorBoundary key={activeModuleId}><Suspense fallback={<PageLoading />}>
      {capabilityQuery.isError && <FeedbackNotice tone="error" message="业务能力配置加载失败，新增业务开通状态尚未确认，请刷新后重试。" />}
      {historicalModuleKey.split(',').includes(activeModuleId) && gatedModuleKey.split(',').includes(activeModuleId)
        && !enabledModuleKey.split(',').includes(activeModuleId) && <FeedbackNotice tone="info" message="此采购方式已停止新增业务，仍可按权限查看历史资料并办理既有业务；新增操作须先由平台开通。" />}
      {!permitted ? (
        <Panel title={activeModule?.label ?? '无权限'} icon={ShieldAlert} subtitle="访问受限">
          <FeedbackNotice
            tone="error"
            message={`当前角色无「${activeModule?.label ?? '该模块'}」访问权限。请联系管理员在「团队与权限」中授予。`}
          />
        </Panel>
      ) : activeModuleId === 'dashboard' ? (
        <DashboardPage onNavigate={selectModule} />
      ) : activeModuleId === 'analytics' ? (
        <AnalyticsPage />
      ) : activeModuleId === 'budgets' ? (
        <BudgetsPage />
      ) : activeModuleId === 'demands' ? (
        <DemandsPage onNavigate={selectModule} />
      ) : activeModuleId === 'procurement-plans' ? (
        <ProcurementPlansPage onNavigate={selectModule} />
      ) : activeModuleId === 'approvals' ? (
        <ApprovalsPage />
      ) : activeModuleId === 'suppliers' ? (
        <SuppliersPage />
      ) : activeModuleId === 'materials' ? (
        <MaterialsPage />
      ) : activeModuleId === 'mall' ? (
        <MallPage onNavigate={selectModule} />
      ) : activeModuleId === 'rfqs' ? (
        <RfqsPage />
      ) : activeModuleId === 'auctions' ? (
        <AuctionsPage onNavigate={selectModule} />
      ) : activeModuleId === 'tenders' ? (
        <TendersPage />
      ) : activeModuleId === 'receipts' ? (
        <ReceiptsPage />
      ) : activeModuleId === 'orders' ? (
        <OrdersPage onNavigate={selectModule} />
      ) : activeModuleId === 'invoices' ? (
        <InvoicesPage />
      ) : activeModuleId === 'process-engine' ? (
        <ProcessEnginePage />
      ) : activeModuleId === 'org' ? (
        <OrgStructurePage />
      ) : activeModuleId === 'team' ? (
        <TeamPage />
      ) : activeModuleId === 'numbering-rules' ? (
        <NumberingRulesPage />
      ) : activeModuleId === 'ai-policies' ? (
        <AiPoliciesPage />
      ) : activeModuleId === 'audit' ? (
        <AuditPage />
      ) : activeModuleId === 'contracts' ? (
        <ContractsPage />
      ) : (
        <Panel title={activeModule?.label ?? '模块'} icon={Construction} subtitle="后续切片实现">
          <FeedbackNotice
            tone="info"
            message={`「${activeModule?.label}」将在后续垂直切片中接通真实后端。`}
          />
        </Panel>
      )}
      </Suspense></PageErrorBoundary>
    </AppShell>
  );
}
