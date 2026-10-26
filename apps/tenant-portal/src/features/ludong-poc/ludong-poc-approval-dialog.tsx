import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ActionButton, FeedbackNotice, PrimaryActionButton, SectionCard, StatusPill, cn,
} from '@24bid/ui';
import {
  BookOpenCheck, Bot, CheckCircle2, ClipboardCheck, FileText, Flag, RefreshCw,
  ShieldCheck, Sparkles, ThumbsUp, TriangleAlert, WandSparkles, X, XCircle,
} from 'lucide-react';
import {
  ludongApi, type LudongAiReviewFinding, type LudongAiReviewResult,
  type LudongAiReviewMetrics, type LudongApplication, type WorkflowTask,
} from './api';
import { LudongPocApplicationSnapshot } from './ludong-poc-application-snapshot';
import { WorkflowTaskOperations } from '../process/workflow-task-operations';

type ReviewData = Record<string, unknown>;
type FieldDefinition = {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  required?: boolean;
};

const agree = ['同意', '不同意'];
export const financeBudgetStatuses = [
  '本项目已列入本年度学校预算',
  '本项目年初无预算，现已办理预算追加手续',
  '本项目本年度无预算，已列入下一年度预算',
];
export const procurementBudgetStatuses = [
  '本项目已列入本年度采购预算',
  '本项目年初无采购预算，现已办理采购预算追加手续',
  '本项目本年度无采购预算，已列入下一年度采购预算',
];

