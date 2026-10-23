import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { PurchaseDemandResponse } from './generated/model';

export interface DemandPageParams {
  page: number;
  pageSize: number;
  status?: string;
  departmentId?: string;
  keyword?: string;
}

export interface DemandPage {
  items: PurchaseDemandResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export function useDemandPage(params: DemandPageParams, enabled = true) {
  return useQuery({
    queryKey: ['/api/v1/buyer/demands/page', params],
    queryFn: ({ signal }) => customInstance<{ data: DemandPage }>({
      url: '/api/v1/buyer/demands/page', method: 'GET', params, signal,
    }),
    enabled,
  });
}

export function useDemandDetail(id?: string) {
  return useQuery({
    queryKey: ['/api/v1/buyer/demands', id],
    queryFn: ({ signal }) => customInstance<{ data: PurchaseDemandResponse }>({
      url: `/api/v1/buyer/demands/${encodeURIComponent(id!)}`, method: 'GET', signal,
    }),
    enabled: !!id,
  });
}
