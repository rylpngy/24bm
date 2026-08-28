package com.procurement.organization.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
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
  private final BuyerUserMapper buyerUserMapper;
  private final PermissionService permissionService;

  public DepartmentApplicationService(
      DepartmentMapper departmentMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      AuditLogApplicationService auditLogApplicationService,
      BuyerUserMapper buyerUserMapper,
      PermissionService permissionService) {
    this.departmentMapper = departmentMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.buyerUserMapper = buyerUserMapper;
    this.permissionService = permissionService;
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
    requireTeamManagement();
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

  // ====== Excel 批量导入:名称必填,上级部门按名称解析(可引用文件内先建的行)======

  private static final java.util.List<String> IMPORT_HEADERS = java.util.List.of("部门名称*", "上级部门名称");

  public byte[] importTemplate() {
    return com.procurement.common.excel.ExcelSheets.template(
        "部门导入模板",
        IMPORT_HEADERS,
        List.of(
            List.of("采购中心", ""),
            List.of("寻源组", "采购中心")));
  }

  @Transactional
  public com.procurement.common.api.ImportResultResponse importDepartments(byte[] content) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    requireTeamManagement();
    List<List<String>> rows = com.procurement.common.excel.ExcelSheets.readFirstSheet(content, 201);
    if (rows.size() <= 1) {
      throw new IllegalArgumentException("文件中没有数据行,请按模板填写后再导入");
    }
    java.util.Map<String, String> idByName = new java.util.HashMap<>();
    for (Department department : departmentMapper.listActiveByTenant(tenantId)) {
      idByName.put(department.name(), department.id());
    }
    List<com.procurement.common.api.ImportRowError> failures = new java.util.ArrayList<>();
    int success = 0;
    for (int r = 1; r < rows.size(); r++) {
      List<String> cells = rows.get(r);
      int rowNumber = r + 1;
      String name = cells.isEmpty() ? "" : cells.get(0);
      String parentName = cells.size() > 1 ? cells.get(1) : "";
      if (name.isBlank() && parentName.isBlank()) {
        continue; // 整行空白跳过。
      }
      if (name.isBlank()) {
        failures.add(new com.procurement.common.api.ImportRowError(rowNumber, "部门名称为必填项"));
        continue;
      }
      if (idByName.containsKey(name)) {
        failures.add(new com.procurement.common.api.ImportRowError(
            rowNumber, "部门名称已存在(现有部门或文件内重复): " + name));
        continue;
      }
      String parentId = null;
      if (!parentName.isBlank()) {
        parentId = idByName.get(parentName);
        if (parentId == null) {
          failures.add(new com.procurement.common.api.ImportRowError(
              rowNumber, "上级部门不存在: " + parentName + "(可先在文件上方行中创建)"));
          continue;
        }
      }
      String departmentId = "dept-" + UUID.randomUUID();
      departmentMapper.insert(departmentId, tenantId, name, parentId, DepartmentStatus.ACTIVE);
      auditLogApplicationService.recordTenantAction(
          DepartmentAuditAction.CREATED, AuditTargetType.DEPARTMENT, departmentId);
      idByName.put(name, departmentId);
      success++;
    }
    return new com.procurement.common.api.ImportResultResponse(rows.size() - 1, success, failures);
  }

  // 编辑部门:名称/描述/负责人。审计带「部门: 旧名 → 新名」明细。
  @Transactional
  public DepartmentResponse updateDepartment(String departmentId, UpdateDepartmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    requireTeamManagement();
    Department current = departmentMapper.findByTenantAndId(tenantId, departmentId);
    if (current == null || !DepartmentStatus.ACTIVE.equals(current.status())) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
    String managerId = blankToNull(request.managerId());
    boolean managerTransferred = prepareManager(
        tenantId, departmentId, managerId, request.transferManagerToDepartment());
    departmentMapper.updateDetails(
        tenantId,
        departmentId,
        request.name().trim(),
        request.description() == null ? "" : request.description(),
        managerId);
    String detail = current.name().equals(request.name().trim())
        ? "部门资料更新: " + request.name().trim()
        : "部门: " + current.name() + " → " + request.name().trim();
    if (managerTransferred) {
      detail += "；负责人已调入当前部门";
    }
    auditLogApplicationService.recordTenantAction(
        tenantId, DepartmentAuditAction.UPDATED, AuditTargetType.DEPARTMENT, departmentId, detail);
    return toResponse(departmentMapper.findByTenantAndId(tenantId, departmentId));
  }

  @Transactional
  public DepartmentResponse disableDepartment(String departmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer department APIs");
    requireTeamManagement();
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
    int referencedDemands = purchaseDemandMapper.countByTenantAndDepartment(tenantId, departmentId);
    if (referencedDemands > 0) {
      throw new IllegalStateException("Department is referenced by purchase demands: " + departmentId);
    }
    if (departmentMapper.countActiveMembersByTenantAndDepartment(tenantId, departmentId) > 0) {
      throw new IllegalStateException("Department still has active members: " + departmentId);
    }
    if (departmentMapper.countActiveChildrenByTenantAndParent(tenantId, departmentId) > 0) {
      throw new IllegalStateException("Department still has active child departments: " + departmentId);
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

  private boolean prepareManager(
      String tenantId,
      String departmentId,
      String managerId,
      Boolean transferManagerToDepartment) {
    if (managerId == null) {
      return false;
    }
    BuyerUser manager = buyerUserMapper.findByTenantAndId(tenantId, managerId);
    if (manager == null || !"active".equals(manager.status())) {
      throw new IllegalArgumentException("负责人必须是当前企业的在职成员");
    }
    boolean transferred = false;
    if (!departmentId.equals(manager.departmentId())) {
      if (!Boolean.TRUE.equals(transferManagerToDepartment)) {
        throw new IllegalArgumentException("负责人必须属于当前部门；可选择调入当前部门后再任命");
      }
      int changed = buyerUserMapper.updateDepartment(tenantId, managerId, departmentId);
      if (changed == 0) {
        throw new IllegalStateException("负责人调入部门失败，请刷新后重试");
      }
      departmentMapper.clearManagerByUserIdExceptDepartment(tenantId, managerId, departmentId);
      transferred = true;
    }
    if (!departmentMapper.existsActiveMemberByTenantAndDepartment(tenantId, departmentId, managerId)) {
      throw new IllegalArgumentException("负责人必须是当前部门的在职成员");
    }
    return transferred;
  }

  private void requireTeamManagement() {
    permissionService.require("buyer:role:manage");
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
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
