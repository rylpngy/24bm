import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage ten contract demo command center UI', () => {
  it('lets the reusable demo command center render a stage-ten eyebrow', () => {
    const component = read('components/stageEightDemoPanels.tsx');

    expect(component).toContain('eyebrow?: string');
    expect(component).toContain("{eyebrow ?? '阶段九演示总线'}");
  });

  it('adds a contract-specific stage-ten demo bus with the recommended contract sample', () => {
    const app = read('App.tsx');

    expect(app).toContain('const contractDemoCommandCenterItems: DemoCommandCenterItem[]');
    expect(app).toContain("storyline: '订单生成合同'");
    expect(app).toContain("storyline: '合同审批'");
    expect(app).toContain("storyline: '合同履约事件'");
    expect(app).toContain("storyline: '合同与订单/发票/付款关系'");
    expect(app).toContain('const contractDemoReadinessItems: DemoReadinessItem[]');
    expect(app).toContain('locateContractDemoSample');
    expect(app).toContain('stage10-contract-demo-command-center');
    expect(app).toContain('stage10-contract-demo-readiness');
    expect(app).toContain('阶段十合同演示总线');
    expect(app).toContain('推荐合同样本');
    expect(app).toContain('stage10-demo-sample-contract');
  });

  it('records the third stage-ten increment and keeps the next step product-demo first', () => {
    const checklist = read('docs/stage-ten-execution-checklist.md');

    expect(checklist).toContain('| 3 | 合同演示总线和推荐样本 |');
    expect(checklist).toContain('stage10-contract-demo-command-center');
    expect(checklist).toContain('stage10-demo-sample-contract');
    expect(checklist).toContain('| 4 | 合同演示动作闭环 |');
    expect(checklist).toContain('| 5 | 合同现场讲解脚本和 Java 视觉复跑 |');
    expect(checklist).toContain('| 6 | 阶段十合同演示收口复盘 |');
    expect(checklist).toContain('下一轮建议：回到采购主流程 polish');
  });
});
