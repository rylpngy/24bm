package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.AnswerClarificationRequest;
import com.procurement.sourcing.api.AskClarificationRequest;
import com.procurement.sourcing.api.RfqClarificationResponse;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqClarification;
import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.infrastructure.RfqClarificationMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 询价澄清答疑:受邀供应商提问(报价中)、采购方答复(可广播),买/供两端各自可见性。
@Service
public class RfqClarificationApplicationService {

  private final RfqMapper rfqMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final RfqClarificationMapper rfqClarificationMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public RfqClarificationApplicationService(
      RfqMapper rfqMapper,
      RfqInviteMapper rfqInviteMapper,
      RfqClarificationMapper rfqClarificationMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.rfqMapper = rfqMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.rfqClarificationMapper = rfqClarificationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  // 采购方:看该 RFQ 全部澄清。
  public List<RfqClarificationResponse> listForBuyer(String rfqId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqClarificationMapper.listByTenantAndRfq(tenantId, rfqId).stream()
        .map(this::toResponse)
        .toList();
  }

  // 供应商:看自己的提问 + 已广播答复。
  public List<RfqClarificationResponse> listForSupplier(String rfqId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier RFQ APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    return rfqClarificationMapper.listForSupplier(rfq.tenantId(), rfqId, supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  // 供应商提问:仅「报价中」可提问(答疑窗口在开标前)。
  @Transactional
  public RfqClarificationResponse ask(String rfqId, AskClarificationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier RFQ APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    if (!RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("Clarifications can only be raised while quoting: " + rfqId);
    }
    String id = "clar-" + UUID.randomUUID();
    rfqClarificationMapper.insert(id, rfq.tenantId(), rfqId, supplierId, request.question());
    auditLogApplicationService.recordTenantAction(
        rfq.tenantId(), "rfq.clarification_asked", "rfq", rfqId, "供应商提出澄清问题");
    return toResponse(rfqClarificationMapper.findByTenantAndId(rfq.tenantId(), id));
  }

  // 采购方答复:可选广播给全部受邀供应商。
  @Transactional
  public RfqClarificationResponse answer(
      String rfqId, String clarificationId, AnswerClarificationRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    RfqClarification existing = rfqClarificationMapper.findByTenantAndId(tenantId, clarificationId);
    if (existing == null || !rfqId.equals(existing.rfqId())) {
      throw new IllegalArgumentException("Clarification not found in RFQ scope: " + clarificationId);
    }
    int updated = rfqClarificationMapper.answer(
        tenantId, clarificationId, request.answer(), userId, request.published());
    if (updated == 0) {
      throw new IllegalStateException("Clarification could not be answered: " + clarificationId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId, "rfq.clarification_answered", "rfq", rfqId,
        request.published() ? "采购方答复并广播" : "采购方答复(仅提问方可见)");
    return toResponse(rfqClarificationMapper.findByTenantAndId(tenantId, clarificationId));
  }

  private Rfq findRfqForInvitedSupplier(String rfqId, String supplierId) {
    Rfq rfq = rfqMapper.findBySupplierInvite(rfqId, supplierId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found for invited supplier: " + rfqId);
    }
    int inviteCount = rfqInviteMapper.isSupplierInvited(rfq.tenantId(), rfqId, supplierId);
    RfqQuoteInvitationPolicy.requireInvitedSupplier(inviteCount, rfqId);
    return rfq;
  }

  private RfqClarificationResponse toResponse(RfqClarification c) {
    return new RfqClarificationResponse(
        c.id(),
        c.rfqId(),
        c.supplierId(),
        c.question(),
        c.answer(),
        c.answer() != null,
        c.published(),
        c.askedAt(),
        c.answeredAt());
  }
}
