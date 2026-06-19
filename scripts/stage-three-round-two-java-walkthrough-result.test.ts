import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const resultPath = join(root, 'docs/stage-three-round-two-java-walkthrough-result.md');

describe('stage three round two Java walkthrough result', () => {
  it('records Java-mode verification for round two screens and remaining boundaries', () => {
    expect(existsSync(resultPath)).toBe(true);

    const result = readFileSync(resultPath, 'utf8');

    expect(result).toContain('# 阶段三第二轮 Java 模式逐页联调结果');
    expect(result).toContain('## 本次环境');
    expect(result).toContain('http://localhost:8080');
    expect(result).toContain('http://localhost:3000/');
    expect(result).toContain('npm run java:smoke');
    expect(result).toContain('Java local API smoke passed');

    expect(result).toContain('## 第二轮新增能力复核');
    expect(result).toContain('详情面板');
    expect(result).toContain('筛选摘要');
    expect(result).toContain('动作表单');
    expect(result).toContain('附件中心入口');
    expect(result).toContain('消息中心入口');
    expect(result).toContain('权限差异提示');

    expect(result).toContain('## 逐页复核矩阵');
    expect(result).toContain('| 采购方 | 采购需求 |');
    expect(result).toContain('| 采购方 | 询价项目 |');
    expect(result).toContain('| 采购方 | 发票付款 |');
    expect(result).toContain('| 平台 | 企业审核 |');
    expect(result).toContain('| 平台 | 平台公告 |');
    expect(result).toContain('| 供应商 | 企业档案 |');
    expect(result).toContain('| 供应商 | 发票应收 |');

    expect(result).toContain('## 未收口边界');
    expect(result).toContain('平台公告编辑/撤回仍是前端生命周期入口');
    expect(result).toContain('租户功能开关详情仍以说明和只读核对为主');
    expect(result).toContain('供应商档案维护入口尚未完成 Java 持久化闭环');

    expect(result).toContain('## 结论');
    expect(result).toContain('第二轮可以继续进入 P1');
  });
});
