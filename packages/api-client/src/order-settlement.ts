import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { customInstance } from './http-client';
import type { ApiEnvelope } from './workflow-runtime';
export interface SettlementEntry {
  id: string;
  orderId: string;
  contractId: string;
  kind: string;
  reason: string;
  snapshot: string;
  goodsAmount: number;
  compensationAmount: number;
  finalAmount: number;
  initialPaid: number;
  status: string;
  revision: number;
  workflowInstanceId?: string;
  createdBy: string;
  createdAt: string;
  agreementName: string;
  supplierComment?: string;
}
export interface SettlementEvidence {
  id: string;
  kind: string;
  amount: number;
  evidenceNo: string;
  remark: string;
  createdBy: string;
  createdAt: string;
}
export interface SettlementDetail {
  record: SettlementEntry;
  evidence: SettlementEvidence[];
  netPaid: number;
  refundDue: number;
  paymentDue: number;
  blockers: string[];
}
export interface SettlementView {
  preview: {
    contractId?: string;
    kind: string;
    goodsAmount: number;
    paidAmount: number;
    invoicedAmount: number;
    baseline: string;
    blockers: string[];
  };
  items: SettlementEntry[];
  total: number;
  actorId: string;
}
export function useOrderSettlement(
  scope: 'buyer' | 'supplier',
  orderId: string,
  onChanged: () => unknown,
) {
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState('');
  const held = useRef(false),
    keys = useRef(new Map<string, string>());
  const url = `/api/v1/${scope}/orders/${encodeURIComponent(orderId)}/settlements`;
  const query = useQuery({
    queryKey: [url, page],
    queryFn: () =>
      customInstance<ApiEnvelope<SettlementView>>({
        url,
        method: 'GET',
        params: { page, size: 10 },
      }),
  });
  const detail = useQuery({
    queryKey: [url, selected],
    enabled: !!selected,
    queryFn: () =>
      customInstance<ApiEnvelope<SettlementDetail>>({
        url: url + '/' + encodeURIComponent(selected),
        method: 'GET',
      }),
  });
  async function mutate(
    path: string,
    data: Record<string, unknown>,
    idempotent = false,
  ) {
    if (held.current) return false;
    held.current = true;
    setBusy(true);
    setError('');
    let saved = false;
    try {
      const fingerprint = path + JSON.stringify(data);
      let key = keys.current.get(fingerprint);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(fingerprint, key);
      }
      await customInstance({
        url: url + path,
        method: 'POST',
        data: idempotent ? { ...data, requestKey: key } : data,
      });
      saved = true;
      keys.current.delete(fingerprint);
      await query.refetch();
      if (selected) await detail.refetch();
      await onChanged();
      return true;
    } catch (e) {
      setError(
        saved
          ? '操作已成功，刷新失败，请刷新台账核对'
          : (e as { response?: { data?: { message?: string } } }).response?.data
              ?.message || '清算操作失败，请重试',
      );
      return saved;
    } finally {
      held.current = false;
      setBusy(false);
    }
  }
  return {
    data: query.data?.data,
    loading: query.isLoading,
    loadError: query.isError,
    page,
    setPage,
    busy,
    error,
    selected,
    setSelected,
    detail: detail.data?.data,
    detailLoading: detail.isFetching,
    detailError: detail.isError,
    refresh: async () => {
      await query.refetch();
      if (selected) await detail.refetch();
    },
    propose: (data: Record<string, unknown>) => mutate('', data, true),
    act: (
      e: SettlementEntry,
      action: string,
      reason: string,
      formData?: Record<string, unknown>,
    ) =>
      mutate('/' + encodeURIComponent(e.id) + '/actions', {
        revision: e.revision,
        action,
        reason,
        formData,
      }),
    evidence: (e: SettlementEntry, data: Record<string, unknown>) =>
      mutate('/' + encodeURIComponent(e.id) + '/evidence', data, true),
    agreementUrl: (e: SettlementEntry) =>
      url + '/' + encodeURIComponent(e.id) + '/agreement',
  };
}