const nodeForms: Record<string, { title: string; fields: FieldDefinition[] }> = {
  argumentation_review: {
    title: '购置必要性论证',
    fields: [
      { id: 'argumentationOpinion', label: '论证结论', type: 'select', options: agree, required: true },
      { id: 'argumentationComment', label: '论证意见', type: 'textarea', required: true },
    ],
  },
  technical_leader_review: { title: '技术负责人确认', fields: [
    { id: 'technicalLeaderOpinion', label: '技术方案确认意见', type: 'select', options: agree, required: true },
    { id: 'technicalLeaderComment', label: '技术参数与实施条件说明', type: 'textarea' },
  ] },
  compilation_participant_review: { title: '参与编制人员确认', fields: [
    { id: 'compilationParticipantOpinion', label: '采购需求编制确认', type: 'select', options: agree, required: true },
    { id: 'compilationParticipantComment', label: '编制内容补充说明', type: 'textarea' },
  ] },
  mall_selection_participant_review: { title: '网上商城选型参与人确认', fields: [
    { id: 'mallSelectionParticipantOpinion', label: '商城型号确认意见', type: 'select', options: agree, required: true },
    { id: 'mallSelectionParticipantComment', label: '品牌、型号、价格及选型说明', type: 'textarea' },
  ] },
  it_review: { title: '教育信息技术部审核', fields: [
    { id: 'itReviewOpinion', label: '信创产品审核意见', type: 'select', options: agree, required: true },
    { id: 'itReviewComment', label: '审核说明', type: 'textarea' },
  ] },
  unit_review: { title: '申报单位负责人审核', fields: [
    { id: 'applicantUnitOpinion', label: '申报单位意见', type: 'select', options: agree, required: true },
    { id: 'applicantUnitComment', label: '申报单位补充意见', type: 'textarea' },
  ] },
  funding_review: { title: '经费主管单位负责人审核', fields: [
    { id: 'fundingUnitOpinion', label: '经费主管单位意见', type: 'select', options: agree, required: true },
    { id: 'fundingUnitComment', label: '经费主管单位补充意见', type: 'textarea' },
  ] },
  asset_configuration_review: { title: '资产处配置审核', fields: [
    { id: 'exceedsPriceLimit', label: '是否超过价格上限', type: 'select', options: ['否', '是'], required: true },
    { id: 'exceedsQuantityLimit', label: '是否超过数量上限', type: 'select', options: ['否', '是'], required: true },
    { id: 'assetConfigurationOpinion', label: '资产配置审核结论', type: 'select', options: agree, required: true },
    { id: 'assetConfigurationComment', label: '资产配置审核说明', type: 'textarea' },
  ] },
  asset_division_leader_review: { title: '资产处分管领导审核', fields: [
    { id: 'assetDivisionLeaderOpinion', label: '分管领导意见', type: 'select', options: agree, required: true },
    { id: 'assetDivisionLeaderComment', label: '补充意见', type: 'textarea' },
  ] },
  asset_unit_leader_review: { title: '资产处单位负责人审核', fields: [
    { id: 'assetUnitLeaderOpinion', label: '单位负责人意见', type: 'select', options: agree, required: true },
    { id: 'assetUnitLeaderComment', label: '补充意见', type: 'textarea' },
  ] },
  lab_equipment_review: { title: '实验室管理处论证审核', fields: [
    { id: 'largeEquipmentSharing', label: '大型仪器设备共享审核', type: 'select', options: ['同意共享', '不同意共享', '不涉及'], required: true },
    { id: 'labReviewOpinion', label: '论证审核结论', type: 'select', options: agree, required: true },
    { id: 'labReviewComment', label: '论证审核意见', type: 'textarea' },
  ] },
  lab_division_leader_review: { title: '实验室管理处分管领导审核', fields: [
    { id: 'labDivisionLeaderOpinion', label: '分管领导意见', type: 'select', options: agree, required: true },
    { id: 'labDivisionLeaderComment', label: '补充意见', type: 'textarea' },
  ] },
  lab_unit_leader_review: { title: '实验室管理处单位负责人审核', fields: [
    { id: 'labUnitLeaderOpinion', label: '单位负责人意见', type: 'select', options: agree, required: true },
    { id: 'labUnitLeaderComment', label: '补充意见', type: 'textarea' },
  ] },
  school_leader_review: { title: '分管校领导审核', fields: [
    { id: 'schoolLeaderOpinion', label: '分管校领导意见', type: 'select', options: agree, required: true },
    { id: 'schoolLeaderComment', label: '批示意见', type: 'textarea' },
  ] },
  finance_budget_review: { title: '财务预算办公室审核', fields: [
    { id: 'financeBudgetStatus', label: '预算审查情况', type: 'select', options: financeBudgetStatuses, required: true },
    { id: 'financeBudgetOpinion', label: '财务预算补充意见', type: 'textarea' },
  ] },
  procurement_budget_review: { title: '采购预算办公室审核', fields: [
    { id: 'procurementBudgetStatus', label: '采购预算审查情况', type: 'select', options: procurementBudgetStatuses, required: true },
    { id: 'procurementBudgetOpinion', label: '采购预算补充意见', type: 'textarea' },
  ] },
  handover_submit: { title: '申请材料提交确认', fields: [
    { id: 'handoverSubmitConfirmation', label: '提交确认', type: 'select', options: ['材料完整，确认提交'], required: true },
    { id: 'handoverSubmitComment', label: '提交说明', type: 'textarea' },
  ] },
  handover_accept: { title: '申请材料受理确认', fields: [
    { id: 'handoverAcceptance', label: '受理结果', type: 'select', options: ['材料齐全，确认受理', '材料不齐，退回补充'], required: true },
    { id: 'handoverAcceptComment', label: '受理说明', type: 'textarea' },
  ] },
  procurement_method_review: { title: '财经处采购方式审核', fields: [
    { id: 'procurementMethod', label: '批准采购方式', type: 'select', options: ['公开招标', '邀请招标', '竞争性谈判', '竞争性磋商', '单一来源采购', '询价'], required: true },
    { id: 'procurementMethodComment', label: '采购方式说明', type: 'textarea' },
  ] },
  finance_responsible_review: { title: '财经处负责人终审', fields: [
    { id: 'financeResponsibleOpinion', label: '负责人终审意见', type: 'select', options: agree, required: true },
    { id: 'financeResponsibleComment', label: '终审批示', type: 'textarea' },
  ] },
};

export function taskNodeId(task: WorkflowTask) {
  return task.taskDefinitionKey?.startsWith('task_') ? task.taskDefinitionKey.slice(5) : task.taskDefinitionKey;
}

export function createTaskReviewData(task: WorkflowTask, _app?: LudongApplication): ReviewData {
  const node = taskNodeId(task);
  const form = nodeForms[node];
  const data: ReviewData = {};
  form?.fields.forEach((field) => {
    data[field.id] = '';
  });
  return data;
}

