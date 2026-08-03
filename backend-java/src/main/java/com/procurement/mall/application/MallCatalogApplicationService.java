package com.procurement.mall.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.MallProductResponse;
import com.procurement.mall.api.SaveMallProductRequest;
import com.procurement.mall.api.ReviewMallProductRequest;
import com.procurement.mall.api.SaveMallSkuRequest;
import com.procurement.mall.api.UpdateMallProductStatusRequest;
import com.procurement.mall.domain.MallCatalogPolicy;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.domain.MallTierPrice;
import com.procurement.mall.infrastructure.MallCatalogMapper;
import com.procurement.mall.infrastructure.MallListingMapper;
import com.procurement.mall.infrastructure.PublicMallMapper;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 商城商品目录(M-1):供应商建商品与规格、采购方浏览、公开专区匿名浏览。
 *
 * <p>下单侧的价格与数量在 {@link MallApplicationService} 里按同一套 {@link MallCatalogPolicy}
 * 重算重校验——目录服务只负责维护与展示。
 */
@Service
public class MallCatalogApplicationService {

  private static final String AUDIT_TARGET = "mall_product";

  private final MallCatalogMapper mallCatalogMapper;
  private final PublicMallMapper publicMallMapper;
  private final MallListingMapper mallListingMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final com.procurement.notification.application.NotificationApplicationService notificationApplicationService;

  public MallCatalogApplicationService(
      MallCatalogMapper mallCatalogMapper,
      PublicMallMapper publicMallMapper,
      MallListingMapper mallListingMapper,
      AuditLogApplicationService auditLogApplicationService,
      com.procurement.notification.application.NotificationApplicationService notificationApplicationService) {
    this.mallCatalogMapper = mallCatalogMapper;
    this.publicMallMapper = publicMallMapper;
    this.mallListingMapper = mallListingMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
  }

  // ── 采购方浏览 ─────────────────────────────────────────────
  public List<MallProductResponse> listForBuyer(String categoryId, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallCatalogMapper.listForTenant(tenantId, true, blankToNull(categoryId), blankToNull(keyword))
        .stream()
        .map(p -> toSummary(tenantId, p))
        .toList();
  }

  public MallProductResponse findForBuyer(String productId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallProduct product = mallCatalogMapper.findProductForTenant(tenantId, productId);
    if (product == null) {
      throw new IllegalArgumentException("商品不存在或不在本企业可见范围: " + productId);
    }
    return toDetail(tenantId, product);
  }

