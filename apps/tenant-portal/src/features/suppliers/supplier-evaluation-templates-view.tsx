import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, X } from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import { type EvaluationTemplate, type EvaluationTemplateDraft, createEvaluationTemplate, createEvaluationTemplateVersion, setEvaluationTemplateEnabled, useEvaluationTemplates, evaluationTemplatesKey, evaluationDimensions, validTemplateDraft } from '@24bid/api-client/supplier-evaluation-templates';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const buttonClass = 'inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-blue-700 disabled:opacity-50';
const inputClass = 'mt-1 min-h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm font-normal';
const initialDraft: EvaluationTemplateDraft = { name: '', qualityWeight: 35, deliveryWeight: 30, priceWeight: 20, serviceWeight: 15 };

export function SupplierEvaluationTemplatesView() {
  const { can } = useBuyerPermissions();
  const canRead = can('buyer:supplier:read'), canManage = can('buyer:supplier:manage');
  const templates = useEvaluationTemplates(canRead);
  const client = useQueryClient();
  const [editing, setEditing] = useState<{ templateId?: string; draft: EvaluationTemplateDraft }>();
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const refresh = () => client.invalidateQueries({ queryKey: evaluationTemplatesKey });
  const save = useMutation({ mutationFn: ({ templateId, draft }: { templateId?: string; draft: EvaluationTemplateDraft }) => templateId ? createEvaluationTemplateVersion(templateId, draft) : createEvaluationTemplate(draft),
    onSuccess: async () => { setEditing(undefined); setNotice('模板已保存。'); await refresh(); }, onSettled: () => { lock.current = false; } });
  const toggle = useMutation({ mutationFn: (template: EvaluationTemplate) => setEvaluationTemplateEnabled(template.templateId, !template.enabled), onSuccess: async () => { setNotice('模板状态已更新。'); await refresh(); }, onSettled: () => { lock.current = false; } });
  const busy = save.isPending || toggle.isPending;
  const groups = new Map<string, EvaluationTemplate[]>();
  for (const template of templates.isError ? [] : templates.data?.data ?? []) groups.set(template.templateId, [...(groups.get(template.templateId) ?? []), template]);
  const total = editing ? evaluationDimensions.reduce((sum, d) => sum + editing.draft[d.weight], 0) : 0;
  const start = (template?: EvaluationTemplate) => {
    setNotice(''); save.reset(); toggle.reset();
    setEditing({ templateId: template?.templateId, draft: template ? { name: template.name, qualityWeight: template.qualityWeight, deliveryWeight: template.deliveryWeight, priceWeight: template.priceWeight, serviceWeight: template.serviceWeight } : { ...initialDraft } });
  };
  if (!canRead) return null;
  return <section className="min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
      <h2 className="text-base font-black text-slate-900">考核模板</h2>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={busy || templates.isFetching} onClick={() => void templates.refetch()}><RefreshCw size={15} />刷新</button>
        {canManage && <button type="button" className={buttonClass} disabled={busy} onClick={() => start()}><Plus size={15} />新建模板</button>}</div>
    </header>
    {notice && <div className="mt-3"><FeedbackNotice tone="success" message={notice} /></div>}
    {toggle.isError && <div className="mt-3"><FeedbackNotice tone="error" message="状态更新失败，请重试。" /></div>}
    {templates.isError && <div className="mt-3"><FeedbackNotice tone="error" message="模板加载失败，请刷新后重试。" /></div>}
    {editing && canManage && <form className="my-4 border-y border-slate-200 py-4" onSubmit={event => {
      event.preventDefault(); if (!validTemplateDraft(editing.draft) || busy || lock.current || templates.isError) return;
      lock.current = true; save.mutate({ ...editing, draft: { ...editing.draft, name: editing.draft.name.trim() } });
    }}>
      <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">{editing.templateId ? '新建版本' : '新建模板'}</h3><button type="button" title="取消编辑" aria-label="取消编辑模板" disabled={busy} onClick={() => setEditing(undefined)} className="p-2"><X size={16} /></button></div>
      <fieldset disabled={busy} className="grid min-w-0 gap-3 sm:grid-cols-4">
        <label className="min-w-0 text-xs font-bold text-slate-600 sm:col-span-4">模板名称<input aria-label="模板名称" required maxLength={200} value={editing.draft.name} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, name: e.target.value } })} className={inputClass} /></label>
        {evaluationDimensions.map(d => <label key={d.weight} className="min-w-0 text-xs font-bold text-slate-600">{d.label}权重（%）<input aria-label={`${d.label}权重`} type="number" min={0} max={100} step="any" required value={Number.isNaN(editing.draft[d.weight]) ? '' : editing.draft[d.weight]} onChange={e => setEditing({ ...editing, draft: { ...editing.draft, [d.weight]: e.target.value === '' ? NaN : Number(e.target.value) } })} className={inputClass} /></label>)}
      </fieldset>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className={`text-xs ${Math.abs(total - 100) <= Number.EPSILON * 400 ? 'text-slate-500' : 'text-red-700'}`}>权重合计 {Number.isFinite(total) ? total : '—'}% / 100%</p><button type="submit" className={buttonClass} disabled={!validTemplateDraft(editing.draft) || busy || templates.isError}>{save.isPending ? '保存中…' : '保存模板'}</button></div>
      {save.isError && <div className="mt-3"><FeedbackNotice tone="error" message="保存失败，填写内容已保留，请重试。" /></div>}
    </form>}
    {templates.isPending ? <p className="py-6 text-sm text-slate-500">正在加载模板…</p> : !templates.isError && groups.size === 0 ? <p className="py-6 text-sm text-slate-500">暂无自定义模板</p> : <div className="divide-y divide-slate-200">{[...groups.entries()].map(([id, versions]) => {
      const sorted = [...versions].sort((a, b) => b.version - a.version), latest = sorted[0];
      return <section key={id} className="min-w-0 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="min-w-0 break-all text-sm font-bold text-slate-900">{latest.name}</h3><div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" role="switch" aria-label={`启用 ${latest.name}`} checked={latest.enabled} disabled={!canManage || busy || templates.isError || templates.isFetching} onChange={() => { if (lock.current || !canManage) return; lock.current = true; setNotice(''); toggle.mutate(latest); }} />{latest.enabled ? '已启用' : '已停用'}</label>
          {canManage && <button type="button" className={buttonClass} disabled={busy || templates.isError} onClick={() => start(latest)}><Plus size={14} />新建版本</button>}
        </div></div>
        <ol className="mt-3 divide-y divide-slate-100">{sorted.map(t => <li key={t.id} className="grid min-w-0 gap-2 py-2 text-xs sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><span className="font-bold">v{t.version}</span><span className="ml-2 break-all text-slate-700">{t.name}</span><p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-slate-500">{evaluationDimensions.map(d => <span key={d.weight}>{d.label} {t[d.weight]}%</span>)}</p></div><time title={t.createdAt} className="break-all text-slate-400">{t.createdAt?.slice(0, 16).replace('T', ' ')}</time>
        </li>)}</ol>
      </section>;
    })}</div>}
  </section>;
}
