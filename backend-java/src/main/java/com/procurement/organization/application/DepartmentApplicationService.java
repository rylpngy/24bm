package com.procurement.organization.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.organization.api.CreateDepartmentRequest;
import com.procurement.organization.api.DepartmentResponse;
import com.procurement.organization.domain.Department;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepartmentApplicationService {
  private static final String ACTIVE_STATUS = "active";
  private static final String INACTIVE_STATUS = "inactive";
  private static final String DEPARTMENT_CREATED_ACTION = "department.created";
  private static final String DEPARTMENT_DISABLED_ACTION = "department.disabled";
  private static final String DEPARTMENT_TARGET_TYPE = "department";

  private final DepartmentMapper departmentMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public DepartmentApplicationService(
      DepartmentMapper departmentMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.departmentMapper = departmentMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<DepartmentResponse> listCurrentTenantDepartments() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    return departmentMapper.listActiveByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public DepartmentResponse createDepartment(CreateDepartmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    requireActiveParentDepartment(tenantId, request.parentId());
    String departmentId = "dept-" + UUID.randomUUID();
    departmentMapper.insert(
        departmentId,
        tenantId,
        request.name(),
        request.parentId(),
        ACTIVE_STATUS);
    auditLogApplicationService.recordTenantAction(
        DEPARTMENT_CREATED_ACTION,
        DEPARTMENT_TARGET_TYPE,
        departmentId);
    return toResponse(departmentMapper.findByTenantAndId(tenantId, departmentId));
  }

  @Transactional
  public DepartmentResponse disableDepartment(String departmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
    int referencedDemands = purchaseDemandMapper.countByTenantAndDepartment(tenantId, departmentId);
    if (referencedDemands > 0) {
      throw new IllegalStateException("Department is referenced by purchase demands: " + departmentId);
    }
    int updated = departmentMapper.updateStatus(tenantId, departmentId, ACTIVE_STATUS, INACTIVE_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("Department status changed before disable could be recorded: " + departmentId);
    }
    auditLogApplicationService.recordTenantAction(
        DEPARTMENT_DISABLED_ACTION,
        DEPARTMENT_TARGET_TYPE,
        departmentId);
    return toResponse(departmentMapper.findByTenantAndId(tenantId, departmentId));
  }

  private void requireActiveParentDepartment(String tenantId, String parentId) {
    if (parentId == null || parentId.isBlank()) {
      return;
    }
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, parentId)) {
      throw new IllegalArgumentException("Parent department not found in tenant scope: " + parentId);
    }
  }

  private DepartmentResponse toResponse(Department department) {
    return new DepartmentResponse(
        department.id(),
        department.tenantId(),
        department.name(),
        department.parentId(),
        department.status());
  }
}
