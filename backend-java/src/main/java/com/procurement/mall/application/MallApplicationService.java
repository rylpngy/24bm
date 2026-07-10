package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.CreateMallCartRequest;
import com.procurement.mall.api.CreateMallListingRequest;
import com.procurement.mall.api.CreateMallOrderRequest;
import com.procurement.mall.api.MallAnalyticsResponse;
import com.procurement.mall.api.MallListingResponse;
import com.procurement.mall.api.MallSupplierSpendResponse;
import com.procurement.mall.api.MallOrderResponse;
import com.procurement.mall.api.SupplierMallMaterialResponse;
import com.procurement.mall.api.SupplierPublishMallListingRequest;
import com.procurement.mall.api.UpdateMallListingPriceRequest;
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

  // 购物车结算:逐项校验在架与数量,按供应商合并成单(每供应商一张锚点 RFQ + 多行订单)。
  @Transactional
  public List<MallOrderResponse> checkoutCart(CreateMallCartRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    java.util.LinkedHashMap<String, java.util.List<CartLine>> bySupplier = new java.util.LinkedHashMap<>();
    for (CreateMallCartRequest.CartItem item : request.items()) {
      MallListing listing = mallListingMapper.findByTenantAndId(tenantId, item.listingId());
      MallPolicy.requireOrderable(listing, item.quantity(), item.listingId());
      bySupplier
          .computeIfAbsent(listing.supplierId(), key -> new java.util.ArrayList<>())
          .add(new CartLine(listing, item.quantity()));
    }
    LocalDate expectedReceiptDate = request.expectedReceiptDate() == null
        ? LocalDate.now().plusDays(7)
        : request.expectedReceiptDate();

    java.util.List<MallOrderResponse> orders = new java.util.ArrayList<>();
    for (java.util.Map.Entry<String, java.util.List<CartLine>> entry : bySupplier.entrySet()) {
      java.util.List<CartLine> lines = entry.getValue();
      BigDecimal amount = lines.stream()
          .map(l -> l.listing().price().multiply(l.quantity()))
          .reduce(BigDecimal.ZERO, BigDecimal::add);
      BigDecimal totalQuantity = lines.stream()
          .map(CartLine::quantity)
          .reduce(BigDecimal.ZERO, BigDecimal::add);
      String title = lines.size() == 1
          ? "商城直购:" + lines.get(0).listing().materialName()
          : "商城直购:" + lines.get(0).listing().materialName() + " 等 " + lines.size() + " 项";
      String rfqId = rfqApplicationService.createMallAnchor(title, entry.getKey());
      String orderId = purchaseOrderApplicationService.createMallOrder(
          rfqId,
          entry.getKey(),
          amount,
          expectedReceiptDate,
          lines.stream()
              .map(l -> new PurchaseOrderApplicationService.DirectOrderLine(
                  l.listing().materialName(), l.listing().unit(), l.quantity(), l.listing().price()))
              .toList());
      auditLogApplicationService.recordTenantAction(
          "mall_order.created", AuditTargetType.PURCHASE_ORDER, orderId);
      orders.add(new MallOrderResponse(
          orderId,
          rfqId,
          lines.get(0).listing().id(),
          entry.getKey(),
          title.replace("商城直购:", ""),
          totalQuantity,
          amount));
    }
    return orders;
  }

  private record CartLine(MallListing listing, BigDecimal quantity) {
  }

  // 商城消费分析:商城渠道订单量/金额与供应商集中度。
  public MallAnalyticsResponse mallAnalytics() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    java.util.List<com.procurement.mall.domain.MallSupplierSpend> spend =
        mallListingMapper.mallSpendBySupplier(tenantId);
    BigDecimal total = spend.stream()
        .map(com.procurement.mall.domain.MallSupplierSpend::totalAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    int orders = spend.stream()
        .mapToInt(com.procurement.mall.domain.MallSupplierSpend::orderCount)
        .sum();
    return new MallAnalyticsResponse(
        orders,
        total,
        mallListingMapper.countOnShelf(tenantId),
        spend.stream()
            .map(sp -> new MallSupplierSpendResponse(
                sp.supplierId(), sp.supplierName(), sp.orderCount(), sp.totalAmount()))
            .toList());
  }

  // ====== 供应商自助货架 ======

  public List<MallListingResponse> listSupplierListings() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    return mallListingMapper.listBySupplier(supplierId).stream().map(this::toResponse).toList();
  }

  public List<SupplierMallMaterialResponse> listSupplierMaterials() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    return mallListingMapper.listMaterialsForSupplier(supplierId).stream()
        .map(m -> new SupplierMallMaterialResponse(
            m.tenantId(), m.tenantName(), m.materialId(), m.name(), m.code(),
            m.category(), m.unit(), m.referencePrice()))
        .toList();
  }

  @Transactional
  public MallListingResponse supplierPublishListing(SupplierPublishMallListingRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallPolicy.requirePublishable(request.price());
    if (mallListingMapper.countAdmittedRelation(request.tenantId(), supplierId) == 0) {
      throw new IllegalStateException("仅可向已准入的采购方上架商品: " + request.tenantId());
    }
    String listingId = "mall-" + UUID.randomUUID();
    mallListingMapper.insert(
        listingId,
        request.tenantId(),
        supplierId,
        request.materialId(),
        request.price(),
        request.unit() == null || request.unit().isBlank() ? "件" : request.unit(),
        MallListingStatus.ON_SHELF);
    auditLogApplicationService.recordTenantAction(
        request.tenantId(), "mall_listing.supplier_published", AuditTargetType.MALL_LISTING, listingId);
    return toResponse(mallListingMapper.findBySupplierAndId(supplierId, listingId));
  }

  @Transactional
  public MallListingResponse supplierUpdatePrice(String listingId, UpdateMallListingPriceRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallPolicy.requirePublishable(request.price());
    if (mallListingMapper.updatePriceBySupplier(supplierId, listingId, request.price()) == 0) {
      throw new IllegalArgumentException("商城商品不存在或不属于当前供应商: " + listingId);
    }
    MallListing listing = mallListingMapper.findBySupplierAndId(supplierId, listingId);
    auditLogApplicationService.recordTenantAction(
        listing.tenantId(), "mall_listing.price_changed", AuditTargetType.MALL_LISTING, listingId);
    return toResponse(listing);
  }

  @Transactional
  public MallListingResponse supplierUpdateStatus(String listingId, UpdateMallListingStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    if (!MallListingStatus.isValid(request.status())) {
      throw new IllegalArgumentException("未知的货架状态: " + request.status());
    }
    if (mallListingMapper.updateStatusBySupplier(supplierId, listingId, request.status()) == 0) {
      throw new IllegalArgumentException("商城商品不存在或不属于当前供应商: " + listingId);
    }
    MallListing listing = mallListingMapper.findBySupplierAndId(supplierId, listingId);
    auditLogApplicationService.recordTenantAction(
        listing.tenantId(), "mall_listing.status_changed", AuditTargetType.MALL_LISTING, listingId);
    return toResponse(listing);
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
        listing.updatedAt(),
        listing.tenantId(),
        listing.tenantName());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
