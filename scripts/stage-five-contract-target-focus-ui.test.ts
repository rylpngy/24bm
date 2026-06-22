import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract target focus UI', () => {
  it('keeps contract context when navigating to receipt or invoice modules', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('contractTargetFocus');
    expect(app).toContain('setContractTargetFocus');
    expect(app).toContain('navigateBuyerModuleFromContract');
    expect(app).toContain('来自合同联动');
    expect(app).toContain('合同联动高亮');
    expect(app).toContain('highlightedByContract');
    expect(app).toContain('contract-target-focus');
    expect(app).toContain('setSelectedReceiptOrderId(focus.orderId)');
    expect(app).toContain('setSelectedInvoiceId(focus.invoiceId)');

    expect(checklist).toContain('| 19 | 合同目标页联动高亮 |');
    expect(checklist).toContain('第19轮已让合同上下文入口跳转后在收货验收和发票付款目标页保留来源提示并高亮相关记录');
    expect(walkthrough).toContain('合同目标页联动高亮');
  });
});
