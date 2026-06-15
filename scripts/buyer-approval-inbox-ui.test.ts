import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('buyer approval inbox UI', () => {
  it('shows the business object status separately from the approval task status', () => {
    const app = read('App.tsx');
    const apiClient = read('services/procurementApiClient.ts');

    expect(apiClient).toContain('businessStatus?: string');
    expect(app).toContain('approval.businessStatus');
    expect(app).toContain('业务状态');
  });
});
