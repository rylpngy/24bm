import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link2, Mail, Plus } from 'lucide-react';
import {
  type SupplierInvitationResponse,
  useBuyerSupplierInvitationCreate,
  useBuyerSupplierInvitationList,
  useBuyerSupplierInvitationRespond,
} from '@24bid/api-client';
import { FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill, cn } from '@24bid/ui';

const schema = z.object({
  supplierName: z.string().min(2, '请填写供应商名称'),
  contact: z.string(),
  category: z.string(),
  supplierId: z.string(),
  note: z.string(),
});
type FormValues = z.infer<typeof schema>;

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

// 邀请管理:发起邀请 → 待回复 → 接受/拒绝/撤回;接受关联已知供应商时桥接为私域待准入。
export function SupplierInvitationsView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('全部');

  const query = useBuyerSupplierInvitationList();
  const create = useBuyerSupplierInvitationCreate();
  const respond = useBuyerSupplierInvitationRespond();
  const allInvitations = query.data?.data ?? [];
  const invitations =
    statusFilter === '全部'
      ? allInvitations
      : allInvitations.filter((i) => i.status === statusFilter);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierName: '', contact: '', category: '', supplierId: '', note: '' },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/buyer/suppliers'),
    });

  const onSubmit = (values: FormValues) =>
    create.mutate(
      {
        data: {
          supplierName: values.supplierName,
          supplierId: values.supplierId || undefined,
          contact: values.contact || undefined,
          category: values.category || undefined,
          note: values.note || undefined,
        },
      },
      {
        onSuccess: () => {
          reset();
          setShowForm(false);
          refresh();
        },
      },
    );

  const act = (id: string, action: 'accept' | 'decline' | 'withdraw') =>
    respond.mutate({ id, data: { action } }, { onSuccess: refresh });

  const count = (st: string) => allInvitations.filter((i) => i.status === st).length;
  const respondingId = respond.isPending ? respond.variables?.id : null;
  const STATUS_CHIPS = ['全部', '待回复', '已接受', '已拒绝', '已撤回'];

  return (
    <Panel title="邀请管理" icon={Mail} subtitle="邀请供应商注册 / 补资料 · 接受可转私域待准入">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <MiniFact label="待回复" value={String(count('待回复'))} />
        <MiniFact label="已接受" value={String(count('已接受'))} />
        <MiniFact label="已拒绝" value={String(count('已拒绝'))} />
        <MiniFact label="已撤回" value={String(count('已撤回'))} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                'h-8 rounded-md border px-3 text-xs font-black transition',
                s === statusFilter
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {s}
              {s !== '全部' && count(s) > 0 && <span className="ml-1 text-slate-400">{count(s)}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white transition hover:bg-blue-700"
        >
          <Plus size={14} /> {showForm ? '收起' : '发起邀请'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-sm font-black text-blue-800">发起供应商邀请</p>
          <p className="mt-0.5 text-xs font-bold text-blue-600">
            关联「平台供应商 ID」后,接受邀请将自动转入私域待准入。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500">供应商名称 *</label>
              <input className={inputCls} placeholder="如 蓝海办公用品" {...register('supplierName')} />
              {errors.supplierName && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.supplierName.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">联系方式</label>
              <input className={inputCls} placeholder="邮箱 / 电话" {...register('contact')} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">品类</label>
              <input className={inputCls} placeholder="如 办公耗材" {...register('category')} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">平台供应商 ID(选填)</label>
              <input className={inputCls} placeholder="如 ent-supplier-newapply" {...register('supplierId')} />
            </div>
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="text-xs font-black text-slate-500">邀请说明</label>
              <input className={inputCls} placeholder="邀请补充资质并报价…" {...register('note')} />
            </div>
          </div>
          {create.isError && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message="发起失败,请稍后重试。" />
            </div>
          )}
          <PrimaryActionButton onClick={handleSubmit(onSubmit)} busy={create.isPending} pendingLabel="发起中">
            发起邀请
          </PrimaryActionButton>
        </form>
      )}

      {query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载邀请单…" />
      ) : invitations.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={statusFilter === '全部' ? '暂无邀请单,点击「发起邀请」。' : `没有「${statusFilter}」的邀请单。`}
        />
      ) : (
        <div className="space-y-2">
          {invitations.map((i) => (
            <InvitationCard
              key={i.id}
              invitation={i}
              busy={respondingId === i.id}
              onAct={(action) => i.id && act(i.id, action)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function InvitationCard({
  invitation: i,
  busy,
  onAct,
}: {
  invitation: SupplierInvitationResponse;
  busy: boolean;
  onAct: (action: 'accept' | 'decline' | 'withdraw') => void;
}) {
  const pending = i.status === '待回复';
  const btn = (label: string, action: 'accept' | 'decline' | 'withdraw', tone: 'emerald' | 'red' | 'slate') => (
    <button
      type="button"
      onClick={() => onAct(action)}
      disabled={busy}
      className={cn(
        'inline-flex h-8 items-center rounded-md px-3 text-xs font-black transition disabled:opacity-50',
        tone === 'emerald' && 'bg-emerald-600 text-white hover:bg-emerald-700',
        tone === 'red' && 'bg-red-600 text-white hover:bg-red-700',
        tone === 'slate' && 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      )}
    >
      {busy ? '处理中' : label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-black text-slate-950">{i.supplierName}</p>
          {i.status && <StatusPill label={i.status} />}
          {i.linkedToKnownSupplier && (
            <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">
              <Link2 size={11} /> 接受转待准入
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {i.category || '—'} · {i.contact || '无联系方式'}
          {i.note ? ` · ${i.note}` : ''}
        </p>
        {i.respondedAt && (
          <p className="mt-0.5 text-[11px] font-bold text-slate-400">
            回复于 {i.respondedAt.slice(0, 16).replace('T', ' ')}
          </p>
        )}
      </div>
      {pending ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {btn('标记已接受', 'accept', 'emerald')}
          {btn('标记已拒绝', 'decline', 'red')}
          {btn('撤回', 'withdraw', 'slate')}
        </div>
      ) : (
        <span className="shrink-0 text-xs font-bold text-slate-400">已处理</span>
      )}
    </div>
  );
}
