import { axiosInstance } from '@24bid/api-client';

export type Rule = { id:string; title:string; type:'KEYWORD'|'MISSING'|'SEMANTIC'; perspective:'BUYER'|'SELLER'|'BOTH'; severity:'HIGH'|'MEDIUM'|'LOW'; matchMode:'ANY'|'ALL'; keywords:string[]; sourceName:string; clause:string; basis:string; suggestion:string };
export type RuleSet = { id:string; name:string; revision:number; rules:Rule[] };
export type RuleVersion = { id:string; setId:string; name:string; version:number; rules:Rule[]; createdBy:string; createdAt:string };
export type ReviewDocument = { id:string; contractId?:string|null; fileName:string; currentVersion:number; originalSha256:string; limitations:string[]; createdBy:string; createdAt:string };
export type TextVersion = { version:number; textSha256:string; segments:{locator:string;text:string}[]; createdBy:string; createdAt:string };
export type Finding = { id:string; ruleId:string; title:string; severity:Rule['severity']; origin:'MODEL'|'RULE'; locator:string|null; quote:string; explanation:string; suggestion:string; sourceName:string; clause:string; basis:string };
export type ReviewRun = { id:string; documentId:string; documentVersion:number; rulesVersionId:string; perspective:'BUYER'|'SELLER'; mode:string; model:string|null; limitation:string; findings:Finding[]; createdBy:string; actorName:string; createdAt:string };
export type Decision = { id:string; runId:string; findingId:string; action:'adopt'|'dismiss'; oldVersion:number; newVersion:number; locator:string|null; beforeText:string; afterText:string; comment:string; actorId:string; actorName:string; createdAt:string };
export type Workspace = { document:ReviewDocument; versions:TextVersion[]; runs:ReviewRun[]; decisions:Decision[] };
export const reviewBase='/api/v1/buyer/contract-review';
export async function reviewGet<T>(path:string):Promise<T>{return (await axiosInstance.get<{data:T}>(reviewBase+path)).data.data;}
export async function reviewPost<T>(path:string,data:unknown):Promise<T>{return (await axiosInstance.post<{data:T}>(reviewBase+path,data,{timeout:70000})).data.data;}
export const reviewError=(e:unknown)=>(e as {response?:{data?:{message?:string}}}).response?.data?.message||(e as Error).message||'操作失败，请重试';
export const reviewTime=(value:string)=>new Date(value).toLocaleString('zh-CN');
export const reviewField='w-full min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-800';
export const perspectiveName=(value:string)=>({BUYER:'甲方（采购方）',SELLER:'乙方（供应商）',BOTH:'双方通用'}[value]||value);
export const severityName=(value:string)=>({HIGH:'高风险',MEDIUM:'中风险',LOW:'提示'}[value]||value);
export async function reviewDownload(path:string,name:string){
  const data=await axiosInstance.get(reviewBase+path,{responseType:'blob'});const url=URL.createObjectURL(data.data);
  const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
export const exampleRules:Rule[]=[
  {id:'prepayment',title:'全额预付风险',type:'KEYWORD',perspective:'BUYER',severity:'HIGH',matchMode:'ALL',keywords:['预付','100%'],sourceName:'采购合同内部演示规则（非学校正式制度）',clause:'示例第1条',basis:'全额预付缺少验收及履约保障，采购方应复核付款前置条件。',suggestion:'付款：双方约定分阶段付款，预付款比例及履约保障经确认后写入合同，尾款在验收合格后支付。'},
  {id:'payment_delay',title:'供应商回款期限风险',type:'KEYWORD',perspective:'SELLER',severity:'MEDIUM',matchMode:'ALL',keywords:['验收','180日'],sourceName:'采购合同内部演示规则（非学校正式制度）',clause:'示例第2条',basis:'供应商应核实付款条件及期限的可执行性，避免不合理回款等待。',suggestion:'付款：验收合格且收到合法有效发票后，甲方于双方确认的合理期限内支付合同款项。'},
  {id:'confidentiality',title:'保密约定完整性',type:'MISSING',perspective:'BOTH',severity:'MEDIUM',matchMode:'ANY',keywords:['保密'],sourceName:'采购合同内部演示规则（非学校正式制度）',clause:'示例第3条',basis:'合同应明确双方接触采购资料、数据和商业信息时的保密责任及例外。',suggestion:'保密：双方对履约中获悉的非公开资料承担保密义务；依法披露的除外，具体范围与期限由双方确认。'},
  {id:'balanced_obligations',title:'履约义务及风险分配',type:'SEMANTIC',perspective:'BOTH',severity:'HIGH',matchMode:'ANY',keywords:[],sourceName:'采购合同内部演示规则（非学校正式制度）',clause:'示例第4条',basis:'结合所选甲乙方视角，复核验收、责任承担、单方变更或免责等约定是否清晰、对等且可执行；不得作违法认定。',suggestion:'结合原文及双方责任提出完整条款，由业务与法务确认后修订。'},
];
