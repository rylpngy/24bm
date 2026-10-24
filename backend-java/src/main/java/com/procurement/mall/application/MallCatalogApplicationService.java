package com.procurement.mall.application;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.procurement.mall.infrastructure.MallPublicCatalogReviewMapper;
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
  private static final ObjectMapper JSON = new ObjectMapper()
      .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
      .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

  private final MallCatalogMapper mallCatalogMapper;
  private final PublicMallMapper publicMallMapper;
  private final MallListingMapper mallListingMapper;
  private final MallPublicCatalogReviewMapper publicReviewMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final com.procurement.notification.application.NotificationApplicationService notificationApplicationService;

  public MallCatalogApplicationService(
      MallCatalogMapper mallCatalogMapper,
      PublicMallMapper publicMallMapper,
      MallListingMapper mallListingMapper,
      AuditLogApplicationService auditLogApplicationService,
      com.procurement.notification.application.NotificationApplicationService notificationApplicationService,
      MallPublicCatalogReviewMapper publicReviewMapper) {
    this.mallCatalogMapper = mallCatalogMapper;
    this.publicMallMapper = publicMallMapper;
    this.mallListingMapper = mallListingMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.publicReviewMapper = publicReviewMapper;
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
    if (!MallCatalogPolicy.STATUS_ON_SHELF.equals(product.status())) {
      throw new IllegalStateException("商品尚未通过审核或已下架");
    }
    requireAdmitted(product);
    return toDetail(tenantId, product);
  }

  public List<com.procurement.mall.domain.MallCategory> listCategories() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallCatalogMapper.listCategories(tenantId);
  }

  public List<com.procurement.mall.domain.MallCategory> listCategoriesForSupplier(String tenantId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall categories");
    String target = blankToNull(tenantId);
    if (target != null && mallListingMapper.countAdmittedSupplier(target, supplierId) == 0) {
      throw new IllegalStateException("未获得目标采购方准入,无法读取其商品分类");
    }
    return mallCatalogMapper.listSupplierCategories(target);
  }

  // ── 公开专区(匿名) ────────────────────────────────────────
  public List<MallProductResponse> listPublicProducts() {
    return publicMallMapper.listPublicProducts().stream()
        .map(p -> new MallProductResponse(
            p.id(), p.scope(), p.supplierId(), p.supplierName(), p.categoryId(), p.categoryName(),
            p.name(), p.brand(), p.descriptionHtml(), p.mainImageKey(), p.status(),
            null, 0, List.of(), List.of(), p.updatedAt(), null))
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
              List.of(), p.updatedAt(), p.tenantId());
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
    validateProduct(tenantId, request);
    String id = "mp-" + UUID.randomUUID();
    // New products remain drafts until complete specifications are explicitly submitted for review.
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
    MallProduct product = lockOwnProduct(supplierId, productId);
    requireAdmitted(product);
    validateProduct(product.tenantId(), request);
    mallCatalogMapper.updateProduct(
        productId, supplierId, request.name().trim(), orEmpty(request.brand()),
        orEmpty(request.descriptionHtml()), blankToNull(request.categoryId()),
        blankToNull(request.mainImageKey()));
    mallCatalogMapper.invalidatePublication(supplierId, productId);
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_product.updated", AUDIT_TARGET, productId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateProductStatus(
      String productId, UpdateMallProductStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = lockOwnProduct(supplierId, productId);
    // M-4:供应商只能提审或下架——上架与否由采购方审核决定,不能自己把商品放上货架。
    MallCatalogPolicy.requireSupplierTransition(product.status(), request.status());
    if (MallCatalogPolicy.STATUS_PENDING.equals(request.status())) {
      requireAdmitted(product);
      requireReadyForReview(product);
    }
    mallCatalogMapper.updateProductStatusBySupplier(productId, supplierId, request.status());
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_product.status_changed", AUDIT_TARGET,
        productId + " → " + request.status());
    if (MallCatalogPolicy.STATUS_PENDING.equals(request.status()) && product.tenantId() != null) {
      notificationApplicationService.notifyActiveTenantUsers(
          product.tenantId(), "商城商品待审核",
          "供应商提交了商品「" + product.name() + "」的上架申请,请在企业商城中审核。");
    }
    return findForSupplier(productId);
  }

  // ── 采购方:上架审核(M-4) ────────────────────────────────
  List<MallProductResponse> listPublicPendingReview() {
    return publicReviewMapper.listPublicPendingReview().stream().map(p -> toDetail(null, p)).toList();
  }

  MallProductResponse reviewPublicProduct(String productId, ReviewMallProductRequest request) {
    MallProduct product = publicReviewMapper.lockPublicProduct(productId);
    MallCatalogPolicy.requireReviewable(product, request.approved(), request.comment());
    if (Boolean.TRUE.equals(request.approved())) requireReadyForReview(product);
    String status = Boolean.TRUE.equals(request.approved())
        ? MallCatalogPolicy.STATUS_ON_SHELF : MallCatalogPolicy.STATUS_DRAFT;
    if (publicReviewMapper.reviewPublicProduct(productId, status, request.comment().trim()) == 0) {
      throw new IllegalStateException("商品已被处理,请刷新审核台");
    }
    auditLogApplicationService.recordTenantAction(null, "mall_public_product.reviewed", AUDIT_TARGET,
        productId, status + ":" + request.comment().trim());
    return toDetail(null, mallCatalogMapper.findProductForSupplier(product.supplierId(), productId));
  }

  /** 待审核商品清单:采购方的审核台。 */
  public List<MallProductResponse> listPendingReview() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    return mallCatalogMapper.listForTenant(tenantId, false, null, null).stream()
        .filter(p -> tenantId.equals(p.tenantId()))
        .filter(p -> MallCatalogPolicy.STATUS_PENDING.equals(p.status()))
        .map(p -> toDetail(tenantId, p))
        .toList();
  }

  @Transactional
  public MallProductResponse reviewProduct(String productId, ReviewMallProductRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    MallProduct product = mallCatalogMapper.lockProductForTenant(tenantId, productId);
    MallCatalogPolicy.requireReviewable(product, request.approved(), request.comment());
    if (Boolean.TRUE.equals(request.approved())) {
      requireAdmitted(product);
      requireReadyForReview(product);
    }
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
    MallProduct product = lockOwnProduct(supplierId, productId);
    requireAdmitted(product);
    String spec = validateSku(product, request);
    BigDecimal minOrderQty = orDefault(request.minOrderQty(), BigDecimal.ONE);
    BigDecimal stepQty = orDefault(request.stepQty(), BigDecimal.ONE);
    int leadTimeDays = request.leadTimeDays() == null ? 7 : request.leadTimeDays();

    String skuId = "ms-" + UUID.randomUUID();
    int inserted = mallCatalogMapper.insertSkuForSupplier(
        skuId, productId, supplierId, orEmpty(request.skuCode()),
        spec,
        blankToNull(request.materialId()), request.unit() == null || request.unit().isBlank()
            ? "件" : request.unit(),
        request.price(), minOrderQty, stepQty, request.stockQty(), leadTimeDays);
    if (inserted == 0) {
      throw new IllegalStateException("规格创建失败:商品不属于本供应商");
    }
    saveTiers(supplierId, skuId, request);
    mallCatalogMapper.invalidatePublication(supplierId, productId);
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_sku.created", AUDIT_TARGET, skuId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateSku(String productId, String skuId, SaveMallSkuRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = lockOwnProduct(supplierId, productId);
    requireAdmitted(product);
    MallSku current = requireOwnSku(supplierId, productId, skuId);
    String spec = validateSku(product, request, current.materialId());
    BigDecimal minOrderQty = orDefault(request.minOrderQty(), BigDecimal.ONE);
    BigDecimal stepQty = orDefault(request.stepQty(), BigDecimal.ONE);
    int leadTimeDays = request.leadTimeDays() == null ? 7 : request.leadTimeDays();

    int updated = mallCatalogMapper.updateSkuForSupplier(
        skuId, supplierId, request.price(), minOrderQty, stepQty, request.stockQty(), leadTimeDays);
    if (updated == 0) {
      throw new IllegalStateException("规格不存在或不属于本供应商: " + skuId);
    }
    mallCatalogMapper.updateSkuIdentity(supplierId, productId, skuId, orEmpty(request.skuCode()),
        spec, blankToNull(request.materialId()),
        request.unit() == null || request.unit().isBlank() ? "件" : request.unit().trim());
    saveTiers(supplierId, skuId, request);
    mallCatalogMapper.invalidatePublication(supplierId, productId);
    auditLogApplicationService.recordTenantAction(
        product.tenantId(), "mall_sku.updated", AUDIT_TARGET, skuId);
    return findForSupplier(productId);
  }

  @Transactional
  public MallProductResponse updateSkuStatus(String productId, String skuId, String status) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = lockOwnProduct(supplierId, productId);
    requireOwnSku(supplierId, productId, skuId);
    if (!MallCatalogPolicy.STATUS_ON_SHELF.equals(status)
        && !MallCatalogPolicy.STATUS_OFF_SHELF.equals(status)) {
      throw new IllegalArgumentException("规格状态仅支持 在架 / 下架: " + status);
    }
    if (MallCatalogPolicy.STATUS_ON_SHELF.equals(status)) {
      requireAdmitted(product);
      mallCatalogMapper.invalidatePublication(supplierId, productId);
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
        List.of(), product.updatedAt(), product.tenantId());
  }

  // ── 内部 ───────────────────────────────────────────────────
  /** Legacy listing writes must call this inside their encompassing transaction, before SKU writes. */
  @Transactional
  public MallSku prepareLegacyListingMutation(String productId, String skuId, boolean requiresReview) {
    return prepareLegacyListingMutation(mallCatalogMapper, mallListingMapper, productId, skuId, requiresReview);
  }

  /** Same hook for legacy callers with existing mapper dependencies; enclosing transaction is required. */
  public static MallSku prepareLegacyListingMutation(MallCatalogMapper catalog, MallListingMapper listings,
      String productId, String skuId, boolean requiresReview) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier mall APIs");
    MallProduct product = catalog.lockProductForSupplier(supplierId, productId);
    if (product == null) throw new IllegalArgumentException("商品不存在或不属于本供应商: " + productId);
    MallSku sku = catalog.lockSkuForSupplier(supplierId, productId, skuId);
    if (sku == null) throw new IllegalArgumentException("规格不存在或不属于当前商品: " + skuId);
    if (requiresReview) {
      if (!"public".equals(product.scope())
          && listings.countAdmittedSupplier(product.tenantId(), supplierId) == 0) {
        throw new IllegalStateException("供应商未获准入或准入已撤销");
      }
      catalog.invalidatePublication(supplierId, productId);
    }
    return sku;
  }

  private MallProduct lockOwnProduct(String supplierId, String productId) {
    MallProduct product = mallCatalogMapper.lockProductForSupplier(supplierId, productId);
    if (product == null) {
      throw new IllegalArgumentException("商品不存在或不属于本供应商: " + productId);
    }
    return product;
  }

  private MallSku requireOwnSku(String supplierId, String productId, String skuId) {
    MallSku sku = mallCatalogMapper.lockSkuForSupplier(supplierId, productId, skuId);
    if (sku == null) {
      throw new IllegalArgumentException("规格不存在或不属于当前商品: " + skuId);
    }
    return sku;
  }

  private void requireAdmitted(MallProduct product) {
    if ("public".equals(product.scope())) return;
    if (mallListingMapper.countAdmittedSupplier(product.tenantId(), product.supplierId()) == 0) {
      throw new IllegalStateException("供应商未获准入或准入已撤销,无法维护、提审或购买商品");
    }
  }

  private void validateProduct(String tenantId, SaveMallProductRequest request) {
    if (request.name() == null || request.name().isBlank()) {
      throw new IllegalArgumentException("商品名称不能为空");
    }
    String categoryId = blankToNull(request.categoryId());
    if (categoryId != null && mallCatalogMapper.countVisibleCategory(tenantId, categoryId) == 0) {
      if (tenantId != null) mallCatalogMapper.materializeMaterialCategory(tenantId, categoryId);
      if (mallCatalogMapper.countVisibleCategory(tenantId, categoryId) == 0) {
        throw new IllegalArgumentException("分类不存在或不属于目标采购方");
      }
    }
  }

  private String validateSku(MallProduct product, SaveMallSkuRequest request) {
    return validateSku(product, request, null);
  }

  private String validateSku(MallProduct product, SaveMallSkuRequest request, String existingMaterialId) {
    MallCatalogPolicy.requireValidSku(request.price(), orDefault(request.minOrderQty(), BigDecimal.ONE),
        orDefault(request.stepQty(), BigDecimal.ONE), request.leadTimeDays() == null ? 7 : request.leadTimeDays());
    MallCatalogPolicy.requireValidStock(request.stockQty());
    String materialId = blankToNull(request.materialId());
    if (materialId != null && ("public".equals(product.scope())
        ? !materialId.equals(existingMaterialId)
        : mallCatalogMapper.findMaterialBrief(product.tenantId(), materialId) == null)) {
      throw new IllegalArgumentException("物料不存在或不属于目标采购方");
    }
    try {
      var spec = JSON.readTree(request.spec() == null || request.spec().isBlank() ? "{}" : request.spec());
      if (spec == null || !spec.isObject()) throw new IllegalArgumentException("规格必须是 JSON 对象");
      var fields = spec.fields();
      while (fields.hasNext()) {
        var field = fields.next();
        if (field.getKey().isBlank() || !field.getValue().isValueNode()
            || field.getValue().isNull() || field.getValue().asText().isBlank()) {
          throw new IllegalArgumentException("规格名称和值不能为空,且值必须为标量");
        }
      }
      return spec.toString();
    } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
      throw new IllegalArgumentException("规格 JSON 格式无效", e);
    }
  }

  private void requireReadyForReview(MallProduct product) {
    if (product.categoryId() != null
        && mallCatalogMapper.countVisibleCategory(product.tenantId(), product.categoryId()) == 0) {
      throw new IllegalArgumentException("分类不存在或不属于目标采购方");
    }
    List<MallSku> active = mallCatalogMapper.listSkusForSupplier(product.supplierId(), product.id())
        .stream().filter(s -> MallCatalogPolicy.STATUS_ON_SHELF.equals(s.status())).toList();
    if (active.isEmpty()) throw new IllegalStateException("提交审核前请先添加至少一个在架规格并定价");
    for (MallSku sku : active) {
      validateSku(product, new SaveMallSkuRequest(sku.skuCode(), sku.spec(), sku.materialId(), sku.unit(),
          sku.price(), sku.minOrderQty(), sku.stepQty(), sku.stockQty(), sku.leadTimeDays(), List.of()), sku.materialId());
      MallCatalogPolicy.requireValidTiers(sku.price(),
          mallCatalogMapper.listTiersForSupplier(product.supplierId(), sku.id()));
    }
  }

  private void saveTiers(String supplierId, String skuId, SaveMallSkuRequest request) {
    List<SaveMallSkuRequest.TierPriceLine> lines =
        request.tierPrices() == null ? List.of() : request.tierPrices();
    if (lines.stream().anyMatch(java.util.Objects::isNull)) {
      throw new IllegalArgumentException("阶梯价格明细不能为空");
    }
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
        fromPrice(skus), skus.size(), List.of(), List.of(), product.updatedAt(), product.tenantId());
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
        product.updatedAt(), product.tenantId());
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
