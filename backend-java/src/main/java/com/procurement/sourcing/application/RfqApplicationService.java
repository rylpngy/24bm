package com.procurement.sourcing.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.api.QuoteLineItemResponse;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.api.UpdateRfqRequest;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqAuditAction;
import com.procurement.sourcing.domain.RfqDemandLinkPolicy;
import com.procurement.sourcing.domain.RfqInviteStatus;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.domain.RfqSupplierInvitationPolicy;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqApplicationService {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final SupplierQualificationMapper supplierQualificationMapper;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;

  public RfqApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      QuoteLineItemMapper quoteLineItemMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      SupplierQualificationMapper supplierQualificationMapper,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      RfqSourcingStatusTransition rfqSourcingStatusTransition,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  public List<RfqResponse> listCurrentTenantRfqs() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<RfqResponse> listCurrentTenantRfqs(String status, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public RfqResponse create(CreateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.RFQ);
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), "new RFQ");
    validateDemands(tenantId, request.demandIds());
    validateSuppliers(tenantId, request.invitedSupplierIds());

    String rfqId = newId("rfq");
    rfqMapper.insert(
        rfqId,
        tenantId,
        request.title(),
        RfqStatus.QUOTING,
        request.deadlineAt(),
        userId,
        orEmpty(request.quoteRequirement()),
        orEmpty(request.deliveryRequirement()),
        orDefaultEvaluation(request.evaluationMethod()));

    insertRfqDemandLinks(tenantId, rfqId, request.demandIds());

    for (String supplierId : request.invitedSupplierIds()) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
    }

    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.CREATED,
        AuditTargetType.RFQ,
        rfqId);
    for (String supplierId : request.invitedSupplierIds()) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_CREATED,
          request.title() + "已邀请您参与报价，请及时处理。");
    }

    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  @Transactional
  public RfqResponse update(String rfqId, UpdateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    Rfq rfq = rfqMapper.findByTenantAndId(tenantId, rfqId);
    if (rfq == null) {
      throw new IllegalArgumentException("RFQ not found: " + rfqId);
    }
    if (!RfqStatus.QUOTING.equals(rfq.status())) {
      throw new IllegalStateException("Only quoting RFQ can be updated: " + rfqId);
    }
    rfqSourcingStatusTransition.requireFutureDeadline(request.deadlineAt(), rfqId);
    validateSuppliers(tenantId, request.invitedSupplierIds());

    int updated = rfqMapper.updateQuotingDetails(
        tenantId,
        rfqId,
        request.title(),
        request.deadlineAt(),
        orEmpty(request.quoteRequirement()),
        orEmpty(request.deliveryRequirement()),
        orDefaultEvaluation(request.evaluationMethod()));
    if (updated == 0) {
      throw new IllegalStateException("RFQ status changed before update could be saved: " + rfqId);
    }

    rfqInviteMapper.deleteByRfq(tenantId, rfqId);
    for (String supplierId : request.invitedSupplierIds()) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
    }

    auditLogApplicationService.recordTenantAction(
        RfqAuditAction.UPDATED,
        AuditTargetType.RFQ,
        rfqId);
    for (String supplierId : request.invitedSupplierIds()) {
      notificationApplicationService.notifyActiveSupplierUsers(
          tenantId,
          supplierId,
          NotificationTitle.RFQ_INVITATION_UPDATED,
          request.title() + "已更新询价信息，请按最新要求报价。");
    }

    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  private void validateDemands(String tenantId, List<String> demandIds) {
    for (String demandId : demandIds) {
      PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, demandId);
      if (demand == null) {
        throw new IllegalArgumentException("Purchase demand not found in tenant scope: " + demandId);
      }
      rfqSourcingStatusTransition.requireApprovedDemandForRfq(demand.status(), demandId);
      RfqDemandLinkPolicy.requireUnlinkedDemand(
          rfqDemandMapper.countByTenantAndDemand(tenantId, demandId),
          demandId);
    }
  }

  private void insertRfqDemandLinks(String tenantId, String rfqId, List<String> demandIds) {
    for (String demandId : demandIds) {
      try {
        rfqDemandMapper.insert(newId("rfq-demand"), tenantId, rfqId, demandId);
      } catch (DuplicateKeyException exception) {
        RfqDemandLinkPolicy.requireUnlinkedDemand(1, demandId);
        throw exception;
      }
    }
  }

  private void validateSuppliers(String tenantId, List<String> supplierIds) {
    RfqSupplierInvitationPolicy.requireValidInviteList(supplierIds);
    for (String supplierId : supplierIds) {
      RfqSupplierInvitationPolicy.requireAdmittedSupplier(
          buyerSupplierRelationMapper.countByTenantSupplierAndStatus(
              tenantId,
              supplierId,
              BuyerSupplierRelationStatus.ADMITTED),
          supplierId);
      RfqSupplierInvitationPolicy.requireActiveQualification(
          supplierQualificationMapper.listActiveBySupplier(supplierId).size(),
          supplierId);
    }
  }

  private RfqResponse toResponse(Rfq rfq) {
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
        quoteMapper.listByTenantAndRfq(rfq.tenantId(), rfq.id()).stream()
            .map(this::toQuoteResponse)
            .toList(),
        rfq.quoteRequirement(),
        rfq.deliveryRequirement(),
        rfq.evaluationMethod());
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value;
  }

  private static String orDefaultEvaluation(String value) {
    return value == null || value.isBlank() ? "最低价" : value;
  }

  private QuoteResponse toQuoteResponse(Quote quote) {
    List<QuoteLineItem> lines = quoteLineItemMapper.listByQuote(quote.tenantId(), quote.id());
    List<QuoteLineItemResponse> lineItems =
        lines == null
            ? List.of()
            : lines.stream()
                .map(
                    l ->
                        new QuoteLineItemResponse(
                            l.id(),
                            l.description(),
                            l.unit(),
                            l.quantity(),
                            l.unitPrice(),
                            l.lineAmount()))
                .toList();
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
        lineItems);
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
