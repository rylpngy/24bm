import { useState } from 'react';
import {
  useOrderSettlement,
  type SettlementEntry,
} from '@24bid/api-client/order-settlement';
import { axiosInstance, useAttachmentList } from '@24bid/api-client';
import { OrderSettlementPanel } from '@24bid/ui/components/order-settlement-panel';
import { OwnerAttachments } from '../attachments/owner-attachments';
import { WorkflowSubmitDialog } from '../workflow/workflow-submit-dialog';
import { WorkflowStatusPanel } from '../workflow/workflow-instance-panel';
export function BuyerOrderSettlement({
  orderId,
  canManage,
  canContractManage = true,
  canFinance,
  refresh,
}: {
  orderId: string;
  canManage: boolean;
  canContractManage?: boolean;
  canFinance: boolean;
  refresh: () => unknown;
}) {
  const s = useOrderSettlement('buyer', orderId, refresh),
    files = useAttachmentList({
      ownerType: 'order_settlement_document',
      ownerId: orderId,
    });
  const [submit, setSubmit] = useState<{
      entry: SettlementEntry;
      reason: string;
    } | null>(null),
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
        canManage={canManage}
        canContractManage={canContractManage}
        canFinance={canFinance}
        attachments={
          <OwnerAttachments
            ownerType="order_settlement_document"
            ownerId={orderId}
            title="清算协议与凭证原件"
          />
        }
        attachmentOptions={(files.data?.data ?? []).map((x) => ({
          id: x.id!,
          fileName: x.fileName!,
        }))}
        onSubmit={(entry, reason) => setSubmit({ entry, reason })}
        onAgreement={(e) => void download(e)}
        workflow={(e) =>
          e.workflowInstanceId ? (
            <WorkflowStatusPanel
              businessType="order_settlement"
              businessId={e.id}
              hideBusinessSnapshot
            />
          ) : null
        }
      />
      {submit && (
        <WorkflowSubmitDialog
          businessType="order_settlement"
          title="提交合同解除与订单清算审批"
          busy={s.busy}
          submissionError={s.error ? new Error(s.error) : null}
          onClose={() => setSubmit(null)}
          onSubmit={async (formData) => {
            if (await s.act(submit.entry, 'submit', submit.reason, formData))
              setSubmit(null);
          }}
        />
      )}
    </>
  );
}
