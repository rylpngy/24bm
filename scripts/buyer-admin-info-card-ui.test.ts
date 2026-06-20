import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer admin info card UI', () => {
  it('defines a shared admin info card for dense buyer back-office lists', () => {
    const app = read('App.tsx');

    expect(app).toContain('const AdminInfoCard');
    expect(app).toContain('title: string;');
    expect(app).toContain('meta: string;');
    expect(app).toContain('status?: string;');
    expect(app).toContain('badge?: string;');
    expect(app).toContain('facts?: Array<{ label: string; value: string }>;');
    expect(app).toContain('detailSelected: boolean;');
    expect(app).toContain('onSelectDetail: () => void;');
    expect(app).toContain('tone?: \'default\' | \'warning\';');
    expect(app).toContain('children?: React.ReactNode;');
    expect(app).toContain('aria-label={`${title} 信息卡片`}');
  });

  it('lets dense card titles, badges, and facts breathe on narrow screens', () => {
    const app = read('App.tsx');
    const adminInfoCard = app.slice(
      app.indexOf('const AdminInfoCard'),
      app.indexOf('const WorkflowListCard'),
    );
    const inlineFactGrid = app.slice(
      app.indexOf('const InlineFactGrid'),
      app.indexOf('const nextActionToneClasses'),
    );

    expect(adminInfoCard).toContain('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between');
    expect(adminInfoCard).toContain('min-w-0 max-w-full');
    expect(adminInfoCard).toContain('break-words text-sm font-black text-slate-950');
    expect(adminInfoCard).toContain('break-words text-xs font-bold');
    expect(adminInfoCard).toContain('w-full shrink-0 flex-wrap justify-start gap-2 sm:w-auto sm:justify-end');
    expect(inlineFactGrid).toContain('md:grid-cols-2');
    expect(inlineFactGrid).toContain('break-words');
    expect(inlineFactGrid).not.toContain('sm:grid-cols-2');
    expect(inlineFactGrid).not.toContain('truncate text-xs font-bold text-slate-700');
  });

  it('uses the shared admin info card in approval, supplier, material, and audit lists', () => {
    const app = read('App.tsx');

    const approvalInbox = app.slice(
      app.indexOf('<Panel title="审批待办"'),
      app.indexOf('<ApprovalDetailPanelView'),
    );
    const recentApprovals = app.slice(
      app.indexOf('<Panel title="最近审批记录"'),
      app.indexOf('{javaEnabled ? ('),
    );
    const materials = app.slice(
      app.indexOf("{activeModule === 'materials'"),
      app.indexOf('<MaterialDetailPanelView'),
    );
    const suppliers = app.slice(
      app.indexOf("{activeModule === 'suppliers'"),
      app.indexOf('<SupplierDetailPanelView'),
    );
    const audit = app.slice(
      app.indexOf('const AuditLogList'),
      app.indexOf('const ApprovalTemplateSettings'),
    );

    expect(approvalInbox).toContain('<AdminInfoCard');
    expect(approvalInbox).toContain('title={approvalRow.title}');
    expect(approvalInbox).toContain('meta={approvalRow.typeLabel}');
    expect(approvalInbox).toContain('tone="warning"');

    expect(recentApprovals).toContain('<AdminInfoCard');
    expect(recentApprovals).toContain('title={approval.summaryTitle || approval.bizId}');
    expect(recentApprovals).toContain('meta={approvalTypeLabel(approval.bizType)}');

    expect(materials).toContain('<AdminInfoCard');
    expect(materials).toContain('title={material.title}');
    expect(materials).toContain('meta={material.usageLabel}');
    expect(materials).toContain('facts={material.facts}');

    expect(suppliers).toContain('<AdminInfoCard');
    expect(suppliers).toContain('title={relationRow.supplierName}');
    expect(suppliers).toContain('meta={relationRow.categoryLabel}');
    expect(suppliers).toContain('badge={relationRow.level}');

    expect(audit).toContain('<AdminInfoCard');
    expect(audit).toContain('title={log.title}');
    expect(audit).toContain('meta={log.targetLabel}');
    expect(audit).toContain('badge={log.timeLabel}');
  });
});
