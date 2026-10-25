import { useMemo, useState } from 'react';
import { ArrowLeft, Calculator, CheckSquare, Search, Sparkles, Users, X, ClipboardCheck } from 'lucide-react';
import { useMaterialList, type BuyerSupplierResponse, type PurchaseDemandResponse } from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, cn } from '@24bid/ui';
import { MaterialLinePicker } from '../shared/material-line-picker';
import { currency } from '../demands/demand-format';
import { planDemandLines } from './procurement-plan-lines';

const PROCUREMENT_METHODS = ['询比', '竞价', '商城', '单一来源'];
const SUPPLIER_COLLECTION_METHODS = ['公开', '邀请'];
const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function supplierCollectionHint(method: string, collection: string) {
  if (method === '商城') return '目录采购';
  if (method === '单一来源') return '定向 1 家';
  return collection === '公开' ? '公开征集' : '邀请征集';
}

export function ProcurementPlanMergePage({
  selectedDemands,
  selectedBudget,
  selectedDepartments,
  selectedContent,
  planTitle,
  setPlanTitle,
  planDate,
  setPlanDate,
  planPlace,
  setPlanPlace,
  planMethod,
  setPlanMethod,
  collectionMethod,
  setCollectionMethod,
  planUrgency,
  setPlanUrgency,
  suppliers,
  supplierIds,
  setSupplierIds,
  toggleSupplier,
  createError,
  createErrorMessage,
  createPending,
  onBack,
  onSubmit,
  directRows,
  setDirectRows,
  directDepartmentId,
  setDirectDepartmentId,
  departments,
}: {
  selectedDemands: PurchaseDemandResponse[];
  selectedBudget: number;
  selectedDepartments: string[];
  selectedContent: string;
  planTitle: string;
  setPlanTitle: (value: string) => void;
  planDate: string;
  setPlanDate: (value: string) => void;
  planPlace: string;
  setPlanPlace: (value: string) => void;
  planMethod: string;
  setPlanMethod: (value: string) => void;
  collectionMethod: string;
  setCollectionMethod: (value: string) => void;
  planUrgency: string;
  setPlanUrgency: (value: string) => void;
  suppliers: BuyerSupplierResponse[];
  supplierIds: string[];
  setSupplierIds: (value: string[]) => void;
  toggleSupplier: (id?: string) => void;
  createError: boolean;
  createErrorMessage?: string;
  createPending: boolean;
  onBack: () => void;
  onSubmit: () => void;
  // 直录模式(采购部门直接创建,不基于既有需求;提交时系统反向登记「直录登记」需求保闭环)
  directRows?: Array<{ materialId: string; quantity: number }>;
  setDirectRows?: (rows: Array<{ materialId: string; quantity: number }>) => void;
  directDepartmentId?: string;
  setDirectDepartmentId?: (id: string) => void;
  departments?: Array<{ id?: string; name?: string }>;
}) {
  const materialsForRef = useMaterialList();
  const materialIndex = useMemo(() => {
    const map: Record<string, { referencePrice: number; category: string; name: string; unit:string; specification:string }> = {};
    (materialsForRef.data?.data ?? []).forEach((m) => {
      if (m.id) map[m.id] = { referencePrice: m.referencePrice ?? 0, category: m.category ?? '其他', name: m.name ?? m.id,unit:m.unit||'—',specification:m.specification||'—' };
    });
    return map;
  }, [materialsForRef.data]);
  // 市场参考价:所选需求行项 × 物料参考价(真实数据,替代此前"预算×0.96"的假测算)。
  const marketReference = selectedDemands.reduce(
    (sum, demand) =>
      sum +
      (demand.lineItems ?? []).reduce(
        (lineSum, line) =>
          lineSum + (materialIndex[line.materialId ?? '']?.referencePrice ?? 0) * (line.quantity ?? 0),
        0,
      ),
    0,
  );
  const budgetDeviation = marketReference > 0 ? (selectedBudget - marketReference) / marketReference : null;
  const demandCategories = Array.from(
    new Set(
      selectedDemands.flatMap((demand) =>
        (demand.lineItems ?? []).map((line) => materialIndex[line.materialId ?? '']?.category).filter(Boolean),
      ),
    ),
  ) as string[];
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [recommendNote, setRecommendNote] = useState<string | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierKeyword, setSupplierKeyword] = useState('');
  const direct = !!setDirectRows;
  const directReference = (directRows ?? []).reduce(
    (sum, row) => sum + (materialIndex[row.materialId]?.referencePrice ?? 0) * row.quantity,
    0,
  );
  const effectiveBudget = direct ? directReference : selectedBudget;
  const mergedRows = direct
    ? (directRows ?? []).map((row) => {
        const material = materialIndex[row.materialId];
        return {
          demandId: row.materialId,
          demandTitle: '直录采购内容',
          materialName: material?.name ?? row.materialId,
          spec: material?.specification ?? '—',
          quantity: row.quantity,
          unit: material?.unit||'—',
          budgetUnit: material?.referencePrice ?? 0,
          referencePrice: material?.referencePrice ?? 0,
          subtotal: (material?.referencePrice ?? 0) * row.quantity,
        };
      })
    : planDemandLines(selectedDemands,materialsForRef.data?.data||[]);
  const isSingleSource = planMethod === '单一来源';
  const isOpenSolicitation = planMethod !== '商城' && planMethod !== '单一来源' && collectionMethod === '公开';
  const supplierSelectionRequired = planMethod === '单一来源' || (planMethod !== '商城' && collectionMethod === '邀请');
  const selectedSuppliers = suppliers.filter((supplier) => supplier.supplierId && supplierIds.includes(supplier.supplierId));
  const supplierKw = supplierKeyword.trim().toLowerCase();
  const filteredSuppliers = suppliers.filter((supplier) => {
    const text = [supplier.supplierName, supplier.supplierId].filter(Boolean).join(' ').toLowerCase();
    return !supplierKw || text.includes(supplierKw);
  });
  const supplierRequirementMet = !supplierSelectionRequired || (isSingleSource ? supplierIds.length === 1 : supplierIds.length >= 3);
  const directRowsValid =
    (directRows ?? []).length > 0 && (directRows ?? []).every((row) => row.materialId && row.quantity > 0);
  const canSubmit = direct
    ? directRowsValid && !!directDepartmentId && supplierRequirementMet && !!planDate
    : selectedDemands.length > 0 && supplierRequirementMet && !!planDate;

  const handlePlanMethodChange = (value: string) => {
    setPlanMethod(value);
    setSupplierKeyword('');
    if (value === '商城') {
      setSupplierIds([]);
      setSupplierDialogOpen(false);
    } else if (value === '单一来源' && supplierIds.length > 1) {
      setSupplierIds(supplierIds.slice(0, 1));
    }
  };

  const handleCollectionMethodChange = (value: string) => {
    setCollectionMethod(value);
    if (value === '公开') {
      setSupplierIds([]);
      setSupplierDialogOpen(false);
    }
  };

  const selectSupplier = (supplierId?: string) => {
    if (!supplierId) return;
    if (isSingleSource) {
      setSupplierIds([supplierId]);
      return;
    }
    toggleSupplier(supplierId);
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
            <h1 className="text-2xl font-black text-slate-950">新建采购方案</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              {direct
                ? '直接创建(直录)· 提交时系统自动登记「直录登记」需求,保留完整业务闭环'
                : `填写方案基本信息与执行策略 · 已合并 ${selectedDemands.length} 条需求 · 涉及部门 ${selectedDepartments.join('、') || '—'}`}
              <span className="ml-2 text-xs font-bold text-slate-400">(<span className="text-red-500">*</span> 为必填项)</span>
            </p>
          </div>
        </div>
      </section>

      <MergeSection accent="blue" title="基本信息">
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr_22rem]">
          <Field label="项目名称" required>
            <input
              className={inputCls}
              value={planTitle}
              onChange={(e) => setPlanTitle(e.target.value)}
              placeholder="请输入项目名称"
            />
          </Field>
          <Field label="紧急程度" required>
            <select className={inputCls} value={planUrgency} onChange={(e) => setPlanUrgency(e.target.value)}>
              {['普通', '紧急', '特急'].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </Field>
        </div>
      </MergeSection>

      <MergeSection accent="emerald" title="申请信息">
        <div className="grid gap-6 lg:grid-cols-2">
          <Field label={direct ? '采购预算(元,按物料参考价自动测算)' : '采购预算（元）'}>
            <input className={inputCls} value={effectiveBudget} readOnly />
          </Field>
          {direct ? (
            <Field label="归口部门" required>
              <select
                className={inputCls}
                value={directDepartmentId ?? ''}
                onChange={(e) => setDirectDepartmentId?.(e.target.value)}
              >
                <option value="">请选择归口部门</option>
                {(departments ?? []).map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name ?? dept.id}</option>
                ))}
              </select>
              <p className="mt-2 text-xs font-bold text-slate-500">
                直录立项将自动登记一条「直录登记」需求并归口到该部门,便于回链与预算口径统计。
              </p>
            </Field>
          ) : (
            <Field label="项目概况介绍">
              <textarea
                className={`${inputCls} min-h-24 resize-none`}
                value={selectedContent || '由多个已审批采购需求合并生成，统一形成采购方案并进入寻源执行。'}
                readOnly
              />
            </Field>
          )}
          <Field label="采购方式与供应商征集方式">
            <div className="grid gap-3 sm:grid-cols-2">
              <select className={inputCls} value={planMethod} onChange={(e) => handlePlanMethodChange(e.target.value)}>
                {PROCUREMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {planMethod === '询比' || planMethod === '竞价' ? (
                <select className={inputCls} value={collectionMethod} onChange={(e) => handleCollectionMethodChange(e.target.value)}>
                  {SUPPLIER_COLLECTION_METHODS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-500">
                  {planMethod === '商城' ? '目录采购，不限定供应商征集' : '单一来源，定向选择 1 家供应商'}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {planMethod === '商城'
                ? '商城采购按商品目录和供应商货架执行。'
                : planMethod === '单一来源'
                  ? '单一来源属于定向采购，需要选择 1 家供应商并保留审批依据。'
                  : collectionMethod === '公开'
                    ? `${planMethod}采用公开征集，不预先限定具体供应商。`
                    : `${planMethod}采用邀请征集，需要从供应商库选择不少于 3 家供应商。`}
            </p>
            <button
              type="button"
              onClick={() => setShowSuggestion((v) => !v)}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-50 px-3 text-xs font-black text-violet-600 hover:bg-violet-100"
            >
              <Sparkles size={14} /> {showSuggestion ? '收起方案建议' : '方案建议(基于所选需求)'}
            </button>
            {showSuggestion && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-violet-100 bg-violet-50/50 p-3 text-xs font-bold text-violet-800">
                <p>
                  · 预算规模 {currency(selectedBudget)}:
                  {selectedBudget >= 500000
                    ? '金额较大,建议采用竞价引入价格竞争,或询比+多轮 BAFO。'
                    : selectedBudget < 50000 && demandCategories.length <= 1
                      ? '金额较小且品类单一,若有协议价商品可走商城直购降低流程成本。'
                      : '建议采用询比,兼顾效率与竞争。'}
                </p>
                <p>
                  · 品类分布:{demandCategories.length > 0 ? demandCategories.join('、') : '所选需求行项未关联物料品类'}
                  {demandCategories.length > 1 && ';品类跨度较大,可考虑拆分方案分别征集。'}
                </p>
                <p>
                  · 已准入供应商 {suppliers.length} 家可选
                  {planMethod !== '商城' && planMethod !== '单一来源' && suppliers.length < 3 && ';不足 3 家,邀请征集无法满足法定家数,建议公开征集或先补充准入。'}
                </p>
              </div>
            )}
            {isOpenSolicitation && (
              <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700">
                当前为公开征集，提交方案时不需要选择具体供应商，后续由符合条件的供应商参与响应。
              </div>
            )}
            {supplierSelectionRequired && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-slate-900">参与供应商</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {isSingleSource ? '单一来源需定向选择 1 家供应商，并支持条件检索。' : `${planMethod}需选择不少于 3 家供应商，并支持条件检索。`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSupplierDialogOpen(true)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-xs font-black text-blue-700 transition hover:bg-blue-50"
                  >
                    <Users size={14} />
                    选择供应商
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedSuppliers.length > 0 ? (
                    selectedSuppliers.map((supplier) => (
                      <span
                        key={supplier.supplierId}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700"
                      >
                        {supplier.supplierName ?? supplier.supplierId}
                        <button
                          type="button"
                          onClick={() => toggleSupplier(supplier.supplierId)}
                          className="text-blue-400 hover:text-blue-700"
                          aria-label="移除供应商"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-bold text-amber-600">尚未选择供应商，提交前需要完成选择。</span>
                  )}
                </div>
              </div>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="采购时间 / 报价截止" required>
              <input className={inputCls} type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
            </Field>
            <Field label="采购地点">
              <input className={inputCls} value={planPlace} onChange={(e) => setPlanPlace(e.target.value)} />
            </Field>
          </div>
        </div>
      </MergeSection>

      <MergeSection accent="violet" title="采购内容明细">
        <p className="mb-3 text-xs font-bold text-slate-500">
          {direct
            ? '直录模式:直接选择物料并填写数量;预算按物料参考价自动测算。'
            : '合并创建采购计划时，采购内容由已选采购需求自动汇总，提交前不允许再增删或替换物料。'}
        </p>
        {direct && (
          <div className="mb-4">
            <MaterialLinePicker rows={directRows ?? []} onChange={(rows) => setDirectRows?.(rows)} />
          </div>
        )}
        {!direct && (
        <div className="overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                <th className="px-4 py-3">序号</th>
                <th className="px-4 py-3">物资名称</th>
                <th className="px-4 py-3">规格型号</th>
                <th className="px-4 py-3 text-right">数量</th>
                <th className="px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">预算单价</th>
                <th className="px-4 py-3 text-right text-blue-600">市场参考价</th>
                <th className="px-4 py-3 text-right">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {mergedRows.map((row, index) => (
                <tr key={`${row.demandId}-${index}`} className="font-bold text-slate-700">
                  <td className="px-4 py-4 font-mono text-slate-400">{index + 1}</td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">{row.materialName}</p>
                    <p className="mt-1 text-xs text-slate-400">{row.demandTitle}</p>
                  </td>
                  <td className="px-4 py-4">{row.spec}</td>
                  <td className="px-4 py-4 text-right font-mono">{row.quantity}</td>
                  <td className="px-4 py-4">{row.unit}</td>
                  <td className="px-4 py-4 text-right font-mono">{row.budgetUnit==null?'待核对':currency(row.budgetUnit)}</td>
                  <td className="px-4 py-4 text-right font-mono text-slate-400">
                    {row.referencePrice!=null ? currency(row.referencePrice) : '—'}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-950">{row.subtotal==null?'待核对':currency(row.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={6} />
                <td className="px-4 py-4 text-right text-xs font-black text-slate-500">合计预算</td>
                <td className="px-4 py-4 text-right text-xl font-black text-violet-600">{currency(effectiveBudget)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        )}

        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600">
                <Calculator size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-blue-900">预算合理性核对(基于物料参考价)</p>
                <p className="mt-1 text-xs font-bold text-blue-700">
                  {direct ? (
                    <>直录预算按物料参考价自动测算:合计 {currency(directReference)};如需调整请在物料目录维护参考价。</>
                  ) : marketReference > 0 ? (
                    <>
                      方案总预算 {currency(selectedBudget)},物料参考价合计 {currency(marketReference)}
                      (偏差 {budgetDeviation != null ? `${(budgetDeviation * 100).toFixed(1)}%` : '—'})。
                      {budgetDeviation != null && Math.abs(budgetDeviation) <= 0.15 ? (
                        <span className="text-emerald-600"> 预算与参考价偏差在 15% 以内,合理。</span>
                      ) : (
                        <span className="text-red-600"> 预算与参考价偏差超过 15%,建议复核数量与单价或在方案说明中补充原因。</span>
                      )}
                    </>
                  ) : (
                    <>方案总预算 {currency(selectedBudget)};所选需求行项暂无物料参考价,无法核对,请在物料目录维护参考价。</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {createError && (
          <div className="mt-4">
            <FeedbackNotice tone="error" message={createErrorMessage ?? '采购计划创建失败,请稍后重试。'} />
          </div>
        )}
      </MergeSection>

      {/* 底部提交操作条:左侧汇总与阻塞原因,右侧动作按钮。 */}
      <section className="sticky bottom-4 rounded-lg border border-slate-200 bg-white/95 px-6 py-4 shadow-lg shadow-slate-300/40 backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
            <p className="text-sm font-bold text-slate-500">
              {direct ? `直录明细 ${(directRows ?? []).length} 行` : `已合并 ${selectedDemands.length} 条需求`}
              <span className="mx-2 text-slate-200">|</span>
              合计预算 <span className="font-mono text-lg font-black text-violet-600">{currency(effectiveBudget)}</span>
              <span className="mx-2 text-slate-200">|</span>
              {planMethod} · {supplierCollectionHint(planMethod, collectionMethod)}
            </p>
            {!canSubmit && (
              <p className="text-xs font-black text-amber-600">
                {!planDate
                  ? '请先填写「采购时间 / 报价截止」'
                  : direct && !directRowsValid
                    ? '请完善直录明细(物料与数量)'
                    : direct && !directDepartmentId
                      ? '请选择归口部门'
                      : !supplierRequirementMet
                        ? isSingleSource
                          ? '单一来源需定向选择 1 家供应商'
                          : '邀请征集需选择不少于 3 家供应商'
                        : '请先在上一步勾选要合并的需求'}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-6 text-sm font-black text-slate-600 transition hover:bg-slate-50 active:scale-[0.98]"
            >
              返回选择
            </button>
            <PrimaryActionButton
              onClick={onSubmit}
              busy={createPending}
              pendingLabel="生成中"
              disabled={!canSubmit}
              icon={ClipboardCheck}
              size="md"
              flushTop
            >
              生成采购计划
            </PrimaryActionButton>
          </div>
        </div>
      </section>

      {supplierDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6">
          <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-black text-slate-950">
                  选择参与供应商
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {isSingleSource ? '单选供应商;可按品类匹配与绩效评分推荐候选。' : '多选供应商,至少 3 家;可按品类匹配与绩效评分推荐候选。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSupplierDialogOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                aria-label="关闭"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={supplierKeyword}
                    onChange={(e) => setSupplierKeyword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    placeholder="按供应商名称 / 编号搜索"
                    autoFocus
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    // 推荐规则(真实数据):品类匹配优先,其次绩效评分;单一来源取 1 家,其余取前 3。
                    const ranked = [...suppliers].sort((a, b) => {
                      const matchA = (a.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
                      const matchB = (b.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
                      if (matchA !== matchB) return matchB - matchA;
                      return (b.performanceScore ?? 0) - (a.performanceScore ?? 0);
                    });
                    const picked = ranked.slice(0, isSingleSource ? 1 : 3);
                    setSupplierIds(picked.map((sup) => sup.supplierId!).filter(Boolean));
                    setRecommendNote(
                      picked.length === 0
                        ? '暂无已准入供应商可推荐。'
                        : `已按品类匹配与绩效评分选中:${picked
                            .map((sup) => {
                              const matched = (sup.categories ?? []).filter((c) => demandCategories.includes(c));
                              return `${sup.supplierName}(评分 ${sup.performanceScore ?? '—'}${matched.length ? ` · 品类 ${matched.join('/')}` : ''})`;
                            })
                            .join('、')}`,
                    );
                  }}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-4 text-xs font-black text-violet-700 hover:bg-violet-100"
                >
                  <Sparkles size={14} />
                  按评分推荐
                </button>
              </div>
              {recommendNote && (
                <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs font-bold text-violet-700">
                  {recommendNote}
                </div>
              )}
              <div className="max-h-[360px] overflow-y-auto rounded-lg border border-slate-100">
                {filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((supplier) => {
                    const id = supplier.supplierId;
                    const checked = !!id && supplierIds.includes(id);
                    return (
                      <button
                        key={supplier.id ?? id}
                        type="button"
                        onClick={() => selectSupplier(id)}
                        className={cn(
                          'flex w-full items-center justify-between border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50',
                          checked && 'bg-blue-50/60',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              'flex h-5 w-5 shrink-0 items-center justify-center border',
                              isSingleSource ? 'rounded-full' : 'rounded-md',
                              checked ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white',
                            )}
                          >
                            {checked && <CheckSquare size={13} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-slate-900">
                              {supplier.supplierName ?? supplier.supplierId}
                            </span>
                            <span className="mt-1 block text-xs font-bold text-slate-400">{supplier.supplierId ?? '—'}</span>
                          </span>
                        </div>
                        <span className="ml-4 shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">
                          已准入
                        </span>
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-10 text-center text-sm font-bold text-slate-400">没有匹配的供应商</div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <p className="text-xs font-bold text-slate-500">
                已选择 {supplierIds.length} 家，{isSingleSource ? '单一来源仅需 1 家。' : '询比/竞价至少需要 3 家。'}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSupplierDialogOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierDialogOpen(false)}
                  className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-5 text-sm font-black text-white hover:bg-slate-800"
                >
                  确认选择
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MergeSection({
  accent,
  title,
  action,
  children,
}: {
  accent: 'blue' | 'emerald' | 'violet';
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const accentCls = {
    blue: 'before:bg-blue-600',
    emerald: 'before:bg-emerald-500',
    violet: 'before:bg-violet-500',
  }[accent];

  return (
    <section
      className={cn(
        'relative rounded-lg border border-slate-200 bg-white p-6 shadow-sm before:absolute before:left-0 before:top-9 before:h-6 before:w-1 before:rounded-r-full',
        accentCls,
      )}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black text-slate-500">
        {required && <span className="mr-1 text-red-500">*</span>}
        {label}
      </span>
      {children}
    </label>
  );
}
