import { useMemo, useState } from 'react';
import { useBuyerMallCategories, useBuyerMallProducts } from '@24bid/api-client';
import { FeedbackNotice, Pagination, SearchInput, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { ProductCard } from './product-card';

const PAGE_SIZE = 12;
const SORTS = [
  { id: 'default', label: '综合' },
  { id: 'price-asc', label: '价格从低到高' },
  { id: 'price-desc', label: '价格从高到低' },
] as const;

/** 分类页:分类树 + 关键词 + 供应商筛选 + 排序 + 分页。筛选在服务端过滤分类与关键词。 */
export function MallCategoryPage({
  categoryId,
  keyword,
  onNavigate,
}: {
  categoryId?: string;
  keyword?: string;
  onNavigate: (route: MallRoute) => void;
}) {
  const categories = useBuyerMallCategories();
  const products = useBuyerMallProducts({
    categoryId: categoryId && categoryId !== 'all' ? categoryId : undefined,
    keyword: keyword || undefined,
  });
  const [supplierFilter, setSupplierFilter] = useState('全部');
  const [sort, setSort] = useState<(typeof SORTS)[number]['id']>('default');
  const [page, setPage] = useState(1);

  const all = products.data?.data ?? [];
  const suppliers = useMemo(
    () => ['全部', ...new Set(all.map((p) => p.supplierName ?? '').filter(Boolean))],
    [all],
  );

  const filtered = useMemo(() => {
    const rows = all.filter((p) => supplierFilter === '全部' || p.supplierName === supplierFilter);
    if (sort === 'default') return rows;
    // 无报价的商品(fromPrice 为空)排在最后,避免被当成 0 元冲到最前。
    return [...rows].sort((a, b) => {
      const left = a.fromPrice ?? Number.POSITIVE_INFINITY;
      const right = b.fromPrice ?? Number.POSITIVE_INFINITY;
      return sort === 'price-asc' ? left - right : right - left;
    });
  }, [all, supplierFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCategory = (categories.data?.data ?? []).find((c) => c.id === categoryId);
  if (products.isError || categories.isError) return <FeedbackNotice tone="error" message="商品列表或分类加载失败，请刷新重试。" />;

  return (
    <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="text-xs font-black text-slate-500">商品分类</p>
        <div className="mt-2 space-y-1">
          <button
            type="button"
            onClick={() => { onNavigate({ name: 'category', keyword }); setPage(1); }}
            className={cn(
              'block w-full rounded-lg px-3 py-2 text-left text-xs font-black transition',
              !categoryId || categoryId === 'all'
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            全部商品
          </button>
          {(categories.data?.data ?? []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => {
                onNavigate({ name: 'category', categoryId: category.id, keyword });
                setPage(1);
              }}
              className={cn(
                'block w-full truncate rounded-lg px-3 py-2 text-left text-xs font-black transition',
                categoryId === category.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-black text-slate-950">
            {activeCategory?.name ?? (keyword ? `搜索「${keyword}」` : '全部商品')}
            <span className="ml-2 text-sm font-bold text-slate-400">{filtered.length} 件</span>
          </h1>
          <SearchInput
            className="mb-0"
            placeholder="搜索商品 / 品牌 / 供应商"
            onSearch={(next) => { onNavigate({ name: 'category', categoryId, keyword: next }); setPage(1); }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="供应商筛选"
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700"
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          >
            {suppliers.map((s) => <option key={s} value={s}>{s === '全部' ? '全部供应商' : s}</option>)}
          </select>
          <div className="flex items-center gap-1">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSort(option.id)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-black transition',
                  sort === option.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {products.isLoading ? (
          <div className="mt-4"><FeedbackNotice tone="info" message="正在加载商品…" /></div>
        ) : pageItems.length === 0 ? (
          <div className="mt-4">
            <FeedbackNotice tone="info" message="没有符合条件的商品,换个分类或关键词试试。" />
          </div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pageItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onOpen={() => product.id && onNavigate({ name: 'product', productId: product.id })}
                />
              ))}
            </div>
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </div>
  );
}
