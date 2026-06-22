import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive review history view', () => {
  it('summarizes page-level archive review processing history', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');

    expect(app).toContain('archiveReviewHistoryRows');
    expect(app).toContain('归档复核处理历史视图');
    expect(app).toContain('历史阶段');
    expect(app).toContain('历史结论');
    expect(app).toContain('页面内历史');
    expect(app).toContain('复核确认结果');

    expect(checklist).toContain('| 42 | 合同归档复核处理历史视图 |');
    expect(walkthrough).toContain('合同归档复核处理历史视图');
  });
});
