import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval inbox UI', () => {
  it('shows the business object status separately from the approval task status', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('businessStatus?: string');
    expect(apiClient).toContain('priority?: number');
    expect(apiClient).toContain('submittedByName?: string');
    expect(app).toContain('sortedPendingApprovals');
    expect(app).toContain('approval.businessStatus');
    expect(app).toContain('approval.priority');
    expect(app).toContain('approval.submittedByName');
    expect(app).toContain('业务状态');
    expect(app).toContain('优先级');
    expect(app).toContain('提交人');
  });
});
