package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
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
import com.procurement.mall.domain.MallCatalogPolicy;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.domain.MallTierPrice;
import com.procurement.mall.infrastructure.MallCatalogMapper;
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
  private final MallCatalogMapper mallCatalogMapper;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantCapabilityApplicationService tenantCapabilityApplicationService;

  public MallApplicationService(
      MallListingMapper mallListingMapper,
      MallCatalogMapper mallCatalogMapper,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      TenantCapabilityApplicationService tenantCapabilityApplicationService) {
    this.mallListingMapper = mallListingMapper;
    this.mallCatalogMapper = mallCatalogMapper;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantCapabilityApplicationService = tenantCapabilityApplicationService;
  }

  public List<MallListingResponse> listCurrentTenantListings(String status, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    // M-1:货架由商品/SKU 投影而来(响应里的 id 即 skuId),与供应商侧维护的模型同源。
    return mallCatalogMapper.listForTenant(tenantId, false, null, blankToNull(keyword)).stream()
        .flatMap(product -> mallCatalogMapper.listSkusForTenant(tenantId, product.id()).stream()
            .filter(sku -> status == null || status.isBlank() || status.equals(effectiveStatus(product, sku)))
            .map(sku -> toListingResponse(product, sku)))
        .toList();
  }

  /** 规格的对外状态:商品未在架时,规格一律呈现为下架。 */
  private static String effectiveStatus(MallProduct product, MallSku sku) {
    return MallCatalogPolicy.STATUS_ON_SHELF.equals(product.status())
        && MallCatalogPolicy.STATUS_ON_SHELF.equals(sku.status())
        ? MallCatalogPolicy.STATUS_ON_SHELF
        : MallCatalogPolicy.STATUS_OFF_SHELF;
  }

  private static MallListingResponse toListingResponse(MallProduct product, MallSku sku) {
    return new MallListingResponse(
        sku.id(), product.supplierId(), product.supplierName(), sku.materialId(),
        product.name(), sku.skuCode(), product.categoryName(), sku.unit(), sku.price(),
        effectiveStatus(product, sku), product.updatedAt(), product.tenantId(), null);
  }

  @Transactional
  public MallListingResponse publishListing(CreateMallListingRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallPolicy.requirePublishable(request.price());
    if (mallListingMapper.countAdmittedSupplier(tenantId, request.supplierId()) == 0) {
      throw new IllegalStateException("仅可为已准入供应商上架商品: " + request.supplierId());
    }
    // M-1:采购方录入协议价同样落新模型——建单规格商品 + SKU。
    MallCatalogMapper.MaterialBrief material =
        mallCatalogMapper.findMaterialBrief(tenantId, request.materialId());
    if (material == null) {
      throw new IllegalArgumentException("物料不存在: " + request.materialId());
    }
    String productId = "mp-" + UUID.randomUUID();
    mallCatalogMapper.insertProduct(
        productId, "tenant", tenantId, request.supplierId(), null, material.name(),
        "", "", null, MallCatalogPolicy.STATUS_ON_SHELF);
    String skuId = "ms-" + UUID.randomUUID();
    mallCatalogMapper.insertSkuForSupplier(
        skuId, productId, request.supplierId(), material.code(), "{}", request.materialId(),
        request.unit() == null || request.unit().isBlank() ? material.unit() : request.unit(),
        request.price(), BigDecimal.ONE, BigDecimal.ONE, null, 7);
    auditLogApplicationService.recordTenantAction(
        "mall_listing.published", AuditTargetType.MALL_LISTING, skuId);
    return toListingResponse(
        mallCatalogMapper.findProductForTenant(tenantId, productId),
        mallCatalogMapper.findSkuForTenant(tenantId, skuId));
  }

  @Transactional
  public MallListingResponse updateListingStatus(String listingId, UpdateMallListingStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    if (!MallListingStatus.isValid(request.status())) {
      throw new IllegalArgumentException("未知的货架状态: " + request.status());
    }
    MallSku sku = mallCatalogMapper.findSkuForTenant(tenantId, listingId);
    if (sku == null) {
      throw new IllegalArgumentException("商城商品不存在: " + listingId);
    }
    // 采购方对本租户私域商品的上下架:整个商品随之切换(单规格场景等价)。
    if (mallCatalogMapper.updateProductStatusByTenant(
        sku.productId(), tenantId, request.status()) == 0) {
      throw new IllegalStateException("公开专区商品由供应商自管,采购方不可下架: " + listingId);
    }
    auditLogApplicationService.recordTenantAction(
        "mall_listing.status_changed", AuditTargetType.MALL_LISTING, listingId);
    return toListingResponse(
        mallCatalogMapper.findProductForTenant(tenantId, sku.productId()),
        mallCatalogMapper.findSkuForTenant(tenantId, listingId));
  }

  // 目录直购:在架商品 × 数量 → 商城锚点 RFQ(方式=商城,已定标) + 采购订单(含单行明细)。
  @Transactional
  public MallOrderResponse createDirectOrder(CreateMallOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.MALL.code());
    CartLine line = resolveLine(tenantId, request.listingId(), request.quantity());

    BigDecimal amount = line.unitPrice().multiply(request.quantity());
    String rfqId = rfqApplicationService.createMallAnchor(
        "商城直购:" + line.product().name(), line.product().supplierId());
    // 交期:未指定时按 SKU 承诺交期推算,而不是一律「下单 +7 天」。
    LocalDate expectedReceiptDate = request.expectedReceiptDate() == null
        ? LocalDate.now().plusDays(line.sku().leadTimeDays())
        : request.expectedReceiptDate();
    String orderId = purchaseOrderApplicationService.createMallOrder(
        rfqId,
        line.product().supplierId(),
        amount,
        expectedReceiptDate,
        line.product().name(),
        line.sku().unit(),
        request.quantity(),
        line.unitPrice());
    deductStockIfTracked(tenantId, line);
    auditLogApplicationService.recordTenantAction(
        "mall_order.created", AuditTargetType.PURCHASE_ORDER, orderId);
    return new MallOrderResponse(
        orderId,
        rfqId,
        line.sku().id(),
        line.product().supplierId(),
        line.product().name(),
        request.quantity(),
        amount);
  }

  // 购物车结算:逐项校验在架与数量,按供应商合并成单(每供应商一张锚点 RFQ + 多行订单)。
  @Transactional
  public List<MallOrderResponse> checkoutCart(CreateMallCartRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    // M-0:商城直采未开通即拒绝下单。
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.MALL.code());
    java.util.LinkedHashMap<String, java.util.List<CartLine>> bySupplier = new java.util.LinkedHashMap<>();
    for (CreateMallCartRequest.CartItem item : request.items()) {
      // 请求里的 listingId 即 skuId(货架由商品/SKU 投影)。
      CartLine line = resolveLine(tenantId, item.listingId(), item.quantity());
      bySupplier
          .computeIfAbsent(line.product().supplierId(), key -> new java.util.ArrayList<>())
          .add(line);
    }
    LocalDate expectedReceiptDate = request.expectedReceiptDate() == null
        ? LocalDate.now().plusDays(7)
        : request.expectedReceiptDate();

    java.util.List<MallOrderResponse> orders = new java.util.ArrayList<>();
    for (java.util.Map.Entry<String, java.util.List<CartLine>> entry : bySupplier.entrySet()) {
      java.util.List<CartLine> lines = entry.getValue();
      BigDecimal amount = lines.stream()
          .map(l -> l.unitPrice().multiply(l.quantity()))
          .reduce(BigDecimal.ZERO, BigDecimal::add);
      BigDecimal totalQuantity = lines.stream()
          .map(CartLine::quantity)
          .reduce(BigDecimal.ZERO, BigDecimal::add);
      String title = lines.size() == 1
          ? "商城直购:" + lines.get(0).product().name()
          : "商城直购:" + lines.get(0).product().name() + " 等 " + lines.size() + " 项";
      String rfqId = rfqApplicationService.createMallAnchor(title, entry.getKey());
      String orderId = purchaseOrderApplicationService.createMallOrder(
          rfqId,
          entry.getKey(),
          amount,
          expectedReceiptDate,
          lines.stream()
              .map(l -> new PurchaseOrderApplicationService.DirectOrderLine(
                  l.product().name(), l.sku().unit(), l.quantity(), l.unitPrice()))
              .toList());
      // 成单后再扣库存:失败即整单回滚,不会出现「订单已生成、库存没扣」。
      lines.forEach(l -> deductStockIfTracked(tenantId, l));
      auditLogApplicationService.recordTenantAction(
          "mall_order.created", AuditTargetType.PURCHASE_ORDER, orderId);
      orders.add(new MallOrderResponse(
          orderId,
          rfqId,
          lines.get(0).sku().id(),
          entry.getKey(),
          title.replace("商城直购:", ""),
          totalQuantity,
          amount));
    }
    return orders;
  }

  /** 结算行:单价由服务端按阶梯价重算,不取前端传值。 */
  private record CartLine(
      MallProduct product, MallSku sku, BigDecimal quantity, BigDecimal unitPrice) {
  }

  private CartLine resolveLine(String tenantId, String skuId, BigDecimal quantity) {
    MallSku sku = mallCatalogMapper.findSkuForTenant(tenantId, skuId);
    if (sku == null) {
      throw new IllegalArgumentException("商品规格不存在或不在本企业可见范围: " + skuId);
    }
    MallProduct product = mallCatalogMapper.findProductForTenant(tenantId, sku.productId());
    MallCatalogPolicy.requireOrderable(product, sku, quantity);
    List<MallTierPrice> tiers = mallCatalogMapper.listTiersForTenant(tenantId, skuId);
    return new CartLine(
        product, sku, quantity, MallCatalogPolicy.effectivePrice(sku, tiers, quantity));
  }

  private void deductStockIfTracked(String tenantId, CartLine line) {
    if (line.sku().stockQty() == null) {
      return;
    }
    if (mallCatalogMapper.deductStock(tenantId, line.sku().id(), line.quantity()) == 0) {
      throw new IllegalStateException("库存不足,请调整数量后重试:" + line.product().name());
    }
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
    // M-1:同样由商品/SKU 投影,供应商在旧货架页与新商品页看到的是同一份数据。
    return mallCatalogMapper.listBySupplier(supplierId).stream()
        .flatMap(product -> mallCatalogMapper.listSkusForSupplier(supplierId, product.id()).stream()
            .map(sku -> toListingResponse(product, sku)))
        .toList();
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
    // M-1:一次上架 = 建一个单规格商品 + 一个 SKU,直接落新模型;旧 mall_listings 不再写入。
    SupplierMallMaterialResponse material = listSupplierMaterials().stream()
        .filter(m -> m.materialId().equals(request.materialId())
            && m.tenantId().equals(request.tenantId()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("物料不存在或不在该采购方目录内: " + request.materialId()));

    String productId = "mp-" + UUID.randomUUID();
    mallCatalogMapper.insertProduct(
        productId, "tenant", request.tenantId(), supplierId, null, material.name(), "", "",
        null, MallCatalogPolicy.STATUS_ON_SHELF);
    String skuId = "ms-" + UUID.randomUUID();
    mallCatalogMapper.insertSkuForSupplier(
        skuId, productId, supplierId, material.code(), "{}", request.materialId(),
        request.unit() == null || request.unit().isBlank() ? material.unit() : request.unit(),
        request.price(), BigDecimal.ONE, BigDecimal.ONE, null, 7);
    auditLogApplicationService.recordTenantAction(
        request.tenantId(), "mall_listing.supplier_published", AuditTargetType.MALL_LISTING, skuId);
    return toListingResponse(
        mallCatalogMapper.findProductForSupplier(supplierId, productId),
        mallCatalogMapper.findSkuForTenant(request.tenantId(), skuId));
  }

  @Transactional
  public MallListingResponse supplierUpdatePrice(String listingId, UpdateMallListingPriceRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallPolicy.requirePublishable(request.price());
    // listingId 即 skuId;沿用既有起订量/步进/库存/交期,仅改价。
    MallSku sku = requireOwnSku(supplierId, listingId);
    mallCatalogMapper.updateSkuForSupplier(
        listingId, supplierId, request.price(), sku.minOrderQty(), sku.stepQty(),
        sku.stockQty(), sku.leadTimeDays());
    MallProduct product = mallCatalogMapper.findProductForSupplier(supplierId, sku.productId());
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_listing.price_changed", AuditTargetType.MALL_LISTING, listingId);
    return toListingResponse(product, mallCatalogMapper.findSkuForTenant(product.tenantId(), listingId));
  }

  @Transactional
  public MallListingResponse supplierUpdateStatus(String listingId, UpdateMallListingStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    if (!MallListingStatus.isValid(request.status())) {
      throw new IllegalArgumentException("未知的货架状态: " + request.status());
    }
    MallSku sku = requireOwnSku(supplierId, listingId);
    mallCatalogMapper.updateSkuStatusForSupplier(listingId, supplierId, request.status());
    MallProduct product = mallCatalogMapper.findProductForSupplier(supplierId, sku.productId());
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_listing.status_changed", AuditTargetType.MALL_LISTING, listingId);
    return toListingResponse(product, mallCatalogMapper.findSkuForTenant(product.tenantId(), listingId));
  }

  private MallSku requireOwnSku(String supplierId, String skuId) {
    return mallCatalogMapper.listBySupplier(supplierId).stream()
        .flatMap(p -> mallCatalogMapper.listSkusForSupplier(supplierId, p.id()).stream())
        .filter(s -> s.id().equals(skuId))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException(
            "商城商品不存在或不属于当前供应商: " + skuId));
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
