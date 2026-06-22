import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six closeout review', () => {
  it('documents write capability closeout evidence, boundaries, and the stage-seven entry decision', () => {
    const doc = read('docs/stage-six-closeout-review.md');
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(doc).toContain('# 阶段六真实写入能力收口复盘');
    expect(doc).toContain('收口结论');
    expect(doc).toContain('真实写入能力');
    expect(doc).toContain('前端操作边界');
    expect(doc).toContain('仍需保留的边界');
    expect(doc).toContain('验收证据');
    expect(doc).toContain('阶段七建议入口');
    expect(doc).toContain('采购需求提交审批审计');
    expect(doc).toContain('RFQ 截止时间与需求关联并发保护');
    expect(doc).toContain('供应商报价截止与重复写入保护');
    expect(doc).toContain('报价附件边界与定标前报价锁定');
    expect(doc).toContain('定标通过报价收口与重复生成订单边界');
    expect(doc).toContain('订单生成后的 RFQ/报价只读提示');
    expect(doc).toContain('不进入商城、竞价、招标、AI 或真实支付');
    expect(doc).toContain('npm test -- scripts/stage-six-closeout-review.test.ts');
    expect(doc).toContain('Java 模式真实演示闭环');

    expect(checklist).toContain('| 14 | 阶段六真实写入能力收口复盘 |');
    expect(checklist).toContain('docs/stage-six-closeout-review.md');
    expect(checklist).toContain('阶段七建议入口');
  });
});
