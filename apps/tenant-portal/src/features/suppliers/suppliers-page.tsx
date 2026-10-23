import { useState, type ElementType } from 'react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { BadgeCheck, Boxes, Gauge, Mail, Search, ShieldCheck } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import { cn } from '@24bid/ui';
import { SupplierListView } from './supplier-list-view';
import { SupplierRegisterPage } from './supplier-register-page';
import { SupplierSourcingView } from './supplier-sourcing-view';
import { SupplierInvitationsView } from './supplier-invitations-view';
import { SupplierAdmissionQueue } from './supplier-admission-queue';
import { SupplierPerformanceBoard } from './supplier-performance-board';
import { SupplierQualificationsBoard } from './supplier-qualifications-board';
import { SupplierDetailPage } from './supplier-detail-page';

type SubId = 'list' | 'sourcing' | 'invitation' | 'admission' | 'performance' | 'qualifications';

const ADMISSION_STATUSES = ['待准入', '准入审批中', '已驳回'];

interface SubItem {
  id: SubId;
  label: string;
  desc: string;
  icon: ElementType;
  badge?: number;
}

// SRM 模块工作台:左侧竖向二级菜单(粘性)+ 右侧子页;360 详情钻取替换内容区。
export function SuppliersPage() {
  const { can } = useBuyerPermissions();
  const [sub, setSub] = useState<SubId>('list');
  const [selectedId, setSelectedId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('recordId'));
  const [registering, setRegistering] = useState(false);
  const [editing, setEditing] = useState(false);

  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const admissionCount = all.filter((s) => ADMISSION_STATUSES.includes(s.status ?? '')).length;

  // 供应商登记独立页(详细建档)。
  if (registering && can('buyer:supplier:manage')) {
    return <SupplierRegisterPage onBack={() => setRegistering(false)} />;
  }

  // 360 详情:从任意子页钻取,返回回到工作台当前子页。
  if (selectedId) {
    const fresh = all.find((s) => s.id === selectedId);
    if (fresh) {
      if (editing && can('buyer:supplier:manage')) {
        return <SupplierRegisterPage key={fresh.id} supplier={fresh} onBack={() => setEditing(false)} />;
      }
      return <SupplierDetailPage key={fresh.id} supplier={fresh} initialTab={sub === 'qualifications' ? 'qualifications' : 'performance'} onEdit={() => setEditing(true)} onBack={() => { setEditing(false); setSelectedId(null); }} />;
    }
  }

  const items: SubItem[] = [
    { id: 'list', label: '供应商列表', desc: '私域档案与合作状态', icon: Boxes },
    { id: 'sourcing', label: '智能寻源', desc: '全网匹配候选供应商', icon: Search },
    { id: 'invitation', label: '邀请管理', desc: '入驻邀请与进度', icon: Mail },
    { id: 'admission', label: '准入审批', desc: '资质核验与准入', icon: ShieldCheck, badge: admissionCount || undefined },
    { id: 'performance', label: '绩效看板', desc: '交付与报价表现', icon: Gauge },
    { id: 'qualifications', label: '资质管理', desc: '证照有效期跟踪', icon: BadgeCheck },
  ];
  const active = items.find((i) => i.id === sub);

  return (
    <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[auto_1fr] lg:gap-4">
      {/* 图标式二级菜单:窄栏仅占左侧一列图标宽度,悬停展开名称与说明,内容区保持原样式 */}
      <aside className="relative z-30 mb-4 lg:mb-0 lg:self-start lg:sticky lg:top-4">
        <nav className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm shadow-slate-200/50 lg:flex-col">
          {items.filter((item) => !['invitation', 'sourcing'].includes(item.id) || can('buyer:supplier:manage')).map((item) => {
            const isActive = sub === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSub(item.id)}
                aria-label={item.label}
                className={cn(
                  'group relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-blue-600',
                )}
              >
                <item.icon size={18} />
                {item.badge != null && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
                    {item.badge}
                  </span>
                )}
                {/* 悬停提示:名称 + 职责说明 */}
                <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2.5 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-left shadow-lg group-hover:block">
                  <span className="block text-xs font-black text-white">{item.label}</span>
                  <span className="block text-[11px] font-bold text-slate-400">{item.desc}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* 内容区:保持原页面宽度与样式 */}
      <div className="min-w-0 space-y-4" key={active?.id}>
        {sub === 'list' && <SupplierListView onOpen={setSelectedId} onRegister={() => setRegistering(true)} />}
        {sub === 'admission' && <SupplierAdmissionQueue onOpen={setSelectedId} />}
        {sub === 'performance' && <SupplierPerformanceBoard onOpen={setSelectedId} />}
        {sub === 'qualifications' && <SupplierQualificationsBoard onOpen={setSelectedId} />}
        {sub === 'sourcing' && can('buyer:supplier:manage') && <SupplierSourcingView />}
        {sub === 'invitation' && can('buyer:supplier:manage') && <SupplierInvitationsView />}
      </div>
    </div>
  );
}
