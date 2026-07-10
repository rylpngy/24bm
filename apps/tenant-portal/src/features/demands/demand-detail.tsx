import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers3,
  Send,
  ShieldCheck,
  Timer,
  WalletCards,
} from 'lucide-react';
import {
  type PurchaseDemandResponse,
  useAuditLogListTargetActions,
  useMaterialList,
  usePurchaseDemandSubmit,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, ShellState, StatusPill, cn } from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '--' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 0 })}`;

const ACTION_LABELS: Record<string, string> = {
  'purchase_demand.created': '创建需求',
  'purchase_demand.updated': '编辑需求',
  'purchase_demand.submitted': '提交审批',
  'purchase_demand.approved': '审批通过',
  'purchase_demand.rejected': '审批驳回',
};

const departmentMap: Record<string, string> = {
  'dept-it': '信息化部',
  'dept-admin': '行政部',
  'dept-finance': '财务部',
  'dept-purchase': '采购部',
  'dept-hq': '集团总部',
};

const approvalSteps = ['需求编制', '提交审批', '需求审批'];

function dateTimeText(value?: string) {
  return value?.slice(0, 16).replace('T', ' ') ?? '--';
}

function departmentLabel(id?: string) {
  return id ? departmentMap[id] ?? id : '--';
}

function currentStageIndex(status?: string) {
  if (status === '草稿') return 0;
  if (status === '审批中') return 1;
  if (status === '已通过') return 2;
  if (status === '已驳回') return 1;
  return 0;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof WalletCards;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400">{label}</p>
          <p className="mt-2 break-words text-xl font-black leading-tight text-slate-950">{value}</p>
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tone)}>
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

function approvalStepMeta(status?: string, index = 0) {
  if (status === '已驳回') {
    if (index === 0) return { done: true, current: false, label: '已完成' };
    if (index === 1) return { done: false, current: true, label: '已驳回' };
    return { done: false, current: false, label: '待重新提交' };
  }
  const active = currentStageIndex(status);
  return {
    done: index < active || (status === '已通过' && index === active),
    current: status !== '已通过' && index === active,
    label: index < active || (status === '已通过' && index === active) ? '已完成' : index === active ? '处理中' : '待开始',
  };
}

function approvalStepDetail(status?: string, index = 0) {
  if (index === 0) return '需求已完成基础信息和物料明细登记。';
  if (index === 1) {
    if (status === '草稿') return '待申请人提交审批。';
    if (status === '已驳回') return '审批已驳回，需补充后重新提交。';
    return '需求已提交，等待审批处理。';
  }
  if (status === '已通过') return '审批已通过，可进入采购计划合并。';
  if (status === '已驳回') return '待重新提交后进入审批。';
  return '待审批人完成审核。';
}

function ProgressTracker({
  status,
  linkedRfqId,
  linkedRfqStatus,
}: {
  status?: string;
  linkedRfqId?: string;
  linkedRfqStatus?: string;
}) {
  const linked = !!linkedRfqId;
  const approved = status === '已通过';
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="mb-8 flex items-center gap-2">
        <Timer size={18} className="text-blue-600" />
        <h3 className="text-base font-black text-slate-950">需求流转进度</h3>
      </div>
      <div className="grid grid-cols-3 items-start gap-3">
        {approvalSteps.map((step, index) => {
          const { done, current, label } = approvalStepMeta(status, index);
          return (
            <div key={step} className="relative text-center">
              {index < approvalSteps.length - 1 && <div className="absolute left-1/2 top-5 h-1 w-full bg-slate-100" />}
              <span
                className={cn(
                  'relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full border-4 bg-white',
                  done
                    ? 'border-emerald-100 bg-emerald-500 text-white'
                    : current
                      ? 'border-blue-100 bg-blue-600 text-white'
                      : 'border-slate-200 text-slate-300',
                )}
              >
                {done ? <CheckCircle2 size={18} /> : current ? <Timer size={18} /> : <i className="h-2 w-2 rounded-full bg-current" />}
              </span>
              <p className={cn('mt-3 text-xs font-black', done || current ? 'text-blue-700' : 'text-slate-500')}>{step}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{label}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-2">
        <div
          className={cn(
            'rounded-lg border p-4',
            linked ? 'border-emerald-100 bg-emerald-50' : approved ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50',
          )}
        >
          <p className={cn('text-xs font-black', linked ? 'text-emerald-700' : approved ? 'text-blue-700' : 'text-slate-500')}>
            后续阶段 · 合并计划
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            {linked ? `已关联采购计划 ${linkedRfqId}` : approved ? '可合并生成采购计划' : '审批通过后可合并'}
          </p>
        </div>
        <div
          className={cn(
            'rounded-lg border p-4',
            linked ? 'border-emerald-100 bg-emerald-50' : 'border-slate-100 bg-slate-50',
          )}
        >
          <p className={cn('text-xs font-black', linked ? 'text-emerald-700' : 'text-slate-500')}>
            后续阶段 · 转采购计划
          </p>
          <p className="mt-2 text-sm font-black text-slate-950">
            {linked ? `已进入${linkedRfqStatus ?? '询比流程'}` : '待采购计划生成后进入'}
          </p>
        </div>
      </div>
    </div>
  );
}

export function DemandDetail({
  demand,
  onBack,
}: {
  demand: PurchaseDemandResponse;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const materials = useMaterialList();
  const audit = useAuditLogListTargetActions({
    targetType: 'purchase_demand',
    targetId: demand.id ?? '',
  });
  const submit = usePurchaseDemandSubmit();

  const materialMap = useMemo(() => {
    const map: Record<string, { name: string; code: string; unit: string; referencePrice?: number }> = {};
    (materials.data?.data ?? []).forEach((m) => {
      if (m.id) {
        map[m.id] = {
          name: m.name ?? m.id,
          code: m.code ?? m.id,
          unit: m.unit ?? '项',
          referencePrice: m.referencePrice,
        };
      }
    });
    return map;
  }, [materials.data]);

  const lineItems = demand.lineItems ?? [];
  const history = audit.data?.data ?? [];
  const canSubmit = demand.status === '草稿' || demand.status === '已驳回';

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(demands|audit)/.test(q.queryKey[0] as string),
    });

  const submitDemand = () => {
    submit.mutate(
      { demandId: demand.id! },
      {
        onSuccess: () => {
          refresh();
          onBack();
        },
      },
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-words text-xl font-black text-slate-950">{demand.title ?? '--'}</h2>
                <StatusPill label={demand.status ?? '草稿'} />
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                需求编号: {demand.id ?? '--'} · 创建日期: {demand.createdAt?.slice(0, 10) ?? '--'} · 申请部门: {departmentLabel(demand.departmentId)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50" type="button">
              <FileText size={15} /> 查看原件
            </button>
            {canSubmit ? (
              <PrimaryActionButton onClick={submitDemand} busy={submit.isPending} pendingLabel="提交中">
                <Send size={15} /> 提交审批
              </PrimaryActionButton>
            ) : (
              <button className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700" type="button">
                <CheckCircle2 size={15} /> {demand.status === '已通过' ? '审批通过' : '处理中'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={WalletCards} label="需求预算" value={currency(demand.budget)} tone="bg-blue-50 text-blue-600" />
            <MetricCard icon={CalendarDays} label="期望交期" value={demand.expectedDeliveryDate ?? '待定'} tone="bg-violet-50 text-violet-600" />
            <MetricCard icon={Layers3} label="优先级" value={demand.priority ?? '常规'} tone="bg-amber-50 text-amber-600" />
          </div>

          <ProgressTracker
            status={demand.status}
            linkedRfqId={demand.linkedRfqId}
            linkedRfqStatus={demand.linkedRfqStatus}
          />

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <ClipboardCheck size={18} className="text-violet-600" />
              <h3 className="text-base font-black text-slate-950">需求基础信息</h3>
              <span className="rounded bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                {demand.status ?? '草稿'}
              </span>
            </div>
            <p className="border-t border-slate-100 pt-5 text-sm font-semibold leading-6 text-slate-600">
              {demand.purpose || '该采购需求暂未填写用途说明。'}
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">申请人</p>
                <p className="mt-1.5 text-sm font-black text-slate-950">{demand.requesterId ?? '--'}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400">申请部门</p>
                <p className="mt-1.5 text-sm font-black text-slate-950">{departmentLabel(demand.departmentId)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h3 className="text-base font-black text-slate-950">采购物资明细</h3>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">{lineItems.length} 项</span>
            </div>
            {lineItems.length === 0 ? (
              <ShellState variant="empty" title="无物料明细" desc="该需求未登记物料行项目。" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black text-slate-500">
                    <tr>
                      <th className="px-4 py-3">序号</th>
                      <th className="px-4 py-3">物资名称</th>
                      <th className="px-4 py-3">数量</th>
                      <th className="px-4 py-3">单位</th>
                      <th className="px-4 py-3 text-right">参考预算</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.map((li, index) => {
                      const material = materialMap[li.materialId ?? ''];
                      const quantity = Number(li.quantity ?? 0);
                      const amount = material?.referencePrice ? material.referencePrice * quantity : undefined;
                      return (
                        <tr key={li.id ?? `${li.materialId}-${index}`}>
                          <td className="px-4 py-4 font-mono font-black text-slate-400">{index + 1}</td>
                          <td className="px-4 py-4">
                            <p className="font-black text-slate-950">{material?.name ?? li.materialId ?? '--'}</p>
                            <p className="mt-1 text-xs font-bold text-slate-400">{material?.code ?? li.materialId ?? '--'}</p>
                          </td>
                          <td className="px-4 py-4 font-mono font-black text-slate-700">{li.quantity ?? '--'}</td>
                          <td className="px-4 py-4 text-slate-500">{material?.unit ?? '项'}</td>
                          <td className="px-4 py-4 text-right font-mono font-black text-slate-900">{currency(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600"><Bot size={20} /></span>
              <div>
                <p className="text-lg font-black">AI 需求助手</p>
                <p className="font-mono text-xs font-black uppercase text-slate-400">Demand Scanner</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-black text-slate-400">识别物资</p>
                <p className="mt-1 font-mono text-xl font-black text-white">{lineItems.length}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[11px] font-black text-slate-400">需求预算</p>
                <p className="mt-1 font-mono text-xl font-black text-white">{currency(demand.budget)}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-blue-400/20 bg-blue-500/10 p-4">
              <p className="text-xs font-black text-blue-200">合并建议</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-300">
                建议优先匹配同部门、相近交期和相同品类的已通过需求，合并形成采购计划后再进入询比、竞价或商城采购流程。
              </p>
            </div>
            <button className="mt-5 h-10 w-full rounded-lg bg-white text-xs font-black text-slate-950 hover:bg-slate-100" type="button">
              扫描可合并需求
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-950">审批流转</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">基于真实审批状态生成</p>
                </div>
              </div>
              <StatusPill label={demand.status ?? '草稿'} />
            </div>

            <div className="space-y-0 border-l border-slate-200 pl-5">
              {approvalSteps.map((step, index) => {
                const meta = approvalStepMeta(demand.status, index);
                return (
                  <div key={step} className="relative pb-5 last:pb-0">
                    <span
                      className={cn(
                        'absolute -left-[1.65rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white',
                        meta.done
                          ? 'border-emerald-500 text-emerald-600'
                          : meta.current
                            ? 'border-blue-600 text-blue-600'
                            : 'border-slate-300 text-slate-300',
                      )}
                    >
                      <i className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-black text-slate-950">{step}</p>
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-[11px] font-black',
                          meta.done
                            ? 'bg-emerald-50 text-emerald-700'
                            : meta.current
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-bold leading-5 text-slate-500">
                      {approvalStepDetail(demand.status, index)}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-black text-slate-400">当前处理人</p>
              <p className="mt-1.5 text-sm font-black text-slate-950">
                {demand.status === '审批中' ? '智能审批中心待处理' : demand.status === '已通过' ? '审批已完成' : '申请人'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Timer size={18} className="text-blue-600" />
                <div>
                  <h3 className="text-base font-black text-slate-950">操作历史</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">审计日志自动留痕</p>
                </div>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-500">{history.length} 条</span>
            </div>
            <div className="mt-5">
              {audit.isLoading ? (
                <ShellState variant="loading" title="加载操作历史" desc="拉取该需求的审计记录…" />
              ) : history.length === 0 ? (
                <ShellState variant="empty" title="暂无操作记录" desc="对该需求的操作将留痕于此。" />
              ) : (
                <div className="space-y-0 border-l border-slate-200 pl-5">
                  {history.map((a, index) => {
                    const latest = index === 0;
                    return (
                      <div key={a.id} className="relative pb-5 last:pb-0">
                        <span
                          className={cn(
                            'absolute -left-[1.65rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white',
                            latest ? 'border-blue-600 text-blue-600' : 'border-slate-300 text-slate-300',
                          )}
                        >
                          <i className="h-1.5 w-1.5 rounded-full bg-current" />
                        </span>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-950">{ACTION_LABELS[a.action ?? ''] ?? a.action}</p>
                          <span className="font-mono text-[11px] font-black text-slate-400">
                            {dateTimeText(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1.5 truncate text-xs font-bold text-slate-500">
                          操作人：{a.actorId ?? '--'}
                        </p>
                      </div>
                    );
                  })}
                  <div className="relative pb-1">
                    <span className="absolute -left-[1.65rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-slate-300">
                      <i className="h-1.5 w-1.5 rounded-full bg-current" />
                    </span>
                    <p className="text-xs font-bold text-slate-400">
                    系统将继续记录提交、审批、驳回、计划合并等关键动作。
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {demand.status === '已通过' && (
            <FeedbackNotice tone="success" message="需求已审批通过，可在采购需求列表中与其他需求合并生成采购计划。" />
          )}
        </div>
      </div>
    </div>
  );
}
