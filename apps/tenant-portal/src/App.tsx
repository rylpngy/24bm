import { useEffect, useMemo, useState } from 'react';
import { Construction, ShieldAlert } from 'lucide-react';
import { buyerNavigation, hasPermission } from '@24bid/shared';
import { useBuyerRoleMyPermissions } from '@24bid/api-client';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { DemandsPage } from './features/demands/demands-page';
import { ApprovalsPage } from './features/approvals/approvals-page';
import { SuppliersPage } from './features/suppliers/suppliers-page';
import { MaterialsPage } from './features/materials/materials-page';
import { RfqsPage } from './features/rfqs/rfqs-page';
import { OrdersPage } from './features/orders/orders-page';
import { InvoicesPage } from './features/finance/invoices-page';
import { PaymentBatchesPage } from './features/finance/payment-batches-page';
import { ContractsPage } from './features/contracts/contracts-page';
import { DashboardPage } from './features/dashboard/dashboard-page';
import { AnalyticsPage } from './features/analytics/analytics-page';
import { BudgetsPage } from './features/budgets/budgets-page';
import { AuditPage } from './features/audit/audit-page';
import { QuoteComparisonPage } from './features/quotes/quote-comparison-page';
import { TeamPage } from './features/team/team-page';
import { OrgStructurePage } from './features/org/org-structure-page';

export function App() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState('dashboard');

  // 当前用户的有效权限点 → 菜单/路由门禁。仅登录后查询。
  const permsQuery = useBuyerRoleMyPermissions({ query: { enabled: !!session } });
  const grantedKey = (permsQuery.data?.data?.permissions ?? []).join(',');
  const visibleModules = useMemo(() => {
    const granted = grantedKey ? grantedKey.split(',') : [];
    return buyerNavigation.modules.filter(
      (m) => !m.requiredPermission || hasPermission(granted, m.requiredPermission),
    );
  }, [grantedKey]);

  // 当前模块若因权限收紧而不可见,回落到首页看板。
  useEffect(() => {
    if (activeModuleId !== 'dashboard' && !visibleModules.some((m) => m.id === activeModuleId)) {
      setActiveModuleId('dashboard');
    }
  }, [visibleModules, activeModuleId]);

  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);
  const permitted = visibleModules.some((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  return (
    <AppShell
      brandSubtitle={buyerNavigation.label}
      mainlineHint="需求申请 - 询价比价 - 订单履约 - 发票付款"
      modules={visibleModules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
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
        <DashboardPage />
      ) : activeModuleId === 'analytics' ? (
        <AnalyticsPage />
      ) : activeModuleId === 'budgets' ? (
        <BudgetsPage />
      ) : activeModuleId === 'demands' ? (
        <DemandsPage />
      ) : activeModuleId === 'approvals' ? (
        <ApprovalsPage />
      ) : activeModuleId === 'suppliers' ? (
        <SuppliersPage />
      ) : activeModuleId === 'materials' ? (
        <MaterialsPage />
      ) : activeModuleId === 'rfqs' ? (
        <RfqsPage />
      ) : activeModuleId === 'orders' || activeModuleId === 'receipts' ? (
        <OrdersPage />
      ) : activeModuleId === 'invoices' ? (
        <InvoicesPage />
      ) : activeModuleId === 'payment-batches' ? (
        <PaymentBatchesPage />
      ) : activeModuleId === 'quotes' ? (
        <QuoteComparisonPage />
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
