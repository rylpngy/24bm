import { useEffect,useRef,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '@24bid/api-client';
import { ActionButton,FeedbackNotice,SectionCard,StatusPill,Tabs } from '@24bid/ui';
import { ArrowLeft,Upload,ScanText,Download,History,Settings2,Check,X,MapPin } from 'lucide-react';
import { ContractRuleEditor } from './contract-rule-editor';
import { perspectiveName,reviewBase,reviewDownload,reviewError,reviewField,reviewGet,reviewPost,reviewTime,severityName,
  type ReviewDocument,type RuleVersion,type Workspace,type ReviewRun,type Finding,type Decision } from './contract-review-api';

export function ContractReviewWorkspace({canManage,onBack}:{canManage:boolean;onBack:()=>void}){
  const client=useQueryClient();
  const [tab,setTab]=useState('review'),[page,setPage]=useState(1);
  const [id,setId]=useState<string|null>(()=>new URLSearchParams(location.search).get('reviewDocument'));
  const [runId,setRunId]=useState(''),[textVersion,setTextVersion]=useState<number|null>(null);
  const [ruleVersion,setRuleVersion]=useState(''),[perspective,setPerspective]=useState('BUYER');
  const [resultTab,setResultTab]=useState('findings'),[activeLocator,setActiveLocator]=useState<string|null>(null);
  const [decision,setDecision]=useState<{finding:Finding;action:'adopt'|'dismiss'}|null>(null),[replacement,setReplacement]=useState(''),[comment,setComment]=useState('');
  const [error,setError]=useState(''),[message,setMessage]=useState('');
  const refs=useRef<Record<string,HTMLDivElement|null>>({});
  const sourcePane=useRef<HTMLDivElement|null>(null);
  const documents=useQuery({queryKey:['contract-review-documents',page],queryFn:()=>reviewGet<{items:ReviewDocument[];total:number;pageSize:number}>(`/documents?page=${page}&pageSize=10`)});
  const versions=useQuery({queryKey:['contract-rule-versions'],queryFn:()=>reviewGet<RuleVersion[]>('/rule-versions')});
  const workspace=useQuery({queryKey:['contract-review-workspace',id],enabled:!!id,queryFn:()=>reviewGet<Workspace>(`/documents/${id}`)});
  const data=workspace.data;
  const run=data?.runs.find(r=>r.id===runId)||data?.runs[0];
  const source=data?.versions.find(v=>v.version===(textVersion??run?.documentVersion??data.document.currentVersion))||data?.versions[0];
  const published=versions.data?.find(v=>v.id===(run?.rulesVersionId));
  const stale=!!run&&run.documentVersion!==data?.document.currentVersion;
  const switchDocument=(value:string|null)=>{setId(value);setRunId('');setTextVersion(null);setActiveLocator(null);setError('');setMessage('');setResultTab('findings');};
  useEffect(()=>{const url=new URL(location.href);url.searchParams.set('view','review');if(id)url.searchParams.set('reviewDocument',id);else url.searchParams.delete('reviewDocument');history.replaceState(null,'',url);},[id]);
  const refresh=()=>{void client.invalidateQueries({queryKey:['contract-review-workspace',id]});void client.invalidateQueries({queryKey:['contract-review-documents']});};
  const upload=useMutation({mutationFn:async(file:File)=>{
    if(!/\.(docx|txt)$/i.test(file.name)||!file.size||file.size>2*1024*1024)throw Error('请选择2MB以内的DOCX或UTF-8文本，扫描件及PDF暂不支持。');
    return (await axiosInstance.post<{data:ReviewDocument}>(`${reviewBase}/documents`,await file.arrayBuffer(),{params:{fileName:file.name},headers:{'Content-Type':'application/octet-stream'}})).data.data;
  },onSuccess:value=>{switchDocument(value.id);setTab('review');refresh();},onError:e=>setError(reviewError(e))});
  const start=useMutation({mutationFn:(useModel:boolean)=>{
    if(!data)throw Error('请先上传合同原件。');
    const selected=ruleVersion||versions.data?.[0]?.id;if(!selected)throw Error('请先在规则配置中保存并发布规则版本。');
    return reviewPost<ReviewRun>(`/documents/${id}/reviews`,{rulesVersionId:selected,perspective,expectedVersion:data.document.currentVersion,useModel});
  },onSuccess:value=>{setRunId(value.id);setTextVersion(value.documentVersion);setActiveLocator(null);setError('');setMessage('审查记录已保存，请逐项复核。');refresh();},onError:e=>setError(reviewError(e))});
  const confirm=useMutation({mutationFn:()=>{
    if(!decision||!data||!run)throw Error('请选择风险项');
    if(!comment.trim()||(decision.action==='adopt'&&!replacement.trim()))throw Error('请填写人工处理说明，并确认完整的替换或新增条款。');
    return reviewPost<Decision>(`/documents/${id}/reviews/${run.id}/decisions`,{findingId:decision.finding.id,action:decision.action,expectedVersion:data.document.currentVersion,comment,replacement});
  },onSuccess:value=>{setTextVersion(value.newVersion);setDecision(null);setError('');setMessage('人工处理已留痕；采纳只更新校对稿，不修改原件和合同正式记录。');refresh();},onError:e=>setError(reviewError(e))});
  const download=async(path:string,name:string)=>{try{await reviewDownload(path,name);setError('');}catch(e){setError(reviewError(e));}};
  const locate=(finding:Finding)=>{setTextVersion(run?.documentVersion??null);setActiveLocator(finding.locator);if(finding.locator)requestAnimationFrame(()=>{
    const target=refs.current[finding.locator!],pane=sourcePane.current;if(target&&pane){pane.scrollTop=Math.max(0,target.getBoundingClientRect().top-pane.getBoundingClientRect().top+pane.scrollTop-16);
      if(typeof window.matchMedia==='function'&&!window.matchMedia('(min-width: 1280px)').matches)target.scrollIntoView({block:'center',behavior:'smooth'});
    }
  });};
  const openDecision=(finding:Finding,action:'adopt'|'dismiss')=>{setDecision({finding,action});setReplacement(finding.suggestion);setComment('');setError('');};
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
      <div className="flex min-w-0 items-center gap-3"><button type="button" aria-label="返回合同台账" className="h-9 w-9 shrink-0 rounded-md border border-slate-200 bg-white text-slate-500" onClick={onBack}><ArrowLeft size={17} className="mx-auto"/></button><div className="min-w-0"><h2 className="text-xl font-bold text-slate-950">合同智能审查</h2><p className="mt-1 text-xs text-slate-500">{data?.document.fileName||'采购合同审查台账'}</p></div></div>
      {canManage&&<label className="inline-flex h-9 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md bg-blue-600 px-4 text-sm font-bold text-white"><Upload size={15}/>{upload.isPending?'上传中':'上传合同'}<input aria-label="上传审查合同" type="file" accept=".txt,.docx" className="hidden" disabled={upload.isPending||start.isPending} onChange={e=>{const file=e.target.files?.[0];if(file)upload.mutate(file);e.target.value='';}}/></label>}
    </div>
    <Tabs items={[{id:'review',label:'审查工作台',icon:ScanText},{id:'rules',label:'规则配置与版本',icon:Settings2}]} value={tab} onChange={setTab}/>
    {error&&<FeedbackNotice tone="error" message={error}/>}{message&&<FeedbackNotice tone="success" message={message}/>}
    {tab==='rules'?<ContractRuleEditor canManage={canManage}/>:<>
      {(documents.isError||workspace.isError||versions.isError)&&<FeedbackNotice tone="error" message={reviewError(documents.error||workspace.error||versions.error)}/>}
      {!id?<SectionCard title="合同审查台账">
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['序号','合同文件','当前校对稿','上传时间','操作'].map(t=><th className="whitespace-nowrap px-3 py-3" key={t}>{t}</th>)}</tr></thead><tbody>{documents.data?.items.map((doc,index)=><tr className="border-b border-slate-100" key={doc.id}><td className="px-3 py-4">{(page-1)*10+index+1}</td><td className="max-w-[340px] px-3 py-4"><p className="truncate font-bold" title={doc.fileName}>{doc.fileName}</p><p className="mt-1 truncate font-mono text-xs text-slate-400" title={doc.originalSha256}>SHA256 {doc.originalSha256}</p></td><td className="px-3 py-4">V{doc.currentVersion}</td><td className="whitespace-nowrap px-3 py-4 text-xs">{reviewTime(doc.createdAt)}</td><td className="px-3 py-4"><ActionButton onClick={()=>switchDocument(doc.id)}>详情</ActionButton></td></tr>)}</tbody></table>{documents.isPending?<p className="py-8 text-center text-sm text-slate-500">正在加载</p>:documents.data?.items.length===0&&<p className="py-8 text-center text-sm text-slate-400">暂无审查合同</p>}</div>
        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500"><span>共{documents.data?.total??0}份</span><div className="flex gap-2"><ActionButton disabled={page===1} onClick={()=>setPage(p=>p-1)}>上一页</ActionButton><span className="self-center">{page}/{Math.max(1,Math.ceil((documents.data?.total??0)/10))}</span><ActionButton disabled={page*10>=(documents.data?.total??0)} onClick={()=>setPage(p=>p+1)}>下一页</ActionButton></div></div>
      </SectionCard>:data?<>
        <div className="flex flex-wrap items-center justify-between gap-2"><ActionButton icon={ArrowLeft} onClick={()=>switchDocument(null)}>审查台账</ActionButton><div className="flex flex-wrap gap-2"><StatusPill label={`当前校对稿 V${data.document.currentVersion}`}/><ActionButton icon={Download} onClick={()=>download(`/documents/${id}/original`,data.document.fileName)}>下载原件</ActionButton><ActionButton icon={Download} onClick={()=>download(`/documents/${id}/versions/${source?.version}/export`,`合同审查校对稿-V${source?.version}.docx`)}>下载所选校对稿</ActionButton></div></div>
        {data.document.limitations.length>0&&<FeedbackNotice tone="info" message={data.document.limitations.join('；')}/>}
        <SectionCard title="审查设置">
          <div className="grid items-end gap-3 lg:grid-cols-[minmax(0,1fr)_190px_auto]">
            <label className="min-w-0 text-sm font-bold">已发布规则版本 *<select aria-label="审查规则版本" className={`mt-1 ${reviewField}`} disabled={start.isPending} value={ruleVersion||versions.data?.[0]?.id||''} onChange={e=>setRuleVersion(e.target.value)}>{!versions.data?.length&&<option value="">请先发布规则</option>}{versions.data?.map(value=><option key={value.id} value={value.id}>{value.name} · V{value.version}</option>)}</select></label>
            <label className="text-sm font-bold">审查视角<select aria-label="审查视角" className={`mt-1 ${reviewField}`} disabled={start.isPending} value={perspective} onChange={e=>setPerspective(e.target.value)}><option value="BUYER">甲方（采购方）</option><option value="SELLER">乙方（供应商）</option></select></label>
            {canManage&&<div className="flex flex-wrap gap-2"><ActionButton disabled={start.isPending} onClick={()=>start.mutate(false)}>仅规则检查</ActionButton><ActionButton tone="blue" icon={ScanText} disabled={start.isPending} onClick={()=>start.mutate(true)}>{start.isPending?'审查中':'规则 + AI审查'}</ActionButton></div>}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">AI审查会将所选版本的合同正文及规则发送至已配置模型服务；仅辅助人工复核，不作审批或签署。校对稿不自动覆盖合同台账及上传原件。</p>
        </SectionCard>
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
          <SectionCard title="合同原文与校对稿" className="xl:sticky xl:top-20" extra={<select aria-label="正文版本" className="max-w-[150px] rounded-md border border-slate-200 px-2 py-1 text-xs" value={source?.version||''} onChange={e=>{setTextVersion(Number(e.target.value));setActiveLocator(null);}}>{data.versions.map(v=><option key={v.version} value={v.version}>V{v.version}{v.version===1?' 上传正文':' 校对稿'}</option>)}</select>}>
            <p className="mb-3 truncate font-mono text-[10px] text-slate-400" title={source?.textSha256}>正文 SHA256 {source?.textSha256}</p>
            <div ref={sourcePane} className="max-h-[min(680px,calc(100vh-240px))] min-h-[240px] space-y-3 overflow-y-auto pr-1">{source?.segments.map(segment=><div key={segment.locator} ref={el=>{refs.current[segment.locator]=el;}} data-testid={`source-${segment.locator}`} className={`rounded-md border px-3 py-3 ${activeLocator===segment.locator?'border-amber-400 bg-amber-50 ring-1 ring-amber-200':'border-slate-100 bg-white'}`}><p className="mb-1 font-mono text-[10px] text-slate-400">{segment.locator}</p><p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-800">{segment.text}</p></div>)}</div>
          </SectionCard>
          <div className="min-w-0 space-y-3">
            <Tabs items={[{id:'findings',label:'审查结果',badge:run?.findings.length??0},{id:'history',label:'人工确认历史',icon:History,badge:data.decisions.length}]} value={resultTab} onChange={setResultTab}/>
            {resultTab==='history'?<SectionCard title="人工确认历史"><div className="space-y-4">{data.decisions.map(item=><details key={item.id} className="border-b border-slate-100 pb-4"><summary className="cursor-pointer text-sm font-bold">{item.action==='adopt'?'已采纳修订':'未采纳'} · V{item.oldVersion}→V{item.newVersion}<p className="mt-1 text-xs font-normal text-slate-500">{item.actorName||item.actorId} · {reviewTime(item.createdAt)}</p></summary><div className="mt-3 space-y-3 text-sm"><p className="whitespace-pre-wrap break-words">处理说明：{item.comment}</p><p className="text-xs text-slate-400">位置：{item.locator||'新增条款'} · 审查记录 {item.runId}</p><div className="border-l-2 border-red-200 pl-3"><p className="text-xs text-slate-500">修改前</p><p className="whitespace-pre-wrap break-words">{item.beforeText||'无原条款'}</p></div><div className="border-l-2 border-emerald-200 pl-3"><p className="text-xs text-slate-500">修改后</p><p className="whitespace-pre-wrap break-words">{item.afterText||'未变更'}</p></div></div></details>)}{!data.decisions.length&&<p className="text-sm text-slate-400">暂无人工处理记录</p>}</div></SectionCard>:<SectionCard title="风险及修改建议">
              <label className="text-xs font-bold text-slate-500">历次审查<select aria-label="历次审查" className={`mt-1 ${reviewField}`} value={run?.id||''} onChange={e=>{const selected=data.runs.find(r=>r.id===e.target.value);setRunId(e.target.value);setTextVersion(selected?.documentVersion??null);setActiveLocator(null);}}>{!data.runs.length&&<option value="">尚未审查</option>}{data.runs.map(value=><option key={value.id} value={value.id}>{reviewTime(value.createdAt)} · 正文V{value.documentVersion} · {perspectiveName(value.perspective)}</option>)}</select></label>
              {run?<><div className="my-3 flex flex-wrap gap-2"><StatusPill label={run.mode==='MODEL_ASSISTED'?'大模型 + 规则':run.mode==='RULE_ONLY'?'仅规则检查':'模型未完成'}/><StatusPill label={perspectiveName(run.perspective)}/><StatusPill label={`正文V${run.documentVersion}`}/></div><p className="text-xs leading-5 text-slate-500">{published?.name} · V{published?.version} · {run.model||'未使用模型'}<br/>{run.actorName} · {reviewTime(run.createdAt)}</p><FeedbackNotice tone={run.mode==='MODEL_UNAVAILABLE'?'error':'info'} message={run.limitation}/>
                {stale&&<FeedbackNotice tone="info" message="当前正文已有新版本；本次结果保留用于追溯，须重新审查后处理剩余风险。"/>}
                <div className="mt-4 space-y-5">{run.findings.map(finding=>{const handled=data.decisions.find(d=>d.runId===run.id&&d.findingId===finding.id);return <article key={finding.id} className={`border-l-2 pb-3 pl-3 ${finding.severity==='HIGH'?'border-red-400':finding.severity==='MEDIUM'?'border-amber-400':'border-blue-300'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="break-words text-sm font-bold text-slate-900">{finding.title}</h4><span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-bold ${finding.severity==='HIGH'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-800'}`}>{severityName(finding.severity)}</span></div>
                  <p className="mt-1 text-[11px] text-slate-400">{finding.origin==='MODEL'?'模型语义辅助':'确定性规则'} · {finding.ruleId}</p>
                  {finding.locator?<button type="button" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700" onClick={()=>locate(finding)}><MapPin size={13}/>定位原文 · {finding.locator}</button>:<p className="mt-2 text-xs text-amber-700">全文未检出约定，无对应原文位置；采纳后新增条款。</p>}
                  {finding.quote&&<blockquote className="mt-2 whitespace-pre-wrap break-words border-l-2 border-slate-200 pl-2 text-xs leading-6 text-slate-500">{finding.quote}</blockquote>}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{finding.explanation}</p>
                  <details className="mt-2 text-xs"><summary className="cursor-pointer font-bold text-slate-600">依据：{finding.sourceName} / {finding.clause}</summary><p className="mt-2 whitespace-pre-wrap break-words leading-6">{finding.basis}</p></details>
                  <p className="mt-3 text-xs font-bold text-slate-500">修改建议</p><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{finding.suggestion}</p>
                  {handled?<p className="mt-3 text-xs font-bold text-emerald-700">{handled.action==='adopt'?'人工已采纳':'人工未采纳'} · {handled.actorName}</p>:canManage&&<div className="mt-3 flex flex-wrap gap-2"><ActionButton icon={Check} disabled={stale||start.isPending} onClick={()=>openDecision(finding,'adopt')}>确认修订</ActionButton><ActionButton icon={X} disabled={stale||start.isPending} onClick={()=>openDecision(finding,'dismiss')}>不采纳</ActionButton></div>}
                </article>;})}{!run.findings.length&&<p className="text-sm leading-6 text-slate-500">本次未生成有原文依据的风险项，不等于合同无风险或已审核通过。</p>}</div>
              </>:<p className="mt-6 text-sm text-slate-400">尚无审查记录</p>}
            </SectionCard>}
          </div>
        </div>
      </>:<p className="py-8 text-center text-sm text-slate-500">正在加载合同审查资料</p>}
    </>}
    {decision&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="人工确认修订"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
      <h3 className="text-lg font-bold">{decision.action==='adopt'?'人工确认修订':'确认不采纳'} · {decision.finding.title}</h3>
      {error&&<FeedbackNotice tone="error" message={error}/>}
      {decision.action==='adopt'&&<><p className="mt-4 text-xs font-bold text-slate-500">{decision.finding.locator?'原完整段落':'原文无对应条款，将在校对稿末尾新增'}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{data?.versions.find(v=>v.version===run?.documentVersion)?.segments.find(s=>s.locator===decision.finding.locator)?.text}</p><label className="mt-4 block text-sm font-bold">{decision.finding.locator?'确认替换整个段落':'确认新增条款'} *<textarea aria-label="确认修订内容" rows={5} maxLength={4000} className={`mt-2 ${reviewField}`} value={replacement} onChange={e=>setReplacement(e.target.value)}/></label></>}
      <label className="mt-4 block text-sm font-bold">人工处理说明 *<textarea aria-label="人工处理说明" rows={3} maxLength={2000} className={`mt-2 ${reviewField}`} value={comment} onChange={e=>setComment(e.target.value)}/></label>
      <div className="mt-5 flex justify-end gap-2"><ActionButton disabled={confirm.isPending} onClick={()=>setDecision(null)}>取消</ActionButton><ActionButton tone="blue" disabled={confirm.isPending} onClick={()=>confirm.mutate()}>{confirm.isPending?'保存中':'确认并留痕'}</ActionButton></div>
    </div></div>}
  </div>;
}
