package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.infrastructure.PermissionMapper;
import com.procurement.mall.api.ReviewMallProductRequest;
import com.procurement.mall.application.MallCatalogApplicationService;
import com.procurement.mall.application.MallPublicCatalogReviewApplicationService;
import java.util.List;
import org.junit.jupiter.api.*;

class MallPublicCatalogReviewTests {
  final MallCatalogApplicationService catalog = mock(MallCatalogApplicationService.class);
  final PermissionMapper mapper = mock(PermissionMapper.class);
  final MallPublicCatalogReviewApplicationService reviews = new MallPublicCatalogReviewApplicationService(catalog, new PermissionService(mapper));
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void supplierBuyerAndNonReviewerPlatformAccountsCannotApprovePublicProducts() {
    for (String[] context : List.of(new String[] {null, "supplier"}, new String[] {"tenant", null}, new String[] {null, null})) {
      TenantContext.set(context[0], context[1], "user");
      assertThatThrownBy(reviews::listPendingReview).isInstanceOf(PermissionDeniedException.class);
      assertThatThrownBy(() -> reviews.review("p", new ReviewMallProductRequest(true, "Bypass")))
          .isInstanceOf(PermissionDeniedException.class);
    }
    verifyNoInteractions(catalog);
  }

  @Test void scopedCallerCannotUseEvenAnAccidentallyGrantedPlatformPermission() {
    TenantContext.set(null, "supplier", "user");
    when(mapper.listUserPermissions("user")).thenReturn(List.of("platform:*"));
    assertThatThrownBy(reviews::listPendingReview).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(catalog);
  }
}
