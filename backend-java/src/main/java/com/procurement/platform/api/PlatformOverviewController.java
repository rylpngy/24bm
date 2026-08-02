package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformOverviewApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform")
public class PlatformOverviewController {
  private final PlatformOverviewApplicationService platformOverviewApplicationService;

  public PlatformOverviewController(PlatformOverviewApplicationService platformOverviewApplicationService) {
    this.platformOverviewApplicationService = platformOverviewApplicationService;
  }

  @GetMapping("/overview")
  public ApiResponse<PlatformOverviewResponse> overview() {
    return ApiResponse.ok(platformOverviewApplicationService.overview());
  }

  @GetMapping("/business-metrics")
  public ApiResponse<PlatformBusinessMetricsResponse> businessMetrics() {
    return ApiResponse.ok(platformOverviewApplicationService.businessMetrics());
  }
}