export function LudongPocApprovalDialog({
  task, app, comment, setComment, reviewData, setReviewData, busy, onClose, onComplete,
}: {
  task: WorkflowTask;
  app?: LudongApplication;
  comment: string;
  setComment: (value: string) => void;
  reviewData: ReviewData;
  setReviewData: (value: ReviewData) => void;
  busy: boolean;
  onClose: () => void;
  onComplete: (action: 'approve' | 'reject') => void;
}) {
  const node = taskNodeId(task);
  const form = nodeForms[node];
  const update = (key: string, value: unknown) => setReviewData({ ...reviewData, [key]: value });
  const [operationBusy, setOperationBusy] = useState(false);
  const complete = form?.fields.every((field) => !field.required || String(reviewData[field.id] ?? '').trim());
  const argumentationRejected = node === 'argumentation_review'
    && reviewData.argumentationOpinion === '不同意';
  const aiReview = useMutation({
    mutationFn: () => {
      if (!app) throw new Error('未找到项目申报数据');
      return ludongApi.aiReview(app.id, task.taskDefinitionKey, reviewData);
    },
  });
  const aiMetrics = useQuery({
    queryKey: ['ludong-poc', 'ai-review-metrics'],
    queryFn: ludongApi.aiReviewMetrics,
    enabled: Boolean(app),
    staleTime: 60_000,
  });
  const [feedbackState, setFeedbackState] = useState<Record<string, 'adopted' | 'false_positive'>>({});
  const aiFeedback = useMutation({
    mutationFn: ({ findingId, disposition }: {
      findingId: string;
      disposition: 'adopted' | 'false_positive';
    }) => {
      if (!app || !aiReview.data) throw new Error('请先生成辅助评审');
      return ludongApi.aiReviewFeedback(app.id, aiReview.data.runId, findingId, disposition);
    },
    onSuccess: (_, variables) => setFeedbackState((current) => ({
      ...current,
      [variables.findingId]: variables.disposition,
    })),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 sm:p-5">
      <section className="flex max-h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-slate-100 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ClipboardCheck size={19} /></span>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black text-slate-950">{form?.title ?? task.taskName}</h2><StatusPill label="当前待办" /></div><p className="mt-1 truncate text-xs font-bold text-slate-500">{app?.projectName} · {app?.applicationNo}</p></div>
          <button type="button" onClick={onClose} aria-label="关闭" title="关闭" className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          <SectionCard title="申报及前序审批信息" icon={FileText} className="shadow-none">
            {app && <LudongPocApplicationSnapshot app={app} />}
          </SectionCard>
          <AiReviewPanel
            result={aiReview.data}
            busy={aiReview.isPending}
            error={aiReview.isError ? '辅助评审生成失败，请稍后重试。' : ''}
            metrics={aiMetrics.data}
            feedbackState={feedbackState}
            disabled={!app}
            onReview={() => aiReview.mutate()}
            onUseComment={(value) => setComment(value)}
            onFeedback={(findingId, disposition) => aiFeedback.mutate({ findingId, disposition })}
          />
          {!form && <FeedbackNotice tone="error" message={`当前节点 ${node} 尚未配置办理表单，请联系管理员。`} />}
          {form && <SectionCard title="本节点办理内容" icon={ClipboardCheck} className="shadow-none">
            <div className="grid gap-4 md:grid-cols-2">
              {form.fields.map((field) => <TaskField key={field.id} field={field} value={reviewData[field.id]} onChange={(value) => update(field.id, value)} />)}
            </div>
          </SectionCard>}
          {argumentationRejected && <FeedbackNotice tone="error" message="论证结论为“不同意”，本节点只能驳回，不能审批通过。" />}
          <Field label="审批意见"><textarea value={comment} onChange={(e) => setComment(e.target.value)} className={cn(inputClass, 'h-24 py-3 leading-6')} /></Field>
          <FeedbackNotice tone="info" message="签字由当前登录账号和办理时间自动形成电子审批记录。后续办理人可查看本节点提交的全部信息。" />
          <WorkflowTaskOperations taskId={task.taskId} disabled={busy} onTransferred={onClose} onBusyChange={setOperationBusy} />
        </div>

        <footer className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/70 p-4">
          <ActionButton icon={XCircle} tone="red" size="md" disabled={busy || operationBusy} onClick={() => onComplete('reject')}>驳回</ActionButton>
          <PrimaryActionButton icon={CheckCircle2} size="md" flushTop busy={busy} pendingLabel="提交中" disabled={operationBusy || !form || !complete || argumentationRejected} onClick={() => onComplete('approve')}>审批通过并签字</PrimaryActionButton>
        </footer>
      </section>
    </div>
  );
}

function AiReviewPanel({
  result, busy, error, metrics, feedbackState, disabled, onReview, onUseComment, onFeedback,
}: {
  result?: LudongAiReviewResult;
  busy: boolean;
  error: string;
  metrics?: LudongAiReviewMetrics;
  feedbackState: Record<string, 'adopted' | 'false_positive'>;
  disabled: boolean;
  onReview: () => void;
  onUseComment: (value: string) => void;
  onFeedback: (findingId: string, disposition: 'adopted' | 'false_positive') => void;
}) {
  const modeLabel = result?.analysisMode === 'AI_MODEL'
    ? '大模型评审'
    : result?.analysisMode === 'RULE_FALLBACK'
      ? '规则模型兜底'
      : '采购规则模型';
  return (
    <SectionCard title="AI 辅助评审（校内制度依据）" icon={Sparkles} className="border-blue-200 bg-blue-50/30 shadow-none">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-blue-100 pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={result ? modeLabel : '待生成'} />
            {result && <span className="text-[11px] font-black text-slate-400">置信度 {result.confidence}% · {result.modelName}</span>}
          </div>
          <p className="mt-2 max-w-3xl text-xs font-bold leading-5 text-slate-500">
            依据学校已导入的采购管理办法及配套制度，结合当前项目材料和前序审批记录进行辅助研判。结果不代替审批人决策。
          </p>
        </div>
        <PrimaryActionButton
          icon={result ? RefreshCw : Bot}
          flushTop
          disabled={disabled}
          busy={busy}
          pendingLabel="分析中"
          onClick={onReview}
        >{result ? '重新评审' : '开始 AI 评审'}</PrimaryActionButton>
      </div>

      {error && <div className="mt-4"><FeedbackNotice tone="error" message={error} /></div>}
      {!result && !error && (
        <div className="flex min-h-32 items-center justify-center py-6 text-center">
          <div><Bot size={28} className="mx-auto text-blue-300" /><p className="mt-3 text-sm font-black text-slate-600">点击生成当前节点的辅助评审</p><p className="mt-1 text-xs font-bold text-slate-400">会随本节点表单修改重新分析</p></div>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.65fr)]">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><StatusPill label={result.recommendation} /><span className="text-xs font-black text-slate-500">{result.nodeName}</span></div>
              <p className="mt-3 text-sm font-bold leading-6 text-slate-700">{result.summary}</p>
            </div>
            <div className="border-l-0 border-blue-100 lg:border-l lg:pl-4">
              <p className="text-xs font-black text-slate-700">当前节点评审重点</p>
              <div className="mt-2 flex flex-wrap gap-2">{result.reviewFocus.map((focus) => <span key={focus} className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-black text-blue-700 shadow-sm ring-1 ring-blue-100">{focus}</span>)}</div>
            </div>
          </div>

          <div className="rounded-lg border border-blue-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><BookOpenCheck size={16} /></span>
                  <div>
                    <p className="text-xs font-black text-slate-800">{result.institutionalBasis || '鲁东大学校内采购制度知识库'}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">制度库版本 {result.knowledgeVersion}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(result.institutionalDocuments?.length ? result.institutionalDocuments : [
                    '鲁东大学采购管理办法及配套制度', '货物类采购申请表', '采购需求表（货物类）',
                  ]).map((source) => (
                    <span key={source} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">{source}</span>
                  ))}
                </div>
              </div>
              <div className="text-right text-[11px] font-bold leading-5 text-slate-400">
                <p>{result.modelName}</p>
                <p>{new Date(result.generatedAt).toLocaleString('zh-CN')}</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5 border-t border-slate-100 pt-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <p className="text-[11px] font-bold leading-5 text-slate-500">
                {result.evidenceBoundary || '仅使用学校已导入的采购制度、当前项目材料和前序审批记录；不使用互联网搜索或第三方信息形成审批意见。'}
                每条结论均展示命中的校内制度和项目字段，未被校内制度覆盖的事项只提示人工核验。
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {result.findings.map((finding) => (
              <AiFinding
                key={finding.findingId}
                finding={finding}
                feedback={feedbackState[finding.findingId]}
                onFeedback={onFeedback}
              />
            ))}
          </div>

          {result.missingMaterials.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <TriangleAlert size={17} className="mt-0.5 shrink-0 text-amber-600" />
              <div className="min-w-0"><p className="text-xs font-black text-amber-800">建议补充或确认的材料</p><p className="mt-1 text-xs font-bold leading-5 text-amber-700">{result.missingMaterials.join('、')}</p></div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
            <p className="min-w-0 flex-1 text-xs font-bold leading-5 text-slate-500"><b className="text-slate-700">建议意见：</b>{result.suggestedComment}</p>
            <ActionButton icon={WandSparkles} tone="blue" onClick={() => onUseComment(result.suggestedComment)}>采用建议意见</ActionButton>
          </div>
          <AiQualityMetrics metrics={metrics} accuracyNotice={result.accuracyNotice} />
        </div>
      )}
    </SectionCard>
  );
}

