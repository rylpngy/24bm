import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract target action loop UI', () => {
  it('adds contract source confirmation into focused receipt and payment action forms', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('contractActionGuard');
    expect(app).toContain('合同来源确认');
    expect(app).toContain('目标单据已锁定');
    expect(app).toContain('仅处理当前合同关联订单');
    expect(app).toContain('仅处理当前合同关联发票');
    expect(app).toContain('receiptContractTargetFocus.contractNo');
    expect(app).toContain('invoiceContractTargetFocus.contractNo');

    expect(checklist).toContain('| 20 | 合同目标页上下文操作闭环 |');
    expect(checklist).toContain('第20轮已在目标页快捷收货和快捷付款表单中补充合同来源确认与目标单据锁定提示');
    expect(walkthrough).toContain('合同目标页上下文操作闭环');
  });
});
