import { useState } from 'react';
import { Construction } from 'lucide-react';
import { buyerNavigation } from '@24bid/shared';
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

export function App() {
  const session = useAuthStore((s) => s.session);
  const [activeModuleId, setActiveModuleId] = useState('dashboard');
  const activeModule = buyerNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  return (
    <AppShell
      brandSubtitle={buyerNavigation.label}
      mainlineHint="需求申请 - 询价比价 - 订单履约 - 发票付款"
      modules={buyerNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
      title={activeModule?.label ?? '企业工作台'}
      accountLabel={`${session.displayName} · ${session.tenantId}`}
    >
      {activeModuleId === 'dashboard' ? (
        <DashboardPage />
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