function AiFinding({
  finding, feedback, onFeedback,
}: {
  finding: LudongAiReviewFinding;
  feedback?: 'adopted' | 'false_positive';
  onFeedback: (findingId: string, disposition: 'adopted' | 'false_positive') => void;
}) {
  const meta = finding.level === 'risk'
    ? { label: '风险', icon: XCircle, iconClass: 'bg-red-50 text-red-600', labelClass: 'text-red-700' }
    : finding.level === 'warning'
      ? { label: '复核', icon: TriangleAlert, iconClass: 'bg-amber-50 text-amber-600', labelClass: 'text-amber-700' }
      : { label: '通过', icon: CheckCircle2, iconClass: 'bg-emerald-50 text-emerald-600', labelClass: 'text-emerald-700' };
  const Icon = meta.icon;
  const groups = [
    { type: 'FIELD', label: '关联字段' },
    { type: 'RULE', label: '校内制度条款' },
    { type: 'PRIOR_APPROVAL', label: '前序审批' },
  ] as const;
  return (
    <div className="flex min-w-0 items-start gap-3 p-3.5">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.iconClass}`}><Icon size={15} /></span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black text-slate-800">{finding.title}</p><span className={`text-[10px] font-black ${meta.labelClass}`}>{meta.label}</span></div>
        <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{finding.detail}</p>
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          {groups.map((group) => {
            const references = finding.evidenceReferences.filter((reference) => reference.type === group.type);
            if (!references.length) return null;
            return <div key={group.type} className="rounded-md border border-slate-100 bg-slate-50 p-2.5"><p className="text-[10px] font-black text-slate-500">{group.label}</p>{references.map((reference) => <div key={reference.id} className="mt-1.5"><p className="text-[11px] font-black text-slate-700">{reference.label}</p><p className="mt-0.5 text-[10px] font-bold leading-4 text-slate-500">{reference.value}</p><p className="mt-0.5 text-[9px] font-bold text-slate-400">{reference.source}</p></div>)}</div>;
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ActionButton icon={ThumbsUp} tone="blue" onClick={() => onFeedback(finding.findingId, 'adopted')}>{feedback === 'adopted' ? '已采纳' : '采纳结论'}</ActionButton>
          <ActionButton icon={Flag} tone="red" onClick={() => onFeedback(finding.findingId, 'false_positive')}>{feedback === 'false_positive' ? '已标记误报' : '标记误报'}</ActionButton>
        </div>
      </div>
    </div>
  );
}

function AiQualityMetrics({
  metrics, accuracyNotice,
}: {
  metrics?: LudongAiReviewMetrics;
  accuracyNotice: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black text-slate-800">AI 质量验证</p><p className="mt-1 text-[11px] font-bold text-slate-500">固定样本与人工反馈分开统计，不以置信度代替准确率。</p></div>
        {metrics && <span className="text-[10px] font-black text-slate-400">{metrics.datasetVersion}</span>}
      </div>
      {metrics && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="固定样本" value={`${metrics.fixedSampleCount} 个`} />
        <Metric label="风险召回" value={`${Math.round(metrics.riskRecall * 100)}%`} />
        <Metric label="误报数量" value={`${metrics.falsePositiveCount} 项`} />
        <Metric label="人工采纳率" value={metrics.humanFeedbackCount ? `${Math.round(metrics.adoptionRate * 100)}%` : '待积累'} />
      </div>}
      <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-bold leading-4 text-slate-500">{accuracyNotice}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold text-slate-400">{label}</p><p className="mt-1 text-sm font-black text-slate-800">{value}</p></div>;
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

function TaskField({ field, value, onChange }: { field: FieldDefinition; value: unknown; onChange: (value: string) => void }) {
  const control = field.type === 'select'
    ? <select className={inputClass} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}><option value="">请选择</option>{field.options?.map((option) => <option key={option}>{option}</option>)}</select>
    : field.type === 'textarea'
      ? <textarea className={cn(inputClass, 'h-24 py-3 leading-6')} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      : <input className={inputClass} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
  return <Field label={field.label} required={field.required} className={field.type === 'textarea' ? 'md:col-span-2' : undefined}>{control}</Field>;
}

function Field({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={cn('block', className)}><span className="mb-2 block text-xs font-black text-slate-700">{label}{required && <b className="ml-1 text-red-500">*</b>}</span>{children}</label>;
}
