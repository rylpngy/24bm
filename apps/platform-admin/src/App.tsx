import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { platformNavigation } from '@24bid/shared';
import { AppShell, FeedbackNotice, Panel, StatusPill } from '@24bid/ui';

// S0-3 骨架：运营后台独立 app，复用同一组件库与布局壳。
export function App() {
  const [activeModuleId, setActiveModuleId] = useState('overview');
  const activeModule = platformNavigation.modules.find((m) => m.id === activeModuleId);

  return (
    <AppShell
      brandSubtitle={platformNavigation.label}
      modules={platformNavigation.modules}
      activeModuleId={activeModuleId}
      onSelectModule={setActiveModuleId}
      title={activeModule?.label ?? '平台运营后台'}
      accountLabel="平台运营账户"
    >
      <FeedbackNotice message="运营后台已与外部门户物理隔离为独立 app。" />
      <Panel title={activeModule?.label ?? '平台看板'} icon={Building2}>
        <div className="flex flex-wrap gap-2">
          <StatusPill label="已启用" />
          <StatusPill label="试用中" />
          <StatusPill label="已停用" />
        </div>
      </Panel>
    </AppShell>
  );
}
