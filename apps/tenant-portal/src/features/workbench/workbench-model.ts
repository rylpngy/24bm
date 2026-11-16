import type { AdminNavigationModule } from '@24bid/shared';
import { agencyRequest } from '@24bid/api-client';
export const procurementMethods = ['公开招标','邀请招标','竞争性谈判','竞争性磋商','询价','单一来源'];
export const workbenchGroups = {
  '工作台': ['dashboard', 'analytics', 'project-stats'],
  '项目管理': ['agency', 'owners', 'project-materials'],
  '文件与审批': ['documents', 'templates', 'announcements', 'approvals'],
  '执行与结项': ['execution', 'contracts', 'fees', 'project-archive'],
  '系统管理': ['process-engine', 'org', 'team', 'numbering-rules', 'ai-policies', 'audit'],
};

export const executionWorkspaces = [
  ['expert-draw', '专家抽取'],
  ['expert-attendance', '专家签到'],
  ['expert-scoring', '专家线上评分'],
  ['evaluation-files', '评标文件整理与核对'],
] as const;

export const workbenchModules: AdminNavigationModule[] = [
  {id:'dashboard',label:'首页看板',desc:'项目概况 · 今日开标 · 审批待办',requiredPermission:'buyer:agency:read'},
  {id:'analytics',label:'开标日历',desc:'每日场次 · 项目排期',requiredPermission:'buyer:agency:document:read'},
  {id:'project-stats',label:'项目统计',desc:'业主 · 负责人 · 项目状态',requiredPermission:'buyer:agency:read'},
  {id:'agency',label:'项目库',desc:'项目立项 · 负责人 · 资料',requiredPermission:'buyer:agency:read'},
  {id:'owners',label:'业主库',desc:'业主单位 · 联系人 · 关联项目',requiredPermission:'buyer:agency:read'},
  {id:'project-materials',label:'项目资料',desc:'分类附件 · 版本记录',requiredPermission:'buyer:agency:read'},
  {id:'documents',label:'招标文件库',desc:'新建编制 · 版本 · 文件审核',requiredPermission:'buyer:agency:document:read'},
  {id:'templates',label:'模板库',desc:'公司模板 · 项目模板 · 版本',requiredPermission:'buyer:agency:document:read'},
  {id:'announcements',label:'公告管理',desc:'公告编制 · 审核 · 发布',requiredPermission:'buyer:agency:document:read'},
  {id:'approvals',label:'智能审批',desc:'资料审核 · 二审三审 · 流转'},
  {id:'execution',label:'项目执行',desc:'专家抽取 · 签到 · 线上评分 · 文件核对',requiredPermission:'buyer:agency:read'},
  {id:'contracts',label:'合同管理',desc:'合同台账 · 审批 · 履约',requiredPermission:'buyer:contract:read'},
  {id:'fees',label:'费用管理',desc:'服务费 · 专家费 · 成本收支',requiredPermission:'buyer:agency:finance:read'},
  {id:'project-archive',label:'项目归档',desc:'归档清单 · 档案核对',requiredPermission:'buyer:agency:archive:read'},
  {id:'process-engine',label:'流程引擎',desc:'审批节点 · 表单 · 流程配置',requiredPermission:'buyer:role:manage'},
  {id:'org',label:'组织架构',desc:'部门 · 负责人 · 成员',requiredPermission:'buyer:role:manage'},
  {id:'team',label:'团队与权限',desc:'项目经理 · 审核角色 · 权限',requiredPermission:'buyer:role:manage'},
  {id:'numbering-rules',label:'编码规则',desc:'项目编号 · 年度流水',requiredPermission:'buyer:agency:configure'},
  {id:'ai-policies',label:'AI审查依据',desc:'制度版本 · 辅助复核依据',requiredPermission:'buyer:ai:manage'},
  {id:'audit',label:'审计日志',desc:'操作记录 · 审批留痕',requiredPermission:'buyer:audit:read'},
];
export const workbenchHref=(module:string,id?:string,tab?:string)=>'/?'+new URLSearchParams({module,...(id?{recordId:id}:{}),...(tab?{tab}: {})}).toString();
export const stateLabels: Record<string,string>={draft:'草稿',reviewing:'审核中',processing:'审核中',approved:'已通过',ready:'已生成',candidate:'候选稿',rejected:'已退回',withdrawn:'已撤回',published:'已发布',settled:'已结清',unsettled:'未结清',not_started:'未开始',in_progress:'执行中',closed:'已办结'};
export const fieldClass='rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800';
export const actionClass='inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40';
export const secondaryClass='inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40';
export type CalendarEvent={packageId:string;title:string;number?:string;procurementMethod:string;ownerName?:string;openingAt:string;venue?:string;day:string};
export type DocumentRow={packageId:string;title:string;number?:string;procurementMethod:string;documentId:string;kind:string;status:string;revisionId?:string;revisionStatus?:string;inputVersion?:number;createdAt?:string};
export const calendarQuery=(month:string)=>agencyRequest<CalendarEvent[]>('/workbench/calendar?'+new URLSearchParams({month}));
export function dayKey(date:Date){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function monthCells(month:string){const [y,m]=month.split('-').map(Number);const start=new Date(y,m-1,1,12);start.setDate(start.getDate()-(start.getDay()+6)%7);return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});}
