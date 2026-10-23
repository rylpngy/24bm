import { ArrowRight, PackageSearch, Sparkles, Tags } from 'lucide-react';
import { useBuyerMallCategories, useBuyerMallProducts } from '@24bid/api-client';
import { FeedbackNotice, SearchInput, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { ProductCard, currency } from '../catalog/product-card';

/** 商城首页:分类入口 + 精选商品。数据全部来自真实在架商品,无装饰性占位。 */
export function MallHomePage({ onNavigate }: { onNavigate: (route: MallRoute) => void }) {
  const categories = useBuyerMallCategories();
  const products = useBuyerMallProducts();
  const items = products.data?.data ?? [];
  const featured = items.slice(0, 8);
  const lowestPrice = items
    .map((p) => p.fromPrice)
    .filter((p): p is number => p != null)
    .sort((a, b) => a - b)[0];

  if (products.isError || categories.isError) return <FeedbackNotice tone="error" message="商城商品或分类加载失败，请刷新重试。" />;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-slate-950 px-6 py-10 text-white sm:px-10">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-200">
          <Sparkles size={13} /> 协议价直采 · 一站下单
        </p>
        <h1 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">企业采购商城</h1>
        <p className="mt-2 max-w-xl text-sm font-bold text-slate-300">
          本企业已谈定的协议价货架与平台标准品,支持起订量、阶梯价与库存实时校验,
          下单后自动生成采购订单并接入履约与对账。
        </p>
        <div className="mt-6 max-w-lg">
          <SearchInput
            placeholder="搜索商品名称 / 品牌 / 供应商"
            onSearch={(keyword) => onNavigate({ name: 'category', keyword })}
          />
        </div>
        <div className="mt-6 flex flex-wrap gap-6 text-sm font-bold text-slate-300">
          <span>在架商品 <b className="text-white">{items.length}</b> 个</span>
          {lowestPrice != null && (
            <span>最低起价 <b className="text-white">{currency(lowestPrice)}</b></span>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-950">
            <Tags size={18} className="text-blue-600" /> 商品分类
          </h2>
          <button
            type="button"
            onClick={() => onNavigate({ name: 'category' })}
            className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:underline"
          >
            全部商品 <ArrowRight size={13} />
          </button>
        </div>
        {(categories.data?.data ?? []).length === 0 ? (
          <div className="mt-3">
            <FeedbackNotice tone="info" message="尚未建立商品分类。供应商上架商品并归类后展示在此。" />
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {(categories.data?.data ?? []).map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onNavigate({ name: 'category', categoryId: category.id })}
                className={cn(
                  'rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm font-black',
                  'text-slate-800 transition hover:border-blue-200 hover:bg-blue-50/60',
                )}
              >
                {category.name}
                {category.platformLevel && (
                  <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                    平台
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="inline-flex items-center gap-2 text-lg font-black text-slate-950">
          <PackageSearch size={18} className="text-blue-600" /> 精选商品
        </h2>
        {products.isLoading ? (
          <div className="mt-3"><FeedbackNotice tone="info" message="正在加载商品…" /></div>
        ) : featured.length === 0 ? (
          <div className="mt-3">
            <FeedbackNotice tone="info" message="暂无在架商品。供应商上架并由采购方启用后展示在此。" />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onOpen={() => product.id && onNavigate({ name: 'product', productId: product.id })}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
