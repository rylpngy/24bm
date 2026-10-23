import { useState, useMemo } from 'react';
import { useBuyerPermissions } from '../../lib/use-buyer-permissions';
import { useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Store } from 'lucide-react';
import {
  useBuyerMallCheckoutCart,
  useBuyerMallCreateOrder,
  useBuyerMallListings,
  useBuyerMallProducts,
  useBuyerMallCart,
  useBuyerMallAddToCart,
  useBuyerMallUpdateCartItem,
  useBuyerMallRemoveCartItem,
  useBuyerMallCheckoutServerCart,
  useBuyerMallAddresses,
  useBuyerMallPendingReview,
  useBuyerMallReviewProduct,
  useBuyerMallAfterSales,
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
  canPurchase,
  canManage,
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
  canPurchase: boolean;
  canManage: boolean;
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
        {listing.status && <span className="shrink-0 whitespace-nowrap"><StatusPill label={listing.status} /></span>}
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
        {onShelf && canPurchase && (
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
        {canManage && <button
          type="button"
          disabled={busy}
          onClick={() => listing.id && onToggleStatus(listing.id, onShelf ? '下架' : '在架')}
          className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {onShelf ? '下架' : '重新上架'}
        </button>}
      </div>
    </div>
  );
}

// 企业商城:协议价货架(已准入供应商 × 物料 × 协议价)+ 目录直购成单。
export function MallPage({ onNavigate }: { onNavigate?: (moduleId: string) => void }) {
  const { can } = useBuyerPermissions();
  const canManage = can('buyer:mall:manage');
  const canPurchase = can('buyer:mall:purchase');
  const canReadOrders = can('buyer:order:read');
  const queryClient = useQueryClient();
  const [selectedTab, setTab] = useState('shop');
  const tab = (!canManage && ['shelf', 'review'].includes(selectedTab)) || (!canReadOrders && selectedTab === 'after-sales') ? 'shop' : selectedTab;
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
  const suppliers = useBuyerSupplierList({ status: '已准入' }, { query: { enabled: canManage && can('buyer:supplier:read') && tab === 'shelf' } });
  const materials = useMaterialList(undefined, { query: { enabled: canManage && can('buyer:material:read') && tab === 'shelf' } });
  const publish = useBuyerMallPublish();
  const updateStatus = useBuyerMallUpdateStatus();
  const createOrder = useBuyerMallCreateOrder();
  const checkoutCart = useBuyerMallCheckoutCart();
  // M-2:购物车改为服务端存储——换设备/刷新不丢,单价与可结算性由后端按当前阶梯价与库存实时判定。
  const cart = useBuyerMallCart({ query: { enabled: canPurchase } });
  const addToCart = useBuyerMallAddToCart();
  const updateCartItem = useBuyerMallUpdateCartItem();
  const removeCartItem = useBuyerMallRemoveCartItem();
  const checkoutServerCart = useBuyerMallCheckoutServerCart();
  const addresses = useBuyerMallAddresses({ query: { enabled: canPurchase } });
  // M-4:上架审核台与售后台。
  const pendingReview = useBuyerMallPendingReview({ query: { enabled: canManage && tab === 'review' } });
  const reviewProduct = useBuyerMallReviewProduct();
  const afterSales = useBuyerMallAfterSales({ query: { enabled: canReadOrders && tab === 'after-sales' } });
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  const items = listings.isError ? [] : listings.data?.data ?? [];
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

  const cartView = cart.data?.data;
  const cartLines = (cartView?.groups ?? []).flatMap((g) =>
    (g.lines ?? []).map((line) => ({ ...line, supplierName: g.supplierName })),
  );
  const defaultAddress = (addresses.data?.data ?? []).find((a) => a.isDefault)
    ?? (addresses.data?.data ?? [])[0];

  const refreshCart = () =>
    queryClient.invalidateQueries({
      predicate: (q) => typeof q.queryKey[0] === 'string'
        && (q.queryKey[0] as string).includes('/buyer/mall'),
    });

  const submitCheckout = () =>
    checkoutServerCart.mutate(
      { data: { addressId: defaultAddress?.id } },
      {
        onSuccess: (res) => {
          const orders = res.data ?? [];
          setFeedback(
            `购物车结算完成:生成 ${orders.length} 张订单(按供应商合并),合计 ${currency(
              orders.reduce((sum, o) => sum + (o.amount ?? 0), 0),
            )}${defaultAddress ? `,收货人 ${defaultAddress.receiver}` : ''}。`,
          );
          void refreshCart();
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
            ...(canManage ? [{ id: 'shelf', label: '货架维护' }, { id: 'review', label: '上架审核' }] : []),
            ...(canReadOrders ? [{ id: 'after-sales', label: '售后处理' }] : []),
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
          {onNavigate && canReadOrders && (
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

      {tab === 'review' && (
        <div className="space-y-3">
          <FeedbackNotice
            tone="info"
            message="供应商提交的商品需审核通过后才会上架。驳回请写明原因,供应商据此补正后可重新提交。"
          />
          {pendingReview.isError ? <FeedbackNotice tone="error" message="商品审核数据加载失败，请检查权限后重试。" /> : (pendingReview.data?.data ?? []).length === 0 ? (
            <FeedbackNotice tone="info" message="没有待审核的商品。" />
          ) : (
            (pendingReview.data?.data ?? []).map((product) => {
              const comment = reviewComments[product.id ?? ''] ?? '';
              const submit = (approved: boolean) =>
                product.id && reviewProduct.mutate(
                  { productId: product.id, data: { approved, comment: comment.trim() } },
                  {
                    onSuccess: () => {
                      setFeedback(`已${approved ? '通过' : '驳回'}商品「${product.name}」。`);
                      setReviewComments((cur) => ({ ...cur, [product.id ?? '']: '' }));
                      void refreshCart();
                      refresh();
                    },
                    onError: reportError,
                  },
                );
              return (
                <div key={product.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-black text-slate-950">{product.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {product.brand || '—'} · {product.categoryName || '未分类'} · 供应商 {product.supplierName}
                      </p>
                    </div>
                    <StatusPill label={product.status ?? '待审核'} />
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                        <tr>
                          <th className="px-3 py-2">规格</th>
                          <th className="px-3 py-2 text-right">单价</th>
                          <th className="px-3 py-2 text-right">起订 / 步进</th>
                          <th className="px-3 py-2 text-right">库存</th>
                          <th className="px-3 py-2 text-right">交期</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(product.skus ?? []).map((sku) => (
                          <tr key={sku.id} className="font-bold text-slate-700">
                            <td className="px-3 py-2">{sku.skuCode || '默认规格'}</td>
                            <td className="px-3 py-2 text-right font-mono">{currency(sku.price)}</td>
                            <td className="px-3 py-2 text-right">{sku.minOrderQty} / {sku.stepQty}{sku.unit}</td>
                            <td className="px-3 py-2 text-right">{sku.stockQty ?? '不限量'}</td>
                            <td className="px-3 py-2 text-right">{sku.leadTimeDays} 天</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      className={cn(inputCls, 'h-9 min-w-56 flex-1')}
                      placeholder="审核意见(必填)"
                      aria-label={`审核意见 ${product.name}`}
                      value={comment}
                      onChange={(e) =>
                        setReviewComments((cur) => ({ ...cur, [product.id ?? '']: e.target.value }))
                      }
                    />
                    <button
                      type="button"
                      disabled={!comment.trim() || reviewProduct.isPending}
                      onClick={() => submit(false)}
                      className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      驳回
                    </button>
                    <PrimaryActionButton
                      size="sm"
                      busy={reviewProduct.isPending}
                      pendingLabel="提交中"
                      disabled={!comment.trim()}
                      onClick={() => submit(true)}
                    >
                      通过并上架
                    </PrimaryActionButton>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'after-sales' && (
        <div className="space-y-3">
          {afterSales.isError ? <FeedbackNotice tone="error" message="售后记录加载失败，请检查权限后重试。" /> : (afterSales.data?.data ?? []).length === 0 ? (
            <FeedbackNotice tone="info" message="暂无售后单。采购员可在商城门户的「我的订单」里发起售后。" />
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-black text-slate-400">
                  <tr>
                    <th className="px-3 py-2">类型</th>
                    <th className="px-3 py-2">供应商</th>
                    <th className="px-3 py-2 text-right">数量</th>
                    <th className="px-3 py-2">原因</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">供应商回复</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(afterSales.data?.data ?? []).map((row) => (
                    <tr key={row.id} className="font-bold text-slate-700">
                      <td className="px-3 py-2 font-black text-slate-900">{row.type}</td>
                      <td className="px-3 py-2">{row.supplierName}</td>
                      <td className="px-3 py-2 text-right font-mono">{row.quantity}</td>
                      <td className="px-3 py-2">{row.reason}</td>
                      <td className="px-3 py-2"><StatusPill label={row.status ?? ''} /></td>
                      <td className="px-3 py-2">{row.supplierReply || <span className="text-slate-400">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'shelf' && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/40 p-4">
          {(!can('buyer:supplier:read') || !can('buyer:material:read')) && <FeedbackNotice tone="info" message="上架商品还需供应商查看和物料查看权限，请联系管理员授权。" />}
          {(suppliers.isError || materials.isError) && <FeedbackNotice tone="error" message="供应商或物料加载失败，请刷新重试。" />}
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
              disabled={busy || suppliers.isError || materials.isError || !can('buyer:supplier:read') || !can('buyer:material:read') || !supplierId || !materialId || Number(price) <= 0}
            >
              上架商品
            </PrimaryActionButton>
          </div>
        </div>
      )}

      {canPurchase && (cart.isError || addresses.isError) && <FeedbackNotice tone="error" message="购物车或收货地址加载失败，请刷新重试。" />}
      {canPurchase && !cart.isError && !addresses.isError && cartLines.length > 0 && (
        <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-black text-blue-900">
              购物车 {cartLines.length} 项 · 合计 {currency(cartView?.total)}(跨供应商自动拆单)
              {defaultAddress
                ? ` · 收货 ${defaultAddress.receiver}(${defaultAddress.phone})`
                : ' · 未设收货地址'}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  cartLines.forEach((line) =>
                    line.skuId
                      && removeCartItem.mutate({ skuId: line.skuId }, { onSuccess: refreshCart }))
                }
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-500 hover:bg-slate-50"
              >
                清空
              </button>
              <button
                type="button"
                disabled={busy || cartView?.hasBlockedItems}
                title={cartView?.hasBlockedItems ? '存在失效行,处理后才能结算' : undefined}
                onClick={submitCheckout}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                结算下单
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-1.5">
            {cartLines.map((line) => (
              <div
                key={line.skuId}
                className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 ring-1 ring-blue-100"
              >
                <span className="font-black text-slate-900">{line.productName}</span>
                <span>{line.supplierName}</span>
                <span>
                  {line.quantity}
                  {line.unit} × {currency(line.unitPrice)} = {currency(line.lineTotal)}
                </span>
                {line.blockedReason && (
                  <span className="rounded bg-red-50 px-1.5 py-0.5 font-black text-red-600">
                    {line.blockedReason}
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {[-1, 1].map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const step = line.stepQty ?? 1;
                        const next = (line.quantity ?? 0) + direction * step;
                        if (!line.skuId) return;
                        updateCartItem.mutate(
                          { data: { skuId: line.skuId, quantity: next } },
                          { onSuccess: refreshCart, onError: reportError },
                        );
                      }}
                      className="h-6 w-6 rounded border border-slate-200 font-black text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {direction > 0 ? '+' : '−'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      line.skuId
                        && removeCartItem.mutate({ skuId: line.skuId }, { onSuccess: refreshCart })
                    }
                    className="ml-1 font-black text-slate-400 hover:text-red-500"
                  >
                    移除
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3">
        <SearchInput onSearch={setKeyword} placeholder="搜索物料名称 / 编码 / 分类 / 供应商" />
      </div>

      {listings.isError ? <FeedbackNotice tone="error" message="商城货架加载失败，请检查权限后重试。" /> : listings.isLoading ? (
        <FeedbackNotice tone="info" message="正在加载商城货架…" />
      ) : items.length === 0 ? (
        <FeedbackNotice tone="info" message="当前没有可展示的商品。" />
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
                canPurchase={canPurchase}
                canManage={canManage}
                onOrder={submitOrder}
                onAddToCart={(skuId, quantity) =>
                  addToCart.mutate(
                    { data: { skuId, quantity } },
                    { onSuccess: refreshCart, onError: reportError },
                  )
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
