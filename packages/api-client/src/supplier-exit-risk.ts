import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface SupplierExitRisk {
  unreceivedOrderCount: number;
  unpaidInvoiceCount: number;
  unpaidInvoiceFaceAmount: number;
  unarchivedContractCount: number;
  openAfterSalesCount: number;
  uninvoicedOrderCount: number;
  paymentVerificationRequiredCount: number;
  remainingInvoiceAmount: number | null;
  blocked: boolean;
}
const countFields = ['unreceivedOrderCount', 'unpaidInvoiceCount', 'unarchivedContractCount',
  'openAfterSalesCount', 'uninvoicedOrderCount', 'paymentVerificationRequiredCount'] as const;
const amountFields = ['unpaidInvoiceFaceAmount', 'remainingInvoiceAmount'] as const;

export function isSupplierExitRisk(value: unknown): value is SupplierExitRisk {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return typeof data.blocked === 'boolean'
    && countFields.every(key => typeof data[key] === 'number' && Number.isSafeInteger(data[key]) && data[key] >= 0)
    && amountFields.every(key => (key === 'remainingInvoiceAmount' && data[key] === null
      && data.blocked === true && typeof data.paymentVerificationRequiredCount === 'number' && data.paymentVerificationRequiredCount > 0)
      || (typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0));
}
export function isSupplierExitBlocked(risk: SupplierExitRisk): boolean {
  return risk.blocked || risk.remainingInvoiceAmount === null || countFields.some(key => risk[key] > 0)
    || amountFields.some(key => (risk[key] ?? 0) > 0);
}
export const getSupplierExitRisk = (relationId: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<SupplierExitRisk>>({
    url: `/api/v1/buyer/suppliers/${encodeURIComponent(relationId)}/exit-risk`, method: 'GET', signal,
  });
