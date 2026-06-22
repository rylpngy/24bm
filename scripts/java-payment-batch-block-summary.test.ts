import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment batch block summary', () => {
  it('returns batch-level execution block summaries from Java payment batches', () => {
    const domain = read('backend-java/src/main/java/com/procurement/finance/domain/PaymentBatch.java');
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentBatchResponse.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentBatchMapper.java');

    expect(domain).toContain('String executionBlockSummary');
    expect(response).toContain('String executionBlockSummary');
    expect(service).toContain('batch.executionBlockSummary()');
    expect(mapper).toContain('execution_block_summary');
    expect(mapper).toContain('string_agg');
    expect(mapper).toContain('execution_block_reason');
    expect(mapper).toContain("per.execution_status in ('暂不可登记', '付款审批中')");
  });

  it('maps and renders execution block summaries in the buyer payment batch detail', () => {
    const client = read('services/procurementApiClient.ts');
    const clientTest = read('services/procurementApiClient.test.ts');
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(client).toContain('executionBlockSummary?: string | null');
    expect(client).toContain('executionBlockSummary: paymentBatch.executionBlockSummary ?? null');
    expect(clientTest).toContain("executionBlockSummary: '差异未处理'");
    expect(ledgerPanel).toContain('executionBlockSummary: batch.executionBlockSummary');
    expect(ledgerPanel).toContain("executionBlockSummary: '暂无后端阻断概览'");
    expect(ledgerPanel).toContain('阻断概览');
    expect(ledgerPanel).toContain('selectedPaymentBatchBlockSummary');
  });

  it('records the fortieth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第40轮');
    expect(checklist).toContain('付款批次阻断概览 Java API');
    expect(checklist).toContain('scripts/java-payment-batch-block-summary.test.ts');
  });
});
