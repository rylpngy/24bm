import { useQuery } from '@tanstack/react-query';
import { supplierTenderScoringRule } from '@24bid/api-client';
import { FeedbackNotice } from '@24bid/ui';
export function SupplierTenderScoringRule({tenderId}:{tenderId:string}) {
  const query=useQuery({queryKey:['supplier-tender-scoring-rule',tenderId],queryFn:()=>supplierTenderScoringRule(tenderId)});
  if(query.isLoading) return <p className="mt-2 text-xs text-slate-500">正在读取评审规则…</p>;
  if(query.isError||!query.data?.data) return <FeedbackNotice tone="error" message="评审规则读取失败，请刷新重试。"/>;
  const rule=query.data.data;
  return <div className="mt-3 border-b border-slate-100 pb-3 text-xs text-slate-700"><b>评审规则 · {rule.evaluationMethod} · {rule.revision?`版本 ${rule.revision}`:'默认规则'}</b>
    <p className="mt-1">{rule.evaluationMethod==='最低评标价法'?'按有效报价从低到高排序。':`技术均分×${rule.weights.technical}% + 商务均分×${rule.weights.commercial}% + 价格分×${rule.weights.price}%。价格分按最低有效报价折算。`}</p>
  </div>;
}
