import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six demand write hardening plan', () => {
  it('documents demand write paths, boundaries, and the next implementation slice', () => {
    const plan = read('docs/stage-six-demand-write-hardening-plan.md');
    const checklist = read('docs/stage-six-execution-checklist.md');
    const matrix = read('docs/stage-six-write-capability-matrix.md');

    expect(plan).toContain('# 阶段六采购需求写入补强计划');
    expect(plan).toContain('采购需求创建');
    expect(plan).toContain('采购需求编辑');
    expect(plan).toContain('提交审批');
    expect(plan).toContain('审批通过');
    expect(plan).toContain('审批驳回');
    expect(plan).toContain('审批中禁改');
    expect(plan).toContain('已通过创建 RFQ');
    expect(plan).toContain('POST /api/v1/buyer/demands');
    expect(plan).toContain('PUT /api/v1/buyer/demands/{demandId}');
    expect(plan).toContain('POST /api/v1/buyer/demands/{demandId}/submit');
    expect(plan).toContain('POST /api/v1/buyer/demands/{demandId}/approval');
    expect(plan).toContain('Only draft purchase demand can be updated');
    expect(plan).toContain('第3轮建议：采购需求写入验收测试补强');
    expect(plan).toContain('npm test -- scripts/stage-six-demand-write-hardening-plan.test.ts');

    expect(matrix).toContain('第一实施泳道：采购需求写入补强');
    expect(checklist).toContain('| 2 | 采购需求写入补强计划 |');
    expect(checklist).toContain('docs/stage-six-demand-write-hardening-plan.md');
  });
});
