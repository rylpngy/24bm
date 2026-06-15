import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { databaseTables } from '../data/apiContract';

const migrationSql = readdirSync('backend-java/src/main/resources/db/migration')
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort()
  .map((fileName) => readFileSync(`backend-java/src/main/resources/db/migration/${fileName}`, 'utf8'))
  .join('\n');

describe('Java Flyway database migrations', () => {
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

  it('prevents duplicate invoices for the same purchase order in a tenant', () => {
    expect(migrationSql).toContain('unique (tenant_id, order_id)');
  });
});
