import { useState } from 'react';
import { Construction } from 'lucide-react';
import { hasPermission, platformNavigation, visiblePortalModules } from '@24bid/shared';
import { useSessionPermissions } from '@24bid/api-client';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { OverviewPage } from './features/overview/overview-page';
import { TenantsPage } from './features/tenants/tenants-page';
import { EnterpriseReviewsPage } from './features/reviews/enterprise-reviews-page';
import { SupplierCreditPage } from './features/suppliers/supplier-credit-page';
import { DictionariesPage } from './features/settings/dictionaries-page';
import { AnnouncementsPage } from './features/announcements/announcements-page';
import { PublicCatalogReviewsPage } from './features/mall/public-catalog-reviews-page';

export function App() {
  const session = useAuthStore((s) => s.session);
  const permissions = useSessionPermissions(session?.userId);
  const granted = permissions.isError ? [] : permissions.data?.data.permissions ?? [];
  const modules = visiblePortalModules(platformNavigation, granted);
  const [requestedModuleId, setActiveModuleId] = useState(
    () => new URLSearchParams(window.location.search).get('module') ?? 'overview',
  );
  const activeModuleId = modules.some(m => m.id === requestedModuleId) ? requestedModuleId : modules[0]?.id ?? '';
  // 深链接:模块选择同步进 ?module=,刷新/分享链接可直达。
  const selectModule = (moduleId: string) => {
    setActiveModuleId(moduleId);
    const url = new URL(window.location.href);
    url.searchParams.set('module', moduleId);
    window.history.replaceState(null, '', url.toString());
  };
  const activeModule = platformNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  if (permissions.isPending || permissions.isError || modules.length === 0) {
    return <div className="p-6"><FeedbackNotice tone={permissions.isPending ? 'info' : 'error'} message={permissions.isPending ? '正在读取权限…' : permissions.isError ? '权限读取失败，请重试。' : '当前账号未分配可访问的模块，请联系管理员。'} /><button type="button" className="mt-4 text-sm text-blue-700" onClick={() => useAuthStore.getState().signOut()}>退出登录</button></div>;
  }

  return (
    <AppShell
      brandSubtitle={platformNavigation.label}
      mainlineHint="企业审核 - 租户运营 - 平台公告"
      modules={modules}
      activeModuleId={activeModuleId}
      onSelectModule={selectModule}
      portalUrl={import.meta.env.VITE_PORTAL_URL ?? 'http://localhost:5173'}
      title={activeModule?.label ?? '平台运营后台'}
      accountLabel={`${session.displayName} · 平台运营`}
    >
      {activeModuleId === 'overview' ? (
        <OverviewPage onNavigate={selectModule} />
      ) : activeModuleId === 'tenants' ? (
        <TenantsPage canManage={hasPermission(granted, 'platform:tenant:manage')}
          canReadUsage={hasPermission(granted, 'platform:billing:read')}
          canCreateSupplier={hasPermission(granted, 'platform:supplier:manage')} />
      ) : activeModuleId === 'reviews' ? (
        <EnterpriseReviewsPage />
      ) : activeModuleId === 'mall' ? (
        <PublicCatalogReviewsPage canManage={hasPermission(granted, 'platform:*')} />
      ) : activeModuleId === 'supplier-credit' ? (
        <SupplierCreditPage />
      ) : activeModuleId === 'announcements' ? (
        <AnnouncementsPage canManage={hasPermission(granted, 'platform:announcement:manage')} />
      ) : activeModuleId === 'settings' ? (
        <DictionariesPage canManage={hasPermission(granted, 'platform:dictionary:manage')} />
      ) : (
        <Panel title={activeModule?.label ?? '模块'} icon={Construction} subtitle="后续切片实现">
          <FeedbackNotice
            tone="info"
            message={`「${activeModule?.label}」将在后续切片接通真实后端。`}
          />
        </Panel>
      )}
    </AppShell>
  );
}
