import { ArrowLeft } from 'lucide-react';
import {
  type MaterialResponse,
  useAuditLogListTargetActions,
} from '@24bid/api-client';
import {
  DetailHeroCard,
  DetailKeyValueRow,
  DetailSection,
  ShellState,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const ACTION_LABELS: Record<string, string> = {
  'material.created': '创建物料',
  'material.updated': '编辑物料',
};

export function MaterialDetail({
  material,
  onBack,
}: {
  material: MaterialResponse;
  onBack: () => void;
}) {
  const audit = useAuditLogListTargetActions({
    targetType: 'material',
    targetId: material.id ?? '',
    actions: Object.keys(ACTION_LABELS).join(','),
  });
  const history = audit.data?.data ?? [];

  const ref = material.referencePrice ?? 0;
  const tax = material.taxRate ?? 0;
  const taxedPrice = ref * (1 + tax / 100);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft size={14} /> 返回物料目录
      </button>

      <DetailHeroCard
        eyebrow="物料 / 服务"
        title={material.name ?? '—'}
        meta={`物料编码 ${material.code} · 分类 ${material.category ?? '—'}`}
        amountLabel={`参考单价 ${currency(material.referencePrice)}`}
        facts={[
          { label: '规格型号', value: material.specification || '—' },
          { label: '品牌', value: material.brand || '—' },
          { label: '计量单位', value: material.unit ?? '—' },
          { label: '税率', value: `${tax}%` },
        ]}
      />

      <DetailSection title="主数据信息">
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailKeyValueRow label="物料编码" value={material.code ?? '—'} fontMono />
          <DetailKeyValueRow label="物料名称" value={material.name ?? '—'} />
          <DetailKeyValueRow label="分类" value={material.category ?? '—'} />
          <DetailKeyValueRow label="计量单位" value={material.unit ?? '—'} />
          <DetailKeyValueRow label="规格型号" value={material.specification || '—'} />
          <DetailKeyValueRow label="品牌" value={material.brand || '—'} />
          <DetailKeyValueRow label="参考单价(未税)" value={currency(material.referencePrice)} fontMono />
          <DetailKeyValueRow label="税率" value={`${tax}%`} />
          <DetailKeyValueRow label="含税单价" value={currency(taxedPrice)} fontMono />
        </div>
        {material.description && (
          <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
            <p className="text-[11px] font-black text-slate-400">物料描述</p>
            <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
              {material.description}
            </p>
          </div>
        )}
      </DetailSection>

      <DetailSection title="操作历史" countLabel={`${history.length} 条`}>
        {audit.isLoading ? (
          <ShellState variant="loading" title="加载操作历史" desc="拉取该物料的审计记录…" />
        ) : history.length === 0 ? (
          <ShellState variant="empty" title="暂无操作记录" desc="对该物料的操作将留痕于此。" />
        ) : (
          <div className="space-y-2">
            {history.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-xs font-black text-slate-700">
                  {ACTION_LABELS[a.action ?? ''] ?? a.action}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {a.actorId} · {a.createdAt?.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailSection>
    </div>
  );
}
