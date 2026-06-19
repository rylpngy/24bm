import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const sliceBetween = (source: string, start: string, end: string) =>
  source.slice(source.indexOf(start), source.indexOf(end));

describe('action button feedback consistency UI', () => {
  it('routes critical business actions through the shared primary action button feedback contract', () => {
    const app = read('App.tsx');

    const primaryActionButton = sliceBetween(app, 'const PrimaryActionButton', 'const CapabilityList');
    expect(primaryActionButton).toContain('aria-busy={busy || undefined}');
    expect(primaryActionButton).toContain('disabled={disabled}');
    expect(primaryActionButton).toContain('pendingLabel');
    expect(primaryActionButton).toContain('disabled:cursor-not-allowed');
    expect(primaryActionButton).toContain('disabled:bg-slate-400');

    const platformAnnouncementForm = sliceBetween(app, 'const PlatformAnnouncementPublishPanel', 'const formatAnnouncementScope');
    expect(platformAnnouncementForm).toContain('<PrimaryActionButton');
    expect(platformAnnouncementForm).toContain('busy={publishBusy}');
    expect(platformAnnouncementForm).toContain('pendingLabel="发布中"');
    expect(platformAnnouncementForm).not.toContain('<button\n          type="submit"');

    const platformReviewPanel = sliceBetween(app, 'const PlatformEnterpriseReviewActionPanel', 'const formatEnterpriseType');
    expect(platformReviewPanel).toContain('<PrimaryActionButton');
    expect(platformReviewPanel).toContain('busy={approveBusy}');
    expect(platformReviewPanel).toContain('busy={rejectBusy}');
    expect(platformReviewPanel).toContain('pendingLabel="审核中"');

    const supplierWorkspace = sliceBetween(app, 'const SupplierWorkspaceView', 'const SupplierProfileCapabilityCard');
    expect(supplierWorkspace).toContain('pendingLabel="提交中"');
    expect(supplierWorkspace).toContain('pendingLabel="确认中"');
    expect(supplierWorkspace).toContain('<PrimaryActionButton');
    expect(supplierWorkspace).not.toContain("{quoteBusy ? '提交中' : '提交报价'}");
    expect(supplierWorkspace).not.toContain("{deliveryBusy ? '提交中' : '提交发货'}");
    expect(supplierWorkspace).not.toContain("{invoiceBusy ? '提交中' : '提交发票'}");
  });
});
