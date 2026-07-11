import { useState } from 'react';
import { Construction } from 'lucide-react';
import { platformNavigation } from '@24bid/shared';
import { AppShell, FeedbackNotice, Panel } from '@24bid/ui';
import { useAuthStore } from './lib/auth-store';
import { LoginGate } from './features/login-gate';
import { OverviewPage } from './features/overview/overview-page';
import { TenantsPage } from './features/tenants/tenants-page';
import { EnterpriseReviewsPage } from './features/reviews/enterprise-reviews-page';
import { AnnouncementsPage } from './features/announcements/announcements-page';

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
  const activeModule = platformNavigation.modules.find((m) => m.id === activeModuleId);

  if (!session) {
    return <LoginGate />;
  }

  return (
    <AppShell
      brandSubtitle={platformNavigation.label}
      mainlineHint="企业审核 - 租户运营 - 平台公告"
      modules={platformNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={selectModule}
      title={activeModule?.label ?? '平台运营后台'}
      accountLabel={`${session.displayName} · 平台运营`}
    >
      {activeModuleId === 'overview' ? (
        <OverviewPage onNavigate={selectModule} />
      ) : activeModuleId === 'tenants' ? (
        <TenantsPage />
      ) : activeModuleId === 'reviews' ? (
        <EnterpriseReviewsPage />
      ) : activeModuleId === 'announcements' ? (
        <AnnouncementsPage />
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
