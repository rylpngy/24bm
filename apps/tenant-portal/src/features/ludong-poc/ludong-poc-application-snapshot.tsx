import { StatusPill } from '@24bid/ui';
import type { LudongApplication, LudongItem } from './api';
import {
  acceptanceStandardTemplate, otherTechnicalRequirementsTemplate, requirementText,
} from './ludong-poc-requirement-templates';

export type SnapshotFact = [label: string, value: string | number | undefined];
export type SnapshotSection = { title: string; facts: SnapshotFact[] };

const approvalSections: Array<{ title: string; fields: Array<[string, string]> }> = [
  { title: '购置必要性论证', fields: [['论证结论', 'argumentationOpinion'], ['论证意见', 'argumentationComment']] },
  { title: '技术负责人确认', fields: [['技术方案确认意见', 'technicalLeaderOpinion'], ['技术参数与实施条件说明', 'technicalLeaderComment']] },
  { title: '参与编制人员确认', fields: [['采购需求编制确认', 'compilationParticipantOpinion'], ['编制内容补充说明', 'compilationParticipantComment']] },
  { title: '网上商城选型参与人确认', fields: [['商城型号确认意见', 'mallSelectionParticipantOpinion'], ['品牌、型号、价格及选型说明', 'mallSelectionParticipantComment']] },
  { title: '教育信息技术部审核', fields: [['信创产品审核意见', 'itReviewOpinion'], ['审核说明', 'itReviewComment']] },
  { title: '申报单位负责人审核', fields: [['申报单位意见', 'applicantUnitOpinion'], ['申报单位补充意见', 'applicantUnitComment']] },
  { title: '经费主管单位负责人审核', fields: [['经费主管单位意见', 'fundingUnitOpinion'], ['经费主管单位补充意见', 'fundingUnitComment']] },
  { title: '资产处配置审核', fields: [['是否超过价格上限', 'exceedsPriceLimit'], ['是否超过数量上限', 'exceedsQuantityLimit'], ['配置审核结论', 'assetConfigurationOpinion'], ['配置审核说明', 'assetConfigurationComment']] },
  { title: '资产处分管领导审核', fields: [['分管领导意见', 'assetDivisionLeaderOpinion'], ['补充意见', 'assetDivisionLeaderComment']] },
  { title: '资产处单位负责人审核', fields: [['单位负责人意见', 'assetUnitLeaderOpinion'], ['补充意见', 'assetUnitLeaderComment']] },
  { title: '实验室管理处论证审核', fields: [['大型仪器设备共享审核', 'largeEquipmentSharing'], ['论证审核结论', 'labReviewOpinion'], ['论证审核意见', 'labReviewComment']] },
  { title: '实验室管理处分管领导审核', fields: [['分管领导意见', 'labDivisionLeaderOpinion'], ['补充意见', 'labDivisionLeaderComment']] },
  { title: '实验室管理处单位负责人审核', fields: [['单位负责人意见', 'labUnitLeaderOpinion'], ['补充意见', 'labUnitLeaderComment']] },
  { title: '分管校领导审核', fields: [['分管校领导意见', 'schoolLeaderOpinion'], ['批示意见', 'schoolLeaderComment']] },
  { title: '财务预算办公室审核', fields: [['预算审查情况', 'financeBudgetStatus'], ['财务预算补充意见', 'financeBudgetOpinion']] },
  { title: '采购预算办公室审核', fields: [['采购预算审查情况', 'procurementBudgetStatus'], ['采购预算补充意见', 'procurementBudgetOpinion']] },
  { title: '申请材料提交确认', fields: [['提交确认', 'handoverSubmitConfirmation'], ['提交说明', 'handoverSubmitComment']] },
  { title: '申请材料受理确认', fields: [['受理结果', 'handoverAcceptance'], ['受理说明', 'handoverAcceptComment']] },
  { title: '财经处采购方式审核', fields: [['批准采购方式', 'procurementMethod'], ['采购方式说明', 'procurementMethodComment']] },
  { title: '财经处负责人终审', fields: [['负责人终审意见', 'financeResponsibleOpinion'], ['终审批示', 'financeResponsibleComment']] },
];

