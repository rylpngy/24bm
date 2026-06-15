import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java buyer workspace scaffold', () => {
  it('aggregates buyer todo summary in the Java workspace response', () => {
    const service = read('backend-java/src/main/java/com/procurement/buyer/application/BuyerWorkspaceApplicationService.java');
    const response = read('backend-java/src/main/java/com/procurement/buyer/api/BuyerWorkspaceResponse.java');
    const summary = read('backend-java/src/main/java/com/procurement/buyer/api/BuyerTodoSummaryResponse.java');
    const readme = read('backend-java/README.md');
    const localGuide = read('docs/local-java-integration.md');

    expect(response).toContain('BuyerTodoSummaryResponse todoSummary');
    expect(response).toContain('List<PendingApprovalTaskResponse> recentApprovals');
    expect(response).toContain('List<NotificationResponse> notifications');
    expect(summary).toContain('pendingApprovalCount');
    expect(summary).toContain('pendingAwardCount');
    expect(summary).toContain('pendingReceiptCount');
    expect(summary).toContain('pendingPaymentCount');
    expect(service).toContain('summarizeTodos');
    expect(service).toContain('RFQ_QUOTING_STATUS');
    expect(service).toContain('ORDER_SHIPPED_STATUS');
    expect(service).toContain('INVOICE_PARTIAL_PAYMENT_STATUS');
    expect(service).toContain('listRecentReviewed()');
    expect(service).toContain('listCurrentUserNotifications(NOTIFICATION_LIMIT)');
    expect(readme).toContain('Buyer workspace includes `todoSummary` counts');
    expect(readme).toContain('Buyer workspace also includes recent reviewed approvals and in-app notifications');
    expect(localGuide).toContain('buyer todo summary');
    expect(localGuide).toContain('buyer approval history and in-app notifications');
  });
});
