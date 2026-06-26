import { useState } from 'react';
import { BadgeCheck, Boxes, Gauge, Mail, Search, ShieldCheck } from 'lucide-react';
import { useBuyerSupplierList } from '@24bid/api-client';
import { FeedbackNotice, Panel, Tabs } from '@24bid/ui';
import { SupplierListView } from './supplier-list-view';
import { SupplierAdmissionQueue } from './supplier-admission-queue';
import { SupplierPerformanceBoard } from './supplier-performance-board';
import { SupplierQualificationsBoard } from './supplier-qualifications-board';
import { SupplierDetailPage } from './supplier-detail-page';

type SubId = 'list' | 'sourcing' | 'invitation' | 'admission' | 'performance' | 'qualifications';

const ADMISSION_STATUSES = ['待准入', '准入审批中', '已驳回'];

// SRM 模块工作台:左侧全局菜单不变,右侧顶部横向二级导航 + 子页;360 详情钻取替换内容区。
export function SuppliersPage() {
  const [sub, setSub] = useState<SubId>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useBuyerSupplierList();
  const all = query.data?.data ?? [];
  const admissionCount = all.filter((s) => ADMISSION_STATUSES.includes(s.status ?? '')).length;

  // 360 详情:从任意子页钻取,返回回到工作台当前子页。
  if (selectedId) {
    const fresh = all.find((s) => s.id === selectedId);
    if (fresh) {
      return <SupplierDetailPage supplier={fresh} onBack={() => setSelectedId(null)} />;
    }
  }

  const items = [
    { id: 'list' as const, label: '供应商列表', icon: Boxes },
    { id: 'sourcing' as const, label: '寻源发现', icon: Search },
    { id: 'invitation' as const, label: '邀请管理', icon: Mail },
    {
      id: 'admission' as const,
      label: '准入审批',
      icon: ShieldCheck,
      badge: admissionCount || undefined,
    },
    { id: 'performance' as const, label: '绩效看板', icon: Gauge },
    { id: 'qualifications' as const, label: '资质管理', icon: BadgeCheck },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-2 shadow-sm shadow-slate-200/50">
        <Tabs items={items} value={sub} onChange={(t) => setSub(t as SubId)} />
      </div>

      {sub === 'list' && <SupplierListView onOpen={setSelectedId} />}
      {sub === 'admission' && <SupplierAdmissionQueue onOpen={setSelectedId} />}
      {sub === 'performance' && <SupplierPerformanceBoard onOpen={setSelectedId} />}
      {sub === 'qualifications' && <SupplierQualificationsBoard onOpen={setSelectedId} />}
      {sub === 'sourcing' && (
        <Panel title="寻源发现" icon={Search} subtitle="搜索平台供应商 · 一键加入私域">
          <FeedbackNotice
            tone="info"
            message="寻源发现将接通「平台供应商目录搜索」后端(搜全平台已入驻、尚未加入私域的供应商,一键加入待准入),下一切片上线。"
          />
        </Panel>
      )}
      {sub === 'invitation' && (
        <Panel title="邀请管理" icon={Mail} subtitle="邀请供应商注册 / 补资料 · 跟踪邀请状态">
          <FeedbackNotice
            tone="info"
            message="邀请管理将接通「独立邀请单」后端(向寻源到的供应商发邀请并跟踪状态),下一切片上线。"
          />
        </Panel>
      )}
    </div>
  );
}
