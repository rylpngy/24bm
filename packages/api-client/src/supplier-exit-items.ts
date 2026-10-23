import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export type SupplierExitItemKind = 'uninvoiced' | 'payment-verification';
export interface SupplierExitItem {
  id: string;
  orderId: string | null;
  invoiceId: string | null;
  label: string;
  status: string;
  amount: number;
  invoicedAmount: number | null;
  paidAmount: number | null;
  remainingAmount: number | null;
  reason: string;
  handlerLabel: string;
}
export interface SupplierExitItemsPage { items: SupplierExitItem[]; total: number; page: number; pageSize: number }
export const SUPPLIER_EXIT_ITEMS_PAGE_SIZE = 10;
const endpoint = (relationId: string) => `/api/v1/buyer/suppliers/${encodeURIComponent(relationId)}/exit-items`;
export const supplierExitItemsKey = (relationId: string, kind: SupplierExitItemKind, page: number) =>
  [endpoint(relationId), kind, page] as const;
export const getSupplierExitItems = (relationId: string, kind: SupplierExitItemKind, page: number, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<SupplierExitItemsPage>>({ url: endpoint(relationId), method: 'GET',
    params: { kind, page, pageSize: SUPPLIER_EXIT_ITEMS_PAGE_SIZE }, signal });

export function isSupplierExitItemsPage(value: unknown, requestedPage: number): value is SupplierExitItemsPage {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return data.page === requestedPage && data.pageSize === SUPPLIER_EXIT_ITEMS_PAGE_SIZE
    && typeof data.total === 'number' && Number.isSafeInteger(data.total) && data.total >= 0
    && Array.isArray(data.items) && data.items.length <= SUPPLIER_EXIT_ITEMS_PAGE_SIZE && data.items.length <= data.total
    && data.items.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Record<string, unknown>;
      return typeof row.id === 'string' && row.id.length > 0
        && ['label', 'status', 'reason', 'handlerLabel'].every(key => typeof row[key] === 'string')
        && ['orderId', 'invoiceId'].every(key => row[key] === null || typeof row[key] === 'string')
        && typeof row.amount === 'number' && Number.isFinite(row.amount)
        && ['invoicedAmount', 'paidAmount', 'remainingAmount'].every(key => row[key] === null || (typeof row[key] === 'number' && Number.isFinite(row[key])));
    });
}
