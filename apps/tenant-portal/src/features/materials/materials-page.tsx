import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Database, Edit3, FileImage, FolderPlus, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { type MaterialResponse, useMaterialCreate, useMaterialList } from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Pagination, Panel, ResponsiveTableFrame, StatusPill, cn } from '@24bid/ui';
import { MaterialDetail } from './material-detail';
import { ExcelImportControl } from '../shared/excel-import-control';

const PAGE_SIZE = 8;

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
  governmentMallCatalog: z.boolean(),
  taxRate: z.number().min(0, '税率不能为负').max(100, '税率不超过 100'),
  description: z.string(),
});
type FormValues = z.infer<typeof schema>;

type StatusFilter = '全部状态' | '启用' | '停用';

const inputCls =
  'h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const DEFAULT_CATEGORY_GROUPS = [
  { title: '生产物资', children: ['原材料', '半成品', '包装材料'] },
  { title: 'MRO 工业品', children: ['五金工具', '劳保用品', '润滑油脂'] },
  { title: '行政办公', children: ['IT 设备', '办公耗材'] },
];
type CategoryGroup = (typeof DEFAULT_CATEGORY_GROUPS)[number];
const CATEGORY_STORAGE_KEY = '24bid.material.categories';

function materialStatus(material: MaterialResponse) {
  return material.description?.includes('停用') || material.description?.includes('禁用') ? '停用' : '启用';
}

function inferGroup(category?: string, groups: CategoryGroup[] = DEFAULT_CATEGORY_GROUPS) {
  if (!category) return '未分类';
  return groups.find((group) => group.children.includes(category))?.title ?? category;
}

