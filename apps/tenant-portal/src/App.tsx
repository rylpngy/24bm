import { useEffect, useMemo, useState } from 'react';
import { Construction, ShieldAlert } from 'lucide-react';
import { buyerNavigation, hasPermission } from '@24bid/shared';
import { useBuyerRoleMyPermissions, useBuyerCapabilityCapabilities } from '@24bid/api-client';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { PortalLanding } from './features/portal/portal-landing';
import { DemandsPage } from './features/demands/demands-page';
import { ProcurementPlansPage } from './features/procurement-plans/procurement-plans-page';
import { MallPage } from './features/mall/mall-page';
import { ApprovalsPage } from './features/approvals/approvals-page';
import { SuppliersPage } from './features/suppliers/suppliers-page';
import { MaterialsPage } from './features/materials/materials-page';
import { RfqsPage } from './features/rfqs/rfqs-page';
import { OrdersPage } from './features/orders/orders-page';
import { ReceiptsPage } from './features/receipts/receipts-page';
import { AuctionsPage } from './features/auctions/auctions-page';
import { TendersPage } from './features/tenders/tenders-page';
import { InvoicesPage } from './features/finance/invoices-page';
import { ContractsPage } from './features/contracts/contracts-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { AnalyticsPage } from './features/analytics/analytics-page';
import { BudgetsPage } from './features/budgets/budgets-page';
import { AuditPage } from './features/audit/audit-page';
import { TeamPage } from './features/team/team-page';
import { OrgStructurePage } from './features/org/org-structure-page';
import { ProcessEnginePage } from './features/process/process-engine-page';
import { LudongPocApp } from './features/ludong-poc/ludong-poc-app';

const initialModuleId = () => {
  if (typeof window === 'undefined') return 'dashboard';
  return new URLSearchParams(window.location.search).get('module') ?? 'dashboard';
};

export function App() {
  const isLudongPoc = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('solution') === 'ludong-poc';
  return isLudongPoc ? <LudongPocApp /> : <TenantPortalApp />;
}

function TenantPortalApp() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState(initialModuleId);

  // 当前用户的有效权限点 → 菜单/路由门禁。仅登录后查询。
  const permsQuery = useBuyerRoleMyPermissions({ query: { enabled: !!session } });
  const grantedKey = (permsQuery.data?.data?.permissions ?? []).join(',');

  // M-0 采购方式能力:未开通的方式,其模块不进导航(后端同口径拒绝,不是仅隐藏)。
  const capabilityQuery = useBuyerCapabilityCapabilities({ query: { enabled: !!session } });
  const capability = capabilityQuery.data?.data;
  const enabledModuleKey = (capability?.moduleIds ?? []).join(',');
  const gatedModuleKey = (capability?.methodGatedModuleIds ?? []).join(',');

  const visibleModules = useMemo(() => {
    const granted = grantedKey ? grantedKey.split(',') : [];
    const enabled = enabledModuleKey ? enabledModuleKey.split(',') : [];
    const gated = gatedModuleKey ? gatedModuleKey.split(',') : [];
    return buyerNavigation.modules.filter((m) => {
      if (m.requiredPermission && !hasPermission(granted, m.requiredPermission)) return false;
      // 能力未加载完成前不误伤:只有拿到清单后才对「受方式管辖」的模块过滤。
      if (gated.length > 0 && gated.includes(m.id) && !enabled.includes(m.id)) return false;
      return true;
    });
  }, [grantedKey, enabledModuleKey, gatedModuleKey]);

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
    window.history.replaceState(null, '', url.toString());
  };

  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);
  const permitted = visibleModules.some((m) => m.id === activeModuleId);

  // ?portal=1:登录态下也可回看系统门户(顶栏「门户首页」入口)。
  const forcePortal = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('portal') === '1';
  if (!session || forcePortal) {
    return <PortalLanding />;
  }

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
    </AppShell>
  );
}
