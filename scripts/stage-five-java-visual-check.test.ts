import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage five Java visual walkthrough tooling', () => {
  it('provides a Chrome visual check for buyer contract and main-flow pages', () => {
    const scriptPath = 'scripts/stage-five-java-visual-check.mjs';

    expect(existsSync(scriptPath)).toBe(true);

    const script = read(scriptPath);
    expect(script).toContain('stage-five-java-visual-check');
    expect(script).toContain('--screenshot=');
    expect(script).toContain('--dump-dom');
    expect(script).toContain('role=buyer&module=contracts');
    expect(script).toContain('role=buyer&module=rfqs');
    expect(script).toContain('role=buyer&module=orders');
    expect(script).toContain('role=buyer&module=invoices');
    expect(script).toContain('合同台账');
    expect(script).toContain('Java 合同台账');
    expect(script).toContain('询价项目');
    expect(script).toContain('采购订单');
    expect(script).toContain('发票付款');
    expect(script).toContain('argument type mismatch');
    expect(script).toContain('React runtime error');
    expect(script).toContain('stage-five-java-visual-check-result.json');
  });

  it('records the stage-five Java visual walkthrough result and checklist entry', () => {
    const docPath = 'docs/stage-five-java-visual-walkthrough-result.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(doc).toContain('# 阶段五 Java 模式视觉验收结果');
    expect(doc).toContain('合同管理');
    expect(doc).toContain('询价项目');
    expect(doc).toContain('采购订单');
    expect(doc).toContain('发票付款');
    expect(doc).toContain('桌面 1280x720');
    expect(doc).toContain('移动 390x844');
    expect(doc).toContain('docs/artifacts/stage-five-java-contracts-desktop-1280x720.png');
    expect(doc).toContain('docs/artifacts/stage-five-java-contracts-mobile-390x844.png');
    expect(doc).toContain('无加载失败');
    expect(doc).toContain('无 `argument type mismatch`');
    expect(doc).toContain('无 React runtime error');
    expect(doc).toContain('stage-five-java-visual-check-result.json');

    expect(checklist).toContain('| 6 | 合同管理 Java 视觉验收 |');
    expect(checklist).toContain('docs/stage-five-java-visual-walkthrough-result.md');
    expect(checklist).toContain('scripts/stage-five-java-visual-check.test.ts');
  });
});
