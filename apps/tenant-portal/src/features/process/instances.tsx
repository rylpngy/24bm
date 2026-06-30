import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Play, Send, UserCheck, X, XCircle, Zap } from 'lucide-react';
import {
  type ProcessDefinitionResponse,
  type ProcessInstanceResponse,
  useProcessInstanceList,
  useProcessInstanceReview,
  useProcessInstanceStart,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';
import { type FormField, type ResolvedStep, parseForm } from './types';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const STATUS: Record<string, { label: string; cls: string }> = {
  processing: { label: '审批中', cls: 'bg-amber-50 text-amber-600' },
  approved: { label: '已通过', cls: 'bg-emerald-50 text-emerald-600' },
  rejected: { label: '已驳回', cls: 'bg-red-50 text-red-600' },
};

function invalidateInstances(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({
    predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/process-instances'),
  });
}

// 运行实例:选流程 → 发起(填表)/ 实例列表(路径 + 状态 + 审批)。
export function InstancesView({ processes }: { processes: ProcessDefinitionResponse[] }) {
  const enabled = processes.filter((p) => p.status === 'enabled');
  const [processId, setProcessId] = useState<string>(enabled[0]?.id ?? '');
  const [starting, setStarting] = useState(false);
  const current = processes.find((p) => p.id === processId) ?? null;
  const list = useProcessInstanceList(
    { processId },
    { query: { enabled: !!processId } },
  );
  const instances = list.data?.data ?? [];

  if (enabled.length === 0) {
    return <FeedbackNotice tone="info" message="暂无已启用的流程。请先在「流程配置」中发布流程。" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <span className="text-xs font-black text-slate-400">选择流程</span>
        <select className={cn(inputCls, 'max-w-xs')} value={processId} onChange={(e) => setProcessId(e.target.value)}>
          {enabled.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setStarting(true)}
          className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Send size={14} /> 发起实例
        </button>
      </div>

      {list.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载实例…" />
      ) : instances.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm font-bold text-slate-300">
          该流程暂无运行实例,点击「发起实例」开始。
        </div>
      ) : (
        <div className="space-y-3">
          {instances.map((it) => (
            <InstanceCard key={it.id} instance={it} />
          ))}
        </div>
      )}

      {starting && current && (
        <StartModal process={current} onClose={() => setStarting(false)} />
      )}
    </div>
  );
}

function InstanceCard({ instance: it }: { instance: ProcessInstanceResponse }) {
  const qc = useQueryClient();
  const review = useProcessInstanceReview();
  const [comment, setComment] = useState('');
  const path: ResolvedStep[] = safeParse(it.resolvedPath);
  const st = STATUS[it.status ?? ''] ?? { label: it.status ?? '—', cls: 'bg-slate-100 text-slate-500' };
  const idx = it.currentIndex ?? 0;
  const processing = it.status === 'processing';

  const act = (decision: 'approve' | 'reject') =>
    it.id &&
    review.mutate(
      { id: it.id, data: { decision, comment: comment || (decision === 'approve' ? '同意' : '驳回') } },
      { onSuccess: () => invalidateInstances(qc) },
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">{it.processName}</p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">
            发起于 {it.createdAt?.slice(0, 10) ?? '—'}
            {it.amount != null && <> · 金额 ¥{Number(it.amount).toLocaleString()}</>}
          </p>
        </div>
        <span className={cn('rounded-md px-2.5 py-1 text-[11px] font-black', st.cls)}>{st.label}</span>
      </div>

      {path.length > 0 && (
        <ol className="mt-4 flex flex-wrap items-center gap-x-1 gap-y-2">
          <PathChip label="发起人" tone="done" />
          {path.map((r, i) => {
            const tone = it.status === 'rejected' && i === idx ? 'reject' : i < idx || it.status === 'approved' ? 'done' : i === idx ? 'current' : 'todo';
            return (
              <PathChip
                key={i}
                label={`${r.title}${r.assignee ? ` · ${r.assignee}` : ''}`}
                icon={r.type === 'auto' ? 'auto' : 'approver'}
                tone={tone}
              />
            );
          })}
          <PathChip label="结束" tone={it.status === 'approved' ? 'done' : 'todo'} />
        </ol>
      )}

      {processing && (
        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4">
          <input
            className={inputCls}
            placeholder="审批意见(可选)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <button
            type="button"
            disabled={review.isPending}
            onClick={() => act('approve')}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 size={14} /> 通过
          </button>
          <button
            type="button"
            disabled={review.isPending}
            onClick={() => act('reject')}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <XCircle size={14} /> 驳回
          </button>
        </div>
      )}
    </div>
  );
}

function PathChip({
  label,
  icon,
  tone,
}: {
  label: string;
  icon?: 'auto' | 'approver';
  tone: 'done' | 'current' | 'todo' | 'reject';
}) {
  const tones = {
    done: 'bg-emerald-50 text-emerald-600',
    current: 'bg-amber-100 text-amber-700 ring-2 ring-amber-200',
    todo: 'bg-slate-100 text-slate-400',
    reject: 'bg-red-50 text-red-600 ring-2 ring-red-200',
  } as const;
  return (
    <>
      <span className={cn('inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-black', tones[tone])}>
        {icon === 'auto' && <Zap size={11} />}
        {icon === 'approver' && <UserCheck size={11} />}
        {label}
      </span>
      <span className="text-slate-300">›</span>
    </>
  );
}

// 发起实例:渲染流程表单 → 提交建实例(后端解析审批路径并建任务)。
function StartModal({ process, onClose }: { process: ProcessDefinitionResponse; onClose: () => void }) {
  const qc = useQueryClient();
  const start = useProcessInstanceStart();
  const fields = parseForm(process.formSchema).fields;
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const set = (id: string, v: string) => setValues((s) => ({ ...s, [id]: v }));

  const amountField = fields.find((f) => f.type === 'money' || f.type === 'number');
  const amount = amountField ? Number(values[amountField.id]) : undefined;

  const submit = () => {
    const missing = fields.find((f) => f.required && !values[f.id]);
    if (missing) {
      setError(`请填写必填项:${missing.label}`);
      return;
    }
    start.mutate(
      {
        data: {
          processId: process.id!,
          formData: JSON.stringify(values),
          amount: amount != null && !Number.isNaN(amount) ? amount : undefined,
        },
      },
      {
        onSuccess: () => {
          invalidateInstances(qc);
          onClose();
        },
        onError: () => setError('发起失败,请稍后再试。'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-base font-black text-slate-950">发起 · {process.name}</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {error && <div className="mb-3"><FeedbackNotice tone="error" message={error} /></div>}

        <div className="space-y-3">
          {fields.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">该流程暂无表单字段,可直接发起。</p>
          ) : (
            fields.map((f: FormField) => (
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
          onClick={submit}
          disabled={start.isPending}
          className="mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Play size={15} /> {start.isPending ? '发起中…' : '确认发起'}
        </button>
      </div>
    </div>
  );
}

function safeParse(json?: string): ResolvedStep[] {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
