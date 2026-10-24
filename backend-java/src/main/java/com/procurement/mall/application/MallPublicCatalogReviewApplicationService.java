package com.procurement.mall.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.mall.api.MallProductResponse;
import com.procurement.mall.api.ReviewMallProductRequest;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Public publication has platform-wide impact and is reserved for full platform administrators. */
@Service
public class MallPublicCatalogReviewApplicationService {
  private final MallCatalogApplicationService catalog;
  private final PermissionService permissions;

  public MallPublicCatalogReviewApplicationService(MallCatalogApplicationService catalog, PermissionService permissions) {
    this.catalog = catalog;
    this.permissions = permissions;
  }

  public List<MallProductResponse> listPendingReview() {
    requirePlatformReviewer();
    return catalog.listPublicPendingReview();
  }

  @Transactional
  public MallProductResponse review(String productId, ReviewMallProductRequest request) {
    requirePlatformReviewer();
    return catalog.reviewPublicProduct(productId, request);
  }

  private void requirePlatformReviewer() {
    TenantAccessGuard.requirePlatformUserId("platform public catalog review");
    permissions.require("platform:*");
  }
}
