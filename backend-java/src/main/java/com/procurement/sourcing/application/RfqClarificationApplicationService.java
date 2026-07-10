package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
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
  private final NotificationApplicationService notificationApplicationService;

  public RfqClarificationApplicationService(
      RfqMapper rfqMapper,
      RfqInviteMapper rfqInviteMapper,
      RfqClarificationMapper rfqClarificationMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.rfqClarificationMapper = rfqClarificationMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
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
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.RFQ_CLARIFICATION_ASKED,
        rfq.title() + " 收到受邀供应商的澄清提问,请在开标前答复。");
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
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    String message = (rfq == null ? "" : rfq.title()) + " 澄清已答复,请查看最新答疑内容。";
    if (Boolean.TRUE.equals(request.published())) {
      // 公平性:广播答复对全体受邀供应商同步(不泄露提问方身份)。
      for (String invitedSupplierId : rfqInviteMapper.listSupplierIds(tenantId, rfqId)) {
        notificationApplicationService.notifyActiveSupplierUsers(
            tenantId, invitedSupplierId, NotificationTitle.RFQ_CLARIFICATION_ANSWERED, message);
      }
    } else if (existing.supplierId() != null) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId, existing.supplierId(), NotificationTitle.RFQ_CLARIFICATION_ANSWERED, message);
    }
    return toResponse(rfqClarificationMapper.findByTenantAndId(tenantId, clarificationId));
  }

  // 采购方补遗公告:报价中主动向全体受邀供应商发布澄清/补遗(修正参数、顺延说明等),留痕并广播。
  @Transactional
  public RfqClarificationResponse publishBulletin(String rfqId, String content) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found in tenant scope: " + rfqId);
    }
    if (!RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("补遗公告仅可在报价中发布(开标后不得变更询价条件): " + rfqId);
    }
    if (content == null || content.isBlank()) {
      throw new IllegalArgumentException("补遗公告内容不能为空");
    }
    String id = "clar-" + UUID.randomUUID();
    rfqClarificationMapper.insertBulletin(id, tenantId, rfqId, "【采购方补遗公告】", content, userId);
    auditLogApplicationService.recordTenantAction(
        tenantId, "rfq.clarification_bulletin", "rfq", rfqId, "采购方发布补遗公告");
    for (String invitedSupplierId : rfqInviteMapper.listSupplierIds(tenantId, rfqId)) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId, invitedSupplierId, NotificationTitle.RFQ_CLARIFICATION_ANSWERED,
          rfq.title() + " 发布补遗公告,请查看并按最新要求报价。");
    }
    return toResponse(rfqClarificationMapper.findByTenantAndId(tenantId, id));
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
