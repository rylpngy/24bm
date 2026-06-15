package com.procurement.organization.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
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
  private static final String DEPARTMENT_CREATED_ACTION = "department.created";
  private static final String DEPARTMENT_TARGET_TYPE = "department";

  private final DepartmentMapper departmentMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public DepartmentApplicationService(
      DepartmentMapper departmentMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.departmentMapper = departmentMapper;
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

  private DepartmentResponse toResponse(Department department) {
    return new DepartmentResponse(
        department.id(),
        department.tenantId(),
        department.name(),
        department.parentId(),
        department.status());
  }
}
