import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminNavigationModule } from '@24bid/shared';
import {
  ActionButton, AppShell, DetailHeroCard, EmptyState, FeedbackNotice, FilterTabs,
  MetricCard, MetricGrid, PageHeader, Pagination, Panel, PrimaryActionButton,
  ResponsiveTableFrame, SearchInput, SectionCard, StatusPill,
} from '@24bid/ui';
import {
  Archive, ArrowRight, BarChart3, Building2, CheckCircle2, ClipboardCheck,
  ClipboardList, Download, Clock3, FileArchive, FilePlus2, FileText, History,
  ListChecks, PackageOpen, Pencil, Plus, Send, Settings2, TrendingUp,
  WalletCards, Workflow,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from 'recharts';
import { useAuthStore } from '../../lib/auth-store';
import { ProcessEnginePage } from '../process/process-engine-page';
import { OrgStructurePage } from '../org/org-structure-page';
import { TeamPage } from '../team/team-page';
import { LudongPocLogin } from './ludong-poc-login';
import { LudongPocForm, type LudongFormPayload } from './ludong-poc-form';
import { LudongPocArchiveMaterials } from './ludong-poc-archive-materials';
import { createTaskReviewData, LudongPocApprovalDialog } from './ludong-poc-approval-dialog';
import { ludongApi, type LudongApplication, type WorkflowHistory, type WorkflowTask } from './api';
import { availableReportYears, buildLudongAnalytics, type ReportPeriod } from './ludong-poc-analytics';
import { buildLudongWorkflowProgress, workflowProgressCounts, type WorkflowProgressNode } from './workflow-progress';

type ModuleId = 'dashboard' | 'applications' | 'approvals' | 'workflow-config' | 'org' | 'team' | 'archive' | 'stats';
type Screen = { type: 'list' } | { type: 'form'; application?: LudongApplication } | { type: 'detail'; application: LudongApplication };

const modules: AdminNavigationModule[] = [
  { id: 'dashboard', label: '首页看板', desc: '申报、待办与归档概览' },
  { id: 'applications', label: '项目申报', desc: '货物类采购材料填报与提交' },
  { id: 'approvals', label: '审批中心', desc: '当前待办与已审批记录' },
  { id: 'workflow-config', label: '流程配置', desc: '审批节点、办理岗位与条件规则' },
  { id: 'org', label: '组织架构', desc: '学校部门树、负责人和成员' },
  { id: 'team', label: '用户与权限', desc: '工号账号、角色与数据权限' },
  { id: 'archive', label: '表格归档', desc: '原始模板单表与整包下载' },
  { id: 'stats', label: '数据统计', desc: '单位、项目和预算汇总' },
];

const statusLabels: Record<LudongApplication['status'], string> = {
  draft: '草稿', in_approval: '审批中', approved: '已通过', rejected: '已驳回', archived: '已归档',
};
function initialModule(): ModuleId {
  const value = new URLSearchParams(window.location.search).get('module') as ModuleId | null;
  return modules.some((item) => item.id === value) ? value! : 'dashboard';
}

export function LudongPocApp() {
  const session = useAuthStore((state) => state.session);
  const signOut = useAuthStore((state) => state.signOut);
  const [moduleId, setModuleId] = useState<ModuleId>(initialModule);
  const [screen, setScreen] = useState<Screen>({ type: 'list' });

  const isAdmin = session?.userId === 'user-ldu-admin';
  const visibleModules = useMemo(
    () => isAdmin ? modules : modules.filter((item) => !['org', 'team'].includes(item.id)),
    [isAdmin],
  );

  useEffect(() => {
    if (!visibleModules.some((item) => item.id === moduleId)) setModuleId('dashboard');
  }, [moduleId, visibleModules]);

  if (!session || session.tenantId !== 'tenant-ludong-poc') return <LudongPocLogin />;

  const navigate = (id: string) => {
    const next = id as ModuleId;
    setModuleId(next);
    setScreen({ type: 'list' });
    const url = new URL(window.location.href);
    url.searchParams.set('solution', 'ludong-poc');
    url.searchParams.set('module', next);
    window.history.replaceState(null, '', url);
  };

  const openApplicationScreen = (nextScreen: Screen) => {
    setModuleId('applications');
    setScreen(nextScreen);
    const url = new URL(window.location.href);
    url.searchParams.set('solution', 'ludong-poc');
    url.searchParams.set('module', 'applications');
    window.history.replaceState(null, '', url);
  };

  return (
    <AppShell
      brandSubtitle="鲁东大学采购申报"
      mainlineHint="项目填报 - 分级审批 - 表格生成 - 材料归档"
      modules={visibleModules}
      activeModuleId={moduleId}
      onSelectModule={navigate}
      title={visibleModules.find((item) => item.id === moduleId)?.label ?? '首页看板'}
      accountLabel={`${session.displayName} · 鲁东大学 POC`}
      onSignOut={signOut}
    >
      {moduleId === 'dashboard' && (
        <Dashboard
          onNavigate={navigate}
          onNewApplication={() => openApplicationScreen({ type: 'form' })}
          onOpenApplication={(application, edit = false) => openApplicationScreen(edit ? { type: 'form', application } : { type: 'detail', application })}
        />
      )}
      {moduleId === 'applications' && <Applications screen={screen} setScreen={setScreen} />}
      {moduleId === 'approvals' && <Approvals />}
      {moduleId === 'workflow-config' && (
        isAdmin ? <LudongWorkflowConfiguration /> : <WorkflowConfigurationAccess />
      )}
      {moduleId === 'org' && isAdmin && <OrgStructurePage requireEmployeeNo />}
      {moduleId === 'team' && isAdmin && <TeamPage requireEmployeeNo />}
      {moduleId === 'archive' && <ArchivePage />}
      {moduleId === 'stats' && <StatsPage />}
    </AppShell>
  );
}

function LudongWorkflowConfiguration() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="采购申报审批流程配置"
        subtitle="自定义审批节点、办理岗位和条件分支，发布后由 Flowable 按版本执行。"
      />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: '节点可配置', description: '按业务需要增加、删除或调整审批节点', icon: ClipboardCheck },
          { title: '办理人可配置', description: '支持指定用户、候选角色或发起部门主管', icon: Settings2 },
          { title: '条件可配置', description: '按金额、部门或表单字段自动选择审批路径', icon: BarChart3 },
        ].map((item) => {
          const Icon = item.icon;
          return <div key={item.title} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Icon size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{item.description}</p>
            </div>
          </div>;
        })}
      </div>
      <ProcessEnginePage
        fixedBusinessType="ludong_project_application"
        scopeTitle="货物类采购申报流程"
        scopeDescription="修改草稿不影响已在办实例；发布新版本后，新发起的申报将按新流程执行。"
        initialTab="flow"
      />
    </div>
  );
}

