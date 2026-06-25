import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';
import {
  type BuyerSupplierResponse,
  useBuyerSupplierChangeStatus,
  useBuyerSupplierList,
  useBuyerSupplierReviewAdmission,
  useBuyerSupplierSubmitAdmission,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  ListToolbar,
  MiniFact,
  Panel,
  ResponsiveTableFrame,
  StatusPill,
  cn,
} from '@24bid/ui';
import { SupplierEvaluationPanel } from './supplier-evaluation-panel';
import { OwnerAttachments } from '../attachments/owner-attachments';

const STATUS_FILTERS = ['全部', '待准入', '准入审批中', '已准入', '已驳回', '黑名单'] as const;

export function SuppliersPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('全部');
  const [evalOpenId, setEvalOpenId] = useState<string | null>(null);
  const [profileOpenId, setProfileOpenId] = useState<string | null>(null);

  const query = useBuyerSupplierList(status === '全部' ? undefined : { status });
  const submit = useBuyerSupplierSubmitAdmission();
  const review = useBuyerSupplierReviewAdmission();
  const changeStatus = useBuyerSupplierChangeStatus();
  const suppliers = query.data?.data ?? [];

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const busyId =
    (submit.isPending && submit.variables?.relationId) ||
    (review.isPending && review.variables?.relationId) ||
    (changeStatus.isPending && changeStatus.variables?.relationId) ||
    null;

  const actionsFor = (s: (typeof suppliers)[number]) => {
    const id = s.id;
    if (!id) return null;
    const busy = busyId === id;
    const btn = (label: string, onClick: () => void, tone: 'blue' | 'emerald' | 'red') => (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={cn(
          'inline-flex h-8 items-center rounded-md px-3 text-xs font-black text-white transition disabled:bg-slate-400',
          tone === 'emerald' && 'bg-emerald-600 hover:bg-emerald-700',
          tone === 'blue' && 'bg-blue-600 hover:bg-blue-700',
          tone === 'red' && 'bg-red-600 hover:bg-red-700',
        )}
      >
        {busy ? '处理中' : label}
      </button>
    );

    switch (s.status) {
      case '待准入':
      case '已驳回':
        return btn('提交准入', () => submit.mutate({ relationId: id }, { onSuccess: refresh }), 'blue');
      case '准入审批中':
        return (
          <div className="flex gap-2">
            {btn('通过', () => review.mutate({ relationId: id, data: { approved: true } }, { onSuccess: refresh }), 'emerald')}
            {btn('驳回', () => review.mutate({ relationId: id, data: { approved: false } }, { onSuccess: refresh }), 'red')}
          </div>
        );
      case '已准入':
        return btn('加入黑名单', () => changeStatus.mutate({ relationId: id, data: { status: '黑名单' } }, { onSuccess: refresh }), 'red');
      case '黑名单':
        return btn('恢复待准入', () => changeStatus.mutate({ relationId: id, data: { status: '待准入' } }, { onSuccess: refresh }), 'blue');
      default:
        return null;
    }
  };

  return (
    <Panel title="供应商库" icon={Boxes} subtitle="私域关系 · 准入 · 分级 · 绩效">
      <ListToolbar
        title="私域供应商"
        recordCount={suppliers.length}
        filterLabel={status}
        actionLabel="新增供应商"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              'h-8 rounded-md border px-3 text-xs font-black transition',
              s === status
                ? 'border-blue-200 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载供应商库…" />
      ) : suppliers.length === 0 ? (
        <FeedbackNotice tone="info" message="当前筛选下暂无供应商。" />
      ) : (
        <ResponsiveTableFrame
          mobileCards={suppliers.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-black text-slate-950">{s.supplierName}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    等级 {s.level} · 最近评分 {s.lastEvaluationScore ?? '—'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {s.status && <StatusPill label={s.status} />}
                  {s.cooperationTier && <StatusPill label={s.cooperationTier} />}
                </div>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MiniFact label="授权品类" value={(s.categories ?? []).join('、') || '—'} />
                <MiniFact label="绩效评分" value={String(s.performanceScore ?? '—')} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {actionsFor(s)}
                {s.id && (
                  <button
                    type="button"
                    onClick={() => setProfileOpenId(profileOpenId === s.id ? null : s.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                  >
                    {profileOpenId === s.id ? '收起档案' : '供应商档案'}
                  </button>
                )}
                {s.id && (
                  <button
                    type="button"
                    onClick={() => setEvalOpenId(evalOpenId === s.id ? null : s.id!)}
                    className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                  >
                    {evalOpenId === s.id ? '收起考核' : '绩效考核'}
                  </button>
                )}
              </div>
              {profileOpenId === s.id && <SupplierProfileBlock s={s} />}
              {evalOpenId === s.id && s.id && (
                <SupplierEvaluationPanel relationId={s.id} supplierId={s.supplierId} />
              )}
            </div>
          ))}
        >
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">供应商</th>
                <th className="px-4 py-3">准入状态</th>
                <th className="px-4 py-3">等级</th>
                <th className="px-4 py-3">生命周期标记</th>
                <th className="px-4 py-3">授权品类</th>
                <th className="px-4 py-3 text-right">绩效</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-4 font-bold text-slate-900">{s.supplierName}</td>
                  <td className="px-4 py-4">{s.status && <StatusPill label={s.status} />}</td>
                  <td className="px-4 py-4 font-black text-slate-700">{s.level}</td>
                  <td className="px-4 py-4">{s.cooperationTier && <StatusPill label={s.cooperationTier} />}</td>
                  <td className="px-4 py-4 text-slate-600">{(s.categories ?? []).join('、')}</td>
                  <td className="px-4 py-4 text-right font-mono font-black text-slate-900">
                    {s.performanceScore}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {actionsFor(s)}
                      {s.id && (
                        <button
                          type="button"
                          onClick={() => setProfileOpenId(profileOpenId === s.id ? null : s.id!)}
                          className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
                        >
                          {profileOpenId === s.id ? '收起' : '档案'}
                        </button>
                      )}
                      {s.id && (
                        <button
                          type="button"
                          onClick={() => setEvalOpenId(evalOpenId === s.id ? null : s.id!)}
                          className="inline-flex h-8 items-center rounded-md border border-indigo-200 bg-white px-3 text-xs font-black text-indigo-700 hover:bg-indigo-50"
                        >
                          {evalOpenId === s.id ? '收起' : '考核'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTableFrame>
      )}

      {profileOpenId && (
        <div className="hidden lg:block">
          {(() => {
            const s = suppliers.find((x) => x.id === profileOpenId);
            return s ? <SupplierProfileBlock s={s} /> : null;
          })()}
        </div>
      )}

      {evalOpenId && (
        <div className="hidden lg:block">
          <SupplierEvaluationPanel
            relationId={evalOpenId}
            supplierId={suppliers.find((x) => x.id === evalOpenId)?.supplierId}
          />
        </div>
      )}
    </Panel>
  );
}

