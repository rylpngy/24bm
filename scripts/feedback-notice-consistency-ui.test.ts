import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('feedback notice consistency UI', () => {
  it('routes workflow feedback through a shared success/error/info notice', () => {
    const app = read('App.tsx');

    const feedbackNotice = sliceBetween(app, 'const feedbackNoticeToneClasses', 'const processStateToneClasses');
    expect(feedbackNotice).toContain("tone?: 'success' | 'error' | 'info'");
    expect(feedbackNotice).toContain('aria-live="polite"');
    expect(feedbackNotice).toContain('role="status"');
    expect(feedbackNotice).toContain("message.includes('失败')");
    expect(feedbackNotice).toContain("message.includes('已完成')");
    expect(feedbackNotice).toContain("message.includes('已')");

    const platformWorkspace = sliceBetween(app, 'const PlatformWorkspace', 'const PlatformAnnouncementPublishPanel');
    expect(platformWorkspace).toContain('<FeedbackNotice message={workflowStatus}');
    expect(platformWorkspace).not.toContain('rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700');

    const buyerWorkspace = sliceBetween(app, 'const BuyerWorkspaceView', 'const DemandDetailPanelView');
    expect(buyerWorkspace).toContain('<FeedbackNotice message={workflowStatus}');
    expect(buyerWorkspace).not.toContain('rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700');

    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileCapabilityCard');
    expect(supplierWorkspace).toContain('<FeedbackNotice message={workflowStatus}');
    expect(supplierWorkspace).not.toContain('rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-700');
  });
});