function WorkflowConfigurationAccess() {
  return (
    <div className="space-y-5">
      <PageHeader title="采购申报审批流程配置" subtitle="审批流程由平台按发布版本运行。" />
      <FeedbackNotice tone="info" message="当前岗位可查看审批进度，但不能修改流程定义。请使用“POC 管理员”账号进入本页配置审批节点、办理人和条件规则。" />
      <SectionCard title="权限边界">
        <p className="mb-3 text-xs font-bold text-slate-400">流程配置与业务审批分权管理</p>
        <div className="grid gap-3 md:grid-cols-3">
          {['审批人只办理分配给本岗位的任务', '管理员维护流程草稿并发布新版本', '已在办实例始终使用发起时的流程版本'].map((item, index) => (
            <div key={item} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[11px] font-black text-white">{index + 1}</span>
              <p className="text-xs font-bold leading-5 text-slate-600">{item}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function Dashboard({
  onNavigate,
  onNewApplication,
  onOpenApplication,
}: {
  onNavigate: (id: string) => void;
  onNewApplication: () => void;
  onOpenApplication: (application: LudongApplication, edit?: boolean) => void;
}) {
  const stats = useQuery({ queryKey: ['ludong-poc', 'stats'], queryFn: ludongApi.stats });
  const apps = useQuery({ queryKey: ['ludong-poc', 'applications'], queryFn: ludongApi.list });
  const tasks = useQuery({ queryKey: ['ludong-poc', 'tasks'], queryFn: ludongApi.tasks });
  const pending = (tasks.data ?? []).filter((task) => task.businessType === 'ludong_project_application');
  const values = stats.data;
  const applications = apps.data ?? [];
  const applicationById = new Map(applications.map((application) => [application.id, application]));
  const statusOverview = [
    { key: 'draft', label: '草稿', count: applications.filter((item) => item.status === 'draft').length, bar: 'bg-slate-400' },
    { key: 'rejected', label: '已驳回', count: applications.filter((item) => item.status === 'rejected').length, bar: 'bg-rose-500' },
    { key: 'in_approval', label: '审批中', count: applications.filter((item) => item.status === 'in_approval').length, bar: 'bg-amber-500' },
    { key: 'approved', label: '已通过', count: applications.filter((item) => item.status === 'approved').length, bar: 'bg-emerald-500' },
    { key: 'archived', label: '已归档', count: applications.filter((item) => item.status === 'archived').length, bar: 'bg-blue-500' },
  ];
  const maxStatusCount = Math.max(1, ...statusOverview.map((item) => item.count));
  const unitRanking = Array.from(applications.reduce((result, application) => {
    const current = result.get(application.applicantUnit) ?? { count: 0, budget: 0 };
    result.set(application.applicantUnit, { count: current.count + 1, budget: current.budget + application.budgetAmount });
    return result;
  }, new Map<string, { count: number; budget: number }>()).entries())
    .map(([unit, summary]) => ({ unit, ...summary }))
    .sort((left, right) => right.budget - left.budget)
    .slice(0, 5);
  const maxUnitBudget = Math.max(1, ...unitRanking.map((item) => item.budget));
  const quickActions = [
    { label: '新建项目申报', hint: '填写采购项目和设备明细', icon: FilePlus2, onClick: onNewApplication, accent: 'bg-blue-50 text-blue-700' },
    { label: '处理我的待办', hint: `${pending.length} 项审批任务待处理`, icon: ListChecks, onClick: () => onNavigate('approvals'), accent: 'bg-amber-50 text-amber-700' },
    { label: '项目申报台账', hint: `${applications.length} 个项目的填报与进度`, icon: ClipboardList, onClick: () => onNavigate('applications'), accent: 'bg-cyan-50 text-cyan-700' },
    { label: '审批流程配置', hint: '节点、办理岗位与条件规则', icon: Workflow, onClick: () => onNavigate('workflow-config'), accent: 'bg-violet-50 text-violet-700' },
    { label: '表格与材料归档', hint: '生成原始表格并打包下载', icon: FileArchive, onClick: () => onNavigate('archive'), accent: 'bg-emerald-50 text-emerald-700' },
    { label: '数据统计分析', hint: '单位、预算与审批效率', icon: BarChart3, onClick: () => onNavigate('stats'), accent: 'bg-rose-50 text-rose-700' },
  ];
  return (
    <div className="space-y-5">
      <PageHeader title="货物类项目采购申报工作台" subtitle="统一填报、分级审批、表格生成与材料归档。" actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ActionButton icon={ClipboardCheck} size="md" onClick={() => onNavigate('approvals')}>审批中心</ActionButton>
          <PrimaryActionButton icon={Plus} size="md" flushTop onClick={onNewApplication}>新建项目申报</PrimaryActionButton>
        </div>
      } />
      <MetricGrid columns={5}>
        <MetricCard icon={ClipboardList} label="申报总数" value={String(values?.total ?? 0)} hint="全部项目" />
        <MetricCard icon={FileText} label="待完善" value={String(values?.drafts ?? 0)} hint="草稿与驳回" tone="slate" />
        <MetricCard icon={ClipboardCheck} label="审批中" value={String(values?.inApproval ?? 0)} hint="Flowable 运行中" tone="amber" />
        <MetricCard icon={CheckCircle2} label="待我办理" value={String(pending.length)} hint="当前账号待办" tone="violet" />
        <MetricCard icon={WalletCards} label="申报预算" value={currency(values?.totalBudget)} hint={`已归档 ${values?.archived ?? 0} 项`} tone="emerald" />
      </MetricGrid>

      <section aria-labelledby="dashboard-quick-actions">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 id="dashboard-quick-actions" className="font-black text-slate-950">快捷办理</h2><p className="mt-1 text-xs font-bold text-slate-400">高频业务一步直达</p></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.label} type="button" onClick={item.onClick} className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left shadow-sm shadow-slate-200/40 transition hover:border-blue-200 hover:shadow-md">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.accent}`}><Icon size={19} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-slate-900">{item.label}</span><span className="mt-0.5 block truncate text-xs font-bold text-slate-400">{item.hint}</span></span>
                <ArrowRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" />
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Panel title="最近申报" icon={ClipboardList} subtitle="最近创建或更新的项目材料" action={<ActionButton onClick={() => onNavigate('applications')}>查看全部</ActionButton>}>
          <div className="divide-y divide-slate-100">
            {applications.slice(0, 6).map((app) => (
              <div key={app.id} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><FileText size={17} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{app.projectName}</p><p className="mt-1 truncate text-xs font-bold text-slate-400">{app.applicationNo} · {app.applicantUnit}</p></div>
                <Status applicationStatus={app.status} />
                <ActionButton onClick={() => onOpenApplication(app, ['draft', 'rejected'].includes(app.status))}>{['draft', 'rejected'].includes(app.status) ? '继续填写' : '详情'}</ActionButton>
              </div>
            ))}
            {!apps.isLoading && !apps.data?.length && <EmptyState title="尚未创建项目申报" />}
          </div>
        </Panel>
        <Panel title="我的待办" icon={ListChecks} subtitle={`当前账号共 ${pending.length} 项待办任务`} action={<ActionButton onClick={() => onNavigate('approvals')}>进入审批中心</ActionButton>}>
          <div className="divide-y divide-slate-100">
            {pending.slice(0, 5).map((task) => {
              const application = applicationById.get(task.businessId);
              return (
                <div key={task.taskId} className="flex min-w-0 items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><Clock3 size={17} /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{application?.projectName ?? '采购项目审批'}</p><p className="mt-1 truncate text-xs font-bold text-slate-400">{task.taskName}</p></div>
                  <ArrowRight size={15} className="shrink-0 text-slate-300" />
                </div>
              );
            })}
            {!tasks.isLoading && pending.length === 0 && <EmptyState icon={CheckCircle2} title="当前没有待办任务" description="新任务到达后会在这里显示" />}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="项目状态概览" icon={TrendingUp} subtitle="当前申报项目所处环节">
          <div className="space-y-3">
            {statusOverview.map((item) => (
              <div key={item.key} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-3">
                <span className="text-xs font-black text-slate-600">{item.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${item.bar}`} style={{ width: `${Math.max(item.count ? 8 : 0, item.count / maxStatusCount * 100)}%` }} /></div>
                <span className="text-right font-mono text-xs font-black text-slate-800">{item.count}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="申报单位预算" icon={Building2} subtitle="按申报预算金额排序" action={<ActionButton onClick={() => onNavigate('stats')}>查看分析</ActionButton>}>
          <div className="space-y-3">
            {unitRanking.map((item, index) => (
              <div key={item.unit} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className="font-mono text-xs font-black text-slate-400">{index + 1}</span>
                <div className="min-w-0"><div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-black text-slate-700">{item.unit}</p><p className="shrink-0 font-mono text-xs font-black text-slate-900">{currency(item.budget)}</p></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${item.budget / maxUnitBudget * 100}%` }} /></div></div>
                <StatusPill label={`${item.count} 项`} />
              </div>
            ))}
            {!apps.isLoading && unitRanking.length === 0 && <EmptyState icon={Building2} title="暂无单位申报数据" />}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Applications({ screen, setScreen }: { screen: Screen; setScreen: (screen: Screen) => void }) {
  const queryClient = useQueryClient();
  const applications = useQuery({ queryKey: ['ludong-poc', 'applications'], queryFn: ludongApi.list });
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: ({ payload, id }: { payload: LudongFormPayload; id?: string }) => id ? ludongApi.update(id, payload) : ludongApi.create(payload as never),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ludong-poc'] }); setScreen({ type: 'list' }); setError(''); },
    onError: (reason) => setError(apiError(reason)),
  });
  const submit = useMutation({
    mutationFn: ludongApi.submit,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ludong-poc'] }),
    onError: (reason) => setError(apiError(reason)),
  });

  if (screen.type === 'form') return <LudongPocForm initial={screen.application} busy={save.isPending} error={error} onBack={() => setScreen({ type: 'list' })} onSave={(payload) => save.mutate({ payload, id: screen.application?.id })} />;
  if (screen.type === 'detail') return <ApplicationDetail application={screen.application} onBack={() => setScreen({ type: 'list' })} />;

  const filtered = (applications.data ?? []).filter((item) => !keyword || `${item.projectName}${item.applicationNo}${item.applicantUnit}`.toLowerCase().includes(keyword.toLowerCase()));
  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const actions = (app: LudongApplication, compact = false) => (
    <div className="flex flex-nowrap items-center justify-end gap-2">
      <ActionButton onClick={() => setScreen({ type: 'detail', application: app })}>详情</ActionButton>
      {['draft', 'rejected'].includes(app.status) && <>
        <ActionButton icon={compact ? undefined : Pencil} onClick={() => setScreen({ type: 'form', application: app })}>编辑</ActionButton>
        <PrimaryActionButton icon={compact ? undefined : Send} flushTop busy={submit.isPending} pendingLabel="提交中" onClick={() => submit.mutate(app.id)}>提交</PrimaryActionButton>
      </>}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="项目申报" subtitle="采购需求表与采购申请单共用同一份项目数据。" actions={<PrimaryActionButton icon={Plus} size="md" flushTop onClick={() => setScreen({ type: 'form' })}>新建申报</PrimaryActionButton>} />
      {error && <FeedbackNotice tone="error" message={error} />}
      <Panel title="申报项目列表" icon={ClipboardList} subtitle={`共 ${filtered.length} 条申报记录`} action={<SearchInput onSearch={(value) => { setKeyword(value); setPage(1); }} placeholder="搜索名称、编号或单位" className="mb-0" />}>
        <ResponsiveTableFrame mobileCards={rows.map((app, index) => (
          <article key={app.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[11px] font-black text-slate-400">{(safePage - 1) * pageSize + index + 1} · {app.applicationNo}</p><p className="mt-1 truncate text-sm font-black text-slate-950">{app.projectName}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{app.applicantUnit} · 设备 {app.items.length} 项</p></div><Status applicationStatus={app.status} /></div>
            <p className="mt-3 font-mono text-base font-black text-slate-950">{currency(app.budgetAmount)}</p><div className="mt-4 border-t border-slate-100 pt-3">{actions(app)}</div>
          </article>
        ))}>
          <table className="w-full min-w-[960px] table-fixed text-left">
            <thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="w-14 px-4 py-3">序号</th><th className="w-44 px-4 py-3">申报编号</th><th className="px-4 py-3">项目名称</th><th className="w-36 px-4 py-3">申报单位</th><th className="w-32 px-4 py-3">预算金额</th><th className="w-24 px-4 py-3">状态</th><th className="w-52 px-4 py-3 text-right">操作</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((app, index) => (
              <tr key={app.id} className="text-sm hover:bg-slate-50/70">
                <td className="px-4 py-4 font-bold text-slate-400">{(safePage - 1) * pageSize + index + 1}</td><td className="truncate px-4 py-4 font-mono text-xs font-bold text-slate-600">{app.applicationNo}</td>
                <td className="px-4 py-4"><p className="truncate font-black text-slate-950">{app.projectName}</p><p className="mt-1 text-xs font-bold text-slate-400">设备明细 {app.items.length} 项</p></td><td className="truncate px-4 py-4 font-semibold text-slate-600">{app.applicantUnit}</td>
                <td className="px-4 py-4 font-mono font-black text-slate-950">{currency(app.budgetAmount)}</td><td className="px-4 py-4"><Status applicationStatus={app.status} /></td><td className="px-4 py-4">{actions(app, true)}</td>
              </tr>
            ))}</tbody>
          </table>
        </ResponsiveTableFrame>
        {!applications.isLoading && rows.length === 0 && <EmptyState title="没有符合条件的项目申报" />}
        <Pagination page={safePage} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
      </Panel>
    </div>
  );
}

function ApplicationDetail({ application, onBack }: { application: LudongApplication; onBack: () => void }) {
  const fresh = useQuery({ queryKey: ['ludong-poc', 'application', application.id], queryFn: () => ludongApi.get(application.id) });
  const history = useQuery({ queryKey: ['ludong-poc', 'history', application.id], queryFn: () => ludongApi.history(application.id) });
  const app = fresh.data ?? application;
  const downloadable = ['approved', 'archived'].includes(app.status);
  return (
    <div className="space-y-5">
      <PageHeader title={app.projectName} subtitle={`${app.applicationNo} · ${app.applicantUnit}`} onBack={onBack} meta={<Status applicationStatus={app.status} />} actions={downloadable ? <>
        <ActionButton icon={Download} onClick={() => ludongApi.downloadDemand(app.id)}>需求表</ActionButton><ActionButton icon={Download} onClick={() => ludongApi.downloadApplication(app.id)}>申请单</ActionButton><PrimaryActionButton icon={Archive} flushTop onClick={() => ludongApi.downloadArchive(app.id)}>打包归档</PrimaryActionButton>
      </> : undefined} />
      <DetailHeroCard eyebrow="货物类采购项目" title={app.projectName} meta={`${app.applicationNo} · 创建于 ${formatDate(app.createdAt)}`} status={statusLabels[app.status]} amountLabel={currency(app.budgetAmount)} facts={[
        { label: '申报单位', value: app.applicantUnit }, { label: '项目负责人', value: app.formData.projectLeaderName || '—' }, { label: '经费来源', value: app.formData.fundingSource || '—' }, { label: '采购方式', value: app.formData.procurementMethod || '—' },
      ]} />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_.85fr]">
        <div className="space-y-5">
          <SectionCard title="项目基础信息" icon={ClipboardList}><InfoGrid items={[
            ['申报编号', app.applicationNo], ['申报单位', app.applicantUnit], ['经费项目', app.formData.fundingProjectName || '—'], ['经费项目编号', app.formData.fundingProjectNo || '—'], ['项目负责人', app.formData.projectLeaderName || '—'], ['联系电话', app.formData.projectLeaderPhone || '—'],
          ]} /></SectionCard>
          <SectionCard title="拟采购设备清单" icon={WalletCards} extra={<StatusPill label={`${app.items.length} 项`} />}><div className="space-y-3">{app.items.map((item, index) => (
            <div key={`${item.name}-${index}`} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-[2rem_minmax(0,1fr)_7rem_9rem] md:items-center"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-xs font-black text-white">{index + 1}</span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{item.name}</p><p className="mt-1 line-clamp-2 text-xs font-bold leading-5 text-slate-500">{item.technicalParameters || item.purpose || '未填写用途或技术参数'}</p></div><p className="text-xs font-bold text-slate-600">数量 {item.quantity}</p><p className="font-mono text-sm font-black text-slate-950">{Number(item.totalPrice || 0) > 0 ? currency(Number(item.totalPrice)) : '论证后核价'}</p></div>
          ))}</div></SectionCard>
          <SectionCard title="采购需求摘要" icon={FileText}><InfoGrid items={[
            ['采购目标', app.formData.procurementGoal || '—'], ['实施地点', app.formData.implementationLocation || '—'], ['核心产品', app.formData.coreProduct || '—'], ['交付期限', `${app.formData.deliveryDays || '—'} 天`], ['质保期', `${app.formData.warrantyYears || '—'} 年`], ['验收标准', app.formData.acceptanceStandard || '—'],
          ]} /></SectionCard>
          <ApprovalSummary app={app} />
        </div>
        <div className="space-y-5">
          <WorkflowCard history={history.data} loading={history.isLoading} />
          <RouteDecisionSummary app={app} />
          <SectionCard title="系统生成表格" icon={FileArchive}><div className="space-y-2"><DocumentRow name="采购需求表（货物类）" ready={downloadable} /><DocumentRow name="采购及招标申请单、受理单" ready={downloadable} /></div></SectionCard>
        </div>
      </div>
      <SectionCard title="统一附件台账" icon={FileArchive} extra={<StatusPill label={app.status === 'archived' ? '已封存' : '持续归集'} />}>
        <LudongPocArchiveMaterials applicationId={app.id} readOnly={app.status === 'archived'} />
      </SectionCard>
    </div>
  );
}

function Approvals() {
  const client = useQueryClient();
  const pendingQuery = useQuery({ queryKey: ['ludong-poc', 'tasks'], queryFn: ludongApi.tasks });
  const processedQuery = useQuery({ queryKey: ['ludong-poc', 'processed'], queryFn: ludongApi.processed });
  const applications = useQuery({ queryKey: ['ludong-poc', 'applications'], queryFn: ludongApi.list });
  const [view, setView] = useState<'pending' | 'processed'>('pending');
  const [detail, setDetail] = useState<LudongApplication | null>(null);
  const [selected, setSelected] = useState<WorkflowTask | null>(null);
  const [comment, setComment] = useState('同意，按申报材料执行。');
  const [reviewData, setReviewData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');
  const complete = useMutation({
    mutationFn: ({ task, action }: { task: WorkflowTask; action: 'approve' | 'reject' }) => ludongApi.complete(task, action, comment, reviewData),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['ludong-poc'] });
      setSelected(null);
      setView('processed');
      setError('');
    },
    onError: (reason) => setError(apiError(reason)),
  });
  const tasks = (pendingQuery.data ?? []).filter((task) => task.businessType === 'ludong_project_application');
  const processed = (processedQuery.data ?? []).filter((item) => item.businessType === 'ludong_project_application');
  const appById = new Map((applications.data ?? []).map((app) => [app.id, app]));

  if (detail) return <ApplicationDetail application={detail} onBack={() => setDetail(null)} />;

  return (
    <div className="space-y-5">
      <PageHeader title="审批中心" subtitle="处理当前待办，并按当前登录岗位留存完整的已审批记录。" />
      {error && <FeedbackNotice tone="error" message={error} />}
      <FilterTabs
        value={view}
        onChange={(value) => setView(value as 'pending' | 'processed')}
        items={[
          { id: 'pending', label: '待审批', count: tasks.length },
          { id: 'processed', label: '已审批', count: processed.length },
        ]}
        className="w-fit"
      />
      {view === 'pending' ? (
        <Panel title="我的待办" icon={ClipboardCheck} subtitle={`当前共 ${tasks.length} 项待办任务`}>
          <div className="space-y-3">{tasks.map((task) => { const app = appById.get(task.businessId); return (
            <article key={task.taskId} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[2.5rem_minmax(0,1fr)_12rem_auto] xl:items-center xl:gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><ClipboardCheck size={19} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-950">{app?.projectName ?? task.businessId}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{app?.applicationNo} · {app?.applicantUnit}</p></div>
              <div className="col-start-2 min-w-0 xl:col-start-auto"><p className="text-[11px] font-black text-slate-400">当前节点</p><p className="mt-1 truncate text-xs font-black text-amber-700">{task.taskName}</p></div>
              <div className="col-span-2 flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 pt-3 xl:col-span-1 xl:border-0 xl:pt-0">
                <ActionButton disabled={!app} onClick={() => app && setDetail(app)}>详情</ActionButton>
                <PrimaryActionButton flushTop onClick={() => { setSelected(task); setComment('同意，按申报材料执行。'); setReviewData(createTaskReviewData(task, app)); }}>办理审批</PrimaryActionButton>
              </div>
            </article>
          ); })}{!pendingQuery.isLoading && tasks.length === 0 && <EmptyState title="当前没有待办审批" description="新的审批任务到达后会显示在这里；已办理记录可在“已审批”中查看。" icon={ClipboardCheck} />}</div>
        </Panel>
      ) : (
        <Panel title="已审批列表" icon={History} subtitle={`当前岗位共办理过 ${processed.length} 个项目流程`}>
          <ResponsiveTableFrame mobileCards={processed.map((item) => {
            const app = appById.get(item.businessId);
            return (
              <article key={item.workflowInstanceId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{app?.projectName ?? item.businessId}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{app?.applicationNo ?? item.businessId} · {app?.applicantUnit ?? '—'}</p></div><WorkflowStatus status={item.status} /></div>
                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3"><InfoCell label="当前进度" value={item.currentTask?.taskName ?? workflowStatusLabel(item.status)} /><InfoCell label="最近流转" value={formatDate(item.updatedAt ?? item.completedAt)} /></div>
                <div className="mt-4 flex justify-end"><ActionButton tone="blue" title="查看审批详情" onClick={() => app && setDetail(app)}>详情</ActionButton></div>
              </article>
            );
          })}>
            <table className="w-full min-w-[880px] table-fixed text-left">
              <thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="w-14 px-4 py-3">序号</th><th className="px-4 py-3">项目名称</th><th className="w-36 px-4 py-3">申报单位</th><th className="w-40 px-4 py-3">当前进度</th><th className="w-28 px-4 py-3">流程状态</th><th className="w-40 px-4 py-3">最近流转</th><th className="w-20 px-4 py-3 text-right">操作</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{processed.map((item, index) => { const app = appById.get(item.businessId); return (
                <tr key={item.workflowInstanceId} className="text-sm hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-bold text-slate-400">{index + 1}</td>
                  <td className="px-4 py-4"><p className="truncate font-black text-slate-950">{app?.projectName ?? item.businessId}</p><p className="mt-1 truncate font-mono text-xs font-bold text-slate-400">{app?.applicationNo ?? item.businessId}</p></td>
                  <td className="truncate px-4 py-4 font-semibold text-slate-600">{app?.applicantUnit ?? '—'}</td>
                  <td className="px-4 py-4"><p className="truncate text-xs font-black text-slate-700">{item.currentTask?.taskName ?? workflowStatusLabel(item.status)}</p></td>
                  <td className="px-4 py-4"><WorkflowStatus status={item.status} /></td>
                  <td className="px-4 py-4 text-xs font-bold text-slate-500">{formatDate(item.updatedAt ?? item.completedAt)}</td>
                  <td className="px-4 py-4 text-right"><ActionButton tone="blue" title="查看审批详情" onClick={() => app && setDetail(app)}>详情</ActionButton></td>
                </tr>
              ); })}</tbody>
            </table>
          </ResponsiveTableFrame>
          {!processedQuery.isLoading && processed.length === 0 && <EmptyState title="暂无已审批记录" description="当前岗位完成审批后，项目会保留在这里并可随时查看流程详情。" icon={History} />}
        </Panel>
      )}
      {selected && <LudongPocApprovalDialog task={selected} app={appById.get(selected.businessId)} comment={comment} setComment={setComment} reviewData={reviewData} setReviewData={setReviewData} busy={complete.isPending} onClose={() => setSelected(null)} onComplete={(action) => complete.mutate({ task: selected, action })} />}
    </div>
  );
}

