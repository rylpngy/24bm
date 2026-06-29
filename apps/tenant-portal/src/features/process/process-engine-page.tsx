import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  CreditCard,
  FileText,
  Package,
  Plane,
  Plus,
  Save,
  UserPlus,
  Workflow,
} from 'lucide-react';
import {
  type ProcessDefinitionResponse,
  useProcessDefinitionCreate,
  useProcessDefinitionGet,
  useProcessDefinitionList,
  useProcessDefinitionUpdate,
} from '@24bid/api-client';
import { FeedbackNotice, Tabs, cn } from '@24bid/ui';
import { FormDesigner } from './form-designer';
import { FlowDesigner } from './flow-designer';
import { type FlowStep, type FormField, parseFlow, parseForm } from './types';

const ICONS: Record<string, React.ElementType> = {
  box: Package,
  'user-plus': UserPlus,
  'file-text': FileText,
  'credit-card': CreditCard,
  plane: Plane,
};

// 流程引擎:流程列表 ↔ 设计器(表单/流程)。
export function ProcessEnginePage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  if (editingId) {
    return <ProcessDesigner id={editingId} onBack={() => setEditingId(null)} />;
  }
  return <ProcessList onConfigure={setEditingId} />;
}

function ProcessList({ onConfigure }: { onConfigure: (id: string) => void }) {
  const queryClient = useQueryClient();
  const list = useProcessDefinitionList();
  const create = useProcessDefinitionCreate();
  const processes = list.data?.data ?? [];

  const onNew = () =>
    create.mutate(
      { data: { name: `新建流程 ${processes.length + 1}`, description: '点击配置以设计表单与流程', icon: 'file-text' } },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/process-definitions'),
          });
          if (res.data?.id) onConfigure(res.data.id);
        },
      },
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <p className="flex items-center gap-2 text-lg font-black text-slate-950">
            <Workflow size={18} className="text-blue-600" /> 流程引擎
          </p>
          <p className="mt-0.5 text-xs font-bold text-slate-400">可视化配置业务审批流与表单</p>
        </div>
        <button
          type="button"
          onClick={onNew}
          disabled={create.isPending}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:bg-slate-400"
        >
          <Plus size={16} /> 新建流程
        </button>
      </div>

      {list.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载流程…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {processes.map((p) => (
            <ProcessCard key={p.id} process={p} onConfigure={() => p.id && onConfigure(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProcessCard({ process: p, onConfigure }: { process: ProcessDefinitionResponse; onConfigure: () => void }) {
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
      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-3">
        <span className="text-[11px] font-bold text-slate-400">更新于 {p.updatedAt?.slice(0, 10) ?? '—'}</span>
        <button type="button" onClick={onConfigure} className="text-sm font-black text-blue-600 hover:text-blue-700">
          配置
        </button>
      </div>
    </div>
  );
}

function ProcessDesigner({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const detail = useProcessDefinitionGet(id);
  const update = useProcessDefinitionUpdate();
  const [tab, setTab] = useState<'form' | 'flow'>('form');
  const [fields, setFields] = useState<FormField[]>([]);
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const p = detail.data?.data;

  useEffect(() => {
    if (p) {
      setFields(parseForm(p.formSchema).fields);
      setSteps(parseFlow(p.flowSchema).steps);
    }
  }, [p?.id, p?.formSchema, p?.flowSchema]);

  const save = (status: string, label: string) => {
    if (!p) return;
    update.mutate(
      {
        id,
        data: {
          name: p.name ?? '流程',
          description: p.description ?? '',
          status,
          formSchema: JSON.stringify({ fields }),
          flowSchema: JSON.stringify({ steps }),
        },
      },
      {
        onSuccess: () => {
          setFeedback(label);
          queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/process-definitions'),
          });
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <button type="button" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100">
          <ChevronLeft size={18} />
        </button>
        <p className="text-base font-black text-slate-950">{p?.name ?? '加载中…'}</p>
        <div className="mx-auto rounded-lg border border-slate-200 bg-white px-1.5">
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
          onClick={() => save(p?.status ?? 'draft', '已保存')}
          disabled={update.isPending || !p}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <Save size={14} /> 保存
        </button>
        <button
          type="button"
          onClick={() => save('enabled', '流程已发布并启用')}
          disabled={update.isPending || !p}
          className="inline-flex h-9 items-center rounded-lg bg-slate-900 px-4 text-xs font-black text-white hover:bg-slate-800 disabled:bg-slate-400"
        >
          {update.isPending ? '处理中' : '发布流程'}
        </button>
      </div>

      {feedback && <FeedbackNotice tone="success" message={feedback} />}

      {detail.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载流程定义…" />
      ) : tab === 'form' ? (
        <FormDesigner fields={fields} onChange={setFields} />
      ) : (
        <FlowDesigner steps={steps} onChange={setSteps} />
      )}
    </div>
  );
}
