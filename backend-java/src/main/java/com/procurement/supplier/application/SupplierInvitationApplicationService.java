package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.common.tenant.TenantAccessGuard;
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

  public SupplierInvitationApplicationService(
      SupplierInvitationMapper invitationMapper,
      BuyerSupplierRelationMapper relationMapper,
      ObjectMapper objectMapper) {
    this.invitationMapper = invitationMapper;
    this.relationMapper = relationMapper;
    this.objectMapper = objectMapper;
  }

  public List<SupplierInvitationResponse> listInvitations() {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    return invitationMapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  @Transactional
  public SupplierInvitationResponse createInvitation(CreateSupplierInvitationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    String id = "inv-" + UUID.randomUUID();
    invitationMapper.insert(
        id,
        tenantId,
        blankToNull(request.supplierId()),
        request.supplierName(),
        blankToNull(request.contact()),
        blankToNull(request.category()),
        blankToNull(request.note()),
        SupplierInvitationStatus.PENDING);
    return toResponse(invitationMapper.findByTenantAndId(tenantId, id));
  }

  @Transactional
  public SupplierInvitationResponse respond(String id, RespondSupplierInvitationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier invitation APIs");
    SupplierInvitation invitation = invitationMapper.findByTenantAndId(tenantId, id);
    if (invitation == null) {
      throw new IllegalArgumentException("邀请单不存在: " + id);
    }
    SupplierInvitationStatus.requirePending(invitation.status());
    String target = SupplierInvitationStatus.resolveTarget(request.action());
    invitationMapper.respond(tenantId, id, target);

    // 接受且关联已知供应商、且尚未在私域库 → 桥接为待准入。
    if (SupplierInvitationStatus.bridgesToAdmission(target)
        && invitation.supplierId() != null
        && relationMapper.countByTenantSupplier(tenantId, invitation.supplierId()) == 0) {
      relationMapper.insert(
          "bsr-" + UUID.randomUUID(),
          tenantId,
          invitation.supplierId(),
          "待准入",
          "普通",
          writeCategories(invitation.category()));
    }
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
        i.respondedAt());
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
