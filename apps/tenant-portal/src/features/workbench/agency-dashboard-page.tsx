import { useQueries, useQuery } from '@tanstack/react-query';
import { agencyList, useWorkflowInstancesLedgerPage } from '@24bid/api-client';
import {
  ArrowRight, BarChart3, Bell, CalendarDays, ClipboardCheck, FilePlus2, FileText,
  FolderKanban, Timer, TrendingUp,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FeedbackNotice, MetricCard, MiniFact, Panel, StatusPill } from '@24bid/ui';
import { useAuthStore } from '../../lib/auth-store';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { BuyerNotifications } from '../dashboard/buyer-notifications';
import { actionClass, calendarQuery, dayKey, secondaryClass, stateLabels, workbenchHref } from './workbench-model';

const twoColumns = 'grid gap-4 xl:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)]';
const card = 'min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50';
const textLink = 'shrink-0 text-xs font-bold text-blue-700 hover:underline';
const empty = 'rounded-md bg-slate-50 px-3 py-4 text-xs text-slate-600';
const count = (value: number | undefined, unit = '个') => value === undefined ? '—' : `${value} ${unit}`;
const workflowLabels: Record<string, string> = {
  agency_package_archive: '项目立项', agency_package_change: '项目变更',
  agency_purchase_document: '招标文件审批', agency_announcement: '公告审批',
  agency_template_publication: '模板发布审批',
};

function SectionTitle({ icon: Icon, title, subtitle, action }: {
  icon: typeof BarChart3; title: string; subtitle?: string; action?: ReactNode;
}) {
  return <div className="mb-4 flex items-start justify-between gap-3">
    <div>
      <h2 className="flex items-center gap-2 text-base font-black text-slate-950">
        <Icon className="shrink-0 text-blue-600" size={17} /> {title}
      </h2>
      {subtitle && <p className="mt-1 text-xs font-semibold text-slate-500">{subtitle}</p>}
    </div>
    {action}
  </div>;
}

