export interface QuotationPolicy {fullQuoteRequired:boolean;autoExtend:boolean;extensionHours:number;maxAutoExtensions:number}
export interface TechnicalResponse {demandItemId:string;brand:string;model:string;technicalParameters:string;technicalResponse:string;remark?:string}
export interface FullQuotationDetails {invoiceType:string;remark?:string;attachmentIds:string[];lines:TechnicalResponse[]}
export interface QuotationLine {id?:string;demandItemId:string;description:string;unit:string;quantity:number;unitPrice:number;lineAmount:number}
export interface QuotationVersion {
  quoteId:string;versionNo:number;round:number;source:string;actorId?:string;createdAt:string;
  snapshot:{complete:boolean;details:FullQuotationDetails|null;quote:{id:string;supplierId:string;amount:number;taxRate:number;deliveryDays:number;lineItems:QuotationLine[]}};
}
export interface QuotationFile {id:string;fileName:string;contentSize:number;sha256:string;createdAt:string}
export interface QuotationExtension {id:string;round:number;oldDeadline:string;newDeadline:string;mode:string;validQuoteCount:number;reason:string;actorId?:string;createdAt:string}
export interface QuotationPackage {policy:QuotationPolicy;validQuoteCount:number;round:number;deadlineAt:string;versions:QuotationVersion[];files:QuotationFile[];extensions:QuotationExtension[];sealed:boolean;submittedSupplierIds?:string[]}
export function latestQuotationVersions(pack:QuotationPackage):QuotationVersion[]{
  const values=new Map<string,QuotationVersion>();
  pack.versions.filter(v=>v.round===pack.round).forEach(v=>{if((values.get(v.quoteId)?.versionNo??0)<v.versionNo)values.set(v.quoteId,v);});
  return [...values.values()].sort((a,b)=>a.snapshot.quote.amount-b.snapshot.quote.amount);
}
