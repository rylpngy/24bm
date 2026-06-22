import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage four Java visual check tooling', () => {
  it('provides a dependency-free Chrome visual walkthrough script for finance pages', () => {
    const scriptPath = 'scripts/stage-four-java-visual-check.mjs';

    expect(existsSync(scriptPath)).toBe(true);

    const script = read(scriptPath);
    expect(script).toContain('stage-four-java-visual-check');
    expect(script).toContain('--screenshot=');
    expect(script).toContain('--dump-dom');
    expect(script).toContain('dumpDomWithRetry');
    expect(script).toContain('isDomReadyForFinanceCheck');
    expect(script).toContain('DOM check retry');
    expect(script).toContain('role=buyer&module=invoices');
    expect(script).toContain('处理记录台账');
    expect(script).toContain('ensurePaymentBlockResolutionRecord');
    expect(script).toContain('Java visual smoke 阻断处理记录');
    expect(script).toContain('hasResolutionLedgerRecord');
    expect(script).toContain('hasExecutionReviewHint');
    expect(script).toContain('执行复核提示');
    expect(script).toContain('hasReviewActionList');
    expect(script).toContain('复核动作清单');
    expect(script).toContain('hasThreeWayRebuildAction');
    expect(script).toContain('刷新三单匹配');
    expect(script).toContain('hasExecutionRefreshAction');
    expect(script).toContain('刷新执行复核');
    expect(script).toContain('hasRegistrationGate');
    expect(script).toContain('登记前置条件');
    expect(script).toContain('hasRegistrationAction');
    expect(script).toContain('登记付款状态');
    expect(script).toContain('hasRegistrationPostActionHint');
    expect(script).toContain('登记后复核提示');
    expect(script).toContain('hasRegistrationReviewSummary');
    expect(script).toContain('登记后复核摘要');
    expect(script).toContain('hasArchiveAuditPanel');
    expect(script).toContain('归档审计面板');
    expect(script).toContain('hasArchiveAuditHandoff');
    expect(script).toContain('审计追踪入口');
    expect(script).toContain('hasPendingVarianceCount');
    expect(script).toContain('待处理差异数量');
    expect(script).toContain('hasPendingPaymentRequestCount');
    expect(script).toContain('待复核付款申请');
    expect(script).toContain('发票付款');
    expect(script).toContain('stage-four-java-visual-check-result.json');
    expect(script).toContain('Failed to fetch');
  });

  it('records the fifty sixth stage-four Java visual walkthrough in docs and checklist', () => {
    const docPath = 'docs/stage-four-java-visual-walkthrough-result.md';

    expect(existsSync(docPath)).toBe(true);

    const doc = read(docPath);
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(doc).toContain('# 阶段四 Java 模式视觉验收结果');
    expect(doc).toContain('第56轮');
    expect(doc).toContain('第58轮');
    expect(doc).toContain('第79轮');
    expect(doc).toContain('付款批次详情');
    expect(doc).toContain('归档审计面板');
    expect(doc).toContain('审计追踪入口');
    expect(doc).toContain('处理记录台账');
    expect(doc).toContain('Java visual smoke 阻断处理记录');
    expect(doc).toContain('桌面 1280x720');
    expect(doc).toContain('移动 390x844');
    expect(doc).toContain('docs/artifacts/stage-four-java-desktop-1280x720.png');
    expect(doc).toContain('docs/artifacts/stage-four-java-mobile-390x844.png');
    expect(doc).toContain('无加载失败');
    expect(doc).toContain('无 `Failed to fetch`');
    expect(doc).toContain('无 `argument type mismatch`');
    expect(doc).toContain('无 React runtime error');
    expect(doc).toContain('移动截图未见整页横向溢出');
    expect(doc).toContain('Java local API health passed at http://localhost:8080');
    expect(doc).toContain('scripts/stage-four-java-visual-check.mjs');
    expect(doc).toContain('stage-four-java-visual-check-result.json');

    expect(checklist).toContain('第56轮');
    expect(checklist).toContain('| 58 | 付款阻断处理记录非空回显 |');
    expect(checklist).toContain('| 79 | Java 模式归档审计面板视觉验收 |');
    expect(checklist).toContain('Java 模式付款批次视觉验收');
    expect(checklist).toContain('docs/stage-four-java-visual-walkthrough-result.md');
    expect(checklist).toContain('scripts/stage-four-java-visual-check.test.ts');
  });
});
