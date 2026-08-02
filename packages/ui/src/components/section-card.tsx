import type { ComponentType, ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../lib/cn';

/**
 * 详情分区卡(以采购计划详情页为规范):
 * 卡体 rounded-lg border-slate-200 p-6 shadow-sm;
 * 分区头 Icon(18, 蓝) + h3 text-base font-black text-slate-950,右侧可挂计数/操作。
 */
export function SectionCard({
  icon: Icon,
  title,
  extra,
  className,
  children,
}: {
  icon?: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  extra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0:栅格子项默认 min-width:auto,长文本会撑破所在列(小屏横向滚动的主因)。
    <section className={cn('min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm', className)}>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {Icon && <Icon size={18} className="text-blue-600" />}
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        {extra && <div className="ml-auto flex items-center gap-2">{extra}</div>}
      </div>
      {children}
    </section>
  );
}

export interface ApprovalTimelineNode {
  label: string;
  desc: string;
  done: boolean;
  active: boolean;
}

/**
 * 审批/流转时间轴卡(以采购计划详情页「审批流转」为规范):
 * ShieldCheck 头 + 左竖线时间轴;节点圆点 已完成翠绿/当前蓝/未开始灰,
 * label text-sm font-black,desc text-xs font-bold text-slate-500,当前节点蓝色 chip。
 */
export function ApprovalTimeline({
  title = '审批流转',
  nodes,
  footer,
  className,
}: {
  title?: string;
  nodes: ApprovalTimelineNode[];
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <SectionCard icon={ShieldCheck} title={title} className={className}>
      <div className="space-y-5 border-l border-slate-100 pl-5">
        {nodes.map((node) => (
          <div key={node.label} className="relative">
            <i
              className={cn(
                'absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full',
                node.done ? 'bg-emerald-500' : node.active ? 'bg-blue-600' : 'bg-slate-300',
              )}
            />
            <p className="text-sm font-black text-slate-950">{node.label}</p>
            <p className="mt-1 break-words text-xs font-bold text-slate-500">{node.desc}</p>
            {node.active && (
              <span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
                当前节点
              </span>
            )}
          </div>
        ))}
      </div>
      {footer && <div className="mt-5">{footer}</div>}
    </SectionCard>
  );
}
