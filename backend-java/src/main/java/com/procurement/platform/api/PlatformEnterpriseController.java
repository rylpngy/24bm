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

  // 多步审核工作流:按状态机推进一步(初审通过/准入通过/驳回/退回/重新受理)。
  @PostMapping("/{enterpriseId}/advance")
  public ApiResponse<EnterpriseReviewResponse> advance(
      @PathVariable String enterpriseId,
      @Valid @RequestBody AdvanceEnterpriseReviewRequest request) {
    return ApiResponse.ok(platformEnterpriseApplicationService.advanceReview(enterpriseId, request));
  }

  // 审核时间线:某企业的全部状态流转留痕(倒序)。
  @GetMapping("/{enterpriseId}/events")
  public ApiResponse<List<EnterpriseReviewEventResponse>> events(@PathVariable String enterpriseId) {
    return ApiResponse.ok(platformEnterpriseApplicationService.listReviewEvents(enterpriseId));
  }
}
