import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {executionRequest} from '@24bid/api-client';
import {Library} from 'lucide-react';
import {Panel,FeedbackNotice} from '@24bid/ui';
import {TemplatePanel,type Submit} from '../agency/agency-execution-panel';
import {WorkflowSubmitDialog} from '../workflow/workflow-submit-dialog';
import {useBuyerPermissions} from '../../lib/use-buyer-permissions';
import {procurementMethods,fieldClass} from './workbench-model';
export function TemplateLibraryPage(){
 const {can}=useBuyerPermissions(),client=useQueryClient(),[method,setMethod]=useState(procurementMethods[0]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[submit,setSubmit]=useState<Submit|null>(null),[key,setKey]=useState('');
 const run=async(fn:()=>Promise<unknown>)=>{setBusy(true);setError('');try{await fn();await client.invalidateQueries({queryKey:['agency-templates']});return true;}catch(e){setError(e instanceof Error?e.message:'操作失败');return false;}finally{setBusy(false);}};
 return <Panel title="模板库" icon={Library} subtitle="独立维护公司与项目模板，按采购方式引用已发布版本">
 <div className="mb-5"><label className="mr-3 text-sm text-slate-600" htmlFor="template-method">采购方式</label><select id="template-method" className={fieldClass} value={method} onChange={e=>setMethod(e.target.value)}>{procurementMethods.map(m=><option key={m}>{m}</option>)}</select></div>
 {error&&<FeedbackNotice tone="error" message={error}/>}
 <TemplatePanel key={method} pkg="" method={method} run={run} busy={busy} editable={can('buyer:agency:template:manage')} open={s=>{setKey(crypto.randomUUID());setSubmit(s);}}/>
 {submit&&<WorkflowSubmitDialog businessType="agency_template_publication" title="模板发布审核" busy={busy} submissionError={error||undefined} onClose={()=>setSubmit(null)} onSubmit={async formData=>{if(await run(()=>executionRequest(`/template-versions/${submit.id}/submit`,'POST',{idempotencyKey:key,formData})))setSubmit(null);}}><p className="text-sm text-slate-500">公司模板审核通过后可供项目引用。二审、三审节点由流程引擎配置。</p></WorkflowSubmitDialog>}
 </Panel>;
}
