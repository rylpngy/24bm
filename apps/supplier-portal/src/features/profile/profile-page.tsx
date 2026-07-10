import { BadgeCheck } from 'lucide-react';
import { useSupplierProfileGet } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, StatusPill } from '@24bid/ui';

// 企业档案:供应商自身主数据与认证状态。
export function ProfilePage() {
  const profile = useSupplierProfileGet();
  const p = profile.data?.data;

  return (
    <Panel title="企业档案" icon={BadgeCheck} subtitle="企业资料 · 认证状态">
      {profile.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载企业档案…" />
      ) : !p ? (
        <FeedbackNotice tone="info" message="暂无企业档案。" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-black text-slate-950">{p.name}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{p.id}</p>
            </div>
            {p.verifiedStatus && <StatusPill label={p.verifiedStatus} />}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <MiniFact label="企业类型" value={p.type ?? '—'} />
            <MiniFact label="所属行业" value={p.industry ?? '—'} />
            <MiniFact label="档案状态" value={p.profileStatus ?? '—'} />
            <MiniFact label="统一社会信用代码" value={p.creditCode || '—'} />
            <MiniFact label="法定代表人" value={p.legalPerson || '—'} />
            <MiniFact label="平台认证" value={p.verified ? '已认证' : '未认证'} />
          </div>
          {(p.connectedBuyerNames ?? []).length > 0 && (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] font-black text-slate-400">已合作采购方</p>
              <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
                {(p.connectedBuyerNames ?? []).join('、')}
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
