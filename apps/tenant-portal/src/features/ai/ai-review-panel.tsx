import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History, RefreshCw, Sparkles, X } from 'lucide-react';
import { FeedbackNotice } from '@24bid/ui';
import { createAiReview, getAiReview, listAiReviews, saveAiFeedback, type AiDisposition, type AiReviewRun, type AiSubjectType } from '@24bid/api-client/ai-reviews';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const labels: Record<AiSubjectType, string> = { demand: '需求', attachment: '文件', supplier: '供应商', procurement_risk: '采购风险' };
const button = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-50';
const errorText = (error: unknown) => (error as { response?: { data?: { message?: string } } })?.response?.data?.message || '评审操作失败，请检查权限或刷新后重试。';
const modeLabel = (mode: string) => ({ RULE_ASSISTED: '本地规则评审', RULE_FALLBACK: '模型不可用 · 规则回退', AI_MODEL: '模型辅助评审', rules: '本地规则评审', fallback: '模型不可用 · 规则回退', model: '模型辅助评审' }[mode] ?? mode);
const display = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value) ?? '—';

export function AiReviewPanel({ subjectType, subjectId, onClose }: { subjectType: AiSubjectType; subjectId: string; onClose: () => void }) {
  const { can } = useBuyerPermissions();
  const client = useQueryClient();
  const dialog = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [created, setCreated] = useState<AiReviewRun>();
  const [comment, setComment] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const key = ['/api/v1/buyer/ai/reviews', subjectType, subjectId];
  const history = useQuery({ queryKey: key, queryFn: ({ signal }) => listAiReviews(subjectType, subjectId, signal), retry: false });
  const detail = useQuery({ queryKey: [...key, selectedId], queryFn: ({ signal }) => getAiReview(selectedId!, signal), enabled: !!selectedId, retry: false });
  const run = history.isError ? undefined : selectedId ? (!detail.isError ? detail.data : undefined) : created;
  const generate = useMutation({ mutationFn: () => createAiReview(subjectType, subjectId), onMutate: () => { setCreated(undefined); setSelectedId(undefined); setComment(''); setFeedbackMessage(''); }, onSuccess: result => { setCreated(result); setSelectedId(undefined); void client.invalidateQueries({ queryKey: key }); } });
  const feedback = useMutation({ mutationFn: ({ runId, findingId, disposition, comment: submittedComment }: { runId: string; findingId: string; disposition: AiDisposition; comment: string }) => saveAiFeedback(runId, { findingId, disposition, comment: submittedComment }), onSuccess: (_, submitted) => { setComment(''); setFeedbackMessage('处理反馈已记录，未改变业务审批结果。'); void client.invalidateQueries({ queryKey: key }); setSelectedId(submitted.runId); } });
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="ai-review-title" className="m-auto max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
    <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
      <h2 id="ai-review-title" className="flex items-center gap-2 text-lg font-bold"><Sparkles className="text-blue-600" size={20} />{labels[subjectType]}AI辅助评审</h2>
      <div className="flex items-center gap-2">{can('buyer:ai:use') && <button className={button} disabled={generate.isPending || feedback.isPending} onClick={() => generate.mutate()}><RefreshCw size={15} />{generate.isPending ? '评审中…' : '重新评审当前数据'}</button>}<button type="button" aria-label="关闭评审" title="关闭评审" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-slate-100"><X size={18} /></button></div>
    </header>
    <div className="space-y-4 p-5">
      <FeedbackNotice tone="info" message="AI仅辅助核查，不代替人工判断、审批、签署或定标。历史结果基于生成时的数据快照；业务变更后请重新评审。" />
      {(generate.isError || feedback.isError) && <FeedbackNotice tone="error" message={errorText(generate.error || feedback.error)} />}
      {feedbackMessage && <FeedbackNotice tone="success" message={feedbackMessage} />}
      <label className="flex flex-wrap items-center gap-2 text-sm font-bold"><History size={16} />评审历史<select aria-label="评审历史" disabled={feedback.isPending || generate.isPending} className="min-w-0 max-w-full rounded-md border border-slate-200 p-2 font-normal" value={selectedId ?? ''} onChange={event => { setSelectedId(event.target.value || undefined); setComment(''); setFeedbackMessage(''); }}><option value="">{created ? '本次生成结果' : '请选择历史记录'}</option>{!history.isError && (history.data ?? []).map(item => <option key={item.runId} value={item.runId}>{new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false })} · {modeLabel(item.mode)}</option>)}</select></label>
      {history.isError ? <FeedbackNotice tone="error" message="评审历史加载失败，请重试。" /> : history.isPending ? <p role="status" className="text-sm text-slate-500">正在加载历史…</p> : !history.data?.length && !created ? <p className="py-6 text-center text-sm text-slate-500">暂无评审记录{can('buyer:ai:use') ? '，可评审当前业务数据。' : '。'}</p> : null}
      {detail.isError && <FeedbackNotice tone="error" message={errorText(detail.error)} />}
      {selectedId && detail.isPending && <p role="status" className="text-sm text-slate-500">正在加载评审详情…</p>}
      {run && <>
        <div className="border-y border-slate-200 py-4"><p className="text-sm font-bold text-blue-800">{modeLabel(run.mode)}{run.model ? ` · ${run.model}` : ''}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{run.summary}</p><p className="mt-2 break-all text-xs text-slate-500">规则版本 {run.rulesetVersion} · 数据版本 {run.sourceRevision}</p>{run.fallbackReason && <p className="mt-2 text-xs text-amber-800">{run.mode === 'RULE_FALLBACK' || run.mode === 'fallback' ? '回退原因' : '模型状态'}：{run.fallbackReason}</p>}</div>
        <section aria-label="核查结论"><h3 className="font-bold">核查结论</h3><div className="mt-3 space-y-3">{run.findings.map(finding => <article key={finding.id} className="rounded-md border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-slate-100 px-2 py-1 text-xs">{finding.severity}</span><h4 className="text-sm font-bold">{finding.title}</h4></div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{finding.detail}</p><ul className="mt-2 space-y-2 text-xs text-slate-600">{finding.evidenceIds.map(id => { const evidence = run.evidence.find(item => item.id === id); return <li key={id} className="break-words border-l-2 border-blue-200 pl-3">{evidence ? <><strong>{evidence.label}</strong>：{display(evidence.value)}<span className="mt-1 block break-all text-slate-500">{evidence.kind} · {evidence.locator}{evidence.policyVersion ? ` · 制度版本 ${evidence.policyVersion}` : ''}{evidence.sourceHash ? ` · SHA256 ${evidence.sourceHash}` : ''}</span></> : '证据未提供，需人工复核'}</li>; })}</ul>{can('buyer:ai:use') && <div className="mt-3 flex flex-wrap gap-2">{([['adopted', '采纳建议'], ['dismissed', '不采纳'], ['needs_review', '待复核']] as const).map(([disposition, label]) => <button key={disposition} className={button} disabled={feedback.isPending || generate.isPending} onClick={() => feedback.mutate({ runId: run.runId, findingId: finding.id, disposition, comment: comment.trim() })}>{disposition === 'adopted' && <Check size={13} />}{label}</button>)}</div>}</article>)}{run.findings.length === 0 && <p className="text-sm text-slate-500">未生成核查结论，不代表业务无风险。</p>}</div></section>
        {run.evidence.some(item => item.kind === 'POLICY') && <section className="border-t border-slate-200 pt-4"><h3 className="text-sm font-bold">制度参考依据（适用性由人工核对）</h3><ul className="mt-3 space-y-3">{run.evidence.filter(item => item.kind === 'POLICY').map(item => <li key={item.id} className="border-l-2 border-blue-200 pl-3"><h4 className="text-sm font-bold">{item.label}</h4><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{display(item.value)}</p><p className="mt-1 break-all text-xs text-slate-500">{item.policyVersion} · {item.locator} · SHA256 {item.sourceHash}</p></li>)}</ul></section>}
        {can('buyer:ai:use') && <label className="block text-sm font-bold">反馈说明<textarea aria-label="反馈说明" disabled={feedback.isPending} maxLength={1000} value={comment} onChange={event => setComment(event.target.value)} className="mt-2 block w-full rounded-md border border-slate-200 p-2 font-normal" /></label>}
        {!!run.feedback?.length && <section><h3 className="text-sm font-bold">处理反馈</h3><ul className="mt-2 space-y-2 text-xs text-slate-600">{run.feedback.map((item, index) => <li key={index} className="break-words">{item.findingId} · {({ adopted: '已采纳', dismissed: '未采纳', needs_review: '待复核' })[item.disposition]} · {item.comment || '无补充说明'} · {item.createdBy}</li>)}</ul></section>}
        {!!run.limitations.length && <section className="border-t border-slate-200 pt-4"><h3 className="text-sm font-bold text-amber-800">未评估事项与边界</h3><ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-slate-600">{run.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></section>}
      </>}
    </div>
  </dialog>;
}
