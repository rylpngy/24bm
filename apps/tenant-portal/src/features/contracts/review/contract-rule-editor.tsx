import { useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { ActionButton,FeedbackNotice,SectionCard,StatusPill } from '@24bid/ui';
import { Plus,Save,Upload,PenLine,Trash2,X } from 'lucide-react';
import { exampleRules,perspectiveName,reviewBase,reviewError,reviewField,reviewGet,reviewPost,reviewTime,severityName,type Rule,type RuleSet,type RuleVersion } from './contract-review-api';

const types={KEYWORD:'关键词命中',MISSING:'缺失条款',SEMANTIC:'模型语义'};
const emptyRule=():Rule=>({id:`rule_${Date.now()}`,title:'',type:'KEYWORD',perspective:'BOTH',severity:'MEDIUM',matchMode:'ANY',keywords:[],sourceName:'',clause:'',basis:'',suggestion:''});
export function ContractRuleEditor({canManage}:{canManage:boolean}){
  const client=useQueryClient();
  const sets=useQuery({queryKey:['contract-rule-sets'],queryFn:()=>reviewGet<RuleSet[]>('/rule-sets')});
  const versions=useQuery({queryKey:['contract-rule-versions'],queryFn:()=>reviewGet<RuleVersion[]>('/rule-versions')});
  const [draft,setDraft]=useState<RuleSet>({id:'',name:'',revision:0,rules:[]}),[dirty,setDirty]=useState(false);
  const [editor,setEditor]=useState<{index:number;rule:Rule;keywords:string}|null>(null),[error,setError]=useState(''),[message,setMessage]=useState('');
  const change=(value:RuleSet)=>{setDraft(value);setDirty(true);setMessage('');};
  const refresh=()=>{void client.invalidateQueries({queryKey:['contract-rule-sets']});void client.invalidateQueries({queryKey:['contract-rule-versions']});};
  const save=useMutation({mutationFn:async()=>{
    if(!draft.name.trim()||!draft.rules.length)throw Error('请填写规则集名称，并至少增加一条完整规则。');
    const body={name:draft.name,expectedRevision:draft.revision,rules:draft.rules};
    return draft.id?(await axiosInstance.put<{data:RuleSet}>(`${reviewBase}/rule-sets/${draft.id}`,body)).data.data:reviewPost<RuleSet>('/rule-sets',body);
  },onSuccess:value=>{setDraft(value);setDirty(false);setError('');setMessage('草稿已保存，发布后可用于新审查。');refresh();},onError:e=>setError(reviewError(e))});
  const publish=useMutation({mutationFn:()=>reviewPost<RuleVersion>(`/rule-sets/${draft.id}/publish`,{expectedRevision:draft.revision}),
    onSuccess:value=>{setError('');setMessage(`已发布 V${value.version}，历史审查仍保留原规则版本。`);refresh();},onError:e=>setError(reviewError(e))});
  return <div className="space-y-4">
    {(sets.isError||versions.isError)&&<FeedbackNotice tone="error" message={reviewError(sets.error||versions.error)}/>}
    {error&&<FeedbackNotice tone="error" message={error}/ >}{message&&<FeedbackNotice tone="success" message={message}/>}
    <SectionCard title="规则配置" extra={canManage&&<ActionButton icon={Plus} onClick={()=>{if(dirty&&!window.confirm('放弃尚未保存的规则草稿？'))return;setDraft({id:'',name:'',revision:0,rules:[]});setDirty(false);}}>新建规则集</ActionButton>}>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm font-bold">已存草稿<select aria-label="选择规则草稿" className={`mt-1 ${reviewField}`} value={draft.id} onChange={e=>{if(dirty&&!window.confirm('放弃尚未保存的规则草稿？'))return;const value=sets.data?.find(x=>x.id===e.target.value);if(value){setDraft(structuredClone(value));setDirty(false);}}}><option value="">新建</option>{sets.data?.map(value=><option key={value.id} value={value.id}>{value.name} · 草稿{value.revision}</option>)}</select></label>
        <label className="text-sm font-bold">规则集名称 *<input aria-label="规则集名称" maxLength={200} className={`mt-1 ${reviewField}`} value={draft.name} disabled={!canManage} onChange={e=>change({...draft,name:e.target.value})}/></label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusPill label={dirty?'未保存':draft.id?`草稿${draft.revision}`:'新规则集'}/>
        {canManage&&<><ActionButton icon={Plus} onClick={()=>setEditor({index:-1,rule:emptyRule(),keywords:''})}>新增规则</ActionButton>
          <ActionButton icon={Upload} onClick={()=>{if(draft.rules.length&&!window.confirm('以明确标识的演示规则替换当前草稿？'))return;change({...draft,name:draft.name||'采购合同演示规则',rules:structuredClone(exampleRules)});}}>导入演示规则</ActionButton>
          <ActionButton icon={Save} disabled={save.isPending||publish.isPending||!dirty} onClick={()=>save.mutate()}>保存草稿</ActionButton>
          <ActionButton tone="blue" icon={Upload} disabled={!draft.id||dirty||save.isPending||publish.isPending} onClick={()=>publish.mutate()}>{publish.isPending?'发布中':'发布新版本'}</ActionButton></>}
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['规则','类型 / 匹配','适用视角','风险等级','依据来源','操作'].map(t=><th key={t} className="whitespace-nowrap px-3 py-3">{t}</th>)}</tr></thead><tbody>{draft.rules.map((rule,index)=><tr key={rule.id} className="border-b border-slate-100"><td className="px-3 py-3 font-bold">{rule.title}<p className="mt-1 font-mono text-xs font-normal text-slate-400">{rule.id}</p></td><td className="px-3 py-3">{types[rule.type]}<p className="mt-1 text-xs text-slate-500">{rule.type==='SEMANTIC'?'模型判读':rule.matchMode==='ALL'?'全部关键词':'任一关键词'}</p></td><td className="px-3 py-3">{perspectiveName(rule.perspective)}</td><td className="px-3 py-3">{severityName(rule.severity)}</td><td className="max-w-[220px] px-3 py-3"><p className="truncate" title={rule.sourceName}>{rule.sourceName}</p><span className="text-xs text-slate-500">{rule.clause}</span></td><td className="px-3 py-3"><div className="flex flex-nowrap gap-2"><ActionButton icon={PenLine} onClick={()=>setEditor({index,rule:structuredClone(rule),keywords:rule.keywords.join('、')})}>{canManage?'编辑':'详情'}</ActionButton>{canManage&&<button title="删除草稿规则" type="button" className="h-9 w-9 shrink-0 rounded-md text-red-600 hover:bg-red-50" onClick={()=>change({...draft,rules:draft.rules.filter((_,i)=>i!==index)})}><Trash2 size={15}/></button>}</div></td></tr>)}</tbody></table>{!draft.rules.length&&<p className="py-8 text-center text-sm text-slate-400">暂无规则</p>}</div>
    </SectionCard>
    <SectionCard title="已发布版本"><div className="divide-y divide-slate-100">{versions.data?.map(value=><details key={value.id} className="py-3"><summary className="cursor-pointer text-sm font-bold">{value.name} · V{value.version}<span className="ml-3 text-xs font-normal text-slate-500">{reviewTime(value.createdAt)} · {value.rules.length}条</span></summary><div className="mt-3 space-y-3 text-sm">{value.rules.map(rule=><div key={rule.id} className="border-l-2 border-blue-200 pl-3"><strong>{rule.title}</strong><p className="mt-1 text-xs text-slate-500">{perspectiveName(rule.perspective)} · {types[rule.type]} · {rule.sourceName} / {rule.clause}</p><p className="mt-1 whitespace-pre-wrap break-words">{rule.basis}</p></div>)}</div></details>)}{versions.data?.length===0&&<p className="py-4 text-sm text-slate-400">暂无已发布版本</p>}</div></SectionCard>
    {editor&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="规则编辑"><form className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl" onSubmit={e=>{
      e.preventDefault();const rule={...editor.rule,keywords:editor.rule.type==='SEMANTIC'?[]:editor.keywords.split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean)};
      if(!rule.title.trim()||!rule.sourceName.trim()||!rule.clause.trim()||!rule.basis.trim()||!rule.suggestion.trim()||(rule.type!=='SEMANTIC'&&!rule.keywords.length)){setError('请补齐规则名称、依据来源、条款、依据内容、建议及关键词。');return;}
      if(draft.rules.some((r,i)=>r.id===rule.id&&i!==editor.index)){setError('规则编号不能重复。');return;}
      change({...draft,rules:editor.index<0?[...draft.rules,rule]:draft.rules.map((r,i)=>i===editor.index?rule:r)});setError('');setEditor(null);
    }}>
      <div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold">{canManage?'编辑规则':'规则详情'}</h3><button title="关闭规则编辑" type="button" onClick={()=>setEditor(null)}><X size={20}/></button></div>
      {error&&<FeedbackNotice tone="error" message={error}/>}
      <fieldset disabled={!canManage} className="grid gap-4 sm:grid-cols-2">
        {(['id','title'] as const).map(key=><label key={key} className="text-sm font-bold">{key==='id'?'规则编号':'规则名称'} *<input required aria-label={key==='id'?'规则编号':'规则名称'} pattern={key==='id'?'[A-Za-z][A-Za-z0-9_]{0,59}':undefined} maxLength={key==='id'?60:120} className={`mt-1 ${reviewField}`} value={editor.rule[key]} onChange={e=>setEditor({...editor,rule:{...editor.rule,[key]:e.target.value}})}/></label>)}
        <label className="text-sm font-bold">规则类型<select aria-label="规则类型" className={`mt-1 ${reviewField}`} value={editor.rule.type} onChange={e=>setEditor({...editor,rule:{...editor.rule,type:e.target.value as Rule['type']}})}>{Object.entries(types).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label className="text-sm font-bold">适用视角<select aria-label="适用视角" className={`mt-1 ${reviewField}`} value={editor.rule.perspective} onChange={e=>setEditor({...editor,rule:{...editor.rule,perspective:e.target.value as Rule['perspective']}})}>{['BUYER','SELLER','BOTH'].map(key=><option key={key} value={key}>{perspectiveName(key)}</option>)}</select></label>
        <label className="text-sm font-bold">风险等级<select aria-label="风险等级" className={`mt-1 ${reviewField}`} value={editor.rule.severity} onChange={e=>setEditor({...editor,rule:{...editor.rule,severity:e.target.value as Rule['severity']}})}>{['HIGH','MEDIUM','LOW'].map(key=><option key={key} value={key}>{severityName(key)}</option>)}</select></label>
        {editor.rule.type!=='SEMANTIC'&&<><label className="text-sm font-bold">关键词逻辑<select aria-label="关键词逻辑" className={`mt-1 ${reviewField}`} value={editor.rule.matchMode} onChange={e=>setEditor({...editor,rule:{...editor.rule,matchMode:e.target.value as Rule['matchMode']}})}><option value="ANY">任一关键词（OR）</option><option value="ALL">全部关键词（AND）</option></select></label><label className="text-sm font-bold sm:col-span-2">关键词（顿号分隔）*<input required aria-label="规则关键词" className={`mt-1 ${reviewField}`} value={editor.keywords} onChange={e=>setEditor({...editor,keywords:e.target.value})}/></label></>}
        {(['sourceName','clause','basis','suggestion'] as const).map(key=><label key={key} className={`text-sm font-bold ${key==='basis'||key==='suggestion'?'sm:col-span-2':''}`}>{{sourceName:'依据来源',clause:'条款编号',basis:'依据及审查要求',suggestion:'建议条款'}[key]} *<textarea required aria-label={{sourceName:'依据来源',clause:'条款编号',basis:'依据及审查要求',suggestion:'建议条款'}[key]} rows={key==='basis'||key==='suggestion'?3:1} maxLength={{sourceName:200,clause:120,basis:2000,suggestion:4000}[key]} className={`mt-1 ${reviewField}`} value={editor.rule[key]} onChange={e=>setEditor({...editor,rule:{...editor.rule,[key]:e.target.value}})}/></label>)}
      </fieldset>
      <div className="mt-5 flex justify-end gap-2"><ActionButton onClick={()=>setEditor(null)}>取消</ActionButton>{canManage&&<button type="submit" className="h-9 rounded-md bg-blue-600 px-4 text-sm font-bold text-white">确定</button>}</div>
    </form></div>}
  </div>;
}
