import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('message center entry UI', () => {
  it('defines a shared message center panel with unread summary and notification cards', () => {
    const app = read('App.tsx');
    const messageCenterPanel = sliceBetween(app, 'const MessageCenterPanel', 'const FeedbackNotice');

    expect(messageCenterPanel).toContain('消息中心入口');
    expect(messageCenterPanel).toContain('unreadCount');
    expect(messageCenterPanel).toContain('notifications.map');
    expect(messageCenterPanel).toContain('formatAuditTime(notification.createdAt)');
    expect(messageCenterPanel).toContain('<EmptyState title="暂无站内通知"');
  });

  it('uses the shared message center on buyer dashboard and approval notification areas', () => {
    const app = read('App.tsx');
    const buyerWorkspace = sliceBetween(app, 'const BuyerWorkspaceView', 'const DemandDetailPanelView');

    expect(buyerWorkspace).toContain('const buyerMessageCenterNotifications');
    expect(buyerWorkspace).toContain('title="采购方消息中心"');
    expect(buyerWorkspace).toContain('scopeLabel="审批、询价、订单、发票"');
    expect(buyerWorkspace).toContain('title="审批消息中心"');
    expect(buyerWorkspace).toContain('notifications={filteredBuyerNotifications}');
  });

  it('adds a supplier message center derived from supplier collaboration records', () => {
    const app = read('App.tsx');
    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileSummaryPanel');

    expect(app).toContain('const buildSupplierMessageCenterNotifications');
    expect(supplierWorkspace).toContain('const supplierMessageCenterNotifications');
    expect(supplierWorkspace).toContain('title="供应商消息中心"');
    expect(supplierWorkspace).toContain('scopeLabel="询价邀请、销售订单、发票应收"');
    expect(supplierWorkspace).toContain('notifications={supplierMessageCenterNotifications}');
  });
});
