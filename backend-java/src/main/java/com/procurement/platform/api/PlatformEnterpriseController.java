package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/enterprise-reviews")
public class PlatformEnterpriseController {
  private final PlatformEnterpriseApplicationService platformEnterpriseApplicationService;

  public PlatformEnterpriseController(PlatformEnterpriseApplicationService platformEnterpriseApplicationService) {
    this.platformEnterpriseApplicationService = platformEnterpriseApplicationService;
  }

  @GetMapping
  public ApiResponse<List<EnterpriseReviewResponse>> listPendingReviews() {
    return ApiResponse.ok(platformEnterpriseApplicationService.listPendingReviews());
  }

  @PostMapping("/{enterpriseId}")
  public ApiResponse<EnterpriseReviewResponse> review(
      @PathVariable String enterpriseId,
      @Valid @RequestBody EnterpriseReviewRequest request) {
    return ApiResponse.ok(platformEnterpriseApplicationService.reviewEnterprise(enterpriseId, request));
  }
}
