package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformAnnouncementApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/announcements")
public class SupplierAnnouncementController {
  private final PlatformAnnouncementApplicationService platformAnnouncementApplicationService;

  public SupplierAnnouncementController(
      PlatformAnnouncementApplicationService platformAnnouncementApplicationService) {
    this.platformAnnouncementApplicationService = platformAnnouncementApplicationService;
  }

  @GetMapping
  public ApiResponse<List<PlatformAnnouncementResponse>> list() {
    return ApiResponse.ok(platformAnnouncementApplicationService.listSupplierVisible());
  }
}