export function buildApplicationSnapshotSections(app: LudongApplication): SnapshotSection[] {
  const data = app.formData;
  const siteFacts: SnapshotFact[] = [['需要现场勘查', data.siteVisitRequired]];
  if (data.siteVisitRequired === '是') siteFacts.push(
    ['勘查时间', data.siteVisitTime], ['勘查地点', data.siteVisitLocation],
    ['勘查联系人', data.siteVisitContact], ['勘查电话', data.siteVisitPhone],
  );
  siteFacts.push(['需要样品', data.sampleRequired]);
  if (data.sampleRequired === '是') siteFacts.push(['样品要求', data.sampleRequirement]);
  siteFacts.push(['需要产品演示', data.demoRequired]);
  if (data.demoRequired === '是') siteFacts.push(['演示时长', data.demoDuration], ['演示要求', data.demoRequirement]);
  siteFacts.push(['其他补充事宜', data.otherNotes]);

  return [
    { title: '项目与经费', facts: [
      ['采购项目名称', app.projectName], ['申报编号', app.applicationNo], ['申报单位', app.applicantUnit],
      ['单位类型', data.applicantUnitType], ['预算金额', currency(app.budgetAmount)], ['经费来源', data.fundingSource],
      ['经费主管单位', data.fundingUnitName], ['经费项目名称', data.fundingProjectName], ['经费项目编号', data.fundingProjectNo],
    ] },
    { title: '负责人及编制人员', facts: [
      ['项目负责人', data.projectLeaderName], ['项目负责人电话', data.projectLeaderPhone],
      ['技术负责人', data.technicalLeaderName], ['技术负责人电话', data.technicalLeaderPhone], ['参与编制人员', data.participants],
    ] },
    { title: '采购需求与政策信息', facts: [
      ['购置理由及必要性', data.purchaseReason], ['面向中小企业', data.smeSuitable], ['面向小微企业', data.microSuitable],
      ['采购标的需实现的功能', data.procurementFunction], ['采购标的需实现的目标', data.procurementGoal],
      ['国家强制标准要求', data.mandatoryStandards], ['其他标准', data.otherStandards], ['供应商特殊资质要求', data.supplierQualifications],
    ] },
    { title: '交付、服务与验收要求', facts: [
      ['项目实施地点', data.implementationLocation], ['具备安装条件', data.installationReady], ['水电暖气等条件满足', data.utilitiesReady],
      ['现有资产处置使用方案', data.assetDisposalPlan], ['交付天数', data.deliveryDays], ['核心产品', data.coreProduct],
      ['包装和运输要求', data.packingRequirement], ['免费质量保证期（年）', data.warrantyYears],
      ['国产设备及服务付款方式', data.domesticPaymentTerms], ['进口设备付款方式', data.importPaymentTerms],
      ['售后服务要求', data.afterSalesRequirement], ['验收标准', requirementText(acceptanceStandardTemplate, data.acceptanceStandard)],
      ['其他技术与服务要求', requirementText(otherTechnicalRequirementsTemplate, data.otherTechnicalRequirements)],
    ] },
    { title: '评审现场与补充要求', facts: siteFacts },
    { title: '流程判定信息', facts: [
      ['涉及信创产品', data.requiresItReview], ['信创判定依据', data.requiresItReviewReason],
      ['涉及办公设备或家具配置', data.requiresAssetReview], ['资产配置判定依据', data.requiresAssetReviewReason],
      ['涉及大型仪器或实验室', data.requiresLabReview], ['实验室判定依据', data.requiresLabReviewReason],
      ['需要分管校领导审核', data.requiresSchoolLeader], ['网上商城型号确认', data.mallSelectionApplicable], ['商城判定依据', data.mallSelectionReason],
    ] },
  ];
}

export function buildApprovalSnapshotSections(app: LudongApplication): SnapshotSection[] {
  return approvalSections.map((section) => ({
    title: section.title,
    facts: section.fields.map(([label, field]) => [label, app.formData[field]] as SnapshotFact),
  })).filter((section) => section.facts.some(([, value]) => String(value ?? '').trim()));
}

export function buildMallSelectionRows(app: LudongApplication) {
  return app.items.filter((item) => item.governmentMallCatalog === '是');
}

export function LudongPocApplicationSnapshot({ app, includeApprovals = true }: {
  app: LudongApplication;
  includeApprovals?: boolean;
}) {
  const mallItems = buildMallSelectionRows(app);
  const approvals = includeApprovals ? buildApprovalSnapshotSections(app) : [];
  return <div className="space-y-6">
    {buildApplicationSnapshotSections(app).map((section) => <SnapshotFacts key={section.title} section={section} />)}
    <EquipmentList items={app.items} />
    <MallSelectionList items={mallItems} />
    {approvals.length > 0 && <div className="space-y-3 border-t border-slate-200 pt-5">
      <div><h3 className="text-sm font-black text-slate-950">审批内容</h3><p className="mt-1 text-xs font-bold text-slate-500">展示各已办节点留存的结论与补充意见。</p></div>
      {approvals.map((section) => <SnapshotFacts key={section.title} section={section} />)}
    </div>}
  </div>;
}

