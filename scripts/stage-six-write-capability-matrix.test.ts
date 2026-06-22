import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six write capability matrix', () => {
  it('documents write capability gaps and the first implementation lane', () => {
    const matrix = read('docs/stage-six-write-capability-matrix.md');
    const checklist = read('docs/stage-six-execution-checklist.md');
    const closeout = read('docs/stage-five-closeout-acceptance-package.md');

    expect(matrix).toContain('# 阶段六真实写入能力实施矩阵');
    expect(matrix).toContain('阶段五收口后，阶段六优先补真实写入能力');
    expect(matrix).toContain('采购需求');
    expect(matrix).toContain('RFQ');
    expect(matrix).toContain('报价定标');
    expect(matrix).toContain('采购订单');
    expect(matrix).toContain('收货验收');
    expect(matrix).toContain('发票付款');
    expect(matrix).toContain('合同管理');
    expect(matrix).toContain('已有 Java 写入');
    expect(matrix).toContain('只有前端入口');
    expect(matrix).toContain('需要补 API');
    expect(matrix).toContain('需要补状态机');
    expect(matrix).toContain('第一实施泳道：采购需求写入补强');
    expect(matrix).toContain('优先从采购需求创建、编辑、提交审批和审批回写开始');
    expect(matrix).toContain('不进入商城、竞价、招标、AI 或真实支付');
    expect(matrix).toContain('npm test -- scripts/stage-six-write-capability-matrix.test.ts');

    expect(closeout).toContain('优先补真实写入能力');
    expect(checklist).toContain('# 阶段六执行清单');
    expect(checklist).toContain('| 1 | 真实写入能力实施矩阵 |');
    expect(checklist).toContain('docs/stage-six-write-capability-matrix.md');
  });
});
