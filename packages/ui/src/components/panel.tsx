import type { ElementType, ReactNode } from 'react';

export interface PanelProps {
  title: string;
  icon: ElementType;
  subtitle?: string;
  children: ReactNode;
}

/** 标准模块面板——图标 + 标题 + 副标题 + 内容区。复刻自现有 Panel。 */
export function Panel({ title, icon: Icon, subtitle = '列表、详情和操作入口', children }: PanelProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="mb-4 flex items-start gap-2 border-b border-slate-100 pb-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon size={17} />
        </div>
        <div className="min-w-0">
          <h3 className="break-words font-black text-slate-950">{title}</h3>
          <p className="mt-0.5 text-xs font-bold text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