function loadStoredCategoryGroups(): CategoryGroup[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORY_GROUPS;
  try {
    const stored = window.localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (!stored) return DEFAULT_CATEGORY_GROUPS;
    const parsed = JSON.parse(stored) as CategoryGroup[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CATEGORY_GROUPS;
    return parsed.filter((group) => group.title && Array.isArray(group.children));
  } catch {
    return DEFAULT_CATEGORY_GROUPS;
  }
}

function MaterialDialog({
  create,
  categoryOptions,
  errors,
  register,
  handleSubmit,
  onClose,
  onSubmit,
}: {
  create: ReturnType<typeof useMaterialCreate>;
  categoryOptions: string[];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
  register: ReturnType<typeof useForm<FormValues>>['register'];
  handleSubmit: ReturnType<typeof useForm<FormValues>>['handleSubmit'];
  onClose: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit(onSubmit)}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92dvh] w-full max-w-4xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl shadow-slate-950/20"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <Database size={17} />
            </span>
            <div>
              <p className="font-black text-slate-950">新增物料主数据</p>
              <p className="mt-0.5 text-xs font-bold text-slate-400">维护物料编码、分类、规格与参考价格</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[280px_1fr]">
          <div>
            <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-slate-300 shadow-sm">
                <FileImage size={20} />
              </span>
              <p className="mt-3 text-xs font-black text-slate-500">点击上传图片</p>
              <p className="mt-1 text-xs font-bold text-slate-400">支持 JPG、PNG，最大 5MB</p>
            </div>
            <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-black text-blue-700">提示</p>
              <p className="mt-1 text-xs font-bold leading-5 text-blue-600">
                物料编码可自动生成，也可手动输入。建议上传清晰物料图片以便于识别。
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="物料名称" required error={errors.name?.message}>
              <input className={inputCls} placeholder="请输入物料名称" {...register('name')} />
            </Field>
            <Field label="物料编码" required error={errors.code?.message}>
              <input className={inputCls} placeholder="自动生成或手动输入" {...register('code')} />
            </Field>
            <Field label="所属分类" required error={errors.category?.message}>
              <select className={inputCls} {...register('category')}>
                <option value="">请选择分类</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="物料属性">
              <input className={inputCls} placeholder="物资" {...register('brand')} />
            </Field>
            <Field label="规格型号">
              <input className={inputCls} placeholder="如 50*50mm" {...register('specification')} />
            </Field>
            <Field label="省政府网上商城目录">
              <label className="flex h-10 items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" {...register('governmentMallCatalog')} />
                属于山东省政府采购网上商城目录
              </label>
            </Field>
            <Field label="计量单位" required error={errors.unit?.message}>
              <input className={inputCls} placeholder="件" {...register('unit')} />
            </Field>
            <Field label="参考单价(元)">
              <input className={inputCls} type="number" step="0.01" {...register('referencePrice', { valueAsNumber: true })} />
            </Field>
            <Field label="税率(%)">
              <input className={inputCls} type="number" step="0.01" {...register('taxRate', { valueAsNumber: true })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="备注说明">
                <textarea
                  className="min-h-20 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  placeholder="请输入物料详细描述..."
                  {...register('description')}
                />
              </Field>
            </div>
          </div>
        </div>

        {create.isError && (
          <div className="px-5 pb-3">
            <FeedbackNotice tone="error" message="创建失败：编码可能已存在。" />
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            <Database size={14} /> {create.isPending ? '保存中' : '保存物料'}
          </button>
        </div>
      </form>
    </div>
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
      <span className="text-xs font-black text-slate-500">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {error && <p className="mt-1 text-xs font-bold text-red-600">{error}</p>}
    </label>
  );
}

export function MaterialsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('全部物料');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全部状态');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MaterialResponse | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>(loadStoredCategoryGroups);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ parent: DEFAULT_CATEGORY_GROUPS[0].title, name: '' });
  const [categoryMessage, setCategoryMessage] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ kind: 'group' | 'child'; groupTitle: string; name: string } | null>(
    null,
  );
  const [editName, setEditName] = useState('');

  const query = useMaterialList(keyword ? { keyword } : undefined);
  const create = useMaterialCreate();
  const materials = query.data?.data ?? [];

  useEffect(() => {
    window.localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categoryGroups));
  }, [categoryGroups]);

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
      governmentMallCatalog: false,
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

  const materialCategoryNames = useMemo(
    () => Array.from(new Set(materials.map((material) => material.category).filter(Boolean) as string[])),
    [materials],
  );

  const displayGroups = useMemo(() => {
    const managed = new Set(categoryGroups.flatMap((group) => [group.title, ...group.children]));
    const unknown = materialCategoryNames.filter((category) => !managed.has(category));
    return unknown.length > 0 ? [...categoryGroups, { title: '未归类', children: unknown }] : categoryGroups;
  }, [categoryGroups, materialCategoryNames]);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...categoryGroups.flatMap((group) => group.children), ...materialCategoryNames])),
    [categoryGroups, materialCategoryNames],
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 全部物料: materials.length };
    materials.forEach((material) => {
      const category = material.category || '未分类';
      const group = inferGroup(category, displayGroups);
      counts[category] = (counts[category] ?? 0) + 1;
      counts[group] = (counts[group] ?? 0) + 1;
    });
    return counts;
  }, [displayGroups, materials]);

  const filtered = useMemo(
    () =>
      materials.filter((material) => {
        const status = materialStatus(material);
        if (statusFilter !== '全部状态' && status !== statusFilter) return false;
        if (categoryFilter === '全部物料') return true;
        if (material.category === categoryFilter) return true;
        return inferGroup(material.category, displayGroups) === categoryFilter;
      }),
    [categoryFilter, displayGroups, materials, statusFilter],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pickCategory = (category: string) => {
    setCategoryFilter(category);
    setPage(1);
  };

  const addCategory = () => {
    const name = categoryDraft.name.trim();
    if (!name) return;
    if (categoryDraft.parent === '__ROOT__') {
      if (categoryGroups.some((group) => group.title === name)) {
        setCategoryMessage('该一级分类已存在。');
        return;
      }
      setCategoryGroups((groups) => [...groups, { title: name, children: [] }]);
    } else {
      if (categoryGroups.some((group) => group.title === name || group.children.includes(name))) {
        setCategoryMessage('该分类名称已存在。');
        return;
      }
      setCategoryGroups((groups) =>
        groups.map((group) => (group.title === categoryDraft.parent ? { ...group, children: [...group.children, name] } : group)),
      );
    }
    setCategoryDraft((draft) => ({ ...draft, name: '' }));
    setCategoryMessage('分类已新增。');
  };

  const startEditCategory = (kind: 'group' | 'child', groupTitle: string, name: string) => {
    setEditingCategory({ kind, groupTitle, name });
    setEditName(name);
    setCategoryMessage('');
  };

  const saveCategory = () => {
    if (!editingCategory) return;
    const nextName = editName.trim();
    if (!nextName) return;
    if (categoryGroups.some((group) => group.title === nextName || group.children.includes(nextName))) {
      setCategoryMessage('该分类名称已存在。');
      return;
    }
    setCategoryGroups((groups) =>
      groups.map((group) => {
        if (editingCategory.kind === 'group' && group.title === editingCategory.groupTitle) {
          return { ...group, title: nextName };
        }
        if (editingCategory.kind === 'child' && group.title === editingCategory.groupTitle) {
          return { ...group, children: group.children.map((child) => (child === editingCategory.name ? nextName : child)) };
        }
        return group;
      }),
    );
    if (categoryFilter === editingCategory.name || categoryFilter === editingCategory.groupTitle) setCategoryFilter(nextName);
    setEditingCategory(null);
    setEditName('');
    setCategoryMessage('分类已更新。');
  };

  const deleteCategory = (kind: 'group' | 'child', groupTitle: string, name: string) => {
    const usedCount = categoryCounts[name] ?? 0;
    const childCount = categoryGroups.find((group) => group.title === name)?.children.length ?? 0;
    if (usedCount > 0 || childCount > 0) {
      setCategoryMessage('该分类仍有关联物料或子分类，暂不能删除。');
      return;
    }
    setCategoryGroups((groups) =>
      kind === 'group'
        ? groups.filter((group) => group.title !== name)
        : groups.map((group) =>
            group.title === groupTitle ? { ...group, children: group.children.filter((child) => child !== name) } : group,
          ),
    );
    if (categoryFilter === name) setCategoryFilter('全部物料');
    setCategoryMessage('分类已删除。');
  };

  if (selected) {
    const fresh = materials.find((m) => m.id === selected.id) ?? selected;
    return <MaterialDetail material={fresh} onBack={() => setSelected(null)} />;
  }

  return (
    <>
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[260px_1fr]">
        <Panel title="物料分类" icon={Package} subtitle="按主数据分类浏览">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-400">共 {categoryCounts['全部物料'] ?? 0} 条物料</span>
            <button
              type="button"
              onClick={() => setShowCategoryManager((value) => !value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-black transition',
                showCategoryManager
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              <FolderPlus size={14} />
              维护分类
            </button>
          </div>

          {showCategoryManager && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2">
                <p className="text-xs font-black text-slate-700">新增分类</p>
              <select
                value={categoryDraft.parent}
                onChange={(event) => setCategoryDraft((draft) => ({ ...draft, parent: event.target.value }))}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              >
                <option value="__ROOT__">新增一级分类</option>
                {categoryGroups.map((group) => (
                  <option key={group.title} value={group.title}>
                    新增到：{group.title}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="输入分类名称"
                  className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={addCategory}
                  className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-black text-white hover:bg-slate-800"
                >
                  新增
                </button>
              </div>
                {editingCategory && (
                  <div className="grid gap-2 border-t border-slate-200 pt-3">
                    <p className="text-xs font-black text-slate-700">编辑分类</p>
                    <div className="flex gap-2">
                  <input
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={saveCategory}
                    className="inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700"
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCategory(null)}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                  >
                    取消
                  </button>
                </div>
                  </div>
                )}
                {categoryMessage && <p className="text-xs font-bold text-slate-500">{categoryMessage}</p>}
                <div className="grid gap-1 border-t border-slate-200 pt-3">
                  <p className="text-xs font-black text-slate-700">分类列表</p>
                  {categoryGroups.map((group) => (
                    <div key={group.title} className="rounded-md border border-slate-200 bg-white p-2">
                      <CategoryManageRow
                        label={group.title}
                        count={categoryCounts[group.title] ?? 0}
                        onEdit={() => startEditCategory('group', group.title, group.title)}
                        onDelete={() => deleteCategory('group', group.title, group.title)}
                      />
                      {group.children.length > 0 && (
                        <div className="mt-1 space-y-1 border-l border-slate-100 pl-2">
                          {group.children.map((child) => (
                            <CategoryManageRow
                              key={child}
                              label={child}
                              count={categoryCounts[child] ?? 0}
                              subtle
                              onEdit={() => startEditCategory('child', group.title, child)}
                              onDelete={() => deleteCategory('child', group.title, child)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <CategoryButton
              label="全部物料"
              count={categoryCounts['全部物料'] ?? 0}
              active={categoryFilter === '全部物料'}
              onClick={() => pickCategory('全部物料')}
            />
            {displayGroups.map((group) => (
              <div key={group.title} className="pt-2">
                <CategoryButton
                  label={group.title}
                  count={categoryCounts[group.title] ?? 0}
                  active={categoryFilter === group.title}
                  onClick={() => pickCategory(group.title)}
                />
                <div className="ml-4 mt-1 space-y-1 border-l border-slate-100 pl-3">
                  {group.children.map((child) => (
                    <CategoryButton
                      key={child}
                      label={child}
                      count={categoryCounts[child] ?? 0}
                      active={categoryFilter === child}
                      onClick={() => pickCategory(child)}
                      subtle
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="物料库" icon={Database} subtitle="物料与服务主数据">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value);
                  setPage(1);
                }}
                placeholder="搜索物料编码、名称..."
                className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StatusFilter);
                setPage(1);
              }}
              className="h-8 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              <option>全部状态</option>
              <option>启用</option>
              <option>停用</option>
            </select>
            <div className="ml-auto">
              <ExcelImportControl
                endpoint="/api/v1/buyer/materials/import"
                templateName="物料导入模板"
                invalidatePrefix="/api/v1/buyer/materials"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
            >
              <Plus size={14} /> 新增物料
            </button>
          </div>

          {query.isLoading ? (
            <FeedbackNotice tone="info" message="正在加载物料库…" />
          ) : filtered.length === 0 ? (
            <FeedbackNotice tone="info" message={keyword || categoryFilter !== '全部物料' ? '没有符合条件的物料。' : '暂无物料，点击新增。'} />
          ) : (
            <>
              <ResponsiveTableFrame
                mobileCards={pageItems.map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                    <p className="break-words font-black text-slate-950">{m.name}</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">
                      {m.code} · {m.specification || '—'}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <MiniFact label="分类 / 单位" value={`${m.category ?? '—'} / ${m.unit ?? '—'}`} />
                      <MiniFact label="参考单价" value={currency(m.referencePrice)} />
                      <MiniFact label="商城目录" value={m.governmentMallCatalog ? '山东省政府网上商城' : '学校采购目录'} />
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
                <table className="w-full min-w-[920px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black text-slate-500">
                    <tr>
                      <th className="px-5 py-4">物料编码</th>
                      <th className="px-5 py-4">物料名称</th>
                      <th className="px-5 py-4">规格型号</th>
                      <th className="px-5 py-4">单位</th>
                      <th className="px-5 py-4">所属分类</th>
                      <th className="px-5 py-4">目录属性</th>
                      <th className="px-5 py-4 text-right">参考价</th>
                      <th className="px-5 py-4">状态</th>
                      <th className="px-5 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pageItems.map((m) => (
                      <tr key={m.id} className="hover:bg-blue-50/30">
                        <td className="px-5 py-5 font-mono text-xs font-black text-slate-500">{m.code}</td>
                        <td className="px-5 py-5">
                          <p className="font-black text-slate-950">{m.name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">{m.brand || '未维护品牌/属性'}</p>
                        </td>
                        <td className="px-5 py-5 text-sm font-bold text-slate-600">{m.specification || '—'}</td>
                        <td className="px-5 py-5 text-sm font-bold text-slate-600">{m.unit}</td>
                        <td className="px-5 py-5">
                          <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">
                            {m.category ?? '—'}
                          </span>
                        </td>
                        <td className="px-5 py-5">
                          <span className={cn(
                            'inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-black',
                            m.governmentMallCatalog ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500',
                          )}>
                            {m.governmentMallCatalog ? '省商城目录' : '校内目录'}
                          </span>
                        </td>
                        <td className="px-5 py-5 text-right font-mono font-black text-slate-900">
                          {currency(m.referencePrice)}
                        </td>
                        <td className="px-5 py-5">
                          <StatusPill label={materialStatus(m)} />
                        </td>
                        <td className="px-5 py-5 text-right">
                          <button
                            type="button"
                            onClick={() => setSelected(m)}
                            className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-blue-600 hover:bg-slate-50"
                          >
                            查看
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTableFrame>
              <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
            </>
          )}
        </Panel>
      </div>

      {showForm && (
        <MaterialDialog
          create={create}
          errors={errors}
          register={register}
          handleSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
          onSubmit={onSubmit}
          categoryOptions={categoryOptions}
        />
      )}
    </>
  );
}

function CategoryButton({
  label,
  count,
  active,
  subtle,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-full items-center justify-between rounded-md px-3 text-xs font-black transition',
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
        subtle && 'font-bold',
      )}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 font-mono text-xs text-slate-400">{count}</span>
    </button>
  );
}

function CategoryManageRow({
  label,
  count,
  subtle,
  onEdit,
  onDelete,
}: {
  label: string;
  count: number;
  subtle?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-8 items-center gap-2 rounded-md px-2 text-xs">
      <span className={cn('min-w-0 flex-1 truncate font-black text-slate-700', subtle && 'font-bold text-slate-500')}>
        {label}
      </span>
      <span className="w-7 text-right font-mono font-bold text-slate-400">{count}</span>
      <button
        type="button"
        onClick={onEdit}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        aria-label={`编辑${label}`}
      >
        <Edit3 size={12} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        aria-label={`删除${label}`}
      >
        <Trash2 size={12} />
      </button>
    </div>
  );
}