function monthAt(month: string, offset: number) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function AgencyDashboardPage() {
  const { can } = useBuyerPermissions();
  const name = useAuthStore(state => state.session?.displayName);
  const today = dayKey(new Date());
  const month = today.slice(0, 7);
  const canReadCalendar = can('buyer:agency:document:read');
  const projects = useQuery({ queryKey: ['agency-dashboard-projects'], queryFn: () => agencyList({ page: 1, pageSize: 5 }) });
  const reviewing = useQuery({ queryKey: ['agency-dashboard-reviewing'], queryFn: () => agencyList({ status: 'reviewing', page: 1, pageSize: 1 }) });
  const approved = useQuery({ queryKey: ['agency-dashboard-approved'], queryFn: () => agencyList({ status: 'approved', page: 1, pageSize: 1 }) });
  const pending = useWorkflowInstancesLedgerPage('pending', 1, 4, '');
  const months = Array.from({ length: 6 }, (_, index) => monthAt(month, index - 5));
  const calendars = useQueries({ queries: months.map(value => ({
    queryKey: ['agency-calendar', value], queryFn: () => calendarQuery(value), enabled: canReadCalendar,
  })) });
  const calendar = calendars[5];
  const daily = calendar.data?.filter(event => event.day === today) ?? [];
  const upcoming = calendar.data?.filter(event => event.day >= today)
    .sort((a, b) => a.openingAt.localeCompare(b.openingAt)).slice(0, 3) ?? [];
  const chartError = calendars.some(query => query.isError);
  const chartReady = calendars.every(query => query.isSuccess);
  const chart = months.map((period, index) => ({ period, openings: calendars[index].data?.length ?? 0 }));
  const total = projects.data?.total;
  const waiting = reviewing.data?.total;
  const passed = approved.data?.total;
  const taskCount = pending.data?.data?.total;
  const tasks = pending.data?.data?.items ?? [];
  const other = total !== undefined && waiting !== undefined && passed !== undefined
    ? Math.max(0, total - waiting - passed) : undefined;
  const shortcuts = [
    { label: '发起立项', detail: '创建招标代理项目', href: '/?module=agency&action=create', icon: FilePlus2, tone: 'bg-blue-50 text-blue-600', visible: can('buyer:agency:manage') },
    { label: '招标文件库', detail: '文件编制与版本管理', href: workbenchHref('documents'), icon: FileText, tone: 'bg-violet-50 text-violet-600', visible: canReadCalendar },
    { label: '项目执行', detail: '专家签到、评分与文件核对', href: workbenchHref('execution'), icon: FolderKanban, tone: 'bg-orange-50 text-orange-700', visible: true },
    { label: '开标日历', detail: '查看每日开标排期', href: workbenchHref('analytics'), icon: CalendarDays, tone: 'bg-emerald-50 text-emerald-700', visible: canReadCalendar },
  ];

  return <Panel title="首页看板" icon={BarChart3} subtitle="项目概况、待办审批与开标安排">
    <div className="space-y-5">
      <div className={twoColumns}>
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><ClipboardCheck size={17}/></span>
              <div>
                <h2 className="text-lg font-black text-slate-950">{name ? `${name}，您好` : '工作概况'}</h2>
                <time dateTime={today} className="text-xs font-semibold text-slate-500">{today} · 北京时间</time>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={actionClass} href={workbenchHref('approvals')}><ClipboardCheck size={15}/> 处理待办{taskCount === undefined ? '' : `（${taskCount}）`}</a>
              <a className={secondaryClass} href={workbenchHref('agency')}>查看项目库</a>
            </div>
          </div>
          <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniFact label="待办审批" value={count(taskCount, '项')}/>
            <MiniFact label="项目总数" value={count(total)}/>
            <MiniFact label="建档审核中" value={count(waiting)}/>
            <MiniFact label="建档已通过" value={count(passed)}/>
            <MiniFact label="今日开标" value={count(calendar.data && daily.length, '场')}/>
            <MiniFact label="本月开标" value={count(calendar.data?.length, '场')}/>
          </div>
          <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
            <h3 className="flex items-center gap-2 text-xs font-black text-amber-900"><Timer size={14}/> 本月近期安排</h3>
            {upcoming.length ? <ul className="mt-2 space-y-2">
              {upcoming.map(event => <li key={event.packageId}>
                <a className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs hover:underline" href={workbenchHref('execution', event.packageId)}>
                  <span className="font-bold text-slate-900">{event.title}</span>
                  <time dateTime={event.openingAt} className="font-mono font-semibold text-amber-900">{event.day} {event.openingAt.slice(11, 16)}</time>
                </a>
              </li>)}
            </ul> : <p className="mt-2 text-xs text-slate-600">{!canReadCalendar ? '当前账号没有开标日历权限' : calendar.isError ? '排期加载失败' : calendar.isPending ? '正在加载排期…' : '本月暂无后续开标安排'}</p>}
          </div>
        </section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {shortcuts.filter(item => item.visible).map(({ label, detail, href, icon: Icon, tone }) => (
            <a key={label} href={href} className="flex min-h-[5rem] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/50 hover:border-blue-200 hover:bg-slate-50">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon size={20}/></span>
              <div><p className="text-sm font-black text-slate-950">{label}</p><p className="mt-1 text-xs text-slate-600">{detail}</p></div>
            </a>
          ))}
        </div>
      </div>

      {(projects.isError || reviewing.isError || approved.isError) && <FeedbackNotice tone="error" message="部分项目数据加载失败，请刷新重试。"/>}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard icon={FolderKanban} label="项目总数" value={count(total)} hint="当前授权范围" tone="slate"/>
        <MetricCard icon={ClipboardCheck} label="建档审核中" value={count(waiting)} hint="已提交立项审核" tone="amber"/>
        <MetricCard icon={FolderKanban} label="建档已通过" value={count(passed)} hint="已完成立项审核" tone="emerald"/>
        <MetricCard icon={CalendarDays} label="今日开标" value={count(calendar.data && daily.length, '场')} hint="按北京时间统计"/>
      </div>

      <div className={twoColumns}>
        <section className={card}>
          <SectionTitle icon={TrendingUp} title="近半年开标场次" subtitle="按月汇总已登记的开标安排"/>
          {!canReadCalendar || chartError || !chartReady ? (
            <p className={empty}>{!canReadCalendar ? '当前账号没有开标日历权限' : chartError ? '开标趋势加载失败' : '正在加载开标趋势…'}</p>
          ) : <div className="h-56 min-w-0 sm:h-64" role="img" aria-label={chart.map(point => `${point.period} ${point.openings} 场`).join('，')}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 12, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3"/>
                <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#64748b" tickLine={false}/>
                <YAxis width={28} allowDecimals={false} domain={[0, 'auto']} tick={{ fontSize: 11 }} stroke="#64748b" axisLine={false} tickLine={false}/>
                <Tooltip formatter={value => [`${value} 场`, '开标']} />
                <Area type="linear" dataKey="openings" stroke="#2563eb" fill="#dbeafe" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>}
        </section>
        <section className={card}>
          <SectionTitle icon={Bell} title="待办事项" action={<span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{taskCount ?? '—'}</span>}/>
          {tasks.length ? <ul className="space-y-2">{tasks.map(task => (
            <li key={task.workflowInstanceId} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2">
              <ClipboardCheck size={16} className="shrink-0 text-blue-600"/>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{workflowLabels[task.businessType] ?? '业务审批'}</p>
                <p className="truncate text-xs text-slate-600">{task.initiatorName || '审批中'}</p>
              </div>
              <span className="shrink-0 text-xs text-slate-500">{task.createdAt?.slice(0, 10)}</span>
            </li>
          ))}</ul> : <p className={empty}>{pending.isError ? '待办加载失败' : pending.isPending ? '正在加载待办…' : '暂无待办审批'}</p>}
          <a className={`mt-4 inline-block ${textLink}`} href={workbenchHref('approvals')}>进入审批中心 →</a>
        </section>
      </div>

      <div className={twoColumns}>
        <section className={card}>
          <SectionTitle icon={FolderKanban} title="最近项目" action={<a className={textLink} href={workbenchHref('agency')}>查看全部 →</a>}/>
          {projects.data?.items.length ? <ul className="space-y-2">{projects.data.items.map(project => (
            <li key={project.id}>
              <a href={workbenchHref('agency', project.id)} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                <span className="rounded-md bg-blue-50 p-2 text-blue-700"><FolderKanban size={16}/></span>
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-black">{project.title || '未命名项目'}</p><p className="mt-1 text-xs text-slate-600">{project.number || '待编号'}</p></div>
                <StatusPill label={stateLabels[project.status] || project.status}/>
                <ArrowRight size={15} className="hidden shrink-0 text-slate-400 sm:block"/>
              </a>
            </li>
          ))}</ul> : <p className={empty}>{projects.isError ? '项目加载失败' : projects.isPending ? '正在加载项目…' : '暂无项目'}</p>}
        </section>
        <div className="space-y-4">
          <section className={card}>
            <SectionTitle icon={CalendarDays} title="今日开标安排" action={canReadCalendar && <a className={textLink} href={workbenchHref('analytics')}>查看日历 →</a>}/>
            {daily.length ? <ul className="space-y-2">{daily.map(event => (
              <li key={event.packageId}><a className="flex gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs hover:underline" href={workbenchHref('execution', event.packageId)}>
                <time dateTime={event.openingAt} className="shrink-0 font-mono font-bold text-blue-700">{event.openingAt.slice(11, 16)}</time>
                <span>{event.title}<span className="mt-1 block text-slate-600">{event.venue || '地点待登记'}</span></span>
              </a></li>
            ))}</ul> : <p className={empty}>{!canReadCalendar ? '当前账号没有开标日历权限' : calendar.isError ? '排期加载失败' : calendar.isPending ? '正在加载排期…' : '今日暂无开标安排'}</p>}
          </section>
          <section className={card}>
            <SectionTitle icon={BarChart3} title="项目建档状态" subtitle="当前授权范围"/>
            <div className="space-y-3">{[['审核中', waiting], ['已通过', passed], ['其他状态', other]].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[4.5rem_minmax(0,1fr)_2rem] items-center gap-2 text-xs text-slate-600">
                <span>{label}</span><progress className="h-2 w-full accent-blue-600" aria-label={String(label)} value={typeof value === 'number' ? value : 0} max={total || 1}/>
                <span className="text-right font-mono">{value ?? '—'}</span>
              </div>
            ))}</div>
          </section>
        </div>
      </div>
      <BuyerNotifications/>
    </div>
  </Panel>;
}