// 供应商档案：采购方视角的供应商主数据（信用代码/法人/联系人/银行/经营范围）。
function SupplierProfileBlock({ s }: { s: BuyerSupplierResponse }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-600">供应商档案 · {s.supplierName}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <MiniFact label="统一社会信用代码" value={s.creditCode || '—'} />
        <MiniFact label="法定代表人" value={s.legalPerson || '—'} />
        <MiniFact label="联系人" value={s.contactName || '—'} />
        <MiniFact label="联系电话" value={s.contactPhone || '—'} />
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <MiniFact label="联系邮箱" value={s.contactEmail || '—'} />
        <MiniFact label="开户银行" value={s.bankName || '—'} />
        <MiniFact label="银行账号" value={s.bankAccount || '—'} />
      </div>
      <div className="mt-2 rounded-lg border border-slate-100 bg-white p-3">
        <p className="text-[11px] font-black text-slate-400">经营范围</p>
        <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-700">
          {s.businessScope || '未填写经营范围。'}
        </p>
      </div>
      {s.supplierId && (
        <OwnerAttachments
          ownerType="supplier"
          ownerId={s.supplierId}
          title="资质附件"
          emptyHint="暂无资质附件，点击右上角上传营业执照、资质证书、开户许可证等。"
        />
      )}
    </div>
  );
}
