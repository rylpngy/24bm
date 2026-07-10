import { ArrowLeft, CheckCircle2, CircleDollarSign, Database, FileText, History, Package, ShieldCheck, Tag } from 'lucide-react';
import {
  type MaterialResponse,
  useAuditLogListTargetActions,
} from '@24bid/api-client';
import {
  ShellState,
  StatusPill,
  cn,
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
  // 后端已支持空 actions(返回该目标全部动作)。
  const audit = useAuditLogListTargetActions({
    targetType: 'material',
    targetId: material.id ?? '',
  });
  const history = audit.data?.data ?? [];

  const ref = material.referencePrice ?? 0;
  const tax = material.taxRate ?? 0;
  const taxedPrice = ref * (1 + tax / 100);
  const status = material.description?.includes('停用') || material.description?.includes('禁用') ? '停用' : '启用';
  const priceLevel = ref >= 10000 ? '高价值' : ref >= 1000 ? '标准物资' : '低值易耗';

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-words text-xl font-black text-slate-950">{material.name ?? '—'}</h2>
                <StatusPill label={status} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                物料编码: {material.code ?? '—'} · 所属分类: {material.category ?? '—'} · 计量单位: {material.unit ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
              type="button"
            >
              <FileText size={15} /> 查看记录
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700"
              type="button"
            >
              <CheckCircle2 size={15} /> 数据有效
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={CircleDollarSign} label="参考单价(未税)" value={currency(material.referencePrice)} tone="blue" mono />
            <MetricCard icon={Tag} label="含税单价" value={currency(taxedPrice)} tone="emerald" mono />
            <MetricCard icon={ShieldCheck} label="税率 / 价格级别" value={`${tax}% · ${priceLevel}`} tone="violet" />
          </div>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">主数据信息</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoItem label="物料编码" value={material.code ?? '—'} mono />
              <InfoItem label="物料名称" value={material.name ?? '—'} />
              <InfoItem label="所属分类" value={material.category ?? '—'} />
              <InfoItem label="计量单位" value={material.unit ?? '—'} />
              <InfoItem label="规格型号" value={material.specification || '—'} />
              <InfoItem label="品牌 / 属性" value={material.brand || '—'} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2">
              <Package size={18} className="text-violet-600" />
              <h3 className="text-base font-black text-slate-950">采购与价格信息</h3>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black text-slate-500">
                  <tr>
                    <th className="px-4 py-3">价格项</th>
                    <th className="px-4 py-3">当前值</th>
                    <th className="px-4 py-3">说明</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  <PriceRow label="参考单价(未税)" value={currency(material.referencePrice)} desc="用于采购需求预算、询报价参考价与物料成本分析。" />
                  <PriceRow label="税率" value={`${tax}%`} desc="按当前物料主数据税率计算含税参考价。" />
                  <PriceRow label="含税单价" value={currency(taxedPrice)} desc="参考单价按税率换算后的估算值。" />
                </tbody>
              </table>
            </div>
            {material.description && (
              <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-500">物料描述</p>
                <p className="mt-2 break-words text-sm font-bold leading-6 text-slate-600">{material.description}</p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg bg-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                <Database size={20} />
              </span>
              <div>
                <p className="text-lg font-black">主数据体检</p>
                <p className="font-mono text-xs font-black uppercase text-slate-400">Master Data Check</p>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <CheckLine done label="编码唯一性" desc="物料编码已登记" />
              <CheckLine done={!!material.category} label="分类完整性" desc={material.category || '待补充分类'} />
              <CheckLine done={ref > 0} label="价格维护" desc={ref > 0 ? '参考价已维护' : '待维护参考价'} />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600" />
                <h3 className="text-base font-black text-slate-950">操作历史</h3>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">{history.length} 条</span>
            </div>
            {audit.isLoading ? (
              <ShellState variant="loading" title="加载操作历史" desc="拉取该物料的审计记录…" />
            ) : history.length === 0 ? (
              <ShellState variant="empty" title="暂无操作记录" desc="对该物料的操作将留痕于此。" />
            ) : (
              <div className="space-y-4 border-l border-slate-100 pl-5">
                {history.map((a, index) => (
                  <div key={a.id} className="relative">
                    <i className={cn('absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full', index === 0 ? 'bg-blue-600' : 'bg-slate-300')} />
                    <p className="text-sm font-black text-slate-950">{ACTION_LABELS[a.action ?? ''] ?? a.action}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {a.actorId} · {a.createdAt?.slice(0, 16).replace('T', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
  mono,
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
  tone: 'blue' | 'emerald' | 'violet';
  mono?: boolean;
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', toneClass)}>
        <Icon size={17} />
      </span>
      <p className="mt-4 text-xs font-black text-slate-400">{label}</p>
      <p className={cn('mt-2 text-xl font-black text-slate-950', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className={cn('mt-1 break-words text-sm font-black text-slate-900', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function PriceRow({ label, value, desc }: { label: string; value: string; desc: string }) {
  return (
    <tr>
      <td className="px-4 py-4 font-black text-slate-950">{label}</td>
      <td className="px-4 py-4 font-mono font-black text-slate-900">{value}</td>
      <td className="px-4 py-4 text-xs font-bold leading-5 text-slate-500">{desc}</td>
    </tr>
  );
}

function CheckLine({ done, label, desc }: { done: boolean; label: string; desc: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={15} className={done ? 'text-emerald-400' : 'text-slate-500'} />
        <p className="text-sm font-black text-white">{label}</p>
      </div>
      <p className="mt-1 pl-5 text-xs font-bold text-slate-400">{desc}</p>
    </div>
  );
}
