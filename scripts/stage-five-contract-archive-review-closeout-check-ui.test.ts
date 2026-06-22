import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review closeout check', () => {
  it('summarizes confirmation, risk resolution, and server archive gate before closeout', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewCloseoutCheck');
    expect(app).toContain('归档复核关闭前检查条');
    expect(app).toContain('页面确认状态');
    expect(app).toContain('风险解除入口');
    expect(app).toContain('服务端归档门禁');
    expect(app).toContain('最终归档仍以服务端门禁为准');

    expect(checklist).toContain('| 45 | 合同归档复核关闭前检查条 |');
    expect(walkthrough).toContain('合同归档复核关闭前检查条');
  });
});
