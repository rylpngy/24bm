package com.procurement.mall.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.mall.api.MallCartResponse;
import com.procurement.mall.api.SaveMallAddressRequest;
import com.procurement.mall.domain.MallAddress;
import com.procurement.mall.domain.MallCartItem;
import com.procurement.mall.domain.MallCatalogPolicy;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.domain.MallTierPrice;
import com.procurement.mall.infrastructure.MallCartMapper;
import com.procurement.mall.infrastructure.MallCatalogMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 服务端购物车与收货地址(M-2)。
 *
 * <p>购物车只存 SKU 与数量:单价、小计、可结算性都在读取时按**当前**商品状态与阶梯价算,
 * 供应商调价、下架、库存变化会如实反映到购物车,而不是停留在加购那一刻的快照。
 */
@Service
public class MallCartApplicationService {

  private final MallCartMapper mallCartMapper;
  private final MallCatalogMapper mallCatalogMapper;

  public MallCartApplicationService(
      MallCartMapper mallCartMapper, MallCatalogMapper mallCatalogMapper) {
    this.mallCartMapper = mallCartMapper;
    this.mallCatalogMapper = mallCatalogMapper;
  }

  public MallCartResponse view() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    return render(tenantId, mallCartMapper.listItems(tenantId, userId));
  }

  @Transactional
  public MallCartResponse addItem(String skuId, BigDecimal quantity) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    MallSku sku = requireVisibleSku(tenantId, skuId);
    if (quantity == null || quantity.signum() <= 0) {
      throw new IllegalArgumentException("加购数量必须大于 0");
    }
    ensureCart(tenantId, userId);
    mallCartMapper.lockCart(tenantId,userId);
    // 加购不卡起订量:允许先攒数量,结算时统一按规则校验并给出明确原因。
    mallCartMapper.addItem("mci-" + UUID.randomUUID(), tenantId, userId, sku.id(), quantity);
    return view();
  }

  @Transactional
  public MallCartResponse updateQuantity(String skuId, BigDecimal quantity) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    mallCartMapper.lockCart(tenantId,userId);
    if (quantity == null || quantity.signum() <= 0) {
      mallCartMapper.removeItem(tenantId, userId, skuId);
      return view();
    }
    if (mallCartMapper.updateQuantity(tenantId, userId, skuId, quantity) == 0) {
      throw new IllegalArgumentException("购物车中没有该商品: " + skuId);
    }
    return view();
  }

  @Transactional
  public MallCartResponse removeItem(String skuId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    mallCartMapper.lockCart(tenantId,userId);
    mallCartMapper.removeItem(tenantId, userId, skuId);
    return view();
  }

  @Transactional
  public void clear() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String userId = TenantAccessGuard.requireUserId("buyer mall APIs");
    mallCartMapper.lockCart(tenantId,userId);
    mallCartMapper.clearCart(tenantId, userId);
  }

  // ── 收货地址 ───────────────────────────────────────────────
  public List<MallAddress> listAddresses() {
    return mallCartMapper.listAddresses(TenantAccessGuard.requireTenantId("buyer mall APIs"));
  }

  @Transactional
  public List<MallAddress> saveAddress(SaveMallAddressRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    String id = "mad-" + UUID.randomUUID();
    boolean makeDefault = Boolean.TRUE.equals(request.isDefault())
        || mallCartMapper.listAddresses(tenantId).isEmpty();
    if (makeDefault) {
      mallCartMapper.clearDefault(tenantId);
    }
    mallCartMapper.insertAddress(
        id, tenantId, request.receiver().trim(), request.phone().trim(),
        orEmpty(request.province()), orEmpty(request.city()), orEmpty(request.district()),
        request.detail().trim(), makeDefault);
    return listAddresses();
  }

  @Transactional
  public List<MallAddress> markDefaultAddress(String addressId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    mallCartMapper.clearDefault(tenantId);
    if (mallCartMapper.markDefault(tenantId, addressId) == 0) {
      throw new IllegalArgumentException("收货地址不存在: " + addressId);
    }
    return listAddresses();
  }

  @Transactional
  public List<MallAddress> deleteAddress(String addressId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer mall APIs");
    mallCartMapper.deleteAddress(tenantId, addressId);
    return listAddresses();
  }

  // ── 内部 ───────────────────────────────────────────────────
  private void ensureCart(String tenantId, String userId) {
    if (mallCartMapper.findCartId(tenantId, userId) == null) {
      mallCartMapper.insertCart("mc-" + UUID.randomUUID(), tenantId, userId);
    }
  }

  private MallSku requireVisibleSku(String tenantId, String skuId) {
    MallSku sku = mallCatalogMapper.findSkuForTenant(tenantId, skuId);
    if (sku == null) {
      throw new IllegalArgumentException("商品规格不存在或不在本企业可见范围: " + skuId);
    }
    return sku;
  }

  private MallCartResponse render(String tenantId, List<MallCartItem> items) {
    Map<String, List<MallCartResponse.CartLineResponse>> bySupplier = new LinkedHashMap<>();
    Map<String, String> supplierNames = new LinkedHashMap<>();
    BigDecimal total = BigDecimal.ZERO;
    boolean blocked = false;

    for (MallCartItem item : items) {
      MallSku sku = mallCatalogMapper.findSkuForTenant(tenantId, item.skuId());
      if (sku == null) {
        // SKU 已被删除:如实呈现为失效行,而不是从购物车里静默消失。
        blocked = true;
        bySupplier.computeIfAbsent("", k -> new ArrayList<>()).add(
            new MallCartResponse.CartLineResponse(
                item.skuId(), null, "商品已下架或删除", null, null, null, item.quantity(),
                null, null, null, null, null, 0, "商品已下架"));
        continue;
      }
      MallProduct product = mallCatalogMapper.findProductForTenant(tenantId, sku.productId());
      List<MallTierPrice> tiers = mallCatalogMapper.listTiersForTenant(tenantId, sku.id());
      BigDecimal unitPrice = MallCatalogPolicy.effectivePrice(sku, tiers, item.quantity());
      BigDecimal lineTotal = unitPrice.multiply(item.quantity()).setScale(2,java.math.RoundingMode.HALF_UP);

      String blockedReason = null;
      try {
        MallCatalogPolicy.requireOrderable(product, sku, item.quantity());
      } catch (RuntimeException exception) {
        blockedReason = exception.getMessage();
        blocked = true;
      }
      if (blockedReason == null) {
        total = total.add(lineTotal);
      }
      supplierNames.put(product.supplierId(), product.supplierName());
      bySupplier.computeIfAbsent(product.supplierId(), k -> new ArrayList<>()).add(
          new MallCartResponse.CartLineResponse(
              sku.id(), product.id(), product.name(), sku.skuCode(), sku.spec(), sku.unit(),
              item.quantity(), unitPrice, lineTotal, sku.minOrderQty(), sku.stepQty(),
              sku.stockQty(), sku.leadTimeDays(), blockedReason));
    }

    List<MallCartResponse.SupplierGroup> groups = bySupplier.entrySet().stream()
        .map(entry -> new MallCartResponse.SupplierGroup(
            entry.getKey(),
            supplierNames.getOrDefault(entry.getKey(), "—"),
            entry.getValue().stream()
                .filter(line -> line.blockedReason() == null)
                .map(MallCartResponse.CartLineResponse::lineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add),
            entry.getValue()))
        .toList();

    return new MallCartResponse(groups, total, items.size(), blocked);
  }

  private static String orEmpty(String value) {
    return value == null ? "" : value.trim();
  }
}
