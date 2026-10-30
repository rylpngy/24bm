import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  CreditCard,
  Eye,
  FileText,
  Package,
  Plane,
  Play,
  Plus,
  Rocket,
  Save,
  UserCheck,
  UserPlus,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import {
  type WorkflowProcessDefinition,
  useBuyerRoleList,
  useBuyerUserList,
  useWorkflowProcessDefinition,
  useWorkflowProcessDefinitionCreate,
  useWorkflowProcessDefinitionPublish,
  useWorkflowProcessDefinitionUpdate,
  useWorkflowProcessDefinitionVersions,
  useWorkflowProcessDefinitions,
  workflowRuntimeQueryKeys,
} from '@24bid/api-client';
import { FeedbackNotice, Tabs, cn } from '@24bid/ui';
import { FormDesigner } from './form-designer';
import { FlowDesigner } from './flow-designer';
import { WorkflowAttachmentConfig, type WorkflowAttachmentCategory } from './workflow-attachment-config';
import { resolveProcessListPrimaryAction } from './process-list-action';
import {
  type FlowStep,
  type FormField,
  type ResolvedStep,
  evaluateFlow,
  parseWorkflowDraft,
} from './types';

const BUSINESS_TYPES = [
  { id: 'ludong_project_application', label: '鲁东大学货物类采购申报' },
  { id: 'purchase_demand', label: '采购需求' },
  { id: 'budget_change', label: '预算编制与调整' },
  { id: 'project_initiation', label: '项目立项' },
  { id: 'project_change', label: '立项变更' },
  { id: 'project_carryover', label: '跨年度承接' },
  { id: 'frozen_payment_correction', label: '跨年冻结付款更正' },
  { id: 'funding_change', label: '专项资金与项目分摊' },
  { id: 'project_liquidation', label: '项目终止清算' },
  { id: 'project_reopen', label: '项目及分包受控重开' },
  { id: 'order_settlement', label: '合同解除与订单清算' },
  { id: 'budget_exception', label: '超预算例外' },
  { id: 'supplier_qualification_change', label: '供应商资质变更' },
  { id: 'buyer_supplier_admission', label: '供应商准入' },
  { id: 'buyer_supplier_exit', label: '供应商退出' },
  { id: 'rfq_award', label: '询价定标' },
  { id: 'contract_approval', label: '合同审批' },
  { id: 'payment_request', label: '付款申请' },
  { id: 'payment_batch', label: '付款批次' },
  { id: 'payment_archive_exception', label: '付款归档例外' },
] as const;

const businessTypeLabel = (businessType?: string) =>
  BUSINESS_TYPES.find((item) => item.id === businessType)?.label ?? businessType ?? '未绑定业务类型';

const ICONS: Record<string, React.ElementType> = {
  box: Package,
  'user-plus': UserPlus,
  'file-text': FileText,
  'credit-card': CreditCard,
  plane: Plane,
};

// 流程引擎:流程列表 ↔ 设计器(表单/流程)。
export function ProcessEnginePage({
  fixedBusinessType,
  scopeTitle,
  scopeDescription,
  initialTab = 'form',
  attachmentCatalog,
}: {
  fixedBusinessType?: string;
  scopeTitle?: string;
  scopeDescription?: string;
  initialTab?: 'form' | 'flow';
  attachmentCatalog?: WorkflowAttachmentCategory[];
} = {}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  if (editingId) {
    return <ProcessDesigner id={editingId} initialTab={initialTab} attachmentCatalog={attachmentCatalog} onBack={() => setEditingId(null)} />;
  }
  return (
    <ProcessList
      fixedBusinessType={fixedBusinessType}
      scopeTitle={scopeTitle}
      scopeDescription={scopeDescription}
      onConfigure={setEditingId}
    />
  );
}

