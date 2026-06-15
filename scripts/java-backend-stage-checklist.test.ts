import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const checklistPath = join(root, 'docs/java-backend-stage-checklist.md');

describe('Java backend stage checklist', () => {
  it('documents the current fulfillment, invoice, and payment guardrails', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('# Java 后端阶段性检查清单');
    expect(checklist).toContain('待供应商确认 -> 待发货 -> 已发货 -> 已收货');
    expect(checklist).toContain('同一采购订单只能登记一条发货记录');
    expect(checklist).toContain('同一采购订单只能登记一条收货记录');
    expect(checklist).toContain('同一采购订单只能登记一张发票');
    expect(checklist).toContain('发票金额必须等于采购订单金额');
    expect(checklist).toContain('付款登记前会重新校验发票金额仍等于采购订单金额');
    expect(checklist).toContain('黑名单');
    expect(checklist).toContain('`部分付款` 可补登记为 `已付款`');
    expect(checklist).toContain('重复登记当前 `部分付款` / `已付款` 状态幂等返回');
    expect(checklist).toContain('`已付款` 不允许回退为 `部分付款`');
    expect(checklist).toContain('三单匹配');
    expect(checklist).toContain('后续迭代入口');
  });
});
