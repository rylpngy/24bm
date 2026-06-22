import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('payment batch archive freeze feedback', () => {
  it('maps archived payment batch backend errors to a buyer-facing Chinese workflow notice', () => {
    const app = read('App.tsx');

    expect(app).toContain('const formatWorkflowError');
    expect(app).toContain('Payment batch is archived and can only be audited');
    expect(app).toContain('付款批次已归档，当前操作已按只读冻结规则拒绝');
    expect(app).toContain("formatWorkflowError(error, '付款执行记录登记失败')");
    expect(app).toContain("formatWorkflowError(error, '付款申请状态更新失败')");
    expect(app).toContain("formatWorkflowError(error, '差异处理状态更新失败')");
    expect(app).toContain("formatWorkflowError(error, '付款阻断处理状态保存失败')");
  });

  it('treats archive freeze and rejected actions as error feedback rather than success feedback', () => {
    const app = read('App.tsx');

    expect(app).toContain("message.includes('拒绝')");
    expect(app).toContain("message.includes('冻结')");
    expect(app).toContain("message.includes('不允许')");
  });

  it('documents the seventy seventh stage-four finance increment', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 77 | 付款批次归档冻结反馈 |');
    expect(checklist).toContain('scripts/payment-batch-archive-freeze-feedback.test.ts');
    expect(checklist).toContain('归档冻结拒绝提示');
  });
});
