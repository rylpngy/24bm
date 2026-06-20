import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const reviewPath = join(root, 'docs/stage-three-round-two-review.md');

describe('stage three round two review', () => {
  it('records the current round two completion picture and the next execution decision', () => {
    expect(existsSync(reviewPath)).toBe(true);

    const review = readFileSync(reviewPath, 'utf8');

    expect(review).toContain('# 阶段三第二轮阶段性验收复盘');
    expect(review).toContain('## 当前结论');
    expect(review).toContain('后台可操作雏形已经成立');
    expect(review).toContain('第二轮仍不能直接整体收口');

    expect(review).toContain('## 已完成能力归类');
    expect(review).toContain('| 采购方主流程 |');
    expect(review).toContain('| 平台运营端 |');
    expect(review).toContain('| 供应商协同端 |');
    expect(review).toContain('| 通用后台能力 |');
    expect(review).toContain('27 个小步增量');

    expect(review).toContain('## 仍未收口的缺口');
    expect(review).toContain('Java 模式逐页联调');
    expect(review).toContain('持久化动作边界');
    expect(review).toContain('详情编辑闭环');
    expect(review).toContain('视觉和移动端人工验收');

    expect(review).toContain('## 下一步执行顺序');
    expect(review).toContain('P0：Java 模式逐页联调复核已完成');
    expect(review).toContain('P0：Java 模式逐页联调复核');
    expect(review).toContain('P1：采购方详情编辑闭环');
    expect(review).toContain('采购需求草稿编辑已完成');
    expect(review).toContain('P1：平台和供应商持久化边界补强');
    expect(review).toContain('P2：视觉 QA 和移动端收口');

    expect(review).toContain('## 验收门槛');
    expect(review).toContain('npm test');
    expect(review).toContain('npm run build');
    expect(review).toContain('http://localhost:5173/');
  });
});
