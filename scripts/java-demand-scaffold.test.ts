import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('Java purchase demand scaffold', () => {
  it('exposes buyer demand REST endpoints', () => {
    const controller = read('backend-java/src/main/java/com/procurement/demand/api/PurchaseDemandController.java');

    expect(controller).toContain('@RequestMapping("/api/v1/buyer/demands")');
    expect(controller).toContain('@GetMapping');
    expect(controller).toContain('@PostMapping');
    expect(controller).toContain('@PostMapping("/{demandId}/submit")');
  });

  it('defines request and response DTOs for purchase demand creation', () => {
    const request = read('backend-java/src/main/java/com/procurement/demand/api/CreatePurchaseDemandRequest.java');
    const response = read('backend-java/src/main/java/com/procurement/demand/api/PurchaseDemandResponse.java');
    const lineItem = read('backend-java/src/main/java/com/procurement/demand/api/PurchaseDemandLineItemRequest.java');

    expect(request).toContain('title');
    expect(request).toContain('departmentId');
    expect(request).toContain('budget');
    expect(request).toContain('lineItems');
    expect(lineItem).toContain('materialId');
    expect(lineItem).toContain('quantity');
    expect(response).toContain('tenantId');
    expect(response).toContain('status');
  });

  it('uses MyBatis mappers for demand, demand items, and approval tasks', () => {
    const demandMapper = read('backend-java/src/main/java/com/procurement/demand/infrastructure/PurchaseDemandMapper.java');
    const itemMapper = read('backend-java/src/main/java/com/procurement/demand/infrastructure/PurchaseDemandItemMapper.java');
    const approvalMapper = read('backend-java/src/main/java/com/procurement/approval/infrastructure/ApprovalTaskMapper.java');
    const approvalService = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalTaskApplicationService.java');

    expect(demandMapper).toContain('@Mapper');
    expect(demandMapper).toContain('purchase_demands');
    expect(itemMapper).toContain('@Mapper');
    expect(itemMapper).toContain('purchase_demand_items');
    expect(approvalMapper).toContain('@Mapper');
    expect(approvalMapper).toContain('approval_tasks');
    expect(approvalService).toContain('createPendingTask');
    expect(approvalService).toContain('resolveTemplate');
    expect(approvalService).toContain('PENDING_APPROVAL_STATUS');
    expect(approvalService).toContain('TPL_PURCHASE_DEMAND');
    expect(approvalService).toContain('TPL_SUPPLIER_ADMISSION');
    expect(approvalService).toContain('TPL_RFQ_AWARD');
    expect(approvalService).toContain('buyer-owner');
    expect(approvalService).toContain('Unsupported approval biz type');
  });

  it('centralizes pending approval task creation behind the approval application service', () => {
    const demandService = read('backend-java/src/main/java/com/procurement/demand/application/PurchaseDemandApplicationService.java');
    const supplierService = read('backend-java/src/main/java/com/procurement/supplier/application/BuyerSupplierApplicationService.java');
    const awardService = read('backend-java/src/main/java/com/procurement/sourcing/application/AwardApplicationService.java');
    const approvalService = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalTaskApplicationService.java');

    for (const service of [demandService, supplierService, awardService]) {
      expect(service).toContain('ApprovalTaskApplicationService');
      expect(service).toContain('createPendingTask');
      expect(service).not.toContain('approvalTaskMapper.insert');
    }

    expect(approvalService).toContain('approvalTaskMapper.insert');
  });

  it('keeps tenant isolation in the demand application service', () => {
    const service = read('backend-java/src/main/java/com/procurement/demand/application/PurchaseDemandApplicationService.java');

    expect(service).toContain('TenantAccessGuard.requireTenantId');
    expect(service).toContain('TenantAccessGuard.requireUserId');
    expect(service).toContain('草稿');
    expect(service).toContain('审批中');
    expect(service).toContain('purchase_demand');
  });

  it('documents the first Java business API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('GET /api/v1/buyer/demands');
    expect(readme).toContain('POST /api/v1/buyer/demands');
    expect(architecture).toContain('采购需求 Java API');
  });

  it('keeps source files under the demand and approval module boundaries', () => {
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/demand/application'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/demand/infrastructure'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/approval/infrastructure'))).toBe(true);
  });
});
