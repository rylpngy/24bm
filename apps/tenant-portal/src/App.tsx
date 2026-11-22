import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {ShieldAlert} from 'lucide-react';
import {hasPermission} from '@24bid/shared';
import {useSessionPermissions} from '@24bid/api-client';
import {AppShell,FeedbackNotice,Panel} from '@24bid/ui';
import {useAuthStore} from './lib/auth-store';
import {PageErrorBoundary} from './lib/page-error-boundary';
import {workbenchGroups,workbenchModules} from './features/workbench/workbench-model';
import {WorkbenchLoginPage} from './features/workbench/workbench-login-page';
const Dashboard=lazy(()=>import('./features/workbench/agency-dashboard-page').then(m=>({default:m.AgencyDashboardPage})));
const Calendar=lazy(()=>import('./features/workbench/opening-calendar-page').then(m=>({default:m.OpeningCalendarPage})));
const Documents=lazy(()=>import('./features/workbench/document-library-page').then(m=>({default:m.DocumentLibraryPage})));
const Templates=lazy(()=>import('./features/workbench/template-library-page').then(m=>({default:m.TemplateLibraryPage})));
const Business=lazy(()=>import('./features/workbench/project-business-page').then(m=>({default:m.ProjectBusinessPage})));
const Projects=lazy(()=>import('./features/agency/agency-page').then(m=>({default:m.AgencyPage})));
const Approvals=lazy(()=>import('./features/approvals/approvals-page').then(m=>({default:m.ApprovalsPage})));
const Contracts=lazy(()=>import('./features/contracts/contracts-page').then(m=>({default:m.ContractsPage})));
const Process=lazy(()=>import('./features/process/process-engine-page').then(m=>({default:m.ProcessEnginePage})));
const Org=lazy(()=>import('./features/org/org-structure-page').then(m=>({default:m.OrgStructurePage})));
const Team=lazy(()=>import('./features/team/team-page').then(m=>({default:m.TeamPage})));
const Policies=lazy(()=>import('./features/ai/ai-policies-page').then(m=>({default:m.AiPoliciesPage})));
const Audit=lazy(()=>import('./features/audit/audit-page').then(m=>({default:m.AuditPage})));
const Numbering=lazy(()=>import('./features/workbench/workbench-numbering-page').then(m=>({default:m.WorkbenchNumberingPage})));
const initialModule=()=>new URLSearchParams(location.search).get('module')||'dashboard';
function Loading(){return <p role="status" className="p-6 text-sm text-slate-500">正在加载工作台…</p>;}
export function App(){return <PageErrorBoundary><TenantWorkbench/></PageErrorBoundary>;}
function TenantWorkbench(){
 const session=useAuthStore(s=>s.session),signOut=useAuthStore(s=>s.signOut),[active,setActive]=useState(initialModule);
 const q=useSessionPermissions(session?.userId),permissions=q.isError?[]:q.data?.data?.permissions??[];
 const granted=permissions.join(',');
 const modules=useMemo(()=>workbenchModules.filter(m=>!m.requiredPermission||hasPermission(granted.split(','),m.requiredPermission)),[granted]);
 const select=(id:string)=>{setActive(id);const u=new URL(location.href);u.search='';u.searchParams.set('module',id);history.pushState(null,'',u);};
 useEffect(()=>{const pop=()=>setActive(initialModule());window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[]);
 useEffect(()=>{if(session&&q.isSuccess&&!modules.some(m=>m.id===active)&&modules.length)select(modules[0].id);},[active,session,q.isSuccess,modules]);
 if(!session||new URLSearchParams(location.search).get('portal')==='1')return <WorkbenchLoginPage/>;
 if(q.isPending)return <Loading/>;
 if(q.isError)return <div className="p-6"><FeedbackNotice tone="error" message="权限加载失败，请重试。"/><button onClick={()=>void q.refetch()}>重新加载</button></div>;
 const permitted=modules.some(m=>m.id===active),title=modules.find(m=>m.id===active)?.label||'业务工作台';
 return <AppShell brandName="24Bm" mainlineLabel="业务主线" isolationHint="项目资料、文件版本与费用记录按企业及项目授权范围访问。" brandSubtitle="招标代理业务工作台" mainlineHint="项目立项 → 文件编审 → 开评标 → 合同费用 → 归档" modules={modules} moduleGroups={workbenchGroups} activeModuleId={active} onSelectModule={select} title={title} accountLabel={session.displayName} onSignOut={signOut}>
  <PageErrorBoundary key={active}><Suspense fallback={<Loading/>}>{!permitted?<Panel title="访问受限" icon={ShieldAlert}><FeedbackNotice tone="error" message="当前账号暂无该模块权限，请联系管理员。"/></Panel>:
   active==='dashboard'?<Dashboard/>:active==='analytics'?<Calendar/>:active==='agency'?<Projects/>:active==='project-materials'?<Business mode="materials"/>:active==='project-archive'?<Business mode="archive"/>:active==='project-stats'||active==='owners'?<Panel title={title} icon={ShieldAlert}><FeedbackNotice tone="info" message={active==='owners'?'业主台账待接入。当前可在项目库查看项目已有的采购人信息。':'项目统计待接入。当前可通过项目库查看项目清单。'}/><a className="mt-3 inline-block text-sm text-blue-700" href="/?module=agency">打开项目库 →</a></Panel>:active==='documents'?<Documents/>:active==='announcements'?<Documents kind="announcement"/>:active==='templates'?<Templates/>:active==='execution'?<Business mode="execution"/>:active==='fees'?<Business mode="fees"/>:active==='approvals'?<Approvals/>:active==='contracts'?<Contracts/>:active==='process-engine'?<Process/>:active==='org'?<Org/>:active==='team'?<Team/>:active==='numbering-rules'?<Numbering/>:active==='ai-policies'?<Policies/>:active==='audit'?<Audit/>:null}</Suspense></PageErrorBoundary>
 </AppShell>;
}
