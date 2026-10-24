import { useEffect, useState } from 'react';
import { ShoppingCart, Store } from 'lucide-react';
import { useBuyerMallCart } from '@24bid/api-client';
import { cn, FeedbackNotice } from '@24bid/ui';
import { useMallPermissions } from './lib/use-mall-permissions';
import { useAuthStore } from './lib/auth-store';
import { MallHomePage } from './features/home/mall-home-page';
import { MallCategoryPage } from './features/catalog/mall-category-page';
import { MallProductDetailPage } from './features/catalog/mall-product-detail-page';
import { MallLoginGate } from './features/login-gate';
import { MallCartPage } from './features/cart/mall-cart-page';
import { MallCheckoutPage } from './features/cart/mall-checkout-page';
import { MallOrdersPage } from './features/orders/mall-orders-page';

/** 商城门户路由:URL 参数驱动(无路由库),便于深链与独立部署。 */
export type MallRoute =
  | { name: 'home' }
  | { name: 'category'; categoryId?: string; keyword?: string }
  | { name: 'product'; productId: string; skuId?: string; quantity?: number }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'orders' };

function readRoute(): MallRoute {
  if (typeof window === 'undefined') return { name: 'home' };
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'cart') return { name: 'cart' };
  if (view === 'checkout') return { name: 'checkout' };
  if (view === 'orders') return { name: 'orders' };
  const productId = params.get('product');
  const quantity = Number(params.get('quantity'));
  if (productId) return { name: 'product', productId, skuId: params.get('sku') ?? undefined, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : undefined };
  if (params.has('category') || params.has('q')) {
    return {
      name: 'category',
      categoryId: params.get('category') ?? undefined,
      keyword: params.get('q') ?? undefined,
    };
  }
  return { name: 'home' };
}

function writeRoute(route: MallRoute) {
  const url = new URL(window.location.href);
  url.searchParams.delete('product');
  url.searchParams.delete('sku');
  url.searchParams.delete('quantity');
  url.searchParams.delete('category');
  url.searchParams.delete('q');
  url.searchParams.delete('view');
  if (route.name === 'cart' || route.name === 'checkout' || route.name === 'orders') {
    url.searchParams.set('view', route.name);
  }
  if (route.name === 'product') { url.searchParams.set('product', route.productId); if (route.skuId) url.searchParams.set('sku', route.skuId); if (route.quantity) url.searchParams.set('quantity', String(route.quantity)); }
  if (route.name === 'category') {
    if (route.categoryId) url.searchParams.set('category', route.categoryId);
    if (route.keyword) url.searchParams.set('q', route.keyword);
    if (!route.categoryId && !route.keyword) url.searchParams.set('category', 'all');
  }
  window.history.pushState(null, '', url.toString());
}

export function App() {
  const { can, query: permissions } = useMallPermissions();
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const [route, setRoute] = useState<MallRoute>(readRoute);

  // 浏览器前进/后退:商城是逛的场景,后退必须回上一页而不是留在原地。
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (next: MallRoute) => {
    writeRoute(next);
    setRoute(next);
    window.scrollTo({ top: 0 });
  };

  // 购物车角标只在登录后有意义(未登录浏览公开专区)。
  const cart = useBuyerMallCart({ query: { enabled: !!session && can('buyer:mall:read') } });
  const cartCount = cart.isError ? 0 : cart.data?.data?.itemCount ?? 0;
  const allowed = can(route.name === 'orders' ? 'buyer:order:read' : 'buyer:mall:read')
    && (route.name !== 'checkout' || can('buyer:mall:purchase'));

  if (!session) {
    return <MallLoginGate onBrowse={() => navigate({ name: 'category' })} route={route} />;
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => navigate({ name: 'home' })}
            className="flex shrink-0 items-center gap-2"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-black text-white">
              <Store size={18} />
            </span>
            <span className="text-left">
              <span className="block text-sm font-black leading-tight text-slate-950">智采云商城</span>
              <span className="block text-[11px] font-bold leading-tight text-slate-400">
                协议价直采
              </span>
            </span>
          </button>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
            {[
              { label: '首页', active: route.name === 'home', to: { name: 'home' } as MallRoute },
              { label: '全部商品', active: route.name === 'category', to: { name: 'category' } as MallRoute },
              { label: '我的订单', active: route.name === 'orders', to: { name: 'orders' } as MallRoute },
            ].filter((item) => can(item.to.name === 'orders' ? 'buyer:order:read' : 'buyer:mall:read')).map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.to)}
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-black transition',
                  item.active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {can('buyer:mall:read') && <button
              type="button"
              onClick={() => navigate({ name: 'cart' })}
              className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
            >
              <ShoppingCart size={14} />
              购物车
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-black text-white">
                  {cartCount}
                </span>
              )}
            </button>}
            <span className="hidden text-xs font-bold text-slate-500 sm:inline">
              {session.displayName}
            </span>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-black text-slate-500 hover:bg-slate-50"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {permissions.isLoading ? <FeedbackNotice tone="info" message="正在加载权限…" />
          : !allowed ? <FeedbackNotice tone="error" message={permissions.isError ? '权限加载失败，请刷新重试。' : '当前账号无权访问此页面，请联系企业管理员。'} />
          : <>
              {route.name === 'home' && <MallHomePage onNavigate={navigate} />}
              {route.name === 'category' && (
                <MallCategoryPage
                  categoryId={route.categoryId}
                  keyword={route.keyword}
                  onNavigate={navigate}
                />
              )}
              {route.name === 'product' && (
                <MallProductDetailPage productId={route.productId} initialSkuId={route.skuId} initialQuantity={route.quantity} onNavigate={navigate} />
              )}
              {route.name === 'cart' && <MallCartPage onNavigate={navigate} />}
              {route.name === 'checkout' && <MallCheckoutPage onNavigate={navigate} />}
              {route.name === 'orders' && <MallOrdersPage />}
            </>}
      </main>
    </div>
  );
}
