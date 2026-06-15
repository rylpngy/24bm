import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java RFQ sourcing scaffold', () => {
  it('exposes buyer RFQ REST endpoints', () => {
    const controller = read('backend-java/src/main/java/com/procurement/sourcing/api/RfqController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/rfqs")');
    expect(controller).toContain('@GetMapping');
    expect(controller).toContain('@PostMapping');
    expect(controller).toContain('CreateRfqRequest');
  });

  it('defines request and response DTOs for RFQ creation', () => {
    const request = read('backend-java/src/main/java/com/procurement/sourcing/api/CreateRfqRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/sourcing/api/RfqResponse.java');

    expect(request).toContain('title');
    expect(request).toContain('demandIds');
    expect(request).toContain('invitedSupplierIds');
    expect(request).toContain('deadlineAt');
    expect(response).toContain('tenantId');
    expect(response).toContain('status');
    expect(response).toContain('invitedSupplierIds');
  });

  it('uses MyBatis mappers for RFQ, linked demands, invites, and supplier relations', () => {
    const rfqMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/RfqMapper.java');
    const demandLinkMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/RfqDemandMapper.java');
    const inviteMapper = read('backend-java/src/main/java/com/procurement/sourcing/infrastructure/RfqInviteMapper.java');
    const supplierRelationMapper = read('backend-java/src/main/java/com/procurement/supplier/infrastructure/BuyerSupplierRelationMapper.java');

    expect(rfqMapper).toContain('@Mapper');
    expect(rfqMapper).toContain('rfqs');
    expect(demandLinkMapper).toContain('@Mapper');
    expect(demandLinkMapper).toContain('rfq_demands');
    expect(inviteMapper).toContain('@Mapper');
    expect(inviteMapper).toContain('rfq_invites');
    expect(supplierRelationMapper).toContain('buyer_supplier_relations');
  });

  it('keeps RFQ creation isolated to the current tenant and approved inputs', () => {
    const service = read('backend-java/src/main/java/com/procurement/sourcing/application/RfqApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('TenantAccessGuard.requireUserId');
    expect(service).toContain('TenantFeatureApplicationService');
    expect(service).toContain('listByTenantFiltered');
    expect(service).toContain('requireEnabled(tenantId, RFQ_FEATURE)');
    expect(service).toContain('已通过');
    expect(service).toContain('已准入');
    expect(service).toContain('报价中');
  });

  it('documents the RFQ Java API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('GET /api/v1/buyer/rfqs');
    expect(readme).toContain('POST /api/v1/buyer/rfqs');
    expect(readme).toContain('optional `status` and `keyword` filters');
    expect(readme).toContain('RFQ creation requires the current buyer tenant to have the `rfq` feature enabled');
    expect(architecture).toContain('RFQ 询价 Java API');
    expect(architecture).toContain('当前租户必须启用 `rfq` 功能开关');
  });

  it('keeps source files under sourcing and supplier module boundaries', () => {
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/sourcing/application'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/sourcing/infrastructure'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/supplier/infrastructure'))).toBe(true);
  });
});
