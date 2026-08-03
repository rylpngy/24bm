import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Store } from 'lucide-react';
import {
  useBuyerMallCheckoutCart,
  useBuyerMallCreateOrder,
  useBuyerMallListings,
  useBuyerMallProducts,
  useBuyerMallPublish,
  useBuyerMallUpdateStatus,
  useBuyerSupplierList,
  useMaterialList,
  type MallListingResponse,
} from '@24bid/api-client';
import { CountTag, FeedbackNotice, MiniFact, Panel, PrimaryActionButton, SearchInput, StatusPill, Tabs, cn } from '@24bid/ui';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100';

const currency = (v?: number) =>
  v == null ? '—' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

function ListingCard({
  listing,
  sku,
  busy,
  onOrder,
  onAddToCart,
  onToggleStatus,
}: {
  listing: MallListingResponse;
  /** M-1:该货架行对应的 SKU 明细(起订量/阶梯价/库存/交期);老数据可能为空。 */
  sku?: {
    minOrderQty?: number;
    stepQty?: number;
    stockQty?: number;
    leadTimeDays?: number;
    tierPrices?: { minQty?: number; price?: number }[];
  };
  busy: boolean;
  onOrder: (listingId: string, quantity: number) => void;
  onAddToCart: (listingId: string, quantity: number) => void;
  onToggleStatus: (listingId: string, status: string) => void;
}) {
  const minQty = sku?.minOrderQty ?? 1;
  const [quantity, setQuantity] = useState(String(minQty));
  const onShelf = listing.status === '在架';
  const tiers = (sku?.tierPrices ?? []).filter((t) => t.minQty != null && t.price != null);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-black text-slate-950">{listing.materialName}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {listing.materialCode || '—'} · {listing.category || '未分类'} · 供应商 {listing.supplierName}
          </p>
        </div>
        {listing.status && <StatusPill label={listing.status} />}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <MiniFact label="协议单价" value={`${currency(listing.price)} / ${listing.unit ?? '件'}`} />
        <MiniFact
          label="起订 / 步进"
          value={`${minQty}${listing.unit ?? '件'} / ${sku?.stepQty ?? 1}${listing.unit ?? '件'}`}
        />
        <MiniFact
          label="库存"
          value={sku?.stockQty == null ? '不限量' : `${sku.stockQty}${listing.unit ?? '件'}`}
        />
        <MiniFact label="交期" value={`${sku?.leadTimeDays ?? 7} 天`} />
      </div>
      {tiers.length > 0 && (
        <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
          <p className="text-[11px] font-black text-emerald-800">阶梯价(按下单数量自动落档)</p>
          <div className="mt-1 flex flex-wrap gap-3">
            {tiers.map((t) => (
              <span key={t.minQty} className="text-xs font-bold text-emerald-900">
                ≥{t.minQty}{listing.unit ?? '件'} · {currency(t.price)}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onShelf && (
          <>
            <input
              className={cn(inputCls, 'h-9 w-24')}
              type="number"
              min={minQty}
              step={sku?.stepQty ?? 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={`数量 ${listing.materialName}`}
            />
            <button
              type="button"
              disabled={busy || Number(quantity) <= 0}
              onClick={() => listing.id && onOrder(listing.id, Number(quantity))}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <ShoppingCart size={13} /> 直购下单
            </button>
            <button
              type="button"
              disabled={busy || Number(quantity) <= 0}
              onClick={() => listing.id && onAddToCart(listing.id, Number(quantity))}
              className="inline-flex h-9 items-center rounded-md border border-blue-200 bg-white px-3 text-xs font-black text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              加入购物车
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => listing.id && onToggleStatus(listing.id, onShelf ? '下架' : '在架')}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {onShelf ? '下架' : '重新上架'}
        </button>
      </div>
    </div>
  );
}

// 企业商城:协议价货架(已准入供应商 × 物料 × 协议价)+ 目录直购成单。
export function MallPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('shop');
  const [keyword, setKeyword] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [supplierId, setSupplierId] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('');

  const listings = useBuyerMallListings({ keyword: keyword.trim() || undefined });
  // M-1:货架行 id 即 skuId;取商品详情把起订量/阶梯价/库存/交期贴回卡片。
  const products = useBuyerMallProducts();
  const skuById = useMemo(() => {
    const map = new Map<string, NonNullable<Parameters<typeof ListingCard>[0]['sku']>>();
    for (const product of products.data?.data ?? []) {
      for (const sku of product.skus ?? []) {
        if (sku.id) {
          map.set(sku.id, {
            minOrderQty: sku.minOrderQty,
            stepQty: sku.stepQty,
            stockQty: sku.stockQty,
            leadTimeDays: sku.leadTimeDays,
            tierPrices: sku.tierPrices,
          });
        }
      }
    }
    return map;
  }, [products.data]);
  const suppliers = useBuyerSupplierList({ status: '已准入' });
  const materials = useMaterialList();
  const publish = useBuyerMallPublish();
  const updateStatus = useBuyerMallUpdateStatus();
  const createOrder = useBuyerMallCreateOrder();
  const checkoutCart = useBuyerMallCheckoutCart();
  // 购物车:listingId → 数量;跨供应商结算时后端按供应商合并成单。
  const [cart, setCart] = useState<Record<string, number>>({});

  const items = listings.data?.data ?? [];
  const onShelfCount = items.filter((l) => l.status === '在架').length;
  const busy = publish.isPending || updateStatus.isPending || createOrder.isPending || checkoutCart.isPending;

  const refresh = () => {
    setError(null);
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === 'string' && /\/buyer\/(mall|orders|rfqs)/.test(q.queryKey[0] as string),
    });
  };
  const reportError = (e: unknown) => {
    const message =
      (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
      '操作失败,请稍后重试';
    setError(message);
    setFeedback(null);
  };

  const submitOrder = (listingId: string, quantity: number) =>
    createOrder.mutate(
      { data: { listingId, quantity } },
      {
        onSuccess: (res) => {
          const order = res.data;
          setFeedback(
            `直购订单已生成:${order?.orderId ?? ''}(${order?.materialName ?? ''} × ${quantity},合计 ${currency(order?.amount)})。可在采购订单模块跟进履约。`,
          );
          refresh();
        },
        onError: reportError,
      },
    );

  const submitPublish = () =>
    publish.mutate(
      { data: { supplierId, materialId, price: Number(price), unit: unit.trim() || undefined } },
      {
        onSuccess: () => {
          setSupplierId('');
          setMaterialId('');
          setPrice('');
          setUnit('');
          setFeedback('商品已上架。');
          refresh();
        },
        onError: reportError,
      },
    );

  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotal = cartEntries.reduce((sum, [listingId, qty]) => {
    const listing = items.find((l) => l.id === listingId);
    return sum + (listing?.price ?? 0) * qty;
  }, 0);

  const submitCheckout = () =>
    checkoutCart.mutate(
      { data: { items: cartEntries.map(([listingId, quantity]) => ({ listingId, quantity })) } },
      {
        onSuccess: (res) => {
          const orders = res.data ?? [];
          setCart({});
          setFeedback(
            `购物车结算完成:生成 ${orders.length} 张订单(按供应商合并),合计 ${currency(
              orders.reduce((sum, o) => sum + (o.amount ?? 0), 0),
            )}。`,
          );
          refresh();
        },
        onError: reportError,
      },
    );

  return (
    <Panel title="企业商城" icon={Store} subtitle="协议价货架 · 商品检索 · 购物车 · 目录直购">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          items={[
            { id: 'shop', label: '商城选购' },
            { id: 'shelf', label: '货架维护' },
          ]}
          value={tab}
          onChange={setTab}
        />
        <CountTag>在架 {onShelfCount} / 共 {items.length} 件</CountTag>
      </div>

      {feedback && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <FeedbackNotice tone="success" message={feedback} />
          </div>
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="shrink-0 rounded-md border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50"
            >
              查看采购订单
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="mb-3">
          <FeedbackNotice tone="error" message={error} />
        </div>
      )}

      {tab === 'shelf' && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          <p className="text-xs font-black text-blue-900">上架商品(已准入供应商 + 物料 + 协议价)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">选择供应商</option>
              {(suppliers.data?.data ?? []).map((s) => (
                <option key={s.supplierId} value={s.supplierId ?? ''}>
                  {s.supplierName ?? s.supplierId}
                </option>
              ))}
            </select>
            <select className={inputCls} value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">选择物料</option>
              {(materials.data?.data ?? []).map((m) => (
                <option key={m.id} value={m.id ?? ''}>
                  {m.name}({m.code})
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
            <input
              className={inputCls}
              placeholder="计量单位,缺省「件」"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
          <div className="mt-3">
            <PrimaryActionButton
              onClick={submitPublish}
              disabled={busy || !supplierId || !materialId || Number(price) <= 0}
            >
              上架商品
            </PrimaryActionButton>
          </div>
        </div>
      )}

      {cartEntries.length > 0 && (
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-blue-900">
              购物车 {cartEntries.length} 项 · 预计合计 {currency(cartTotal)}(跨供应商自动拆单)
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCart({})}
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-50"
              >
                清空
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitCheckout}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                结算下单
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {cartEntries.map(([listingId, qty]) => {
              const listing = items.find((l) => l.id === listingId);
              return (
                <span key={listingId} className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-blue-100">
                  {listing?.materialName ?? listingId} × {qty}
                  <button
                    type="button"
                    onClick={() => setCart((c) => ({ ...c, [listingId]: 0 }))}
                    className="ml-1.5 font-black text-slate-400 hover:text-red-500"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3">
        <SearchInput onSearch={setKeyword} placeholder="搜索物料名称 / 编码 / 分类 / 供应商" />
      </div>

      {listings.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载商城货架…" />
      ) : items.length === 0 ? (
        <FeedbackNotice tone="info" message="货架为空。切换到「货架维护」为已准入供应商上架协议价商品。" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items
            .filter((l) => tab === 'shelf' || l.status === '在架')
            .map((l) => (
              <ListingCard
                key={l.id}
                listing={l}
                sku={l.id ? skuById.get(l.id) : undefined}
                busy={busy}
                onOrder={submitOrder}
                onAddToCart={(listingId, quantity) =>
                  setCart((c) => ({ ...c, [listingId]: (c[listingId] ?? 0) + quantity }))
                }
                onToggleStatus={(listingId, status) =>
                  updateStatus.mutate(
                    { listingId, data: { status } },
                    { onSuccess: refresh, onError: reportError },
                  )
                }
              />
            ))}
        </div>
      )}
    </Panel>
  );
}
