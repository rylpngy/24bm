import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CheckCircle2, Link2, Mail, Plus, RotateCcw, Send, XCircle } from 'lucide-react';
import {
  type SupplierInvitationResponse,
  useBuyerSupplierInvitationCreate,
  useBuyerSupplierInvitationList,
  useBuyerSupplierInvitationRespond,
  useBuyerSupplierDiscoveryDiscover,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  ConfirmDialog,
  Pagination,
  Panel,
  PrimaryActionButton,
  SearchInput,
  StatusPill,
  cn,
} from '@24bid/ui';
import { ExcelImportControl } from '../shared/excel-import-control';
import { SupplierMetricCard, SupplierMetricGrid } from './supplier-metric-card';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';

const PAGE_SIZE = 8;

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

export function SupplierInvitationsView() {
  const { can } = useBuyerPermissions();
  return can('buyer:supplier:manage') ? <ManagedSupplierInvitations /> : null;
}

function ManagedSupplierInvitations() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState('全部');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [discoveryKeyword, setDiscoveryKeyword] = useState('');
  const [actionError, setActionError] = useState('');
  const [createError, setCreateError] = useState('');
  const [target, setTarget] = useState<{ invitation: SupplierInvitationResponse; action: 'accept' | 'decline' | 'withdraw' } | null>(null);
  const createLock = useRef(false);
  const actionLock = useRef(false);

  const query = useBuyerSupplierInvitationList();
  const create = useBuyerSupplierInvitationCreate();
  const respond = useBuyerSupplierInvitationRespond();
  const allInvitations = query.isError ? [] : query.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const filtered = allInvitations.filter((i) => {
    if (statusFilter !== '全部' && i.status !== statusFilter) return false;
    if (!kw) return true;
    return [i.supplierName, i.contact, i.category, i.note]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(kw);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const invitations = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierName: '', contact: '', category: '', supplierId: '', note: '' },
  });
  const selectedId = watch('supplierId');
  const discovery = useBuyerSupplierDiscoveryDiscover(discoveryKeyword ? { keyword: discoveryKeyword } : undefined, { query: { enabled: showForm } });
  const candidates = discovery.isError ? [] : discovery.data?.data ?? [];
  const selected = candidates.find(candidate => candidate.supplierId === selectedId);

  const refresh = () =>
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(suppliers|supplier-invitations|supplier-discovery)/.test(q.queryKey[0]),
    });

  const onSubmit = (values: FormValues) => {
    if (createLock.current || create.isPending) return;
    if (values.supplierId && (discovery.isError || discovery.isFetching || !selected?.name)) { setCreateError('平台供应商信息不可用，请重新选择。'); return; }
    createLock.current = true; setCreateError('');
    create.mutate(
      {
        data: {
          supplierName: values.supplierId ? selected!.name! : values.supplierName.trim(),
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
        onError: (error) => setCreateError((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '发起失败，请重试。'),
        onSettled: () => { createLock.current = false; },
      },
    );
  };

  const act = () => {
    if (!target?.invitation.id || actionLock.current || respond.isPending || query.isError || query.isFetching) return;
    const current = allInvitations.find(row => row.id === target.invitation.id);
    if (!current || current.status !== '待回复' || ((current.supplierId || current.linkedToKnownSupplier) && target.action !== 'withdraw')) return;
    actionLock.current = true; setActionError('');
    respond.mutate({ id: current.id!, data: { action: target.action } }, {
      onSuccess: () => { setTarget(null); void refresh(); },
      onError: error => setActionError((error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '办理失败，请重试或刷新邀请。'),
      onSettled: () => { actionLock.current = false; },
    });
  };

  const count = (st: string) => allInvitations.filter((i) => i.status === st).length;
  const STATUS_CHIPS = ['全部', '待回复', '已接受', '已拒绝', '已撤回'];

  return (
    <Panel title="邀请管理" icon={Mail} subtitle="">
      <ConfirmDialog open={!!target && !query.isError} title={target?.action === 'withdraw' ? '撤回合作邀请' : '登记线下反馈'}
        message={`${target?.invitation.supplierName ?? ''}：${target?.action === 'withdraw' ? '撤回后该邀请不可继续回复。' : `仅登记线下${target?.action === 'accept' ? '接受' : '拒绝'}结果，不代表已通知供应商，也不代表准入通过。`}${actionError ? ` ${actionError}` : ''}`}
        confirmLabel={target?.action === 'withdraw' ? '确认撤回' : '确认登记'} busy={respond.isPending || query.isFetching}
        onConfirm={act} onCancel={() => { if (!actionLock.current) setTarget(null); }} />
      <SupplierMetricGrid>
        <SupplierMetricCard icon={Send} label="待回复" value={String(count('待回复'))} hint="平台邀请 / 线下待登记" tone="blue" />
        <SupplierMetricCard icon={CheckCircle2} label="已接受" value={String(count('已接受'))} hint="准入仍需单独办理" tone="emerald" />
        <SupplierMetricCard icon={XCircle} label="已拒绝" value={String(count('已拒绝'))} hint="需重新跟进" tone="rose" />
        <SupplierMetricCard icon={RotateCcw} label="已撤回" value={String(count('已撤回'))} hint="已停止邀请" tone="slate" />
      </SupplierMetricGrid>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {STATUS_CHIPS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
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
        <SearchInput
          className="mb-0 ml-auto"
          placeholder="按名称 / 联系 / 品类搜索"
          onSearch={(k) => {
            setKeyword(k);
            setPage(1);
          }}
        />
        <ExcelImportControl
          endpoint="/api/v1/buyer/supplier-invitations/import"
          templateName="供应商邀请导入模板"
          invalidatePrefix="/api/v1/buyer/supplier-invitations"
          label="批量导入邀请"
        />
        <span className="text-xs text-slate-500">未绑定的线下说明及导入备注仅买方可见。</span>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
        >
          <Plus size={14} /> {showForm ? '收起' : '发起邀请'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-sm font-black text-blue-800">发起供应商邀请</p>
          <p className="mt-0.5 text-xs font-bold text-blue-600">
            平台邀请由受邀供应商回复，接受后新关系进入待准入；线下记录仅用于买方登记，不通知供应商。
          </p>
          <fieldset disabled={create.isPending} className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-black text-slate-500"><span className="mr-1 text-red-500">*</span>供应商名称</label>
              <input aria-label="供应商名称" readOnly={!!selectedId} className={inputCls} placeholder="如 蓝海办公用品" {...register('supplierName')} />
              {errors.supplierName && (
                <p className="mt-1 text-xs font-bold text-red-600">{errors.supplierName.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">联系方式(选填)</label>
              <input className={inputCls} placeholder="邮箱 / 电话" {...register('contact')} />
            </div>
            <div>
              <label className="text-xs font-black text-slate-500">品类(选填)</label>
              <input className={inputCls} placeholder="如 办公耗材" {...register('category')} />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500">检索平台企业<input className={inputCls} value={discoveryKeyword} onChange={event => {
                if (selectedId) setValue('note', '');
                setDiscoveryKeyword(event.target.value); setValue('supplierId', ''); setValue('supplierName', '');
              }} /></label>
              <label className="mt-2 block text-xs font-black text-slate-500">平台供应商<select className={inputCls} value={selectedId} onChange={event => {
                const id = event.target.value; const candidate = candidates.find(row => row.supplierId === id);
                if (id !== selectedId) setValue('note', '');
                setValue('supplierId', id); setValue('supplierName', candidate?.name ?? '', { shouldValidate: true });
              }}><option value="">线下登记（不通知供应商）</option>{candidates.filter(candidate => candidate.supplierId && candidate.name).map(candidate => <option key={candidate.supplierId} value={candidate.supplierId}>{candidate.name}</option>)}</select></label>
              {discovery.isError ? <><p role="alert" className="mt-2 text-xs text-red-600">平台企业加载失败。</p><button type="button" className="mt-1 text-xs text-blue-700" onClick={() => void discovery.refetch()}>重试企业检索</button></>
                : discovery.isFetching ? <p className="mt-1 text-xs text-slate-500">正在检索平台企业…</p> : candidates.length === 0 && <p className="mt-1 text-xs text-slate-500">暂无匹配的平台企业。</p>}
            </div>
            <div className="sm:col-span-1 lg:col-span-2">
              <label className="block text-xs font-black text-slate-500">{selectedId ? '邀请说明（向受邀供应商展示）' : '线下备注（仅买方可见）'}
                <input className={inputCls} {...register('note')} /></label>
            </div>
          </fieldset>
          {(create.isError || createError) && (
            <div className="mt-3">
              <FeedbackNotice tone="error" message={createError || '发起失败，请重试。'} />
            </div>
          )}
          <PrimaryActionButton onClick={handleSubmit(onSubmit)} disabled={create.isPending || (!!selectedId && (discovery.isError || discovery.isFetching || !selected))} busy={create.isPending} pendingLabel="发起中">
            发起邀请
          </PrimaryActionButton>
        </form>
      )}

      {query.isError ? <><FeedbackNotice tone="error" message="邀请加载失败，请重试。" /><button type="button" className="mt-3 min-h-9 rounded-md border border-slate-200 px-3 text-sm" onClick={() => void query.refetch()}>重试</button></> : query.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载邀请单…" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            statusFilter === '全部' && !keyword
              ? '暂无邀请单,点击「发起邀请」。'
              : '没有符合条件的邀请单。'
          }
        />
      ) : (
        <>
          <div className="space-y-2">
            {invitations.map((i) => (
              <InvitationCard
                key={i.id}
                invitation={i}
                busy={respond.isPending || query.isFetching}
                onAct={(action) => { if (!actionLock.current) { setActionError(''); setTarget({ invitation: i, action }); } }}
              />
            ))}
          </div>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
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
    <div data-invitation-id={i.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="break-words font-black text-slate-950">{i.supplierName}</p>
          {i.status && <StatusPill label={i.status} />}
          {(i.supplierId || i.linkedToKnownSupplier) ? (
            <span className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[11px] font-black text-indigo-700">
              <Link2 size={11} /> 平台合作邀请
            </span>
          ) : <span className="text-xs text-amber-800">线下记录（未通知供应商）</span>}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs font-bold text-slate-500">
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
          {!i.supplierId && !i.linkedToKnownSupplier && <>{btn('登记线下接受', 'accept', 'emerald')}
          {btn('登记线下拒绝', 'decline', 'red')}</>}
          {btn('撤回', 'withdraw', 'slate')}
        </div>
      ) : (
        <span className="shrink-0 text-xs font-bold text-slate-400">已处理</span>
      )}
    </div>
  );
}
