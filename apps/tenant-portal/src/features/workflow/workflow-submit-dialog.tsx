import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useWorkflowRuntimePublishedForm } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
import { type FormField, parseForm } from '../process/types';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

export function workflowSubmissionErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  const fallbackMessage = (error as { message?: unknown })?.message;
  const message = typeof responseMessage === 'string'
    ? responseMessage
    : typeof fallbackMessage === 'string'
      ? fallbackMessage
      : '';

  if (message.includes('Initiator department has no active manager configured')) {
    return '当前流程要求“发起部门主管”审批，但发起部门尚未设置主管。请前往“组织与用户”设置部门主管后重试。';
  }
  if (message.includes('Department manager approval requires a business departmentId')) {
    return '当前发起人未关联部门，无法执行“发起部门主管”审批。请联系管理员补齐组织信息后重试。';
  }
  if (message.includes('Supplier admission requires at least one active qualification')) {
    return '供应商缺少有效资质，暂不能提交准入审批。';
  }
  if (message.includes('An active workflow already exists')) {
    return '该业务对象已有进行中的审批，不能重复提交。';
  }
  if (message.includes('Workflow definition exists but no version is published')
    || message.includes('No published workflow')) {
    return '当前业务类型尚未发布可用审批流程，请先在流程定义配置中发布版本。';
  }
  if (message.includes('Only pending supplier relations can be submitted')) {
    return '当前供应商状态已变化，不能重复提交准入。请刷新后重试。';
  }
  return message || '审批提交失败，请检查流程配置和业务数据后重试。';
}

// 业务提交前按已发布定义的表单快照采集动态字段。业务基础数据仍由各自模块维护，
// 这里仅提交给统一工作流门面参与条件判断和审计留档。
export function WorkflowSubmitDialog({
  businessType,
  title,
  busy,
  submissionError,
  onClose,
  onSubmit,
  children,
  initialValues,
}: {
  businessType: string;
  title: string;
  busy?: boolean;
  submissionError?: unknown;
  onClose: () => void;
  onSubmit: (formData: Record<string, unknown>) => void;
  children?: ReactNode;
  initialValues?: Record<string, unknown>;
}) {
  const formQuery = useWorkflowRuntimePublishedForm(businessType);
  const [values, setValues] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const form = parseForm(formQuery.data?.data?.formSchema);
  const message = validationError ?? (attemptedSubmit ? workflowSubmissionErrorMessage(submissionError) : null);

  useEffect(() => {
    setValues(Object.fromEntries(Object.entries(initialValues ?? {}).filter(([, value]) =>
      typeof value === 'string' || typeof value === 'number').map(([key, value]) => [key, String(value)])));
    setValidationError(null);
    setAttemptedSubmit(false);
  }, [businessType, formQuery.data?.data?.definitionVersionId, initialValues]);

  const submit = () => {
    const missing = form.fields.find((field) => field.required && !(values[field.id] ?? '').trim());
    if (missing) {
      setValidationError(`请填写必填字段：${missing.label}`);
      return;
    }
    setValidationError(null);
    setAttemptedSubmit(true);
    onSubmit(Object.fromEntries(Object.entries(values).filter(([key]) => form.fields.some(field => field.id === key))));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={busy ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-label={`提交审批 · ${title}`} className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-black text-slate-950">提交审批 · {title}</h2>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {formQuery.data?.data?.definitionVersionId ? '按当前已发布流程版本填写审批字段。' : '当前将使用系统默认审批版本。'}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="关闭"><X size={18} /></button>
        </div>

        {message && <div className="mt-4" role="alert"><FeedbackNotice tone="error" message={message} /></div>}
        {formQuery.isError && (
          <div className="mt-4">
            <FeedbackNotice tone="error" message="无法读取当前流程表单，请刷新后重试。" />
          </div>
        )}
        {formQuery.isLoading ? (
          <div className="mt-5"><FeedbackNotice tone="info" message="正在读取已发布审批表单…" /></div>
        ) : (
          <div className="mt-5 space-y-4">
            {children}
            {form.fields.map((field) => (
              <WorkflowFormField key={field.id} field={field} value={values[field.id] ?? ''} onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))} />
            ))}
            {form.fields.length === 0 && <p className="text-sm font-bold text-slate-500">该流程未配置额外审批字段，可直接提交。</p>}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50">取消</button>
          <button type="button" onClick={submit} disabled={busy || formQuery.isLoading || formQuery.isError} className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-400">{busy ? '提交中…' : '确认提交'}</button>
        </div>
      </div>
    </div>
  );
}

function WorkflowFormField({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={`workflow-field-${field.id}`} className="mb-1 block text-xs font-black text-slate-600">
        {field.label}{field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea id={`workflow-field-${field.id}`} className={`${inputCls} min-h-24`} placeholder={field.placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : field.type === 'select' ? (
        <select id={`workflow-field-${field.id}`} className={inputCls} value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{field.placeholder || '请选择'}</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input
          id={`workflow-field-${field.id}`}
          className={inputCls}
          type={field.type === 'number' || field.type === 'money' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