  public List<com.procurement.mall.domain.MallCategory> listCategories() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallCatalogMapper.listCategories(tenantId);
  }

  // ── 公开专区(匿名) ────────────────────────────────────────
  public List<MallProductResponse> listPublicProducts() {
    return publicMallMapper.listPublicProducts().stream()
        .map(p -> new MallProductResponse(
            p.id(), p.scope(), p.supplierId(), p.supplierName(), p.categoryId(), p.categoryName(),
            p.name(), p.brand(), p.descriptionHtml(), p.mainImageKey(), p.status(),
            null, 0, List.of(), List.of(), p.updatedAt()))
        .toList();
  }

  // ── 供应商维护 ─────────────────────────────────────────────
  public List<MallProductResponse> listForSupplier() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    return mallCatalogMapper.listBySupplier(supplierId).stream()
        .map(p -> {
          List<MallSku> skus = mallCatalogMapper.listSkusForSupplier(supplierId, p.id());
          return new MallProductResponse(
              p.id(), p.scope(), p.supplierId(), p.supplierName(), p.categoryId(), p.categoryName(),
              p.name(), p.brand(), p.descriptionHtml(), p.mainImageKey(), p.status(),
              fromPrice(skus), skus.size(),
              skus.stream().map(s -> toSkuResponse(
                  s, mallCatalogMapper.listTiersForSupplier(supplierId, s.id()))).toList(),
              List.of(), p.updatedAt());
        })
        .toList();
  }

  @Transactional
  public MallProductResponse createProduct(SaveMallProductRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    String tenantId = request.tenantId();
    if (tenantId == null || tenantId.isBlank()) {
      throw new IllegalArgumentException("请指定上架的目标采购方");
    }
    // 与既有货架发布同口径:只能给已准入自己的采购方上架。
    if (mallListingMapper.countAdmittedSupplier(tenantId, supplierId) == 0) {
      throw new IllegalStateException("尚未获得该采购方准入,无法上架商品");
    }
    String id = "mp-" + UUID.randomUUID();
    // 新建默认草稿:让供应商先补齐规格与图片,再显式上架(M-4 会在此接入审核)。
    mallCatalogMapper.insertProduct(
        id, "tenant", tenantId, supplierId, blankToNull(request.categoryId()),
        request.name().trim(), orEmpty(request.brand()), orEmpty(request.descriptionHtml()),
        blankToNull(request.mainImageKey()), MallCatalogPolicy.STATUS_DRAFT);
    auditLogApplicationService.recordTenantAction(
        tenantId, "mall_product.created", AUDIT_TARGET, id);
    return findForSupplier(id);
  }

  @Transactional
  public MallProductResponse updateProduct(String productId, SaveMallProductRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    mallCatalogMapper.updateProduct(
        productId, supplierId, request.name().trim(), orEmpty(request.brand()),
        orEmpty(request.descriptionHtml()), blankToNull(request.categoryId()),
        blankToNull(request.mainImageKey()));
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_product.updated", AUDIT_TARGET, productId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateProductStatus(
      String productId, UpdateMallProductStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    // M-4:供应商只能提审或下架——上架与否由采购方审核决定,不能自己把商品放上货架。
    MallCatalogPolicy.requireSupplierTransition(product.status(), request.status());
    if (MallCatalogPolicy.STATUS_PENDING.equals(request.status())
        && mallCatalogMapper.listSkusForSupplier(supplierId, productId).isEmpty()) {
      throw new IllegalStateException("提交审核前请先添加至少一个规格并定价");
    }
    mallCatalogMapper.updateProductStatusBySupplier(productId, supplierId, request.status());
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_product.status_changed", AUDIT_TARGET,
        productId + " → " + request.status());
    if (MallCatalogPolicy.STATUS_PENDING.equals(request.status())) {
      notificationApplicationService.notifyActiveTenantUsers(
          product.tenantId(), "商城商品待审核",
          "供应商提交了商品「" + product.name() + "」的上架申请,请在企业商城中审核。");
    }
    return findForSupplier(productId);
  }

  // ── 采购方:上架审核(M-4) ────────────────────────────────
  /** 待审核商品清单:采购方的审核台。 */
  public List<MallProductResponse> listPendingReview() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallCatalogMapper.listForTenant(tenantId, false, null, null).stream()
        .filter(p -> MallCatalogPolicy.STATUS_PENDING.equals(p.status()))
        .map(p -> toDetail(tenantId, p))
        .toList();
  }

  @Transactional
  public MallProductResponse reviewProduct(String productId, ReviewMallProductRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallProduct product = mallCatalogMapper.findProductForTenant(tenantId, productId);
    MallCatalogPolicy.requireReviewable(product, request.approved(), request.comment());
    String target = Boolean.TRUE.equals(request.approved())
        ? MallCatalogPolicy.STATUS_ON_SHELF
        : MallCatalogPolicy.STATUS_DRAFT;
    if (mallCatalogMapper.reviewProductByTenant(
        productId, tenantId, target, request.comment().trim()) == 0) {
      throw new IllegalStateException("商品已被处理,请刷新审核台: " + productId);
    }
    auditLogApplicationService.recordTenantAction(
        "mall_product.reviewed", AUDIT_TARGET,
        productId + " → " + target + ":" + request.comment().trim());
    notificationApplicationService.notifyActiveSupplierUsers(
        tenantId, product.supplierId(), "商城商品审核结果",
        "「" + product.name() + "」" + (Boolean.TRUE.equals(request.approved()) ? "已通过审核并上架" : "未通过审核")
        + ":" + request.comment().trim());
    return toDetail(tenantId, mallCatalogMapper.findProductForTenant(tenantId, productId));
  }

  @Transactional
  public MallProductResponse addSku(String productId, SaveMallSkuRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    BigDecimal minOrderQty = orDefault(request.minOrderQty(), BigDecimal.ONE);
    BigDecimal stepQty = orDefault(request.stepQty(), BigDecimal.ONE);
    int leadTimeDays = request.leadTimeDays() == null ? 7 : request.leadTimeDays();
    MallCatalogPolicy.requireValidSku(request.price(), minOrderQty, stepQty, leadTimeDays);

    String skuId = "ms-" + UUID.randomUUID();
    int inserted = mallCatalogMapper.insertSkuForSupplier(
        skuId, productId, supplierId, orEmpty(request.skuCode()),
        request.spec() == null || request.spec().isBlank() ? "{}" : request.spec(),
        blankToNull(request.materialId()), request.unit() == null || request.unit().isBlank()
            ? "件" : request.unit(),
        request.price(), minOrderQty, stepQty, request.stockQty(), leadTimeDays);
    if (inserted == 0) {
      throw new IllegalStateException("规格创建失败:商品不属于本供应商");
    }
    saveTiers(supplierId, skuId, request);
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_sku.created", AUDIT_TARGET, skuId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateSku(String productId, String skuId, SaveMallSkuRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    BigDecimal minOrderQty = orDefault(request.minOrderQty(), BigDecimal.ONE);
    BigDecimal stepQty = orDefault(request.stepQty(), BigDecimal.ONE);
    int leadTimeDays = request.leadTimeDays() == null ? 7 : request.leadTimeDays();
    MallCatalogPolicy.requireValidSku(request.price(), minOrderQty, stepQty, leadTimeDays);

    int updated = mallCatalogMapper.updateSkuForSupplier(
        skuId, supplierId, request.price(), minOrderQty, stepQty, request.stockQty(), leadTimeDays);
    if (updated == 0) {
      throw new IllegalStateException("规格不存在或不属于本供应商: " + skuId);
    }
    saveTiers(supplierId, skuId, request);
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_sku.updated", AUDIT_TARGET, skuId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateSkuStatus(String productId, String skuId, String status) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    if (!MallCatalogPolicy.STATUS_ON_SHELF.equals(status)
        && !MallCatalogPolicy.STATUS_OFF_SHELF.equals(status)) {
      throw new IllegalArgumentException("规格状态仅支持 在架 / 下架: " + status);
    }
    if (mallCatalogMapper.updateSkuStatusForSupplier(skuId, supplierId, status) == 0) {
      throw new IllegalStateException("规格不存在或不属于本供应商: " + skuId);
    }
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_sku.status_changed", AUDIT_TARGET, skuId + " → " + status);
    return findForSupplier(productId);
  }

  public MallProductResponse findForSupplier(String productId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = requireOwnProduct(supplierId, productId);
    List<MallSku> skus = mallCatalogMapper.listSkusForSupplier(supplierId, productId);
    return new MallProductResponse(
        product.id(), product.scope(), product.supplierId(), product.supplierName(),
        product.categoryId(), product.categoryName(), product.name(), product.brand(),
        product.descriptionHtml(), product.mainImageKey(), product.status(),
        fromPrice(skus), skus.size(),
        skus.stream()
            .map(s -> toSkuResponse(s, mallCatalogMapper.listTiersForSupplier(supplierId, s.id())))
            .toList(),
        List.of(), product.updatedAt());
  }

  // ── 内部 ───────────────────────────────────────────────────
  private void saveTiers(String supplierId, String skuId, SaveMallSkuRequest request) {
    List<SaveMallSkuRequest.TierPriceLine> lines =
        request.tierPrices() == null ? List.of() : request.tierPrices();
    MallCatalogPolicy.requireValidTiers(
        request.price(),
        lines.stream().map(l -> new MallTierPrice(skuId, l.minQty(), l.price())).toList());
    mallCatalogMapper.clearTiersForSupplier(supplierId, skuId);
    for (SaveMallSkuRequest.TierPriceLine line : lines) {
      mallCatalogMapper.upsertTierForSupplier(supplierId, skuId, line.minQty(), line.price());
    }
  }

  private MallProduct requireOwnProduct(String supplierId, String productId) {
    MallProduct product = mallCatalogMapper.findProductForSupplier(supplierId, productId);
    if (product == null) {
      throw new IllegalArgumentException("商品不存在或不属于本供应商: " + productId);
    }
    return product;
  }

  private MallProductResponse toSummary(String tenantId, MallProduct product) {
    List<MallSku> skus = mallCatalogMapper.listSkusForTenant(tenantId, product.id());
    return new MallProductResponse(
        product.id(), product.scope(), product.supplierId(), product.supplierName(),
        product.categoryId(), product.categoryName(), product.name(), product.brand(),
        "", product.mainImageKey(), product.status(),
        fromPrice(skus), skus.size(), List.of(), List.of(), product.updatedAt());
  }

  private MallProductResponse toDetail(String tenantId, MallProduct product) {
    List<MallSku> skus = mallCatalogMapper.listSkusForTenant(tenantId, product.id());
    return new MallProductResponse(
        product.id(), product.scope(), product.supplierId(), product.supplierName(),
        product.categoryId(), product.categoryName(), product.name(), product.brand(),
        product.descriptionHtml(), product.mainImageKey(), product.status(),
        fromPrice(skus), skus.size(),
        skus.stream()
            .map(s -> toSkuResponse(s, mallCatalogMapper.listTiersForTenant(tenantId, s.id())))
            .toList(),
        mallCatalogMapper.listMediaForTenant(tenantId, product.id()).stream()
            .map(com.procurement.mall.domain.MallProductMedia::storageKey)
            .toList(),
        product.updatedAt());
  }

  private static MallProductResponse.MallSkuResponse toSkuResponse(
      MallSku sku, List<MallTierPrice> tiers) {
    return new MallProductResponse.MallSkuResponse(
        sku.id(), sku.skuCode(), sku.spec(), sku.materialId(), sku.unit(), sku.price(),
        sku.minOrderQty(), sku.stepQty(), sku.stockQty(), sku.leadTimeDays(), sku.status(),
        tiers.stream()
            .map(t -> new MallProductResponse.TierPriceResponse(t.minQty(), t.price()))
            .toList());
  }

  private static BigDecimal fromPrice(List<MallSku> skus) {
    return skus.stream()
        .filter(s -> MallCatalogPolicy.STATUS_ON_SHELF.equals(s.status()))
        .map(MallSku::price)
        .min(Comparator.naturalOrder())
        .orElse(null);
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value.trim();
  }

  private static BigDecimal orDefault(BigDecimal value, BigDecimal fallback) {
    return value == null ? fallback : value;
  }
}
