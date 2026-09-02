import { useMemo, useState } from 'react';
import { type MaterialResponse, useMaterialList } from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';
import { FilePlus2, Search, Trash2 } from 'lucide-react';
import { emptyItem, type LudongItem } from './api';

export type LudongMaterialStage = 'application' | 'argumentation' | 'mall-selection';

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const textareaClass = 'min-h-20 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const stageCopy: Record<LudongMaterialStage, { title: string; description: string; empty: string }> = {
  application: {
    title: '拟采购设备清单',
    description: '可从学校采购目录选择，也可新增目录外设备。目录带出的价格、数量、参数、型号和用途均为参考，申请人可按市场调研结果修改。',
    empty: '请从学校采购目录选择设备，或新增目录外设备。',
  },
  argumentation: {
    title: '附件三配置及型号数量',
    description: '查看申请人市场调研明细，并在必要性论证中核定配置标准、参考品牌型号和主要技术参数。',
    empty: '申报人尚未填写拟采购设备清单。',
  },
  'mall-selection': {
    title: '网上商城品牌型号确认单',
    description: '系统仅自动带入学校采购目录中标记为“山东省政府网上商城目录”的设备，申请人确认最终品牌、型号、供应商及商城价格。',
    empty: '当前拟采购设备不属于山东省政府网上商城目录，无需填写本确认单。',
  },
};

