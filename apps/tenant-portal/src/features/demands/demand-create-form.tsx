import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Calculator, ClipboardList, Search, Trash2 } from 'lucide-react';
import {
  type MaterialResponse,
  type PurchaseDemandResponse,
  useDepartmentList,
  useMaterialList,
  usePurchaseDemandCreate,
  usePurchaseDemandUpdate,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

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
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const labelCls = 'text-xs font-black text-slate-500';

const currency = (value?: number) =>
  value == null ? '—' : `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

function materialSummary(material?: MaterialResponse) {
  if (!material) return '未选择物料';
  return [material.code, material.specification, material.category].filter(Boolean).join(' · ') || '暂无规格信息';
}

export function DemandCreateForm({ onCreated, onBack, initialDemand }: {
  onCreated: () => void; onBack: () => void; initialDemand?: PurchaseDemandResponse;
}) {
  const departments = useDepartmentList();
  const [materialSearchTerm, setMaterialSearchTerm] = useState('');
  const [materialQueryKeyword, setMaterialQueryKeyword] = useState('');
  const materials = useMaterialList(
    materialQueryKeyword ? { keyword: materialQueryKeyword } : undefined,
    { query: { placeholderData: (previous) => previous } },
  );
  const create = usePurchaseDemandCreate();
  const update = usePurchaseDemandUpdate();
  const saving = initialDemand ? update : create;
  const [selectedMaterialCache, setSelectedMaterialCache] = useState<Record<string, MaterialResponse>>({});

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialDemand?.title ?? '',
      departmentId: initialDemand?.departmentId ?? '',
      budget: initialDemand?.budget ?? 0,
      expectedDeliveryDate: initialDemand?.expectedDeliveryDate ?? '',
      priority: initialDemand?.priority ?? '常规',
      purpose: initialDemand?.purpose ?? '',
      lineItems: initialDemand?.lineItems?.map((line) => ({ materialId: line.materialId ?? '', quantity: line.quantity ?? 1 })) ?? [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });
  const lineItems = useWatch({ control, name: 'lineItems' }) ?? [];
  const budgetValue = useWatch({ control, name: 'budget' }) ?? 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setMaterialQueryKeyword(materialSearchTerm.trim());
    }, 260);
    return () => window.clearTimeout(timer);
  }, [materialSearchTerm]);

  const deptList = departments.data?.data ?? [];
  const matList = materials.data?.data ?? [];
  const materialMap = useMemo(() => {
    const map: Record<string, MaterialResponse> = { ...selectedMaterialCache };
    matList.forEach((material) => {
      if (material.id) map[material.id] = material;
    });
    return map;
  }, [matList, selectedMaterialCache]);

  const filteredMaterials = useMemo(() => {
    return matList.slice(0, materialQueryKeyword ? 20 : 10);
  }, [matList, materialQueryKeyword]);

  const selectedMaterialIds = new Set(lineItems.map((item) => item?.materialId).filter(Boolean));
  const estimatedTotal = lineItems.reduce((sum, item) => {
    const material = materialMap[item?.materialId ?? ''];
    return sum + (material?.referencePrice ?? 0) * (item?.quantity ?? 0);
  }, 0);

  const addMaterial = (material: MaterialResponse) => {
    if (!material.id) return;
    if (!selectedMaterialIds.has(material.id)) {
      setSelectedMaterialCache((current) => ({ ...current, [material.id!]: material }));
      append({ materialId: material.id, quantity: 1 });
    }
  };

  const onSubmit = (values: FormValues) => {
    const data = {
      title: values.title,
      departmentId: values.departmentId,
      budget: values.budget,
      lineItems: values.lineItems,
      expectedDeliveryDate: values.expectedDeliveryDate || undefined,
      priority: values.priority,
      purpose: values.purpose,
    };
    const options = {
      onSuccess: () => {
        reset();
        onCreated();
      },
    };
    if (initialDemand?.id) update.mutate({ demandId: initialDemand.id, data }, options);
    else create.mutate({ data }, options);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="返回采购需求"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-950">{initialDemand ? '修改采购需求' : '新建采购需求'}</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {initialDemand ? `${initialDemand.id} · ${initialDemand.status}` : '填写需求基本信息 · 从物料库检索并添加采购明细 · 创建后进入草稿状态'}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <p className="text-xs font-bold text-slate-400">
          <span className="mr-1 text-red-500">*</span>为必填项;物料明细至少一条。
        </p>

        <DemandCreateSection accent="blue" title="基本信息">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_16rem]">
            <Field label="需求标题" required error={errors.title?.message}>
              <input className={inputCls} placeholder="如：研发团队办公电脑采购" {...register('title')} />
            </Field>
            <Field label="申请部门" required error={errors.departmentId?.message}>
              <select className={inputCls} {...register('departmentId')}>
                <option value="">请选择部门</option>
                {deptList.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="优先级">
              <select className={inputCls} {...register('priority')}>
                <option value="常规">常规</option>
                <option value="紧急">紧急</option>
                <option value="低">低</option>
              </select>
            </Field>
          </div>
        </DemandCreateSection>

        <DemandCreateSection accent="emerald" title="申请信息">
          <div className="grid gap-6 lg:grid-cols-2">
            <Field label="预算金额（元）">
              <input className={inputCls} type="number" step="0.01" placeholder="0.00" {...register('budget', { valueAsNumber: true })} />
            </Field>
            <Field label="期望交期">
              <input className={inputCls} type="date" {...register('expectedDeliveryDate')} />
            </Field>
            <div className="lg:col-span-2">
              <Field label="用途说明">
                <textarea
                  className={`${inputCls} min-h-24 resize-none py-3`}
                  placeholder="如：研发团队扩编办公电脑配备，需统一采购并在本月底前完成交付。"
                  {...register('purpose')}
                />
              </Field>
            </div>
          </div>
        </DemandCreateSection>

        <DemandCreateSection accent="violet" title="采购物料明细(必填,至少一条)">
          <div className="grid gap-5 xl:grid-cols-[22rem_1fr]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={materialSearchTerm}
                  onChange={(event) => setMaterialSearchTerm(event.target.value)}
                  placeholder="搜索物料名称、编码、分类、规格"
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="mt-3 min-h-[28rem] max-h-[28rem] space-y-2 overflow-y-auto pr-1">
                {materials.isLoading && filteredMaterials.length === 0 ? (
                  <FeedbackNotice tone="info" message="正在加载物料清单…" />
                ) : filteredMaterials.length === 0 ? (
                  <FeedbackNotice tone="info" message="未找到匹配物料。" />
                ) : (
                  filteredMaterials.map((material) => {
                    const selected = !!material.id && selectedMaterialIds.has(material.id);
                    return (
                      <button
                        key={material.id ?? material.code ?? material.name}
                        type="button"
                        onClick={() => addMaterial(material)}
                        className={cn(
                          'w-full rounded-lg border bg-white p-3 text-left transition hover:border-blue-200 hover:bg-blue-50/30',
                          selected ? 'border-blue-200 ring-1 ring-blue-100' : 'border-slate-200',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950">{material.name}</p>
                            <p className="mt-1 truncate text-xs font-bold text-slate-400">{materialSummary(material)}</p>
                          </div>
                          <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-600">
                            {currency(material.referencePrice)}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <div className="mb-3">
                <div>
                  <p className={labelCls}>已选物料</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    从左侧物料库点选添加；右侧仅调整数量、查看金额和删除。
                  </p>
                </div>
              </div>
              {errors.lineItems?.message && (
                <p className="mb-2 text-xs font-bold text-red-600">{errors.lineItems.message}</p>
              )}
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black text-slate-500">
                    <tr>
                      <th className="w-16 px-5 py-4">序号</th>
                      <th className="px-5 py-4">物料信息</th>
                      <th className="w-20 px-5 py-4">单位</th>
                      <th className="px-5 py-4 text-right">参考单价</th>
                      <th className="w-24 px-5 py-4 text-right">数量</th>
                      <th className="px-5 py-4 text-right">预算小计</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {fields.map((field, index) => {
                      const selectedMaterial = materialMap[lineItems[index]?.materialId ?? ''];
                      const quantity = lineItems[index]?.quantity ?? 0;
                      const amount = selectedMaterial?.referencePrice ? selectedMaterial.referencePrice * quantity : undefined;
                      return (
                        <tr key={field.id} className="hover:bg-blue-50/30">
                          <td className="px-5 py-5 font-mono font-black text-slate-400">{index + 1}</td>
                          <td className="px-5 py-5">
                            <input type="hidden" {...register(`lineItems.${index}.materialId`)} />
                            <p className="font-black text-slate-950">{selectedMaterial?.name ?? '物料已失效'}</p>
                            <p className="mt-1 text-xs font-bold text-slate-400">{materialSummary(selectedMaterial)}</p>
                          </td>
                          <td className="whitespace-nowrap px-5 py-5 text-sm font-bold text-slate-600">{selectedMaterial?.unit ?? '—'}</td>
                          <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(selectedMaterial?.referencePrice)}</td>
                          <td className="px-5 py-5 text-right">
                            <input
                              className="h-9 w-16 rounded-lg border border-slate-200 bg-white px-2 text-right text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                              type="number"
                              min={1}
                              {...register(`lineItems.${index}.quantity`, { valueAsNumber: true })}
                            />
                          </td>
                          <td className="px-5 py-5 text-right font-mono font-black text-slate-900">{currency(amount)}</td>
                          <td className="px-5 py-5 text-right">
                            {fields.length > 1 && (
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:bg-red-50 hover:text-red-600"
                                aria-label="删除物料行"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {fields.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-12 text-center">
                          <p className="text-sm font-black text-slate-700">尚未选择采购物料</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">
                            请在左侧搜索物料名称、编码、分类或规格，点击物料卡片后会自动加入明细。
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td colSpan={5} className="px-5 py-4 text-right text-xs font-black text-slate-500">参考预算合计</td>
                      <td className="px-5 py-4 text-right font-mono text-xl font-black text-violet-600">{currency(estimatedTotal)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
                <div className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                    <Calculator size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-black text-blue-900">预算合理性核对(基于物料参考价)</p>
                    <p className="mt-1 text-xs font-bold text-blue-700">
                      {estimatedTotal > 0 ? (
                        budgetValue > 0 ? (
                          <>
                            填写预算 {currency(budgetValue)},物料参考价合计 {currency(estimatedTotal)}
                            (偏差 {(((budgetValue - estimatedTotal) / estimatedTotal) * 100).toFixed(1)}%)。
                            {Math.abs(budgetValue - estimatedTotal) / estimatedTotal <= 0.15 ? (
                              <span className="text-emerald-600"> 偏差在 15% 以内,合理。</span>
                            ) : (
                              <span className="text-red-600"> 偏差超过 15%,建议复核数量/单价或在用途说明中补充原因。</span>
                            )}
                          </>
                        ) : (
                          <>物料参考价合计 {currency(estimatedTotal)},可作为预算填写参考。</>
                        )
                      ) : (
                        <>所选物料暂无参考价,无法核对;可在物料目录维护参考价后重试。</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DemandCreateSection>

        {saving.isError && (
          <FeedbackNotice tone="error" message="保存失败：请检查输入、数据权限或单据状态。" />
        )}

        <div className="sticky bottom-4 z-10 rounded-lg border border-slate-200 bg-white/95 p-4 shadow-lg shadow-slate-200/70 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">{initialDemand ? '确认采购需求修改' : '确认创建采购需求'}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                已选择 {fields.length} 项物料 · 参考预算合计 {currency(estimatedTotal)}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving.isPending}
                className="inline-flex h-10 min-w-40 items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                aria-busy={saving.isPending || undefined}
              >
                <ClipboardList size={16} />
                {saving.isPending ? '保存中' : initialDemand ? '保存需求修改' : '创建需求草稿'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

function DemandCreateSection({
  accent,
  title,
  children,
}: {
  accent: 'blue' | 'emerald' | 'violet';
  title: string;
  children: ReactNode;
}) {
  const accentCls = {
    blue: 'before:bg-blue-600',
    emerald: 'before:bg-emerald-500',
    violet: 'before:bg-violet-500',
  }[accent];

  return (
    <section className={cn('relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm before:absolute before:left-0 before:top-8 before:h-6 before:w-1 before:rounded-r', accentCls)}>
      <h2 className="mb-6 text-lg font-black text-slate-950">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className={labelCls}>
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </span>
      <span className="mt-2 block">{children}</span>
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </label>
  );
}
