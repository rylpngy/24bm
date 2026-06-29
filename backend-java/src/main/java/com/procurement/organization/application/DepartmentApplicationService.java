package com.procurement.organization.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.organization.api.CreateDepartmentRequest;
import com.procurement.organization.api.DepartmentResponse;
import com.procurement.organization.api.UpdateDepartmentRequest;
import com.procurement.organization.domain.Department;
import com.procurement.organization.domain.DepartmentAuditAction;
import com.procurement.organization.domain.DepartmentStatus;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DepartmentApplicationService {
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
        DepartmentStatus.ACTIVE);
    auditLogApplicationService.recordTenantAction(
        DepartmentAuditAction.CREATED,
        AuditTargetType.DEPARTMENT,
        departmentId);
    return toResponse(departmentMapper.findByTenantAndId(tenantId, departmentId));
  }

  // 编辑部门:名称/描述/负责人。审计带「部门: 旧名 → 新名」明细。
  @Transactional
  public DepartmentResponse updateDepartment(String departmentId, UpdateDepartmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    Department current = departmentMapper.findByTenantAndId(tenantId, departmentId);
    if (current == null || !DepartmentStatus.ACTIVE.equals(current.status())) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
    departmentMapper.updateDetails(
        tenantId,
        departmentId,
        request.name(),
        request.description() == null ? "" : request.description(),
        request.managerId());
    String detail = current.name().equals(request.name())
        ? "部门资料更新: " + request.name()
        : "部门: " + current.name() + " → " + request.name();
    auditLogApplicationService.recordTenantAction(
        tenantId, DepartmentAuditAction.UPDATED, AuditTargetType.DEPARTMENT, departmentId, detail);
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
    int updated = departmentMapper.updateStatus(
        tenantId,
        departmentId,
        DepartmentStatus.ACTIVE,
        DepartmentStatus.INACTIVE);
    if (updated == 0) {
      throw new IllegalStateException("Department status changed before disable could be recorded: " + departmentId);
    }
    auditLogApplicationService.recordTenantAction(
        DepartmentAuditAction.DISABLED,
        AuditTargetType.DEPARTMENT,
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
        department.status(),
        department.description(),
        department.managerId(),
        department.managerName(),
        department.memberCount(),
        department.establishedOn());
  }
}
