import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const checklistPath = join(root, 'docs/stage-three-round-two-execution-checklist.md');

describe('stage three round two execution checklist', () => {
  it('defines the round two scope, priorities, and acceptance gates', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('# 阶段三第二轮执行清单');
    expect(checklist).toContain('从后台雏形进入可操作后台');
    expect(checklist).toContain('采购方主流程优先');
    expect(checklist).toContain('不新增 react-router');
    expect(checklist).toContain('不做商城、竞价、招标、合同和 AI');
    expect(checklist).toContain('Java 模式逐页联调');
    expect(checklist).toContain('npm run java:smoke');
    expect(checklist).toContain('npm test');
    expect(checklist).toContain('npm run build');
  });

  it('lists the first executable task batch for buyer-side deepening', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 第一批执行任务');
    expect(checklist).toContain('采购需求新建/编辑');
    expect(checklist).toContain('RFQ 创建与邀请供应商');
    expect(checklist).toContain('供应商准入资料');
    expect(checklist).toContain('收货验收附件和异常处理');
    expect(checklist).toContain('发票付款对账入口');
    expect(checklist).toContain('详情抽屉和筛选');
  });
});
