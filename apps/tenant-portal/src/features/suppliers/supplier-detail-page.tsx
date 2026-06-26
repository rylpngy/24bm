import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, FileText, Gauge, ShieldCheck } from 'lucide-react';
import {
  type BuyerSupplierResponse,
  useBuyerSupplierChangeStatus,
  useBuyerSupplierReviewAdmission,
  useBuyerSupplierSubmitAdmission,
} from '@24bid/api-client';
import {
  DetailActionPanel,
  DetailHeroCard,
  DetailKeyValueRow,
  DetailSection,
  Tabs,
  cn,
} from '@24bid/ui';
import { SupplierEvaluationPanel } from './supplier-evaluation-panel';
import { SupplierQualificationsTab } from './supplier-qualifications-tab';

type TabId = 'profile' | 'admission' | 'performance' | 'qualifications';

const TABS = [
  { id: 'profile' as const, label: '档案', icon: FileText },
  { id: 'admission' as const, label: '准入与生命周期', icon: ShieldCheck },
  { id: 'performance' as const, label: '绩效考核', icon: Gauge },
  { id: 'qualifications' as const, label: '资质证照', icon: BadgeCheck },
];

export function SupplierDetailPage({
  supplier,
  onBack,
}: {
  supplier: BuyerSupplierResponse;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<TabId>('profile');
  const id = supplier.id ?? '';

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft size={14} /> 返回供应商库
      </button>

      <DetailHeroCard
        eyebrow="私域供应商"
        title={supplier.supplierName ?? '—'}
        meta={`合作等级 ${supplier.level ?? '—'} · 生命周期标记 ${supplier.cooperationTier ?? '—'}`}
        status={supplier.status}
        facts={[
          { label: '授权品类', value: (supplier.categories ?? []).join('、') || '—' },
          { label: '绩效评分', value: String(supplier.performanceScore ?? '—') },
          { label: '最近考核分', value: String(supplier.lastEvaluationScore ?? '—') },
          { label: '统一社会信用代码', value: supplier.creditCode || '—' },
        ]}
      />

      <Tabs items={TABS} value={tab} onChange={(t) => setTab(t as TabId)} />

      {tab === 'profile' && <ProfileTab s={supplier} />}
      {tab === 'admission' && <AdmissionTab s={supplier} />}
      {tab === 'performance' && id && (
        <SupplierEvaluationPanel relationId={id} supplierId={supplier.supplierId} />
      )}
      {tab === 'qualifications' && id && (
        <SupplierQualificationsTab relationId={id} supplierId={supplier.supplierId} />
      )}
    </div>
  );
}

// 档案 Tab:采购方视角的供应商主数据。
function ProfileTab({ s }: { s: BuyerSupplierResponse }) {
  return (
    <div className="space-y-4">
      <DetailSection title="工商与联系信息">
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailKeyValueRow label="统一社会信用代码" value={s.creditCode || '—'} fontMono />
          <DetailKeyValueRow label="法定代表人" value={s.legalPerson || '—'} />
          <DetailKeyValueRow label="联系人" value={s.contactName || '—'} />
          <DetailKeyValueRow label="联系电话" value={s.contactPhone || '—'} />
          <DetailKeyValueRow label="联系邮箱" value={s.contactEmail || '—'} />
          <DetailKeyValueRow label="授权品类" value={(s.categories ?? []).join('、') || '—'} />
        </div>
      </DetailSection>

      <DetailSection title="开户与结算">
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailKeyValueRow label="开户银行" value={s.bankName || '—'} />
          <DetailKeyValueRow label="银行账号" value={s.bankAccount || '—'} fontMono />
        </div>
      </DetailSection>

      <DetailSection title="经营范围">
        <p className="break-words rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-700">
          {s.businessScope || '未填写经营范围。'}
        </p>
      </DetailSection>
    </div>
  );
}

// 准入与生命周期 Tab:状态流转动作(提交准入 / 审核 / 黑名单 / 恢复)。
function AdmissionTab({ s }: { s: BuyerSupplierResponse }) {
  const queryClient = useQueryClient();
  const submit = useBuyerSupplierSubmitAdmission();
  const review = useBuyerSupplierReviewAdmission();
  const changeStatus = useBuyerSupplierChangeStatus();
  const id = s.id ?? '';

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const busy = submit.isPending || review.isPending || changeStatus.isPending;
  const btn = (label: string, onClick: () => void, tone: 'blue' | 'emerald' | 'red') => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex h-9 items-center rounded-md px-4 text-xs font-black text-white transition disabled:bg-slate-400',
        tone === 'emerald' && 'bg-emerald-600 hover:bg-emerald-700',
        tone === 'blue' && 'bg-blue-600 hover:bg-blue-700',
        tone === 'red' && 'bg-red-600 hover:bg-red-700',
      )}
    >
      {busy ? '处理中' : label}
    </button>
  );

  const stageMeta: Record<string, { desc: string; tone: 'blue' | 'emerald' | 'slate' }> = {
    待准入: { desc: '该供应商尚未提交准入,提交后进入准入审批。', tone: 'blue' },
    已驳回: { desc: '准入被驳回,可补充资料后重新提交准入。', tone: 'slate' },
    准入审批中: { desc: '准入审批进行中,请审核通过或驳回。', tone: 'blue' },
    已准入: { desc: '已准入合作中。如有违规可加入黑名单冻结合作。', tone: 'emerald' },
    黑名单: { desc: '已冻结合作。可恢复为待准入重新走准入流程。', tone: 'slate' },
  };
  const meta = stageMeta[s.status ?? ''] ?? { desc: '生命周期状态。', tone: 'slate' as const };

  const actions = () => {
    switch (s.status) {
      case '待准入':
      case '已驳回':
        return btn('提交准入', () => submit.mutate({ relationId: id }, { onSuccess: refresh }), 'blue');
      case '准入审批中':
        return (
          <div className="flex flex-wrap gap-2">
            {btn('通过', () => review.mutate({ relationId: id, data: { approved: true } }, { onSuccess: refresh }), 'emerald')}
            {btn('驳回', () => review.mutate({ relationId: id, data: { approved: false } }, { onSuccess: refresh }), 'red')}
          </div>
        );
      case '已准入':
        return btn('加入黑名单', () => changeStatus.mutate({ relationId: id, data: { status: '黑名单' } }, { onSuccess: refresh }), 'red');
      case '黑名单':
        return btn('恢复待准入', () => changeStatus.mutate({ relationId: id, data: { status: '待准入' } }, { onSuccess: refresh }), 'blue');
      default:
        return <p className="text-xs font-bold text-slate-500">当前状态无可执行动作。</p>;
    }
  };

  return (
    <DetailActionPanel
      title={`准入生命周期 · 当前「${s.status ?? '—'}」`}
      desc={meta.desc}
      status={s.status}
      tone={meta.tone}
    >
      {actions()}
    </DetailActionPanel>
  );
}
