import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { MallCategoryPage } from './mall-category-page';

// Category tests retain their catalog/filter assertions; media I/O is covered separately.
vi.mock('./buyer-product-images', () => ({ BuyerProductImages: () => null }));

const api = vi.hoisted(() => ({ products: vi.fn(), categories: vi.fn() }));
vi.mock('@24bid/api-client', async (original) => ({
  ...await original<Record<string, unknown>>(),
  useBuyerMallProducts: api.products,
  useBuyerMallCategories: api.categories,
}));

const categories = [
  { id: 'leaf', parentId: 'child', name: '复印纸' },
  { id: 'root', name: '办公用品' },
  { id: 'child', parentId: 'root', name: '纸品' },
  { id: 'other', name: '设备' },
];
const products = [
  { id: 'a', categoryId: 'root', name: '文件夹', brand: '甲牌', supplierName: '供方一', fromPrice: 10 },
  { id: 'b', categoryId: 'leaf', name: 'A4纸', brand: '乙牌', supplierName: '供方二', fromPrice: 20 },
  { id: 'c', categoryId: 'child', name: '待询价纸', brand: '乙牌', supplierName: '供方一' },
  { id: 'd', categoryId: 'other', name: '打印机', brand: '丙牌', fromPrice: 100 },
];
function show(categoryId = 'root', keyword?: string) {
  api.categories.mockReturnValue({ data: { data: categories } });
  api.products.mockReturnValue({ data: { data: products } });
  const navigate = vi.fn();
  return { ...render(<MallCategoryPage categoryId={categoryId} keyword={keyword} onNavigate={navigate} />), navigate };
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('loads without an exact category constraint and includes every descendant', () => {
  show('root', '纸');
  expect(api.products).toHaveBeenCalledWith({ keyword: '纸' });
  expect(screen.getByRole('button', { name: /文件夹/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /A4纸/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /待询价纸/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /打印机/ })).not.toBeInTheDocument();
  const tree = screen.getByRole('navigation', { name: '商品分类' });
  const rootItem = within(tree).getByRole('button', { name: '办公用品' }).closest('li')!;
  expect(within(rootItem).getByRole('button', { name: '复印纸' })).toBeInTheDocument();
  fireEvent.click(within(tree).getByRole('button', { name: '收起办公用品' }));
  expect(within(tree).queryByRole('button', { name: '复印纸' })).not.toBeInTheDocument();
});

it('combines brand and supplier filters and keeps missing prices last in both directions', () => {
  const view = show();
  const names = () => [...view.container.querySelectorAll('[data-catalog-products] > button')]
    .map((node) => node.textContent);
  fireEvent.click(screen.getByRole('button', { name: '价格从高到低' }));
  expect(names()[0]).toContain('A4纸');
  expect(names()[2]).toContain('待询价纸');
  fireEvent.click(screen.getByRole('button', { name: '价格从低到高' }));
  expect(names()[0]).toContain('文件夹');
  expect(names()[2]).toContain('待询价纸');
  fireEvent.change(screen.getByRole('combobox', { name: '品牌筛选' }), { target: { value: '乙牌' } });
  expect(screen.queryByRole('button', { name: /文件夹/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '供应商筛选' }), { target: { value: '供方一' } });
  expect(names()).toHaveLength(1);
  expect(names()[0]).toContain('待询价纸');
  expect(screen.queryByRole('option', { name: '丙牌' })).not.toBeInTheDocument();
});

it('resets filters when route category changes and preserves keyword on tree navigation', () => {
  const view = show('root', '纸');
  fireEvent.change(screen.getByRole('combobox', { name: '品牌筛选' }), { target: { value: '乙牌' } });
  fireEvent.click(screen.getByRole('button', { name: '复印纸' }));
  expect(view.navigate).toHaveBeenCalledWith({ name: 'category', categoryId: 'leaf', keyword: '纸' });
  view.rerender(<MallCategoryPage categoryId="other" keyword="纸" onNavigate={view.navigate} />);
  expect(screen.getByRole('combobox', { name: '品牌筛选' })).toHaveValue('');
  expect(screen.getByRole('button', { name: /打印机/ })).toBeInTheDocument();
});

it('resets pagination on sorting and filtering', () => {
  show();
  api.products.mockReturnValue({ data: { data: Array.from({ length: 14 }, (_, index) => ({
    id: `p-${index}`, name: `商品${index}`, categoryId: 'leaf', brand: index === 0 ? '甲牌' : '乙牌',
    fromPrice: index,
  })) } });
  cleanup();
  render(<MallCategoryPage categoryId="root" onNavigate={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(screen.getByRole('button', { name: /商品13/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '价格从低到高' }));
  expect(screen.getByRole('button', { name: /商品0 / })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  fireEvent.change(screen.getByRole('combobox', { name: '品牌筛选' }), { target: { value: '甲牌' } });
  expect(screen.getByRole('button', { name: /商品0 / })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
});

it('hides cached products when either catalog request fails', () => {
  show();
  api.categories.mockReturnValue({ isError: true, data: { data: categories } });
  cleanup();
  render(<MallCategoryPage categoryId="root" onNavigate={vi.fn()} />);
  expect(screen.getByText(/商品列表或分类加载失败/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /文件夹/ })).not.toBeInTheDocument();
});

it('shows the route keyword and submits or clears search within the selected category', () => {
  const view = show('root', '原关键词');
  const input = screen.getByRole('textbox', { name: '搜索商品 / 品牌 / 供应商' });
  expect(input).toHaveValue('原关键词');
  fireEvent.change(input, { target: { value: ' 新品牌 ' } });
  fireEvent.click(screen.getByRole('button', { name: '搜索' }));
  expect(view.navigate).toHaveBeenLastCalledWith({ name: 'category', categoryId: 'root', keyword: '新品牌' });
  fireEvent.click(screen.getByRole('button', { name: '清除搜索' }));
  expect(view.navigate).toHaveBeenLastCalledWith({ name: 'category', categoryId: 'root', keyword: '' });
  expect(input).toHaveValue('');
});
