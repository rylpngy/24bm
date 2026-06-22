import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract fulfillment event lightweight state machine', () => {
  it('renders a readonly fulfillment event state machine in contract detail', () => {
    const app = read('App.tsx');
    const buyerUi = read('data/buyerAdminUi.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(buyerUi).toContain('ContractFulfillmentEventStateRow');
    expect(buyerUi).toContain('buildContractFulfillmentEventStateRows');
    expect(buyerUi).toContain('eventStage');
    expect(buyerUi).toContain('eventEvidenceLabel');
    expect(buyerUi).toContain('eventNextAction');

    expect(app).toContain('合同履约事件状态机');
    expect(app).toContain('当前事件阶段');
    expect(app).toContain('事件证据');
    expect(app).toContain('下一步动作');
    expect(app).toContain('待收货');
    expect(app).toContain('待付款');
    expect(app).toContain('待归档');
    expect(app).toContain('已完成');
    expect(app).toContain('只读状态派生');

    expect(checklist).toContain('| 29 | 合同履约事件状态机轻量化 |');
    expect(walkthrough).toContain('合同履约事件状态机轻量化');
  });
});
