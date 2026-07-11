package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PublicPortalApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 公开门户只读 API(permitAll):认证供应商名录 + 生效平台公告,供未登录门户首页展示。
@RestController
@RequestMapping("/api/v1/public")
public class PublicPortalController {
  private final PublicPortalApplicationService publicPortalApplicationService;

  public PublicPortalController(PublicPortalApplicationService publicPortalApplicationService) {
    this.publicPortalApplicationService = publicPortalApplicationService;
  }

  @GetMapping("/suppliers")
  public ApiResponse<List<PublicSupplierResponse>> listSuppliers() {
    return ApiResponse.ok(publicPortalApplicationService.listPublicSuppliers());
  }

  @GetMapping("/suppliers/{enterpriseId}")
  public ApiResponse<PublicSupplierResponse> getSupplier(@PathVariable String enterpriseId) {
    return ApiResponse.ok(publicPortalApplicationService.getPublicSupplier(enterpriseId));
  }

  @GetMapping("/announcements")
  public ApiResponse<List<PublicAnnouncementResponse>> listAnnouncements() {
    return ApiResponse.ok(publicPortalApplicationService.listActiveAnnouncements());
  }

  @GetMapping("/announcements/{announcementId}")
  public ApiResponse<PublicAnnouncementResponse> getAnnouncement(@PathVariable String announcementId) {
    return ApiResponse.ok(publicPortalApplicationService.getActiveAnnouncement(announcementId));
  }
}
