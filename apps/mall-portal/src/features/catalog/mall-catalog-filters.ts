import type { MallCategoryResponse, MallProductResponse } from '@24bid/api-client';

export type CatalogSort = 'default' | 'price-asc' | 'price-desc';
export type CategoryNode = MallCategoryResponse & { id: string; children: CategoryNode[] };

function categoryIndex(categories: readonly MallCategoryResponse[]) {
  const nodes = new Map<string, CategoryNode>();
  for (const category of categories) {
    if (category.id && !nodes.has(category.id)) nodes.set(category.id, { ...category, id: category.id, children: [] });
  }
  const children = new Map<string, CategoryNode[]>();
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      const siblings = children.get(node.parentId) ?? [];
      siblings.push(node);
      children.set(node.parentId, siblings);
    }
  }
  return { nodes, children };
}

export function buildCategoryTree(categories: readonly MallCategoryResponse[]): CategoryNode[] {
  const { nodes, children } = categoryIndex(categories);
  const seen = new Set<string>();
  const visit = (node: CategoryNode): CategoryNode => {
    seen.add(node.id);
    for (const child of children.get(node.id) ?? []) {
      if (!seen.has(child.id)) node.children.push(visit(child));
    }
    return node;
  };
  const roots = [...nodes.values()].filter((node) => !node.parentId || !nodes.has(node.parentId));
  const tree = roots.map(visit);
  // Preserve malformed cyclic components as visible roots without rendering a cycle.
  for (const node of nodes.values()) if (!seen.has(node.id)) tree.push(visit(node));
  return tree;
}

export function categoryProductRows<T extends MallProductResponse>(
  products: readonly T[], categories: readonly MallCategoryResponse[], categoryId?: string,
): T[] {
  if (!categoryId || categoryId === 'all') return [...products];
  const { children } = categoryIndex(categories);
  const descendants = new Set<string>();
  const pending = [categoryId];
  while (pending.length) {
    const id = pending.pop()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    for (const child of children.get(id) ?? []) pending.push(child.id);
  }
  return products.filter((product) => product.categoryId != null && descendants.has(product.categoryId));
}

export function filterCatalogProducts<T extends MallProductResponse>(
  products: readonly T[],
  { brand = '', supplier = '', sort = 'default' }: { brand?: string; supplier?: string; sort?: CatalogSort },
): T[] {
  const rows = products.filter((product) => (!brand || product.brand?.trim() === brand)
    && (!supplier || product.supplierName?.trim() === supplier));
  if (sort === 'default') return rows;
  return rows.sort((a, b) => {
    const left = a.fromPrice;
    const right = b.fromPrice;
    const leftMissing = left == null || !Number.isFinite(left);
    const rightMissing = right == null || !Number.isFinite(right);
    if (leftMissing || rightMissing) return Number(leftMissing) - Number(rightMissing);
    return sort === 'price-asc' ? left - right : right - left;
  });
}
