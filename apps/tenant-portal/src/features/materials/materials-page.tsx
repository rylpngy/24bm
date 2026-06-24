import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Package, Plus } from 'lucide-react';
import { type MaterialResponse, useMaterialCreate, useMaterialList } from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
} from '@24bid/ui';
import { MaterialDetail } from './material-detail';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const schema = z.object({
  code: z.string().min(2, '物料编码至少 2 位'),
  name: z.string().min(2, '名称至少 2 个字'),
  category: z.string().min(1, '请填写分类'),
  unit: z.string().min(1, '请填写单位'),
  referencePrice: z.number().min(0, '参考价不能为负'),
  specification: z.string(),
  brand: z.string(),
  taxRate: z.number().min(0, '税率不能为负').max(100, '税率不超过 100'),
  description: z.string(),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export function MaterialsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<MaterialResponse | null>(null);

  const query = useMaterialList(keyword ? { keyword } : undefined);
  const create = useMaterialCreate();
  const materials = query.data?.data ?? [];

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      category: '',
      unit: '',
      referencePrice: 0,
      specification: '',
      brand: '',
      taxRate: 13,
      description: '',
    },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/materials'),
    });

  const onSubmit = (values: FormValues) =>
    create.mutate(
      { data: values },
      {
        onSuccess: () => {
          reset();
          setShowForm(false);
          refresh();
        },
      },
    );

  if (selected) {
    const fresh = materials.find((m) => m.id === selected.id) ?? selected;
    return <MaterialDetail material={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <Panel title="物料目录" icon={Package} subtitle="物料与服务主数据">
      <ListToolbar
        title="物料/服务"
        recordCount={materials.length}
        filterLabel={keyword ? `关键词「${keyword}」` : '全部'}
        actionLabel="新增物料"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="按编码/名称搜索"
          className="h-9 w-56 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        />
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '新增物料'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4"
        >
          <p className="text-sm font-black text-blue-800">新增物料</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500">物料编码</label>
              <input className={inputCls} placeholder="如 IT-LAPTOP" {...register('code')} />
              {errors.code && <p className="mt-1 text-xs font-bold text-red-600">{errors.code.message}</p>}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">名称</label>
              <input className={inputCls} placeholder="如 办公电脑" {...register('name')} />
              {errors.name && <p className="mt-1 text-xs font-bold text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">分类</label>
              <input className={inputCls} placeholder="如 办公设备" {...register('category')} />
              {errors.category && <p className="mt-1 text-xs font-bold text-red-600">{errors.category.message}</p>}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">单位</label>
              <input className={inputCls} placeholder="如 台" {...register('unit')} />
              {errors.unit && <p className="mt-1 text-xs font-bold text-red-600">{errors.unit.message}</p>}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">参考单价(未税)</label>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                {...register('referencePrice', { valueAsNumber: true })}
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">规格型号</label>
              <input className={inputCls} placeholder='如 i7/16G/512G/14"' {...register('specification')} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">品牌</label>
              <input className={inputCls} placeholder="如 联想 ThinkPad" {...register('brand')} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">税率(%)</label>
              <input
                className={inputCls}
                type="number"
                step="0.01"
                {...register('taxRate', { valueAsNumber: true })}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-black text-slate-500">物料描述</label>
              <input className={inputCls} placeholder="规格/质保/采购备注…" {...register('description')} />
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="创建失败：编码可能已存在。" />
            </div>
          )}
          <PrimaryActionButton onClick={handleSubmit(onSubmit)} busy={create.isPending} pendingLabel="创建中">
            创建物料
          </PrimaryActionButton>
        </form>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载物料目录…" />
      ) : materials.length === 0 ? (
        <FeedbackNotice tone="info" message="暂无物料，点击新增。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={materials.map((m) => (
            <div
              key={m.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <p className="break-words font-black text-slate-950">{m.name}</p>
              <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                {m.code} · {m.brand || '—'}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="规格型号" value={m.specification || '—'} />
                <MiniFact label="分类 / 单位" value={`${m.category ?? '—'} / ${m.unit ?? '—'}`} />
                <MiniFact label="参考单价" value={currency(m.referencePrice)} />
                <MiniFact label="税率" value={`${m.taxRate ?? 0}%`} />
              </div>
              <button
                type="button"
                onClick={() => setSelected(m)}
                className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                查看详情
              </button>
            </div>
          ))}
        >
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">编码</th>
                <th className="px-4 py-3">名称</th>
                <th className="px-4 py-3">规格型号</th>
                <th className="px-4 py-3">品牌</th>
                <th className="px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">参考单价</th>
                <th className="px-4 py-3 text-right">税率</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {materials.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-4 font-mono font-black text-slate-700">{m.code}</td>
                  <td className="px-4 py-4 font-bold text-slate-900">{m.name}</td>
                  <td className="px-4 py-4 text-slate-600">{m.specification || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{m.brand || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{m.unit}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {currency(m.referencePrice)}
                  </td>
                  <td className="px-4 py-4 text-right text-slate-600">{m.taxRate ?? 0}%</td>
                  <td className="px-4 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelected(m)}
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                    >
                      详情
                    </button>
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
