import { useState } from 'react';
import {
  useOrderSettlement,
  type SettlementEntry,
} from '@24bid/api-client/order-settlement';
import { axiosInstance } from '@24bid/api-client';
import { OrderSettlementPanel } from '@24bid/ui/components/order-settlement-panel';
export function SupplierOrderSettlement({
  orderId,
  canManage,
  refresh,
}: {
  orderId: string;
  canManage: boolean;
  refresh: () => unknown;
}) {
  const s = useOrderSettlement('supplier', orderId, refresh),
    [error, setError] = useState('');
  async function download(e: SettlementEntry) {
    setError('');
    try {
      const r = await axiosInstance.get(s.agreementUrl(e), {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = e.agreementName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('清算协议下载失败，请重试');
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      )}
      <OrderSettlementPanel
        state={s}
        supplier
        canManage={canManage}
        onAgreement={(e) => void download(e)}
      />
    </>
  );
}
