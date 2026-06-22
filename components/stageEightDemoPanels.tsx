import React from 'react';
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, LockKeyhole, PlayCircle, Search, ShieldCheck } from 'lucide-react';

export type DemoActionFeedbackItem = {
  action: string;
  prerequisite: string;
  success: string;
  fallback: string;
  nextStep: string;
};

export type DemoReadonlyBoundaryItem = {
  state: string;
  businessMeaning: string;
  userGuidance: string;
  fallback: string;
};

export type DemoWalkthroughStep<ModuleId extends string> = {
  moduleId: ModuleId;
  label: string;
  summary: string;
};

export type DemoSequenceNavigation<ModuleId extends string> = {
  currentLabel: string;
  previousLabel: string;
  nextLabel: string;
  previousModuleId?: ModuleId;
  nextModuleId?: ModuleId;
  onPrevious?: (moduleId: ModuleId) => void;
  onNext?: (moduleId: ModuleId) => void;
  onLocateSample?: () => void;
};

export type DemoGovernanceTraceItem = {
  actor: string;
  action: string;
  auditTarget: string;
  traceEntry: string;
};

export type DemoCommandCenterItem = {
  storyline: string;
  actionCount: string;
  evidence: string;
  nextPage: string;
};

export type DemoReadinessItem = {
  label: string;
  status: string;
  evidence: string;
  detail: string;
  tone?: 'ready' | 'warning';
};

export type DemoCurrentActionGuide = {
  actionLabel: string;
  targetButton: string;
  prioritySample: string;
  sampleLocator: string;
  talkTrack: string;
  nextHop: string;
};

const DemoFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 rounded-md bg-slate-50 px-2.5 py-2">
    <p className="text-[11px] font-black text-slate-400">{label}</p>
    <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">{value}</p>
  </div>
);

