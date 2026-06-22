import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment execution block reason', () => {
  it('persists and returns execution block reasons from Java payment execution records', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V108__payment_execution_block_reason.sql')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V108__payment_execution_block_reason.sql');
    const domain = read('backend-java/src/main/java/com/procurement/finance/domain/PaymentExecutionRecord.java');
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentExecutionRecordResponse.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentExecutionRecordMapper.java');

    expect(migration).toContain('alter table payment_execution_records');
    expect(migration).toContain('execution_block_reason');
    expect(domain).toContain('String executionBlockReason');
    expect(response).toContain('String executionBlockReason');
    expect(service).toContain('record.executionBlockReason()');
    expect(mapper).toContain('execution_block_reason');
    expect(mapper).toContain('left join three_way_matches');
    expect(mapper).toContain('left join variance_handlings');
    expect(mapper).toContain('付款申请未通过');
    expect(mapper).toContain('三单未同步');
    expect(mapper).toContain('差异未处理');
    expect(mapper).toContain('三单未通过');
  });

  it('maps block reasons through the frontend client and batch execution UI', () => {
    const client = read('services/procurementApiClient.ts');
    const app = read('App.tsx');
    const ledgerPanel = app.slice(
      app.indexOf('const ReconciliationLedgerPanel'),
      app.indexOf('const SupplierInvoiceReceivableCard'),
    );

    expect(client).toContain('executionBlockReason?: string | null');
    expect(client).toContain('executionBlockReason: record.executionBlockReason ?? null');
    expect(ledgerPanel).toContain('executionBlockReason: record.executionBlockReason');
    expect(ledgerPanel).toContain('executionBlockReason: executable');
    expect(ledgerPanel).toContain('阻断原因');
    expect(ledgerPanel).toContain('executionBlockReason ??');
  });

  it('records the thirty ninth stage-four finance increment in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第39轮');
    expect(checklist).toContain('付款执行阻断原因 Java API');
    expect(checklist).toContain('scripts/java-payment-execution-block-reason.test.ts');
  });
});
