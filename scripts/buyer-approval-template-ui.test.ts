import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval template configuration UI', () => {
  it('exposes a buyer-facing template configuration panel wired to the Java API client', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('updateBuyerApprovalTemplate');
    expect(apiClient).toContain('listBuyerApprovalTemplates');
    expect(apiClient).toContain('listBuyerRoles');
    expect(app).toContain('审批模板配置');
    expect(app).toContain('ApprovalTemplateSettings');
    expect(app).toContain('loadJavaBuyerMasterData');
    expect(app).toContain('updateBuyerApprovalTemplate');
    expect(app).toContain('defaultApproverRoleId');
    expect(app).toContain(`status === 'active'`);
    expect(app).toContain('保存配置');
  });
});
