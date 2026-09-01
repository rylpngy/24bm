import { useMemo, useState } from 'react';
import { type DepartmentResponse, useDepartmentList } from '@24bid/api-client';
import { ActionButton, FeedbackNotice, PageHeader, PrimaryActionButton, SectionCard, cn } from '@24bid/ui';
import { ClipboardList, GitBranch, ListChecks, Plus, RotateCcw, Save, Trash2, WalletCards } from 'lucide-react';
import { defaultFormData, emptyItem, type LudongApplication, type LudongItem } from './api';

export interface LudongFormPayload {
  projectName: string;
  applicantUnit: string;
  departmentId?: string;
  budgetAmount: number;
  formData: Record<string, string>;
  items: LudongItem[];
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const textareaClass = 'min-h-24 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-6 text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';
const fundingSources = ['年度教学经费', '学科建设经费', '科研项目经费', '实验室建设经费', '信息化建设经费', '专项经费', '其他经费'];
type RouteKey = 'sameFundingUnit' | 'requiresItReview' | 'requiresAssetReview' | 'requiresLabReview';
type RouteValue = '是' | '否';
type RouteDecision = { key: RouteKey; label: string; value: RouteValue; rule: string; evidence: string[] };

export function LudongPocForm({
  initial,
  busy,
  error,
  onBack,
  onSave,
}: {
  initial?: LudongApplication;
  busy: boolean;
  error?: string;
  onBack: () => void;
  onSave: (payload: LudongFormPayload) => void;
}) {
  const departmentsQuery = useDepartmentList();
  const [projectName, setProjectName] = useState(initial?.projectName ?? '');
  const [applicantUnit, setApplicantUnit] = useState(initial?.applicantUnit ?? '');
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [budgetAmount, setBudgetAmount] = useState(String(initial?.budgetAmount ?? ''));
  const [showValidation, setShowValidation] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const data = { ...defaultFormData, ...initial?.formData };
    if (!data.fundingUnitId && initial?.departmentId) {
      data.fundingUnitId = data.sameFundingUnit === '否' ? 'dept-ldu-finance' : initial.departmentId;
      data.fundingUnitName = data.sameFundingUnit === '否' ? '财经处' : initial.applicantUnit;
    }
    return data;
  });
  const [items, setItems] = useState<LudongItem[]>(() => (initial?.items ?? []).map((item) => ({ ...emptyItem(), ...item })));
  const update = (key: string, value: string) => setFormData((current) => ({ ...current, [key]: value }));
  const updateItem = (index: number, key: keyof LudongItem, value: string) => setItems((current) => current.map((item, rowIndex) => {
    if (rowIndex !== index) return item;
    const next = { ...item, [key]: value };
    if (key === 'quantity' || key === 'unitPrice') {
      next.totalPrice = String(Number(next.quantity || 0) * Number(next.unitPrice || 0) || '');
    }
    return next;
  }));
  const departmentGroups = useMemo(() => buildDepartmentGroups(departmentsQuery.data?.data ?? []), [departmentsQuery.data?.data]);

  const selectApplicantUnit = (nextDepartmentId: string) => {
    const department = (departmentsQuery.data?.data ?? []).find((item) => item.id === nextDepartmentId);
    setDepartmentId(nextDepartmentId);
    setApplicantUnit(department?.name ?? '');
    setFormData((current) => ({
      ...current,
      applicantUnitType: department?.parentId === 'dept-ldu-org-academic' ? '学院' : '其他单位',
      ...(!current.fundingUnitId ? { fundingUnitId: nextDepartmentId, fundingUnitName: department?.name ?? '' } : {}),
    }));
  };

  const selectFundingUnit = (nextDepartmentId: string) => {
    const department = (departmentsQuery.data?.data ?? []).find((item) => item.id === nextDepartmentId);
    setFormData((current) => ({ ...current, fundingUnitId: nextDepartmentId, fundingUnitName: department?.name ?? '' }));
  };

  const automaticDecisions = useMemo(() => evaluateRouteDecisions({
    applicantUnit,
    departmentId,
    fundingUnitId: formData.fundingUnitId,
    fundingUnitName: formData.fundingUnitName,
    projectName,
    items,
  }), [applicantUnit, departmentId, formData.fundingUnitId, formData.fundingUnitName, items, projectName]);

  const decisionValue = (decision: RouteDecision): RouteValue => (
    formData[`${decision.key}Mode`] === 'manual'
      ? (formData[decision.key] === '是' ? '是' : '否')
      : decision.value
  );

  const schoolLeaderRule = useMemo(() => {
    const threshold = formData.applicantUnitType === '学院' ? 300000 : 100000;
    return Number(budgetAmount || 0) > threshold
      ? `需要分管校领导审批（${formData.applicantUnitType}项目超过 ¥${threshold.toLocaleString('zh-CN')}）`
      : `未达到分管校领导审批金额条件（当前阈值 ¥${threshold.toLocaleString('zh-CN')}）`;
  }, [budgetAmount, formData.applicantUnitType]);

  const missingRequired = getMissingRequiredFields({
    projectName, applicantUnit, departmentId, budgetAmount, formData, items,
  });
  const valid = missingRequired.length === 0;

  const save = () => {
    if (!valid) {
      setShowValidation(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setShowValidation(false);
    const routeSnapshot = Object.fromEntries(automaticDecisions.flatMap((decision) => [
      [decision.key, decisionValue(decision)],
      [`${decision.key}Mode`, formData[`${decision.key}Mode`] === 'manual' ? 'manual' : 'auto'],
      [`${decision.key}SystemValue`, decision.value],
      [`${decision.key}Reason`, decision.evidence.join('；')],
    ]));
    onSave({
      projectName,
      applicantUnit,
      departmentId,
      budgetAmount: Number(budgetAmount || 0),
      formData: { ...formData, ...routeSnapshot },
      items,
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={initial ? '编辑采购项目申报' : '新建采购项目申报'}
        subtitle="本页只填写原始申报信息。购置论证、部门意见、审批签字和采购方式将在后续流程节点逐步完成。"
        onBack={onBack}
        meta={<span className="rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{initial?.applicationNo ?? '保存后生成申报编号'}</span>}
      />
      {error && <FeedbackNotice tone="error" message={error} />}
      <div className={cn(
        'flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-bold',
        showValidation && !valid ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-100 bg-blue-50/70 text-blue-700',
      )}>
        <p><b className="mr-1 text-red-500">*</b>为必填项。填写完成后系统将同时生成采购需求表和采购申请单。</p>
        <span className={cn('rounded-md px-2.5 py-1 font-black', valid ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-amber-700')}>
          {valid ? '必填项已完成' : `待完成 ${missingRequired.length} 项`}
        </span>
      </div>
      {showValidation && !valid && (
        <FeedbackNotice tone="error" message={`请先完成以下必填项：${missingRequired.join('、')}`} />
      )}

      <SectionCard title="项目申报信息" icon={ClipboardList}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="采购项目名称" required><input className={inputClass} value={projectName} onChange={(e) => setProjectName(e.target.value)} /></Field>
          <Field label="申报单位" required>
            <select className={inputClass} value={departmentId} onChange={(e) => selectApplicantUnit(e.target.value)} disabled={departmentsQuery.isLoading}>
              <option value="">{departmentsQuery.isLoading ? '正在加载学校组织机构…' : '请选择申报单位'}</option>
              {departmentGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="申报单位类型"><input className={cn(inputClass, 'bg-slate-50 text-slate-500')} readOnly value={departmentId ? formData.applicantUnitType : ''} placeholder="选择申报单位后自动识别" /></Field>
          <Field label="组织归属"><input className={cn(inputClass, 'bg-slate-50 text-slate-500')} readOnly value={departmentGroups.find((group) => group.departments.some((item) => item.id === departmentId))?.name ?? ''} placeholder="选择申报单位后自动带出" /></Field>
        </div>
      </SectionCard>

      <SectionCard title="预算与经费信息" icon={WalletCards}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="预算金额（元）" required><input type="number" min="0" className={inputClass} value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} /></Field>
          <Field label="经费来源" required><select className={inputClass} value={formData.fundingSource} onChange={(e) => update('fundingSource', e.target.value)}><option value="">请选择经费来源</option>{Array.from(new Set([formData.fundingSource, ...fundingSources].filter(Boolean))).map((source) => <option key={source}>{source}</option>)}</select></Field>
          <Field label="经费主管单位" required>
            <select className={inputClass} value={formData.fundingUnitId ?? ''} onChange={(e) => selectFundingUnit(e.target.value)} disabled={departmentsQuery.isLoading}>
              <option value="">请选择经费主管单位</option>
              {departmentGroups.map((group) => (
                <optgroup key={group.id} label={group.name}>
                  {group.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="经费项目名称"><input className={inputClass} value={formData.fundingProjectName} onChange={(e) => update('fundingProjectName', e.target.value)} /></Field>
          <Field label="经费项目编号" className="md:col-span-2"><input className={inputClass} value={formData.fundingProjectNo} onChange={(e) => update('fundingProjectNo', e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="项目负责人" icon={ClipboardList}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="项目负责人" required><input className={inputClass} value={formData.projectLeaderName} onChange={(e) => update('projectLeaderName', e.target.value)} /></Field>
          <Field label="项目负责人联系电话"><input className={inputClass} value={formData.projectLeaderPhone} onChange={(e) => update('projectLeaderPhone', e.target.value)} /></Field>
          <Field label="技术负责人" required><input className={inputClass} value={formData.technicalLeaderName} onChange={(e) => update('technicalLeaderName', e.target.value)} /></Field>
          <Field label="技术负责人联系电话"><input className={inputClass} value={formData.technicalLeaderPhone} onChange={(e) => update('technicalLeaderPhone', e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="采购需求与政策信息" icon={ClipboardList}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="参与编制人员"><input className={inputClass} value={formData.participants} onChange={(e) => update('participants', e.target.value)} placeholder="多人可使用顿号分隔" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="面向中小企业"><YesNoSelect value={formData.smeSuitable} onChange={(value) => update('smeSuitable', value)} /></Field>
            <Field label="面向小微企业"><YesNoSelect value={formData.microSuitable} onChange={(value) => update('microSuitable', value)} /></Field>
          </div>
          <Field label="采购标的需实现的功能" required className="md:col-span-2"><textarea className={textareaClass} value={formData.procurementFunction} onChange={(e) => update('procurementFunction', e.target.value)} /></Field>
          <Field label="采购标的需实现的目标" required className="md:col-span-2"><textarea className={textareaClass} value={formData.procurementGoal} onChange={(e) => update('procurementGoal', e.target.value)} /></Field>
          <Field label="国家强制标准要求"><textarea className={textareaClass} value={formData.mandatoryStandards} onChange={(e) => update('mandatoryStandards', e.target.value)} /></Field>
          <Field label="其他标准"><textarea className={textareaClass} value={formData.otherStandards} onChange={(e) => update('otherStandards', e.target.value)} /></Field>
          <Field label="供应商特殊资质要求" className="md:col-span-2"><textarea className={textareaClass} value={formData.supplierQualifications} onChange={(e) => update('supplierQualifications', e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="交付、服务与验收要求" icon={ListChecks}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="项目实施地点" required><input className={inputClass} value={formData.implementationLocation} onChange={(e) => update('implementationLocation', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="具备安装条件"><YesNoSelect value={formData.installationReady} onChange={(value) => update('installationReady', value)} /></Field>
            <Field label="水电暖气等条件满足"><YesNoSelect value={formData.utilitiesReady} onChange={(value) => update('utilitiesReady', value)} /></Field>
          </div>
          <Field label="现有资产处置使用方案" className="md:col-span-2"><textarea className={textareaClass} value={formData.assetDisposalPlan} onChange={(e) => update('assetDisposalPlan', e.target.value)} /></Field>
          <Field label="合同签订后交付天数" required><input type="number" min="1" className={inputClass} value={formData.deliveryDays} onChange={(e) => update('deliveryDays', e.target.value)} /></Field>
          <Field label="核心产品" required><input className={inputClass} value={formData.coreProduct} onChange={(e) => update('coreProduct', e.target.value)} /></Field>
          <Field label="包装和运输要求" className="md:col-span-2"><textarea className={textareaClass} value={formData.packingRequirement} onChange={(e) => update('packingRequirement', e.target.value)} /></Field>
          <Field label="免费质量保证期（年）" required><input type="number" min="1" className={inputClass} value={formData.warrantyYears} onChange={(e) => update('warrantyYears', e.target.value)} /></Field>
          <Field label="国产设备及服务付款方式"><textarea className={textareaClass} value={formData.domesticPaymentTerms} onChange={(e) => update('domesticPaymentTerms', e.target.value)} /></Field>
          <Field label="进口设备付款方式"><textarea className={textareaClass} value={formData.importPaymentTerms} onChange={(e) => update('importPaymentTerms', e.target.value)} /></Field>
          <Field label="售后服务要求"><textarea className={textareaClass} value={formData.afterSalesRequirement} onChange={(e) => update('afterSalesRequirement', e.target.value)} /></Field>
          <Field label="验收标准" required className="md:col-span-2"><textarea className={textareaClass} value={formData.acceptanceStandard} onChange={(e) => update('acceptanceStandard', e.target.value)} /></Field>
          <Field label="其他技术与服务要求" className="md:col-span-2"><textarea className={textareaClass} value={formData.otherTechnicalRequirements} onChange={(e) => update('otherTechnicalRequirements', e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="评审现场与补充要求" icon={ClipboardList}>
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="需要现场勘查"><YesNoSelect value={formData.siteVisitRequired} onChange={(value) => update('siteVisitRequired', value)} /></Field>
          <Field label="勘查时间"><input className={inputClass} value={formData.siteVisitTime} onChange={(e) => update('siteVisitTime', e.target.value)} placeholder="不需要时可不填" /></Field>
          <Field label="勘查地点"><input className={inputClass} value={formData.siteVisitLocation} onChange={(e) => update('siteVisitLocation', e.target.value)} /></Field>
          <Field label="勘查联系人"><input className={inputClass} value={formData.siteVisitContact} onChange={(e) => update('siteVisitContact', e.target.value)} /></Field>
          <Field label="勘查联系电话"><input className={inputClass} value={formData.siteVisitPhone} onChange={(e) => update('siteVisitPhone', e.target.value)} /></Field>
          <Field label="需要提供样品"><YesNoSelect value={formData.sampleRequired} onChange={(value) => update('sampleRequired', value)} /></Field>
          <Field label="样品要求"><textarea className={textareaClass} value={formData.sampleRequirement} onChange={(e) => update('sampleRequirement', e.target.value)} /></Field>
          <Field label="需要现场产品演示"><YesNoSelect value={formData.demoRequired} onChange={(value) => update('demoRequired', value)} /></Field>
          <Field label="演示时长"><input className={inputClass} value={formData.demoDuration} onChange={(e) => update('demoDuration', e.target.value)} placeholder="例如：20 分钟" /></Field>
          <Field label="演示要求"><textarea className={textareaClass} value={formData.demoRequirement} onChange={(e) => update('demoRequirement', e.target.value)} /></Field>
          <Field label="其他补充事宜" className="md:col-span-2"><textarea className={textareaClass} value={formData.otherNotes} onChange={(e) => update('otherNotes', e.target.value)} /></Field>
        </div>
      </SectionCard>

      <SectionCard title="拟采购设备清单" icon={ListChecks} extra={<span className="text-[11px] font-black text-red-500">至少填写 1 条 *</span>}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-2xl text-xs font-bold leading-5 text-slate-500">申报人填写拟采购设备名称、数量和用途，系统据此辅助判断审批路径；论证环节再关联物料库并完善品牌、型号和技术参数。</p>
          <ActionButton icon={Plus} onClick={() => setItems((current) => [...current, emptyItem()])}>添加设备</ActionButton>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-12">
                <Field label={`设备或采购内容 ${index + 1}`} required className="md:col-span-4"><input className={inputClass} value={item.name} onChange={(event) => updateItem(index, 'name', event.target.value)} placeholder="例如：高性能计算工作站" /></Field>
                <Field label="数量" required className="md:col-span-2"><input type="number" min="1" className={inputClass} value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} /></Field>
                <Field label="单位" className="md:col-span-2"><input className={inputClass} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} placeholder="台 / 套" /></Field>
                <Field label="预算单价（元）" className="md:col-span-3"><input type="number" min="0" className={inputClass} value={item.unitPrice} onChange={(event) => updateItem(index, 'unitPrice', event.target.value)} /></Field>
                <button type="button" onClick={() => setItems((current) => current.filter((_, rowIndex) => rowIndex !== index))} aria-label={`删除第 ${index + 1} 条设备`} title="删除设备" className="mt-6 flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 md:col-span-1"><Trash2 size={15} /></button>
                <Field label="主要用途" className="md:col-span-6"><textarea className={textareaClass} value={item.purpose} onChange={(event) => updateItem(index, 'purpose', event.target.value)} placeholder="例如：人工智能实验教学与模型训练" /></Field>
                <Field label="初步技术参数" className="md:col-span-6"><textarea className={textareaClass} value={item.technicalParameters} onChange={(event) => updateItem(index, 'technicalParameters', event.target.value)} placeholder="填写性能、配置、接口和服务要求" /></Field>
              </div>
              <div className="mt-3 flex justify-end text-xs font-black text-slate-500">预算小计：<span className="ml-2 font-mono text-blue-700">¥{Number(item.totalPrice || 0).toLocaleString('zh-CN')}</span></div>
            </div>
          ))}
          {items.length === 0 && <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-5 py-9 text-center"><p className="text-sm font-black text-slate-700">尚未填写拟采购设备</p><p className="mt-1 text-xs font-bold text-slate-400">至少添加一条设备或采购内容，系统才能形成完整的流程判断依据。</p></div>}
        </div>
      </SectionCard>

      <SectionCard title="网上商城型号确认单" icon={ListChecks} extra={<span className="text-[11px] font-black text-blue-700">与设备清单同步</span>}>
        <div className="mb-4 grid gap-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4 md:grid-cols-[14rem_minmax(0,1fr)]">
          <Field label="是否需要网上商城选型"><YesNoSelect value={formData.mallSelectionApplicable} onChange={(value) => update('mallSelectionApplicable', value)} /></Field>
          <p className="self-end pb-2 text-xs font-bold leading-5 text-blue-700/80">选择“是”后，需为每条设备确认品牌、型号、供应商、商城价格和参与选型人员。确认结果自动写入采购申请模板。</p>
        </div>
        {formData.mallSelectionApplicable === '否' ? (
          <FeedbackNotice tone="info" message="当前项目不适用网上商城选型，设备清单仍会进入采购需求表和采购申请单。" />
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={`mall-${index}`} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <p className="text-sm font-black text-slate-950">{index + 1}. {item.name || '待填写设备名称'}</p>
                  <span className="text-xs font-bold text-slate-500">数量 {item.quantity || 0} {item.unit}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="确认品牌" required><input className={inputClass} value={item.selectedBrand} onChange={(event) => updateItem(index, 'selectedBrand', event.target.value)} /></Field>
                  <Field label="确认型号" required><input className={inputClass} value={item.selectedModel} onChange={(event) => updateItem(index, 'selectedModel', event.target.value)} /></Field>
                  <Field label="商城供应商" required><input className={inputClass} value={item.selectedSupplier} onChange={(event) => updateItem(index, 'selectedSupplier', event.target.value)} /></Field>
                  <Field label="商城单价（元）" required><input type="number" min="0" className={inputClass} value={item.selectedUnitPrice} onChange={(event) => updateItem(index, 'selectedUnitPrice', event.target.value)} /></Field>
                  <Field label="供应商联系人"><input className={inputClass} value={item.supplierContact} onChange={(event) => updateItem(index, 'supplierContact', event.target.value)} /></Field>
                  <Field label="联系电话"><input className={inputClass} value={item.supplierPhone} onChange={(event) => updateItem(index, 'supplierPhone', event.target.value)} /></Field>
                  <Field label="商品链接" className="lg:col-span-2"><input className={inputClass} value={item.productLink} onChange={(event) => updateItem(index, 'productLink', event.target.value)} placeholder="https://" /></Field>
                  <Field label="商城型号技术参数" className="md:col-span-2"><textarea className={textareaClass} value={item.selectedParameters} onChange={(event) => updateItem(index, 'selectedParameters', event.target.value)} /></Field>
                  <Field label="网上商城选型参与人" required className="md:col-span-2"><input className={inputClass} value={item.selectionParticipants} onChange={(event) => updateItem(index, 'selectionParticipants', event.target.value)} placeholder="多人可使用顿号分隔" /></Field>
                </div>
              </div>
            ))}
            {items.length === 0 && <FeedbackNotice tone="info" message="请先在上方添加拟采购设备，再填写商城型号确认信息。" />}
          </div>
        )}
      </SectionCard>

      <SectionCard title="流程判定信息" icon={GitBranch}>
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3">
          <p className="text-xs font-black text-blue-800">系统根据当前表单实时辅助判断</p>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700/80">下方完整展示使用的字段、命中依据和系统建议。申报人可人工调整，调整记录与系统原建议会同时保存，最终确认值用于 Flowable 条件路由。</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {automaticDecisions.map((decision) => (
            <RouteDecisionCard
              key={decision.key}
              decision={decision}
              value={decisionValue(decision)}
              mode={formData[`${decision.key}Mode`] === 'manual' ? 'manual' : 'auto'}
              onManualChange={(value) => setFormData((current) => ({ ...current, [decision.key]: value, [`${decision.key}Mode`]: 'manual' }))}
              onRestore={() => setFormData((current) => ({ ...current, [decision.key]: decision.value, [`${decision.key}Mode`]: 'auto' }))}
            />
          ))}
        </div>
        <div className={cn('mt-5 rounded-lg border px-4 py-3 text-sm font-bold', schoolLeaderRule.startsWith('需要') ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-600')}>
          {schoolLeaderRule}
        </div>
      </SectionCard>

      <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white px-5 py-4 shadow-sm', showValidation && !valid ? 'border-red-200' : 'border-slate-200')}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-500">保存后返回项目列表，再提交进入“购置必要性论证”节点。</p>
          {!valid && <p className="mt-1.5 break-words text-xs font-black text-amber-700">尚未完成：{missingRequired.join('、')}</p>}
        </div>
        <PrimaryActionButton icon={Save} size="md" flushTop busy={busy} pendingLabel="保存中" onClick={save}>{valid ? '保存申报' : '检查并保存'}</PrimaryActionButton>
      </div>
    </div>
  );
}

export function getMissingRequiredFields({
  projectName,
  applicantUnit,
  departmentId,
  budgetAmount,
  formData,
  items,
}: {
  projectName: string;
  applicantUnit: string;
  departmentId?: string;
  budgetAmount: string;
  formData: Record<string, string>;
  items: LudongItem[];
}) {
  const missing: string[] = [];
  const requireText = (value: string | undefined, label: string) => {
    if (!value?.trim()) missing.push(label);
  };
  requireText(projectName, '采购项目名称');
  if (!applicantUnit.trim() || !departmentId?.trim()) missing.push('申报单位');
  if (!(Number(budgetAmount) > 0)) missing.push('预算金额');
  requireText(formData.fundingSource, '经费来源');
  requireText(formData.fundingUnitId, '经费主管单位');
  requireText(formData.projectLeaderName, '项目负责人');
  requireText(formData.technicalLeaderName, '技术负责人');
  requireText(formData.procurementFunction, '采购标的功能');
  requireText(formData.procurementGoal, '采购目标');
  requireText(formData.implementationLocation, '项目实施地点');
  if (!(Number(formData.deliveryDays) > 0)) missing.push('交付天数');
  requireText(formData.coreProduct, '核心产品');
  if (!(Number(formData.warrantyYears) > 0)) missing.push('质量保证期');
  requireText(formData.acceptanceStandard, '验收标准');
  if (items.length === 0) {
    missing.push('拟采购设备清单');
  } else {
    items.forEach((item, index) => {
      if (!item.name.trim()) missing.push(`第 ${index + 1} 条设备名称`);
      if (!(Number(item.quantity) > 0)) missing.push(`第 ${index + 1} 条设备数量`);
      if (formData.mallSelectionApplicable === '是') {
        requireText(item.selectedBrand, `第 ${index + 1} 条商城确认品牌`);
        requireText(item.selectedModel, `第 ${index + 1} 条商城确认型号`);
        requireText(item.selectedSupplier, `第 ${index + 1} 条商城供应商`);
        if (!(Number(item.selectedUnitPrice) > 0)) missing.push(`第 ${index + 1} 条商城单价`);
        requireText(item.selectionParticipants, `第 ${index + 1} 条商城选型参与人`);
      }
    });
  }
  return missing;
}

function buildDepartmentGroups(departments: DepartmentResponse[]) {
  const active = departments.filter((department) => department.id && department.name && department.status !== 'disabled');
  const parentNames = new Map(active.map((department) => [department.id!, department.name!]));
  const parentIds = new Set(active.map((department) => department.parentId).filter(Boolean));
  const groups = new Map<string, { id: string; name: string; departments: DepartmentResponse[] }>();
  active.filter((department) => !parentIds.has(department.id) && department.parentId).forEach((department) => {
    const parentId = department.parentId!;
    const group = groups.get(parentId) ?? { id: parentId, name: parentNames.get(parentId) ?? '其他单位', departments: [] };
    group.departments.push(department);
    groups.set(parentId, group);
  });
  return Array.from(groups.values()).map((group) => ({
    ...group,
    departments: group.departments.sort((left, right) => (left.name ?? '').localeCompare(right.name ?? '', 'zh-CN')),
  }));
}

function evaluateRouteDecisions({
  applicantUnit,
  departmentId,
  fundingUnitId,
  fundingUnitName,
  projectName,
  items,
}: {
  applicantUnit: string;
  departmentId: string;
  fundingUnitId?: string;
  fundingUnitName?: string;
  projectName: string;
  items: LudongItem[];
}): RouteDecision[] {
  const sources = [
    { label: '申报单位', value: applicantUnit },
    { label: '项目名称', value: projectName },
    { label: '设备清单', value: items.map((item) => `${item.name} ${item.purpose}`).join(' ') },
  ];
  const keywordDecision = (
    key: RouteKey,
    label: string,
    keywords: string[],
    rule: string,
  ): RouteDecision => {
    const evidence = sources.flatMap((source) => keywords
      .filter((keyword) => source.value.includes(keyword))
      .map((keyword) => `${source.label}命中“${keyword}”`));
    const distinctEvidence = Array.from(new Set(evidence)).slice(0, 6);
    return {
      key,
      label,
      value: distinctEvidence.length > 0 ? '是' : '否',
      rule,
      evidence: distinctEvidence.length > 0
        ? distinctEvidence
        : ['申报单位、项目名称和设备清单均未命中当前规则关键词'],
    };
  };

  const fundingComplete = Boolean(departmentId && fundingUnitId);
  const sameFunding = fundingComplete && departmentId === fundingUnitId;
  return [
    {
      key: 'sameFundingUnit',
      label: '经费主管单位与申报单位相同',
      value: sameFunding ? '是' : '否',
      rule: '比较申报单位与经费主管单位的组织主数据 ID。',
      evidence: fundingComplete
        ? [`申报单位：${applicantUnit}`, `经费主管单位：${fundingUnitName || '未命名单位'}`, sameFunding ? '两个组织 ID 一致' : '两个组织 ID 不一致']
        : ['申报单位或经费主管单位尚未选择，暂不能完成比较'],
    },
    keywordDecision(
      'requiresItReview',
      '涉及信创产品',
      ['信创', '国产处理器', '国产操作系统', '服务器', '计算机', '终端', '软件', '系统', '网络', '数据库', '信息化', '芯片', '集成电路', '人工智能'],
      '申报单位、项目名称或设备清单命中信息化、计算机、国产软硬件及信创相关词时，建议进入教育信息技术部审核。',
    ),
    keywordDecision(
      'requiresAssetReview',
      '涉及办公设备或家具配置',
      ['办公', '家具', '桌', '椅', '柜', '电脑', '终端', '显示器', '打印机', '复印机', '投影', '空调'],
      '项目名称或设备清单命中办公设备、通用终端、家具及配置类词时，建议进入资产配置审核。',
    ),
    keywordDecision(
      'requiresLabReview',
      '涉及大型仪器或实验室',
      ['实验室', '实验', '仪器', '采集', '测量', '检测', '显微', '光电', '科研设备', '工作站'],
      '申报单位、项目名称或设备清单命中实验室、科研仪器、测量检测及工作站相关词时，建议进入实验室管理审核。',
    ),
  ];
}

function RouteDecisionCard({
  decision,
  value,
  mode,
  onManualChange,
  onRestore,
}: {
  decision: RouteDecision;
  value: RouteValue;
  mode: 'auto' | 'manual';
  onManualChange: (value: RouteValue) => void;
  onRestore: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950">{decision.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className={cn('rounded-md px-2 py-1 text-[11px] font-black', decision.value === '是' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600')}>系统建议：{decision.value}</span>
            <span className={cn('rounded-md px-2 py-1 text-[11px] font-black', mode === 'manual' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')}>{mode === 'manual' ? '人工调整' : '系统判断'}</span>
          </div>
        </div>
        {mode === 'manual' && <button type="button" onClick={onRestore} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"><RotateCcw size={13} />恢复系统判断</button>}
      </div>
      <div className="space-y-3 px-4 py-3">
        <div>
          <p className="text-[11px] font-black text-slate-400">判断规则</p>
          <p className="mt-1 text-xs font-bold leading-5 text-slate-600">{decision.rule}</p>
        </div>
        <div>
          <p className="text-[11px] font-black text-slate-400">本次判断依据</p>
          <ul className="mt-1 space-y-1">{decision.evidence.map((evidence) => <li key={evidence} className="flex gap-2 text-xs font-bold leading-5 text-slate-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />{evidence}</li>)}</ul>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-black text-slate-400">最终确认值</p>
          <div className="grid grid-cols-2 gap-2">{(['否', '是'] as RouteValue[]).map((option) => <button key={option} type="button" onClick={() => onManualChange(option)} className={cn('h-9 rounded-lg border text-xs font-black transition', value === option ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>{option}</button>)}</div>
        </div>
      </div>
    </article>
  );
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={cn('block', className)}><span className="mb-2 block text-xs font-black text-slate-700">{label}{required && <b className="ml-1 text-red-500">*</b>}</span>{children}</label>;
}

function YesNoSelect({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return <select className={inputClass} value={value || '否'} onChange={(event) => onChange(event.target.value)}><option>是</option><option>否</option></select>;
}
