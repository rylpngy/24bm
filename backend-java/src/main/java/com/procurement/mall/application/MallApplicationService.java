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
import com.procurement.mall.api.CheckoutCartRequest;
import com.procurement.mall.domain.MallAddress;
import com.procurement.mall.infrastructure.MallCartMapper;
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
  private com.procurement.buyer.application.BudgetControlService budgetControl;
  @org.springframework.beans.factory.annotation.Autowired
  void setBudgetControlService(com.procurement.buyer.application.BudgetControlService control) { this.budgetControl=control; }
  private void lockBudget() {
    if(budgetControl!=null) budgetControl.lock(TenantAccessGuard.requireTenantId("mall budget control"));
  }
  private final MallListingMapper mallListingMapper;
  private final MallCatalogMapper mallCatalogMapper;
  private final MallCartMapper mallCartMapper;
  private final RfqApplicationService rfqApplicationService;
  private final PurchaseOrderApplicationService purchaseOrderApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantCapabilityApplicationService tenantCapabilityApplicationService;
  private final com.procurement.identity.application.DataScopeService scopes;
  private final MallPurchaseControlApplicationService purchaseControls;

  public MallApplicationService(
      MallListingMapper mallListingMapper,
      MallCatalogMapper mallCatalogMapper,
      MallCartMapper mallCartMapper,
      RfqApplicationService rfqApplicationService,
      PurchaseOrderApplicationService purchaseOrderApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      TenantCapabilityApplicationService tenantCapabilityApplicationService,
      com.procurement.identity.application.DataScopeService scopes,
      MallPurchaseControlApplicationService purchaseControls) {
    this.mallListingMapper = mallListingMapper;
    this.mallCatalogMapper = mallCatalogMapper;
    this.mallCartMapper = mallCartMapper;
    this.rfqApplicationService = rfqApplicationService;
    this.purchaseOrderApplicationService = purchaseOrderApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantCapabilityApplicationService = tenantCapabilityApplicationService;
    this.scopes = scopes;
    this.purchaseControls = purchaseControls;
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

  /**
   * 规格的对外状态。
   *
   * <p>商品未在架时以**商品状态**呈现(草稿 / 待审核 / 下架):M-4 之后「待审核」是常态,
   * 若一律显示为下架,供应商会以为是自己下架的、反复点上架却没有反应。
   */
  private static String effectiveStatus(MallProduct product, MallSku sku) {
    if (!MallCatalogPolicy.STATUS_ON_SHELF.equals(product.status())) {
      return product.status();
    }
    return MallCatalogPolicy.STATUS_ON_SHELF.equals(sku.status())
        ? MallCatalogPolicy.STATUS_ON_SHELF
        : MallCatalogPolicy.STATUS_OFF_SHELF;
  }

  private static MallListingResponse toListingResponse(MallProduct product, MallSku sku) {
    return new MallListingResponse(
        sku.id(), product.supplierId(), product.supplierName(), sku.materialId(),
        product.name(), sku.skuCode(), product.categoryName(), sku.unit(), sku.price(),
        effectiveStatus(product, sku), product.updatedAt(), product.tenantId(), null,
        product.id(), product.status());
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
  public record ProjectRequirement(String materialId, String unit, BigDecimal quantity) {}
  public record ProjectSku(String skuId, BigDecimal quantity) {}
  public record ProjectSelection(String materialId, String skuId, String name, String brand,
      String supplierId, String supplierName, String skuCode, String spec, String unit,
      BigDecimal quantity, BigDecimal unitPrice, BigDecimal amount) {}
  public record ProjectPurchase(String rfqId, String orderId, List<ProjectSelection> selections) {}

  /** Project facade supplies approved requirements; all commercial values come from locked SKUs. */
  @Transactional
  public ProjectPurchase purchaseProjectPackage(String title, List<String> demands,
      List<ProjectRequirement> requirements, List<ProjectSku> selections, BigDecimal ceiling,
      LocalDate requestedDate, String addressId) {
    lockBudget();
    String tenant = TenantAccessGuard.requireTenantId("project mall");
    tenantCapabilityApplicationService.requireMethodEnabled(tenant, ProcurementMethodCatalog.MALL.code());
    if (selections == null || selections.isEmpty() || selections.size() > 100
        || selections.stream().anyMatch(s -> s.quantity() == null || s.quantity().signum() <= 0))
      throw new IllegalArgumentException("请选择有效的商城规格及数量");
    purchaseControls.lockCatalog(selections.stream().map(ProjectSku::skuId).toList());
    if (selections.stream().map(ProjectSku::skuId).distinct().count() != selections.size())
      throw new IllegalArgumentException("规格重复，请合并同一SKU的数量");
    var lines = selections.stream().map(s -> resolveLine(tenant, s.skuId(), s.quantity())).toList();
    if (lines.stream().map(l -> l.product().supplierId()).distinct().count() != 1)
      throw new IllegalArgumentException("同一商城分包须由同一供应商供货，多供应商请拆分分包");
    var actual = new java.util.HashMap<String,BigDecimal>();
    var expected = new java.util.HashMap<String,BigDecimal>();
    for (var requirement : requirements) expected.merge(requirement.materialId(), requirement.quantity(), BigDecimal::add);
    for (var line : lines) {
      var requirement = requirements.stream().filter(r -> r.materialId().equals(line.sku().materialId())).findFirst()
          .orElseThrow(() -> new IllegalArgumentException("SKU未关联该分包批准的物料"));
      if (!requirement.unit().equals(line.sku().unit())) throw new IllegalArgumentException("商城规格单位与批准物料不一致");
      actual.merge(line.sku().materialId(),line.quantity(),BigDecimal::add);
    }
    if (!actual.keySet().equals(expected.keySet()) || expected.entrySet().stream()
        .anyMatch(e -> e.getValue().compareTo(actual.get(e.getKey())) != 0))
      throw new IllegalArgumentException("商城选型必须完整覆盖分包物料及批准数量，不得多购、少购或替换物料");
    BigDecimal amount = lines.stream().map(MallApplicationService::lineAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
    if (amount.signum() <= 0 || amount.compareTo(ceiling) > 0)
      throw new IllegalStateException("商城成交额超过已批准需求或分包金额，请重新选型或先办理变更");
    MallAddress address = resolveAddress(tenant,addressId);
    purchaseControls.requireAllowed(amount,lines.stream().map(l -> l.product().categoryId()).toList(),address != null);
    requireFulfillableQuantity(lines.stream().map(CartLine::quantity).reduce(BigDecimal.ZERO,BigDecimal::add));
    LocalDate earliest = LocalDate.now().plusDays(lines.stream().mapToInt(l -> l.sku().leadTimeDays()).max().orElse(0));
    if (requestedDate != null && requestedDate.isBefore(earliest)) throw new IllegalArgumentException("到货日期早于商城承诺交期："+earliest);
    String supplier = lines.getFirst().product().supplierId();
    String rfq = rfqApplicationService.createProjectMallAnchor(title,demands,supplier);
    String order = purchaseOrderApplicationService.createMallOrder(rfq,supplier,amount,
        requestedDate == null ? earliest : requestedDate,
        lines.stream().map(l -> new PurchaseOrderApplicationService.DirectOrderLine(
            l.product().name()+" · "+l.sku().skuCode()+" "+l.sku().spec(),l.sku().unit(),l.quantity(),l.unitPrice(),l.sku().id(),l.sku().stockQty()==null?BigDecimal.ZERO:l.quantity())).toList(),
        formatAddress(address),address == null ? null : address.receiver(),address == null ? null : address.phone());
    var snapshots = lines.stream().map(l -> new ProjectSelection(l.sku().materialId(),l.sku().id(),
        l.product().name(),l.product().brand(),supplier,l.product().supplierName(),l.sku().skuCode(),
        l.sku().spec(),l.sku().unit(),l.quantity(),l.unitPrice(),lineAmount(l))).toList();
    lines.forEach(l -> deductStockIfTracked(tenant,l));
    auditLogApplicationService.recordTenantAction("mall_order.project_created",AuditTargetType.PURCHASE_ORDER,order);
    return new ProjectPurchase(rfq,order,snapshots);
  }

  @Transactional
  public MallOrderResponse createDirectOrder(CreateMallOrderRequest request) {
    lockBudget();
    return purchaseControls.idempotent("direct",request.idempotencyKey(),request,
        () -> List.of(createDirectOrderInternal(request))).getFirst();
  }

  private MallOrderResponse createDirectOrderInternal(CreateMallOrderRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.MALL.code());
    purchaseControls.lockCatalog(List.of(request.listingId()));
    CartLine line = resolveLine(tenantId, request.listingId(), request.quantity());
    requireFulfillableQuantity(request.quantity());

    BigDecimal amount = lineAmount(line);
    MallAddress address = resolveAddress(tenantId,null);
    purchaseControls.requireAllowed(amount,java.util.Arrays.asList(line.product().categoryId()),address!=null);
    LocalDate earliest = LocalDate.now().plusDays(line.sku().leadTimeDays());
    if(request.expectedReceiptDate()!=null && request.expectedReceiptDate().isBefore(earliest)) {
      throw new IllegalArgumentException("期望到货日期不能早于商品承诺交期: "+earliest);
    }
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
        List.of(new PurchaseOrderApplicationService.DirectOrderLine(line.product().name()+" · "+line.sku().skuCode()+" "+line.sku().spec(),
            line.sku().unit(),request.quantity(),line.unitPrice(),line.sku().id(),line.sku().stockQty()==null?BigDecimal.ZERO:request.quantity())),
        formatAddress(address),address==null?null:address.receiver(),address==null?null:address.phone());
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

  /**
   * M-2 服务端购物车结算:以购物车为准下单,成功后清空购物车。
   *
   * <p>与旧的 /orders/batch 相比,清单来自服务端而非请求体——前端改不了要买什么、买多少价。
   */
  @Transactional
  public List<MallOrderResponse> checkoutServerCart(CheckoutCartRequest request) {
    lockBudget();
    return purchaseControls.idempotent("cart",request.idempotencyKey(),request,
        () -> checkoutServerCartInternal(request));
  }

  private List<MallOrderResponse> checkoutServerCartInternal(CheckoutCartRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.MALL.code());
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    mallCartMapper.lockCart(tenantId,userId);
    List<com.procurement.mall.domain.MallCartItem> items =
        mallCartMapper.listItems(tenantId, userId);
    if (items.isEmpty()) {
      throw new IllegalStateException("购物车是空的,先加购再结算");
    }
    purchaseControls.lockCatalog(items.stream().map(com.procurement.mall.domain.MallCartItem::skuId).toList());
    MallAddress address = resolveAddress(tenantId, request.addressId());
    List<MallOrderResponse> orders = placeOrders(
        tenantId,
        items.stream()
            .map(i -> resolveLine(tenantId, i.skuId(), i.quantity()))
            .toList(),
        request.expectedReceiptDate(),
        address);
    orders.forEach(order -> purchaseControls.saveCheckoutNote(order.orderId(),request.remark()));
    mallCartMapper.clearCart(tenantId, userId);
    return orders;
  }

  private MallAddress resolveAddress(String tenantId, String addressId) {
    if (addressId != null && !addressId.isBlank()) {
      MallAddress address = mallCartMapper.findAddress(tenantId, addressId);
      if (address == null) {
        throw new IllegalArgumentException("收货地址不存在: " + addressId);
      }
      return address;
    }
    // 未指定则用默认地址;一个地址都没有时不阻断下单(线下约定收货的场景仍可成单)。
    return mallCartMapper.listAddresses(tenantId).stream().findFirst().orElse(null);
  }

  private static String formatAddress(MallAddress address) {
    if (address == null) {
      return null;
    }
    // 直辖市的省与市同名(上海市/上海市),拼接时去重,避免订单上出现「上海市上海市」。
    String prefix = address.province();
    if (!address.city().isBlank() && !address.city().equals(prefix)) {
      prefix = prefix + address.city();
    }
    return (prefix + address.district() + address.detail()).trim();
  }

  // 购物车结算:逐项校验在架与数量,按供应商合并成单(每供应商一张锚点 RFQ + 多行订单)。
  @Transactional
  public List<MallOrderResponse> checkoutCart(CreateMallCartRequest request) {
    lockBudget();
    return purchaseControls.idempotent("batch",request.idempotencyKey(),request,
        () -> checkoutCartInternal(request));
  }

  private List<MallOrderResponse> checkoutCartInternal(CreateMallCartRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    // M-0:商城直采未开通即拒绝下单。
    tenantCapabilityApplicationService.requireMethodEnabled(
        tenantId, ProcurementMethodCatalog.MALL.code());
    purchaseControls.lockCatalog(request.items().stream().map(CreateMallCartRequest.CartItem::listingId).toList());
    return placeOrders(
        tenantId,
        request.items().stream()
            // 请求里的 listingId 即 skuId(货架由商品/SKU 投影)。
            .map(item -> resolveLine(tenantId, item.listingId(), item.quantity()))
            .toList(),
        request.expectedReceiptDate(),
        resolveAddress(tenantId,null));
  }

  /**
   * 按供应商合并成单:每供应商一张锚点 RFQ + 一张多行订单。
   *
   * <p>交期未指定时取本单各 SKU 承诺交期的最大值——一单里最慢的那个决定到货日,
   * 而不是一律「下单 +7 天」。
   */
  private List<MallOrderResponse> placeOrders(
      String tenantId,
      List<CartLine> allLines,
      LocalDate requestedReceiptDate,
      MallAddress address) {
    if(allLines.stream().map(line -> line.sku().id()).distinct().count()!=allLines.size()) {
      throw new IllegalArgumentException("结算清单存在重复规格，请合并数量后重新提交");
    }
    BigDecimal total=allLines.stream().map(MallApplicationService::lineAmount).reduce(BigDecimal.ZERO,BigDecimal::add);
    purchaseControls.requireAllowed(total,allLines.stream().map(l->l.product().categoryId()).toList(),address!=null);
    java.util.LinkedHashMap<String, java.util.List<CartLine>> bySupplier =
        new java.util.LinkedHashMap<>();
    for (CartLine line : allLines) {
      bySupplier
          .computeIfAbsent(line.product().supplierId(), key -> new java.util.ArrayList<>())
          .add(line);
    }

    java.util.List<MallOrderResponse> orders = new java.util.ArrayList<>();
    for (java.util.Map.Entry<String, java.util.List<CartLine>> entry : bySupplier.entrySet()) {
      java.util.List<CartLine> lines = entry.getValue();
      requireFulfillableQuantity(lines.stream().map(CartLine::quantity).reduce(BigDecimal.ZERO,BigDecimal::add));
      LocalDate earliest=LocalDate.now().plusDays(lines.stream().mapToInt(l->l.sku().leadTimeDays()).max().orElse(0));
      if(requestedReceiptDate!=null && requestedReceiptDate.isBefore(earliest)) {
        throw new IllegalArgumentException("期望到货日期不能早于商品承诺交期: "+earliest);
      }
      LocalDate expectedReceiptDate = requestedReceiptDate != null
          ? requestedReceiptDate
          : LocalDate.now().plusDays(lines.stream()
              .mapToInt(l -> l.sku().leadTimeDays())
              .max()
              .orElse(7));
      BigDecimal amount = lines.stream()
          .map(MallApplicationService::lineAmount)
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
                  l.product().name()+" · "+l.sku().skuCode()+" "+l.sku().spec(),l.sku().unit(),l.quantity(),l.unitPrice(),l.sku().id(),l.sku().stockQty()==null?BigDecimal.ZERO:l.quantity()))
              .toList(),
          formatAddress(address),
          address == null ? null : address.receiver(),
          address == null ? null : address.phone());
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

  private static BigDecimal lineAmount(CartLine line) {
    return line.unitPrice().multiply(line.quantity()).setScale(2,java.math.RoundingMode.HALF_UP);
  }

  private static void requireFulfillableQuantity(BigDecimal quantity) {
    // Existing delivery/receipt headers use integer totals; do not create an unfulfillable order.
    try { quantity.intValueExact(); }
    catch(ArithmeticException invalid) {
      throw new IllegalArgumentException("当前履约总数量须为整数且不超过2147483647，请按供应商核对计量数量后再结算");
    }
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
        mallListingMapper.mallSpendBySupplier(tenantId, scopes.currentUserDataScope());
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
    // M-4:供应商发起的上架一律进「待审核」,由采购方审核后才真正在架。
    SupplierMallMaterialResponse material = listSupplierMaterials().stream()
        .filter(m -> m.materialId().equals(request.materialId())
            && m.tenantId().equals(request.tenantId()))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("物料不存在或不在该采购方目录内: " + request.materialId()));

    String productId = "mp-" + UUID.randomUUID();
    mallCatalogMapper.insertProduct(
        productId, "tenant", request.tenantId(), supplierId, null, material.name(), "", "",
        null, MallCatalogPolicy.STATUS_PENDING);
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
    // Only use the unlocked read to locate the aggregate; the hook rereads the SKU under lock.
    MallSku sku = requireOwnSku(supplierId, listingId);
    sku = MallCatalogApplicationService.prepareLegacyListingMutation(
        mallCatalogMapper, mallListingMapper, sku.productId(), listingId, true);
    MallCatalogPolicy.requireValidSku(request.price(), sku.minOrderQty(), sku.stepQty(), sku.leadTimeDays());
    MallCatalogPolicy.requireValidTiers(request.price(),
        mallCatalogMapper.listTiersForSupplier(supplierId, listingId));
    if (mallCatalogMapper.updateSkuPriceForSupplier(supplierId, sku.productId(), listingId, request.price()) == 0) {
      throw new IllegalStateException("规格更新失败,请刷新后重试");
    }
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
    sku = MallCatalogApplicationService.prepareLegacyListingMutation(
        mallCatalogMapper, mallListingMapper, sku.productId(), listingId,
        MallListingStatus.ON_SHELF.equals(request.status()));
    MallProduct product = mallCatalogMapper.findProductForSupplier(supplierId, sku.productId());
    if (MallListingStatus.ON_SHELF.equals(request.status())) {
      MallCatalogPolicy.requireValidSku(sku.price(), sku.minOrderQty(), sku.stepQty(), sku.leadTimeDays());
      MallCatalogPolicy.requireValidTiers(sku.price(), mallCatalogMapper.listTiersForSupplier(supplierId, listingId));
    }
    if (mallCatalogMapper.updateSkuStatusForSupplier(listingId, supplierId, request.status()) == 0) {
      throw new IllegalStateException("规格更新失败,请刷新后重试");
    }
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


  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
