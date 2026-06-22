import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment execution state machine contract', () => {
  it('derives execution stage and next action in Java payment execution responses', () => {
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentExecutionRecordResponse.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');

    expect(response).toContain('String executionStage');
    expect(response).toContain('String executionNextAction');
    expect(service).toContain('derivePaymentExecutionStage');
    expect(service).toContain('derivePaymentExecutionNextAction');
    expect(service).toContain('record.executionStatus()');
    expect(service).toContain('record.executionBlockReason()');
    expect(service).toContain('刷新执行记录后归档审计');
    expect(service).toContain('登记付款状态，真实支付仍不接入');
    expect(service).toContain('按阻断原因处理后刷新执行复核');
  });

  it('maps the state machine fields through the frontend client and execution UI', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(client).toContain('executionStage?: string | null');
    expect(client).toContain('executionNextAction?: string | null');
    expect(client).toContain('executionStage: record.executionStage ?? null');
    expect(client).toContain('executionNextAction: record.executionNextAction ?? null');
    expect(ledgerPanel).toContain('executionStage: record.executionStage');
    expect(ledgerPanel).toContain('executionNextAction: record.executionNextAction');
    expect(ledgerPanel).toContain("row.executionNextAction ?? '归档审计轨迹'");
    expect(ledgerPanel).toContain("row.executionNextAction ?? '登记付款状态，真实支付仍不接入'");
    expect(ledgerPanel).toContain("row.executionNextAction ?? '按阻断原因处理后刷新执行复核'");
    expect(ledgerPanel).toContain('执行阶段');
    expect(ledgerPanel).toContain('下一处理动作');
  });

  it('records the seventy second stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 72 | 付款执行状态机只读契约 |');
    expect(checklist).toContain('executionStage');
    expect(checklist).toContain('executionNextAction');
    expect(checklist).toContain('scripts/payment-execution-state-machine-contract.test.ts');
  });
});
