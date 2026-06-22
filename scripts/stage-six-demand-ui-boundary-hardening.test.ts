import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('stage six demand UI boundary hardening', () => {
  it('explains demand write boundaries for approval lock, duplicate submit, RFQ readiness, and Java errors', () => {
    const app = read('App.tsx');
    const demandDetail = app.slice(
      app.indexOf('const DemandDetailPanelView'),
      app.indexOf('const ApprovalReviewForm'),
    );

    expect(demandDetail).toContain('采购需求写入边界');
    expect(demandDetail).toContain('审批中禁改提示');
    expect(demandDetail).toContain('审批中需求已锁定编辑，待审批通过或驳回后再继续处理。');
    expect(demandDetail).toContain('重复提交保护');
    expect(demandDetail).toContain('提交审批请求处理中，请等待 Java 返回后再继续操作。');
    expect(demandDetail).toContain('已通过创建 RFQ 准备提示');
    expect(demandDetail).toContain('请先确认已准入供应商、报价截止时间和重复创建风险。');
    expect(demandDetail).toContain('Java 错误反馈文案');
    expect(demandDetail).toContain('若 Java 写入失败，顶部流程提示会展示服务端返回的错误信息。');
  });

  it('records the fifth stage-six increment in the execution checklist', () => {
    const checklist = read('docs/stage-six-execution-checklist.md');

    expect(checklist).toContain('| 5 | 采购需求前端 UI 边界补强 |');
    expect(checklist).toContain('scripts/stage-six-demand-ui-boundary-hardening.test.ts');
    expect(checklist).toContain('审批中禁改提示');
    expect(checklist).toContain('重复提交保护');
    expect(checklist).toContain('Java 错误反馈文案');
  });
});
