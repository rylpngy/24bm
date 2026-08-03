import { KeyRound, LogIn, Store } from 'lucide-react';
import { FeedbackNotice, PrimaryActionButton } from '@24bid/ui';
import { usePublicMallPublicProducts } from '@24bid/api-client';
import { SELF_LOGIN_FALLBACK, useBuyerLogin } from './auth/use-buyer-login';
import type { MallRoute } from '../App';

const currency = (v?: number | null) =>
  v == null ? '待询价' : `¥${v.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`;

/**
 * 未登录首屏:公开专区可浏览,协议价与下单需登录。
 *
 * <p>与「登录后才能看见任何东西」相比,先让访客看到货品是商城的基本盘;
 * 私域协议价严格不下发。
 */
export function MallLoginGate({
  onBrowse,
  route,
}: {
  onBrowse: () => void;
  route: MallRoute;
}) {
  const { handleKeycloakLogin, handleLogin, kcBusy, kcError, login } = useBuyerLogin();
  const publicProducts = usePublicMallPublicProducts();
  const items = publicProducts.data?.data ?? [];

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4 sm:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Store size={18} />
          </span>
          <div>
            <p className="text-sm font-black text-slate-950">智采云商城</p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">
              Mall Portal
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0">
          <h1 className="text-2xl font-black text-slate-950">公开专区</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            平台标准品对所有访客展示;企业协议价与下单入口需登录后可见。
          </p>
          {publicProducts.isLoading ? (
            <div className="mt-4">
              <FeedbackNotice tone="info" message="正在加载公开商品…" />
            </div>
          ) : items.length === 0 ? (
            <div className="mt-4">
              <FeedbackNotice
                tone="info"
                message="公开专区暂无商品。登录后可浏览本企业的协议价货架。"
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((product) => (
                <article
                  key={product.id}
                  className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/50"
                >
                  <p className="truncate text-sm font-black text-slate-950">{product.name}</p>
                  <p className="mt-1 truncate text-xs font-bold text-slate-500">
                    {product.brand || '—'} · {product.supplierName}
                  </p>
                  <p className="mt-3 font-mono text-lg font-black text-blue-700">
                    {currency(product.fromPrice)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/50">
            <div className="flex items-center gap-2">
              <LogIn size={18} className="text-blue-600" />
              <h2 className="text-base font-black text-slate-950">登录采购账号</h2>
            </div>
            <p className="mt-1 text-xs font-bold text-slate-500">
              登录后可见本企业协议价、购物车与下单。
            </p>
            <div className="mt-4">
              <PrimaryActionButton
                onClick={() => handleKeycloakLogin()}
                busy={kcBusy}
                pendingLabel="登录中"
                icon={KeyRound}
                fullWidth
              >
                用 Keycloak 登录
              </PrimaryActionButton>
            </div>
            {kcError && (
              <div className="mt-3">
                <FeedbackNotice tone="error" message="Keycloak 登录失败:请确认 Keycloak 已在 8081 运行。" />
              </div>
            )}
            {SELF_LOGIN_FALLBACK && (
              <button
                type="button"
                onClick={() => handleLogin()}
                disabled={login.isPending}
                className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <LogIn size={14} className="text-slate-400" />
                {login.isPending ? '登录中…' : '以采购管理员登录(自研 JWT)'}
              </button>
            )}
            {login.isError && (
              <div className="mt-3">
                <FeedbackNotice tone="error" message="登录失败:自研登录可能已在后端关闭。" />
              </div>
            )}
            <button
              type="button"
              onClick={onBrowse}
              className="mt-4 w-full text-xs font-black text-blue-600 hover:underline"
            >
              {route.name === 'home' ? '先随便逛逛公开专区' : '继续浏览公开专区'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
