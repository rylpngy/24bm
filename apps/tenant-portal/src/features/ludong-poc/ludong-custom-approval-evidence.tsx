import { useQuery } from '@tanstack/react-query';
import { FeedbackNotice } from '@24bid/ui';
import { ludongApi } from './api';

export function LudongCustomApprovalEvidence({applicationId,instanceId}:{applicationId:string;instanceId:string}) {
  const history=useQuery({queryKey:['ludong-poc','instance-history',instanceId],queryFn:()=>ludongApi.historyById(instanceId)});
  const records=useQuery({queryKey:['ludong-poc','review-records',applicationId,instanceId],queryFn:()=>ludongApi.reviewRecords(applicationId,instanceId)});
  if(history.isError||records.isError)return <FeedbackNotice tone="error" message="补充节点审批资料加载失败，请刷新后重试。" />;
  const evidence=(records.data??[]).flatMap((record)=>{
    const event=history.data?.events.find(item=>item.flowableTaskId===record.workflowTaskId&&['approved','rejected'].includes(item.action));
    if(!event||event.effective===false)return [];
    try{
      const data=JSON.parse(record.reviewDataJson);
      return data.customNodeOpinion?[{id:record.id,title:event.nodeName,actor:event.actorName||record.reviewerId,
        opinion:String(data.customNodeOpinion),comment:String(data.customNodeComment||'')}]:[];
    }catch{return [];}
  });
  if(!evidence.length)return null;
  return <section className="mt-5 border-t border-slate-200 pt-4">
    <h3 className="text-sm font-bold text-slate-900">补充节点审批意见</h3>
    <div className="divide-y divide-slate-100">{evidence.map(item=><article key={item.id} className="py-3 text-sm">
      <p className="font-bold text-slate-800">{item.title} · {item.actor} · {item.opinion}</p>
      {item.comment&&<p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{item.comment}</p>}
    </article>)}</div>
  </section>;
}
