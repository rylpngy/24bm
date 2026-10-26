import { useState } from 'react';
import { ChevronDown, ChevronUp, PackageCheck } from 'lucide-react';
import {
  BuyerMallAfterSalesPanel,
  BuyerMallAfterSalesRequestForm,
} from '../mall/mall-after-sales-panel';

export function OrderAfterSales({
  orderId,
  status,
  lines,
  canPurchase,
}: {
  orderId: string;
  status: string;
  lines: { id: string; quantity: number; description?: string }[];
  canPurchase: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-4"
      aria-label="订单退换货与售后"
    >
      <button
        className="flex min-h-9 w-full items-center justify-between gap-3 text-left font-semibold"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          <PackageCheck size={18} />
          退换货与售后
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="space-y-4 pt-4">
          {canPurchase &&
            ['已发货', '已收货'].includes(status) &&
            lines.length > 0 && (
              <div>
                <button
                  className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-md border border-blue-600 px-3 text-sm text-blue-700"
                  aria-expanded={creating}
                  onClick={() => setCreating(!creating)}
                >
                  {creating ? '收起申请' : '申请退换货 / 维修'}
                </button>
                {creating && (
                  <div className="mt-3 max-w-2xl">
                    <BuyerMallAfterSalesRequestForm
                      orderId={orderId}
                      lines={lines}
                      onSaved={() => setCreating(false)}
                    />
                  </div>
                )}
              </div>
            )}
          <BuyerMallAfterSalesPanel
            orderId={orderId}
            canPurchase={canPurchase}
          />
        </div>
      )}
    </section>
  );
}
