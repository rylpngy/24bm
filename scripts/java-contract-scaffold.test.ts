import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java contract management scaffold', () => {
  it('exposes a buyer contract ledger endpoint under the contract module', () => {
    const controller = read('backend-java/src/main/java/com/procurement/contract/api/BuyerContractController.java');
    const response = read('backend-java/src/main/java/com/procurement/contract/api/ContractResponse.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/contracts")');
    expect(controller).toContain('@GetMapping');
    expect(controller).toContain('ContractApplicationService');
    expect(controller).toContain('status');
    expect(controller).toContain('archiveStatus');
    expect(controller).toContain('supplierId');
    expect(response).toContain('contractNo');
    expect(response).toContain('relatedOrderId');
    expect(response).toContain('archiveStatus');
    expect(response).toContain('fulfillmentProgress');
  });

  it('keeps contract ledger tenant scoped and derived from purchase orders for this round', () => {
    const service = read('backend-java/src/main/java/com/procurement/contract/application/ContractApplicationService.java');
    const mapper = read('backend-java/src/main/java/com/procurement/contract/infrastructure/ContractMapper.java');
    const domain = read('backend-java/src/main/java/com/procurement/contract/domain/ContractLedger.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('listCurrentTenantContracts');
    expect(service).toContain('ContractMapper');
    expect(service).toContain('blankToNull');
    expect(mapper).toContain('@Mapper');
    expect(mapper).toContain('contracts');
    expect(mapper).toContain('tenant_id = #{tenantId}');
    expect(mapper).toContain('listByTenantFiltered');
    expect(domain).toContain('relatedOrderId');
    expect(domain).toContain('archiveStatus');
    expect(domain).toContain('fulfillmentProgress');
  });

  it('adds a tenant-scoped contracts table migration seeded from existing orders', () => {
    const migration = read('backend-java/src/main/resources/db/migration/V114__contracts.sql');
    const seed = read('backend-java/src/main/resources/db/dev/V100__local_demo_seed.sql');
    const incrementalSeed = read('backend-java/src/main/resources/db/dev/V115__contract_demo_seed.sql');

    expect(migration).toContain('create table contracts');
    expect(migration).toContain('tenant_id');
    expect(migration).toContain('related_order_id');
    expect(migration).toContain('archive_status');
    expect(migration).toContain('unique (tenant_id, related_order_id)');
    expect(seed).toContain('contract-po-acme-1');
    expect(seed).toContain('CTR-PO-ACME-1');
    expect(incrementalSeed).toContain('contract-po-acme-1');
    expect(incrementalSeed).toContain('on conflict (tenant_id, related_order_id) do update');
  });

  it('wires the contract endpoint into frontend API contracts and stage-five checklist', () => {
    const apiContract = read('data/apiContract.ts');
    const client = read('services/procurementApiClient.ts');
    const checklist = read('docs/stage-five-execution-checklist.md');

    expect(apiContract).toContain("path: '/buyer/contracts'");
    expect(apiContract).toContain("responseSchema: 'ContractLedgerList'");
    expect(apiContract).toContain("name: 'contracts'");
    expect(client).toContain('JavaContractDto');
    expect(client).toContain('listBuyerContracts');
    expect(client).toContain("buyerRequest<JavaContractDto[]>('/api/v1/buyer/contracts");
    expect(checklist).toContain('| 4 | 合同管理 Java 持久化骨架 |');
    expect(checklist).toContain('第4轮已新增合同台账 Java 列表接口');
  });

  it('keeps source files under the contract module boundary', () => {
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/contract/application'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/contract/infrastructure'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/contract/domain'))).toBe(true);
  });
});
