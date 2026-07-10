import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Store } from 'lucide-react';
import {
  useSupplierMallListings,
  useSupplierMallMaterials,
  useSupplierMallPublish,
  useSupplierMallUpdatePrice,
  useSupplierMallUpdateStatus,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Panel, PrimaryActionButton, StatusPill } from '@24bid/ui';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

// 商城货架:供应商自助管理各采购方商城里的协议价商品(发布 / 调价 / 上下架)。
export function ShelfPage() {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [materialKey, setMaterialKey] = useState('');
  const [price, setPrice] = useState('');
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});

  const listings = useSupplierMallListings();
  const materials = useSupplierMallMaterials();
  const publish = useSupplierMallPublish();
  const updatePrice = useSupplierMallUpdatePrice();
  const updateStatus = useSupplierMallUpdateStatus();

  const items = listings.data?.data ?? [];
  const materialOptions = materials.data?.data ?? [];
  const busy = publish.isPending || updatePrice.isPending || updateStatus.isPending;

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

  const submitPublish = () => {
    const [tenantId, materialId] = materialKey.split('|');
    const material = materialOptions.find(
      (m) => m.tenantId === tenantId && m.materialId === materialId,
    );
    publish.mutate(
      {
        data: {
          tenantId,
          materialId,
          price: Number(price),
          unit: material?.unit ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setMaterialKey('');
          setPrice('');
          setFeedback('商品已上架,采购方可在企业商城直接下单。');
          refresh();
        },
        onError: reportError,
      },
    );
  };

  return (
    <Panel title="商城货架" icon={Store} subtitle="协议价商品 · 自主调价 · 上下架">
      <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
        <p className="text-xs font-black text-emerald-900">发布商品(面向已准入的采购方)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <select className={inputCls} value={materialKey} onChange={(e) => setMaterialKey(e.target.value)}>
            <option value="">选择采购方物料</option>
            {materialOptions.map((m) => (
              <option key={`${m.tenantId}|${m.materialId}`} value={`${m.tenantId}|${m.materialId}`}>
                {m.tenantName} · {m.name}({m.code}) · 参考价 {currency(m.referencePrice)}
              </option>
            ))}
          </select>
          <input
            className={inputCls}
            type="number"
            min="0"
            placeholder="协议单价(元)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <PrimaryActionButton onClick={submitPublish} disabled={busy || !materialKey || Number(price) <= 0}>
            上架商品
          </PrimaryActionButton>
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

      <div className="mb-3">
        <CountTag>共 {items.length} 件商品</CountTag>
      </div>

      {listings.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载货架…" />
      ) : items.length === 0 ? (
        <FeedbackNotice tone="info" message="货架为空。发布协议价商品后,采购方即可在企业商城直购。" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((l) => {
            const onShelf = l.status === '在架';
            const draft = priceDrafts[l.id ?? ''] ?? '';
            return (
              <div key={l.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-black text-slate-950">{l.materialName}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      采购方 {l.tenantName} · {l.materialCode || '—'} · {l.category || '未分类'}
                    </p>
                  </div>
                  {l.status && <StatusPill label={l.status} />}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MiniFact label="协议单价" value={`${currency(l.price)} / ${l.unit ?? '件'}`} />
                  <MiniFact label="最近更新" value={l.updatedAt?.slice(0, 10) ?? '—'} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    className="h-9 w-32 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-300"
                    type="number"
                    min="0"
                    placeholder="新单价"
                    value={draft}
                    onChange={(e) => setPriceDrafts((d) => ({ ...d, [l.id ?? '']: e.target.value }))}
                    aria-label={`调价 ${l.materialName}`}
                  />
                  <button
                    type="button"
                    disabled={busy || Number(draft) <= 0}
                    onClick={() =>
                      l.id &&
                      updatePrice.mutate(
                        { listingId: l.id, data: { price: Number(draft) } },
                        {
                          onSuccess: () => {
                            setPriceDrafts((d) => ({ ...d, [l.id ?? '']: '' }));
                            setFeedback('协议价已更新。');
                            refresh();
                          },
                          onError: reportError,
                        },
                      )
                    }
                    className="inline-flex h-9 items-center rounded-md bg-emerald-600 px-3 text-xs font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    调价
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      l.id &&
                      updateStatus.mutate(
                        { listingId: l.id, data: { status: onShelf ? '下架' : '在架' } },
                        { onSuccess: refresh, onError: reportError },
                      )
                    }
                    className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {onShelf ? '下架' : '重新上架'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
