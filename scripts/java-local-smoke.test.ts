import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java local smoke command', () => {
  it('documents and scripts the Java local API smoke test', () => {
    expect(existsSync(join(root, 'scripts/java-local-smoke.mjs'))).toBe(true);

    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const script = read('scripts/java-local-smoke.mjs');
    const doc = read('docs/local-java-integration.md');

    expect(packageJson.scripts['java:smoke']).toBe('node scripts/java-local-smoke.mjs');
    expect(script).toContain('/api/v1/auth/login');
    expect(script).toContain("requestJson('/api/v1/platform/workspace'");
    expect(script).toContain("requestJson('/api/v1/platform/overview'");
    expect(script).toContain("requestJson('/api/v1/platform/tenants'");
    expect(script).toContain("requestJson('/api/v1/platform/enterprise-reviews'");
    expect(script).toContain("requestJson('/api/v1/buyer/workspace'");
    expect(script).toContain('/api/v1/buyer/suppliers');
    expect(script).toContain('/api/v1/buyer/materials');
    expect(script).toContain('/api/v1/buyer/departments');
    expect(script).toContain('JAVA_CREATE_SMOKE_DEPARTMENT');
    expect(script).toContain('JAVA_DISABLE_SMOKE_DEPARTMENT');
    expect(script).toContain('/api/v1/buyer/users');
    expect(script).toContain('/api/v1/buyer/demands');
    expect(script).toContain("requestJson('/api/v1/buyer/orders'");
    expect(script).toContain("requestJson('/api/v1/buyer/invoices'");
    expect(script).toContain("requestJson('/api/v1/buyer/audit-logs'");
    expect(script).toContain("requestJson('/api/v1/supplier/workspace'");
    expect(script).toContain("requestJson('/api/v1/supplier/profile'");
    expect(script).toContain("requestJson('/api/v1/supplier/rfqs'");
    expect(script).toContain("requestJson('/api/v1/supplier/quotes'");
    expect(script).toContain("requestJson('/api/v1/supplier/orders'");
    expect(script).toContain("requestJson('/api/v1/supplier/invoices'");
    expect(script).toContain('/api/v1/buyer/rfqs');
    expect(script).toContain('/api/v1/supplier/rfqs/${rfq.id}/quotes');
    expect(script).toContain('/api/v1/buyer/rfqs/${rfq.id}/award');
    expect(script).toContain('/api/v1/buyer/orders');
    expect(script).toContain('/api/v1/supplier/orders/${order.id}/confirm');
    expect(script).toContain('/api/v1/supplier/orders/${confirmedOrder.id}/deliveries');
    expect(script).toContain('/api/v1/buyer/orders/${order.id}/receipts');
    expect(script).toContain('/api/v1/supplier/orders/${order.id}/invoices');
    expect(script).toContain('/api/v1/buyer/invoices/${invoice.id}/payments');
    expect(script).toContain('tenant-acme');
    expect(script).toContain('mat-laptop');
    expect(script).toContain('dept-it');
    expect(script).toContain('user-buyer-owner');
    expect(script).toContain('dem-local-laptop');
    expect(script).toContain('ent-supplier-sunrise');
    expect(doc).toContain('npm run java:smoke');
  });
});
