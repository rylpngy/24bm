package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqQuoteInvitationPolicy;
import com.procurement.sourcing.domain.RfqQuoteSubmissionPolicy;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuoteApplicationService {
  private final RfqMapper rfqMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final QuoteMapper quoteMapper;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;

  public QuoteApplicationService(
      RfqMapper rfqMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      QuoteMapper quoteMapper,
      RfqSourcingStatusTransition rfqSourcingStatusTransition) {
    this.rfqMapper = rfqMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.quoteMapper = quoteMapper;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
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

    int submittedCount = quoteMapper.countSubmittedBySupplier(
        rfq.tenantId(),
        rfqId,
        supplierId,
        QuoteStatus.SUBMITTED);
    RfqQuoteSubmissionPolicy.requireNoSubmittedQuote(submittedCount, rfqId);

    String quoteId = newId("quote");
    quoteMapper.insert(
        quoteId,
        rfq.tenantId(),
        rfqId,
        supplierId,
        request.amount(),
        request.taxRate(),
        request.deliveryDays(),
        QuoteStatus.SUBMITTED);

    return toResponse(quoteMapper.findByTenantAndId(rfq.tenantId(), quoteId));
  }

  @Transactional
  public QuoteResponse update(String quoteId, UpdateQuoteRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("quote APIs");
    Quote quote = quoteMapper.findBySupplierAndId(supplierId, quoteId);
    if (quote == null) {
      throw new IllegalArgumentException("Quote not found for supplier: " + quoteId);
    }

    Rfq rfq = findRfqForInvitedSupplier(quote.rfqId(), supplierId);
    rfqSourcingStatusTransition.requireQuotingForQuoteSubmission(rfq.status(), rfq.id());

    int updated = quoteMapper.updateSubmittedQuote(
        quote.tenantId(),
        quoteId,
        supplierId,
        request.amount(),
        request.taxRate(),
        request.deliveryDays(),
        QuoteStatus.SUBMITTED);
    if (updated == 0) {
      throw new IllegalStateException("Only submitted supplier quote can be updated: " + quoteId);
    }

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
        quote.submittedAt());
  }

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
        rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id()));
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
