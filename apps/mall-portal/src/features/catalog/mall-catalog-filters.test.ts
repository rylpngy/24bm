import { describe, expect, it } from 'vitest';
import { buildCategoryTree, categoryProductRows, filterCatalogProducts } from './mall-catalog-filters';

describe('category hierarchy', () => {
  it('builds unordered, arbitrarily deep categories and keeps orphans visible', () => {
    const categories = [
      { id: 'leaf', parentId: 'child' }, { id: 'child', parentId: 'root' },
      { id: 'root' }, { id: 'orphan', parentId: 'missing' },
    ];
    const tree = buildCategoryTree(categories);
    expect(tree.map((node) => node.id)).toEqual(['root', 'orphan']);
    expect(tree[0].children[0].children[0].id).toBe('leaf');
    const products = ['root', 'child', 'leaf', 'orphan'].map((categoryId) => ({ id: categoryId, categoryId }));
    expect(categoryProductRows(products, categories, 'root').map((p) => p.id)).toEqual(['root', 'child', 'leaf']);
    expect(categoryProductRows(products, categories, 'child').map((p) => p.id)).toEqual(['child', 'leaf']);
    expect(categoryProductRows(products, categories, 'all')).toEqual(products);
  });

  it('terminates cycles, deduplicates IDs and tolerates missing category metadata', () => {
    const categories = [{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }, { id: 'a' }, {}];
    const tree = buildCategoryTree(categories);
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children).toEqual([]);
    const products = [{ categoryId: 'a' }, { categoryId: 'b' }, { categoryId: 'unknown' }, {}];
    expect(categoryProductRows(products, categories, 'a')).toHaveLength(2);
    expect(categoryProductRows(products, categories, 'unknown')).toEqual([{ categoryId: 'unknown' }]);
    expect(categoryProductRows(products, categories)).toEqual(products);
  });
});

describe('catalog filtering and price ordering', () => {
  const products = [
    { id: 'unknown' }, { id: 'high', fromPrice: 20, brand: ' 甲 ', supplierName: '供方' },
    { id: 'low', fromPrice: 5, brand: '乙', supplierName: '供方' },
    { id: 'zero', fromPrice: 0 }, { id: 'equal', fromPrice: 5 },
    { id: 'invalid', fromPrice: Number.NaN },
  ];
  it.each(['price-asc', 'price-desc'] as const)('keeps missing/invalid prices last for %s', (sort) => {
    const result = filterCatalogProducts(products, { sort });
    expect(result.slice(-2).map((p) => p.id)).toEqual(['unknown', 'invalid']);
    expect(result.slice(0, 4).map((p) => p.id)).toEqual(sort === 'price-asc'
      ? ['zero', 'low', 'equal', 'high'] : ['high', 'low', 'equal', 'zero']);
    expect(products[0].id).toBe('unknown');
  });
  it('combines exact normalized brand and supplier filters, preserving default order', () => {
    expect(filterCatalogProducts(products, { brand: '甲', supplier: '供方' }).map((p) => p.id)).toEqual(['high']);
    expect(filterCatalogProducts(products, { brand: '不存在' })).toEqual([]);
    expect(filterCatalogProducts(products, {})).toEqual(products);
  });
});
