import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five contract archive audit view', () => {
  it('aggregates archived contract evidence into an audit review panel', () => {
    const app = read('App.tsx');
    const checklist = read('docs/stage-five-execution-checklist.md');
    const walkthrough = read('docs/stage-five-java-visual-walkthrough-result.md');
    const smoke = read('scripts/java-local-smoke.mjs');

    expect(app).toContain('contractArchiveAuditEvidenceRows');
    expect(app).toContain('合同归档审计视图');
    expect(app).toContain('归档审计结论');
    expect(app).toContain('审批追溯');
    expect(app).toContain('附件凭证');
    expect(app).toContain('履约事件证据');
    expect(app).toContain('只读边界');

    expect(checklist).toContain('| 25 | 合同归档审计视图 |');
    expect(walkthrough).toContain('合同归档审计视图');
    expect(smoke).toContain('Archived contract audit view evidence');
  });
});
