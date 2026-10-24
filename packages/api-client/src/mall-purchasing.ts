import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from './http-client';

export interface MallPurchaseControl {
  maxCheckoutAmount?: number | null;
  categoryIds: string[];
  requireAddress: boolean;
}
export interface MallComparisonRow {
  productId: string; skuId: string; productName: string; brand: string; supplierName: string;
  skuCode: string; spec: string; unit: string; unitPrice: number; total: number;
  leadTimeDays: number; stockQty?: number | null; sameSpecification: boolean;
}
interface Envelope<T> { data: T }
export const mallControlKey = ['/api/v1/buyer/mall/purchase-controls'] as const;
export function useMallPurchaseControl(enabled = true) {
  return useQuery({ queryKey: mallControlKey, enabled, retry: false,
    queryFn: async ({ signal }) => (await axiosInstance.get<Envelope<MallPurchaseControl>>(mallControlKey[0], { signal })).data.data });
}
export async function saveMallPurchaseControl(control: MallPurchaseControl & { reason: string }) {
  return (await axiosInstance.put<Envelope<MallPurchaseControl>>(mallControlKey[0], control)).data.data;
}
export function useMallComparison(skuId: string | undefined, quantity: number, enabled = true) {
  return useQuery({ queryKey: ['/api/v1/buyer/mall/comparison', skuId, quantity],
    enabled: enabled && !!skuId && Number.isFinite(quantity) && quantity > 0, retry: false,
    queryFn: async ({ signal }) => (await axiosInstance.get<Envelope<MallComparisonRow[]>>('/api/v1/buyer/mall/comparison', { signal, params: { skuId, quantity } })).data.data });
}
