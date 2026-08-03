import { useMemo, useState } from 'react';
import { ArrowLeft, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useBuyerMallAddToCart, useBuyerMallProduct } from '@24bid/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { FeedbackNotice, MiniFact, PrimaryActionButton, RichTextView, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { currency } from './product-card';

/** 规格 JSON 转可读文案:{"颜色":"黑"} → 颜色 黑;单规格商品显示 SKU 编码。 */
function specLabel(spec?: string, skuCode?: string) {
  if (!spec || spec === '{}') return skuCode || '默认规格';
  try {
    const parsed = JSON.parse(spec) as Record<string, string>;
    const entries = Object.entries(parsed);
    if (entries.length === 0) return skuCode || '默认规格';
    return entries.map(([key, value]) => `${key} ${value}`).join(' · ');
  } catch {
    return skuCode || '默认规格';
  }
}

/** 商品详情:规格切换 + 阶梯价 + 起订量/步进/库存/交期 + 加购。 */
export function MallProductDetailPage({
  productId,
  onNavigate,
}: {
  productId: string;
  onNavigate: (route: MallRoute) => void;
}) {
  const queryClient = useQueryClient();
  const product = useBuyerMallProduct(productId);
  const addToCart = useBuyerMallAddToCart();
  const [skuId, setSkuId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const detail = product.data?.data;
  const skus = useMemo(() => detail?.skus ?? [], [detail]);
  const activeSku = skus.find((s) => s.id === skuId) ?? skus[0];
  const minQty = activeSku?.minOrderQty ?? 1;
  const currentQty = Number(quantity || minQty);

  // 当前数量适用的阶梯档:与后端 MallCatalogPolicy.effectivePrice 同口径。
  const effectivePrice = useMemo(() => {
    if (!activeSku) return undefined;
    const tiers = (activeSku.tierPrices ?? [])
      .filter((t) => t.minQty != null && t.price != null)
      .filter((t) => (t.minQty ?? 0) <= currentQty)
      .sort((a, b) => (b.minQty ?? 0) - (a.minQty ?? 0));
    return tiers[0]?.price ?? activeSku.price;
  }, [activeSku, currentQty]);

  const submitAdd = () => {
    if (!activeSku?.id) return;
    setError(null);
    addToCart.mutate(
      { data: { skuId: activeSku.id, quantity: currentQty } },
      {
        onSuccess: () => {
          setFeedback(`已加入购物车:${detail?.name} × ${currentQty}${activeSku.unit ?? ''}`);
          void queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === 'string'
              && (q.queryKey[0] as string).includes('/buyer/mall/cart'),
          });
        },
        onError: (e) =>
          setError(
            (e as { response?: { data?: { message?: string } } })?.response?.data?.message
            ?? '加入购物车失败,请稍后重试',
          ),
      },
    );
  };

  if (product.isLoading) {
    return <FeedbackNotice tone="info" message="正在加载商品详情…" />;
  }
  if (!detail) {
    return <FeedbackNotice tone="error" message="商品不存在或不在本企业可见范围。" />;
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'category', categoryId: detail.categoryId ?? undefined })}
        className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 hover:text-blue-600"
      >
        <ArrowLeft size={14} /> 返回{detail.categoryName || '商品列表'}
      </button>

      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-slate-950">{detail.name}</h1>
              {detail.scope === 'public' && (
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
                  公开专区
                </span>
              )}
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {detail.brand || '—'} · {detail.categoryName || '未分类'} · 供应商 {detail.supplierName}
            </p>

            <div className="mt-4 rounded-lg bg-slate-50 p-4">
              <p className="font-mono text-3xl font-black text-blue-700">
                {currency(effectivePrice)}
                <span className="ml-1 text-sm font-bold text-slate-500">/ {activeSku?.unit}</span>
              </p>
              {(activeSku?.tierPrices ?? []).length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-black text-slate-500">阶梯价</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {(activeSku?.tierPrices ?? []).map((tier) => (
                      <span
                        key={tier.minQty}
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-black',
                          (tier.minQty ?? 0) <= currentQty
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-slate-600 ring-1 ring-slate-200',
                        )}
                      >
                        ≥{tier.minQty}{activeSku?.unit} · {currency(tier.price)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {skus.length > 1 && (
              <div className="mt-4">
                <p className="text-xs font-black text-slate-500">选择规格</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {skus.map((sku) => (
                    <button
                      key={sku.id}
                      type="button"
                      disabled={sku.status !== '在架'}
                      onClick={() => { setSkuId(sku.id ?? null); setQuantity(''); }}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-xs font-black transition',
                        sku.id === activeSku?.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                        sku.status !== '在架' && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      {specLabel(sku.spec, sku.skuCode)}
                      {sku.status !== '在架' && '(已下架)'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
              <MiniFact label="起订量" value={`${minQty} ${activeSku?.unit ?? ''}`} />
              <MiniFact label="递增步长" value={`${activeSku?.stepQty ?? 1} ${activeSku?.unit ?? ''}`} />
              <MiniFact
                label="库存"
                value={activeSku?.stockQty == null ? '不限量' : `${activeSku.stockQty} ${activeSku.unit}`}
              />
              <MiniFact label="承诺交期" value={`${activeSku?.leadTimeDays ?? 7} 天`} />
            </div>
          </div>

          {detail.descriptionHtml && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
              <h2 className="text-base font-black text-slate-950">商品详情</h2>
              <RichTextView html={detail.descriptionHtml} className="mt-3" />
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <h2 className="text-base font-black text-slate-950">下单</h2>
            {feedback && <div className="mt-3"><FeedbackNotice tone="success" message={feedback} /></div>}
            {error && <div className="mt-3"><FeedbackNotice tone="error" message={error} /></div>}

            <label className="mt-3 block">
              <span className="text-xs font-black text-slate-500">
                采购数量(起订 {minQty}{activeSku?.unit},按 {activeSku?.stepQty ?? 1} 递增)
              </span>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
                type="number"
                min={minQty}
                step={activeSku?.stepQty ?? 1}
                placeholder={String(minQty)}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </label>

            <p className="mt-3 text-xs font-bold text-slate-500">
              小计 <b className="font-mono text-base text-slate-900">
                {currency((effectivePrice ?? 0) * currentQty)}
              </b>
            </p>

            <div className="mt-3">
              <PrimaryActionButton
                onClick={submitAdd}
                busy={addToCart.isPending}
                pendingLabel="加入中"
                icon={ShoppingCart}
                fullWidth
                disabled={!activeSku || activeSku.status !== '在架'}
              >
                加入购物车
              </PrimaryActionButton>
            </div>
            <p className="mt-2 text-[11px] font-bold text-slate-400">
              数量是否满足起订量与库存,由服务端在加购与结算时校验。
            </p>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs font-bold text-slate-600">
              <p className="flex items-center gap-1.5">
                <Truck size={14} className="text-blue-600" />
                预计 {activeSku?.leadTimeDays ?? 7} 天内到货
              </p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-emerald-600" />
                {detail.scope === 'public' ? '平台标准品统一定价' : '本企业协议价,已准入供应商'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