function ProcessList({
  fixedBusinessType,
  scopeTitle,
  scopeDescription,
  onConfigure,
}: {
  fixedBusinessType?: string;
  scopeTitle?: string;
  scopeDescription?: string;
  onConfigure: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const list = useWorkflowProcessDefinitions();
  const create = useWorkflowProcessDefinitionCreate();
  const processes = list.data?.data ?? [];
  const scopedProcesses = useMemo(
    () => fixedBusinessType ? processes.filter((process) => process.businessType === fixedBusinessType) : processes,
    [fixedBusinessType, processes],
  );
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>(fixedBusinessType ?? 'purchase_demand');
  const businessType = fixedBusinessType ?? selectedBusinessType;
  const [error, setError] = useState<string | null>(null);
  const primaryAction = useMemo(
    () => resolveProcessListPrimaryAction(processes, businessType),
    [businessType, processes],
  );

  const onNew = () => {
    setError(null);
    create.mutate(
      {
        name: `${businessTypeLabel(businessType)}审批流程`,
        description: '配置表单、节点与受控办理规则后发布为 Flowable 版本。',
        icon: 'file-text',
        businessType,
      },
      {
        onSuccess: (res) => {
          void queryClient.invalidateQueries({ queryKey: workflowRuntimeQueryKeys.processDefinitions });
          if (res.data?.id) onConfigure(res.data.id);
        },
        onError: (value) => setError(
          (value as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? '新建流程失败，请确认当前账号具有流程管理权限。',
        ),
      },
    );
  };

  const onPrimaryAction = () => {
    if (primaryAction.type === 'configure') {
      onConfigure(primaryAction.processId);
      return;
    }
    onNew();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Workflow size={18} className="text-blue-600" /> {scopeTitle ?? '流程定义配置'}
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">
            {scopeDescription ?? '每个业务类型保留一个配置入口，发布后生成不可变版本并部署至 Flowable'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {fixedBusinessType ? (
            <span className="inline-flex h-10 items-center rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700">
              {businessTypeLabel(fixedBusinessType)}
            </span>
          ) : (
            <select
              value={businessType}
              onChange={(event) => setSelectedBusinessType(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300"
            >
              {BUSINESS_TYPES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}{processes.some((process) => process.businessType === item.id) ? '（已配置）' : ''}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryAction.type === 'create' && create.isPending}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
          >
            {primaryAction.type === 'configure' ? <Workflow size={16} /> : <Plus size={16} />}
            {primaryAction.type === 'configure' ? '配置新版本' : '新建流程'}
          </button>
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}
      {list.isError ? (
        <FeedbackNotice tone="error" message="流程定义加载失败，请确认当前账号具有流程管理权限。" />
      ) : list.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载流程…" />
      ) : scopedProcesses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <Workflow className="mx-auto text-slate-300" size={32} />
          <p className="mt-3 text-sm font-black text-slate-800">当前业务尚未建立流程定义</p>
          <p className="mt-1 text-xs font-bold text-slate-400">点击右上角“新建流程”后配置审批节点、办理人和条件分支。</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {scopedProcesses.map((p) => (
            <ProcessCard key={p.id} process={p} onConfigure={() => p.id && onConfigure(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessCard({ process: p, onConfigure }: { process: WorkflowProcessDefinition; onConfigure: () => void }) {
  const Icon = ICONS[p.icon ?? ''] ?? FileText;
  const enabled = p.status === 'enabled';
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/40 transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon size={20} />
        </span>
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-[11px] font-black',
            enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500',
          )}
        >
          {enabled ? '已启用' : '草稿'}
        </span>
      </div>
      <p className="mt-4 text-base font-black text-slate-950">{p.name}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{p.description || '暂无描述'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">
          {businessTypeLabel(p.businessType)}
        </span>
        {p.activeVersionId && (
          <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-500">已发布版本</span>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] font-bold text-slate-400">更新于 {p.updatedAt?.slice(0, 10) ?? '—'}</span>
        <button type="button" onClick={onConfigure} className="text-sm font-black text-blue-600 hover:text-blue-700">
          配置
        </button>
      </div>
    </div>
  );
}

function ProcessDesigner({ id, initialTab, attachmentCatalog, onBack }: { id: string; initialTab: 'form' | 'flow'; attachmentCatalog?: WorkflowAttachmentCategory[]; onBack: () => void }) {
  const queryClient = useQueryClient();
  const detail = useWorkflowProcessDefinition(id);
  const versions = useWorkflowProcessDefinitionVersions(id);
  const users = useBuyerUserList();
  const roles = useBuyerRoleList();
  const update = useWorkflowProcessDefinitionUpdate();
  const publish = useWorkflowProcessDefinitionPublish();
  const [tab, setTab] = useState<'form' | 'flow'>(initialTab);
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [formSettings, setFormSettings] = useState<Record<string, unknown>>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifierRepairNotice, setIdentifierRepairNotice] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const p = detail.data?.data;
  const userList = users.data?.data ?? [];
  const roleList = roles.data?.data ?? [];

  useEffect(() => {
    if (p) {
      const draft = parseWorkflowDraft(p.formSchema, p.flowSchema);
      setFields(draft.fields);
      setSteps(draft.steps);
      try { const {fields: _fields, ...settings} = JSON.parse(p.formSchema || '{}'); setFormSettings(settings); }
      catch { setFormSettings({}); }
      setIdentifierRepairNotice(draft.repairedIdentifiers
        ? '已自动修正旧草稿中的字段或节点编码。保存或发布后会按 Flowable 规则持久化。'
        : null);
    }
  }, [p?.id, p?.formSchema, p?.flowSchema]);

  const invalidateDefinitions = () => {
    void queryClient.invalidateQueries({queryKey: ['ludong-poc']});
    void queryClient.invalidateQueries({ queryKey: workflowRuntimeQueryKeys.processDefinitions });
    void queryClient.invalidateQueries({ queryKey: [...workflowRuntimeQueryKeys.processDefinitions, id] });
    void queryClient.invalidateQueries({ queryKey: [...workflowRuntimeQueryKeys.processDefinitions, id, 'versions'] });
  };

  const errorMessage = (value: unknown) =>
    (value as { response?: { data?: { message?: string } } })?.response?.data?.message
      ?? '流程配置保存失败，请检查字段、条件和办理规则。';

  const draftPayload = () => ({
    name: p?.name ?? '流程',
    description: p?.description ?? '',
    status: 'draft' as const,
    formSchema: JSON.stringify({ ...formSettings, fields }),
    flowSchema: JSON.stringify({ steps }),
    businessType: p?.businessType,
  });

  const save = (label = '草稿已保存') => {
    if (!p) return;
    setError(null);
    update.mutate(
      {
        id,
        data: draftPayload(),
      },
      {
        onSuccess: () => {
          setFeedback(label);
          invalidateDefinitions();
        },
        onError: (value) => setError(errorMessage(value)),
      },
    );
  };

  const publishVersion = () => {
    if (!p) return;
    setError(null);
    update.mutate(
      { id, data: draftPayload() },
      {
        onSuccess: () => publish.mutate(id, {
          onSuccess: () => {
            setFeedback('流程版本已发布并部署到 Flowable。正在办理的实例仍使用原版本。');
            invalidateDefinitions();
          },
          onError: (value) => setError(errorMessage(value)),
        }),
        onError: (value) => setError(errorMessage(value)),
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-950">{p?.name ?? '加载中…'}</p>
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">{businessTypeLabel(p?.businessType)}</p>
        </div>
        <div className="order-3 w-full rounded-lg border border-slate-200 bg-white px-1.5 sm:order-none sm:mx-auto sm:w-auto">
          <Tabs
            items={[
              { id: 'form', label: '表单设计' },
              { id: 'flow', label: '流程设计' },
            ]}
            value={tab}
            onChange={(t) => setTab(t as 'form' | 'flow')}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={!p}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Eye size={14} /> 预览
        </button>
        <button
          type="button"
          onClick={() => save()}
          disabled={update.isPending || publish.isPending || !p}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Save size={14} /> 保存
        </button>
        <button
          type="button"
          onClick={publishVersion}
          disabled={update.isPending || publish.isPending || !p}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Rocket size={14} /> {update.isPending || publish.isPending ? '处理中' : '发布版本'}
        </button>
      </div>

      {feedback && <FeedbackNotice tone="success" message={feedback} />}
      {error && <FeedbackNotice tone="error" message={error} />}
      {identifierRepairNotice && <FeedbackNotice tone="info" message={identifierRepairNotice} />}

      {detail.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载流程定义…" />
      ) : tab === 'form' ? (
        <FormDesigner fields={fields} onChange={setFields} />
      ) : (
        <FlowDesigner
          steps={steps}
          fields={fields}
          users={userList}
          roles={roleList}
          onChange={setSteps}
        />
      )}

      {attachmentCatalog && <WorkflowAttachmentConfig catalog={attachmentCatalog}
        value={formSettings.attachmentCategories as WorkflowAttachmentCategory[] | undefined}
        onChange={(attachmentCategories)=>setFormSettings({...formSettings,attachmentCategories})} />}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">已发布版本</p>
            <p className="mt-1 text-xs font-bold text-slate-400">版本快照不可修改；重新发布会创建新版本，不影响运行中的审批。</p>
          </div>
          {p?.activeVersionId && <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">当前生效</span>}
        </div>
        {versions.isLoading ? (
          <p className="mt-3 text-xs font-bold text-slate-400">正在加载版本…</p>
        ) : (versions.data?.data ?? []).length === 0 ? (
          <p className="mt-3 text-xs font-bold text-slate-400">尚未发布，保存草稿后可进行受控发布。</p>
        ) : (
          <div className="mt-3 divide-y divide-slate-100">
            {(versions.data?.data ?? []).map((version) => (
              <div key={version.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                <span className="font-black text-slate-700">v{version.versionNo} · {version.status === 'published' ? '当前发布' : '已被新版本替代'}</span>
                <span className="font-mono font-bold text-slate-400">{version.publishedAt?.slice(0, 19) ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showPreview && (
        <PreviewModal fields={fields} steps={steps} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}

// 预览/试运行:按表单 schema 渲染可填表单,试运行后按取值求解审批路径。
function PreviewModal({
  fields,
  steps,
  onClose,
}: {
  fields: FormField[];
  steps: FlowStep[];
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ResolvedStep[] | null>(null);
  const set = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));
  const hasSystemContext = flowUsesConditionField(steps, '$amount') || flowUsesConditionField(steps, '$departmentId');
  const inputCls =
    'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-black text-slate-950">预览 · 试运行</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        <p className="mb-2 text-xs font-black text-slate-400">填写表单</p>
        {hasSystemContext && (
          <div className="mb-3 grid gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-black text-blue-700">流程金额</p>
              <input
                className={inputCls}
                type="number"
                placeholder="例如 100000"
                value={values.$amount ?? ''}
                onChange={(event) => set('$amount', event.target.value)}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-black text-blue-700">申请部门 ID</p>
              <input
                className={inputCls}
                placeholder="例如 dept-purchase"
                value={values.$departmentId ?? ''}
                onChange={(event) => set('$departmentId', event.target.value)}
              />
            </div>
          </div>
        )}
        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">表单暂无字段。</p>
          ) : (
            fields.map((f) => (
              <div key={f.id}>
                <p className="mb-1 text-xs font-black text-slate-600">
                  {f.label}{f.required && <span className="ml-1 text-red-500">*</span>}
                </p>
                {f.type === 'textarea' ? (
                  <textarea className={`${inputCls} min-h-[60px]`} placeholder={f.placeholder} value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)} />
                ) : f.type === 'select' ? (
                  <select className={inputCls} value={values[f.id] ?? ''} onChange={(e) => set(f.id, e.target.value)}>
                    <option value="">{f.placeholder || '请选择'}</option>
                    {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className={inputCls}
                    type={f.type === 'number' || f.type === 'money' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                    placeholder={f.placeholder}
                    value={values[f.id] ?? ''}
                    onChange={(e) => set(f.id, e.target.value)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setResult(evaluateFlow(steps, values).path)}
          className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700"
        >
          <Play size={14} /> 试运行,计算审批路径
        </button>

        {result && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="mb-2 text-xs font-black text-slate-500">解析出的审批路径</p>
            <ol className="space-y-2">
              <li className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">起</span>
                发起人
              </li>
              {result.length === 0 ? (
                <li className="pl-8 text-[11px] font-bold text-slate-400">无审批节点,直接结束。</li>
              ) : (
                result.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${r.type === 'auto' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                      {r.type === 'auto' ? <Zap size={12} /> : <UserCheck size={12} />}
                    </span>
                    {r.title}{r.assignee ? ` · ${r.assignee}` : ''}
                  </li>
                ))
              )}
              <li className="flex items-center gap-2 text-xs font-bold text-slate-500">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[11px] font-black text-slate-500">终</span>
                流程结束
              </li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function flowUsesConditionField(steps: FlowStep[], field: string): boolean {
  return steps.some((step) => {
    if (step.type !== 'condition') return false;
    return (step.branches ?? []).some((branch) =>
      branch.condition?.field === field || flowUsesConditionField(branch.steps, field));
  });
}
