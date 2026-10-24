package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.CreateSupplierInvitationRequest;
import com.procurement.supplier.api.RespondSupplierInvitationRequest;
import com.procurement.supplier.api.SupplierInvitationResponse;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.domain.SupplierInvitationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierInvitationMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 邀请管理:发起邀请 → 待回复 → 接受/拒绝/撤回;接受且关联已知供应商时桥接为私域待准入。
@Service
public class SupplierInvitationApplicationService {
  private final SupplierInvitationMapper invitationMapper;
  private final BuyerSupplierRelationMapper relationMapper;
  private final ObjectMapper objectMapper;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;

  public SupplierInvitationApplicationService(
      SupplierInvitationMapper invitationMapper,
      BuyerSupplierRelationMapper relationMapper,
      ObjectMapper objectMapper,
      PermissionService permissions,
      AuditLogApplicationService audit) {
    this.invitationMapper = invitationMapper;
    this.relationMapper = relationMapper;
    this.objectMapper = objectMapper;
    this.permissions = permissions;
    this.audit = audit;
  }

  public List<SupplierInvitationResponse> listInvitations() {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    permissions.require("buyer:supplier:read");
    return invitationMapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  public List<SupplierInvitationResponse> listSupplierInvitations() {
    String supplierId = TenantAccessGuard.requireSupplierId("供应商合作邀请");
    permissions.require("supplier:profile:read");
    return invitationMapper.listBySupplier(supplierId).stream().map(this::toResponse).toList();
  }

  // ====== Excel 批量导入:每行生成一条待回复邀请(供应商名称必填,库内待回复重名跳过)======

  public byte[] importTemplate() {
    TenantAccessGuard.requireTenantId("供应商邀请");
    permissions.require("buyer:supplier:read");
    return com.procurement.common.excel.ExcelSheets.template(
        "供应商邀请导入模板",
        List.of("供应商名称*", "联系方式", "主营品类", "备注"),
        List.of(List.of("XX 机电设备有限公司", "李经理 138xxxx0000", "机电设备", "老供应商迁移")));
  }

  @Transactional
  public com.procurement.common.api.ImportResultResponse importInvitations(byte[] content) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    permissions.require("buyer:supplier:manage");
    TenantAccessGuard.requireUserId("供应商邀请");
    List<List<String>> rows = com.procurement.common.excel.ExcelSheets.readFirstSheet(content, 501);
    if (rows.size() <= 1) {
      throw new IllegalArgumentException("文件中没有数据行,请按模板填写后再导入");
    }
    java.util.Set<String> pendingNames = new java.util.HashSet<>();
    for (SupplierInvitation invitation : invitationMapper.listByTenant(tenantId)) {
      if (SupplierInvitationStatus.PENDING.equals(invitation.status())) {
        pendingNames.add(invitation.supplierName());
      }
    }
    List<com.procurement.common.api.ImportRowError> failures = new java.util.ArrayList<>();
    int success = 0;
    for (int r = 1; r < rows.size(); r++) {
      List<String> cells = rows.get(r);
      int rowNumber = r + 1;
      String name = cells.isEmpty() ? "" : cells.get(0);
      if (cells.stream().allMatch(String::isBlank)) {
        continue; // 整行空白跳过。
      }
      if (name.isBlank()) {
        failures.add(new com.procurement.common.api.ImportRowError(rowNumber, "供应商名称为必填项"));
        continue;
      }
      if (pendingNames.contains(name)) {
        failures.add(new com.procurement.common.api.ImportRowError(
            rowNumber, "已存在同名待回复邀请(库内或文件内重复): " + name));
        continue;
      }
      String id = "inv-" + UUID.randomUUID();
      invitationMapper.insert(
          id,
          tenantId,
          null,
          name,
          blankToNull(cells.size() > 1 ? cells.get(1) : null),
          blankToNull(cells.size() > 2 ? cells.get(2) : null),
          blankToNull(cells.size() > 3 ? cells.get(3) : null),
          SupplierInvitationStatus.PENDING);
      audit.recordTenantAction(
          tenantId, "supplier_invitation.create", "supplier_invitation", id,
          "采购方导入线下邀请记录，未发送平台邀请");
      pendingNames.add(name);
      success++;
    }
    return new com.procurement.common.api.ImportResultResponse(rows.size() - 1, success, failures);
  }

