import { useEffect,useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { axiosInstance,type RfqResponse } from '@24bid/api-client';
import { latestQuotationVersions,type QuotationPackage,type FullQuotationDetails,type QuotationVersion,type TechnicalResponse } from '@24bid/shared/quotation';
import { ActionButton,FeedbackNotice,SectionCard,StatusPill } from '@24bid/ui';
import { Upload,Save,Pencil,Download } from 'lucide-react';

const field='w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800';
const price=(v:number)=>v.toLocaleString('zh-CN',{style:'currency',currency:'CNY'});
export function DetailedQuotation({rfq,pack,onRefresh}:{rfq:RfqResponse;pack:QuotationPackage;onRefresh:()=>void}){
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(rfq.status!=='报价中')return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[rfq.status]);
  const latest=latestQuotationVersions(pack)[0];
  const [editing,setEditing]=useState(false),[baseVersion,setBaseVersion]=useState(0);
  const [tax,setTax]=useState(''),[days,setDays]=useState(''),[invoice,setInvoice]=useState(''),[remark,setRemark]=useState('');
  const [amounts,setAmounts]=useState<Record<string,string>>({}),[technical,setTechnical]=useState<Record<string,TechnicalResponse>>({});
  const [files,setFiles]=useState<string[]>([]),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [selected,setSelected]=useState<QuotationVersion|null>(null);
  const items=rfq.items??[];
  const total=items.reduce((sum,item)=>sum+(item.quantity??0)*Number(amounts[item.demandItemId||'']||0),0);
  const open=rfq.status==='报价中'&&new Date(pack.deadlineAt).getTime()>now;
  const update=(id:string,key:keyof TechnicalResponse,value:string)=>setTechnical(s=>({...s,[id]:{...s[id],demandItemId:id,[key]:value}}));
  const edit=()=>{
    if(!latest)return;const d=latest.snapshot.details;
    setTax(String(latest.snapshot.quote.taxRate));setDays(String(latest.snapshot.quote.deliveryDays));setInvoice(d?.invoiceType||'');setRemark(d?.remark||'');
    setFiles(d?.attachmentIds||[]);setTechnical(Object.fromEntries((d?.lines||[]).map(line=>[line.demandItemId,line])));
    setAmounts(Object.fromEntries(latest.snapshot.quote.lineItems.map(line=>[line.demandItemId,String(line.unitPrice)])));
    setBaseVersion(latest.versionNo);setEditing(true);setError('');setMessage('');
  };
  const upload=useMutation({mutationFn:async(file:File)=>{
    if(file.size===0||file.size>10*1024*1024)throw Error('报价附件不能为空且不得超过10MB');
    return (await axiosInstance.post<{data:{id:string}}>(`/api/v1/supplier/rfqs/${rfq.id}/quotation-files`,await file.arrayBuffer(),{
      params:{fileName:file.name},headers:{'Content-Type':'application/octet-stream'},
    })).data.data;
  },onSuccess:file=>{setFiles(s=>[...s,file.id]);onRefresh();},onError:e=>setError((e as Error).message||'附件上传失败')});
  const submit=useMutation({mutationFn:async()=>{
    setError('');setMessage('');
    if(!invoice||!tax.trim()||Number(tax)<0||Number(tax)>100||!days.trim()||!Number.isInteger(Number(days))||Number(days)<=0||files.length===0)
      throw Error('请填写发票类型、0—100%的税率、正整数交期，并上传报价附件。');
    if(!items.length||items.some(item=>{const id=item.demandItemId||'',tech=technical[id];return Number(amounts[id])<=0||!Number.isFinite(Number(amounts[id]))||!tech?.brand?.trim()||!tech?.model?.trim()||!tech?.technicalParameters?.trim()||!tech?.technicalResponse?.trim();}))
      throw Error('请逐项填写含税单价、品牌、型号、实际技术参数及技术响应。');
    const details:FullQuotationDetails={invoiceType:invoice,remark,attachmentIds:files,lines:items.map(item=>technical[item.demandItemId||''])};
    const data={amount:total,taxRate:Number(tax),deliveryDays:Number(days),details,
      lineItems:items.map(item=>({demandItemId:item.demandItemId,description:item.materialName||item.materialId,unit:item.unit||'项',quantity:item.quantity,unitPrice:Number(amounts[item.demandItemId||''])}))};
    if(latest)await axiosInstance.put(`/api/v1/supplier/quotes/${latest.quoteId}`,{...data,expectedVersion:baseVersion});
    else await axiosInstance.post(`/api/v1/supplier/rfqs/${rfq.id}/quotes`,data);
  },onSuccess:()=>{setEditing(false);setSelected(null);setMessage('报价已提交并生成不可覆盖的版本记录。');onRefresh();},onError:e=>setError((e as {response?:{data?:{message?:string}}}).response?.data?.message||(e as Error).message||'报价提交失败，请刷新版本后重试。')});
  const shown=selected||latest||pack.versions[pack.versions.length-1];
  return <SectionCard title="完整分项报价" extra={<StatusPill label={latest?`第${pack.round}轮 · V${latest.versionNo}`:'待报价'} />}>
    {error&&<FeedbackNotice tone="error" message={error} />}{message&&<FeedbackNotice tone="success" message={message} />}
    {latest&&!editing&&<>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="mb-1 text-xs text-slate-500">本轮当前报价</p><strong className="text-xl text-slate-900">{price(latest.snapshot.quote.amount)}</strong><p className="mt-1 text-xs text-slate-500">含税总额 · {latest.snapshot.quote.deliveryDays}天 · {latest.snapshot.details?.invoiceType}</p></div>
        {open&&<ActionButton icon={Pencil} onClick={edit}>修改报价</ActionButton>}</div>
    </>}
    {pack.versions.length>0&&!editing&&<>
      <div className="mt-4 flex flex-wrap gap-2">{pack.versions.map(v=><ActionButton key={`${v.quoteId}-${v.versionNo}`} onClick={()=>setSelected(v)}>第{v.round}轮/V{v.versionNo}</ActionButton>)}</div>
      {shown&&<div className="mt-4 space-y-3"><p className="text-xs text-slate-500">第{shown.round}轮 / 版本V{shown.versionNo} · 含税总额 {price(shown.snapshot.quote.amount)} · {new Date(shown.createdAt).toLocaleString('zh-CN')} · {shown.source==='legacy'?'历史基线（未留存完整技术字段）':'已留存提交人和完整快照'}</p>
        {shown.snapshot.quote.lineItems.map(line=>{const t=shown.snapshot.details?.lines.find(t=>t.demandItemId===line.demandItemId);return <div key={line.demandItemId} className="border-b border-slate-100 pb-3 text-sm">
          <strong>{line.description} · {line.quantity}{line.unit} · {price(line.unitPrice)}</strong><p className="mt-2">{t?.brand} / {t?.model}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{t?.technicalParameters}</p><p className="mt-1 whitespace-pre-wrap break-words">{t?.technicalResponse}</p>
        </div>;})}
        <p className="whitespace-pre-wrap break-words text-sm">{shown.snapshot.details?.remark}</p>
        {shown.snapshot.details?.attachmentIds.map(id=>{const file=pack.files.find(f=>f.id===id);return <ActionButton key={id} icon={Download} onClick={async()=>{try{const r=await axiosInstance.get(`/api/v1/supplier/rfqs/${rfq.id}/quotation-files/${id}`,{responseType:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(r.data);a.download=file?.fileName||'报价附件';a.click();URL.revokeObjectURL(a.href);}catch{setError('附件下载核验失败。');}}}>{file?.fileName||'报价附件'}</ActionButton>;})}
      </div>}
    </>}
    {open&&(!latest||editing)&&<div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm font-bold">发票类型 *<select aria-label="发票类型" className={`mt-1 ${field}`} value={invoice} onChange={e=>setInvoice(e.target.value)}><option value="">请选择</option>{['增值税专用发票','增值税普通发票','其他合法票据'].map(v=><option key={v}>{v}</option>)}</select></label>
        <label className="text-sm font-bold">税率（%）*<input aria-label="报价税率" className={`mt-1 ${field}`} type="number" min={0} max={100} step="0.01" value={tax} onChange={e=>setTax(e.target.value)} /></label>
        <label className="text-sm font-bold">交期（天）*<input aria-label="报价交期" className={`mt-1 ${field}`} type="number" min={1} step={1} value={days} onChange={e=>setDays(e.target.value)} /></label>
      </div>
      {items.map((item,index)=>{const id=item.demandItemId||'',t=technical[id];return <section key={id} className="border-t border-slate-200 pt-4">
        <h4 className="font-bold text-slate-900">{index+1}. {item.materialName} · {item.quantity}{item.unit}</h4><p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">采购要求：{item.specification||'以采购清单为准'}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">含税单价 *<input aria-label={`含税单价${index+1}`} type="number" min="0.01" step="0.01" value={amounts[id]||''} onChange={e=>setAmounts(s=>({...s,[id]:e.target.value}))} className={field} /></label>
          <label className="text-sm">品牌 *<input aria-label={`品牌${index+1}`} maxLength={200} className={field} value={t?.brand||''} onChange={e=>update(id,'brand',e.target.value)} /></label>
          <label className="text-sm">型号 *<input aria-label={`型号${index+1}`} maxLength={200} className={field} value={t?.model||''} onChange={e=>update(id,'model',e.target.value)} /></label>
          <label className="text-sm sm:col-span-3">实际技术参数 *<textarea aria-label={`技术参数${index+1}`} maxLength={4000} className={field} value={t?.technicalParameters||''} onChange={e=>update(id,'technicalParameters',e.target.value)} /></label>
          <label className="text-sm sm:col-span-3">技术响应及偏离说明 *<textarea aria-label={`技术响应${index+1}`} maxLength={4000} className={field} value={t?.technicalResponse||''} onChange={e=>update(id,'technicalResponse',e.target.value)} /></label>
          <label className="text-sm sm:col-span-3">行备注<input aria-label={`行备注${index+1}`} maxLength={2000} className={field} value={t?.remark||''} onChange={e=>update(id,'remark',e.target.value)} /></label>
        </div>
      </section>;})}
      <label className="block text-sm">报价备注<textarea aria-label="报价备注" maxLength={2000} className={`mt-1 ${field}`} value={remark} onChange={e=>setRemark(e.target.value)} /></label>
      <div className="flex flex-wrap items-center gap-3"><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm"><Upload size={15}/>报价附件 *<input aria-label="上传报价附件" type="file" className="hidden" disabled={upload.isPending||submit.isPending||files.length>=10} onChange={e=>{const file=e.target.files?.[0];if(file)upload.mutate(file);e.target.value='';}} /></label>
        {files.map(id=><span key={id} className="flex items-center gap-2 text-xs">{pack.files.find(f=>f.id===id)?.fileName||'已上传材料'}<button type="button" title="取消本版关联，不删除历史原件" onClick={()=>setFiles(s=>s.filter(x=>x!==id))}>取消关联</button></span>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><strong className="font-mono text-lg">含税合计 {price(total)}</strong><div className="flex gap-2">{editing&&<ActionButton disabled={submit.isPending} onClick={()=>setEditing(false)}>取消修改</ActionButton>}<ActionButton icon={Save} tone="blue" disabled={submit.isPending||upload.isPending} onClick={()=>submit.mutate()}>{submit.isPending?'提交中':'确认提交报价'}</ActionButton></div></div>
    </div>}
    {!open&&!latest&&<FeedbackNotice tone="info" message="报价已截止或项目未处于报价中，不能提交；延期后入口自动恢复。" />}
  </SectionCard>;
}