function SnapshotFacts({ section }: { section: SnapshotSection }) {
  return <section>
    <h3 className="mb-2 text-xs font-black text-slate-800">{section.title}</h3>
    <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{section.facts.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
      <dt className="text-[11px] font-black text-slate-400">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words text-xs font-bold leading-5 text-slate-700">{display(value)}</dd>
    </div>)}</dl>
  </section>;
}

function EquipmentList({ items }: { items: LudongItem[] }) {
  return <section>
    <h3 className="mb-2 text-xs font-black text-slate-800">拟采购设备清单</h3>
    <div className="space-y-2">{items.map((item, index) => <article key={`${item.materialId || item.name}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2"><b className="text-xs text-slate-900">{index + 1}. {item.name || '未填写设备名称'}</b>{item.coreProduct === '是' && <StatusPill label="核心产品" />}{item.governmentMallCatalog === '是' && <StatusPill label="网上商城目录" />}</div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {itemFacts(item).map(([label, value]) => <CompactFact key={label} label={label} value={value} />)}
      </dl>
    </article>)}</div>
  </section>;
}

function MallSelectionList({ items }: { items: LudongItem[] }) {
  return <section>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-black text-slate-800">网上商城品牌型号确认单</h3><StatusPill label={items.length ? `${items.length} 项` : '不涉及'} /></div>
    {items.length === 0 ? <p className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-500">本项目没有属于山东省政府采购网上商城目录的设备。</p> : <div className="space-y-2">{items.map((item, index) => <article key={`${item.materialId || item.name}-${index}`} className="rounded-lg border border-blue-100 bg-blue-50/30 p-3">
      <p className="text-xs font-black text-slate-900">{index + 1}. {item.name || '未填写设备名称'}</p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{mallFacts(item).map(([label, value]) => <CompactFact key={label} label={label} value={value} />)}</dl>
    </article>)}</div>}
  </section>;
}

function CompactFact({ label, value }: { label: string; value?: string | number }) {
  return <div className="min-w-0"><dt className="text-[10px] font-black text-slate-400">{label}</dt><dd className="mt-0.5 break-words text-xs font-bold leading-5 text-slate-700">{display(value)}</dd></div>;
}

function itemFacts(item: LudongItem): SnapshotFact[] {
  return [
    ['目录编码', item.materialCode], ['目录分类', item.materialCategory], ['计量单位', item.unit], ['数量', item.quantity],
    ['市场调研单价', money(item.unitPrice)], ['预算小计', money(item.totalPrice)], ['主要技术参数', item.technicalParameters], ['参考品牌及型号', item.referenceBrands],
    ['是否进口', item.imported], ['进口设备供货期', item.imported === '是' ? item.importLeadTime : '不涉及'], ['主要用途', item.purpose], ['使用方向', item.usageDirection],
    ['使用人', item.userName], ['存放地点', item.installationLocation], ['是否核心产品', item.coreProduct], ['是否网上商城目录', item.governmentMallCatalog],
    ['商城目录判定依据', item.governmentMallCatalogReason],
  ];
}

function mallFacts(item: LudongItem): SnapshotFact[] {
  return [
    ['设备名称', item.name], ['数量', `${display(item.quantity)} ${item.unit || ''}`.trim()], ['市场调研单价', money(item.unitPrice)], ['配置标准价', money(item.standardUnitPrice)],
    ['申报技术参数', item.technicalParameters], ['最终品牌', item.selectedBrand], ['最终型号', item.selectedModel], ['供应商', item.selectedSupplier],
    ['供应商联系人', item.supplierContact], ['供应商电话', item.supplierPhone], ['商品链接', item.productLink], ['选定配置参数', item.selectedParameters],
    ['商城确认单价', money(item.selectedUnitPrice)], ['选型参与人', item.selectionParticipants],
  ];
}

function money(value?: string) {
  return value && Number.isFinite(Number(value)) ? currency(Number(value)) : value;
}

function currency(value: number) {
  return `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function display(value?: string | number) {
  return value == null || String(value).trim() === '' ? '未填写' : String(value);
}
