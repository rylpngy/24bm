import { useState } from 'react';
import { Construction } from 'lucide-react';
import { hasPermission, supplierNavigation, visiblePortalModules } from '@24bid/shared';
import { useSessionPermissions } from '@24bid/api-client';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { OverviewPage } from './features/overview/overview-page';
import { OpportunitiesPage } from './features/opportunities/opportunities-page';
import { RfqProjectsPage } from './features/projects/rfq-projects-page';
import { AuctionProjectsPage } from './features/projects/auction-projects-page';
import { MallProjectsPage } from './features/projects/mall-projects-page';
import { TenderProjectsPage } from './features/projects/tender-projects-page';
import { OrdersPage } from './features/orders/orders-page';
import { ShelfPage } from './features/shelf/shelf-page';
import { ReceivablesPage } from './features/receivables/receivables-page';
import { ProfilePage } from './features/profile/profile-page';
import { DeliveriesPage } from './features/deliveries/deliveries-page';
import { ReconciliationsPage } from './features/reconciliations/reconciliations-page';
import { QualificationsPage } from './features/qualifications/qualifications-page';
import { TeamPage } from './features/team/team-page';
import { PerformanceTasksPage } from './features/performance/performance-tasks-page';

export function App() {
  const session = useAuthStore((s) => s.session);
  const permissions = useSessionPermissions(session?.userId);
  const granted = permissions.isError ? [] : permissions.data?.data.permissions ?? [];
  const modules = visiblePortalModules(supplierNavigation, granted);
  const [requestedModuleId, setActiveModuleId] = useState(
    () => new URLSearchParams(window.location.search).get('module') ?? 'overview',
  );
  const activeModuleId = modules.some(m => m.id === requestedModuleId) ? requestedModuleId : modules[0]?.id ?? '';
  // 深链接:模块选择同步进 ?module=,刷新/分享链接可直达。
  const selectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    const url = new URL(window.location.href);
    url.searchParams.set('module', moduleId);
    url.searchParams.delete('rfq');
    window.history.replaceState(null, '', url.toString());
  };
  // 项目详情深链:?rfq= 叠加在当前项目模块(询价项目/竞价项目)上,返回键回本模块台账。
  const rfqParam = new URLSearchParams(window.location.search).get('rfq');
  const openProject = (rfqId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('rfq', rfqId);
    window.location.href = url.toString();
  };
  const exitProjectDetail = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('rfq');
    window.location.href = url.toString();
  };
  const activeModule = supplierNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  if (permissions.isPending || permissions.isError || modules.length === 0) {
    return <div className="p-6"><FeedbackNotice tone={permissions.isPending ? 'info' : 'error'} message={permissions.isPending ? '正在读取权限…' : permissions.isError ? '权限读取失败，请重试。' : '当前账号未分配可访问的模块，请联系管理员。'} /><button type="button" className="mt-4 text-sm text-blue-700" onClick={() => useAuthStore.getState().signOut()}>退出登录</button></div>;
  }

  return (
    <AppShell
      brandSubtitle={supplierNavigation.label}
      mainlineHint="询价 / 竞价 / 商城项目 - 报价 - 订单履约 - 发票应收"
      modules={modules}
      activeModuleId={activeModuleId}
      onSelectModule={selectModule}
      portalUrl={import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5173'}
      title={activeModule?.label ?? '供应商门户'}
      accountLabel={`${session.displayName} · ${session.supplierId}`}
    >
      {activeModuleId === 'overview' ? (
        <OverviewPage onNavigate={selectModule} />
      ) : activeModuleId === 'rfq-projects' ? (
        rfqParam ? (
          <OpportunitiesPage onExitDetail={exitProjectDetail} />
        ) : (
          <RfqProjectsPage onOpenProject={openProject} />
        )
      ) : activeModuleId === 'auction-projects' ? (
        rfqParam ? (
          <OpportunitiesPage onExitDetail={exitProjectDetail} />
        ) : (
          <AuctionProjectsPage onOpenProject={openProject} />
        )
      ) : activeModuleId === 'mall-projects' ? (
        <MallProjectsPage onOpenOrders={() => selectModule('orders')} />
      ) : activeModuleId === 'tender-projects' ? (
        <TenderProjectsPage />
      ) : activeModuleId === 'orders' ? (
        <OrdersPage canConfirm={hasPermission(granted, 'supplier:order:manage')} canShip={hasPermission(granted, 'supplier:delivery:manage')} canInvoice={hasPermission(granted, 'supplier:invoice:manage')} />
      ) : activeModuleId === 'deliveries' ? (
        <DeliveriesPage />
      ) : activeModuleId === 'shelf' ? (
        <ShelfPage />
      ) : activeModuleId === 'invoices' ? (
        <ReceivablesPage />
      ) : activeModuleId === 'reconciliations' ? (
        <ReconciliationsPage />
      ) : activeModuleId === 'profile' ? (
        <ProfilePage />
      ) : activeModuleId === 'qualifications' ? (
        <QualificationsPage canManage={hasPermission(granted, 'supplier:qualification:manage')} />
      ) : activeModuleId === 'performance-tasks' ? (
        <PerformanceTasksPage canRead={hasPermission(granted, 'supplier:profile:read')} canManage={hasPermission(granted, 'supplier:profile:manage')} />
      ) : activeModuleId === 'team' ? (
        <TeamPage canManage={hasPermission(granted, 'supplier:*')} currentUserId={session.userId} />
      ) : (
        <Panel title={activeModule?.label ?? '模块'} icon={Construction} subtitle="后续切片实现">
          <FeedbackNotice tone="info" message={`「${activeModule?.label}」将在后续切片接通真实后端。`} />
        </Panel>
      )}
    </AppShell>
  );
}
