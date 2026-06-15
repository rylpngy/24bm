package com.procurement.sourcing.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.sourcing.api.CreateRfqRequest;
import com.procurement.sourcing.api.RfqResponse;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RfqApplicationService {
  private static final String APPROVED_DEMAND_STATUS = "已通过";
  private static final String APPROVED_SUPPLIER_STATUS = "已准入";
  private static final String QUOTING_STATUS = "报价中";
  private static final String INVITED_STATUS = "已邀请";
  private static final String RFQ_FEATURE = "rfq";

  private final RfqMapper rfqMapper;
  private final RfqDemandMapper rfqDemandMapper;
  private final RfqInviteMapper rfqInviteMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;

  public RfqApplicationService(
      RfqMapper rfqMapper,
      RfqDemandMapper rfqDemandMapper,
      RfqInviteMapper rfqInviteMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      TenantFeatureApplicationService tenantFeatureApplicationService) {
    this.rfqMapper = rfqMapper;
    this.rfqDemandMapper = rfqDemandMapper;
    this.rfqInviteMapper = rfqInviteMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
  }

  public List<RfqResponse> listCurrentTenantRfqs() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    return rfqMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public RfqResponse create(CreateRfqRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer RFQ APIs");
    String userId = TenantAccessGuard.requireUserId("buyer RFQ APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, RFQ_FEATURE);
    validateDemands(tenantId, request.demandIds());
    validateSuppliers(tenantId, request.invitedSupplierIds());

    String rfqId = newId("rfq");
    rfqMapper.insert(rfqId, tenantId, request.title(), QUOTING_STATUS, request.deadlineAt(), userId);

    for (String demandId : request.demandIds()) {
      rfqDemandMapper.insert(newId("rfq-demand"), tenantId, rfqId, demandId);
    }

    for (String supplierId : request.invitedSupplierIds()) {
      rfqInviteMapper.insert(newId("rfq-invite"), tenantId, rfqId, supplierId, INVITED_STATUS);
    }

    return toResponse(rfqMapper.findByTenantAndId(tenantId, rfqId));
  }

  private void validateDemands(String tenantId, List<String> demandIds) {
    for (String demandId : demandIds) {
      PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, demandId);
      if (demand == null) {
        throw new IllegalArgumentException("Purchase demand not found in tenant scope: " + demandId);
      }
      if (!APPROVED_DEMAND_STATUS.equals(demand.status())) {
        throw new IllegalStateException("RFQ can only use approved purchase demands: " + demandId);
      }
      if (rfqDemandMapper.countByTenantAndDemand(tenantId, demandId) > 0) {
        throw new IllegalStateException("Purchase demand already linked to an RFQ: " + demandId);
      }
    }
  }

  private void validateSuppliers(String tenantId, List<String> supplierIds) {
    for (String supplierId : supplierIds) {
      int count = buyerSupplierRelationMapper.countByTenantSupplierAndStatus(tenantId, supplierId, APPROVED_SUPPLIER_STATUS);
      if (count == 0) {
        throw new IllegalStateException("Supplier is not approved for tenant RFQ: " + supplierId);
      }
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
        rfqInviteMapper.listSupplierIds(rfq.tenantId(), rfq.id()));
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }
}
