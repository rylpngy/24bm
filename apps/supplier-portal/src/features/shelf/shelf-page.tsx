import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Banknote, Package, Pencil, Plus, Store } from 'lucide-react';
import { ProductCenter } from './product-center';
import { SupplierMallAfterSalesPanel } from './mall-after-sales-panel';
import {
  type MallListingResponse,
  useSupplierMallListings,
  useSupplierMallMaterials,
  useSupplierMallPublish,
  useSupplierMallUpdatePrice,
  useSupplierMallUpdateStatus,
  useSupplierMallUpdateProductStatus,
} from '@24bid/api-client';
import {
  FeedbackNotice,
  FormErrorSummary,
  FilterTabs,
  Pagination,
  Panel,
  PrimaryActionButton,
  ResponsiveTableFrame,
  SearchInput,
  cn,
} from '@24bid/ui';

const inputCls =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

const statusTone: Record<string, string> = {
  在架: 'bg-emerald-50 text-emerald-700',
  待审核: 'bg-amber-50 text-amber-700',
  草稿: 'bg-slate-100 text-slate-500',
  下架: 'bg-slate-100 text-slate-500',
};

function FormSection({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Store;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-blue-600" />
        <h2 className="text-base font-black text-slate-950">{title}</h2>
      </div>
      {desc && <p className="mt-1 text-xs font-bold text-slate-400">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <p className="text-[11px] font-black text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

// 商品编辑独立页:主数据(物料/采购方)来自采购方档案只读,协议价与状态可改。
function ListingEditPage({
  listing,
  onBack,
  onSaved,
}: {
  listing: MallListingResponse;
  onBack: () => void;
  onSaved: (msg: string) => void;
}) {
  const updatePrice = useSupplierMallUpdatePrice();
  const updateStatus = useSupplierMallUpdateStatus();
  const [price, setPrice] = useState(listing.price != null ? String(listing.price) : '');
  const [status, setStatus] = useState(listing.status ?? '在架');
  const [error, setError] = useState<string | null>(null);

  const busy = updatePrice.isPending || updateStatus.isPending;
  const validPrice = Number.isFinite(Number(price)) && Number(price) > 0;
  const priceChanged = validPrice && Number(price) !== listing.price;
  const statusChanged = status !== listing.status;

  const save = async () => {
    setError(null);
    if (!validPrice) {
      setError('请填写大于 0 的协议单价。');
      return;
    }
    try {
      if (priceChanged && listing.id) {
        await updatePrice.mutateAsync({ listingId: listing.id, data: { price: Number(price) } });
      }
      if (statusChanged && listing.id && (!priceChanged || status === '下架')) {
        await updateStatus.mutateAsync({ listingId: listing.id, data: { status } });
      }
      onSaved(priceChanged ? '价格已保存，商品需重新提交采购方审核。'
        : statusChanged && status === '在架' ? '规格已启用，商品需重新提交审核。' : '商品信息已保存。');
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          '保存失败,请稍后重试。',
      );
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            aria-label="返回商品列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-950">编辑商品信息</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              物料主数据以采购方档案为准;此处维护协议价与上下架状态
            </p>
          </div>
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <FormSection icon={Package} title="基础信息" desc="来自采购方物料档案,只读">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoCell label="商品名称" value={listing.materialName ?? '—'} />
            <InfoCell label="物料编码" value={listing.materialCode || '—'} />
            <InfoCell label="所属分类" value={listing.category || '未分类'} />
            <InfoCell label="计量单位" value={listing.unit ?? '件'} />
            <div className="sm:col-span-2">
              <InfoCell label="上架商城(采购方)" value={listing.tenantName ?? listing.tenantId ?? '—'} />
            </div>
          </div>
        </FormSection>

        <div className="space-y-4">
          <FormSection icon={Banknote} title="销售信息">
            <label className="block">
              <span className="text-xs font-black text-slate-500">
                <span className="mr-1 text-red-500">*</span>协议单价(元)
              </span>
              <input
                className={cn(inputCls, 'mt-1.5')}
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <span className="mt-1 block text-[11px] font-bold text-slate-400">
                当前 {currency(listing.price)} / {listing.unit ?? '件'}
              </span>
            </label>
            <div className="mt-4">
              <span className="text-xs font-black text-slate-500">商品状态</span>
              <div className="mt-1.5 flex gap-2">
                {['在架', '下架'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={s === '在架' && (priceChanged || listing.productStatus !== '在架')}
                    onClick={() => setStatus(s)}
                    className={cn(
                      'inline-flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-black transition',
                      status === s
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </FormSection>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
            <PrimaryActionButton
              onClick={save}
              busy={busy}
              pendingLabel="保存中"
              size="md"
              flushTop
              disabled={!validPrice || (!priceChanged && !statusChanged)}
            >
              保存商品
            </PrimaryActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

// 发布商品独立页:选择已准入采购方的物料(主数据回显)+ 协议价。
function ListingPublishPage({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: (msg: string) => void;
}) {
  const materials = useSupplierMallMaterials();
  const publish = useSupplierMallPublish();
  const [materialKey, setMaterialKey] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const materialOptions = materials.data?.data ?? [];
  const [tenantId, materialId] = materialKey.split('|');
  const selected = materialOptions.find((m) => m.tenantId === tenantId && m.materialId === materialId);

  const submit = () => {
    const missing: string[] = [];
    if (!selected) missing.push('请选择「采购方物料」');
    if (!Number.isFinite(Number(price)) || !(Number(price) > 0)) missing.push('请填写大于 0 的「协议单价(元)」');
    setFormErrors(missing);
    if (missing.length > 0) return;
    setError(null);
    publish.mutate(
      { data: { tenantId, materialId, price: Number(price), unit: selected?.unit ?? undefined } },
      {
        onSuccess: () => onSaved('已提交采购方审核,审核通过后自动上架。'),
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              '上架失败,请稍后重试。',
          ),
      },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm shadow-slate-200/50">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-50"
            aria-label="返回商品列表"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-950">发布商品</h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              面向已准入的采购方发布协议价商品
              <span className="ml-2 text-xs text-slate-400">(<span className="text-red-500">*</span> 为必填项)</span>
            </p>
          </div>
        </div>
      </div>

      {error && <FeedbackNotice tone="error" message={error} />}
      <FormErrorSummary errors={formErrors} />

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <FormSection icon={Package} title="基础信息" desc="从采购方物料库选择;名称/分类/单位以采购方档案为准">
          <label className="block">
            <span className="text-xs font-black text-slate-500">
              <span className="mr-1 text-red-500">*</span>采购方物料
            </span>
            <select className={cn(inputCls, 'mt-1.5')} value={materialKey} onChange={(e) => setMaterialKey(e.target.value)}>
              <option value="">选择采购方物料</option>
              {materialOptions.map((m) => (
                <option key={`${m.tenantId}|${m.materialId}`} value={`${m.tenantId}|${m.materialId}`}>
                  {m.tenantName} · {m.name}({m.code})
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <InfoCell label="商品名称" value={selected.name ?? '—'} />
              <InfoCell label="物料编码" value={selected.code ?? '—'} />
              <InfoCell label="所属分类" value={selected.category || '未分类'} />
              <InfoCell label="计量单位" value={selected.unit ?? '件'} />
              <InfoCell label="采购方参考价" value={currency(selected.referencePrice)} />
              <InfoCell label="上架商城(采购方)" value={selected.tenantName ?? '—'} />
            </div>
          )}
        </FormSection>

        <div className="space-y-4">
          <FormSection icon={Banknote} title="销售信息">
            <label className="block">
              <span className="text-xs font-black text-slate-500">
                <span className="mr-1 text-red-500">*</span>协议单价(元)
              </span>
              <input
                className={cn(inputCls, 'mt-1.5')}
                type="number"
                min="0"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              {selected?.referencePrice != null && (
                <span className="mt-1 block text-[11px] font-bold text-slate-400">
                  采购方参考价 {currency(selected.referencePrice)},协议价可自主约定
                </span>
              )}
            </label>
          </FormSection>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-5 text-sm font-black text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
            <PrimaryActionButton
              onClick={submit}
              busy={publish.isPending}
              pendingLabel="上架中"
              size="md"
              flushTop
            >
              上架商品
            </PrimaryActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 10;

// 商城货架:表格化商品列表(名称/分类/协议价/状态/操作)+ 独立发布与编辑页。
export function ShelfPage({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient();
  const [view, setView] = useState('products');
  const [productBusy, setProductBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('全部');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<'list' | 'publish' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const listings = useSupplierMallListings({ query: { enabled: view === 'listings' } });
  const updateStatus = useSupplierMallUpdateStatus();
  const submitForReview = useSupplierMallUpdateProductStatus();

  const items = listings.data?.data ?? [];
  const kw = keyword.toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter((l) => {
        if (statusFilter !== '全部' && l.status !== statusFilter) return false;
        if (!kw) return true;
        return [l.materialName, l.materialCode, l.tenantName, l.category]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(kw);
      }),
    [items, statusFilter, kw],
  );
  const statusCount = (s: string) => (s === '全部' ? items.length : items.filter((l) => l.status === s).length);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).includes('/supplier/mall'),
    });
  };
  const reportError = (e: unknown) =>
    setError(
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        '操作失败,请稍后重试',
    );

  const backToList = (msg?: string) => {
    setMode('list');
    setEditingId(null);
    if (msg) setFeedback(msg);
    refresh();
  };

  if (mode === 'publish' && canManage) {
    return <ListingPublishPage onBack={() => backToList()} onSaved={(m) => backToList(m)} />;
  }
  const editing = editingId ? items.find((l) => l.id === editingId) : undefined;
  if (mode === 'edit' && editing && canManage) {
    return <ListingEditPage listing={editing} onBack={() => backToList()} onSaved={(m) => backToList(m)} />;
  }

  return (
    <Panel title="商城货架" icon={Store} subtitle="商品规格 · 协议价 · 上架审核 · 售后处理">
      <fieldset className="mb-4 min-w-0 disabled:opacity-60" disabled={productBusy || updateStatus.isPending || submitForReview.isPending}>
        <FilterTabs items={[
          { id: 'products', label: '商品中心' },
          { id: 'listings', label: '协议货架' },
          { id: 'after-sales', label: '售后办理' },
        ]} value={view} onChange={(next) => {
          if (!productBusy && !updateStatus.isPending && !submitForReview.isPending) setView(next);
        }} />
      </fieldset>
      {view === 'products' ? <div role="tabpanel" aria-label="商品中心"><ProductCenter canManage={canManage} onBusyChange={setProductBusy} /></div>
        : view === 'after-sales' ? <div role="tabpanel" aria-label="售后办理"><SupplierMallAfterSalesPanel canManage={canManage} /></div>
          : <div role="tabpanel" aria-label="协议货架">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterTabs
          items={['全部', '在架', '待审核', '下架'].map((s) => ({
            id: s,
            label: s,
            count: s === '全部' ? undefined : statusCount(s),
          }))}
          value={statusFilter}
          onChange={(id) => {
            setStatusFilter(id);
            setPage(1);
          }}
        />
        <div className="ml-auto flex items-center gap-2">
          <SearchInput
            className="mb-0"
            placeholder="搜索商品名称 / 编码 / 采购方"
            onSearch={(k) => {
              setKeyword(k);
              setPage(1);
            }}
          />
          {canManage && <button
            type="button"
            onClick={() => setMode('publish')}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            <Plus size={14} /> 发布商品
          </button>}
        </div>
      </div>

      {feedback && (
        <div className="mb-3">
          <FeedbackNotice tone="success" message={feedback} />
        </div>
      )}
      {error && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {listings.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载货架…" />
      ) : listings.isError ? (
        <FeedbackNotice tone="error" message="货架加载失败:登录态可能已过期,请重新登录后重试。" />
      ) : filtered.length === 0 ? (
        <FeedbackNotice
          tone="info"
          message={
            keyword || statusFilter !== '全部'
              ? '没有符合条件的商品。'
              : '货架为空。发布协议价商品后,采购方即可在企业商城直购。'
          }
        />
      ) : (
        <>
          <ResponsiveTableFrame
            mobileCards={pageItems.map((l, i) => (
              <div key={l.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">
                      <span className="mr-1.5 font-mono text-slate-400">{(safePage - 1) * PAGE_SIZE + i + 1}.</span>
                      {l.materialName}
                    </p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-500">{l.materialCode || '—'} · {l.tenantName ?? l.tenantId}</p>
                  </div>
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11px] font-black',
                      statusTone[l.status ?? ''] ?? 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {l.status ?? '—'}
                  </span>
                </div>
                <p className="mt-2 font-mono text-sm font-black text-slate-900">
                  {currency(l.price)} <span className="text-[11px] font-bold text-slate-400">/ {l.unit ?? '件'}</span>
                </p>
                {canManage && <button
                  type="button"
                  onClick={() => {
                    setEditingId(l.id ?? null);
                    setMode('edit');
                  }}
                  className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-black text-slate-600 hover:bg-slate-50"
                >
                  编辑商品
                </button>}
              </div>
            ))}
          >
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black text-slate-500">
                <tr>
                  <th className="w-12 px-2 py-4 text-center">序号</th>
                  <th className="px-5 py-4">商品名称</th>
                  <th className="px-5 py-4">分类</th>
                  <th className="px-5 py-4">上架商城</th>
                  <th className="px-5 py-4 text-right">协议价</th>
                  <th className="px-5 py-4">状态</th>
                  <th className="px-5 py-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageItems.map((l, i) => {
                  const onShelf = l.status === '在架';
                  // 商品未通过审核时,上下架开关无意义:该做的是提交审核 / 等审核结果(M-4a)。
                  const approved = l.productStatus === '在架';
                  const pendingReview = l.productStatus === '待审核';
                  return (
                    <tr key={l.id} className="hover:bg-blue-50/30">
                      <td className="px-2 py-5 text-center font-mono font-black text-slate-400">
                        {(safePage - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-black text-slate-950">{l.materialName}</p>
                        <p className="mt-1 font-mono text-[11px] font-bold text-slate-400">
                          {l.materialCode || '—'} · 更新 {l.updatedAt?.slice(0, 10) ?? '—'}
                        </p>
                      </td>
                      <td className="px-5 py-5 text-sm font-bold text-slate-600">{l.category || '未分类'}</td>
                      <td className="px-5 py-5 text-sm font-bold text-slate-600">{l.tenantName ?? l.tenantId}</td>
                      <td className="px-5 py-5 text-right">
                        <span className="font-mono font-black text-slate-900">{currency(l.price)}</span>
                        <span className="ml-1 text-[11px] font-bold text-slate-400">/ {l.unit ?? '件'}</span>
                      </td>
                      <td className="px-5 py-5">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[11px] font-black',
                            statusTone[l.status ?? ''] ?? 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {l.status ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-5">
                        {canManage && <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(l.id ?? null);
                              setMode('edit');
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-black text-slate-600 transition hover:bg-slate-50"
                          >
                            <Pencil size={12} /> 编辑
                          </button>
                          {pendingReview ? (
                            <span className="inline-flex h-8 items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-black text-amber-700">
                              待采购方审核
                            </span>
                          ) : approved ? (
                            <button
                              type="button"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                l.id &&
                                updateStatus.mutate(
                                  { listingId: l.id, data: { status: onShelf ? '下架' : '在架' } },
                                  {
                                    onSuccess: () => {
                                      setFeedback(onShelf ? '商品已下架。' : '规格已启用，商品需重新提交审核。');
                                      refresh();
                                    },
                                    onError: reportError,
                                  },
                                )
                              }
                              className={cn(
                                'inline-flex h-8 items-center rounded-md border px-2.5 text-[11px] font-black transition disabled:opacity-50',
                                onShelf
                                  ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                  : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
                              )}
                            >
                              {onShelf ? '下架' : '上架'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={submitForReview.isPending || !l.productId}
                              onClick={() =>
                                l.productId &&
                                submitForReview.mutate(
                                  { productId: l.productId, data: { status: '待审核' } },
                                  {
                                    onSuccess: () => {
                                      setFeedback('已提交采购方审核,通过后自动上架。');
                                      refresh();
                                    },
                                    onError: reportError,
                                  },
                                )
                              }
                              className="inline-flex h-8 items-center rounded-md border border-blue-200 bg-white px-2.5 text-[11px] font-black text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                            >
                              提交审核
                            </button>
                          )}
                        </div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTableFrame>
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
        </>
      )}
      </div>}
    </Panel>
  );
}
