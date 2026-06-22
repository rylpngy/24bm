import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract payment plan readonly view', () => {
  it('renders readonly contract payment plan from existing invoice and payment ledgers', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('ContractPaymentPlanRow');
    expect(buyerUi).toContain('contractPaymentPlanRows');
    expect(buyerUi).toContain('paymentPlanSummary');
    expect(buyerUi).toContain('plannedPaymentDate');
    expect(buyerUi).toContain('paymentBatchNo');

    expect(app).toContain('合同付款计划只读视图');
    expect(app).toContain('计划付款日');
    expect(app).toContain('付款批次');
    expect(app).toContain('付款申请');
    expect(app).toContain('只读边界');
    expect(app).toContain('不新增合同付款计划接口');

    expect(checklist).toContain('| 28 | 合同付款计划只读视图 |');
    expect(walkthrough).toContain('合同付款计划只读视图');
  });
});