  @Transactional
  public SupplierInvitationResponse createInvitation(CreateSupplierInvitationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    permissions.require("buyer:supplier:manage");
    TenantAccessGuard.requireUserId("供应商邀请");
    String supplierId = blankToNull(request.supplierId());
    String supplierName = supplierId == null
        ? blankToNull(request.supplierName())
        : invitationMapper.findSupplierName(supplierId);
    if (supplierName == null) {
      throw new IllegalArgumentException("供应商名称不能为空，绑定企业须为有效供应商企业");
    }
    String id = "inv-" + UUID.randomUUID();
    invitationMapper.insert(
        id,
        tenantId,
        supplierId,
        supplierName,
        blankToNull(request.contact()),
        blankToNull(request.category()),
        blankToNull(request.note()),
        SupplierInvitationStatus.PENDING);
    audit.recordTenantAction(
        tenantId, "supplier_invitation.create", "supplier_invitation", id,
        supplierId == null ? "采购方创建线下邀请记录，未发送平台邀请" : "采购方向平台供应商发起合作邀请");
    return toResponse(invitationMapper.findByTenantAndId(tenantId, id));
  }

  @Transactional
  public SupplierInvitationResponse respond(String id, RespondSupplierInvitationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    permissions.require("buyer:supplier:manage");
    TenantAccessGuard.requireUserId("供应商邀请");
    String target = target(request);
    SupplierInvitation invitation = invitationMapper.lockByTenantAndId(tenantId, id);
    if (invitation == null) {
      throw new IllegalArgumentException("邀请单不存在: " + id);
    }
    if (invitation.supplierId() != null && !SupplierInvitationStatus.WITHDRAWN.equals(target)) {
      throw new IllegalArgumentException("已绑定平台供应商的邀请须由供应商接受或拒绝，采购方仅可撤回");
    }
    return complete(invitation, request.action(), target, "采购方");
  }

  @Transactional
  public SupplierInvitationResponse respondSupplier(String id, RespondSupplierInvitationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("供应商合作邀请");
    permissions.require("supplier:profile:manage");
    TenantAccessGuard.requireUserId("供应商合作邀请");
    String target = target(request);
    if (SupplierInvitationStatus.WITHDRAWN.equals(target)) {
      throw new IllegalArgumentException("供应商仅可接受或拒绝合作邀请");
    }
    SupplierInvitation invitation = invitationMapper.lockBySupplierAndId(supplierId, id);
    if (invitation == null) {
      throw new IllegalArgumentException("未找到本企业的合作邀请");
    }
    return complete(invitation, request.action(), target, "供应商");
  }

  private String target(RespondSupplierInvitationRequest request) {
    if (request == null || request.action() == null) {
      throw new IllegalArgumentException("请选择邀请办理动作");
    }
    return SupplierInvitationStatus.resolveTarget(request.action());
  }

  private SupplierInvitationResponse complete(
      SupplierInvitation invitation, String action, String target, String actorSide) {
    SupplierInvitationStatus.requirePending(invitation.status());
    String tenantId = invitation.tenantId();
    String id = invitation.id();
    if (invitationMapper.respond(tenantId, id, target) != 1) {
      throw new IllegalStateException("邀请状态已变化，请刷新后重试");
    }

    // 接受且关联已知供应商、且尚未在私域库 → 桥接为待准入。
    if (SupplierInvitationStatus.bridgesToAdmission(target)
        && invitation.supplierId() != null) {
      relationMapper.insertIfAbsent(
          "bsr-" + UUID.randomUUID(),
          tenantId,
          invitation.supplierId(),
          "待准入",
          "普通",
          writeCategories(invitation.category()));
    }
    audit.recordTenantAction(
        tenantId, "supplier_invitation." + action, "supplier_invitation", id,
        actorSide + "办理邀请：" + target + (invitation.supplierId() == null ? "（线下反馈记录）" : ""));
    return toResponse(invitationMapper.findByTenantAndId(tenantId, id));
  }

  private SupplierInvitationResponse toResponse(SupplierInvitation i) {
    return new SupplierInvitationResponse(
        i.id(),
        i.supplierId(),
        i.supplierName(),
        i.contact(),
        i.category(),
        i.note(),
        i.status(),
        i.supplierId() != null,
        i.createdAt(),
        i.respondedAt(),
        i.buyerName());
  }

  private String writeCategories(String category) {
    try {
      return objectMapper.writeValueAsString(
          category == null || category.isBlank() ? List.of() : List.of(category));
    } catch (JsonProcessingException e) {
      return "[]";
    }
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
