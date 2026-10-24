import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useBuyerMallCategories, useBuyerMallProducts } from '@24bid/api-client';
import { FeedbackNotice, Pagination, cn } from '@24bid/ui';
import type { MallRoute } from '../../App';
import { ProductCard } from './product-card';
import { buildCategoryTree, categoryProductRows, filterCatalogProducts, type CategoryNode, type CatalogSort } from './mall-catalog-filters';

const PAGE_SIZE = 12;
const SORTS = [
  { id: 'default', label: '综合' },
  { id: 'price-asc', label: '价格从低到高' },
  { id: 'price-desc', label: '价格从高到低' },
] as const;

type CategoryPageProps = {
  categoryId?: string;
  keyword?: string;
  onNavigate: (route: MallRoute) => void;
};

export function MallCategoryPage(props: CategoryPageProps) {
  return <CategoryResults key={JSON.stringify([props.categoryId, props.keyword])} {...props} />;
}

function CategoryResults({ categoryId, keyword, onNavigate }: CategoryPageProps) {
  const categories = useBuyerMallCategories();
  // The API category predicate is exact-only; filter the complete keyword result by descendants here.
  const products = useBuyerMallProducts({
    keyword: keyword || undefined,
  });
  const [supplierFilter, setSupplierFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [sort, setSort] = useState<CatalogSort>('default');
  const [page, setPage] = useState(1);
  const [searchText, setSearchText] = useState(keyword ?? '');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const categoryRows = categories.data?.data;
  const productRows = products.data?.data;
  const tree = useMemo(() => buildCategoryTree(categoryRows ?? []), [categoryRows]);
  const all = useMemo(() => categoryProductRows(productRows ?? [], categoryRows ?? [], categoryId),
    [productRows, categoryRows, categoryId]);
  const suppliers = useMemo(
    () => [...new Set(all.map((p) => p.supplierName?.trim() ?? '').filter(Boolean))],
    [all],
  );
  const brands = useMemo(() => [...new Set(all.map((p) => p.brand?.trim() ?? '').filter(Boolean))], [all]);

  const filtered = useMemo(() => filterCatalogProducts(all, { brand: brandFilter, supplier: supplierFilter, sort }),
    [all, brandFilter, supplierFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCategory = (categories.data?.data ?? []).find((c) => c.id === categoryId);
  if (products.isError || categories.isError) return <FeedbackNotice tone="error" message="商品列表或分类加载失败，请刷新重试。" />;

  const renderCategories = (nodes: CategoryNode[], depth = 0) => (
    <ul className="min-w-0 space-y-1">
      {nodes.map((node) => {
        const expanded = !collapsed.has(node.id);
        const name = node.name || node.id;
        return (
          <li key={node.id} className="min-w-0">
            <div className="flex min-w-0 items-start" style={{ paddingInlineStart: Math.min(depth, 5) * 12 }}>
              {node.children.length > 0 ? (
                <button type="button" aria-label={`${expanded ? '收起' : '展开'}${name}`}
                  title={`${expanded ? '收起' : '展开'}${name}`} aria-expanded={expanded}
                  className="flex h-8 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
                  onClick={() => setCollapsed((current) => {
                    const next = new Set(current);
                    if (expanded) next.add(node.id); else next.delete(node.id);
                    return next;
                  })}>
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : <span className="w-6 shrink-0" />}
              <button type="button" aria-current={categoryId === node.id ? 'page' : undefined}
                onClick={() => { onNavigate({ name: 'category', categoryId: node.id, keyword }); setPage(1); }}
                className={cn('min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-xs font-black [overflow-wrap:anywhere]',
                  categoryId === node.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100')}>
                {name}
              </button>
            </div>
            {expanded && node.children.length > 0 && renderCategories(node.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <p className="text-xs font-black text-slate-500">商品分类</p>
        <nav aria-label="商品分类" className="mt-2 min-w-0 space-y-1">
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
          {renderCategories(tree)}
        </nav>
      </aside>

      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="min-w-0 text-xl font-black text-slate-950 [overflow-wrap:anywhere]">
            {activeCategory?.name ?? (keyword ? `搜索「${keyword}」` : '全部商品')}
            <span className="ml-2 text-sm font-bold text-slate-400">{filtered.length} 件</span>
          </h1>
          <form className="flex w-full min-w-0 max-w-full items-center gap-1.5 sm:w-80"
            onSubmit={(event) => {
              event.preventDefault();
              onNavigate({ name: 'category', categoryId, keyword: searchText.trim() });
              setPage(1);
            }}>
            <input aria-label="搜索商品 / 品牌 / 供应商" placeholder="搜索商品 / 品牌 / 供应商"
              value={searchText} onChange={(event) => setSearchText(event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-3 text-xs outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100" />
            <button type="submit" aria-label="搜索" title="搜索"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700">
              <Search size={16} />
            </button>
            {(searchText || keyword) && <button type="button" aria-label="清除搜索" title="清除搜索"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
              onClick={() => {
                setSearchText('');
                onNavigate({ name: 'category', categoryId, keyword: '' });
                setPage(1);
              }}>
              <X size={16} />
            </button>}
          </form>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="供应商筛选"
            className="h-9 min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700"
            value={supplierFilter}
            onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部供应商</option>
            {suppliers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="品牌筛选"
            className="h-9 min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-black text-slate-700"
            value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(1); }}>
            <option value="">全部品牌</option>
            {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
          </select>
          <div role="group" aria-label="商品排序" className="flex min-w-0 flex-wrap items-center gap-1">
            {SORTS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={sort === option.id}
                onClick={() => { setSort(option.id); setPage(1); }}
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

        {products.isLoading || categories.isLoading ? (
          <div className="mt-4"><FeedbackNotice tone="info" message="正在加载商品…" /></div>
        ) : pageItems.length === 0 ? (
          <div className="mt-4">
            <FeedbackNotice tone="info" message="没有符合条件的商品,换个分类或关键词试试。" />
          </div>
        ) : (
          <>
            <div data-catalog-products className="mt-4 grid min-w-0 gap-3 [grid-template-columns:minmax(0,1fr)] sm:grid-cols-2 xl:grid-cols-3 [&>button>div:last-child]:flex-wrap [&>button>div:last-child>span]:min-w-0 [&>button>div:last-child>span]:[overflow-wrap:anywhere]">
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
