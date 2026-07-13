import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Megaphone, Search, Send, Sparkles, Users, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type BuyerSupplierResponse,
  type PurchaseDemandResponse,
  type RfqResponse,
  useDepartmentList,
  useMaterialList,
  useRfqCreate,
  useRfqPublish,
  useRfqUpdateInvitations,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, cn } from '@24bid/ui';
import { MaterialLinePicker } from '../shared/material-line-picker';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const WIZARD_STEPS = [
  { id: 1, label: '建项需求', icon: ClipboardList },
  { id: 2, label: '选择供应商', icon: Users },
  { id: 3, label: '发布询价单', icon: Megaphone },
] as const;

const METHODS = ['询比', '竞价', '商城', '单一来源'];

// 询比立项三步向导:建项(草稿)→ 选商(草稿改邀请)→ 发布(草稿→报价中,下发询价函)。
export function RfqCreateWizard({
  demands,
  suppliers,
  resumeDraft,
  initialMethod,
  onDone,
  onCancel,
}: {
  demands: PurchaseDemandResponse[];
  suppliers: BuyerSupplierResponse[];
  resumeDraft?: RfqResponse;
  /** 预设采购方式(如竞价采购模块发起立项时锁定「竞价」)。 */
  initialMethod?: string;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const create = useRfqCreate();
  const updateInvitations = useRfqUpdateInvitations();
  const publish = useRfqPublish();
  const materials = useMaterialList();
  const departmentsQuery = useDepartmentList();
  const departments = departmentsQuery.data?.data ?? [];

  const queryClient = useQueryClient();
  const [step, setStep] = useState(resumeDraft ? ((resumeDraft.invitedSupplierIds ?? []).length > 0 ? 3 : 2) : 1);
  const [draftId, setDraftId] = useState<string | null>(resumeDraft?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(resumeDraft?.title ?? '');
  const [demandId, setDemandId] = useState(resumeDraft?.demandIds?.[0] ?? '');
  // 直录模式:不基于既有需求,直接录入采购内容(系统反登「直录登记」需求保闭环)。
  const [directRows, setDirectRows] = useState<Array<{ materialId: string; quantity: number }>>([]);
  const [directDepartmentId, setDirectDepartmentId] = useState('');
  const [method, setMethod] = useState(resumeDraft?.method ?? initialMethod ?? '询比');
  const [deadline, setDeadline] = useState(resumeDraft?.deadlineAt?.slice(0, 10) ?? '');
  const [evaluationMethod, setEvaluationMethod] = useState(resumeDraft?.evaluationMethod ?? '最低价');
  const [quoteRequirement, setQuoteRequirement] = useState(resumeDraft?.quoteRequirement ?? '');
  const [deliveryRequirement, setDeliveryRequirement] = useState(resumeDraft?.deliveryRequirement ?? '');
  const [auctionStartPrice, setAuctionStartPrice] = useState(
    resumeDraft?.auctionStartPrice != null ? String(resumeDraft.auctionStartPrice) : '',
  );
  const [auctionMinDecrement, setAuctionMinDecrement] = useState(
    resumeDraft?.auctionMinDecrement != null ? String(resumeDraft.auctionMinDecrement) : '',
  );
  // 竞价规则配置(V176):计划开始+时长(替代日期截止)、保留价、软关闭参数、可见性开关。
  const [auctionPlannedStart, setAuctionPlannedStart] = useState(
    resumeDraft?.auctionPlannedStart?.slice(0, 16) ?? '',
  );
  const [auctionDurationMinutes, setAuctionDurationMinutes] = useState('30');
  const [auctionReservePrice, setAuctionReservePrice] = useState(
    resumeDraft?.auctionReservePrice != null ? String(resumeDraft.auctionReservePrice) : '',
  );
  const [softCloseEnabled, setSoftCloseEnabled] = useState(true);
  const [softCloseTrigger, setSoftCloseTrigger] = useState('5');
  const [softCloseExtend, setSoftCloseExtend] = useState('5');
  const [showRank, setShowRank] = useState(true);
  const [showLowest, setShowLowest] = useState(true);
  const [showCompetitorNames, setShowCompetitorNames] = useState(false);
  const [singleSourceReason, setSingleSourceReason] = useState(resumeDraft?.singleSourceReason ?? '');

  const [supplierIds, setSupplierIds] = useState<string[]>(resumeDraft?.invitedSupplierIds ?? []);
  const [supplierKeyword, setSupplierKeyword] = useState('');
  const [recommendNote, setRecommendNote] = useState<string | null>(null);

  const selectedDemand = demands.find((d) => d.id === demandId);
  const materialIndex = useMemo(() => {
    const map: Record<string, { name: string; unit: string; specification: string; category: string; referencePrice: number; code: string }> = {};
    (materials.data?.data ?? []).forEach((m) => {
      if (m.id) {
        map[m.id] = {
          name: m.name ?? m.id,
          unit: m.unit ?? '件',
          specification: m.specification ?? '',
          category: m.category ?? '其他',
          referencePrice: m.referencePrice ?? 0,
          code: m.code ?? m.id,
        };
      }
    });
    return map;
  }, [materials.data]);
  const demandCategories = useMemo(
    () =>
      Array.from(
        new Set(
          (selectedDemand?.lineItems ?? [])
            .map((line) => materialIndex[line.materialId ?? '']?.category)
            .filter(Boolean),
        ),
      ) as string[],
    [selectedDemand, materialIndex],
  );

  const isSingleSource = method === '单一来源';
  const isDirect = demandId === '__direct__';
  const directBudget = directRows.reduce(
    (sum, row) => sum + (materialIndex[row.materialId]?.referencePrice ?? 0) * row.quantity,
    0,
  );
  const directValid =
    directRows.length > 0 && directRows.every((row) => row.materialId && row.quantity > 0) && !!directDepartmentId;
  const step1Valid =
    !!title &&
    (isDirect ? directValid : !!demandId) &&
    (method === '竞价' ? !!auctionPlannedStart && Number(auctionDurationMinutes) > 0 : !!deadline) &&
    (method !== '竞价' || Number(auctionStartPrice) > 0) &&
    (!isSingleSource || singleSourceReason.trim().length > 0);
  // 邀请供应商为可选项:竞争性方式不设前端硬门槛(不足 3 家由后端做提醒与审计留痕);
  // 单一来源仍须定向 1 家(结构性规则)。
  const supplierFloorMet = isSingleSource ? supplierIds.length === 1 : true;

  const reportError = (e: unknown) => {
    const raw =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '操作失败,请稍后重试';
    // 已知后端守卫的英文消息翻译成可执行的中文指引。
    if (raw.includes('already linked to an RFQ')) {
      void queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/demands'),
      });
    }
    const translated = raw.includes('already linked to an RFQ')
      ? '所选需求已被其他询价/竞价项目占用,请返回重新选择需求(列表已按最新状态刷新)。'
      : raw.includes('not approved for tenant RFQ')
        ? '所选供应商尚未完成准入,仅「已准入」供应商可受邀参与。'
        : raw;
    setError(translated);
  };

  const saveDraft = () => {
    setError(null);
    create.mutate(
      {
        data: {
          title,
          demandIds: isDirect || !demandId ? [] : [demandId],
          ...(isDirect
            ? {
                directItems: directRows.filter((row) => row.materialId && row.quantity > 0),
                directDepartmentId,
                directBudget,
              }
            : {}),
          invitedSupplierIds: [],
          deadlineAt:
            method === '竞价'
              ? new Date(new Date(auctionPlannedStart).getTime() + Number(auctionDurationMinutes) * 60_000).toISOString()
              : `${deadline}T18:00:00+08:00`,
          evaluationMethod: method === '竞价' ? '最低价' : evaluationMethod,
          method,
          auctionStartPrice: method === '竞价' ? Number(auctionStartPrice) : undefined,
          auctionMinDecrement:
            method === '竞价' && auctionMinDecrement ? Number(auctionMinDecrement) : undefined,
          ...(method === '竞价'
            ? {
                auctionPlannedStart: new Date(auctionPlannedStart).toISOString(),
                auctionReservePrice: auctionReservePrice ? Number(auctionReservePrice) : undefined,
                auctionSoftCloseTriggerMinutes: softCloseEnabled ? Number(softCloseTrigger) || 5 : 0,
                auctionSoftCloseExtendMinutes: softCloseEnabled ? Number(softCloseExtend) || 5 : 0,
                auctionShowRank: showRank,
                auctionShowLowest: showLowest,
                auctionShowCompetitorNames: showCompetitorNames,
              }
            : {}),
          singleSourceReason: isSingleSource ? singleSourceReason.trim() : undefined,
          quoteRequirement: quoteRequirement || undefined,
          deliveryRequirement: deliveryRequirement || undefined,
          saveAsDraft: true,
        },
      },
      {
        onSuccess: (res) => {
          setDraftId(res.data?.id ?? null);
          setStep(2);
        },
        onError: reportError,
      },
    );
  };

  const saveInvitations = () => {
    if (!draftId) return;
    setError(null);
    updateInvitations.mutate(
      { rfqId: draftId, data: { supplierIds } },
      { onSuccess: () => setStep(3), onError: reportError },
    );
  };

  const submitPublish = () => {
    if (!draftId) return;
    setError(null);
    publish.mutate(
      { rfqId: draftId },
      {
        onSuccess: () =>
          onDone(`询价单已正式发布,已向 ${supplierIds.length || '公开征集的'} 家受邀供应商下发询价函。`),
        onError: reportError,
      },
    );
  };

  const recommendSuppliers = () => {
    const ranked = [...suppliers].sort((a, b) => {
      const matchA = (a.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
      const matchB = (b.categories ?? []).some((c) => demandCategories.includes(c)) ? 1 : 0;
      if (matchA !== matchB) return matchB - matchA;
      return (b.performanceScore ?? 0) - (a.performanceScore ?? 0);
    });
    const picked = ranked.slice(0, isSingleSource ? 1 : 3);
    setSupplierIds(picked.map((s) => s.supplierId!).filter(Boolean));
    setRecommendNote(
      picked.length === 0
        ? '暂无已准入供应商可推荐。'
        : `按品类匹配与绩效评分选中:${picked
            .map((s) => {
              const matched = (s.categories ?? []).filter((c) => demandCategories.includes(c));
              return `${s.supplierName}(评分 ${s.performanceScore ?? '—'}${matched.length ? ` · ${matched.join('/')}` : ''})`;
            })
            .join('、')}`,
    );
  };

  const visibleSuppliers = suppliers.filter(
    (s) =>
      !supplierKeyword ||
      [s.supplierName, s.supplierId].filter(Boolean).join(' ').toLowerCase().includes(supplierKeyword.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
        <div className="grid grid-cols-3 items-start gap-2">
          {WIZARD_STEPS.map((wizardStep, index) => {
            const done = index + 1 < step;
            const current = index + 1 === step;
            const Icon = wizardStep.icon;
            return (
              <div key={wizardStep.id} className="relative text-center">
                {index < WIZARD_STEPS.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
                <span
                  className={cn(
                    'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                    done ? 'border-emerald-100 bg-emerald-500 text-white' : current ? 'border-blue-100 bg-blue-600 text-white' : 'border-slate-200 text-slate-300',
                  )}
                >
                  {done ? <CheckCircle2 size={17} /> : <Icon size={16} />}
                </span>
                <p className={cn('mt-2 text-xs font-black', done || current ? 'text-blue-700' : 'text-slate-500')}>{wizardStep.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}

      {step === 1 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
          <p className="text-sm font-black text-slate-950">基本信息</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>项目名称</label>
              <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:2026年度行政车辆维保服务询价" />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>关联需求(已通过)</label>
              <select
                className={inputCls}
                value={demandId}
                onChange={(e) => {
                  setDemandId(e.target.value);
                  if (e.target.value === '__direct__' && directRows.length === 0) {
                    setDirectRows([{ materialId: '', quantity: 1 }]);
                  }
                }}
              >
                <option value="">选择需求</option>
                <option value="__direct__">不基于需求 · 直接录入(直录登记)</option>
                {demands.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}(预算 {currency(d.budget)})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>采购方式</label>
              <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>评选方式</label>
              {method === '竞价' ? (
                <>
                  <select className={inputCls} value="最低价" disabled>
                    <option value="最低价">最低价</option>
                  </select>
                  <p className="mt-1 text-[11px] font-bold text-slate-400">竞价方式按出价直接竞争,评选固定为最低价。</p>
                </>
              ) : (
                <select className={inputCls} value={evaluationMethod} onChange={(e) => setEvaluationMethod(e.target.value)}>
                  <option value="最低价">最低价</option>
                  <option value="综合评分">综合评分</option>
                </select>
              )}
            </div>
          </div>

          {isDirect && (
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/40 p-4">
              <p className="text-sm font-black text-amber-900">直录采购内容(系统将自动登记「直录登记」需求)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>归口部门</label>
                  <select
                    className={inputCls}
                    value={directDepartmentId}
                    onChange={(e) => setDirectDepartmentId(e.target.value)}
                  >
                    <option value="">请选择归口部门</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name ?? dept.id}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
                  预算按物料参考价自动测算:<span className="font-mono font-black text-slate-900">{currency(directBudget)}</span>
                </div>
              </div>
              <div className="mt-3">
                <MaterialLinePicker rows={directRows} onChange={setDirectRows} />
              </div>
            </div>
          )}

          {selectedDemand && (
            <div className="mt-4">
              <p className="text-sm font-black text-slate-950">物资明细(来自关联需求)</p>
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="bg-slate-50 font-black text-slate-500">
                    <tr>
                      <th className="px-3 py-2">序号</th>
                      <th className="px-3 py-2">物资名称</th>
                      <th className="px-3 py-2">规格型号</th>
                      <th className="px-3 py-2 text-right">数量</th>
                      <th className="px-3 py-2">单位</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {(selectedDemand.lineItems ?? []).map((line, index) => {
                      const material = materialIndex[line.materialId ?? ''];
                      return (
                        <tr key={line.id ?? index}>
                          <td className="px-3 py-2 font-mono text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2">{material?.name ?? line.materialId}</td>
                          <td className="px-3 py-2">{material?.specification || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono">{line.quantity}</td>
                          <td className="px-3 py-2">{material?.unit ?? '—'}</td>
                        </tr>
                      );
                    })}
                    {(selectedDemand.lineItems ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-3 text-slate-400">该需求未维护行项明细。</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm font-black text-slate-950">截止时间与商务要求</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {method !== '竞价' && (
                <div>
                  <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>报价截止</label>
                  <input className={inputCls} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </div>
              )}
              <div>
                <label className="text-xs font-black text-slate-500">商务特殊条款(选填)</label>
                <textarea
                  className={cn(inputCls, 'min-h-[42px] resize-y')}
                  placeholder="如:账期不少于60天,需要提供原厂质保函等"
                  value={quoteRequirement}
                  onChange={(e) => setQuoteRequirement(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-black text-slate-500">交付要求(选填)</label>
              <textarea
                className={cn(inputCls, 'min-h-[42px] resize-y')}
                placeholder="到货地址、到货时限、质保与验收方式。"
                value={deliveryRequirement}
                onChange={(e) => setDeliveryRequirement(e.target.value)}
              />
            </div>
          </div>

          {method === '竞价' && (
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/30 p-4">
              <p className="text-sm font-black text-blue-900">竞价规则配置</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-2">
                {/* 时间安排 */}
                <div className="rounded-lg border border-slate-100 bg-white p-3.5">
                  <p className="text-xs font-black text-slate-600">时间安排</p>
                  <label className="mt-2.5 block">
                    <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>计划开始时间</span>
                    <input className={cn(inputCls, 'mt-1')} type="datetime-local" value={auctionPlannedStart} onChange={(e) => setAuctionPlannedStart(e.target.value)} />
                  </label>
                  <label className="mt-2.5 block">
                    <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>竞价时长(分钟)</span>
                    <input className={cn(inputCls, 'mt-1')} type="number" min="1" value={auctionDurationMinutes} onChange={(e) => setAuctionDurationMinutes(e.target.value)} />
                    <span className="mt-1 block text-[11px] font-bold text-slate-400">截止时间 = 计划开始 + 时长,自动计算。</span>
                  </label>
                </div>
                {/* 价格规则 */}
                <div className="rounded-lg border border-slate-100 bg-white p-3.5">
                  <p className="text-xs font-black text-slate-600">价格规则</p>
                  <label className="mt-2.5 block">
                    <span className="text-[11px] font-black text-slate-500"><span className="mr-1 text-red-500">*</span>起拍价(最高限价,元)</span>
                    <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={auctionStartPrice} onChange={(e) => setAuctionStartPrice(e.target.value)} />
                  </label>
                  <label className="mt-2.5 block">
                    <span className="text-[11px] font-black text-slate-500">保留价(底价 · 仅内部可见,选填)</span>
                    <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={auctionReservePrice} onChange={(e) => setAuctionReservePrice(e.target.value)} />
                  </label>
                  <label className="mt-2.5 block">
                    <span className="text-[11px] font-black text-slate-500">最小降价幅度(步长,元,选填)</span>
                    <input className={cn(inputCls, 'mt-1')} type="number" min="0" value={auctionMinDecrement} onChange={(e) => setAuctionMinDecrement(e.target.value)} />
                  </label>
                </div>
                {/* 延时机制 */}
                <div className="rounded-lg border border-slate-100 bg-white p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-600">延时机制(防狙击)</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={softCloseEnabled}
                      onClick={() => setSoftCloseEnabled((v) => !v)}
                      className={cn('relative h-6 w-11 rounded-full transition', softCloseEnabled ? 'bg-blue-600' : 'bg-slate-300')}
                    >
                      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all', softCloseEnabled ? 'left-[22px]' : 'left-0.5')} />
                    </button>
                  </div>
                  {softCloseEnabled ? (
                    <div className="mt-2.5 grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[11px] font-black text-slate-500">触发时间(最后N分钟)</span>
                        <input className={cn(inputCls, 'mt-1')} type="number" min="1" value={softCloseTrigger} onChange={(e) => setSoftCloseTrigger(e.target.value)} />
                      </label>
                      <label className="block">
                        <span className="text-[11px] font-black text-slate-500">延长周期(分钟)</span>
                        <input className={cn(inputCls, 'mt-1')} type="number" min="1" value={softCloseExtend} onChange={(e) => setSoftCloseExtend(e.target.value)} />
                      </label>
                    </div>
                  ) : (
                    <p className="mt-2.5 text-[11px] font-bold text-slate-400">已关闭:临近截止的出价不再自动顺延。</p>
                  )}
                </div>
                {/* 供应商可见性 */}
                <div className="rounded-lg border border-slate-100 bg-white p-3.5">
                  <p className="text-xs font-black text-slate-600">供应商可见性</p>
                  <div className="mt-2.5 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" checked={showRank} onChange={(e) => setShowRank(e.target.checked)} />
                      显示当前排名
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" checked={showLowest} onChange={(e) => setShowLowest(e.target.checked)} />
                      显示当前最低价
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-blue-600" checked={showCompetitorNames} onChange={(e) => setShowCompetitorNames(e.target.checked)} />
                      显示竞争对手名称(通常不勾选)
                    </label>
                    <p className="text-[11px] font-bold text-slate-400">当前版本供应商界面不披露对手名称,该开关先行留存配置。</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isSingleSource && (
            <div className="mt-3">
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>来源说明(审批留痕)</label>
              <textarea
                className={cn(inputCls, 'min-h-[56px] resize-y')}
                placeholder="说明定向选择该供应商的依据。"
                value={singleSourceReason}
                onChange={(e) => setSingleSourceReason(e.target.value)}
              />
            </div>
          )}

          <div className="mt-5 flex justify-between">
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50">
              取消
            </button>
            <PrimaryActionButton onClick={saveDraft} busy={create.isPending} pendingLabel="保存中" disabled={!step1Valid}>
              保存并下一步 →
            </PrimaryActionButton>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black text-slate-950">选择目标受邀方</p>
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-700 outline-none focus:border-blue-300"
                  placeholder="搜索供应商库…"
                  value={supplierKeyword}
                  onChange={(e) => setSupplierKeyword(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={recommendSuppliers}
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50 px-3 text-xs font-black text-violet-700 hover:bg-violet-100"
            >
              <Sparkles size={14} /> 按品类匹配与评分推荐
            </button>
            {recommendNote && (
              <p className="mt-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-xs font-bold text-violet-700">{recommendNote}</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {visibleSuppliers.map((s) => {
                const id = s.supplierId ?? '';
                const checked = supplierIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setSupplierIds((cur) =>
                        isSingleSource
                          ? checked ? [] : [id]
                          : checked ? cur.filter((x) => x !== id) : [...cur, id],
                      )
                    }
                    className={cn(
                      'rounded-lg border p-3 text-left transition',
                      checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <p className="text-sm font-black text-slate-950">{s.supplierName}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      {(s.categories ?? []).join(' / ') || '未维护品类'} · 评分 {s.performanceScore ?? '—'} · {s.level ?? '—'} 级
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg bg-slate-900 p-5 text-white shadow-sm">
              <p className="text-sm font-black">已选中受邀方({supplierIds.length})</p>
              <div className="mt-3 space-y-2">
                {supplierIds.map((id) => {
                  const s = suppliers.find((x) => x.supplierId === id);
                  return (
                    <div key={id} className="flex items-center justify-between rounded-lg bg-white/10 px-3 py-2 text-xs font-bold">
                      <span className="break-all">{s?.supplierName ?? id}</span>
                      <button type="button" onClick={() => setSupplierIds((cur) => cur.filter((x) => x !== id))} className="ml-2 text-slate-300 hover:text-white">
                        <X size={13} />
                      </button>
                    </div>
                  );
                })}
                {supplierIds.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-400">
                    {isSingleSource ? '单一来源须定向选择 1 家供应商。' : '邀请供应商为可选项:不选即公开征集;建议邀请至少 3 家以保证充分竞争,不足 3 家系统将提醒并留痕。'}
                  </p>
                )}
              </div>
            </div>
            <PrimaryActionButton onClick={saveInvitations} busy={updateInvitations.isPending} pendingLabel="保存中" disabled={!supplierFloorMet}>
              确认并下一步 →
            </PrimaryActionButton>
            <button type="button" onClick={() => setStep(1)} className="w-full text-center text-xs font-black text-slate-500 hover:text-slate-800">
              返回修改
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm shadow-slate-200/50">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white"><Send size={20} /></span>
          <p className="mt-3 text-lg font-black text-slate-950">询价函发布预览</p>
          <p className="mt-1 text-xs font-bold text-slate-500">确认后,询价单将正式发布并同步给受邀供应商</p>
          <div className="mt-5 divide-y divide-slate-100 rounded-lg bg-slate-50 px-4 text-left text-sm">
            <div className="flex justify-between py-3"><span className="font-black text-slate-500">项目名称</span><span className="font-black text-slate-950">{title}</span></div>
            <div className="flex justify-between py-3"><span className="font-black text-slate-500">采购方式</span><span className="font-black text-slate-950">{method}</span></div>
            <div className="flex justify-between py-3"><span className="font-black text-slate-500">截止日期</span><span className="font-black text-slate-950">{deadline}</span></div>
            <div className="flex justify-between py-3"><span className="font-black text-slate-500">受邀规模</span><span className="font-black text-slate-950">{supplierIds.length > 0 ? `${supplierIds.length} 家供应商` : '公开征集'}</span></div>
            <div className="py-3">
              <p className="font-black text-slate-500">物资摘要</p>
              <p className="mt-1 font-bold text-slate-700">
                {(selectedDemand?.lineItems ?? [])
                  .map((line) => {
                    const material = materialIndex[line.materialId ?? ''];
                    return `${material?.name ?? line.materialId} × ${line.quantity}${material?.unit ?? ''}`;
                  })
                  .join(';') || selectedDemand?.title || '—'}
              </p>
            </div>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button type="button" onClick={() => setStep(2)} className="inline-flex h-11 items-center rounded-lg border border-slate-200 bg-white px-6 text-sm font-black text-slate-600 hover:bg-slate-50">
              返回重选
            </button>
            <PrimaryActionButton onClick={submitPublish} busy={publish.isPending} pendingLabel="发布中">
              确认正式发布 ⚡
            </PrimaryActionButton>
          </div>
        </div>
      )}
    </div>
  );
}
