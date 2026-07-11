import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Settings2 } from 'lucide-react';
import {
  useApprovalInboxTemplates,
  useApprovalInboxUpdateTemplateConfig,
  useBuyerRoleList,
} from '@24bid/api-client';
import { FeedbackNotice, cn } from '@24bid/ui';

// 业务节点说明:审批闸门只决定「是否审批」;审批人/流转规则属审批引擎(模板)配置,两者解耦。
const NODE_DESC: Record<string, { stage: string; bypass: string; locked?: boolean }> = {
  purchase_demand: { stage: '需求申报 → 需求审批', bypass: '关闭后:需求提交即自动通过,直接可合并立项' },
  buyer_supplier_admission: { stage: '供应商准入 → 准入审批', bypass: '关闭后:提交准入即自动准入' },
  rfq_award: { stage: '定标决策 → 定标审批', bypass: '关闭后:选定报价即完成定标并通知供应商' },
  contract_approval: { stage: '合同草案 → 合同审批', bypass: '关闭后:提交即生效' },
  payment_request: { stage: '付款申请审批', bypass: '财务合规节点,固定开启', locked: true },
  payment_batch: { stage: '付款批次审批', bypass: '财务合规节点,固定开启', locked: true },
  payment_archive_exception: { stage: '归档异常处置审批', bypass: '财务合规节点,固定开启', locked: true },
};

// 审批节点配置:租户级开关(基于审批模板启停),业务节点与审批引擎解耦的唯一配置面。
export function ApprovalNodeConfig() {
  const queryClient = useQueryClient();
  const templates = useApprovalInboxTemplates();
  const roles = useBuyerRoleList();
  const update = useApprovalInboxUpdateTemplateConfig();
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const list = templates.data?.data ?? [];
  const roleName = (roleId?: string) =>
    (roles.data?.data ?? []).find((r) => r.id === roleId)?.name ?? roleId ?? '—';

  const toggle = (templateCode: string, roleId: string, currentStatus: string) => {
    const next = currentStatus === 'active' ? 'inactive' : 'active';
    update.mutate(
      { templateCode, data: { defaultApproverRoleId: roleId, status: next } },
      {
        onSuccess: () => {
          setFeedback({ tone: 'success', text: next === 'active' ? '审批节点已开启。' : '审批节点已关闭,该环节将免审直通(审计留痕)。' });
          void queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/approvals'),
          });
        },
        onError: (err) =>
          setFeedback({
            tone: 'error',
            text: (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? '配置失败,请稍后重试。',
          }),
      },
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
      <div className="border-b border-slate-100 p-4">
        <p className="flex items-center gap-2 text-sm font-black text-slate-950">
          <Settings2 size={15} className="text-blue-600" /> 审批节点配置
        </p>
        <p className="mt-1 text-xs font-bold text-slate-400">
          按业务节点配置是否需要审批;关闭的节点免审直通并审计留痕。审批人与流转规则由审批引擎(模板)独立管理,两者解耦。
        </p>
      </div>
      {feedback && (
        <div className="px-4 pt-3">
          <FeedbackNotice tone={feedback.tone} message={feedback.text} />
        </div>
      )}
      {templates.isLoading ? (
        <div className="p-4">
          <FeedbackNotice tone="info" message="正在加载审批节点…" />
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {list.map((t) => {
            const desc = NODE_DESC[t.bizType ?? ''] ?? { stage: t.bizType ?? '—', bypass: '' };
            const active = t.status === 'active';
            const busy = update.isPending && update.variables?.templateCode === t.templateCode;
            return (
              <div key={t.templateCode} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-950">
                    {t.name}
                    {desc.locked && (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-black text-slate-500">
                        <Lock size={10} /> 固定开启
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] font-bold text-slate-400">
                    {desc.stage} · 默认审批角色:{roleName(t.defaultApproverRoleId)}
                    {!desc.locked && ` · ${desc.bypass}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className={cn('text-xs font-black', active ? 'text-emerald-600' : 'text-slate-400')}>
                    {active ? '需要审批' : '免审直通'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={active}
                    disabled={desc.locked || busy}
                    onClick={() => t.templateCode && t.defaultApproverRoleId && toggle(t.templateCode, t.defaultApproverRoleId, t.status ?? 'active')}
                    className={cn(
                      'relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
                      active ? 'bg-emerald-500' : 'bg-slate-300',
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all',
                        active ? 'left-[22px]' : 'left-0.5',
                      )}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
