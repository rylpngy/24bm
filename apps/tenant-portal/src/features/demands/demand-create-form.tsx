import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import {
  useDepartmentList,
  useMaterialList,
  usePurchaseDemandCreate,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';

const schema = z.object({
  title: z.string().min(2, '标题至少 2 个字'),
  departmentId: z.string().min(1, '请选择申请部门'),
  budget: z.number().min(0, '预算不能为负'),
  expectedDeliveryDate: z.string(),
  priority: z.string(),
  purpose: z.string(),
  lineItems: z
    .array(
      z.object({
        materialId: z.string().min(1, '请选择物料'),
        quantity: z.number().min(1, '数量至少 1'),
      }),
    )
    .min(1, '至少一条物料明细'),
});

type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const labelCls = 'text-xs font-black text-slate-500';

export function DemandCreateForm({ onCreated }: { onCreated: () => void }) {
  const departments = useDepartmentList();
  const materials = useMaterialList();
  const create = usePurchaseDemandCreate();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      departmentId: '',
      budget: 0,
      expectedDeliveryDate: '',
      priority: '常规',
      purpose: '',
      lineItems: [{ materialId: '', quantity: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  const onSubmit = (values: FormValues) => {
    create.mutate(
      {
        data: {
          title: values.title,
          departmentId: values.departmentId,
          budget: values.budget,
          lineItems: values.lineItems,
          expectedDeliveryDate: values.expectedDeliveryDate || undefined,
          priority: values.priority,
          purpose: values.purpose,
        },
      },
      {
        onSuccess: () => {
          reset();
          onCreated();
        },
      },
    );
  };

  const deptList = departments.data?.data ?? [];
  const matList = materials.data?.data ?? [];

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4"
    >
      <p className="text-sm font-black text-blue-800">新建采购需求</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>需求标题</label>
          <input className={inputCls} placeholder="如：办公电脑采购" {...register('title')} />
          {errors.title && <p className="mt-1 text-xs font-bold text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className={labelCls}>申请部门</label>
          <select className={inputCls} {...register('departmentId')}>
            <option value="">请选择部门</option>
            {deptList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {errors.departmentId && (
            <p className="mt-1 text-xs font-bold text-red-600">{errors.departmentId.message}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>预算金额(可选)</label>
          <input
            className={inputCls}
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register('budget', { valueAsNumber: true })}
          />
        </div>
        <div>
          <label className={labelCls}>期望交期</label>
          <input className={inputCls} type="date" {...register('expectedDeliveryDate')} />
        </div>
        <div>
          <label className={labelCls}>优先级</label>
          <select className={inputCls} {...register('priority')}>
            <option value="常规">常规</option>
            <option value="紧急">紧急</option>
            <option value="低">低</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>用途说明</label>
        <input className={inputCls} placeholder="如：研发团队扩编办公电脑配备" {...register('purpose')} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className={labelCls}>物料明细</p>
          <button
            type="button"
            onClick={() => append({ materialId: '', quantity: 1 })}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-blue-200 bg-white px-2 text-xs font-black text-blue-700"
          >
            <Plus size={13} /> 添加
          </button>
        </div>
        {errors.lineItems?.message && (
          <p className="mt-1 text-xs font-bold text-red-600">{errors.lineItems.message}</p>
        )}
        <div className="mt-2 space-y-2">
          {fields.map((field, i) => (
            <div key={field.id} className="flex items-center gap-2">
              <select className={inputCls} {...register(`lineItems.${i}.materialId`)}>
                <option value="">选择物料</option>
                {matList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}（{m.code}）
                  </option>
                ))}
              </select>
              <input
                className="w-24 shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                type="number"
                min={1}
                {...register(`lineItems.${i}.quantity`, { valueAsNumber: true })}
              />
              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="shrink-0 rounded-md border border-slate-200 bg-white p-2 text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {create.isError && (
        <div className="mt-3">
          <FeedbackNotice tone="error" message="创建失败：请检查输入或后端状态。" />
        </div>
      )}
      <PrimaryActionButton onClick={handleSubmit(onSubmit)} busy={create.isPending} pendingLabel="创建中">
        创建需求(草稿)
      </PrimaryActionButton>
    </form>
  );
}
