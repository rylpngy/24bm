import { useState } from 'react';
import { Construction } from 'lucide-react';
import { supplierNavigation } from '@24bid/shared';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { OverviewPage } from './features/overview/overview-page';
import { OpportunitiesPage } from './features/opportunities/opportunities-page';
import { QuotesPage } from './features/quotes/quotes-page';
import { OrdersPage } from './features/orders/orders-page';
import { ReceivablesPage } from './features/receivables/receivables-page';
import { ProfilePage } from './features/profile/profile-page';

export function App() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState('overview');
  const activeModule = supplierNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  return (
    <AppShell
      brandSubtitle={supplierNavigation.label}
      mainlineHint="询价邀请 - 报价 - 订单履约 - 发票应收"
      modules={supplierNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
      title={activeModule?.label ?? '供应商门户'}
      accountLabel={`${session.displayName} · ${session.supplierId}`}
    >
      {activeModuleId === 'overview' ? (
        <OverviewPage />
      ) : activeModuleId === 'opportunities' ? (
        <OpportunitiesPage />
      ) : activeModuleId === 'quotes' ? (
        <QuotesPage />
      ) : activeModuleId === 'orders' ? (
        <OrdersPage />
      ) : activeModuleId === 'invoices' ? (
        <ReceivablesPage />
      ) : activeModuleId === 'profile' ? (
        <ProfilePage />
      ) : (
        <Panel title={activeModule?.label ?? '模块'} icon={Construction} subtitle="后续切片实现">
          <FeedbackNotice tone="info" message={`「${activeModule?.label}」将在后续切片接通真实后端。`} />
        </Panel>
      )}
    </AppShell>
  );
}
