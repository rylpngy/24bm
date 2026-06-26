import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Boxes, ChevronRight, Plus } from 'lucide-react';
import { useBuyerSupplierCreate, useBuyerSupplierList } from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  StatusPill,
  cn,
} from '@24bid/ui';
import { SupplierDetailPage } from './supplier-detail-page';

const STATUS_FILTERS = ['全部', '待准入', '准入审批中', '已准入', '已驳回', '黑名单'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const schema = z.object({
  supplierId: z.string().min(2, '请填写供应商企业 ID'),
  level: z.string().min(1, '请填写合作等级'),
  categories: z.string().min(1, '请填写授权品类'),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>('全部');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const query = useBuyerSupplierList();
  const create = useBuyerSupplierCreate();
  const all = query.data?.data ?? [];
  const suppliers = status === '全部' ? all : all.filter((s) => s.status === status);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', level: '普通', categories: '' },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const onSubmit = (values: FormValues) =>
    create.mutate(
      {
        data: {
          supplierId: values.supplierId,
          status: '待准入',
          level: values.level,
          categories: values.categories.split(/[,，、\s]+/).filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          reset();
          setShowForm(false);
          refresh();
        },
      },
    );

  // 钻取详情:用最新列表数据回灌(动作后状态会刷新)。
  if (selectedId) {
    const fresh = all.find((s) => s.id === selectedId);
    if (fresh) {
      return <SupplierDetailPage supplier={fresh} onBack={() => setSelectedId(null)} />;
    }
  }

  const count = (s: StatusFilter) => (s === '全部' ? all.length : all.filter((x) => x.status === s).length);
  const scored = all.filter((s) => s.performanceScore != null);
  const avgScore =
    scored.length > 0
      ? Math.round((scored.reduce((sum, s) => sum + (s.performanceScore ?? 0), 0) / scored.length) * 10) / 10
      : null;

  return (
    <Panel title="供应商库" icon={Boxes} subtitle="私域关系 · 准入 · 分级 · 绩效">
      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <MiniFact label="供应商总数" value={String(all.length)} />
        <MiniFact label="待准入" value={String(count('待准入'))} />
        <MiniFact label="准入审批中" value={String(count('准入审批中'))} />
        <MiniFact label="已准入" value={String(count('已准入'))} />
        <MiniFact label="平均绩效" value={avgScore == null ? '—' : String(avgScore)} />
      </div>

      <ListToolbar
        title="私域供应商"
        recordCount={suppliers.length}
        filterLabel={status}
        actionLabel="新增供应商"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === status
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {count(s) > 0 && <span className="ml-1 text-slate-400">{count(s)}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '新增供应商'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4"
        >
          <p className="text-sm font-black text-blue-800">登记私域供应商</p>
          <p className="mt-0.5 text-xs font-bold text-blue-600">登记后状态为「待准入」,在详情页提交准入。</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500">供应商企业 ID</label>
              <input className={inputCls} placeholder="如 ent-supplier-sunrise" {...register('supplierId')} />
              {errors.supplierId && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.supplierId.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">合作等级</label>
              <input className={inputCls} placeholder="战略 / 重要 / 普通" {...register('level')} />
              {errors.level && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.level.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">授权品类(逗号分隔)</label>
              <input className={inputCls} placeholder="办公设备, 办公耗材" {...register('categories')} />
              {errors.categories && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.categories.message}</p>
              )}
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="登记失败:供应商可能已在库中。" />
            </div>
          )}
          <PrimaryActionButton onClick={handleSubmit(onSubmit)} busy={create.isPending} pendingLabel="登记中">
            登记供应商
          </PrimaryActionButton>
        </form>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商库…" />
      ) : suppliers.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无供应商。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={suppliers.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => s.id && setSelectedId(s.id)}
              className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm shadow-slate-200/50 transition hover:border-blue-200 hover:bg-blue-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{s.supplierName}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    等级 {s.level} · 最近评分 {s.lastEvaluationScore ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.status && <StatusPill label={s.status} />}
                  {s.cooperationTier && <StatusPill label={s.cooperationTier} />}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="授权品类" value={(s.categories ?? []).join('、') || '—'} />
                <MiniFact label="绩效评分" value={String(s.performanceScore ?? '—')} />
              </div>
              <p className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-600">
                查看供应商 360 <ChevronRight size={13} />
              </p>
            </button>
          ))}
        >
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">供应商</th>
                <th className="px-4 py-3">准入状态</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">生命周期标记</th>
                <th className="px-4 py-3">授权品类</th>
                <th className="px-4 py-3 text-right">绩效</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => s.id && setSelectedId(s.id)}
                  className="cursor-pointer transition hover:bg-blue-50/40"
                >
                  <td className="px-4 py-4 font-bold text-slate-900">{s.supplierName}</td>
                  <td className="px-4 py-4">{s.status && <StatusPill label={s.status} />}</td>
                  <td className="px-4 py-4 font-black text-slate-700">{s.level}</td>
                  <td className="px-4 py-4">{s.cooperationTier && <StatusPill label={s.cooperationTier} />}</td>
                  <td className="px-4 py-4 text-slate-600">{(s.categories ?? []).join('、')}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {s.performanceScore}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-black text-blue-600">
                      查看 <ChevronRight size={13} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}
    </Panel>
  );
}
