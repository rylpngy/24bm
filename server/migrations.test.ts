import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { databaseTables } from '../data/apiContract';

const migrationSql = readFileSync('server/migrations/001_initial_schema.sql', 'utf8');

describe('initial database migration', () => {
  it('creates every table declared by the API contract', () => {
    for (const table of databaseTables) {
      expect(migrationSql).toContain(`create table ${table.name}`);
    }
  });

  it('adds tenant/status indexes for the busiest tenant-scoped workflow tables', () => {
    expect(migrationSql).toContain('idx_purchase_demands_tenant_status');
    expect(migrationSql).toContain('idx_rfqs_tenant_status');
    expect(migrationSql).toContain('idx_orders_tenant_status');
    expect(migrationSql).toContain('idx_invoices_tenant_payment');
  });
});
