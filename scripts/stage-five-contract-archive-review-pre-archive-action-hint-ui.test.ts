import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review pre-archive action hint', () => {
  it('maps closeout check results to final archive or blocking actions', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewPreArchiveActionHint');
    expect(app).toContain('归档前确认动作提示');
    expect(app).toContain('归档按钮判断');
    expect(app).toContain('阻断处理路径');
    expect(app).toContain('归档动作提示');
    expect(app).toContain('可点击归档合同按钮');

    expect(checklist).toContain('| 46 | 合同归档前确认动作提示 |');
    expect(walkthrough).toContain('合同归档前确认动作提示');
  });
});
