package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.mall.api.*;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.infrastructure.MallCatalogMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
@org.springframework.test.annotation.DirtiesContext
class MallCatalogMaintenancePostgresIT {
  @Container static final PostgreSQLContainer<?> DB = new PostgreSQLContainer<>("postgres:16-alpine");
  @DynamicPropertySource static void properties(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", DB::getJdbcUrl);
    r.add("spring.datasource.username", DB::getUsername);
    r.add("spring.datasource.password", DB::getPassword);
    r.add("keycloak.enabled", () -> false);
    r.add("app.seed.locations", () -> "");
  }
  @Autowired JdbcTemplate jdbc;
  @Autowired MallCatalogApplicationService service;
  @Autowired com.procurement.mall.application.MallApplicationService legacy;
  @Autowired com.procurement.mall.application.MallPublicCatalogReviewApplicationService publicReviews;
  @Autowired MallCatalogMapper mapper;
  @Autowired PlatformTransactionManager transactionManager;
  String tenant, supplier, user, product, sku;

  @BeforeEach void seed() {
    String key = "catalog-" + UUID.randomUUID();
    tenant = key + "t"; supplier = key + "s"; user = key + "u";
    product = key + "p"; sku = key + "sku";
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Catalog buyer','starter','active')", tenant);
    jdbc.update("insert into enterprises(id,name,type) values (?,'Catalog supplier','supplier')", supplier);
    jdbc.update("insert into users(id,tenant_id,name,status) values (?,?,'Catalog operator','active')", user, tenant);
    jdbc.update("insert into buyer_supplier_relations(id,tenant_id,supplier_id,status,level) values (?,?,?,'已准入','普通')", key + "r", tenant, supplier);
    jdbc.update("insert into mall_products(id,scope,tenant_id,supplier_id,name,status,review_comment,reviewed_at) values (?,'tenant',?,?,'Paper','待审核','Prior evidence',now())", product, tenant, supplier);
    jdbc.update("insert into mall_skus(id,product_id,sku_code,unit,price,status) values (?,?,'A4','box',10,'在架')", sku, product);
    supplier();
  }
  void supplier() { TenantContext.set(null, supplier, user); }
  void buyer() { TenantContext.set(tenant, null, user); }
  @AfterEach void clear() { TenantContext.clear(); }
  String status() { return jdbc.queryForObject("select status from mall_products where id=?", String.class, product); }
  SaveMallSkuRequest change(String spec) {
    return new SaveMallSkuRequest("A4-new", spec, null, "box", new BigDecimal("12.50"),
        BigDecimal.ONE, BigDecimal.ONE, BigDecimal.TEN, 2,
        List.of(new SaveMallSkuRequest.TierPriceLine(BigDecimal.TEN, BigDecimal.TEN)));
  }

  @Test void pendingSkuEditWithdrawsSubmissionAndPreservesPriorEvidence() {
    var updated = service.updateSku(product, sku, change("{\"size\":\"A4\"}"));
    assertThat(updated.status()).isEqualTo("草稿");
    assertThat(updated.skus().getFirst().skuCode()).isEqualTo("A4-new");
    assertThat(updated.skus().getFirst().price()).isEqualByComparingTo("12.50");
    assertThat(jdbc.queryForObject("select review_comment from mall_products where id=?", String.class, product)).isEqualTo("Prior evidence");
    buyer();
    assertThatThrownBy(() -> service.reviewProduct(product, new ReviewMallProductRequest(true, "Old screen")))
        .hasMessageContaining("待审核");
    supplier();
    service.updateProductStatus(product, new UpdateMallProductStatusRequest("待审核"));
    buyer();
    assertThat(service.reviewProduct(product, new ReviewMallProductRequest(true, "New approval")).status()).isEqualTo("在架");
  }

