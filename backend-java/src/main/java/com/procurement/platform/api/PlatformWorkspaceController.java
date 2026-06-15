package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformWorkspaceApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/workspace")
public class PlatformWorkspaceController {
  private final PlatformWorkspaceApplicationService platformWorkspaceApplicationService;

  public PlatformWorkspaceController(PlatformWorkspaceApplicationService platformWorkspaceApplicationService) {
    this.platformWorkspaceApplicationService = platformWorkspaceApplicationService;
  }

  @GetMapping
  public ApiResponse<PlatformWorkspaceResponse> load() {
    return ApiResponse.ok(platformWorkspaceApplicationService.load());
  }
}
