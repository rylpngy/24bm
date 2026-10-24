package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.mall.api.*;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.domain.*;
import com.procurement.mall.infrastructure.*;
import com.procurement.notification.application.NotificationApplicationService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.*;

class MallCatalogMaintenanceTests {
  final MallCatalogMapper mapper = mock(MallCatalogMapper.class);
  final MallListingMapper listings = mock(MallListingMapper.class);
  final MallCatalogApplicationService service = new MallCatalogApplicationService(mapper,
      mock(PublicMallMapper.class), listings, mock(AuditLogApplicationService.class),
      mock(NotificationApplicationService.class), mock(MallPublicCatalogReviewMapper.class));

  MallProduct product(String status) {
    return new MallProduct("p", "tenant", "t", "s", "supplier", null, null,
        "Paper", "", "", null, status, null, null);
  }
  MallSku sku() {
    return new MallSku("sku", "p", "A4", "{}", null, "box", BigDecimal.TEN,
        BigDecimal.ONE, BigDecimal.ONE, null, 3, "在架", null, null);
  }
  SaveMallSkuRequest request(String spec, String material, BigDecimal stock) {
    return new SaveMallSkuRequest("A4", spec, material, "box", BigDecimal.TEN,
        BigDecimal.ONE, BigDecimal.ONE, stock, 3, List.of());
  }
  @BeforeEach void setup() {
    TenantContext.set(null, "s", "user");
    when(mapper.lockProductForSupplier("s", "p")).thenReturn(product("在架"));
    when(mapper.findProductForSupplier("s", "p")).thenReturn(product("草稿"));
    when(mapper.lockSkuForSupplier("s", "p", "sku")).thenReturn(sku());
    when(mapper.listSkusForSupplier("s", "p")).thenReturn(List.of(sku()));
    when(mapper.listTiersForSupplier("s", "sku")).thenReturn(List.of());
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(1);
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void editingPublishedOrPendingProductWithdrawsPublication() {
    for (String status : List.of("在架", "待审核")) {
      when(mapper.lockProductForSupplier("s", "p")).thenReturn(product(status));
      service.updateProduct("p", new SaveMallProductRequest(null, "New paper", "", "", null, null));
    }
    verify(mapper, times(2)).invalidatePublication("s", "p");
    verify(mapper, never()).updateProductStatusBySupplier(anyString(), anyString(), eq("在架"));
  }

  @Test void skuMutationLocksProductThenActualSkuAndWithdrawsApproval() {
    when(mapper.updateSkuForSupplier(anyString(), anyString(), any(), any(), any(), any(), anyInt())).thenReturn(1);
    service.updateSku("p", "sku", request("{\"size\":\"A4\"}", null, BigDecimal.TEN));
    var order = inOrder(mapper);
    order.verify(mapper).lockProductForSupplier("s", "p");
    order.verify(mapper).lockSkuForSupplier("s", "p", "sku");
    order.verify(mapper).updateSkuForSupplier("sku", "s", BigDecimal.TEN, BigDecimal.ONE,
        BigDecimal.ONE, BigDecimal.TEN, 3);
    order.verify(mapper).updateSkuIdentity("s", "p", "sku", "A4", "{\"size\":\"A4\"}", null, "box");
    order.verify(mapper).invalidatePublication("s", "p");
  }

  @Test void skuFromDifferentProductCannotBeUpdatedOrActivated() {
    assertThatThrownBy(() -> service.updateSku("p", "foreign", request("{}", null, null)))
        .hasMessageContaining("当前商品");
    assertThatThrownBy(() -> service.updateSkuStatus("p", "foreign", "在架"))
        .hasMessageContaining("当前商品");
    verify(mapper, never()).updateSkuForSupplier(anyString(), anyString(), any(), any(), any(), any(), anyInt());
    verify(mapper, never()).updateSkuStatusForSupplier(anyString(), anyString(), anyString());
  }

  @Test void revokedAdmissionBlocksChangesAndSubmissionButAllowsDelisting() {
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(0);
    assertThatThrownBy(() -> service.updateProduct("p", new SaveMallProductRequest(null, "P", null, null, null, null)))
        .hasMessageContaining("准入");
    when(mapper.lockProductForSupplier("s", "p")).thenReturn(product("草稿"));
    assertThatThrownBy(() -> service.updateProductStatus("p", new UpdateMallProductStatusRequest("待审核")))
        .hasMessageContaining("准入");
    when(mapper.updateSkuStatusForSupplier("sku", "s", "下架")).thenReturn(1);
    assertThatCode(() -> service.updateSkuStatus("p", "sku", "下架")).doesNotThrowAnyException();
    verify(mapper).updateSkuStatusForSupplier("sku", "s", "下架");
    verify(mapper, never()).invalidatePublication(anyString(), anyString());
  }

  @Test void rejectsForeignCategoryMaterialAndMalformedVariantsBeforeWrites() {
    assertThatThrownBy(() -> service.updateProduct("p", new SaveMallProductRequest(null, "P", null, null, "foreign", null)))
        .hasMessageContaining("分类");
    assertThatThrownBy(() -> service.addSku("p", request("{}", "foreign", null))).hasMessageContaining("物料");
    for (String spec : List.of("[]", "null", "{} {}", "{broken", "{\"\":\"A4\"}", "{\"size\":[]}", "{\"size\":\"A4\",\"size\":\"A3\"}")) {
      assertThatThrownBy(() -> service.addSku("p", request(spec, null, null)))
          .isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> service.addSku("p", request("{}", null, BigDecimal.ONE.negate())))
        .hasMessageContaining("库存");
    verify(mapper, never()).insertSkuForSupplier(anyString(), anyString(), anyString(), anyString(),
        anyString(), any(), anyString(), any(), any(), any(), any(), anyInt());
  }

  @Test void reviewRechecksCurrentAdmissionAndSellableSkuUnderProductLock() {
    TenantContext.set("t", null, "buyer");
    when(mapper.lockProductForTenant("t", "p")).thenReturn(product("待审核"));
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(0);
    assertThatThrownBy(() -> service.reviewProduct("p", new ReviewMallProductRequest(true, "OK")))
        .hasMessageContaining("准入");
    when(listings.countAdmittedSupplier("t", "s")).thenReturn(1);
    when(mapper.listSkusForSupplier("s", "p")).thenReturn(List.of());
    assertThatThrownBy(() -> service.reviewProduct("p", new ReviewMallProductRequest(true, "OK")))
        .hasMessageContaining("规格");
    verify(mapper, never()).reviewProductByTenant(anyString(), anyString(), anyString(), anyString());
  }

  @Test void legacyHookUsesSameLockAndInvalidationContract() {
    assertThat(service.prepareLegacyListingMutation("p", "sku", true)).isEqualTo(sku());
    var order = inOrder(mapper);
    order.verify(mapper).lockProductForSupplier("s", "p");
    order.verify(mapper).lockSkuForSupplier("s", "p", "sku");
    order.verify(mapper).invalidatePublication("s", "p");
  }

  @Test void tiersRejectDuplicateNullAndUnstorableValues() {
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidTiers(BigDecimal.TEN,
        List.of(new MallTierPrice("sku", BigDecimal.ONE, BigDecimal.ONE),
            new MallTierPrice("sku", new BigDecimal("1.00"), BigDecimal.ONE))))
        .hasMessageContaining("重复");
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidTiers(BigDecimal.TEN,
        List.of(new MallTierPrice("sku", null, BigDecimal.ONE))))
        .hasMessageContaining("不能为空");
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidSku(new BigDecimal("0.001"),
        BigDecimal.ONE, BigDecimal.ONE, 0)).hasMessageContaining("小数");
  }

  @Test void supplierCategoryLookupRequiresAdmissionAndNeverReadsForeignTenantCategories() {
    var global = new MallCategory("global", null, null, "Global", 0, null);
    var own = new MallCategory("own", "t", null, "Office", 1, null);
    when(mapper.listSupplierCategories("t")).thenReturn(List.of(global, own));
    when(mapper.listSupplierCategories(null)).thenReturn(List.of(global));
    assertThat(service.listCategoriesForSupplier("t")).containsExactly(global, own);
    assertThat(service.listCategoriesForSupplier(null)).containsExactly(global);
    assertThatThrownBy(() -> service.listCategoriesForSupplier("foreign")).hasMessageContaining("准入");
    verify(mapper, never()).listSupplierCategories("foreign");
    verify(mapper, never()).materializeMaterialCategory(any(), anyString());
  }

  @Test void categorySelectionIsSavedOnlyForTheProductDestinationAndDestinationIsReturned() {
    when(mapper.countVisibleCategory("t", "own")).thenReturn(1);
    var result = service.updateProduct("p", new SaveMallProductRequest(null, "P", "", "", "own", null));
    assertThat(result.tenantId()).isEqualTo("t");
    verify(mapper).updateProduct("p", "s", "P", "", "", "own", null);
    assertThatThrownBy(() -> service.createProduct(new SaveMallProductRequest("t", "P", "", "", "foreign", null)))
        .hasMessageContaining("分类");
  }

  @Test void selectedDerivedCategoryMustMaterializeFromRealMaterialBeforeSave() {
    String categoryId = "mc-t-material-derived";
    when(mapper.countVisibleCategory("t", categoryId)).thenReturn(0, 1);
    service.updateProduct("p", new SaveMallProductRequest(null, "P", "", "", categoryId, null));
    var order = inOrder(mapper);
    order.verify(mapper).countVisibleCategory("t", categoryId);
    order.verify(mapper).materializeMaterialCategory("t", categoryId);
    order.verify(mapper).countVisibleCategory("t", categoryId);
    order.verify(mapper).updateProduct("p", "s", "P", "", "", categoryId, null);
  }
}
