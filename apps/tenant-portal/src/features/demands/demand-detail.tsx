import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import {
  type PurchaseDemandResponse,
  useAuditLogListTargetActions,
  useMaterialList,
  usePurchaseDemandSubmit,
} from '@24bid/api-client';
import {
  DetailActionPanel,
  DetailHeroCard,
  DetailKeyValueRow,
  DetailSection,
  NextActionNotice,
  PrimaryActionButton,
  ProcessStateNotice,
  ShellState,
} from '@24bid/ui';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const ACTION_LABELS: Record<string, string> = {
  'purchase_demand.created': '创建需求',
  'purchase_demand.updated': '编辑需求',
  'purchase_demand.submitted': '提交审批',
  'purchase_demand.approved': '审批通过',
  'purchase_demand.rejected': '审批驳回',
};

export function DemandDetail({
  demand,
  onBack,
}: {
  demand: PurchaseDemandResponse;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const materials = useMaterialList();
  // 后端已支持空 actions(返回该目标全部动作),无需再传全量 action key。
  const audit = useAuditLogListTargetActions({
    targetType: 'purchase_demand',
    targetId: demand.id ?? '',
  });
  const submit = usePurchaseDemandSubmit();

  const materialName = useMemo(() => {
    const map: Record<string, string> = {};
    (materials.data?.data ?? []).forEach((m) => {
      if (m.id) map[m.id] = `${m.name}（${m.code}）`;
    });
    return map;
  }, [materials.data]);

  const lineItems = demand.lineItems ?? [];
  const history = audit.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' &&
        /\/buyer\/(demands|audit)/.test(q.queryKey[0] as string),
    });

  const nextAction = (() => {
    switch (demand.status) {
      case '草稿':
        return { title: '下一步：提交审批', detail: '草稿需求完善后提交审批，进入审批流程。', tone: 'blue' as const };
      case '审批中':
        return { title: '等待审批', detail: '需求已提交，等待审批人通过或驳回。', tone: 'amber' as const };
      case '已驳回':
        return { title: '下一步：修改后重新提交', detail: '驳回需求可在草稿修改后重新提交审批。', tone: 'amber' as const };
      case '已通过':
        return { title: '下一步：转询价（RFQ）', detail: '已通过需求可创建询价邀请供应商报价。', tone: 'emerald' as const };
      default:
        return null;
    }
  })();

  const canSubmit = demand.status === '草稿' || demand.status === '已驳回';

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
      >
        <ArrowLeft size={14} /> 返回需求列表
      </button>

      <DetailHeroCard
        eyebrow="采购需求"
        title={demand.title ?? '—'}
        meta={`需求编号 ${demand.id} · 部门 ${demand.departmentId ?? '—'}`}
        status={demand.status}
        amountLabel={`预算 ${currency(demand.budget)}`}
        facts={[
          { label: '申请部门', value: demand.departmentId ?? '—' },
          { label: '申请人', value: demand.requesterId ?? '—' },
          { label: '期望交期', value: demand.expectedDeliveryDate ?? '待定' },
          { label: '优先级', value: demand.priority ?? '常规' },
        ]}
      />

      <DetailSection title="需求信息">
        <div className="grid gap-2 sm:grid-cols-2">
          <DetailKeyValueRow label="预算金额" value={currency(demand.budget)} fontMono />
          <DetailKeyValueRow label="优先级" value={demand.priority ?? '常规'} />
          <DetailKeyValueRow label="期望交期" value={demand.expectedDeliveryDate ?? '待定'} />
          <DetailKeyValueRow label="创建时间" value={demand.createdAt?.slice(0, 10) ?? '—'} />
        </div>
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-[11px] font-black text-slate-400">用途说明</p>
          <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
            {demand.purpose || '未填写用途说明。'}
          </p>
        </div>
      </DetailSection>

      <DetailSection title="物料明细" countLabel={`${lineItems.length} 项`}>
        {lineItems.length === 0 ? (
          <ShellState variant="empty" title="无物料明细" desc="该需求未登记物料行项目。" />
        ) : (
          <div className="space-y-2">
            {lineItems.map((li) => (
              <DetailKeyValueRow
                key={li.id}
                label={materialName[li.materialId ?? ''] ?? li.materialId ?? '—'}
                value={`数量 ${li.quantity ?? '—'}`}
              />
            ))}
          </div>
        )}
      </DetailSection>

      <DetailSection title="操作历史" countLabel={`${history.length} 条`}>
        {audit.isLoading ? (
          <ShellState variant="loading" title="加载操作历史" desc="拉取该需求的审计记录…" />
        ) : history.length === 0 ? (
          <ShellState variant="empty" title="暂无操作记录" desc="对该需求的操作将留痕于此。" />
        ) : (
          <div className="space-y-2">
            {history.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <span className="text-xs font-black text-slate-700">
                  {ACTION_LABELS[a.action ?? ''] ?? a.action}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {a.actorId} · {a.createdAt?.slice(0, 16).replace('T', ' ')}
                </span>
              </div>
            ))}
          </div>
        )}
      </DetailSection>

      <DetailActionPanel
        title="需求处理"
        desc="按当前状态执行需求流转动作。"
        status={demand.status}
        tone={demand.status === '已通过' ? 'emerald' : 'blue'}
      >
        {canSubmit ? (
          <PrimaryActionButton
            onClick={() => submit.mutate({ demandId: demand.id! }, { onSuccess: () => { refresh(); onBack(); } })}
            busy={submit.isPending}
            pendingLabel="提交中"
            flushTop
          >
            提交审批
          </PrimaryActionButton>
        ) : (
          <ProcessStateNotice
            variant={demand.status === '已通过' ? 'handled' : demand.status === '审批中' ? 'waiting' : 'handled'}
            title={demand.status === '已通过' ? '需求已通过' : '需求处理中'}
            desc={demand.status === '已通过' ? '可在询价项目中从本需求创建 RFQ。' : '当前状态无需操作。'}
          />
        )}
      </DetailActionPanel>

      {nextAction && (
        <NextActionNotice title={nextAction.title} detail={nextAction.detail} tone={nextAction.tone} />
      )}
    </div>
  );
}
