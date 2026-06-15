package com.procurement.organization.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.organization.api.DepartmentResponse;
import com.procurement.organization.domain.Department;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DepartmentApplicationService {
  private final DepartmentMapper departmentMapper;

  public DepartmentApplicationService(DepartmentMapper departmentMapper) {
    this.departmentMapper = departmentMapper;
  }

  public List<DepartmentResponse> listCurrentTenantDepartments() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    return departmentMapper.listActiveByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
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