function ArchivePage() {
  const query = useQuery({ queryKey: ['ludong-poc', 'applications'], queryFn: ludongApi.list });
  const items = (query.data ?? []).filter((item) => ['approved', 'archived'].includes(item.status));
  const [ledgerId, setLedgerId] = useState<string | null>(null);
  const ledgerApplication = items.find((item) => item.id === ledgerId);
  return (
    <div className="space-y-5"><PageHeader title="表格下载与材料归档" subtitle="统一归集项目原始附件，审批通过后生成 Word 与完整归档包。" /><Panel title="归档项目列表" icon={FileArchive} subtitle={`共 ${items.length} 个可归档项目`}><div className="space-y-3">{items.map((app) => (
      <article key={app.id} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] xl:gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><FileArchive size={19} /></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{app.projectName}</p><p className="mt-1 truncate text-xs font-bold text-slate-500">{app.applicationNo} · {app.applicantUnit}</p></div><Status applicationStatus={app.status} /><div className="col-span-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3 xl:col-span-1 xl:border-0 xl:pt-0"><ActionButton icon={ListChecks} onClick={() => setLedgerId(app.id)}>材料台账</ActionButton><ActionButton icon={Download} onClick={() => ludongApi.downloadDemand(app.id)}>需求表</ActionButton><ActionButton icon={Download} onClick={() => ludongApi.downloadApplication(app.id)}>申请单</ActionButton><PrimaryActionButton icon={Archive} flushTop onClick={() => ludongApi.downloadArchive(app.id)}>完整归档包</PrimaryActionButton></div></article>
    ))}{!query.isLoading && items.length === 0 && <EmptyState title="暂无已通过的归档材料" description="项目审批通过后，可下载材料将出现在这里。" icon={FileArchive} />}</div></Panel>
    {ledgerApplication && <Panel title={ledgerApplication.projectName + ' · 统一附件台账'} icon={ListChecks} subtitle="项目附件、商城确认材料和补充证明统一归集"><LudongPocArchiveMaterials applicationId={ledgerApplication.id} readOnly={ledgerApplication.status === 'archived'} /></Panel>}
    </div>
  );
}

