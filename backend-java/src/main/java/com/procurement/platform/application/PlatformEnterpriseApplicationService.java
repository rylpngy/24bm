package com.procurement.platform.application;

import com.procurement.platform.api.EnterpriseReviewRequest;
import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.domain.EnterpriseReview;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformEnterpriseApplicationService {
  private final PlatformEnterpriseMapper platformEnterpriseMapper;

  public PlatformEnterpriseApplicationService(PlatformEnterpriseMapper platformEnterpriseMapper) {
    this.platformEnterpriseMapper = platformEnterpriseMapper;
  }

  public List<EnterpriseReviewResponse> listPendingReviews() {
    return platformEnterpriseMapper.listPendingReviews().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public EnterpriseReviewResponse reviewEnterprise(String enterpriseId, EnterpriseReviewRequest request) {
    int updated = platformEnterpriseMapper.updateEnterpriseVerified(enterpriseId, request.verified());
    if (updated == 0) {
      throw new IllegalArgumentException("Enterprise not found: " + enterpriseId);
    }
    platformEnterpriseMapper.updateSupplierReviewStatus(enterpriseId, request.reviewStatus());
    return toResponse(platformEnterpriseMapper.findById(enterpriseId));
  }

  private EnterpriseReviewResponse toResponse(EnterpriseReview review) {
    return new EnterpriseReviewResponse(
        review.id(),
        review.name(),
        review.type(),
        review.verified(),
        review.reviewStatus());
  }
}
