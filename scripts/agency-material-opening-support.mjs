import assert from 'node:assert/strict';
import {baseUrl,requestJson} from './java-smoke-support.mjs';
export async function uploadReceiptVersion(versionId,name,bytes,headers){
 const data={ownerType:'agency_file_version',ownerId:versionId,fileName:name,visibility:'buyer_internal'};
 const ticket=await requestJson('/api/v1/buyer/attachments/upload-ticket',{method:'POST',headers:headers('creator'),body:JSON.stringify(data)});
 const response=await fetch(baseUrl+ticket.uploadUrl,{method:'POST',headers:{...headers('creator'),'content-type':'application/octet-stream'},body:Buffer.from(bytes)});assert.equal(response.status,200,await response.text());
 const attachment=await requestJson('/api/v1/buyer/attachments',{method:'POST',headers:headers('creator'),body:JSON.stringify({...data,storageKey:ticket.storageKey})});
 await requestJson('/api/v1/buyer/agency/file-versions/'+versionId+'/seal',{method:'POST',headers:headers('creator'),body:JSON.stringify({attachmentId:attachment.id})});return attachment;
}
export async function prepareMaterialOpening({call,headers,pkg,round,participantIds,proofId,clock,minimumSubjects=1}){
 const root=`/evaluation/packages/${pkg}/rounds/${round}/materials`,now=clock??Date.now();const config={cutoffAt:new Date(now-120000).toISOString(),notBefore:new Date(now-60000).toISOString(),minimumSubjects,ruleBasis:'合成共享核心回归规则；非真实采购依据',items:[{key:'response',title:'合成响应副本',required:true,readerRoles:['organizer','leader','qualification_reviewer','conformity_reviewer','review_member']}]};
 let plan=await call(root+'/plan','PUT',{expectedVersion:0,config,reason:'技术回归准备',idempotencyKey:crypto.randomUUID()});plan=await call(root+'/plan/confirm','POST',{expectedVersion:plan.version,reviewed:true,reason:'核对合成材料清单与时间',idempotencyKey:crypto.randomUUID()});
 const receipts=[];for(const id of participantIds){const row=await call(root+'/receipts','POST',{participationId:id,itemKey:'response',fileName:'合成响应副本.txt',receivedAt:new Date(now-300000).toISOString(),originalType:'electronic_copy',sourceNote:'合成技术测试数据，不代表供应商身份',note:'仅验证受控导入',lateEntryReason:'合成补录：实际接收时间已核对',idempotencyKey:crypto.randomUUID()});const version=row.file.versions[0];const attachment=await uploadReceiptVersion(version.id,'合成响应副本.txt','合成响应副本，非实际采购材料。',headers);receipts.push({row,version,attachment});}
 const preview=await call(root+'/preview','POST',{participationIds:participantIds});assert.equal(preview.blockers.length,0,JSON.stringify(preview.blockers));
 const opening=await call(root+'/open','POST',{expectedVersion:plan.version,participationIds:participantIds,previewFingerprint:preview.fingerprint,openedAt:new Date(clock??Date.now()).toISOString(),evidenceVersionId:proofId,reviewed:true,note:'合成技术测试：按清单核对后登记正式开启',idempotencyKey:crypto.randomUUID()});return {opening,receipts};
}