export const DemoReadinessPanel: React.FC<{
  title: string;
  subtitle: string;
  status: string;
  items: DemoReadinessItem[];
  testId: string;
}> = ({ title, subtitle, status, items, testId }) => (
  <section
    aria-label={title}
    data-testid="stage9-demo-readiness-panel"
    id={testId}
    className="overflow-hidden rounded-lg border border-teal-100 bg-teal-50 p-3 shadow-sm shadow-teal-100/60 sm:p-4"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-teal-700">演示准备检查</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-teal-700">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-black text-teal-700">
        <CheckCircle2 size={14} />
        {status}
      </span>
    </div>
    <p className="mt-2 rounded-md bg-white/70 px-2.5 py-1.5 text-[11px] font-black leading-5 text-teal-700 sm:text-xs">
      Java 数据源 / 前端页面已加载 / 17 个真实动作 / 推荐样本
    </p>
    <div className="mt-3 grid max-h-[24rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-none sm:overflow-visible sm:pr-0 xl:grid-cols-4">
      {items.map((item) => {
        const ready = item.tone !== 'warning';
        return (
          <div
            key={item.label}
            className={`rounded-lg border bg-white p-2.5 shadow-sm sm:p-3 ${
              ready ? 'border-white shadow-teal-100/40' : 'border-amber-100 shadow-amber-100/40'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="break-words text-sm font-black text-slate-950">{item.label}</p>
              <CheckCircle2 size={16} className={`mt-0.5 shrink-0 ${ready ? 'text-teal-600' : 'text-amber-600'}`} />
            </div>
            <div className="mt-3 grid gap-2">
              <DemoFact label="检查状态" value={item.status} />
              <DemoFact label="验收证据" value={item.evidence} />
              <DemoFact label="说明" value={item.detail} />
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

export const DemoCommandCenterPanel: React.FC<{
  eyebrow?: string;
  title: string;
  subtitle: string;
  items: DemoCommandCenterItem[];
  currentGuide?: DemoCurrentActionGuide;
  sequenceNavigation?: DemoSequenceNavigation<string>;
  testId: string;
}> = ({ eyebrow, title, subtitle, items, currentGuide, sequenceNavigation, testId }) => (
  <section
    aria-label={title}
    data-testid="stage9-demo-command-center-panel"
    id={testId}
    className="overflow-hidden rounded-lg border border-sky-100 bg-sky-50 p-3 shadow-sm shadow-sky-100/60 sm:p-4"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-sky-700">{eyebrow ?? '阶段九演示总线'}</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-sky-700">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-black text-sky-700">
        <PlayCircle size={14} />
        演示主线 / 真实动作 / 验收证据 / 下一页
      </span>
    </div>
    <div className="mt-3 grid gap-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.storyline} className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-sky-100/40 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-black text-slate-950">{item.storyline}</p>
            <ClipboardCheck size={16} className="mt-0.5 shrink-0 text-sky-600" />
          </div>
          <div className="mt-3 grid gap-2">
            <DemoFact label="演示主线" value={item.storyline} />
            <DemoFact label="真实动作" value={item.actionCount} />
            <DemoFact label="验收证据" value={item.evidence} />
            <DemoFact label="下一页" value={item.nextPage} />
          </div>
        </div>
      ))}
    </div>
    {sequenceNavigation && (
      <div
        data-testid="stage9-demo-sequence-navigation"
        className="mt-3 grid gap-2 rounded-lg border border-sky-100 bg-white p-2.5 shadow-sm shadow-sky-100/40 sm:p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="min-w-0">
          <p className="text-xs font-black text-sky-700">演示顺序导航</p>
          <p className="mt-1 break-words text-sm font-black text-slate-950">
            当前页：{sequenceNavigation.currentLabel}
          </p>
          <p className="mt-1 text-xs font-bold leading-5 text-sky-700">
            用上一页、下一页、定位推荐样本把现场讲解收束成可连续点击的路径。
          </p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-3 lg:min-w-[28rem]">
          <button
            type="button"
            data-testid="stage9-demo-previous-page"
            disabled={!sequenceNavigation.previousModuleId || !sequenceNavigation.onPrevious}
            onClick={() => {
              if (sequenceNavigation.previousModuleId) {
                sequenceNavigation.onPrevious?.(sequenceNavigation.previousModuleId);
              }
            }}
            className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <ArrowLeft size={14} />
            <span className="min-w-0 break-words">上一页：{sequenceNavigation.previousLabel}</span>
          </button>
          <button
            type="button"
            data-testid="stage9-demo-locate-sample"
            disabled={!sequenceNavigation.onLocateSample}
            onClick={sequenceNavigation.onLocateSample}
            className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <Search size={14} />
            <span className="min-w-0 break-words">定位推荐样本</span>
          </button>
          <button
            type="button"
            data-testid="stage9-demo-next-page"
            disabled={!sequenceNavigation.nextModuleId || !sequenceNavigation.onNext}
            onClick={() => {
              if (sequenceNavigation.nextModuleId) {
                sequenceNavigation.onNext?.(sequenceNavigation.nextModuleId);
              }
            }}
            className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-md border border-sky-100 bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <span className="min-w-0 break-words">下一页：{sequenceNavigation.nextLabel}</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    )}
    {currentGuide && (
      <div
        data-testid="stage9-current-action-guide"
        className="mt-3 rounded-lg border border-sky-100 bg-white p-2.5 shadow-sm shadow-sky-100/40 sm:p-3"
      >
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black text-sky-700">当前页动作提示</p>
            <h4 className="mt-1 break-words text-sm font-black text-slate-950">{currentGuide.actionLabel}</h4>
          </div>
          <span className="inline-flex min-h-8 max-w-full shrink-0 items-center rounded-md bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">
            优先点击真实按钮
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <DemoFact label="目标按钮" value={currentGuide.targetButton} />
          <DemoFact label="优先样本" value={currentGuide.prioritySample} />
          <DemoFact label="样本定位" value={currentGuide.sampleLocator} />
          <DemoFact label="演示口径" value={currentGuide.talkTrack} />
          <DemoFact label="跳转建议" value={currentGuide.nextHop} />
          <DemoFact label="验收方式" value="点击后看业务反馈、状态流转和 Java 总验收结果。" />
        </div>
      </div>
    )}
  </section>
);

export const DemoWalkthroughRail = <ModuleId extends string>({
  ariaLabel,
  eyebrow,
  title,
  description,
  steps,
  activeModule,
  closedLabel,
  gridClassName,
  onNavigate,
}: {
  ariaLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  steps: Array<DemoWalkthroughStep<ModuleId>>;
  activeModule: ModuleId;
  closedLabel: string;
  gridClassName: string;
  onNavigate: (moduleId: ModuleId) => void;
}) => {
  const activeIndex = steps.findIndex((step) => step.moduleId === activeModule);
  const currentStep = steps[Math.max(activeIndex, 0)];
  const nextStep = activeIndex >= 0 && activeIndex < steps.length - 1
    ? steps[activeIndex + 1]
    : undefined;

  return (
    <section
      aria-label={ariaLabel}
      className="overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black text-blue-700">{eyebrow}</p>
          <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{description}</p>
        </div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:w-[28rem]">
          <DemoFact label="当前演示页" value={currentStep?.label ?? '未进入演示页'} />
          <DemoFact label="下一演示页" value={nextStep?.label ?? closedLabel} />
        </div>
      </div>
      <div className="mt-4">
        <div className={`grid gap-2 ${gridClassName}`}>
          {steps.map((step, index) => {
            const active = step.moduleId === activeModule;
            const completed = activeIndex > index;
            return (
              <button
                key={step.moduleId}
                type="button"
                onClick={() => onNavigate(step.moduleId)}
                aria-current={active ? 'step' : undefined}
                className={`min-h-[5rem] rounded-lg border p-2.5 text-left transition sm:min-h-[5.5rem] sm:p-3 ${
                  active
                    ? 'border-blue-300 bg-blue-50 text-blue-900 ring-2 ring-blue-100'
                    : completed
                      ? 'border-emerald-100 bg-emerald-50 text-emerald-900 hover:border-emerald-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-200 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-white px-1.5 text-xs font-black">
                    {index + 1}
                  </span>
                  {active && <span className="rounded-md bg-blue-600 px-1.5 py-0.5 text-[10px] font-black text-white">当前</span>}
                </div>
                <p className="mt-2 break-words text-sm font-black">{step.label}</p>
                <p className="mt-1 break-words text-xs font-bold leading-5 opacity-80">{step.summary}</p>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export const DemoActionFeedbackPanel: React.FC<{
  title: string;
  subtitle: string;
  items: DemoActionFeedbackItem[];
  testId: string;
}> = ({ title, subtitle, items, testId }) => (
  <section
    aria-label={title}
    data-testid="stage8-demo-action-feedback-panel"
    id={testId}
    className="overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50 p-3 shadow-sm shadow-indigo-100/60 sm:p-4"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-indigo-700">阶段八动作反馈</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-indigo-700">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-8 max-w-full shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-indigo-700">
        {items.length} 个动作
      </span>
    </div>
    <div className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:mt-4 sm:max-h-none sm:gap-3 sm:overflow-visible sm:pr-0 xl:grid-cols-2">
      {items.map((item) => (
        <div key={item.action} className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-indigo-100/40 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-black text-slate-950">{item.action}</p>
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DemoFact label="前置条件" value={item.prerequisite} />
            <DemoFact label="成功反馈" value={item.success} />
            <DemoFact label="失败兜底" value={item.fallback} />
            <DemoFact label="下一步" value={item.nextStep} />
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const DemoReadonlyBoundaryPanel: React.FC<{
  title: string;
  subtitle: string;
  items: DemoReadonlyBoundaryItem[];
  testId: string;
}> = ({ title, subtitle, items, testId }) => (
  <section
    aria-label={title}
    data-testid="stage8-readonly-boundary-panel"
    id={testId}
    className="overflow-hidden rounded-lg border border-amber-100 bg-amber-50 p-3 shadow-sm shadow-amber-100/60 sm:p-4"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-amber-700">阶段八只读边界</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-amber-700">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-8 max-w-full shrink-0 items-center rounded-md bg-white px-2.5 py-1 text-xs font-black text-amber-700">
        已完成 / 已撤回 / 已归档 / 无数据 / 不可操作
      </span>
    </div>
    <div className="mt-3 grid max-h-[26rem] gap-2 overflow-y-auto overscroll-contain pr-1 sm:mt-4 sm:max-h-none sm:gap-3 sm:overflow-visible sm:pr-0 xl:grid-cols-2">
      {items.map((item) => (
        <div key={item.state} className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-amber-100/40 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-black text-slate-950">{item.state}</p>
            <LockKeyhole size={16} className="mt-0.5 shrink-0 text-amber-600" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <DemoFact label="业务解释" value={item.businessMeaning} />
            <DemoFact label="用户提示" value={item.userGuidance} />
            <DemoFact label="演示兜底" value={item.fallback} />
            <DemoFact label="不可操作" value="用只读状态、空状态或流程已处理提示替代技术错误。" />
          </div>
        </div>
      ))}
    </div>
  </section>
);

export const DemoPermissionAuditPanel: React.FC<{
  title: string;
  subtitle: string;
  items: DemoGovernanceTraceItem[];
  testId: string;
}> = ({ title, subtitle, items, testId }) => (
  <section
    aria-label={title}
    data-testid="stage8-permission-audit-panel"
    id={testId}
    className="overflow-hidden rounded-lg border border-emerald-100 bg-emerald-50 p-3 shadow-sm shadow-emerald-100/60 sm:p-4"
  >
    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-black text-emerald-700">阶段八权限与审计</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{title}</h3>
        <p className="mt-1 text-sm font-bold leading-6 text-emerald-700">{subtitle}</p>
      </div>
      <span className="inline-flex min-h-8 max-w-full shrink-0 items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-black text-emerald-700">
        <ShieldCheck size={14} />
        谁能做 / 做了什么 / 审计对象 / 追溯入口
      </span>
    </div>
    <div className="mt-3 grid gap-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={`${item.actor}:${item.auditTarget}`} className="rounded-lg border border-white bg-white p-2.5 shadow-sm shadow-emerald-100/40 sm:p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="break-words text-sm font-black text-slate-950">{item.actor}</p>
            <Activity size={16} className="mt-0.5 shrink-0 text-emerald-600" />
          </div>
          <div className="mt-3 grid gap-2">
            <DemoFact label="谁能做" value={item.actor} />
            <DemoFact label="做了什么" value={item.action} />
            <DemoFact label="审计对象" value={item.auditTarget} />
            <DemoFact label="追溯入口" value={item.traceEntry} />
          </div>
        </div>
      ))}
    </div>
  </section>
);
