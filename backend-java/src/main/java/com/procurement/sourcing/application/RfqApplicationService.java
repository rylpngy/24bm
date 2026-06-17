package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.api.QuoteResponse;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqDemandLinkPolicy;
import com.procurement.sourcing.domain.RfqInviteStatus;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.domain.RfqStatus;
import com.procurement.sourcing.domain.RfqSupplierInvitationPolicy;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqApplicationService {
  private final RfqMapper rfqMapper;
  private final QuoteMapper quoteMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final RfqSourcingStatusTransition rfqSourcingStatusTransition;

  public RfqApplicationService(
      RfqMapper rfqMapper,
      QuoteMapper quoteMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      RfqSourcingStatusTransition rfqSourcingStatusTransition) {
    this.rfqMapper = rfqMapper;
    this.quoteMapper = quoteMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.rfqSourcingStatusTransition = rfqSourcingStatusTransition;
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
    validateDemands(tenantId, request.demandIds());
    validateSuppliers(tenantId, request.invitedSupplierIds());

    String rfqId = newId("rfq");
    rfqMapper.insert(rfqId, tenantId, request.title(), RfqStatus.QUOTING, request.deadlineAt(), userId);

    for (String demandId : request.demandIds()) {
      rfqDemandMapper.insert(newId("rfq-demand"), tenantId, rfqId, demandId);
    }

    for (String supplierId : request.invitedSupplierIds()) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, RfqInviteStatus.INVITED);
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

  private void validateSuppliers(String tenantId, List<String> supplierIds) {
    for (String supplierId : supplierIds) {
      RfqSupplierInvitationPolicy.requireAdmittedSupplier(
          buyerSupplierRelationMapper.countByTenantSupplierAndStatus(
              tenantId,
              supplierId,
              BuyerSupplierRelationStatus.ADMITTED),
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
            .toList());
  }

  private QuoteResponse toQuoteResponse(Quote quote) {
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

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
