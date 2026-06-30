package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.api.QuoteLineItemRequest;
import com.procurement.sourcing.api.QuoteLineItemResponse;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteAuditAction;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import com.procurement.sourcing.domain.RfqQuoteSubmissionPolicy;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuoteApplicationService {
  private final RfqMapper rfqMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final QuoteMapper quoteMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public QuoteApplicationService(
      RfqMapper rfqMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      QuoteMapper quoteMapper,
      QuoteLineItemMapper quoteLineItemMapper,
      RfqSourcingStatusTransition rfqSourcingStatusTransition,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.quoteMapper = quoteMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public List<RfqResponse> listSupplierRfqs() {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return rfqMapper.listBySupplierInvite(supplierId).stream()
        .map(this::toRfqResponse)
        .toList();
  }

  public List<RfqResponse> listSupplierRfqs(String status, String keyword) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return rfqMapper.listBySupplierInviteFiltered(
            supplierId,
            blankToNull(status),
            blankToNull(keyword))
        .stream()
        .map(this::toRfqResponse)
        .toList();
  }

  public List<QuoteResponse> listSupplierQuotes() {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return quoteMapper.listBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<QuoteResponse> listSupplierQuotes(String rfqId, String status) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    return quoteMapper.listBySupplierFiltered(
            supplierId,
            blankToNull(rfqId),
            blankToNull(status))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public QuoteResponse submit(String rfqId, SubmitQuoteRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Rfq rfq = findRfqForInvitedSupplier(rfqId, supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfqId);
    rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfqId);

    int submittedCount = quoteMapper.countSubmittedBySupplier(
        rfq.tenantId(),
        rfqId,
        supplierId,
        rfq.currentRound());
    RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(submittedCount, rfqId);

    String quoteId = newId("quote");
    BigDecimal amount = effectiveAmount(request.amount(), request.lineItems());
    try {
      quoteMapper.insert(
          quoteId,
          rfq.tenantId(),
          rfqId,
          supplierId,
          amount,
          request.taxRate(),
          request.deliveryDays(),
          QuoteStatus.SUBMITTED,
          rfq.currentRound());
    } catch (DuplicateKeyException exception) {
      RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(1, rfqId);
      throw exception;
    }
    persistLineItems(rfq.tenantId(), quoteId, request.lineItems());

    // 供应商无租户上下文,审计需显式落到 RFQ 所属租户(否则 requireTenantId 抛错)。
    auditLogApplicationService.recordTenantAction(
        rfq.tenantId(),
        QuoteAuditAction.SUBMITTED,
        AuditTargetType.QUOTE,
        quoteId);
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.SUPPLIER_QUOTE_SUBMITTED,
        rfq.title() + "已收到供应商报价，请进入报价对比处理。");
    return toResponse(quoteMapper.findByTenantAndId(rfq.tenantId(), quoteId));
  }

  @Transactional
  public QuoteResponse update(String quoteId, UpdateQuoteRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Quote quote = quoteMapper.findBySupplierAndId(supplierId, quoteId);
    if (quote == null) {
      throw new IllegalArgumentException("Quote not found for supplier: " + quoteId);
    }
    if (QuoteStatus.LOCKED.equals(quote.status())) {
      throw new IllegalStateException("Locked supplier quote cannot be updated: " + quoteId);
    }

    Rfq rfq = findRfqForInvitedSupplier(quote.rfqId(), supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfq.id());
    rfqSourcingStatusTransition.requireOpenQuoteDeadline(rfq.deadlineAt(), rfq.id());

    BigDecimal amount = effectiveAmount(request.amount(), request.lineItems());
    int updated = quoteMapper.updateSubmittedQuote(
        quote.tenantId(),
        quoteId,
        supplierId,
        amount,
        request.taxRate(),
        request.deliveryDays(),
        QuoteStatus.SUBMITTED);
    if (updated == 0) {
      throw new IllegalStateException("Only submitted supplier quote can be updated: " + quoteId);
    }
    persistLineItems(quote.tenantId(), quoteId, request.lineItems());

    auditLogApplicationService.recordTenantAction(
        rfq.tenantId(),
        QuoteAuditAction.UPDATED,
        AuditTargetType.QUOTE,
        quoteId);
    notificationApplicationService.notifyActiveTenantUsers(
        rfq.tenantId(),
        NotificationTitle.SUPPLIER_QUOTE_SUBMITTED,
        rfq.title() + "供应商报价已更新，请重新查看报价对比。");
    return toResponse(quoteMapper.findByTenantAndId(quote.tenantId(), quoteId));
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

  private QuoteResponse toResponse(Quote quote) {
    return new QuoteResponse(
        quote.id(),
        quote.tenantId(),
        quote.rfqId(),
        quote.supplierId(),
        quote.amount(),
        quote.taxRate(),
        quote.deliveryDays(),
        quote.status(),
        quote.submittedAt(),
        lineItemResponses(quote.tenantId(), quote.id()));
  }

  // 行项明细持久化:全量替换(先删后插),行金额按 数量 × 单价 计算。
  private void persistLineItems(
      String tenantId, String quoteId, List<QuoteLineItemRequest> lineItems) {
    quoteLineItemMapper.deleteByQuote(tenantId, quoteId);
    if (lineItems == null || lineItems.isEmpty()) {
      return;
    }
    int sortNo = 0;
    for (QuoteLineItemRequest line : lineItems) {
      BigDecimal lineAmount = line.quantity().multiply(line.unitPrice());
      String unit = line.unit() == null || line.unit().isBlank() ? "项" : line.unit();
      quoteLineItemMapper.insert(
          newId("qli"),
          tenantId,
          quoteId,
          line.description(),
          unit,
          line.quantity(),
          line.unitPrice(),
          lineAmount,
          sortNo++);
    }
  }

  private List<QuoteLineItemResponse> lineItemResponses(String tenantId, String quoteId) {
    List<QuoteLineItem> lines = quoteLineItemMapper.listByQuote(tenantId, quoteId);
    if (lines == null) {
      return List.of();
    }
    return lines.stream()
        .map(
            l ->
                new QuoteLineItemResponse(
                    l.id(), l.description(), l.unit(), l.quantity(), l.unitPrice(), l.lineAmount()))
        .toList();
  }

  // 提供行项时按行汇总覆盖报价头金额(头/明细一致);否则沿用供应商填写的 amount。
  private BigDecimal effectiveAmount(BigDecimal headerAmount, List<QuoteLineItemRequest> lineItems) {
    if (lineItems == null || lineItems.isEmpty()) {
      return headerAmount;
    }
    return lineItems.stream()
        .map(l -> l.quantity().multiply(l.unitPrice()))
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  // 供应商侧:不回传其它供应商报价明细(封存),但需带上轮次/开标态供前端展示。
  private RfqResponse toRfqResponse(Rfq rfq) {
    return new RfqResponse(
        rfq.id(),
        rfq.tenantId(),
        rfq.title(),
        rfq.status(),
        rfq.deadlineAt(),
        rfq.ownerId(),
        rfq.awardedSupplierId(),
        rfq.createdAt(),
        rfq.updatedAt(),
        rfqDemandMapper.listDemandIds(rfq.tenantId(), rfq.id()),
        rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id()),
        java.util.List.of(),
        rfq.quoteRequirement(),
        rfq.deliveryRequirement(),
        rfq.evaluationMethod(),
        rfq.openedAt(),
        rfq.currentRound(),
        rfq.finalRound());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