function StatsPage() {
  const apps = useQuery({ queryKey: ['ludong-poc', 'applications'], queryFn: ludongApi.list });
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<ReportPeriod>('year');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const years = useMemo(() => availableReportYears(apps.data ?? [], currentYear), [apps.data, currentYear]);
  const analytics = useMemo(
    () => buildLudongAnalytics(apps.data ?? [], year, period),
    [apps.data, period, year],
  );
  const periodLabel = period === 'year' ? `${year}年度` : `${year}年第${period.slice(1)}季度`;
  const quarter = period === 'year' ? undefined : Number(period.slice(1));
  const download = async () => {
    setDownloading(true);
    setDownloadError('');
    try {
      await ludongApi.downloadAnalyticsReport(year, quarter);
    } catch (reason) {
      setDownloadError(apiError(reason));
    } finally {
      setDownloading(false);
    }
  };
  const colors = ['#2563eb', '#f59e0b', '#10b981', '#64748b'];
  return (
    <div className="space-y-5">
      <PageHeader
        title="采购申报数据分析"
        subtitle={`当前统计口径：${periodLabel}，按申报时间归集。`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select aria-label="统计年度" value={year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300">
              {years.map((item) => <option key={item} value={item}>{item}年</option>)}
            </select>
            <select aria-label="统计周期" value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 outline-none focus:border-blue-300">
              <option value="year">全年</option><option value="Q1">第一季度</option><option value="Q2">第二季度</option><option value="Q3">第三季度</option><option value="Q4">第四季度</option>
            </select>
            <PrimaryActionButton icon={Download} flushTop onClick={download} disabled={downloading}>
              {downloading ? '生成中' : `下载${period === 'year' ? '年度' : '季度'}报告`}
            </PrimaryActionButton>
          </div>
        }
      />
      {downloadError && <FeedbackNotice tone="error" message={downloadError} />}
      <MetricGrid columns={5}>
        <MetricCard icon={ClipboardList} label="申报项目" value={String(analytics.total)} hint={periodLabel} />
        <MetricCard icon={WalletCards} label="申报预算" value={currency(analytics.totalBudget)} hint={`平均 ${currency(analytics.averageBudget)}`} tone="violet" />
        <MetricCard icon={CheckCircle2} label="审批通过率" value={`${analytics.approvalRate}%`} hint={`${analytics.approved} 个项目已通过`} tone="emerald" />
        <MetricCard icon={PackageOpen} label="设备数量" value={String(analytics.equipmentCount)} hint="拟采购设备合计" tone="amber" />
        <MetricCard icon={Clock3} label="平均审批时长" value={analytics.averageApprovalDays == null ? '—' : `${analytics.averageApprovalDays.toFixed(1)}天`} hint="已完成项目" tone="slate" />
      </MetricGrid>

      {apps.isLoading ? <FeedbackNotice tone="info" message="正在加载统计数据…" /> : analytics.total === 0 ? (
        <EmptyState title={`${periodLabel}暂无申报数据`} description="可切换年度或季度查看其他统计区间。" icon={BarChart3} />
      ) : <>
        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <Panel title="项目与预算趋势" icon={TrendingUp} subtitle="各月申报预算金额与项目数量">
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.monthlyData} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="month" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} /><YAxis tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="amount" name="预算金额" fill="#2563eb" radius={[5, 5, 0, 0]} maxBarSize={42} /></BarChart></ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="审批状态结构" icon={ClipboardCheck} subtitle="各流程状态项目占比">
            <div className="grid min-h-72 grid-cols-[minmax(0,1fr)_8.5rem] items-center gap-2">
              <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={analytics.statusData} dataKey="value" nameKey="name" innerRadius={54} outerRadius={88} paddingAngle={3}>{analytics.statusData.map((item, index) => <Cell key={item.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              <div className="space-y-3">{analytics.statusData.map((item, index) => <div key={item.name} className="flex items-center justify-between gap-2 text-xs"><span className="flex min-w-0 items-center gap-2 font-bold text-slate-500"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} /><span className="truncate">{item.name}</span></span><strong className="font-mono text-slate-900">{item.value}</strong></div>)}</div>
            </div>
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="申报单位预算排名" icon={BarChart3} subtitle="按预算金额显示前八个申报单位">
            <div className="h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.unitData.slice(0, 8)} layout="vertical" margin={{ top: 4, right: 12, left: 28, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" /><XAxis type="number" tickFormatter={(value) => `${Math.round(Number(value) / 10000)}万`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => currency(Number(value))} /><Bar dataKey="amount" name="预算金额" fill="#0f766e" radius={[0, 5, 5, 0]} maxBarSize={22} /></BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel title="设备品类分析" icon={PackageOpen} subtitle="按设备明细统计数量和金额">
            <div className="space-y-3 py-1">{analytics.categoryData.slice(0, 6).map((item) => { const max = analytics.categoryData[0]?.amount || 1; return <div key={item.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-black text-slate-700">{item.name}</span><span className="shrink-0 font-mono font-black text-slate-900">{currency(item.amount)} · {item.count}件</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(4, item.amount / max * 100)}%` }} /></div></div>; })}{analytics.categoryData.length === 0 && <EmptyState title="暂无设备品类数据" />}</div>
          </Panel>
        </div>

        <Panel title="申报单位汇总" icon={BarChart3} subtitle="项目数、预算金额、通过情况与金额占比">
          <ResponsiveTableFrame mobileCards={analytics.unitData.map((item) => (
            <article key={item.name} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-black text-slate-950">{item.name}</p><div className="mt-3 grid grid-cols-3 gap-2 text-xs"><InfoCell label="项目" value={`${item.count} 个`} /><InfoCell label="预算" value={currency(item.amount)} /><InfoCell label="已通过" value={`${item.approved} 个`} /></div></article>
          ))}><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs font-black text-slate-500"><tr><th className="w-16 px-5 py-3">序号</th><th className="px-5 py-3">申报单位</th><th className="w-28 px-5 py-3">项目数</th><th className="w-40 px-5 py-3">预算金额</th><th className="w-28 px-5 py-3">已通过</th><th className="w-28 px-5 py-3">金额占比</th></tr></thead><tbody className="divide-y divide-slate-100">{analytics.unitData.map((item, index) => <tr key={item.name} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-bold text-slate-400">{index + 1}</td><td className="px-5 py-4 font-black text-slate-950">{item.name}</td><td className="px-5 py-4 font-bold text-slate-600">{item.count}</td><td className="px-5 py-4 font-mono font-black text-slate-950">{currency(item.amount)}</td><td className="px-5 py-4 font-bold text-emerald-700">{item.approved}</td><td className="px-5 py-4 text-xs font-black text-blue-700">{analytics.totalBudget ? `${Math.round(item.amount / analytics.totalBudget * 100)}%` : '0%'}</td></tr>)}</tbody></table></ResponsiveTableFrame>
        </Panel>

        <Panel title="采购方式分布" icon={Settings2} subtitle="以审批中最终确定的采购方式为统计口径">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{analytics.methodData.map((item) => <div key={item.name} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"><span className="truncate text-xs font-black text-slate-600">{item.name}</span><strong className="ml-3 font-mono text-base font-black text-slate-950">{item.value}</strong></div>)}</div>
        </Panel>
      </>}
    </div>
  );
}

function WorkflowCard({ history, loading }: { history?: WorkflowHistory | null; loading: boolean }) {
  if (loading) return <SectionCard title="审批流程进度" icon={ClipboardCheck}><p className="text-xs font-bold text-slate-400">正在加载流程...</p></SectionCard>;
  if (!history) return <SectionCard title="审批流程进度" icon={ClipboardCheck}><EmptyState title="尚未提交审批" icon={ClipboardCheck} /></SectionCard>;
  const nodes = buildLudongWorkflowProgress(history);
  const counts = workflowProgressCounts(nodes);
  return (
    <SectionCard title="审批流程进度" icon={ClipboardCheck} extra={<StatusPill label={`已完成 ${counts.completed}/${counts.total}`} />}>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-[11px] font-bold text-slate-500">
        <span>当前状态：<strong className="text-slate-800">{workflowStatusLabel(history.status)}</strong></span>
        {history.currentTask && <span>当前节点：<strong className="text-blue-700">{history.currentTask.taskName}</strong></span>}
        {counts.skipped > 0 && <span>条件跳过：<strong className="text-slate-700">{counts.skipped} 项</strong></span>}
      </div>
      <div className="space-y-0">
        {nodes.map((node, index) => {
          const meta = workflowProgressMeta(node, history.status);
          return (
            <div key={node.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)_auto] gap-3 pb-5 last:pb-0">
              {index < nodes.length - 1 && <span className="absolute bottom-0 left-[0.9375rem] top-8 w-px bg-slate-200" />}
              <span className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-black ${meta.markerClass}`}>{index + 1}</span>
              <div className="min-w-0 pt-1"><p className="text-sm font-black text-slate-900">{node.title}</p><p className="mt-1 break-words text-xs font-bold leading-5 text-slate-500">{meta.description}</p></div>
              <span className={`mt-0.5 inline-flex h-7 shrink-0 items-center rounded-md px-2.5 text-[11px] font-black ${meta.badgeClass}`}>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function ApprovalSummary({ app }: { app: LudongApplication }) {
  const allFields: [string, string][] = [
    ['购置必要性论证', app.formData.argumentationOpinion],
    ['教育信息技术部意见', app.formData.itReviewOpinion],
    ['申报单位意见', app.formData.applicantUnitOpinion],
    ['经费主管单位意见', app.formData.fundingUnitOpinion],
    ['资产配置审核', app.formData.assetConfigurationOpinion],
    ['资产处分管领导', app.formData.assetDivisionLeaderOpinion],
    ['资产处单位负责人', app.formData.assetUnitLeaderOpinion],
    ['实验室管理处审核', app.formData.labReviewOpinion],
    ['实验室处分管领导', app.formData.labDivisionLeaderOpinion],
    ['实验室处单位负责人', app.formData.labUnitLeaderOpinion],
    ['分管校领导意见', app.formData.schoolLeaderOpinion],
    ['财务预算审查', app.formData.financeBudgetStatus],
    ['采购预算审查', app.formData.procurementBudgetStatus],
    ['申请材料提交', app.formData.handoverSubmitConfirmation],
    ['申请材料受理', app.formData.handoverAcceptance],
    ['批准采购方式', app.formData.procurementMethod],
    ['财经处负责人终审', app.formData.financeResponsibleOpinion],
  ];
  const fields = allFields.filter(([, value]) => Boolean(value));
  if (!fields.length) return null;
  return <SectionCard title="审批结果汇总" icon={CheckCircle2} extra={<StatusPill label={`已完成 ${fields.length} 项`} />}><InfoGrid items={fields} /></SectionCard>;
}

function RouteDecisionSummary({ app }: { app: LudongApplication }) {
  const decisions = [
    ['requiresItReview', '涉及信创产品'],
    ['requiresAssetReview', '涉及办公设备或家具配置'],
    ['requiresLabReview', '涉及大型仪器或实验室'],
  ] as const;
  return (
    <SectionCard title="流程判定记录" icon={ClipboardCheck}>
      <div className="space-y-3">
        {decisions.map(([key, label]) => {
          const finalValue = app.formData[key] || '—';
          const mode = app.formData[`${key}Mode`];
          const systemValue = app.formData[`${key}SystemValue`];
          const reason = app.formData[`${key}Reason`];
          return (
            <div key={key} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3"><p className="text-xs font-black leading-5 text-slate-800">{label}</p><StatusPill label={finalValue} /></div>
              <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{reason || '历史数据尚未保存自动判断依据'}</p>
              {mode && <p className="mt-1 text-[11px] font-black text-slate-400">{mode === 'manual' ? `人工调整 · 系统原建议 ${systemValue || '—'}` : '系统判断'}</p>}
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs font-black text-slate-600">分管校领导审核</span><StatusPill label={app.formData.requiresSchoolLeader || '—'} /></div>
      </div>
    </SectionCard>
  );
}

function Status({ applicationStatus }: { applicationStatus: LudongApplication['status'] }) { return <StatusPill label={statusLabels[applicationStatus]} className="shrink-0" />; }
function WorkflowStatus({ status }: { status: string }) { return <StatusPill label={workflowStatusLabel(status)} className="shrink-0" />; }
function workflowStatusLabel(status: string) {
  const normalized = status.toUpperCase();
  return ({ PROCESSING: '审批中', RUNNING: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已撤回' } as Record<string, string>)[normalized] ?? status;
}
function workflowProgressMeta(node: WorkflowProgressNode, workflowStatus: string) {
  const actor = node.event?.actorName || '系统';
  const eventDetail = node.event
    ? `${actor} · ${formatDate(node.event.createdAt)}${node.event.comment ? ` · ${node.event.comment}` : ''}`
    : '';
  switch (node.status) {
    case 'completed':
      return { label: '已完成', description: eventDetail || '审批已完成', markerClass: 'border-emerald-200 bg-emerald-50 text-emerald-700', badgeClass: 'bg-emerald-50 text-emerald-700' };
    case 'current':
      return { label: '当前待办', description: node.event ? `节点于 ${formatDate(node.event.createdAt)} 到达，等待当前岗位办理` : '等待当前岗位办理', markerClass: 'border-blue-600 bg-blue-600 text-white', badgeClass: 'bg-blue-50 text-blue-700' };
    case 'skipped':
      return { label: '条件跳过', description: '根据项目申报表单及流程判定条件，本节点无需办理', markerClass: 'border-slate-200 bg-slate-100 text-slate-400', badgeClass: 'bg-slate-100 text-slate-500' };
    case 'reused':
      return { label: '自动复用', description: eventDetail || '经费主管单位与申报单位相同，系统复用申报单位负责人审批结论，无需重复办理', markerClass: 'border-cyan-200 bg-cyan-50 text-cyan-700', badgeClass: 'bg-cyan-50 text-cyan-700' };
    case 'rejected':
      return { label: '已驳回', description: eventDetail || '审批已驳回', markerClass: 'border-red-200 bg-red-50 text-red-700', badgeClass: 'bg-red-50 text-red-700' };
    default:
      return { label: '未开始', description: workflowStatus.toUpperCase() === 'REJECTED' ? '流程已驳回，本节点尚未进入' : '待前序审批节点完成后进入', markerClass: 'border-slate-200 bg-white text-slate-400', badgeClass: 'bg-slate-50 text-slate-500' };
  }
}
function InfoGrid({ items }: { items: [string, string][] }) { return <dl className="grid gap-4 sm:grid-cols-2">{items.map(([label, value]) => <div key={label} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/60 p-3"><dt className="text-[11px] font-black text-slate-400">{label}</dt><dd className="mt-1.5 break-words text-sm font-bold leading-6 text-slate-800">{value}</dd></div>)}</dl>; }
function InfoCell({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] font-black text-slate-400">{label}</p><p className="mt-1 truncate font-black text-slate-800">{value}</p></div>; }
function DocumentRow({ name, ready }: { name: string; ready: boolean }) { return <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 px-3 py-3"><FileText size={17} className="shrink-0 text-blue-600" /><p className="min-w-0 flex-1 truncate text-xs font-black text-slate-800">{name}</p><StatusPill label={ready ? '可下载' : '审批后生成'} /></div>; }
function currency(value?: number) {
  return value == null ? '—' : `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`;
}
function formatDate(value?: string) { return value ? new Date(value).toLocaleString('zh-CN') : '—'; }
function apiError(reason: unknown) { return (reason as { response?: { data?: { message?: string } } }).response?.data?.message ?? '操作失败，请稍后重试。'; }
