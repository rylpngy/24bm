package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.mall.api.*;
import com.procurement.mall.application.MallApplicationService;
import com.procurement.mall.domain.*;
import com.procurement.mall.infrastructure.*;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.*;

class MallLegacyCatalogMutationTests {
  final MallCatalogMapper mapper = mock(MallCatalogMapper.class);
  final MallListingMapper listings = mock(MallListingMapper.class);
  final MallApplicationService service = new MallApplicationService(listings, mapper, null, null,
      null, mock(AuditLogApplicationService.class), null, null, null);

  MallProduct product(String status) {
    return new MallProduct("p", "tenant", "t", "s", "Supplier", null, null,
        "Paper", "", "", null, status, null, null);
  }
  MallSku sku(String stock) {
    return new MallSku("sku", "p", "A4", "{}", null, "box", BigDecimal.TEN,
        BigDecimal.ONE, BigDecimal.ONE, new BigDecimal(stock), 3, "在架", null, null);
  }
  @BeforeEach void setup() {
    TenantContext.set(null, "s", "user");
    when(mapper.listBySupplier("s")).thenReturn(List.of(product("在架")));
    when(mapper.listSkusForSupplier("s", "p")).thenReturn(List.of(sku("20")));
    when(mapper.lockProductForSupplier("s", "p")).thenReturn(product("在架"));
    when(mapper.lockSkuForSupplier("s", "p", "sku")).thenReturn(sku("7"));
    when(mapper.findProductForSupplier("s", "p")).thenReturn(product("草稿"));
    when(mapper.findSkuForTenant("t", "sku")).thenReturn(sku("7"));
    when(mapper.listTiersForSupplier("s", "sku")).thenReturn(List.of());
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(1);
    when(mapper.updateSkuPriceForSupplier(eq("s"), eq("p"), eq("sku"), any())).thenReturn(1);
    when(mapper.updateSkuStatusForSupplier(eq("sku"), eq("s"), anyString())).thenReturn(1);
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void legacyPriceLocksAggregateWithdrawsApprovalAndNeverWritesStock() {
    var result = service.supplierUpdatePrice("sku", new UpdateMallListingPriceRequest(new BigDecimal("12.50")));
    assertThat(result.productStatus()).isEqualTo("草稿");
    var order = inOrder(mapper);
    order.verify(mapper).lockProductForSupplier("s", "p");
    order.verify(mapper).lockSkuForSupplier("s", "p", "sku");
    order.verify(mapper).invalidatePublication("s", "p");
    order.verify(mapper).updateSkuPriceForSupplier("s", "p", "sku", new BigDecimal("12.50"));
    verify(mapper, never()).updateSkuForSupplier(anyString(), anyString(), any(), any(), any(), any(), anyInt());
  }

  @Test void legacyPriceRejectsDatabaseRoundingAndIncompatibleExistingTiers() {
    assertThatThrownBy(() -> service.supplierUpdatePrice("sku", new UpdateMallListingPriceRequest(new BigDecimal("0.001"))))
        .hasMessageContaining("小数");
    when(mapper.listTiersForSupplier("s", "sku")).thenReturn(List.of(new MallTierPrice("sku", BigDecimal.TEN, BigDecimal.TEN)));
    assertThatThrownBy(() -> service.supplierUpdatePrice("sku", new UpdateMallListingPriceRequest(new BigDecimal("8"))))
        .hasMessageContaining("递减");
    verify(mapper, never()).updateSkuPriceForSupplier(anyString(), anyString(), anyString(), any());
  }

  @Test void activationOnlyEnablesSkuAndRequiresNewReviewOfProduct() {
    var result = service.supplierUpdateStatus("sku", new UpdateMallListingStatusRequest("在架"));
    assertThat(result.productStatus()).isEqualTo("草稿");
    verify(mapper).invalidatePublication("s", "p");
    verify(mapper).updateSkuStatusForSupplier("sku", "s", "在架");
    verify(mapper, never()).updateProductStatusBySupplier(anyString(), anyString(), eq("在架"));
  }

  @Test void revokedAdmissionBlocksPriceAndActivationButStillPermitsDelisting() {
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(0);
    assertThatThrownBy(() -> service.supplierUpdatePrice("sku", new UpdateMallListingPriceRequest(BigDecimal.TEN)))
        .hasMessageContaining("准入");
    assertThatThrownBy(() -> service.supplierUpdateStatus("sku", new UpdateMallListingStatusRequest("在架")))
        .hasMessageContaining("准入");
    assertThatCode(() -> service.supplierUpdateStatus("sku", new UpdateMallListingStatusRequest("下架"))).doesNotThrowAnyException();
    verify(mapper).updateSkuStatusForSupplier("sku", "s", "下架");
    verify(mapper, never()).updateSkuPriceForSupplier(anyString(), anyString(), anyString(), any());
    verify(mapper, never()).invalidatePublication(anyString(), anyString());
  }
}
