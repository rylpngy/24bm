import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8098',out=resolve(root,'.ludong-tender-runtime/final-acceptance');
mkdirSync(out,{recursive:true});const requests=[],sessions=new Map();
async function api(path,token,method='GET',body,status=200){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const j=await r.json();assert.equal(r.status,status,`${method} ${path}: ${j.message}`);requests.push({path,method,status});return j.data;}
async function login(account){if(!sessions.has(account))sessions.set(account,(await api('/api/v1/auth/login',null,'POST',{account,password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc'})).accessToken);return sessions.get(account);}
const admin=await login('LDU000001'),applicant=await login('LDU100001');
const fixture=JSON.parse(readFileSync(resolve(root,'scripts/fixtures/ludong-tender-application.json'),'utf8'));
fixture.projectName='POC完整验收 教学终端与实验设备采购';fixture.budgetAmount=1;
Object.assign(fixture.formData,{technicalLeaderName:'技术与材料编制人',participants:'技术与材料编制人',
  mandatoryStandards:'按项目实际适用的强制标准执行（合成演示）',supplierQualifications:'按实际采购要求确认（合成演示）',
  acceptanceStandard:'逐台核验数量、参数与运行情况，形成验收记录。',packingRequirement:'防震、防潮包装，运输至指定地点。',
  afterSalesRequirement:'提供故障响应、现场服务及培训安排。',otherTechnicalRequirements:'提供中文使用说明和交付清单。',
  requiresItReview:'是',requiresItReviewMode:'manual',requiresItReviewReason:'演示清单包含教学终端，人工确认进入信息技术审核。',
  requiresAssetReview:'是',requiresAssetReviewMode:'manual',requiresAssetReviewReason:'演示清单包含办公桌、文件柜，人工确认进入资产审核。'});
function mall(name,qty,price,direction,model,materialId=''){
  return {materialId,name,catalogSource:materialId?'catalog':'custom',unit:'台',quantity:String(qty),unitPrice:String(price),
    technicalParameters:name.includes('终端')?'16GB内存，512GB固态硬盘，23.8英寸显示器':'满足对应场所使用要求，按实物核验尺寸及质量。',
    referenceBrands:'以实际调研为准（合成样本）',purpose:'改善教学和日常办公条件',usageDirection:direction,userName:'演示使用人',installationLocation:'演示教学楼A101',
    imported:'否',coreProduct:'否',governmentMallCatalog:'是',governmentMallCatalogMode:'manual',governmentMallCatalogReason:'仅用于商城目录演示，正式范围须核实。',
    selectedBrand:'演示品牌',selectedModel:model,selectedSupplier:'校采教学装备（演示）',supplierContact:'演示联系人',supplierPhone:'13800000000',
    selectedParameters:'按确认的规格与服务要求执行',selectedUnitPrice:String(price),standardUnitPrice:String(price),selectionParticipants:'技术与材料编制人'};
}
fixture.items=[mall('教学办公终端',20,6000,'教学','POC-PC','mat-ldu-teaching-terminal'),mall('办公桌',10,1800,'行政办公','POC-DESK'),
  mall('文件柜',10,1500,'行政办公','POC-CABINET'),mall('教学投影设备',1,6000,'教学','POC-PROJECTOR'),fixture.items[0]];
writeFileSync(resolve(out,'完整申报样本.json'),JSON.stringify(fixture,null,2));
const app=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',fixture);assert.equal(app.budgetAmount,329000);
const path=`/api/v1/buyer/ludong-poc/applications/${app.id}`;
const materials=[];
for(const [ownerType,fileName,text] of [
  ['ludong_poc_project_attachment','市场调研报告（合成）.txt','本演示采购清单总预算329000元，包含教学终端、办公家具、实验数据采集仪。'],
  ['ludong_poc_mall_confirmation','商城目录确认材料（合成）.txt','四项网上商城目录信息仅为本次合成演示，正式业务须核对有效目录和市场价格。'],
  ['ludong_poc_supplementary_evidence','安装现场说明（合成）.txt','演示地点具备安装条件；此文件不代表真实学校证明。']]){
  const meta={ownerType,ownerId:app.id,fileName,visibility:'buyer_internal'};
  const ticket=await api('/api/v1/buyer/attachments/upload-ticket',applicant,'POST',meta);
  const url=new URL(ticket.uploadUrl,base);assert.equal(url.origin,base);url.searchParams.set('contentType','text/plain');
  const bytes=Buffer.from(text);assert.equal((await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${applicant}`,'Content-Type':'application/octet-stream'},body:bytes})).status,200);
  const file=await api('/api/v1/buyer/attachments',applicant,'POST',{...meta,storageKey:ticket.storageKey},201);
  materials.push({id:file.id,fileName,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await api(path+'/submit',applicant,'POST');
const history=()=>api(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${app.id}/history`,admin);
const forms={
  argumentation_review:['LDU200001',{argumentationOpinion:'同意',argumentationComment:'设备更新需求明确，调研清单与教学任务相匹配（合成验收）。'}],
  technical_leader_review:['LDU200017',{technicalLeaderOpinion:'同意'}],
  compilation_participant_review:['LDU200017',{compilationParticipantOpinion:'同意'}],mall_selection_participant_review:['LDU200017',{mallSelectionParticipantOpinion:'同意'}],
  it_review:['LDU200002',{itReviewOpinion:'同意',itReviewComment:'确认终端参数与接入要求（合成验收）。'}],
  unit_review:['LDU200003',{applicantUnitOpinion:'同意'}],funding_review:['LDU200004',{fundingUnitOpinion:'同意'}],
  asset_configuration_review:['LDU200005',{exceedsPriceLimit:'否',exceedsQuantityLimit:'否',assetConfigurationOpinion:'同意',assetConfigurationComment:'配置数量及参考价格经人工确认（合成验收）。'}],
  asset_division_leader_review:['LDU200006',{assetDivisionLeaderOpinion:'同意'}],asset_unit_leader_review:['LDU200007',{assetUnitLeaderOpinion:'同意'}],
  lab_equipment_review:['LDU200008',{largeEquipmentSharing:'同意共享',labReviewOpinion:'同意'}],lab_division_leader_review:['LDU200009',{labDivisionLeaderOpinion:'同意'}],lab_unit_leader_review:['LDU200010',{labUnitLeaderOpinion:'同意'}],
  school_leader_review:['LDU200011',{schoolLeaderOpinion:'同意'}],finance_budget_review:['LDU200012',{financeBudgetStatus:'本项目已列入本年度学校预算'}],
  procurement_budget_review:['LDU200013',{procurementBudgetStatus:'本项目年初无采购预算，现已办理采购预算追加手续'}],
  handover_submit:['LDU100001',{handoverSubmitConfirmation:'材料完整，确认提交'}],handover_accept:['LDU200014',{handoverAcceptance:'材料齐全，确认受理'}],
  procurement_method_review:['LDU200015',{procurementMethod:'询价',procurementMethodComment:'仅为合成场景，不代表真实项目方式认定。'}],finance_responsible_review:['LDU200016',{financeResponsibleOpinion:'同意'}],
};
const handled=[];
for(let i=0;i<25;i++){const state=await history();if(state.status==='approved')break;assert.ok(state.currentTask,'流程缺少真实任务');const node=state.currentTask.taskDefinitionKey.replace(/^task_/,'');const form=forms[node];assert.ok(form,`未预期节点${node}，不擅自覆盖现有流程配置`);await api(`/api/v1/buyer/ludong-poc/tasks/${state.currentTask.taskId}/complete`,await login(form[0]),'POST',{applicationId:app.id,nodeId:state.currentTask.taskDefinitionKey,action:'approve',comment:'合成验收，按本岗位职责确认。',reviewData:form[1]});handled.push(node);}
const done=await history();assert.equal(done.status,'approved');
for(const node of ['it_review','asset_configuration_review','lab_equipment_review','school_leader_review','finance_responsible_review'])assert.ok(handled.includes(node),`未覆盖${node}`);
const reused=done.events.filter(e=>e.action==='approved'&&e.comment?.includes('系统自动复用结论'));assert.equal(reused.length,2);
const records=await api(path+`/approval-records?instanceId=${done.workflowInstanceId}`,admin);
for(const node of ['compilation_participant_review','mall_selection_participant_review'])assert.ok(records.some(r=>r.nodeId===node));
for(const [kind,name] of [['demand.docx','采购需求表.docx'],['application.docx','采购申请单.docx'],['archive.zip','完整项目归档.zip']]){
  const r=await fetch(base+path+`/documents/${kind}`,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(r.status,200);writeFileSync(resolve(out,name),Buffer.from(await r.arrayBuffer()));
}
const check=spawnSync('python3',['-c',`import sys,zipfile,hashlib,xml.etree.ElementTree as E
from pathlib import Path
p=Path(sys.argv[1]); ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
def text(b): return ''.join(E.fromstring(zipfile.ZipFile(__import__('io').BytesIO(b)).read('word/document.xml')).itertext())
a=(p/'采购申请单.docx').read_bytes(); d=(p/'采购需求表.docx').read_bytes()
root=E.fromstring(zipfile.ZipFile(__import__('io').BytesIO(a)).read('word/document.xml')); tables=root.findall('.//w:body/w:tbl',ns)
assert len(tables[1].findall('w:tr',ns))==6
assert len(tables[2].findall('w:tr',ns))==5, 'four mall rows must not be truncated'
s=text(a); assert 'POC-PROJECTOR' in s and '技术与材料编制人' in s and '☑ 本项目年初无采购预算' in s and '329000' in text(d)
z=zipfile.ZipFile(p/'完整项目归档.zip'); manifest=z.read('00-归档材料清单.txt').decode(); assert 'SHA-256:' in manifest
for name,word in [('市场调研报告','329000'),('商城目录确认材料','四项'),('安装现场说明','具备安装条件')]:
 entry=next(n for n in z.namelist() if name in n); assert word in z.read(entry).decode(); assert hashlib.sha256(z.read(entry)).hexdigest() in manifest
print('PASS: all rows, choices, signatures and three actual attachment categories')`,out],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
const ready=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',{...fixture,projectName:'POC现场填报 教学终端与实验设备采购'});
const pending=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',{...fixture,projectName:'POC现场审批 教学终端与实验设备采购'});
await api(`/api/v1/buyer/ludong-poc/applications/${pending.id}/submit`,applicant,'POST');
writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'PASS',at:new Date().toISOString(),applicationId:app.id,applicationNo:app.applicationNo,readyDraftId:ready.id,pendingId:pending.id,workflowInstanceId:done.workflowInstanceId,handled,reused:reused.map(e=>({nodeId:e.nodeId,actorId:e.actorId})),materials,requests},null,2));
console.log(`PASS: ${requests.length} HTTP requests; ${handled.length} manual nodes, ${reused.length} employee-reused nodes; full Word/ZIP and ready samples. ${app.applicationNo}`);
