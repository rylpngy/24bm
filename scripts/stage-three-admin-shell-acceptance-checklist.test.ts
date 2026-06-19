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
    expect(checklist).toContain('第一轮收口结论：可以进入第二轮，但第二轮开始前应保留 Java 模式逐页联调作为回归门槛。');
  });
});
