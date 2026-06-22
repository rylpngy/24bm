import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage seven Java browser recheck result', () => {
  it('records the ninth stage-seven increment as Java browser recheck', () => {
    const checklist = read('docs/stage-seven-execution-checklist.md');
    const walkthrough = read('docs/stage-seven-browser-walkthrough-result.md');

    expect(checklist).toContain('| 9 | Java 模式真实浏览器复跑第一轮 |');
    expect(checklist).toContain('docs/artifacts/stage-seven-java-browser-recheck-result.json');
    expect(checklist).toContain('供应商侧协同演示补强');

    expect(walkthrough).toContain('## Java 模式真实浏览器复跑');
    expect(walkthrough).toContain('14 个页面 / 视口组合失败项为 0');
    expect(walkthrough).toContain('无整页横向溢出');
    expect(walkthrough).toContain('浏览器控制台 error 为 0');
    expect(walkthrough).toContain('截图接口在当前 in-app browser 会话中超时');
  });

  it('keeps a JSON artifact for the Java browser recheck evidence', () => {
    const resultPath = 'docs/artifacts/stage-seven-java-browser-recheck-result.json';

    expect(existsSync(resultPath)).toBe(true);

    const result = JSON.parse(read(resultPath));

    expect(result.appBaseUrl).toBe('http://localhost:3000');
    expect(result.javaApiBaseUrl).toBe('http://localhost:8080');
    expect(result.failed).toEqual([]);
    expect(result.results).toHaveLength(14);
    expect(result.results.every((item: { metrics: { hasDemoWalkthroughRail: boolean } }) => item.metrics.hasDemoWalkthroughRail)).toBe(true);
    expect(result.results.every((item: { metrics: { hasWholePageHorizontalOverflow: boolean } }) => !item.metrics.hasWholePageHorizontalOverflow)).toBe(true);
    expect(result.results.every((item: { consoleErrors: unknown[] }) => item.consoleErrors.length === 0)).toBe(true);
  });
});
