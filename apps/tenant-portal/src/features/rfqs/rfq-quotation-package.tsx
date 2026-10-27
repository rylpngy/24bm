import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosInstance,type RfqItemResponse } from '@24bid/api-client';
import { latestQuotationVersions,type QuotationPackage,type QuotationPolicy,type QuotationVersion } from '@24bid/shared/quotation';
import { ActionButton,FeedbackNotice,SectionCard,StatusPill } from '@24bid/ui';
import { Download,Save,Clock3 } from 'lucide-react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const input='h-9 min-w-0 rounded-md border border-slate-200 bg-white px-3 text-sm';
const money=(v:number)=>v.toLocaleString('zh-CN',{style:'currency',currency:'CNY'});
async function download(url:string,name:string){const response=await axiosInstance.get(url,{responseType:'blob'});const link=document.createElement('a');link.href=URL.createObjectURL(response.data);link.download=name;link.click();URL.revokeObjectURL(link.href);}
export function RfqQuotationPackage({rfqId,status,supplierNames,items=[],view='all'}:{rfqId:string;status?:string;supplierNames:Record<string,string>;items?:RfqItemResponse[];view?:'all'|'rules'|'versions'|'comparison'}){
  const {can}=useBuyerPermissions();const client=useQueryClient();const path=`/api/v1/buyer/rfqs/${rfqId}`;
  const query=useQuery({queryKey:['quotation-package',rfqId],queryFn:async()=>(await axiosInstance.get<{data:QuotationPackage}>(path+'/quotation-package')).data.data,refetchInterval:10000});
  const [policy,setPolicy]=useState<QuotationPolicy>({fullQuoteRequired:false,autoExtend:false,extensionHours:24,maxAutoExtensions:2});
  const [deadline,setDeadline]=useState(''),[reason,setReason]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [selected,setSelected]=useState<QuotationVersion|null>(null);
  useEffect(()=>{if(query.data)setPolicy(query.data.policy);},[query.data?.policy.fullQuoteRequired,query.data?.policy.autoExtend,query.data?.policy.extensionHours,query.data?.policy.maxAutoExtensions]);
  const refresh=()=>{void client.invalidateQueries({queryKey:['quotation-package',rfqId]});void client.invalidateQueries({predicate:q=>JSON.stringify(q.queryKey).includes('/rfqs')});};
  const mutate=useMutation({mutationFn:async(action:'policy'|'extend')=>{
    setError('');setMessage('');
    if(action==='policy')await axiosInstance.put(path+'/quotation-policy',policy);
    else await axiosInstance.post(path+'/extend-quotation',{expectedDeadline:query.data?.deadlineAt,newDeadline:new Date(deadline).toISOString(),reason});
  },onSuccess:()=>{setMessage('已保存，相关项目和通知同步更新。');refresh();},onError:e=>setError((e as {response?:{data?:{message?:string}}}).response?.data?.message||'操作失败，请刷新后重试。')});
  const pack=query.data;
  if(query.isError)return <FeedbackNotice tone="error" message="报价版本与延期规则加载失败，请刷新重试。" />;
  if(!pack)return null;
  const current=latestQuotationVersions(pack);
  return <div className="space-y-4">
    <div hidden={!['all','rules'].includes(view)}><SectionCard title="分项报价与截止规则" extra={<StatusPill label={`本轮有效报价 ${pack.validQuoteCount}/3 家`} />}>
      {can('buyer:rfq:manage')&&['草稿','报价中'].includes(status||'')&&<>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2"><input type="checkbox" checked={policy.fullQuoteRequired} onChange={e=>setPolicy({...policy,fullQuoteRequired:e.target.checked})} />完整分项报价</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={policy.autoExtend} onChange={e=>setPolicy({...policy,autoExtend:e.target.checked})} />不足三家自动延期</label>
          <label className="flex items-center gap-2">延期小时<input aria-label="自动延期小时" className={`${input} w-20`} type="number" min={1} max={720} value={policy.extensionHours} onChange={e=>setPolicy({...policy,extensionHours:Number(e.target.value)})} /></label>
          <label className="flex items-center gap-2">本轮上限<input aria-label="自动延期次数上限" className={`${input} w-20`} type="number" min={0} max={5} value={policy.maxAutoExtensions} onChange={e=>setPolicy({...policy,maxAutoExtensions:Number(e.target.value)})} /></label>
          <ActionButton icon={Save} disabled={mutate.isPending} onClick={()=>mutate.mutate('policy')}>保存规则</ActionButton>
        </div>
        {status==='报价中'&&<div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <input aria-label="新报价截止时间" type="datetime-local" className={input} value={deadline} onChange={e=>setDeadline(e.target.value)} />
          <input aria-label="延期原因" placeholder="延期原因（必填）" maxLength={1000} className={`${input} flex-1`} value={reason} onChange={e=>setReason(e.target.value)} />
          <ActionButton icon={Clock3} disabled={mutate.isPending||!deadline||!reason.trim()||pack.validQuoteCount>=3} onClick={()=>mutate.mutate('extend')}>确认延期</ActionButton>
        </div>}
      </>}
      <p className="mt-3 text-xs leading-5 text-slate-500">有效报价按本轮受邀供应商去重；完整模式须有逐项报价、品牌型号、技术参数及响应、发票类型、交期和附件。价格排序仅供参考，不替代技术评审和定标。</p>
      {message&&<FeedbackNotice tone="success" message={message} />}{error&&<FeedbackNotice tone="error" message={error} />}
      {!!pack.extensions.length&&<div className="mt-4 divide-y divide-slate-100">{pack.extensions.map(e=><div key={e.id} className="py-3 text-sm text-slate-600">
        <strong>{e.mode==='automatic'?'自动延期':'人工延期'} · 第{e.round}轮 · 有效报价{e.validQuoteCount}家</strong>
        <p className="mt-1">{new Date(e.oldDeadline).toLocaleString('zh-CN')} → {new Date(e.newDeadline).toLocaleString('zh-CN')}</p><p className="mt-1 break-words">{e.reason}</p>
      </div>)}</div>}
    </SectionCard></div>
    {pack.policy.fullQuoteRequired&&['all','versions','comparison'].includes(view)&&<SectionCard title={view==='versions'?'供应商报价与历史版本':'价格与技术比价'} extra={<ActionButton icon={Download} disabled={pack.sealed||!current.length} onClick={()=>download(path+'/technical-comparison.xlsx','技术比价及报价版本.xlsx').catch(()=>setError('比价表下载失败，请刷新后重试。'))}>导出比价表</ActionButton>}>
      {!['all','rules'].includes(view)&&error&&<FeedbackNotice tone="error" message={error} />}
      {pack.sealed?<FeedbackNotice tone="info" message="报价封存中，开标后可查看逐项技术响应及历史版本。" />:<>
        {view!=='comparison'&&<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr>{['供应商','版本','含税总额','交期','发票类型','操作'].map(x=><th key={x} className="whitespace-nowrap p-3">{x}</th>)}</tr></thead><tbody>{current.map(v=><tr key={v.quoteId} className="border-b border-slate-100">
          <td className="p-3 font-bold">{supplierNames[v.snapshot.quote.supplierId]||v.snapshot.quote.supplierId}</td><td className="p-3">V{v.versionNo}</td><td className="p-3 font-mono">{money(v.snapshot.quote.amount)}</td><td className="p-3">{v.snapshot.quote.deliveryDays}天</td><td className="p-3">{v.snapshot.details?.invoiceType}</td><td className="p-3"><ActionButton onClick={()=>setSelected(v)}>详情</ActionButton></td>
        </tr>)}</tbody></table></div>}
        {!!current.length&&view!=='versions'&&<div className="mt-4 overflow-x-auto"><table className="w-full min-w-[1100px] table-fixed text-left text-sm"><thead className="bg-slate-50"><tr><th className="w-64 p-3">采购清单与要求</th>{current.map(v=><th key={v.quoteId} className="w-72 p-3">{supplierNames[v.snapshot.quote.supplierId]||v.snapshot.quote.supplierId} · V{v.versionNo}</th>)}</tr></thead>
          <tbody>{current[0].snapshot.quote.lineItems.map(line=><tr key={line.demandItemId} className="border-b border-slate-100 align-top"><td className="p-3"><strong>{line.description}</strong><p className="mt-1">{line.quantity}{line.unit}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-500">{items.find(item=>item.demandItemId===line.demandItemId)?.specification}</p></td>
            {current.map(v=>{const q=v.snapshot.quote.lineItems.find(item=>item.demandItemId===line.demandItemId),t=v.snapshot.details?.lines.find(item=>item.demandItemId===line.demandItemId);return <td key={v.quoteId} className="p-3"><strong className="font-mono">{q?money(q.unitPrice):'未报价'}</strong><p className="mt-2">{t?.brand} / {t?.model}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs text-slate-600">{t?.technicalParameters}</p><p className="mt-2 whitespace-pre-wrap break-words text-xs font-semibold">{t?.technicalResponse}</p></td>;})}
          </tr>)}</tbody></table></div>}
        {!current.length&&<p className="py-4 text-sm text-slate-500">暂无可查看的报价记录。</p>}
        {view!=='comparison'&&<div className="mt-4 flex flex-wrap gap-2">{pack.versions.map(v=><ActionButton key={`${v.quoteId}-${v.versionNo}`} onClick={()=>setSelected(v)}>{supplierNames[v.snapshot.quote.supplierId]||v.snapshot.quote.supplierId} · 轮{v.round}/V{v.versionNo}</ActionButton>)}</div>}
        {selected&&view!=='comparison'&&<div className="mt-4 border-t border-slate-200 pt-4">
          <h4 className="font-bold text-slate-900">{supplierNames[selected.snapshot.quote.supplierId]} · 第{selected.round}轮 · V{selected.versionNo}</h4>
          <p className="mt-1 text-xs text-slate-500">{new Date(selected.createdAt).toLocaleString('zh-CN')} · 提交人：{selected.actorId||'历史未留存'} · {selected.snapshot.details?.remark}</p>
          <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50"><tr>{['采购品名','数量/单位','含税单价','品牌/型号','技术参数','技术响应及偏离','行备注'].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead><tbody>{selected.snapshot.quote.lineItems.map(line=>{const tech=selected.snapshot.details?.lines.find(l=>l.demandItemId===line.demandItemId);return <tr key={line.demandItemId} className="border-b border-slate-100 align-top"><td className="p-3">{line.description}</td><td className="p-3">{line.quantity}{line.unit}</td><td className="p-3">{money(line.unitPrice)}</td><td className="p-3">{tech?.brand}<br/>{tech?.model}</td><td className="max-w-xs whitespace-pre-wrap break-words p-3">{tech?.technicalParameters}</td><td className="max-w-xs whitespace-pre-wrap break-words p-3">{tech?.technicalResponse}</td><td className="p-3">{tech?.remark}</td></tr>;})}</tbody></table></div>
          <div className="mt-3 flex flex-wrap gap-2">{selected.snapshot.details?.attachmentIds.map(id=>{const file=pack.files.find(f=>f.id===id);return <ActionButton key={id} icon={Download} onClick={()=>download(path+`/quotation-files/${id}`,file?.fileName||'报价附件').catch(()=>setError('附件下载核验失败。'))}>{file?.fileName||'附件'}</ActionButton>;})}</div>
        </div>}
      </>}
    </SectionCard>}
  </div>;
}
