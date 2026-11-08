import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { saveTenderScoringRule, tenderScoringRule, type TenderScoringRuleView, type SaveTenderScoringRule } from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';

export const tenderScoringRuleKey = (id: string) => ['tender-scoring-rule', id];
export function TenderScoringRulePanel({ tenderId, editable }: { tenderId: string; editable: boolean }) {
  const query=useQuery({ queryKey:tenderScoringRuleKey(tenderId),queryFn:()=>tenderScoringRule(tenderId) });
  if(query.isLoading) return <FeedbackNotice tone="info" message="正在读取评分规则…"/>;
  if(query.isError || !query.data?.data) return <FeedbackNotice tone="error" message="评分规则读取失败，请刷新后重试。"/>;
  return <ScoringEditor key={`${tenderId}-${query.data.data.revision}-${query.data.data.evaluationMethod}`} tenderId={tenderId} editable={editable} data={query.data.data}/>;
}
function ScoringEditor({ tenderId, editable, data }: { tenderId:string;editable:boolean;data:TenderScoringRuleView }) {
  const client=useQueryClient();
  const [form,setForm]=useState({technicalWeight:String(data.weights.technical),commercialWeight:String(data.weights.commercial),priceWeight:String(data.weights.price),reason:''});
  const keys=['technicalWeight','commercialWeight','priceWeight'] as const;
  const labels={technicalWeight:'技术权重',commercialWeight:'商务权重',priceWeight:'价格权重'};
  const total=keys.reduce((sum,key)=>sum+Number(form[key]),0);
  const valid=keys.every(key=>form[key].trim()!==''&&Number.isFinite(Number(form[key]))&&Number(form[key])>=0&&Number(form[key])<=100&&/^\d+(\.\d{1,2})?$/.test(form[key]))&&Math.abs(total-100)<0.000001;
  const comprehensive=data.evaluationMethod==='综合评分法';
  const canEdit=editable&&comprehensive;
  const save=useMutation({mutationFn:(body:SaveTenderScoringRule)=>saveTenderScoringRule(tenderId,body),onSuccess:()=>{
    void client.invalidateQueries({queryKey:tenderScoringRuleKey(tenderId)});
    void client.invalidateQueries({queryKey:['tender-document-review',tenderId]});
    void client.invalidateQueries({predicate:q=>typeof q.queryKey[0]==='string'&&q.queryKey[0].includes('/buyer/tenders')});
  }});
  return <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-base font-black text-slate-950">评审规则</h2>
      <span className="text-xs font-bold text-slate-500">{data.evaluationMethod} · {data.revision?`版本 ${data.revision}`:comprehensive?'默认权重 50/20/30':'按有效报价排序'}</span></div>
    <p className="mt-2 text-xs text-slate-600">{comprehensive?`综合得分 = 技术均分×${data.weights.technical}% + 商务均分×${data.weights.commercial}% + 价格分×${data.weights.price}%。价格分按最低有效报价折算。`:'按有效报价从低到高排序，综合权重不参与定标排序。'}</p>
    {comprehensive&&<div className="mt-3 grid gap-3 sm:grid-cols-3">{keys.map(key=><label key={key} className="text-xs font-bold text-slate-600">{labels[key]}（%）
      <input aria-label={labels[key]} type="number" min="0" max="100" step="0.01" value={form[key]} disabled={!canEdit||save.isPending} onChange={e=>setForm({...form,[key]:e.target.value})} className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 disabled:bg-slate-50"/>
    </label>)}</div>}
    {canEdit&&<><p className={`mt-2 text-xs font-bold ${valid?'text-slate-500':'text-red-600'}`} role="status">权重合计：{Number.isFinite(total)?total.toFixed(2):'—'}%，须为100%。</p>
      <label className="mt-3 block text-xs font-bold text-slate-600">编制或调整依据 <span className="text-red-600">*</span>
        <textarea aria-label="编制或调整依据" maxLength={1000} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} className="mt-1 w-full rounded-md border border-slate-200 p-2"/></label>
      <PrimaryActionButton busy={save.isPending} disabled={!valid||!form.reason.trim()} disabledReason="请核对权重合计并填写调整依据" onClick={()=>save.mutate({technicalWeight:Number(form.technicalWeight),commercialWeight:Number(form.commercialWeight),priceWeight:Number(form.priceWeight),reason:form.reason.trim(),expectedRevision:data.revision})}>保存评分规则</PrimaryActionButton>
    </>}
    {!editable&&<p className="mt-2 text-xs font-bold text-slate-500">审查中或已发布的规则不可直接调整。</p>}
    {save.isError&&<FeedbackNotice tone="error" message={(save.error as {response?:{data?:{message?:string}}})?.response?.data?.message??'规则保存失败，请刷新后重试。'}/>}
    {!!data.history.length&&<details className="mt-3 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-bold text-blue-700">规则版本记录（{data.history.length}）</summary>
      <ol className="mt-2 space-y-2 text-xs text-slate-600">{data.history.map(rule=><li key={rule.revision} className="border-b border-slate-100 pb-2"><b>版本 {rule.revision} · {rule.technicalWeight}/{rule.commercialWeight}/{rule.priceWeight}</b><p className="mt-1 break-words">{rule.reason}</p><p className="mt-1">{rule.createdBy} · {rule.createdAt}</p></li>)}</ol>
    </details>}
  </section>;
}
