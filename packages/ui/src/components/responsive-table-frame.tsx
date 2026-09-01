import type { ReactNode } from 'react';

export interface ResponsiveTableFrameProps {
  mobileCards: ReactNode;
  children: ReactNode;
}

/** 响应式表格框架——移动端卡片 / 桌面端表格双形态。复刻自现有 ResponsiveTableFrame。 */
export function ResponsiveTableFrame({ mobileCards, children }: ResponsiveTableFrameProps) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:hidden">{mobileCards}</div>
      <div className="hidden overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 bg-white shadow-sm lg:block">
        <div className="min-w-full">{children}</div>
      </div>
    </div>
  );
}
