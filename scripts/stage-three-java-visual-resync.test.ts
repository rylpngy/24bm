import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const javaWalkthrough = () => readFileSync('docs/stage-three-round-two-java-walkthrough-result.md', 'utf8');
const closeoutReview = () => readFileSync('docs/stage-three-closeout-review.md', 'utf8');

describe('stage three Java visual resync after buyer payment progress summary', () => {
  it('records the latest Java visual evidence for the buyer invoice payment progress summary', () => {
    const result = javaWalkthrough();

    expect(result).toContain('## 2026-06-20 发票付款推进摘要 Java 视觉复核');
    expect(result).toContain('role=buyer&module=invoices');
    expect(result).toContain('发票付款推进摘要');
    expect(result).toContain('待开票');
    expect(result).toContain('待对账');
    expect(result).toContain('差异待处理');
    expect(result).toContain('待付款');
    expect(result).toContain('已付款');
    expect(result).toContain('stage-four-java-visual-check-result.json');
    expect(result).toContain('无 `argument type mismatch`');
    expect(result).toContain('无 React runtime error');
  });

  it('updates the stage three closeout review to the sixty sixth checklist increment', () => {
    const review = closeoutReview();

    expect(review).toContain('当前完成记录：66 个小步增量');
    expect(review).toContain('发票付款推进摘要');
    expect(review).toContain('待开票、待对账、差异待处理、待付款和已付款');
    expect(review).toContain('最近一次 Java 视觉补跑记录');
    expect(review).toContain('role=buyer&module=invoices');
    expect(review).not.toContain('当前完成记录：60 个小步增量');
  });
});
