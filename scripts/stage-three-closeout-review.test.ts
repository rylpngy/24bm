import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const review = () => readFileSync('docs/stage-three-closeout-review.md', 'utf8');

describe('stage three closeout review', () => {
  it('summarizes stage three completion across buyer supplier and platform workspaces', () => {
    const content = review();

    expect(content).toContain('# 阶段三收口复核');
    expect(content).toContain('当前完成记录：66 个小步增量');
    expect(content).toContain('采购方列表业务接力提示');
    expect(content).toContain('跨角色业务接力提示');
    expect(content).toContain('采购方主流程推进摘要');
    expect(content).toContain('发票付款推进摘要');
    expect(content).toContain('三端后台操作语言已经统一');
    expect(content).toContain('可以进入下一阶段');
  });

  it('records verification commands and remaining product boundaries honestly', () => {
    const content = review();

    expect(content).toContain('npm test');
    expect(content).toContain('npm run build');
    expect(content).toContain('npm run java:smoke');
    expect(content).toContain('curl http://localhost:8080/api/v1/health');
    expect(content).toContain('本轮不进入商城、竞价、招标、合同、AI、ERP 集成');
    expect(content).toContain('不等同于完整生产可用');
    expect(content).toContain('下一阶段建议');
  });
});
