import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';

export interface PeriodFulfillmentMetrics {
  supplierId: string;
  period: string;
  startDate: string;
  endDateExclusive: string;
  receiptCount: number;
  scheduledReceiptCount: number;
  onTimeCount: number;
  onTimeRate: number | null;
  totalReceived: number;
  totalQualified: number;
  qualifiedRate: number | null;
  derivedQualityScore: number | null;
  derivedDeliveryScore: number | null;
}
export interface SupplierPerformanceComparison extends Omit<PeriodFulfillmentMetrics,
  'period' | 'startDate' | 'endDateExclusive' | 'derivedQualityScore' | 'derivedDeliveryScore'> {
  relationId: string;
  supplierName: string;
  status: string;
  level: string | null;
  cooperationTier: string | null;
  evaluationId: string | null;
  qualityScore: number | null;
  deliveryScore: number | null;
  priceScore: number | null;
  serviceScore: number | null;
  totalScore: number | null;
  evaluatedAt: string | null;
}
export const listSupplierPerformanceComparison = (period: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<SupplierPerformanceComparison[]>>({
    url: '/api/v1/buyer/suppliers/performance-comparison', method: 'GET', params: { period }, signal,
  });
export const getSupplierPeriodFulfillment = (supplierId: string, period: string, signal?: AbortSignal) =>
  customInstance<ApiEnvelope<PeriodFulfillmentMetrics>>({
    url: `/api/v1/buyer/suppliers/${encodeURIComponent(supplierId)}/fulfillment-metrics`, method: 'GET', params: { period }, signal,
  });
