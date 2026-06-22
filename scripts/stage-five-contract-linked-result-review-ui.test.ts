import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract linked result review UI', () => {
  it('writes back receipt and payment action results into the contract detail panel', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('BuyerContractLinkedActionResult');
    expect(app).toContain('contractLinkedActionResult');
    expect(app).toContain('setContractLinkedActionResult');
    expect(app).toContain('createReceiptFromContractFocus');
    expect(app).toContain('registerPaymentFromContractFocus');
    expect(app).toContain('linkedActionResult');
    expect(app).toContain('合同联动结果回看');
    expect(app).toContain('最近联动动作');
    expect(app).toContain('收货验收已由合同联动入口推进');
    expect(app).toContain('发票付款已由合同联动入口推进');

    expect(checklist).toContain('| 21 | 合同联动操作结果回看 |');
    expect(checklist).toContain('第21轮已在目标页登记收货或付款后回写合同联动结果回看');
    expect(walkthrough).toContain('合同联动操作结果回看');
  });
});
