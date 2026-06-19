import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer audit log filtering UI', () => {
  it('adds action and target filters plus a clearable result summary to audit logs', () => {
    const app = read('App.tsx');
    const auditLogList = app.slice(
      app.indexOf('const AuditLogList'),
      app.indexOf('const ApprovalTemplateSettings'),
    );

    expect(auditLogList).toContain('auditTargetFilter');
    expect(auditLogList).toContain('auditActionFilter');
    expect(auditLogList).toContain('auditTargetOptions');
    expect(auditLogList).toContain('auditActionOptions');
    expect(auditLogList).toContain('对象类型');
    expect(auditLogList).toContain('动作类型');
    expect(auditLogList).toContain('log.title === auditActionFilter');
    expect(auditLogList).toContain('FilterResultSummary');
    expect(auditLogList).toContain('操作日志筛选结果');
    expect(auditLogList).toContain('buildAuditFilterLabel');
    expect(auditLogList).toContain('setAuditTargetFilter(ALL_STATUS_FILTER)');
    expect(auditLogList).toContain('setAuditActionFilter(ALL_STATUS_FILTER)');
  });
});
