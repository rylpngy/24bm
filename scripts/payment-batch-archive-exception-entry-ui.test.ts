import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive exception entry', () => {
  it('adds a frontend contract for archive exception requests without unfreezing archived batches', () => {
    const client = read('services/procurementApiClient.ts');
    const contract = read('data/apiContract.ts');

    expect(client).toContain('export interface PaymentArchiveExceptionRequestRecord');
    expect(client).toContain('exceptionType: string');
    expect(client).toContain('exceptionReason: string');
    expect(client).toContain('approvalStatus: string');
    expect(client).toContain('actionStatus: string');
    expect(client).toContain('actionResult?: string | null');
    expect(client).toContain('handledBy?: string | null');
    expect(client).toContain('closureStatus: string');
    expect(client).toContain('closureResult?: string | null');
    expect(client).toContain('closedBy?: string | null');
    expect(client).toContain('ListBuyerPaymentArchiveExceptionRequestsParams');
    expect(client).toContain('CreatePaymentArchiveExceptionRequestPayload');
    expect(client).toContain('listBuyerPaymentArchiveExceptionRequests');
    expect(client).toContain('createBuyerPaymentArchiveExceptionRequest');
    expect(client).toContain('reviewBuyerPaymentArchiveExceptionRequest');
    expect(client).toContain('completeBuyerPaymentArchiveExceptionAction');
    expect(client).toContain('closeBuyerPaymentArchiveExceptionRequest');
    expect(client).toContain('/api/v1/buyer/payment-archive-exception-requests');

    expect(contract).toContain("path: '/buyer/payment-archive-exception-requests'");
    expect(contract).toContain('采购方为已归档付款批次提交归档异常申请');
    expect(contract).toContain('审批付款归档异常申请，只回写申请审批状态');
    expect(contract).toContain('登记付款归档异常受控处理动作');
    expect(contract).toContain('关闭付款归档异常申请');
    expect(contract).toContain('加载采购方付款归档异常申请台账');
    expect(contract).toContain('BuyerPaymentArchiveExceptionRequestList');
  });

  it('surfaces the archive exception request entry in the payment batch archive audit panel', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(app).toContain('selectedPaymentBatchArchiveExceptionRows');
    expect(app).toContain('paymentArchiveExceptionRequests');
    expect(app).toContain('onCreatePaymentArchiveExceptionRequest');
    expect(app).toContain('createBuyerPaymentArchiveExceptionRequest');
    expect(app).toContain("approval.bizType === 'payment_archive_exception'");
    expect(app).toContain('reviewBuyerPaymentArchiveExceptionRequest');
    expect(app).toContain('completeBuyerPaymentArchiveExceptionAction');
    expect(app).toContain('closeBuyerPaymentArchiveExceptionRequest');
    expect(app).toContain('登记受控处理');
    expect(app).toContain('关闭复核');
    expect(app).toContain('受控处理状态');
    expect(app).toContain('关闭状态');
    expect(app).toContain("request.approvalStatus === '已通过'");
    expect(app).toContain("request.actionStatus === '已登记受控处理'");
    expect(app).toContain('payment-archive-exception:');
    expect(app).toContain('归档异常申请');
    expect(app).toContain('撤销申请');
    expect(app).toContain('异常解冻');
    expect(app).toContain('提交撤销申请');
    expect(app).toContain('提交异常解冻');
    expect(app).toContain('归档异常申请台账');
    expect(app).toContain('归档异常申请已提交');
    expect(app).toContain('异常入口边界');
    expect(app).toContain('归档异常只进入审批台账，不直接解冻或改写已归档批次');
    expect(app).toContain('归档异常申请入口');

    expect(checklist).toContain('| 82 | 付款归档异常申请入口 |');
    expect(checklist).toContain('第82轮已新增付款归档异常申请的前端契约和归档审计面板入口');
    expect(checklist).toContain('| 84 | 付款归档异常申请前端提交联动 |');
    expect(checklist).toContain('第84轮已将归档异常申请入口接入 Java POST 台账');
    expect(checklist).toContain('| 87 | 付款归档异常受控处理入口 |');
    expect(checklist).toContain('第87轮已新增付款归档异常受控处理入口');
    expect(checklist).toContain('| 88 | 付款归档异常关闭复核 |');
    expect(checklist).toContain('第88轮已新增付款归档异常关闭复核');
    expect(checklist).toContain('scripts/payment-batch-archive-exception-entry-ui.test.ts');
  });
});
