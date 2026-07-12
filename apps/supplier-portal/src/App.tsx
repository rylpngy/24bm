import { useState } from 'react';
import { Construction } from 'lucide-react';
import { supplierNavigation } from '@24bid/shared';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { OverviewPage } from './features/overview/overview-page';
import { OpportunitiesPage } from './features/opportunities/opportunities-page';
import { OrdersPage } from './features/orders/orders-page';
import { ShelfPage } from './features/shelf/shelf-page';
import { ReceivablesPage } from './features/receivables/receivables-page';
import { ProfilePage } from './features/profile/profile-page';
import { DeliveriesPage } from './features/deliveries/deliveries-page';
import { ReconciliationsPage } from './features/reconciliations/reconciliations-page';
import { QualificationsPage } from './features/qualifications/qualifications-page';
import { TeamPage } from './features/team/team-page';

export function App() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState(
    () => new URLSearchParams(window.location.search).get('module') ?? 'overview',
  );
  // 深链接:模块选择同步进 ?module=,刷新/分享链接可直达。
  const selectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    const url = new URL(window.location.href);
    url.searchParams.set('module', moduleId);
    window.history.replaceState(null, '', url.toString());
  };
  const activeModule = supplierNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  return (
    <AppShell
      brandSubtitle={supplierNavigation.label}
      mainlineHint="询比邀请 - 报价 - 订单履约 - 发票应收"
      modules={supplierNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={selectModule}
      title={activeModule?.label ?? '供应商门户'}
      accountLabel={`${session.displayName} · ${session.supplierId}`}
    >
      {activeModuleId === 'overview' ? (
        <OverviewPage onNavigate={selectModule} />
      ) : activeModuleId === 'opportunities' ? (
        <OpportunitiesPage />
      ) : activeModuleId === 'orders' ? (
        <OrdersPage />
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
        <QualificationsPage />
      ) : activeModuleId === 'team' ? (
        <TeamPage />
      ) : (
        <Panel title={activeModule?.label ?? '模块'} icon={Construction} subtitle="后续切片实现">
          <FeedbackNotice tone="info" message={`「${activeModule?.label}」将在后续切片接通真实后端。`} />
        </Panel>
      )}
    </AppShell>
  );
}
