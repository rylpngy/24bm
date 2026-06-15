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

  it('uses MyBatis mappers for demand, demand items, departments, and approval tasks', () => {
    const demandMapper = read('backend-java/src/main/java/com/procurement/demand/infrastructure/PurchaseDemandMapper.java');
    const itemMapper = read('backend-java/src/main/java/com/procurement/demand/infrastructure/PurchaseDemandItemMapper.java');
    const departmentMapper = read('backend-java/src/main/java/com/procurement/organization/infrastructure/DepartmentMapper.java');
    const approvalMapper = read('backend-java/src/main/java/com/procurement/approval/infrastructure/ApprovalTaskMapper.java');
    const approvalService = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalTaskApplicationService.java');
    const approvalTemplateService = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalTemplateApplicationService.java');
    const approvalTemplateMapper = read('backend-java/src/main/java/com/procurement/approval/infrastructure/ApprovalTemplateMapper.java');
    const approvalTemplateResponse = read('backend-java/src/main/java/com/procurement/approval/api/ApprovalTemplateResponse.java');
    const approvalController = read('backend-java/src/main/java/com/procurement/approval/api/ApprovalInboxController.java');
    const buyerUserMapper = read('backend-java/src/main/java/com/procurement/identity/infrastructure/BuyerUserMapper.java');
    const migration = read('backend-java/src/main/resources/db/migration/V1__initial_schema.sql');
    const localSeed = read('backend-java/src/main/resources/db/dev/V100__local_demo_seed.sql');

    expect(demandMapper).toContain('@Mapper');
    expect(demandMapper).toContain('purchase_demands');
    expect(itemMapper).toContain('@Mapper');
    expect(itemMapper).toContain('purchase_demand_items');
    expect(departmentMapper).toContain('@Mapper');
    expect(departmentMapper).toContain('departments');
    expect(departmentMapper).toContain('existsActiveByTenantAndId');
    expect(approvalMapper).toContain('@Mapper');
    expect(approvalMapper).toContain('approval_tasks');
    expect(approvalService).toContain('createPendingTask');
    expect(approvalService).toContain('resolveTemplate');
    expect(approvalService).toContain('PENDING_APPROVAL_STATUS');
    expect(approvalService).toContain('TPL_PURCHASE_DEMAND');
    expect(approvalService).toContain('TPL_SUPPLIER_ADMISSION');
    expect(approvalService).toContain('TPL_RFQ_AWARD');
    expect(approvalService).not.toContain('DEFAULT_BUYER_APPROVER_ROLE_ID');
    expect(approvalService).toContain('findActiveByTenantAndBizType');
    expect(approvalService).toContain('findDefaultApproverId');
    expect(approvalService).toContain('Unsupported approval biz type');
    expect(approvalTemplateService).toContain('listTemplates');
    expect(approvalTemplateService).toContain('updateTemplate');
    expect(approvalTemplateService).toContain('approval_template.config_updated');
    expect(approvalTemplateService).toContain('ApprovalTemplateMapper');
    expect(approvalTemplateService).toContain('buyer approval template APIs');
    expect(approvalTemplateMapper).toContain('approval_templates');
    expect(approvalTemplateMapper).toContain('tenant_id = #{tenantId}');
    expect(approvalTemplateMapper).toContain('listByTenant');
    expect(approvalTemplateMapper).toContain('findActiveByTenantAndBizType');
    expect(approvalTemplateMapper).toContain("status = 'active'");
    expect(approvalTemplateMapper).toContain('updateTemplateConfig');
    expect(approvalTemplateMapper).toContain('existsBuyerRoleByTenantAndId');
    expect(approvalTemplateResponse).toContain('defaultApproverRoleId');
    expect(approvalController).toContain('/templates');
    expect(approvalController).toContain('/templates/{templateCode}/config');
    expect(buyerUserMapper).toContain('findDefaultApproverId');
    expect(buyerUserMapper).toContain('user_roles');
    expect(migration).toContain('create table departments');
    expect(migration).toContain('create table user_roles');
    expect(migration).toContain('create table approval_templates');
    expect(localSeed).toContain('TPL_PURCHASE_DEMAND');
    expect(localSeed).toContain("'dept-it', 'tenant-acme'");
    expect(localSeed).toContain("('user-buyer-owner', 'role-buyer-owner')");
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
    expect(service).toContain('requireActiveDepartment');
    expect(service).toContain('existsActiveByTenantAndId');
    expect(service).toContain('listByTenantFiltered');
    expect(service).toContain('草稿');
    expect(service).toContain('审批中');
    expect(service).toContain('purchase_demand');
  });

  it('documents the first Java business API handoff', () => {
    const readme = read('backend-java/README.md');
    const architecture = read('docs/java-backend-architecture.md');

    expect(readme).toContain('GET /api/v1/buyer/demands');
    expect(readme).toContain('POST /api/v1/buyer/demands');
    expect(readme).toContain('optional `status`, `departmentId`, and `keyword` filters');
    expect(architecture).toContain('采购需求 Java API');
  });

  it('keeps source files under the demand and approval module boundaries', () => {
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/demand/application'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/demand/infrastructure'))).toBe(true);
    expect(existsSync(join(root, 'backend-java/src/main/java/com/procurement/approval/infrastructure'))).toBe(true);
  });
});
