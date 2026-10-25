import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers3,
  ScanSearch,
  Send,
  ShieldCheck,
  Timer,
  WalletCards,
  Pencil,
  Undo2,
} from 'lucide-react';
import {
  type PurchaseDemandResponse,
  useAuditLogListTargetActions,
  usePurchaseDemandList,
  useMaterialList,
  useWorkflowPurchaseDemandSubmit,
  useWorkflowBusinessHistory,
  axiosInstance,
} from '@24bid/api-client';
import { FeedbackNotice, PrimaryActionButton, ShellState, StatusPill, cn } from '@24bid/ui';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { AiReviewButton } from '../ai/ai-review-button';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
import { DemandCreateForm } from './demand-create-form';
import { useAuthStore } from '../../lib/auth-store';

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

function stayDuration(updatedAt?: string) {
  if (!updatedAt) return null;
  const ms = Date.now() - new Date(updatedAt).getTime();
  if (ms < 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.floor(ms / 60_000))} 分钟`;
  if (hours < 48) return `${hours} 小时`;
  return `${Math.floor(hours / 24)} 天`;
}

function nextActionFor(status?: string) {
  if (status === '草稿') return { node: '需求编制', action: '完善物料明细后点击右上角「提交审批」。' };
  if (status === '已驳回') return { node: '需求编制(已驳回)', action: '按驳回意见修改后重新提交审批。' };
  if (status === '审批中') return { node: '需求审批', action: '等待审批人在「智能审批」中处理,通过后可合并立项。' };
  if (status === '已通过') return { node: '合并立项', action: '可在「采购计划」中与同类需求合并,或用右侧「扫描可合并需求」。' };
  return { node: status ?? '—', action: '—' };
}

function StageFact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-1.5 break-words text-sm font-black text-slate-950">{value}</p>
      {hint && <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{hint}</p>}
    </div>
  );
}

function ProgressTracker({ demand }: { demand: PurchaseDemandResponse }) {
  if(demand.status==='已取消')return <FeedbackNotice tone="info" message="该需求已取消，采购办理已停止，原审批与采购关联记录保留供追溯。"/>;
  const status = demand.status;
  const linkedRfqId = demand.linkedRfqId;
  const linkedRfqStatus = demand.linkedRfqStatus;
  const linked = !!linkedRfqId;
  const approved = status === '已通过';
  const stay = stayDuration(demand.updatedAt);
  const next = nextActionFor(status);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
      <div className="mb-5 flex items-center gap-2">
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
      {/* 流转事实区:当前节点与下一步、关键时间、后续去向——全部由真实字段推导。 */}
      <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 lg:grid-cols-3">
        <StageFact
          label="当前节点"
          value={next.node + (stay && !linked ? ` · 已停留 ${stay}` : '')}
          hint={next.action}
        />
        <StageFact
          label="关键时间"
          value={`创建 ${demand.createdAt?.slice(0, 10) ?? '—'} · 更新 ${demand.updatedAt?.slice(0, 10) ?? '—'}`}
          hint={demand.expectedDeliveryDate ? `期望交付 ${demand.expectedDeliveryDate}` : '未填写期望交付日期'}
        />
        {linked ? (
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-black text-emerald-700">后续去向 · 已进入采购计划</p>
            <p className="mt-1.5 break-words text-sm font-black text-slate-950">{linkedRfqId}</p>
            <p className="mt-1 text-xs font-bold text-emerald-700">
              {linkedRfqStatus ? `当前${linkedRfqStatus}` : '询比流程进行中'} · 在「采购计划」中查看进度
            </p>
          </div>
        ) : (
          <StageFact
            label="后续去向"
            value={approved ? '待合并立项' : '合并立项 → 询比/竞价/商城'}
            hint={
              approved
                ? '与同部门、相近交期、相同品类的已通过需求合并后进入采购流程。'
                : '需求审批通过后,按品类与交期合并生成采购计划,再进入对应采购方式。'
            }
          />
        )}
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
  const approvedDemands = usePurchaseDemandList({ status: '已通过' }, { query: { enabled: false } });
  const [mergeCandidates, setMergeCandidates] = useState<
    Array<{ id: string; title: string; reasons: string[] }> | null
  >(null);
  const audit = useAuditLogListTargetActions({
    targetType: 'purchase_demand',
    targetId: demand.id ?? '',
  });
  const submit = useWorkflowPurchaseDemandSubmit();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState<string | null>(null);
  const userId = useAuthStore((state) => state.session?.userId);
  const workflow = useWorkflowBusinessHistory('purchase_demand', demand.id);
  const instance = workflow.isError ? undefined : workflow.data?.data;
  const withdraw = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => axiosInstance.post(
      `/api/v1/buyer/workflow/instances/${encodeURIComponent(id)}/withdraw-purchase-demand`, { reason }),
    onSuccess: () => {
      setWithdrawReason(null);
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' &&
        /\/buyer\/(demands|workflow|audit)/.test(query.queryKey[0]) });
      onBack();
    },
  });

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

  const submitDemand = (formData: Record<string, unknown>) => {
    submit.mutate(
      { demandId: demand.id!, formData },
      {
        onSuccess: () => {
          refresh();
          onBack();
        },
      },
    );
  };

  if (editing && canSubmit) return <DemandCreateForm initialDemand={demand} onBack={() => setEditing(false)}
    onCreated={() => { setEditing(false); refresh(); onBack(); }} />;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {withdrawReason !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form role="dialog" aria-label="撤回采购需求" className="w-full max-w-md rounded-lg bg-white p-5 space-y-4"
            onSubmit={(event) => { event.preventDefault(); if (instance?.workflowInstanceId && withdrawReason.trim())
              withdraw.mutate({ id: instance.workflowInstanceId, reason: withdrawReason.trim() }); }}>
            <h3 className="text-base font-bold">撤回采购需求</h3>
            <label className="block text-sm">撤回原因<textarea required maxLength={1000} className="mt-2 w-full rounded border p-2"
              value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} /></label>
            {withdraw.isError && <FeedbackNotice tone="error" message="撤回失败，请刷新确认审批状态与权限。" />}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setWithdrawReason(null)} disabled={withdraw.isPending}>返回</button>
              <button type="submit" disabled={withdraw.isPending || !withdrawReason.trim()} className="rounded bg-red-700 px-4 py-2 text-white disabled:opacity-40">确认撤回</button>
            </div>
          </form>
        </div>
      )}
      <div className="rounded-lg border border-slate-200 bg-white px-6 py-5 shadow-sm shadow-slate-200/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={onBack}
              aria-label="返回需求列表"
              title="返回需求列表"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="break-words text-xl font-black text-slate-950">{demand.title ?? '--'}</h2>
                <StatusPill label={demand.status ?? '草稿'} />
                {demand.source === '直录登记' && (
                  <span className="rounded bg-amber-50 px-2 py-1 text-xs font-black text-amber-700">
                    直录登记 · 由采购计划/询价直接创建
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm font-bold text-slate-500">
                需求编号: {demand.id ?? '--'} · 创建日期: {demand.createdAt?.slice(0, 10) ?? '--'} · 申请部门: {departmentLabel(demand.departmentId)}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canSubmit && <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-bold">
              <Pencil size={15} />修改需求</button>}
            {userId && demand.status === '审批中' && instance?.status === 'processing' && instance.initiatorId === userId &&
              <button type="button" onClick={() => { withdraw.reset(); setWithdrawReason(''); }} className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-xs font-bold">
                <Undo2 size={15} />撤回审批</button>}
            {canSubmit ? (
              <PrimaryActionButton onClick={() => setShowSubmitDialog(true)} busy={submit.isPending} pendingLabel="提交中">
                <Send size={15} /> 提交审批
              </PrimaryActionButton>
            ) : (
              <span role="status" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-600">
                <CheckCircle2 size={15} /> {demand.status === '已通过' ? '审批通过' : demand.status === '已取消' ? '已取消' : demand.status === '已转询价' ? '已转采购' : '处理中'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          <AiReviewButton subjectType="demand" subjectId={demand.id ?? ''} />
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={WalletCards} label="需求预算" value={currency(demand.budget)} tone="bg-blue-50 text-blue-600" />
            <MetricCard icon={CalendarDays} label="期望交期" value={demand.expectedDeliveryDate ?? '待定'} tone="bg-violet-50 text-violet-600" />
            <MetricCard icon={Layers3} label="优先级" value={demand.priority ?? '常规'} tone="bg-amber-50 text-amber-600" />
          </div>

          <ProgressTracker demand={demand} />

          {instance && ['草稿','已取消'].includes(demand.status||'') && <FeedbackNotice tone="info" message={demand.status==='草稿'?'需求当前为草稿，下方为历史审批记录；本次修改必须重新提交审批，原通过意见不代表本次已批准。':'需求已经取消，下方审批记录仅作为历史留痕，不代表需求仍在执行。'}/>}

          {demand.id && <WorkflowStatusPanel businessType="purchase_demand" businessId={demand.id} />}

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
                <p className="text-lg font-black">需求合并助手</p>
                <p className="font-mono text-xs font-black uppercase text-slate-400">基于真实需求数据扫描</p>
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
            <button
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-black text-white shadow-sm shadow-blue-900/40 transition hover:bg-blue-500 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
              type="button"
              disabled={approvedDemands.isFetching}
              onClick={async () => {
                const result = await approvedDemands.refetch();
                if (result.isError) return;
                // 真实扫描:同部门或品类重叠、已通过且未关联询比的其它需求。
                const materialCategory: Record<string, string> = {};
                (materials.data?.data ?? []).forEach((m) => {
                  if (m.id) materialCategory[m.id] = m.category ?? '其他';
                });
                const myCategories = new Set(
                  (demand.lineItems ?? []).map((line) => materialCategory[line.materialId ?? '']).filter(Boolean),
                );
                const candidates = (result.data?.data ?? [])
                  .filter((other: PurchaseDemandResponse) => other.id !== demand.id && !other.linkedRfqId)
                  .map((other: PurchaseDemandResponse) => {
                    const reasons: string[] = [];
                    if (other.departmentId && other.departmentId === demand.departmentId) reasons.push('同部门');
                    const overlap = (other.lineItems ?? [])
                      .map((line) => materialCategory[line.materialId ?? ''])
                      .filter((category) => category && myCategories.has(category));
                    if (overlap.length > 0) reasons.push(`品类相同(${Array.from(new Set(overlap)).join('/')})`);
                    return { id: other.id ?? '', title: other.title ?? other.id ?? '', reasons };
                  })
                  .filter((candidate) => candidate.reasons.length > 0);
                setMergeCandidates(candidates);
              }}
            >
              <ScanSearch size={15} />
              {approvedDemands.isFetching ? '扫描中…' : mergeCandidates == null ? '扫描可合并需求' : '重新扫描'}
            </button>
            {approvedDemands.isError && <p role="alert" className="mt-2 text-sm text-red-200">扫描失败，请重试。</p>}
            {mergeCandidates && (
              <div className="mt-3 space-y-2">
                {mergeCandidates.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-300">
                    未发现可合并的已通过需求(同部门或品类重叠、且未关联询比)。
                  </p>
                ) : (
                  mergeCandidates.map((candidate) => (
                    <div key={candidate.id} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                      <p className="text-xs font-black text-emerald-200">{candidate.title}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-300">
                        {candidate.id} · {candidate.reasons.join(' · ')} · 可在「采购计划」中合并立项
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}
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

            <div className="space-y-5 border-l border-slate-100 pl-5">
              {approvalSteps.map((step, index) => {
                const meta = approvalStepMeta(demand.status, index);
                return (
                  <div key={step} className="relative">
                    <i className={cn('absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full',
                      meta.done ? 'bg-emerald-500' : meta.current ? 'bg-blue-600' : 'bg-slate-300')} />
                    <p className="text-sm font-black text-slate-950">{step}</p>
                    <p className="mt-1 break-words text-xs font-bold text-slate-500">
                      {meta.label} · {approvalStepDetail(demand.status, index)}
                    </p>
                    {meta.current && (
                      <span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">当前节点</span>
                    )}
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
                <div className="space-y-5 border-l border-slate-100 pl-5">
                  {history.map((a, index) => {
                    const latest = index === 0;
                    return (
                      <div key={a.id} className="relative">
                        <i className={cn('absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full', latest ? 'bg-blue-600' : 'bg-slate-300')} />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-black text-slate-950">{ACTION_LABELS[a.action ?? ''] ?? a.action}</p>
                          <span className="font-mono text-[11px] font-black text-slate-400">
                            {dateTimeText(a.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-bold text-slate-500">
                          操作人：{a.actorId ?? '--'}
                        </p>
                      </div>
                    );
                  })}
                  <div className="relative">
                    <i className="absolute -left-[1.45rem] top-1 h-2 w-2 rounded-full bg-slate-200" />
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
      {showSubmitDialog && (
        <WorkflowSubmitDialog
          businessType="purchase_demand"
          title={demand.title ?? demand.id ?? '采购需求'}
          busy={submit.isPending}
          submissionError={submit.error}
          onClose={() => setShowSubmitDialog(false)}
          onSubmit={submitDemand}
        />
      )}
    </div>
  );
}
