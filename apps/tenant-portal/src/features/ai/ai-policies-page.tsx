import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Plus, Trash2 } from 'lucide-react';
import { FeedbackNotice, Pagination } from '@24bid/ui';
import { createAiPolicy, listAiPolicies, transitionAiPolicy, type AiPolicyDraft, type AiPolicyVersion, type AiSubjectType } from '@24bid/api-client/ai-reviews';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const key = ['/api/v1/buyer/ai/policies'];
const input = 'mt-2 block w-full rounded-md border border-slate-200 bg-white p-2 text-sm font-normal';
const button = 'inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50';
const subjects: [AiSubjectType, string][] = [['demand', '采购需求'], ['attachment', '文件审查'], ['supplier', '供应商'], ['procurement_risk', '采购风险']];
const status = { draft: '草稿', published: '已发布', retired: '已停用' };
const empty = (): AiPolicyDraft => ({ policyKey: '', title: '', subjectTypes: ['demand'], clauses: [{ id: 'clause_1', title: '', text: '' }], expectedLatestVersion: 0 });
const errorText = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '操作失败，请刷新核对制度版本后重试。';

export function AiPoliciesPage() {
  const { can } = useBuyerPermissions();
  const allowed = can('buyer:ai:manage');
  const client = useQueryClient();
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => listAiPolicies(signal), enabled: allowed, retry: false });
  const [view, setView] = useState<'list' | 'create'>('list');
  const [selected, setSelected] = useState<AiPolicyVersion>();
  const [draft, setDraft] = useState<AiPolicyDraft>(empty);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState('');
  const rows = query.isError ? [] : query.data ?? [];
  const refresh = () => { void client.invalidateQueries({ queryKey: key }); };
  const create = useMutation({ mutationFn: () => createAiPolicy({
    ...draft, title: draft.title.trim(), policyKey: draft.policyKey.trim(),
    clauses: draft.clauses.map(clause => ({ id: clause.id.trim(), title: clause.title.trim(), text: clause.text.trim() })),
  }), onSuccess: () => { setView('list'); setSelected(undefined); setDraft(empty()); setNotice('新版本草稿已保存，发布后用于后续辅助评审；历史快照不变。'); setPage(1); refresh(); } });
  const transition = useMutation({ mutationFn: ({ id, action }: { id: string; action: 'publish' | 'retire' }) => transitionAiPolicy(id, action), onSuccess: (_, variables) => { setSelected(undefined); setNotice(variables.action === 'publish' ? '制度版本已发布。' : '制度版本已停用，既有评审依据不变。'); refresh(); } });
  if (!allowed) return <FeedbackNotice tone="error" message="当前账号无制度依据管理权限。" />;
  const busy = create.isPending || transition.isPending;
  const valid = draft.policyKey.trim() && draft.title.trim() && draft.subjectTypes.length > 0 && draft.clauses.every(clause => clause.id.trim() && clause.title.trim() && clause.text.trim());
  const latest = (policyKey: string) => Math.max(0, ...rows.filter(row => row.policyKey === policyKey).map(row => row.version));
  const start = (policy?: AiPolicyVersion) => {
    setDraft(policy ? { policyKey: policy.policyKey, title: policy.title, subjectTypes: [...policy.subjectTypes], clauses: policy.clauses.map(clause => ({ ...clause })), expectedLatestVersion: latest(policy.policyKey) } : empty());
    setSelected(undefined); setView('create'); setNotice(''); create.reset(); transition.reset();
  };
  const back = () => { setView('list'); setSelected(undefined); create.reset(); };
  const updateClause = (index: number, field: 'id' | 'title' | 'text', value: string) => setDraft(current => ({ ...current, clauses: current.clauses.map((clause, i) => i === index ? { ...clause, [field]: value } : clause) }));
  const current = Math.min(page, Math.max(1, Math.ceil(rows.length / 10)));
  return <div className="mx-auto max-w-7xl space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><BookOpen size={22} className="text-blue-600" />AI制度依据</h2>
      <div className="flex flex-wrap gap-2">{(view !== 'list' || selected) && <button className={button} disabled={busy} onClick={back}><ArrowLeft size={16} />返回列表</button>}<button className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50" disabled={busy || query.isError || query.isPending} onClick={() => start()}><Plus size={16} />新增制度版本</button></div>
    </header>
    {notice && <FeedbackNotice tone="success" message={notice} />}
    {query.isError && <FeedbackNotice tone="error" message="制度版本加载失败，请重试。" />}
    {transition.isError && <FeedbackNotice tone="error" message={errorText(transition.error)} />}
    {view === 'create' ? <form className="space-y-5 rounded-lg border border-slate-200 bg-white p-5" onSubmit={event => { event.preventDefault(); if (!busy && valid) create.mutate(); }}>
      <fieldset disabled={busy} className="space-y-5">
      <h3 className="font-bold">新增制度版本 · 基于版本 {draft.expectedLatestVersion}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-slate-700">制度编号<span className="ml-1 text-red-600">*</span><input aria-label="制度编号" required pattern="(?:[a-zA-Z0-9_]|-){1,80}" maxLength={80} value={draft.policyKey} onChange={event => setDraft({ ...draft, policyKey: event.target.value, expectedLatestVersion: latest(event.target.value) })} className={input} /></label>
        <label className="text-sm font-bold text-slate-700">制度名称<span className="ml-1 text-red-600">*</span><input aria-label="制度名称" required maxLength={200} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} className={input} /></label>
      </div>
      <fieldset><legend className="text-sm font-bold text-slate-700">适用业务<span className="ml-1 text-red-600">*</span></legend><div className="mt-2 flex flex-wrap gap-4">{subjects.map(([type, label]) => <label key={type} className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.subjectTypes.includes(type)} onChange={event => setDraft({ ...draft, subjectTypes: event.target.checked ? [...draft.subjectTypes, type] : draft.subjectTypes.filter(value => value !== type) })} />{label}</label>)}</div></fieldset>
      <section aria-label="制度条款" className="space-y-4 border-t border-slate-200 pt-4">
        {draft.clauses.map((clause, index) => <div key={index} className="space-y-3 border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between gap-2"><h4 className="text-sm font-bold">条款 {index + 1}</h4><button type="button" title="移除条款" aria-label={`移除条款 ${index + 1}`} className={button} disabled={draft.clauses.length <= 1 || busy} onClick={() => setDraft({ ...draft, clauses: draft.clauses.filter((_, i) => i !== index) })}><Trash2 size={15} /></button></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">条款编号<span className="ml-1 text-red-600">*</span><input aria-label={`条款编号 ${index + 1}`} required pattern="(?:[a-zA-Z0-9_]|-){1,80}" maxLength={80} value={clause.id} onChange={event => updateClause(index, 'id', event.target.value)} className={input} /></label><label className="text-sm font-bold">条款标题<span className="ml-1 text-red-600">*</span><input aria-label={`条款标题 ${index + 1}`} required maxLength={200} value={clause.title} onChange={event => updateClause(index, 'title', event.target.value)} className={input} /></label></div>
          <label className="block text-sm font-bold">条款正文<span className="ml-1 text-red-600">*</span><textarea aria-label={`条款正文 ${index + 1}`} required maxLength={4000} rows={5} value={clause.text} onChange={event => updateClause(index, 'text', event.target.value)} className={input} /></label>
        </div>)}
        <button type="button" className={button} disabled={draft.clauses.length >= 50 || busy} onClick={() => setDraft({ ...draft, clauses: [...draft.clauses, { id: '', title: '', text: '' }] })}><Plus size={15} />添加条款</button>
      </section>
      <FeedbackNotice tone="info" message="请录入经确认有效的企业制度。草稿发布后才用于后续评审，不覆盖历史依据，也不自动修改审批规则。" />
      {create.isError && <FeedbackNotice tone="error" message={errorText(create.error)} />}
      <div className="flex justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={back}>取消</button><button type="submit" disabled={busy || !valid} className="h-9 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">{create.isPending ? '保存中…' : '保存新版本'}</button></div>
      </fieldset>
    </form> : selected && !query.isError ? <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-bold">{selected.title}</h3><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => start(selected)}>基于此版本新建</button>{selected.status === 'draft' && <button className={button} disabled={busy || selected.version !== latest(selected.policyKey)} onClick={() => transition.mutate({ id: selected.id, action: 'publish' })}>发布</button>}{selected.status !== 'retired' && <button className={button} disabled={busy} onClick={() => transition.mutate({ id: selected.id, action: 'retire' })}>停用</button>}</div></div>
      <dl className="mt-3 grid gap-3 border-b border-slate-200 pb-4 text-sm sm:grid-cols-2">{[['制度编号', selected.policyKey], ['制度版本', selected.version], ['状态', status[selected.status]], ['适用业务', subjects.filter(([type]) => selected.subjectTypes.includes(type)).map(([, label]) => label).join('、')], ['登记时间', new Date(selected.createdAt).toLocaleString('zh-CN', { hour12: false })], ['登记人', selected.createdBy]].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-all">{value}</dd></div>)}</dl>
      <div className="mt-4 space-y-4">{selected.clauses.map(clause => <section key={clause.id}><h4 className="text-sm font-bold">{clause.id} · {clause.title}</h4><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{clause.text}</p></section>)}</div><p className="mt-4 break-all border-t border-slate-200 pt-3 text-xs text-slate-500">SHA256 {selected.sourceHash}</p>
    </section> : <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
      <div className="overflow-x-auto rounded-md border border-slate-200"><table className="w-full min-w-[640px] table-fixed text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="w-14 p-3">序号</th><th className="p-3">制度名称</th><th className="w-16 p-3">版本</th><th className="w-20 p-3">状态</th><th className="w-40 p-3">登记时间</th><th className="w-20 p-3 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.slice((current - 1) * 10, current * 10).map((row, index) => <tr key={row.id}><td className="p-3 text-slate-400">{(current - 1) * 10 + index + 1}</td><td className="truncate p-3 font-bold" title={row.title}>{row.title}</td><td className="truncate p-3">{row.version}</td><td className="whitespace-nowrap p-3 text-xs">{status[row.status]}</td><td className="p-3 text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })}</td><td className="p-3 text-right"><button className="whitespace-nowrap text-xs font-bold text-blue-700" aria-label={`查看 ${row.title} 版本 ${row.version}`} onClick={() => setSelected(row)}>详情</button></td></tr>)}{!rows.length && <tr><td colSpan={6} className="p-8 text-center text-slate-500">{query.isPending ? '正在加载制度版本…' : query.isError ? '制度版本不可用' : '尚未登记企业制度'}</td></tr>}</tbody></table></div>
      <Pagination page={current} pageSize={10} total={rows.length} onPageChange={setPage} />
    </section>}
  </div>;
}
