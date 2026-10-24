package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.infrastructure.PermissionMapper;
import com.procurement.mall.api.ReviewMallProductRequest;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.application.MallPublicCatalogReviewApplicationService;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.infrastructure.*;
import com.procurement.notification.application.NotificationApplicationService;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.mapping.ParameterMapping;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Reviewed exception to tenant equality: platform-owned public products have tenant_id NULL. */
class ScopedMapperMutationTests {
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void exemptionIsLimitedToOneExplicitMethodNotAnEntireMapper() throws Exception {
    var field = TenantIsolationArchitectureTests.class.getDeclaredField("SHARED_SCOPE_MAPPERS");
    field.setAccessible(true);
    Set<?> exceptions = (Set<?>) field.get(null);
    assertThat(exceptions.contains("mall/infrastructure/MallPublicCatalogReviewMapper.java")).isFalse();
    assertThat(exceptions.contains("mall/infrastructure/MallCatalogMapper.java")).isFalse();
    var methods = TenantIsolationArchitectureTests.class.getDeclaredField("PLATFORM_PUBLIC_REVIEW_MUTATIONS");
    methods.setAccessible(true);
    assertThat((Set<?>) methods.get(null)).hasSize(1);
    assertThat(((Set<?>) methods.get(null)).contains("mall/infrastructure/MallPublicCatalogReviewMapper.java#reviewPublicProduct")).isTrue();
    assertThat(Arrays.stream(MallPublicCatalogReviewMapper.class.getDeclaredMethods()).map(m -> m.getName()))
        .containsExactlyInAnyOrder("lockPublicProduct", "listPublicPendingReview", "reviewPublicProduct");
  }

  @Test void publicReviewBindsIdDecisionAndCommentWithoutInterpolatingOrWeakeningScope() {
    var configuration = new Configuration();
    configuration.addMapper(MallPublicCatalogReviewMapper.class);
    String hostileId = "private-product' OR 1=1 --";
    var parameters = java.util.Map.of("id", hostileId, "status", "在架", "comment", "Checked");
    var bound = configuration.getMappedStatement(MallPublicCatalogReviewMapper.class.getName() + ".reviewPublicProduct")
        .getBoundSql(parameters);
    assertThat(bound.getParameterMappings()).extracting(ParameterMapping::getProperty)
        .containsExactly("status", "comment", "id");
    assertThat(bound.getSql().replaceAll("\\s+", " ").trim())
        .contains("set status = ?, review_comment = ?")
        .endsWith("where id = ? and scope = 'public' and tenant_id is null and status = '待审核'")
        .doesNotContain(hostileId);
    assertThat(bound.getParameterObject()).isSameAs(parameters);
  }

  @Test void everyExemptQueryRequiresBothPublicScopeAndNullTenantAndMutationRequiresPendingId() throws Exception {
    for (var method : MallPublicCatalogReviewMapper.class.getDeclaredMethods()) {
      String sql = method.isAnnotationPresent(Select.class)
          ? String.join(" ", method.getAnnotation(Select.class).value())
          : String.join(" ", method.getAnnotation(Update.class).value());
      sql = sql.replaceAll("\\s+", " ").toLowerCase();
      assertThat(sql).contains("scope = 'public'", "tenant_id is null");
    }
    String update = String.join(" ", MallPublicCatalogReviewMapper.class
        .getMethod("reviewPublicProduct", String.class, String.class, String.class)
        .getAnnotation(Update.class).value()).replaceAll("\\s+", " ").trim();
    assertThat(update).endsWith("where id = #{id} and scope = 'public' and tenant_id is null and status = '待审核'");
    assertThat(update).contains("review_comment = #{comment}", "reviewed_at = now()");
    String lock = String.join(" ", MallPublicCatalogReviewMapper.class.getMethod("lockPublicProduct", String.class)
        .getAnnotation(Select.class).value());
    assertThat(lock).contains("p.id = #{id}", "for update of p");
  }

  @Test void authorizedPublicReviewLocksBeforeMutationAndWritesIdentifiedMandatoryAudit() {
    var catalogMapper = mock(MallCatalogMapper.class);
    var publicMapper = mock(MallPublicCatalogReviewMapper.class);
    var audit = mock(AuditLogApplicationService.class);
    var permissionMapper = mock(PermissionMapper.class);
    var catalog = new MallCatalogApplicationService(catalogMapper, mock(PublicMallMapper.class),
        mock(MallListingMapper.class), audit, mock(NotificationApplicationService.class), publicMapper);
    var service = new MallPublicCatalogReviewApplicationService(catalog, new PermissionService(permissionMapper));
    var product = new MallProduct("p", "public", null, "supplier", "Supplier", null, null,
        "Public paper", "", "", null, "待审核", null, null);
    var sku = new MallSku("sku", "p", "A4", "{}", null, "box", BigDecimal.TEN,
        BigDecimal.ONE, BigDecimal.ONE, null, 3, "在架", null, null);
    when(permissionMapper.listUserPermissions("reviewer")).thenReturn(List.of("platform:*"));
    when(publicMapper.lockPublicProduct("p")).thenReturn(product);
    when(publicMapper.reviewPublicProduct("p", "在架", "Checked")).thenReturn(1);
    when(catalogMapper.listSkusForSupplier("supplier", "p")).thenReturn(List.of(sku));
    when(catalogMapper.findProductForSupplier("supplier", "p")).thenReturn(product);
    TenantContext.set(null, null, "reviewer");
    service.review("p", new ReviewMallProductRequest(true, "Checked"));
    var order = inOrder(permissionMapper, publicMapper, audit);
    order.verify(permissionMapper).listUserPermissions("reviewer");
    order.verify(publicMapper).lockPublicProduct("p");
    order.verify(publicMapper).reviewPublicProduct("p", "在架", "Checked");
    order.verify(audit).recordTenantAction(null, "mall_public_product.reviewed", "mall_product", "p", "在架:Checked");
  }
}
