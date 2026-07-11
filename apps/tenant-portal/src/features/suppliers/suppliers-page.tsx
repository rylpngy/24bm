import { useState, type ElementType } from 'react';
import { BadgeCheck, Boxes, Gauge, Mail, Search, ShieldCheck, Store } from 'lucide-react';
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
  const [sub, setSub] = useState<SubId>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const admissionCount = all.filter((s) => ADMISSION_STATUSES.includes(s.status ?? '')).length;

  // 供应商登记独立页(详细建档)。
  if (registering) {
    return <SupplierRegisterPage onBack={() => setRegistering(false)} />;
  }

  // 360 详情:从任意子页钻取,返回回到工作台当前子页。
  if (selectedId) {
    const fresh = all.find((s) => s.id === selectedId);
    if (fresh) {
      return <SupplierDetailPage supplier={fresh} onBack={() => setSelectedId(null)} />;
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
    <div className="mx-auto max-w-7xl">
      <div className="grid gap-4 lg:grid-cols-[15rem_1fr]">
        {/* 左侧二级菜单:粘性卡片,活动项蓝底高亮 + 待办徽标 */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-200/50">
            <div className="flex items-center gap-2 px-2 pb-3 pt-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <Store size={16} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950">供应商库</p>
                <p className="text-[11px] font-bold text-slate-400">寻源 · 准入 · 绩效 · 资质</p>
              </div>
            </div>
            <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 pt-2 lg:flex-col lg:overflow-visible">
              {items.map((item) => {
                const isActive = sub === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSub(item.id)}
                    className={cn(
                      'group flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition lg:w-full',
                      isActive ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' : 'text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    <item.icon
                      size={16}
                      className={cn('shrink-0', isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600')}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{item.label}</span>
                      <span
                        className={cn(
                          'hidden text-[11px] font-bold lg:block',
                          isActive ? 'text-blue-100' : 'text-slate-400',
                        )}
                      >
                        {item.desc}
                      </span>
                    </span>
                    {item.badge != null && (
                      <span
                        className={cn(
                          'ml-auto flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-black',
                          isActive ? 'bg-white text-blue-700' : 'bg-red-500 text-white',
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* 右侧内容区 */}
        <div className="min-w-0 space-y-4" key={active?.id}>
          {sub === 'list' && <SupplierListView onOpen={setSelectedId} onRegister={() => setRegistering(true)} />}
          {sub === 'admission' && <SupplierAdmissionQueue onOpen={setSelectedId} />}
          {sub === 'performance' && <SupplierPerformanceBoard onOpen={setSelectedId} />}
          {sub === 'qualifications' && <SupplierQualificationsBoard onOpen={setSelectedId} />}
          {sub === 'sourcing' && <SupplierSourcingView />}
          {sub === 'invitation' && <SupplierInvitationsView />}
        </div>
      </div>
    </div>
  );
}
