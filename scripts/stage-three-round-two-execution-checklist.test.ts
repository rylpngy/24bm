import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const checklistPath = join(root, 'docs/stage-three-round-two-execution-checklist.md');

describe('stage three round two execution checklist', () => {
  it('defines the round two scope, priorities, and acceptance gates', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('# 阶段三第二轮执行清单');
    expect(checklist).toContain('从后台雏形进入可操作后台');
    expect(checklist).toContain('采购方主流程优先');
    expect(checklist).toContain('不新增 react-router');
    expect(checklist).toContain('不做商城、竞价、招标、合同和 AI');
    expect(checklist).toContain('Java 模式逐页联调');
    expect(checklist).toContain('npm run java:smoke');
    expect(checklist).toContain('npm test');
    expect(checklist).toContain('npm run build');
  });

  it('lists the first executable task batch for buyer-side deepening', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 第一批执行任务');
    expect(checklist).toContain('采购需求新建/编辑');
    expect(checklist).toContain('RFQ 创建与邀请供应商');
    expect(checklist).toContain('供应商准入资料');
    expect(checklist).toContain('收货验收附件和异常处理');
    expect(checklist).toContain('发票付款对账入口');
    expect(checklist).toContain('详情抽屉和筛选');
  });

  it('records completed round two increments with explicit verification anchors', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 已完成的小步验收记录');
    expect(checklist).toContain('需求预算超限提示');
    expect(checklist).toContain('RFQ 邀请校验');
    expect(checklist).toContain('定标和订单动作校验');
    expect(checklist).toContain('收货和付款登记校验');
    expect(checklist).toContain('审批处理校验');
    expect(checklist).toContain('供应商准入校验');
    expect(checklist).toContain('平台企业审核校验');
    expect(checklist).toContain('平台公告发布校验');
    expect(checklist).toContain('详情筛选摘要');
    expect(checklist).toContain('供应商端筛选摘要');
    expect(checklist).toContain('详情视觉层级');
    expect(checklist).toContain('三端详情层级');
    expect(checklist).toContain('动作按钮反馈');
    expect(checklist).toContain('移动端布局收口');
    expect(checklist).toContain('scripts/buyer-demand-create-form-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-rfq-create-form-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-award-order-action-forms-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-fulfillment-action-forms-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-approval-action-forms-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-supplier-admission-ui.test.ts');
    expect(checklist).toContain('scripts/platform-enterprise-review-actions-ui.test.ts');
    expect(checklist).toContain('scripts/platform-announcement-publish-form-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-detail-filter-summary-ui.test.ts');
    expect(checklist).toContain('scripts/supplier-filter-summary-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-detail-visual-hierarchy-ui.test.ts');
    expect(checklist).toContain('scripts/cross-role-detail-visual-hierarchy-ui.test.ts');
    expect(checklist).toContain('scripts/action-button-feedback-consistency-ui.test.ts');
    expect(checklist).toContain('scripts/mobile-layout-overflow-ui.test.ts');
  });
});
