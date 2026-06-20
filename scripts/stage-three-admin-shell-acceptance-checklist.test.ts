import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const checklistPath = join(root, 'docs/stage-three-admin-shell-acceptance-checklist.md');

describe('stage three admin shell acceptance checklist', () => {
  it('documents the first-round three-role admin shell acceptance baseline', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('# 阶段三第一轮后台雏形验收清单');
    expect(checklist).toContain('采购方企业端');
    expect(checklist).toContain('平台运营端');
    expect(checklist).toContain('供应商企业端');
    expect(checklist).toContain('PlatformTenantListSummaryPanel');
    expect(checklist).toContain('PlatformEnterpriseReviewSummaryPanel');
    expect(checklist).toContain('PlatformEnterpriseReviewCard');
    expect(checklist).toContain('PlatformAnnouncementSummaryPanel');
    expect(checklist).toContain('PlatformAnnouncementCard');
    expect(checklist).toContain('SupplierOpportunityResponseSummaryPanel');
    expect(checklist).toContain('SupplierOrderActionSummaryPanel');
    expect(checklist).toContain('SupplierInvoiceReceivableSummaryPanel');
    expect(checklist).toContain('npm run build');
    expect(checklist).toContain('npm test');
    expect(checklist).toContain('浏览器验收');
    expect(checklist).toContain('第二轮');
  });

  it('documents first-round UI polish gates before moving to round two', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 八、第一轮 UI 收尾验收');
    expect(checklist).toContain('移动端顶部角色/模块导航');
    expect(checklist).toContain('去除生产页面占位文案');
    expect(checklist).toContain('采购方列表详情并排延后到 2xl');
    expect(checklist).toContain('通用卡片小屏换行');
    expect(checklist).toContain('响应式表格摘要卡片');
    expect(checklist).toContain('采购方定标和订单动作表单化');
    expect(checklist).toContain('供应商准入动作表单化');
    expect(checklist).toContain('审批处理动作表单化');
    expect(checklist).toContain('订单收货和发票付款详情动作表单化');
    expect(checklist).toContain('快捷操作草稿保护');
    expect(checklist).toContain('快捷操作面板统一');
    expect(checklist).toContain('列表工具条提示优化');
    expect(checklist).toContain('状态筛选组件优化');
    expect(checklist).toContain('流程状态提示语义优化');
    expect(checklist).toContain('共享视觉原语收口');
    expect(checklist).toContain('BuyerAwardDraft');
    expect(checklist).toContain('BuyerSupplierAdmissionDraft');
    expect(checklist).toContain('BuyerApprovalReviewDraft');
    expect(checklist).toContain('ReceiptRegistrationForm');
    expect(checklist).toContain('PaymentRegistrationForm');
    expect(checklist).toContain('scripts/buyer-fulfillment-action-forms-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-fulfillment-list-card-ui.test.ts');
    expect(checklist).toContain('scripts/buyer-workflow-status-filters-ui.test.ts');
    expect(checklist).toContain('scripts/stage-three-first-round-ui-polish.test.ts');
    expect(checklist).toContain('ProcessStateNotice');
    expect(checklist).toContain('第一轮收口结论：可以进入第二轮，但第二轮开始前应保留 Java 模式逐页联调作为回归门槛。');
  });

  it('records the browser visual QA pass for the final first-round polish', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 九、第一轮浏览器视觉复核记录');
    expect(checklist).toContain('390x844');
    expect(checklist).toContain('1440x900');
    expect(checklist).toContain('采购方：询价项目、发票付款、对账单台账');
    expect(checklist).toContain('平台：租户列表');
    expect(checklist).toContain('供应商：发票应收');
    expect(checklist).toContain('无加载失败、无 argument type mismatch、无整页横向溢出');
  });

  it('records the second browser visual QA pass after shared component polish', () => {
    expect(existsSync(checklistPath)).toBe(true);

    const checklist = readFileSync(checklistPath, 'utf8');

    expect(checklist).toContain('## 十、共享组件收口后的浏览器视觉复核记录');
    expect(checklist).toContain('http://localhost:5173/');
    expect(checklist).toContain('1280x720');
    expect(checklist).toContain('390x844');
    expect(checklist).toContain('采购方：首页看板、采购需求、询价项目、采购订单、发票付款');
    expect(checklist).toContain('供应商：供应商看板、询价邀请');
    expect(checklist).toContain('无浏览器错误日志');
    expect(checklist).toContain('documentElement.scrollWidth 等于 clientWidth');
    expect(checklist).toContain('工作台页面节奏收口');
    expect(checklist).toContain('主滚动区 scrollbar-gutter、顶部栏半透明阴影、详情体分段边界和移动摘要卡片按压反馈');
    expect(checklist).toContain('scripts/stage-three-admin-workbench-rhythm-ui.test.ts');
  });
});