  @Test void mutationAndReviewRaceNeverLeavesChangedProductApproved() throws Exception {
    var start = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var edit = pool.submit(() -> {
        supplier();
        try { start.await(); return service.updateSku(product, sku, change("{}")); }
        finally { TenantContext.clear(); }
      });
      var review = pool.submit(() -> {
        buyer();
        try {
          start.await();
          service.reviewProduct(product, new ReviewMallProductRequest(true, "Concurrent approval"));
          return true;
        } catch (IllegalStateException e) { return false; }
        finally { TenantContext.clear(); }
      });
      start.countDown();
      edit.get(20, TimeUnit.SECONDS);
      review.get(20, TimeUnit.SECONDS);
      assertThat(status()).isEqualTo("草稿");
      assertThat(jdbc.queryForObject("select price from mall_skus where id=?", BigDecimal.class, sku)).isEqualByComparingTo("12.50");
    }
  }

  @Test void reviewWaitsForProductLockAndSeesCommittedWithdrawal() throws Exception {
    var locked = new CountDownLatch(1);
    var release = new CountDownLatch(1);
    try (var pool = Executors.newFixedThreadPool(2)) {
      var edit = pool.submit(() -> new TransactionTemplate(transactionManager).execute(tx -> {
        mapper.lockProductForSupplier(supplier, product);
        locked.countDown();
        try { if (!release.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Lock test timed out"); }
        catch (InterruptedException e) { throw new RuntimeException(e); }
        mapper.invalidatePublication(supplier, product);
        return true;
      }));
      assertThat(locked.await(10, TimeUnit.SECONDS)).isTrue();
      var review = pool.submit(() -> {
        buyer();
        try { service.reviewProduct(product, new ReviewMallProductRequest(true, "Must wait")); return true; }
        catch (IllegalStateException e) { return false; }
        finally { TenantContext.clear(); }
      });
      try { assertThatThrownBy(() -> review.get(200, TimeUnit.MILLISECONDS)).isInstanceOf(TimeoutException.class); }
      finally { release.countDown(); }
      edit.get(20, TimeUnit.SECONDS);
      assertThat(review.get(20, TimeUnit.SECONDS)).isFalse();
      assertThat(status()).isEqualTo("草稿");
    } finally { release.countDown(); }
  }

  @Test void crossProductSkuAndRevokedAdmissionCannotBypassReview() {
    String other = product + "other";
    jdbc.update("insert into mall_products(id,scope,tenant_id,supplier_id,name,status) values (?,'tenant',?,?,'Other','在架')", other, tenant, supplier);
    assertThatThrownBy(() -> service.updateSku(other, sku, change("{}"))).hasMessageContaining("当前商品");
    assertThat(jdbc.queryForObject("select price from mall_skus where id=?", BigDecimal.class, sku)).isEqualByComparingTo("10");
    jdbc.update("update buyer_supplier_relations set status='已退出' where tenant_id=? and supplier_id=?", tenant, supplier);
    assertThatThrownBy(() -> service.updateSku(product, sku, change("{}"))).hasMessageContaining("准入");
    buyer();
    assertThatThrownBy(() -> service.reviewProduct(product, new ReviewMallProductRequest(true, "Denied"))).hasMessageContaining("准入");
    jdbc.update("update mall_products set status='在架' where id=?", product);
    assertThat(service.listForBuyer(null, null)).noneMatch(p -> p.id().equals(product));
    assertThatThrownBy(() -> service.findForBuyer(product)).hasMessageContaining("准入");
    supplier();
    assertThat(service.updateProductStatus(product, new UpdateMallProductStatusRequest("下架")).status()).isEqualTo("下架");
  }

  @Test void invalidVariantOrForeignCategoryRollsBackWithoutLosingHistoricalCatalog() {
    String otherTenant = tenant + "other";
    jdbc.update("insert into tenants(id,name,plan,status) values (?,'Other buyer','starter','active')", otherTenant);
    jdbc.update("insert into mall_categories(id,tenant_id,name) values (?,?,'Private category')", otherTenant + "category", otherTenant);
    assertThatThrownBy(() -> service.updateProduct(product,
        new SaveMallProductRequest(null, "Changed", null, null, otherTenant + "category", null)))
        .hasMessageContaining("分类");
    assertThatThrownBy(() -> service.updateSku(product, sku, change("[]"))).hasMessageContaining("JSON 对象");
    assertThat(status()).isEqualTo("待审核");
    assertThat(jdbc.queryForObject("select name from mall_products where id=?", String.class, product)).isEqualTo("Paper");
  }

  String platformReviewer() {
    String admin = product + "admin";
    jdbc.update("insert into users(id,name,status) values (?,'Platform reviewer','active')", admin);
    jdbc.update("insert into roles(id,scope,name,permissions) values (?,'platform','Catalog reviewer','[\"platform:*\"]')", admin + "role");
    jdbc.update("insert into user_roles(user_id,role_id) values (?,?)", admin, admin + "role");
    return admin;
  }

  @Test void publicProductCanBeEditedResubmittedAndOnlyPublishedByPlatformReviewer() {
    String admin = platformReviewer();
    String historicalMaterial = product + "material";
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'A4','Paper','Office','box')",
        historicalMaterial, tenant);
    jdbc.update("update mall_skus set material_id=? where id=?", historicalMaterial, sku);
    jdbc.update("update mall_products set scope='public',tenant_id=null where id=?", product);
    assertThat(service.updateProduct(product, new SaveMallProductRequest(null, "Public paper", "", "", null, null)).status())
        .isEqualTo("草稿");
    assertThatThrownBy(() -> service.updateProductStatus(product, new UpdateMallProductStatusRequest("在架")))
        .hasMessageContaining("审核");
    service.updateProductStatus(product, new UpdateMallProductStatusRequest("待审核"));
    assertThatThrownBy(() -> publicReviews.review(product, new ReviewMallProductRequest(true, "Self publish")))
        .isInstanceOf(com.procurement.common.tenant.PermissionDeniedException.class);
    buyer();
    assertThat(service.listPendingReview()).noneMatch(p -> p.id().equals(product));
    assertThatThrownBy(() -> service.reviewProduct(product, new ReviewMallProductRequest(true, "Buyer bypass")))
        .isInstanceOf(IllegalArgumentException.class);
    TenantContext.set(null, null, admin);
    assertThat(publicReviews.listPendingReview()).anyMatch(p -> p.id().equals(product));
    assertThat(publicReviews.review(product, new ReviewMallProductRequest(true, "Platform approval")).status()).isEqualTo("在架");
    assertThatThrownBy(() -> publicReviews.review(product, new ReviewMallProductRequest(true, "Duplicate")))
        .hasMessageContaining("待审核");
    assertThat(jdbc.queryForObject("select detail from audit_logs where action='mall_public_product.reviewed' and target_id=?", String.class, product))
        .contains("Platform approval");
    supplier();
    var changed = change("{}");
    service.updateSku(product, sku, new SaveMallSkuRequest(changed.skuCode(), changed.spec(), historicalMaterial,
        changed.unit(), changed.price(), changed.minOrderQty(), changed.stepQty(), changed.stockQty(),
        changed.leadTimeDays(), changed.tierPrices()));
    assertThat(jdbc.queryForObject("select material_id from mall_skus where id=?", String.class, sku)).isEqualTo(historicalMaterial);
    assertThat(status()).isEqualTo("草稿");
    service.updateProductStatus(product, new UpdateMallProductStatusRequest("待审核"));
    TenantContext.set(null, null, admin);
    assertThat(publicReviews.review(product, new ReviewMallProductRequest(false, "Revise description")).status()).isEqualTo("草稿");
  }

  @Test void legacyPricePreservesStockAndInvalidPriceRollsBackApprovalWithdrawal() {
    jdbc.update("update mall_products set status='在架' where id=?", product);
    jdbc.update("update mall_skus set stock_qty=7 where id=?", sku);
    assertThatThrownBy(() -> legacy.supplierUpdatePrice(sku, new UpdateMallListingPriceRequest(new BigDecimal("0.001"))))
        .hasMessageContaining("小数");
    assertThat(status()).isEqualTo("在架");
    legacy.supplierUpdatePrice(sku, new UpdateMallListingPriceRequest(new BigDecimal("12.50")));
    assertThat(status()).isEqualTo("草稿");
    assertThat(jdbc.queryForObject("select stock_qty from mall_skus where id=?", BigDecimal.class, sku)).isEqualByComparingTo("7");
    assertThat(jdbc.queryForObject("select price from mall_skus where id=?", BigDecimal.class, sku)).isEqualByComparingTo("12.50");
    legacy.supplierUpdateStatus(sku, new UpdateMallListingStatusRequest("在架"));
    assertThat(status()).isEqualTo("草稿");
  }

  @Test void platformReviewCannotChangeTenantProduct() {
    TenantContext.set(null, null, platformReviewer());
    assertThatThrownBy(() -> publicReviews.review(product, new ReviewMallProductRequest(true, "Wrong scope")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThat(status()).isEqualTo("待审核");
  }

  @Test void freshTenantCanSelectRealMaterialCategoryWithoutGetSideWritesOrForgedCategories() {
    String global = product + "global";
    jdbc.update("insert into mall_categories(id,name) values (?,'平台通用')", global);
    jdbc.update("insert into materials(id,tenant_id,code,name,category,unit) values (?,?,'OFFICE','Paper','办公用品','box')",
        product + "material", tenant);
    String derived = jdbc.queryForObject("select 'mc-' || ? || '-' || md5('办公用品')", String.class, tenant);
    var categories = service.listCategoriesForSupplier(tenant);
    assertThat(categories).extracting(com.procurement.mall.domain.MallCategory::id).contains(global, derived);
    assertThat(jdbc.queryForObject("select count(*) from mall_categories where tenant_id=?", Integer.class, tenant)).isZero();
    assertThatThrownBy(() -> service.listCategoriesForSupplier("other-tenant")).hasMessageContaining("准入");
    var created = service.createProduct(new SaveMallProductRequest(tenant, "New office product", "", "", derived, null));
    assertThat(created.categoryId()).isEqualTo(derived);
    assertThat(created.categoryName()).isEqualTo("办公用品");
    assertThat(created.tenantId()).isEqualTo(tenant);
    service.updateProduct(product, new SaveMallProductRequest(null, "Paper", "", "", derived, null));
    assertThat(jdbc.queryForObject("select count(*) from mall_categories where id=?", Integer.class, derived)).isEqualTo(1);
    assertThat(service.listCategoriesForSupplier(tenant)).filteredOn(c -> c.name().equals("办公用品")).hasSize(1);
    String forged = jdbc.queryForObject("select 'mc-' || ? || '-' || md5('不存在的分类')", String.class, tenant);
    assertThatThrownBy(() -> service.createProduct(new SaveMallProductRequest(tenant, "Forged", "", "", forged, null)))
        .hasMessageContaining("分类");
    assertThat(jdbc.queryForObject("select count(*) from mall_categories where id=?", Integer.class, forged)).isZero();
    buyer();
    assertThat(service.listCategories()).extracting(com.procurement.mall.domain.MallCategory::id).contains(derived);
  }
}
