import { describe, expect, it, vi } from 'vitest';
import { listNumberingRules, previewNumberingRule, saveNumberingRule } from './numbering';
import { customInstance } from './http-client';

vi.mock('./http-client', () => ({ customInstance: vi.fn().mockResolvedValue({ data: [] }) }));
describe('numbering client', () => {
  it('uses real scoped configuration and nonconsuming preview endpoints', async () => {
    const rule = { prefix: 'REQ-', dateFormat: 'none' as const, width: 4, enabled: true };
    await listNumberingRules();
    await saveNumberingRule('demand', rule);
    await previewNumberingRule('tender', rule);
    expect(customInstance).toHaveBeenNthCalledWith(1, expect.objectContaining({ url: '/api/v1/buyer/numbering-rules', method: 'GET' }));
    expect(customInstance).toHaveBeenNthCalledWith(2, expect.objectContaining({ url: '/api/v1/buyer/numbering-rules/demand', method: 'PUT', data: rule }));
    expect(customInstance).toHaveBeenNthCalledWith(3, expect.objectContaining({ url: '/api/v1/buyer/numbering-rules/tender/preview', method: 'POST', data: rule }));
  });
});
