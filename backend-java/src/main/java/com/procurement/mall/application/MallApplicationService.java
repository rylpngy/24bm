package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.CreateMallListingRequest;
import com.procurement.mall.api.CreateMallOrderRequest;
import com.procurement.mall.api.MallListingResponse;
import com.procurement.mall.api.MallOrderResponse;
import com.procurement.mall.api.UpdateMallListingStatusRequest;
import com.procurement.mall.domain.MallListing;
import com.procurement.mall.domain.MallListingStatus;
import com.procurement.mall.domain.MallPolicy;
import com.procurement.mall.infrastructure.MallListingMapper;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.RfqApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MallApplicationService {
  private final MallListingMapper mallListingMapper;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public MallApplicationService(
      MallListingMapper mallListingMapper,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.mallListingMapper = mallListingMapper;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<MallListingResponse> listCurrentTenantListings(String status, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallListingMapper.listByTenant(tenantId, blankToNull(status), blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public MallListingResponse publishListing(CreateMallListingRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallPolicy.requirePublishable(request.price());
    if (mallListingMapper.countAdmittedSupplier(tenantId, request.supplierId()) == 0) {
      throw new IllegalStateException("仅可为已准入供应商上架商品: " + request.supplierId());
    }
    String listingId = "mall-" + UUID.randomUUID();
    mallListingMapper.insert(
        listingId,
        tenantId,
        request.supplierId(),
        request.materialId(),
        request.price(),
        request.unit() == null || request.unit().isBlank() ? "件" : request.unit(),
        MallListingStatus.ON_SHELF);
    auditLogApplicationService.recordTenantAction(
        "mall_listing.published", AuditTargetType.MALL_LISTING, listingId);
    return toResponse(mallListingMapper.findByTenantAndId(tenantId, listingId));
  }

  @Transactional
  public MallListingResponse updateListingStatus(String listingId, UpdateMallListingStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    if (!MallListingStatus.isValid(request.status())) {
      throw new IllegalArgumentException("未知的货架状态: " + request.status());
    }
    int updated = mallListingMapper.updateStatus(tenantId, listingId, request.status());
    if (updated == 0) {
      throw new IllegalArgumentException("商城商品不存在: " + listingId);
    }
    auditLogApplicationService.recordTenantAction(
        "mall_listing.status_changed", AuditTargetType.MALL_LISTING, listingId);
    return toResponse(mallListingMapper.findByTenantAndId(tenantId, listingId));
  }

  // 目录直购:在架商品 × 数量 → 商城锚点 RFQ(方式=商城,已定标) + 采购订单(含单行明细)。
  @Transactional
  public MallOrderResponse createDirectOrder(CreateMallOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallListing listing = mallListingMapper.findByTenantAndId(tenantId, request.listingId());
    MallPolicy.requireOrderable(listing, request.quantity(), request.listingId());

    BigDecimal amount = listing.price().multiply(request.quantity());
    String rfqId = rfqApplicationService.createMallAnchor(
        "商城直购:" + listing.materialName(), listing.supplierId());
    LocalDate expectedReceiptDate = request.expectedReceiptDate() == null
        ? LocalDate.now().plusDays(7)
        : request.expectedReceiptDate();
    String orderId = purchaseOrderApplicationService.createMallOrder(
        rfqId,
        listing.supplierId(),
        amount,
        expectedReceiptDate,
        listing.materialName(),
        listing.unit(),
        request.quantity(),
        listing.price());
    auditLogApplicationService.recordTenantAction(
        "mall_order.created", AuditTargetType.PURCHASE_ORDER, orderId);
    return new MallOrderResponse(
        orderId,
        rfqId,
        listing.id(),
        listing.supplierId(),
        listing.materialName(),
        request.quantity(),
        amount);
  }

  private MallListingResponse toResponse(MallListing listing) {
    return new MallListingResponse(
        listing.id(),
        listing.supplierId(),
        listing.supplierName(),
        listing.materialId(),
        listing.materialName(),
        listing.materialCode(),
        listing.category(),
        listing.unit(),
        listing.price(),
        listing.status(),
        listing.updatedAt());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
