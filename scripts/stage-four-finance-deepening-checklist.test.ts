import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

describe('stage four finance deepening checklist', () => {
  it('tracks the first finance deepening increment and boundaries', () => {
    const checklistPath = 'docs/stage-four-finance-deepening-checklist.md';
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');
    expect(checklist).toContain('# 阶段四财务协同深化执行清单');
    expect(checklist).toContain('三单匹配摘要');
    expect(checklist).toContain('对账台账匹配结论');
    expect(checklist).toContain('付款边界提示');
    expect(checklist).toContain('三单异常联动差异处理');
    expect(checklist).toContain('不接入新的业务域 Java API');
    expect(checklist).toContain('scripts/buyer-three-way-match-ui.test.ts');
    expect(checklist).toContain('scripts/java-three-way-match-variance-link.test.ts');
  });
});
