import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface OrderCancellationEntry {
  id: string;
  orderId: string;
  status: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  completedBy?: string;
  completedAt?: string;
  response?: string;
}
export interface OrderCancellationView {
  blockers: string[];
  items: OrderCancellationEntry[];
  total: number;
  page: number;
  size: number;
  actorId: string;
}
export function useOrderCancellation(
  scope: 'buyer' | 'supplier',
  orderId: string,
  onChanged: () => unknown,
) {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const held = useRef(false),
    key = useRef<{ value: string; reason: string } | null>(null);
  const url = `/api/v1/${scope}/orders/${encodeURIComponent(orderId)}/cancellations`;
  const query = useQuery({
    queryKey: [url, page],
    queryFn: () =>
      customInstance<ApiEnvelope<OrderCancellationView>>({
        url,
        method: 'GET',
        params: { page, size: 10 },
      }),
  });
  async function act(action: string, reason: string, id?: string) {
    if (held.current) return false;
    if (!reason.trim() || reason.length > 1000) {
      setError('办理原因必填且不得超过1000字');
      return false;
    }
    held.current = true;
    setBusy(true);
    setError('');
    let committed = false;
    try {
      if (!key.current || key.current.reason !== reason)
        key.current = { value: crypto.randomUUID(), reason };
      await customInstance({
        url: id ? url + '/' + encodeURIComponent(id) : url,
        method: 'POST',
        data: id
          ? { action, reason }
          : { requestKey: key.current.value, reason },
      });
      committed = true;
      key.current = null;
      await query.refetch();
      await onChanged();
      return true;
    } catch (e) {
      if (committed) {
        setError('操作已成功，但页面刷新失败，请点击刷新台账核对');
        return true;
      }
      setError(
        (e as { response?: { data?: { message?: string } } }).response?.data
          ?.message || '操作失败，请重试',
      );
      return false;
    } finally {
      held.current = false;
      setBusy(false);
    }
  }
  return {
    data: query.data?.data,
    loading: query.isLoading,
    loadError: query.isError,
    error,
    busy,
    page,
    setPage,
    refresh: () => query.refetch(),
    act,
  };
}