export function LudongPocMaterialItemsEditor({ stage, items, onChange }: {
  stage: LudongMaterialStage;
  items: LudongItem[];
  onChange: (items: LudongItem[]) => void;
}) {
  const materials = useMaterialList();
  const [searchTerm, setSearchTerm] = useState('');
  const materialList = materials.data?.data ?? [];
  const keyword = searchTerm.trim().toLowerCase();
  const filteredMaterials = useMemo(() => materialList.filter((material) => {
    if (!keyword) return true;
    return [material.name, material.code, material.category, material.specification]
      .filter(Boolean).join(' ').toLowerCase().includes(keyword);
  }), [keyword, materialList]);
  const selectedIds = new Set(items.map((item) => item.materialId).filter(Boolean));
  const copy = stageCopy[stage];
  const visibleRows = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => stage !== 'mall-selection' || item.governmentMallCatalog === '是');

  const update = (index: number, key: keyof LudongItem, value: string) => onChange(items.map((item, rowIndex) => {
    if (rowIndex !== index) return item;
    const next = { ...item, [key]: value } as LudongItem;
    if (key === 'quantity' || key === 'unitPrice') {
      next.totalPrice = String(Number(next.quantity || 0) * Number(next.unitPrice || 0) || '');
    }
    return next;
  }));

  const selectMaterial = (material: MaterialResponse) => {
    if (!material.id || selectedIds.has(material.id)) return;
    const referencePrice = String(material.referencePrice ?? '');
    onChange([...items, {
      ...emptyItem(),
      materialId: material.id,
      materialCode: material.code ?? '',
      materialCategory: material.category ?? '',
      catalogSource: 'catalog',
      governmentMallCatalog: material.governmentMallCatalog ? '是' : '否',
      unit: material.unit ?? '',
      name: material.name ?? '',
      quantity: '1',
      unitPrice: referencePrice,
      totalPrice: referencePrice,
      technicalParameters: material.specification ?? '',
      referenceBrands: material.brand ?? '',
      purpose: material.description ?? '',
      configurationLimit: '附件3（办公设备及家具配置标准）',
    }]);
  };

  const addCustomItem = () => onChange([...items, emptyItem()]);
  const referenceTotal = items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const mallTotal = visibleRows.reduce((sum, { item }) => (
    sum + Number(item.selectedUnitPrice || 0) * Number(item.quantity || 0)
  ), 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-slate-950">{copy.title}</p>
            <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
              {stage === 'application' ? '目录参考值可修改' : stage === 'mall-selection' ? `自动带入 ${visibleRows.length} 项` : '沿用申报清单'}
            </span>
          </div>
          <p className="mt-1 max-w-4xl text-xs font-bold leading-5 text-slate-500">{copy.description}</p>
        </div>
        {stage === 'application' && (
          <button type="button" onClick={addCustomItem} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 hover:bg-blue-50">
            <FilePlus2 size={14} /> 新增目录外设备
          </button>
        )}
      </div>

      <div className={cn('grid gap-4', stage === 'application' && 'xl:grid-cols-[20rem_minmax(0,1fr)]')}>
        {stage === 'application' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="搜索学校采购目录" className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="mt-3 max-h-[42rem] min-h-[18rem] space-y-2 overflow-y-auto pr-1">
              {materials.isLoading && filteredMaterials.length === 0 ? (
                <FeedbackNotice tone="info" message="正在加载学校采购目录…" />
              ) : filteredMaterials.length === 0 ? (
                <FeedbackNotice tone="info" message="目录中未找到匹配设备，可新增目录外设备。" />
              ) : filteredMaterials.map((material) => {
                const selected = !!material.id && selectedIds.has(material.id);
                return (
                  <button key={material.id ?? material.code ?? material.name} type="button" disabled={selected} onClick={() => selectMaterial(material)} className={cn('w-full rounded-lg border bg-white p-3 text-left transition', selected ? 'cursor-default border-blue-200 bg-blue-50/60' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-950">{material.name}</p>
                        <p className="mt-1 truncate text-xs font-bold text-slate-400">{[material.code, material.category, material.specification].filter(Boolean).join(' · ') || '—'}</p>
                        <span className={cn('mt-2 inline-flex rounded-md px-2 py-1 text-[10px] font-black', material.governmentMallCatalog ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500')}>
                          {material.governmentMallCatalog ? '省政府商城目录' : '学校采购目录'}
                        </span>
                      </div>
                      <span className={cn('shrink-0 rounded-md px-2 py-1 text-[11px] font-black', selected ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600')}>{selected ? '已选择' : `¥${Number(material.referencePrice ?? 0).toLocaleString('zh-CN')}`}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-3">
          {visibleRows.length === 0 && (
            <div className="flex min-h-[13rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">
              <div><p className="text-sm font-black text-slate-700">暂无设备明细</p><p className="mt-2 text-xs font-bold text-slate-400">{copy.empty}</p></div>
            </div>
          )}
          {visibleRows.map(({ item, index }, displayIndex) => (
            <div key={`${item.materialId || 'custom'}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-black text-white">{displayIndex + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-black text-slate-950">{item.name || '目录外设备'}</p>
                    <span className={cn('rounded-md px-2 py-1 text-[11px] font-black', item.catalogSource === 'catalog' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{item.catalogSource === 'catalog' ? '学校目录选取' : '目录外自填'}</span>
                    {item.governmentMallCatalog === '是' && <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">自动进入商城确认单</span>}
                  </div>
                  <p className="mt-1 truncate text-xs font-bold text-slate-400">{[item.materialCode, item.materialCategory].filter(Boolean).join(' · ') || '申请人市场调研自填设备'}</p>
                </div>
                {stage === 'application' && <button type="button" onClick={() => onChange(items.filter((_, rowIndex) => rowIndex !== index))} aria-label={`删除第 ${displayIndex + 1} 条设备`} title="删除设备" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>}
              </div>

              {stage === 'application' && <ApplicationFields item={item} index={index} update={update} />}
              {stage === 'argumentation' && <ArgumentationFields item={item} index={index} update={update} />}
              {stage === 'mall-selection' && <MallFields item={item} index={index} update={update} />}
            </div>
          ))}
          {visibleRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg bg-slate-50 px-4 py-3">
              <span className="text-xs font-black text-slate-500">{stage === 'mall-selection' ? '商城确认金额合计' : '设备调研预算合计'}</span>
              <strong className="font-mono text-lg text-blue-700">¥{(stage === 'mall-selection' ? mallTotal : referenceTotal).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type UpdateItem = (index: number, key: keyof LudongItem, value: string) => void;

function ApplicationFields({ item, index, update }: { item: LudongItem; index: number; update: UpdateItem }) {
  return <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <StageField label="设备名称" required className="lg:col-span-2"><input className={inputClass} value={item.name} onChange={(event) => update(index, 'name', event.target.value)} /></StageField>
    <StageField label="数量" required><input type="number" min="1" className={inputClass} value={item.quantity} onChange={(event) => update(index, 'quantity', event.target.value)} /></StageField>
    <StageField label="计量单位" required><input className={inputClass} value={item.unit} onChange={(event) => update(index, 'unit', event.target.value)} placeholder="台、套、件" /></StageField>
    <StageField label="市场调研单价（元）" required><input type="number" min="0" className={inputClass} value={item.unitPrice} onChange={(event) => update(index, 'unitPrice', event.target.value)} /></StageField>
    <StageField label="预算小计（元）"><input readOnly className={cn(inputClass, 'bg-slate-50 text-slate-600')} value={item.totalPrice} /></StageField>
    <StageField label="参考品牌及型号" className="lg:col-span-2"><input className={inputClass} value={item.referenceBrands} onChange={(event) => update(index, 'referenceBrands', event.target.value)} /></StageField>
    <StageField label="主要技术参数、配置" required className="md:col-span-2"><textarea className={textareaClass} value={item.technicalParameters} onChange={(event) => update(index, 'technicalParameters', event.target.value)} /></StageField>
    <StageField label="设备用途" required className="md:col-span-2"><textarea className={textareaClass} value={item.purpose} onChange={(event) => update(index, 'purpose', event.target.value)} /></StageField>
  </div>;
}

function ArgumentationFields({ item, index, update }: { item: LudongItem; index: number; update: UpdateItem }) {
  return <div className="mt-4 grid gap-4 md:grid-cols-4">
    <StageField label={`数量${item.unit ? `（${item.unit}）` : ''}`} required><input type="number" min="1" className={inputClass} value={item.quantity} onChange={(event) => update(index, 'quantity', event.target.value)} /></StageField>
    <StageField label="调研参考单价（元）" required><input className={inputClass} value={item.unitPrice} onChange={(event) => update(index, 'unitPrice', event.target.value)} /></StageField>
    <StageField label="参考预算小计（元）"><input readOnly className={cn(inputClass, 'bg-slate-50 text-slate-600')} value={item.totalPrice} /></StageField>
    <StageField label="附件三配置标准" required><input className={inputClass} value={item.configurationLimit} onChange={(event) => update(index, 'configurationLimit', event.target.value)} /></StageField>
    <StageField label="申报用途" className="md:col-span-2"><textarea readOnly className={cn(textareaClass, 'bg-slate-50 text-slate-600')} value={item.purpose} /></StageField>
    <StageField label="参考品牌、型号" required className="md:col-span-2"><textarea className={textareaClass} value={item.referenceBrands} onChange={(event) => update(index, 'referenceBrands', event.target.value)} /></StageField>
    <StageField label="主要技术参数与配置" required className="md:col-span-4"><textarea className={textareaClass} value={item.technicalParameters} onChange={(event) => update(index, 'technicalParameters', event.target.value)} /></StageField>
  </div>;
}

function MallFields({ item, index, update }: { item: LudongItem; index: number; update: UpdateItem }) {
  return <div className="mt-4 space-y-4">
    <div className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs font-bold text-slate-600 sm:grid-cols-3">
      <span>采购数量：<b className="text-slate-900">{item.quantity} {item.unit}</b></span>
      <span>调研单价：<b className="font-mono text-slate-900">¥{Number(item.unitPrice || 0).toLocaleString('zh-CN')}</b></span>
      <span className="truncate" title={item.technicalParameters}>申报参数：<b className="text-slate-900">{item.technicalParameters || '—'}</b></span>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StageField label="最终品牌" required><input className={inputClass} value={item.selectedBrand} onChange={(event) => update(index, 'selectedBrand', event.target.value)} /></StageField>
      <StageField label="最终型号" required><input className={inputClass} value={item.selectedModel} onChange={(event) => update(index, 'selectedModel', event.target.value)} /></StageField>
      <StageField label="商城供应商" required><input className={inputClass} value={item.selectedSupplier} onChange={(event) => update(index, 'selectedSupplier', event.target.value)} /></StageField>
      <StageField label="商城确认单价（元）" required><input type="number" min="0" className={inputClass} value={item.selectedUnitPrice} onChange={(event) => update(index, 'selectedUnitPrice', event.target.value)} /></StageField>
      <StageField label="供应商联系人"><input className={inputClass} value={item.supplierContact} onChange={(event) => update(index, 'supplierContact', event.target.value)} /></StageField>
      <StageField label="联系电话"><input className={inputClass} value={item.supplierPhone} onChange={(event) => update(index, 'supplierPhone', event.target.value)} /></StageField>
      <StageField label="商品链接" className="lg:col-span-2"><input className={inputClass} value={item.productLink} onChange={(event) => update(index, 'productLink', event.target.value)} placeholder="https://" /></StageField>
      <StageField label="商城型号技术参数" className="md:col-span-2"><textarea className={textareaClass} value={item.selectedParameters} onChange={(event) => update(index, 'selectedParameters', event.target.value)} /></StageField>
      <StageField label="参与选型人员" required className="md:col-span-2"><input className={inputClass} value={item.selectionParticipants} onChange={(event) => update(index, 'selectionParticipants', event.target.value)} placeholder="多人可使用顿号分隔" /></StageField>
    </div>
  </div>;
}

function StageField({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={cn('block', className)}><span className="mb-2 block text-xs font-black text-slate-600">{required && <b className="mr-1 text-red-500">*</b>}{label}</span>{children}</label>;
}
