import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const checklistPath = join(root, 'docs/stage-three-admin-shell-acceptance-checklist.md');

describe('stage three first-round final acceptance matrix', () => {
  it('documents per-role page status, residual gaps, and second-round readiness', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 七、第一轮最终验收矩阵');
    expect(checklist).toContain('| 端 | 页面 | 第一轮状态 | 仍需补强 | 第二轮处理 |');
    expect(checklist).toContain('| 采购方 | 采购需求 | 可进入第二轮 |');
    expect(checklist).toContain('| 采购方 | 发票付款 | 可进入第二轮 |');
    expect(checklist).toContain('| 平台 | 企业审核 | 可进入第二轮 |');
    expect(checklist).toContain('| 平台 | 平台公告 | 可进入第二轮 |');
    expect(checklist).toContain('| 供应商 | 企业档案 | 需补强 |');
    expect(checklist).toContain('| 供应商 | 发票应收 | 可进入第二轮 |');
    expect(checklist).toContain('第一轮最终结论');
    expect(checklist).toContain('先做 Java 模式逐页联调');
    expect(checklist).toContain('再进入第二轮');
  });
});
