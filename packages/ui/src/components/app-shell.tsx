import { useState } from 'react';
import type { ElementType, ReactNode } from 'react';
import { Globe, Sparkles, Languages, ChevronDown,
  BadgeCheck,
  BarChart3,
  Banknote,
  Building2,
  ClipboardList,
  Database,
  FileSignature,
  FileText,
  LayoutGrid,
  Megaphone,
  PackageCheck,
  Receipt,
  Send,
  ShieldCheck,
  ShoppingCart,
  SquareStack,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { AdminNavigationModule } from '@24bid/shared';
import { cn } from '../lib/cn';

// 模块 id → 菜单 icon。三端 id 复用同一映射;未命中用占位 icon。
const MODULE_ICONS: Record<string, ElementType> = {
  dashboard: LayoutGrid,
  overview: LayoutGrid,
  analytics: TrendingUp,
  demands: FileText,
  approvals: ShieldCheck,
  reviews: ShieldCheck,
  suppliers: Users,
  materials: Database,
  rfqs: Send,
  opportunities: Send,
  quotes: BarChart3,
  orders: ShoppingCart,
  contracts: FileSignature,
  receipts: PackageCheck,
  invoices: Receipt,
  'payment-batches': Banknote,
  team: Users,
  audit: ClipboardList,
  tenants: Building2,
  announcements: Megaphone,
  profile: BadgeCheck,
};

export interface AppShellProps {
  /** 侧栏品牌副标题，如「采购方企业端」「平台运营端」。 */
  brandSubtitle: string;
  /** 侧栏主线提示，如「需求申请 - 询价比价 - 订单履约 - 发票付款」。 */
  mainlineHint?: string;
  modules: AdminNavigationModule[];
  activeModuleId: string;
  onSelectModule: (id: string) => void;
  /** 顶栏工作区标题。 */
  title: string;
  /** 顶栏账户副标题。 */
  accountLabel?: string;
  /** 门户首页地址(新开页);不传则不显示按钮。 */
  portalUrl?: string;
  /** 智能分析模块 id(有真实 AI 报告能力的端传入,点击经 onSelectModule 跳转)。 */
  aiModuleId?: string;
  children: ReactNode;
}

/** 三端后台布局壳——深色侧栏 + 顶栏 + max-w-7xl 主区。 */
export function AppShell({
  brandSubtitle,
  mainlineHint,
  modules,
  activeModuleId,
  onSelectModule,
  title,
  accountLabel = '主账户',
  portalUrl,
  aiModuleId,
  children,
}: AppShellProps) {
  const [langOpen, setLangOpen] = useState(false);
  return (
    <div className="flex h-dvh flex-col overflow-hidden overflow-x-hidden bg-slate-100/70 text-slate-900 lg:flex-row">
      <aside className="hidden min-h-0 shrink-0 flex-col bg-slate-950 text-white lg:flex lg:w-72">
        <div className="border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-lg font-black shadow-lg shadow-blue-950/40">
              24
            </div>
            <div>
              <p className="text-lg font-black leading-none">24Bid</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-widest text-blue-300">
                {brandSubtitle}
              </p>
            </div>
          </div>
          {mainlineHint && (
            <div className="mt-5 rounded-lg border border-blue-400/20 bg-blue-500/10 p-3">
              <p className="text-xs font-bold text-blue-200">采购主线</p>
              <p className="mt-1 text-sm font-semibold text-white">{mainlineHint}</p>
            </div>
          )}
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">
          {modules.map((module) => {
            const active = module.id === activeModuleId;
            const Icon = MODULE_ICONS[module.id] ?? SquareStack;
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => onSelectModule(module.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition',
                  active ? 'bg-white shadow-sm shadow-slate-900/20' : 'hover:bg-white/5',
                )}
              >
                <Icon
                  size={18}
                  className={cn('shrink-0', active ? 'text-blue-600' : 'text-slate-400')}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span
                    className={cn(
                      'text-sm font-black leading-tight',
                      active ? 'text-slate-900' : 'text-white',
                    )}
                  >
                    {module.label}
                  </span>
                  <span
                    className={cn(
                      'truncate text-[11px] font-bold leading-tight',
                      active ? 'text-slate-500' : 'text-slate-400',
                    )}
                  >
                    {module.desc}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="rounded-lg bg-white/5 p-4">
            <p className="text-xs font-bold text-slate-400">多租户隔离</p>
            <p className="mt-2 text-sm text-slate-300">
              采购数据、供应商私域关系、订单和财务记录按企业隔离。
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm shadow-slate-200/70 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">当前工作区</p>
            <h1 className="max-w-[220px] truncate text-lg font-black text-slate-900 sm:max-w-none">
              {title}
            </h1>
            <p className="text-xs font-bold text-slate-500">{accountLabel}</p>
          </div>

          {/* 顶栏功能区:门户首页 / 智能分析(真实 AI 报告入口)/ 语言 */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {portalUrl && (
              <a
                href={portalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              >
                <Globe size={14} /> 门户首页
              </a>
            )}
            {aiModuleId && (
              <button
                type="button"
                onClick={() => onSelectModule(aiModuleId)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100"
              >
                <Sparkles size={14} /> AI 分析
              </button>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangOpen((v: boolean) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
              >
                <Languages size={14} /> 简体中文 <ChevronDown size={13} className="text-slate-400" />
              </button>
              {langOpen && (
                <div
                  className="absolute right-0 top-full z-40 mt-1.5 w-44 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                  onMouseLeave={() => setLangOpen(false)}
                >
                  <button
                    type="button"
                    onClick={() => setLangOpen(false)}
                    className="flex w-full items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                  >
                    简体中文 <span className="text-[10px]">当前</span>
                  </button>
                  <div className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-3 py-2 text-xs font-bold text-slate-300">
                    English <span className="text-[10px]">规划中</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <section className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain bg-slate-100/70">
          <div className="mx-auto w-full max-w-7xl space-y-5 p-3 pb-8 sm:space-y-6 sm:p-6 lg:p-8">
            {children}
          </div>
        </section>
      </main>
    </div>
  );
}
