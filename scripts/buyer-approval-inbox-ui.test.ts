import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval inbox UI', () => {
  it('shows the business object status separately from the approval task status', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');
    const buyerAdminUi = read('data/buyerAdminUi.ts');

    expect(apiClient).toContain('businessStatus?: string');
    expect(apiClient).toContain('priority?: number');
    expect(apiClient).toContain('submittedByName?: string');
    expect(apiClient).toContain('actedAt?: string | null');
    expect(apiClient).toContain('listBuyerRecentApprovals');
    expect(apiClient).toContain('listBuyerNotifications');
    expect(apiClient).toContain('/api/v1/buyer/approvals/recent');
    expect(apiClient).toContain('/api/v1/buyer/notifications');
    expect(app).toContain('sortedPendingApprovals');
    expect(app).toContain('recentApprovals');
    expect(app).toContain('buyerNotifications');
    expect(app).toContain('buildApprovalCardFacts(approval)');
    expect(app).toContain('approval.actedAt');
    expect(app).toContain('InlineFactGrid');
    expect(buyerAdminUi).toContain('approval.businessStatus');
    expect(buyerAdminUi).toContain('approval.priority');
    expect(buyerAdminUi).toContain('approval.submittedByName');
    expect(buyerAdminUi).toContain('业务状态');
    expect(buyerAdminUi).toContain('优先级');
    expect(buyerAdminUi).toContain('提交人');
    expect(app).toContain('最近审批记录');
    expect(app).toContain('处理时间');
    expect(app).toContain('审批结果通知');
    expect(app).toContain('未读');
  });
});
